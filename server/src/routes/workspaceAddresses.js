import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { asyncH, requireUser } from '../middleware.js';
import { getWorkspaceForMailbox } from '../lib/businessAccounts.js';
import { createWorkspaceAddress, deleteWorkspaceAddress, listWorkspaceAddresses } from '../lib/workspaceAddresses.js';
import { env } from '../env.js';

export const workspaceAddressesRouter = Router();
workspaceAddressesRouter.use(requireUser);
const addressLimiter = rateLimit({ windowMs: 60 * 60_000, max: 20, standardHeaders: true, legacyHeaders: false });

async function verifiedWorkspace(req, res) {
  const workspace = await getWorkspaceForMailbox(req.user.mailboxId);
  if (!workspace) return res.status(403).json({ error: 'Create a TGO Workspace before managing custom addresses' });
  if (workspace.verification_status !== 'verified') {
    return res.status(403).json({ error: 'TGO team verification is required before managing custom addresses', code: 'WORKSPACE_VERIFICATION_REQUIRED' });
  }
  return workspace;
}

workspaceAddressesRouter.get('/', asyncH(async (req, res) => {
  const workspace = await verifiedWorkspace(req, res);
  if (!workspace) return;
  res.json({ addresses: await listWorkspaceAddresses(workspace.id), domain: env.emailDomain });
}));

workspaceAddressesRouter.post('/', addressLimiter, asyncH(async (req, res) => {
  const workspace = await verifiedWorkspace(req, res);
  if (!workspace) return;
  const { localPart, label } = z.object({
    localPart: z.string().trim().toLowerCase().regex(/^[a-z0-9](?:[a-z0-9._-]{0,62}[a-z0-9])?$/),
    label: z.string().trim().min(1).max(80),
  }).parse(req.body);
  res.status(201).json({ address: await createWorkspaceAddress({
    workspaceId: workspace.id, mailboxId: req.user.mailboxId,
    address: `${localPart}@${env.emailDomain}`, label,
  }) });
}));

workspaceAddressesRouter.delete('/:id', asyncH(async (req, res) => {
  const workspace = await verifiedWorkspace(req, res);
  if (!workspace) return;
  const deleted = await deleteWorkspaceAddress({ workspaceId: workspace.id, addressId: z.string().uuid().parse(req.params.id) });
  if (!deleted) return res.status(404).json({ error: 'Custom address not found' });
  res.json({ ok: true });
}));