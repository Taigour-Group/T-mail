import { Router } from 'express';
import { z } from 'zod';
import { asyncH, requireUser } from '../middleware.js';
import { getWorkspaceForMailbox } from '../lib/businessAccounts.js';
import { createWorkspaceTemplate, deleteWorkspaceTemplate, listWorkspaceTemplates, listPublicTemplates, incrementForkCount } from '../lib/workspaceTemplates.js';
import { supabase } from '../supabase.js';

export const workspaceTemplatesRouter = Router();
workspaceTemplatesRouter.use(requireUser);

async function verifiedWorkspace(req, res) {
  let workspace;
  try {
    workspace = await getWorkspaceForMailbox(req.user.mailboxId);
  } catch (error) {
    if (error?.code === '42P01' || error?.code === '42703' || error?.message?.includes('workspace_members')) {
      return res.status(503).json({ error: 'Workspace storage is not initialized. Apply server/db/schema.sql in the production Supabase project.' });
    }
    throw error;
  }
  if (!workspace || workspace.verification_status !== 'verified') {
    res.status(403).json({ error: 'TGO team verification is required before managing templates', code: 'WORKSPACE_VERIFICATION_REQUIRED' });
    return null;
  }
  return workspace;
}

async function senderBelongsToWorkspace(workspaceId, senderAddress) {
  const { data, error } = await supabase.from('workspace_addresses').select('address')
    .eq('workspace_id', workspaceId).eq('address', senderAddress).maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

workspaceTemplatesRouter.get('/', asyncH(async (req, res) => {
  const workspace = await verifiedWorkspace(req, res);
  if (!workspace) return;
  res.json({ templates: await listWorkspaceTemplates(workspace.id) });
}));

// Community gallery — public templates any workspace chose to share. Available to
// every verified workspace; own templates are excluded (they already show under "Mine").
workspaceTemplatesRouter.get('/public', asyncH(async (req, res) => {
  const workspace = await verifiedWorkspace(req, res);
  if (!workspace) return;
  res.json({ templates: await listPublicTemplates({ excludeWorkspaceId: workspace.id }) });
}));

workspaceTemplatesRouter.post('/', asyncH(async (req, res) => {
  const workspace = await verifiedWorkspace(req, res);
  if (!workspace) return;
  const input = z.object({
    name: z.string().trim().min(2).max(80),
    slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(64),
    senderAddress: z.string().email(),
    subject: z.string().trim().min(1).max(998),
    textBody: z.string().min(1).max(100000),
    htmlBody: z.string().max(200000).optional().or(z.literal('')),
    category: z.string().trim().max(40).optional(),
    visibility: z.enum(['private', 'public']).optional(),
    forkedFrom: z.string().uuid().optional(),
  }).parse(req.body);
  if (!(await senderBelongsToWorkspace(workspace.id, input.senderAddress.toLowerCase()))) {
    return res.status(400).json({ error: 'Choose a custom address owned by this workspace' });
  }
  const template = await createWorkspaceTemplate({
    workspaceId: workspace.id,
    name: input.name,
    slug: input.slug,
    senderAddress: input.senderAddress,
    subject: input.subject,
    textBody: input.textBody,
    htmlBody: input.htmlBody,
    category: input.category,
    visibility: input.visibility,
    publishedBy: req.user.address,
  });
  // If this was cloned from a shared template, credit the original.
  if (input.forkedFrom) await incrementForkCount(input.forkedFrom);
  res.status(201).json({ template });
}));

workspaceTemplatesRouter.delete('/:id', asyncH(async (req, res) => {
  const workspace = await verifiedWorkspace(req, res);
  if (!workspace) return;
  const deleted = await deleteWorkspaceTemplate({ workspaceId: workspace.id, templateId: z.string().uuid().parse(req.params.id) });
  if (!deleted) return res.status(404).json({ error: 'Template not found' });
  res.json({ ok: true });
}));