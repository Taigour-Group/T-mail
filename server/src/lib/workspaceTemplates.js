import { supabase } from '../supabase.js';
import { normalizeAddress } from './addresses.js';

function replaceVariables(value, vars, escape) {
  return String(value || '').replace(/{{\s*([a-zA-Z0-9_.-]+)\s*}}/g, (_, key) => escape(vars[key] ?? ''));
}

function shape(row) {
  return row && {
    id: row.id,
    name: row.name,
    slug: row.slug,
    sender_address: row.sender_address,
    subject: row.subject,
    text_body: row.text_body,
    html_body: row.html_body,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function listWorkspaceTemplates(workspaceId) {
  const { data, error } = await supabase.from('workspace_templates')
    .select('id, name, slug, sender_address, subject, text_body, html_body, created_at, updated_at')
    .eq('workspace_id', workspaceId).order('created_at', { ascending: false });
  if (error) throw error;
  return data.map(shape);
}

export async function createWorkspaceTemplate({ workspaceId, name, slug, senderAddress, subject, textBody, htmlBody }) {
  const { data, error } = await supabase.from('workspace_templates').insert({
    workspace_id: workspaceId, name, slug, sender_address: normalizeAddress(senderAddress),
    subject, text_body: textBody, html_body: htmlBody || null,
  }).select('id, name, slug, sender_address, subject, text_body, html_body, created_at, updated_at').single();
  if (error) {
    if (error.code === '23505') {
      const duplicate = new Error('A template with that name already exists');
      duplicate.status = 409;
      throw duplicate;
    }
    throw error;
  }
  return shape(data);
}

export async function deleteWorkspaceTemplate({ workspaceId, templateId }) {
  const { data, error } = await supabase.from('workspace_templates').delete()
    .eq('id', templateId).eq('workspace_id', workspaceId).select('id').maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export async function getWorkspaceTemplate(workspaceId, slug) {
  const { data, error } = await supabase.from('workspace_templates')
    .select('id, name, slug, sender_address, subject, text_body, html_body')
    .eq('workspace_id', workspaceId).eq('slug', slug).maybeSingle();
  if (error) throw error;
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