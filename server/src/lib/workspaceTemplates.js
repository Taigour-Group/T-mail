import { supabase } from '../supabase.js';
import { normalizeAddress } from './addresses.js';

function throwStorageError(error) {
  if (error?.code === '42P01' || error?.code === '42703' || error?.message?.includes('workspace_templates')) {
    const setupError = new Error('Workspace-template storage is not initialized. Apply server/db/schema.sql in the production Supabase project.');
    setupError.status = 503;
    setupError.publicMessage = setupError.message;
    throw setupError;
  }
  throw error;
}

function replaceVariables(value, vars, escape) {
  return String(value || '').replace(/{{\s*([a-zA-Z0-9_.-]+)\s*}}/g, (_, key) => escape(vars[key] ?? ''));
}

const TEMPLATE_COLUMNS = 'id, workspace_id, name, slug, sender_address, subject, text_body, html_body, category, visibility, published_by, fork_count, created_at, updated_at';

function shape(row) {
  return row && {
    id: row.id,
    workspace_id: row.workspace_id,
    name: row.name,
    slug: row.slug,
    sender_address: row.sender_address,
    subject: row.subject,
    text_body: row.text_body,
    html_body: row.html_body,
    category: row.category || 'custom',
    visibility: row.visibility || 'private',
    published_by: row.published_by || null,
    fork_count: row.fork_count || 0,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function listWorkspaceTemplates(workspaceId) {
  const { data, error } = await supabase.from('workspace_templates')
    .select(TEMPLATE_COLUMNS)
    .eq('workspace_id', workspaceId).order('created_at', { ascending: false });
  if (error) throwStorageError(error);
  return data.map(shape);
}

// Public community gallery: templates any workspace chose to share, newest first.
export async function listPublicTemplates({ limit = 200, excludeWorkspaceId } = {}) {
  let query = supabase.from('workspace_templates')
    .select(TEMPLATE_COLUMNS)
    .eq('visibility', 'public').order('created_at', { ascending: false }).limit(limit);
  if (excludeWorkspaceId) query = query.neq('workspace_id', excludeWorkspaceId);
  const { data, error } = await query;
  if (error) throwStorageError(error);
  return data.map(shape);
}

export async function createWorkspaceTemplate({ workspaceId, name, slug, senderAddress, subject, textBody, htmlBody, category, visibility, publishedBy }) {
  const { data, error } = await supabase.from('workspace_templates').insert({
    workspace_id: workspaceId, name, slug, sender_address: normalizeAddress(senderAddress),
    subject, text_body: textBody, html_body: htmlBody || null,
    category: category || 'custom',
    visibility: visibility === 'public' ? 'public' : 'private',
    published_by: visibility === 'public' ? (publishedBy || null) : null,
  }).select(TEMPLATE_COLUMNS).single();
  if (error) {
    if (error.code === '23505') {
      const duplicate = new Error('A template with that name already exists');
      duplicate.status = 409;
      throw duplicate;
    }
    throwStorageError(error);
  }
  return shape(data);
}

export async function deleteWorkspaceTemplate({ workspaceId, templateId }) {
  const { data, error } = await supabase.from('workspace_templates').delete()
    .eq('id', templateId).eq('workspace_id', workspaceId).select('id').maybeSingle();
  if (error) throwStorageError(error);
  return Boolean(data);
}

// Bump the reuse counter when someone clones a public template. Best-effort: a
// failed count must never block the clone, so errors are swallowed.
export async function incrementForkCount(templateId) {
  try {
    const { data } = await supabase.from('workspace_templates')
      .select('fork_count').eq('id', templateId).eq('visibility', 'public').maybeSingle();
    if (!data) return;
    await supabase.from('workspace_templates')
      .update({ fork_count: (data.fork_count || 0) + 1 }).eq('id', templateId);
  } catch {
    /* non-critical */
  }
}

export async function getWorkspaceTemplate(workspaceId, slug) {
  const { data, error } = await supabase.from('workspace_templates')
    .select('id, name, slug, sender_address, subject, text_body, html_body')
    .eq('workspace_id', workspaceId).eq('slug', slug).maybeSingle();
  if (error) throwStorageError(error);
  return data;
}

export function renderWorkspaceTemplate(template, vars = {}) {
  const escapeHtml = (value) => String(value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  return {
    from: template.sender_address,
    subject: replaceVariables(template.subject, vars, (value) => String(value)),
    text: replaceVariables(template.text_body, vars, (value) => String(value)),
    html: template.html_body ? replaceVariables(template.html_body, vars, escapeHtml) : null,
  };
}