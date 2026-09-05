import { supabase } from '../supabase.js';
import { normalizeAddress } from './addresses.js';

export async function listWorkspaceAddresses(workspaceId) {
  const { data, error } = await supabase.from('workspace_addresses')
    .select('id, address, label, mailbox_id, created_at')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function createWorkspaceAddress({ workspaceId, mailboxId, address, label }) {
  const normalized = normalizeAddress(address);
  const { data: mailbox, error: mailboxError } = await supabase.from('mailboxes')
    .select('id').eq('address', normalized).maybeSingle();
  if (mailboxError) throw mailboxError;
  if (mailbox) {
    const conflict = new Error('That email address is already in use');
    conflict.status = 409;
    throw conflict;
  }
  const { data, error } = await supabase.from('workspace_addresses').insert({
    workspace_id: workspaceId, mailbox_id: mailboxId, address: normalized, label,
  }).select('id, address, label, mailbox_id, created_at').single();
  if (error) {
    if (error.code === '23505') {
      const duplicate = new Error('That workspace email address is already in use');
      duplicate.status = 409;
      throw duplicate;
    }
    throw error;
  }
  return data;
}

export async function deleteWorkspaceAddress({ workspaceId, addressId }) {
  const { data, error } = await supabase.from('workspace_addresses').delete()
    .eq('id', addressId).eq('workspace_id', workspaceId).select('id').maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export async function findWorkspaceAddress(address) {
  const { data, error } = await supabase.from('workspace_addresses')
    .select('workspace_id, mailbox_id, address').eq('address', normalizeAddress(address)).maybeSingle();
  if (error) throw error;
  return data;
}