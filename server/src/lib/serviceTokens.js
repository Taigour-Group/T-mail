import crypto from 'node:crypto';
import { supabase } from '../supabase.js';

const TOKEN_PREFIX = 'tmail_sk_';

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function createServiceToken({ workspaceId, name, expiresInDays }) {
  const token = `${TOKEN_PREFIX}${crypto.randomBytes(32).toString('hex')}`;
  const expiresAt = expiresInDays
    ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
    : null;
  const { data, error } = await supabase.from('service_tokens').insert({
    workspace_id: workspaceId,
    name,
    token_prefix: token.slice(0, 18),
    token_hash: hashToken(token),
    scopes: ['send:email'],
    expires_at: expiresAt,
  }).select('id, name, token_prefix, scopes, expires_at, created_at').single();
  if (error) {
    if (error.code === '42P01' || error.code === '42703' || error.message?.includes('service_tokens')) {
      const setupError = new Error('Service-token storage is not initialized. Apply server/db/schema.sql in the production Supabase project.');
      setupError.status = 503;
      setupError.publicMessage = setupError.message;
      throw setupError;
    }
    const tokenError = new Error('Token creation failed. Check the production Supabase schema and Render server logs.');
    tokenError.status = 503;
    tokenError.publicMessage = tokenError.message;
    tokenError.cause = error;
    throw tokenError;
  }
  return { ...data, token };
}

export async function listServiceTokens(workspaceId) {
  const { data, error } = await supabase.from('service_tokens')
    .select('id, name, token_prefix, scopes, expires_at, last_used_at, revoked_at, created_at')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function revokeServiceToken({ workspaceId, tokenId }) {
  const { data, error } = await supabase.from('service_tokens')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', tokenId)
    .eq('workspace_id', workspaceId)
    .is('revoked_at', null)
    .select('id')
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export async function findActiveServiceToken(token) {
  if (!token.startsWith(TOKEN_PREFIX)) return null;
  const { data, error } = await supabase.from('service_tokens')
    .select('id, workspace_id, scopes, expires_at')
    .eq('token_hash', hashToken(token))
    .is('revoked_at', null)
    .maybeSingle();
  if (error) throw error;
  if (data && data.expires_at && new Date(data.expires_at).getTime() <= Date.now()) return null;
  if (data) {
    await supabase.from('service_tokens')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', data.id);
  }
  return data;
}