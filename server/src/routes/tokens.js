import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { asyncH, requireUser } from '../middleware.js';
import { createServiceToken, listServiceTokens, revokeServiceToken } from '../lib/serviceTokens.js';
import { getWorkspaceForMailbox } from '../lib/businessAccounts.js';

export const tokensRouter = Router();
tokensRouter.use(requireUser);
const tokenCreateLimiter = rateLimit({ windowMs: 60 * 60_000, max: 10, standardHeaders: true, legacyHeaders: false });

tokensRouter.get('/', asyncH(async (req, res) => {
  const workspace = await getWorkspaceForMailbox(req.user.mailboxId);
  res.json({ tokens: workspace ? await listServiceTokens(workspace.id) : [] });
}));

tokensRouter.post('/', tokenCreateLimiter, asyncH(async (req, res) => {
  const workspace = await getWorkspaceForMailbox(req.user.mailboxId);
  if (workspace?.verification_status !== 'verified') {
    return res.status(403).json({ error: 'TGO team verification is required before creating a service token', code: 'BUSINESS_VERIFICATION_REQUIRED' });
  }
  const { name, expiresInDays } = z.object({
    name: z.string().trim().min(1).max(80).default('Application token'),
    expiresInDays: z.union([z.literal(30), z.literal(90), z.literal(365), z.null()]).default(90),
  }).parse(req.body);
  res.status(201).json(await createServiceToken({ workspaceId: workspace.id, name, expiresInDays }));
}));

tokensRouter.delete('/:id', asyncH(async (req, res) => {
  const tokenId = z.string().uuid().parse(req.params.id);
  const workspace = await getWorkspaceForMailbox(req.user.mailboxId);
  const revoked = workspace && await revokeServiceToken({ workspaceId: workspace.id, tokenId });
  if (!revoked) return res.status(404).json({ error: 'Token not found or already revoked' });
  res.json({ ok: true });
}));