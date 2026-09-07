import crypto from 'node:crypto';
import { supabase } from '../supabase.js';
import { normalizeAddress } from './addresses.js';

// ════════════════════════════════════════════════════════════════════════════
// smtpCredentials.js — app passwords for OUR SMTP submission server.
//
// tmail users log in through TGO ID (OIDC), so there's no local password to
// authenticate an SMTP client against. A credential is a dedicated secret bound
// to one workspace address: the SMTP username is the @tgo.com address, the SMTP
// password is this secret. Only the sha256 hash is stored; the plaintext is
// shown once at creation, exactly like the service tokens.
// ════════════════════════════════════════════════════════════════════════════

const SECRET_PREFIX = 'tmail_smtp_';

function hashSecret(secret) {
  return crypto.createHash('sha256').update(secret).digest('hex');
}

export async function createSmtpCredential({ workspaceId, address, label }) {
  const normalized = normalizeAddress(address);

  // The address must belong to this workspace — bind the credential to the same
  // mailbox so authenticated mail lands the SENT copy in the right place.
  const { data: owned, error: ownedError } = await supabase
    .from('workspace_addresses')
    .select('id, mailbox_id, workspace_id, address')
    .eq('address', normalized)
    .maybeSingle();
  if (ownedError) throw ownedError;
  if (!owned || owned.workspace_id !== workspaceId) {
    throw Object.assign(new Error('That address is not owned by this workspace'), { status: 400 });
  }

  const secret = `${SECRET_PREFIX}${crypto.randomBytes(24).toString('base64url')}`;
  const { data, error } = await supabase.from('smtp_credentials').insert({
    workspace_id: workspaceId,
    address_id: owned.id,
    mailbox_id: owned.mailbox_id,
    address: normalized,
    label: label || 'SMTP credential',
    secret_hash: hashSecret(secret),
    secret_prefix: secret.slice(0, 16),
  }).select('id, address, label, secret_prefix, last_used_at, revoked_at, created_at').single();
  if (error) {
    if (error.code === '42P01') {
      throw Object.assign(new Error('SMTP credential storage is not initialized. Apply server/db/schema.sql.'), { status: 503 });
    }
    throw error;
  }
  // secret is returned ONCE here and never stored in plaintext.
  return { ...data, secret, username: normalized };
}

export async function listSmtpCredentials(workspaceId) {
  const { data, error } = await supabase.from('smtp_credentials')
    .select('id, address, label, secret_prefix, last_used_at, revoked_at, created_at')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function revokeSmtpCredential({ workspaceId, credentialId }) {
  const { data, error } = await supabase.from('smtp_credentials')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', credentialId)
    .eq('workspace_id', workspaceId)
    .is('revoked_at', null)
    .select('id')
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

/**
 * Authenticate an SMTP submission login. Returns the bound identity on success,
 * or null on any failure (unknown address, bad secret, revoked). Comparison is
 * constant-time to avoid leaking which half was wrong.
 */
export async function authenticateSmtpCredential(username, secret) {
  if (!username || !secret) return null;
  const address = normalizeAddress(username);
  const { data, error } = await supabase.from('smtp_credentials')
    .select('id, workspace_id, mailbox_id, address, secret_hash')
    .eq('address', address)
    .is('revoked_at', null)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const provided = Buffer.from(hashSecret(secret), 'hex');
  const stored = Buffer.from(data.secret_hash, 'hex');
  if (provided.length !== stored.length || !crypto.timingSafeEqual(provided, stored)) return null;

  await supabase.from('smtp_credentials')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', data.id);

  return { credentialId: data.id, workspaceId: data.workspace_id, mailboxId: data.mailbox_id, address: data.address };
}
