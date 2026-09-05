import crypto from 'node:crypto';
import { supabase } from '../supabase.js';

const TOKEN_PREFIX = 'tmail_sk_';

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function createServiceToken({ mailboxId, name }) {
  const token = `${TOKEN_PREFIX}${crypto.randomBytes(32).toString('hex')}`;
  const { data, error } = await supabase.from('service_tokens').insert({
    mailbox_id: mailboxId,
    name,
    token_prefix: token.slice(0, 18),
    token_hash: hashToken(token),
  }).select('id, name, token_prefix, created_at').single();
  if (error) throw error;
  return { ...data, token };
}

export async function listServiceTokens(mailboxId) {
  const { data, error } = await supabase.from('service_tokens')
    .select('id, name, token_prefix, last_used_at, revoked_at, created_at')
    .eq('mailbox_id', mailboxId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function revokeServiceToken({ mailboxId, tokenId }) {
  const { data, error } = await supabase.from('service_tokens')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', tokenId)
    .eq('mailbox_id', mailboxId)
    .is('revoked_at', null)
    .select('id')
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export async function findActiveServiceToken(token) {
  if (!token.startsWith(TOKEN_PREFIX)) return null;
  const { data, error } = await supabase.from('service_tokens')
    .select('id, mailbox_id')
    .eq('token_hash', hashToken(token))
    .is('revoked_at', null)
    .maybeSingle();
  if (error) throw error;
  if (data) {
    await supabase.from('service_tokens')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', data.id);
  }
  return data;
}