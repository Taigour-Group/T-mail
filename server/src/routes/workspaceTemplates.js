import { Router } from 'express';
import { z } from 'zod';
import { asyncH, requireUser } from '../middleware.js';
import { getWorkspaceForMailbox } from '../lib/businessAccounts.js';
import { createWorkspaceTemplate, deleteWorkspaceTemplate, listWorkspaceTemplates } from '../lib/workspaceTemplates.js';
import { supabase } from '../supabase.js';

export const workspaceTemplatesRouter = Router();
workspaceTemplatesRouter.use(requireUser);

async function verifiedWorkspace(req, res) {
  const workspace = await getWorkspaceForMailbox(req.user.mailboxId);
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
  }).parse(req.body);
  if (!(await senderBelongsToWorkspace(workspace.id, input.senderAddress.toLowerCase()))) {
    return res.status(400).json({ error: 'Choose a custom address owned by this workspace' });
  }
  res.status(201).json({ template: await createWorkspaceTemplate({ workspaceId: workspace.id, ...input }) });
}));

workspaceTemplatesRouter.delete('/:id', asyncH(async (req, res) => {
  const workspace = await verifiedWorkspace(req, res);
  if (!workspace) return;
  const deleted = await deleteWorkspaceTemplate({ workspaceId: workspace.id, templateId: z.string().uuid().parse(req.params.id) });
  if (!deleted) return res.status(404).json({ error: 'Template not found' });
  res.json({ ok: true });
}));