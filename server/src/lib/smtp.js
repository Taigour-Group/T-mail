import crypto from 'node:crypto';
import { supabase } from '../supabase.js';
import { env } from '../env.js';

// ════════════════════════════════════════════════════════════════════════════
// smtp.js — per-workspace SMTP relay config + AES-256-GCM secret handling.
//
// Passwords are encrypted at rest. The raw password NEVER leaves this module:
// it's decrypted only to build a transport at send/test time, and the API layer
// only ever returns the config with the password field stripped.
// ════════════════════════════════════════════════════════════════════════════

// Derive a stable 32-byte key from the configured secret (SMTP_SECRET, or a
// COOKIE_SECRET fallback). scrypt keeps a short/long secret usable as an AES key.
const KEY = crypto.scryptSync(env.smtpSecret, 'tmail-smtp-v1', 32);

export function encryptSecret(plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const ciphertext = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${tag.toString('base64')}:${ciphertext.toString('base64')}`;
}

export function decryptSecret(stored) {
  const [ivB64, tagB64, dataB64] = String(stored).split(':');
  if (!ivB64 || !tagB64 || !dataB64) throw new Error('Malformed encrypted secret');
  const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]).toString('utf8');
}

const COLUMNS = 'workspace_id, host, port, secure, username, from_name, from_address, enabled, last_tested_at, last_test_ok, last_test_error, created_at, updated_at';

// Public shape — never includes the password (encrypted or otherwise).
function shape(row) {
  if (!row) return null;
  return {
    workspaceId: row.workspace_id,
    host: row.host,
    port: row.port,
    secure: row.secure,
    username: row.username,
    fromName: row.from_name || '',
    fromAddress: row.from_address || '',
    enabled: row.enabled,
    lastTestedAt: row.last_tested_at,
    lastTestOk: row.last_test_ok,
    lastTestError: row.last_test_error,
    hasPassword: true,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Config without the password, for the API (GET).
export async function getWorkspaceSmtp(workspaceId) {
  const { data, error } = await supabase
    .from('workspace_smtp').select(COLUMNS).eq('workspace_id', workspaceId).maybeSingle();
  if (error) throw error;
  return shape(data);
}

// Full row INCLUDING the decrypted password — internal use only (send/test).
export async function getWorkspaceSmtpSecret(workspaceId) {
  const { data, error } = await supabase
    .from('workspace_smtp').select('*').eq('workspace_id', workspaceId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    host: data.host,
    port: data.port,
    secure: data.secure,
    username: data.username,
    password: decryptSecret(data.password_enc),
    fromName: data.from_name || '',
    fromAddress: data.from_address || '',
    enabled: data.enabled,
  };
}

// Create or update. `password` is optional on update — omit to keep the existing one.
export async function upsertWorkspaceSmtp(workspaceId, input) {
  const existing = await supabase
    .from('workspace_smtp').select('workspace_id, password_enc').eq('workspace_id', workspaceId).maybeSingle();
  if (existing.error) throw existing.error;

  let passwordEnc = existing.data?.password_enc;
  if (input.password) passwordEnc = encryptSecret(input.password);
  if (!passwordEnc) throw Object.assign(new Error('A password is required'), { status: 400 });

  const row = {
    workspace_id: workspaceId,
    host: input.host,
    port: input.port,
    secure: input.secure,
    username: input.username,
    password_enc: passwordEnc,
    from_name: input.fromName || null,
    from_address: input.fromAddress ? input.fromAddress.toLowerCase() : null,
    enabled: input.enabled ?? false,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('workspace_smtp').upsert(row, { onConflict: 'workspace_id' }).select(COLUMNS).single();
  if (error) throw error;
  return shape(data);
}

export async function deleteWorkspaceSmtp(workspaceId) {
  const { error } = await supabase.from('workspace_smtp').delete().eq('workspace_id', workspaceId);
  if (error) throw error;
}

export async function recordTestResult(workspaceId, ok, errorMessage) {
  await supabase.from('workspace_smtp').update({
    last_tested_at: new Date().toISOString(),
    last_test_ok: ok,
    last_test_error: ok ? null : (errorMessage || 'Unknown error').slice(0, 500),
  }).eq('workspace_id', workspaceId);
}
