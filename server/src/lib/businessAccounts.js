import { supabase } from '../supabase.js';

export async function getWorkspaceForMailbox(mailboxId) {
  const { data, error } = await supabase
    .from('workspace_members')
    .select('role, workspace:workspaces(id, name, slug, website, verification_status, requested_at, verified_at)')
    .eq('mailbox_id', mailboxId)
    .maybeSingle();
  if (error) throw error;
  return data ? { ...data.workspace, role: data.role } : null;
}

export async function requestWorkspace({ mailboxId, workspaceName, website }) {
  const slug = `${workspaceName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'workspace'}-${mailboxId.slice(0, 8)}`;
  const { data: workspace, error: workspaceError } = await supabase
    .from('workspaces')
    .insert({ name: workspaceName, slug, website: website || null, verification_status: 'pending' })
    .select('id, name, slug, website, verification_status, requested_at, verified_at')
    .single();
  if (workspaceError) throw workspaceError;

  const { error: memberError } = await supabase.from('workspace_members').insert({
    workspace_id: workspace.id,
    mailbox_id: mailboxId,
    role: 'owner',
  });
  if (memberError) throw memberError;
  return { ...workspace, role: 'owner' };
}