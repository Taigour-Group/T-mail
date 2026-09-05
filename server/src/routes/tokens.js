import { Router } from 'express';
import { z } from 'zod';
import { asyncH, requireUser } from '../middleware.js';
import { createServiceToken, listServiceTokens, revokeServiceToken } from '../lib/serviceTokens.js';

export const tokensRouter = Router();
tokensRouter.use(requireUser);

tokensRouter.get('/', asyncH(async (req, res) => {
  res.json({ tokens: await listServiceTokens(req.user.mailboxId) });
}));

tokensRouter.post('/', asyncH(async (req, res) => {
  const { name } = z.object({
    name: z.string().trim().min(1).max(80).default('Application token'),
  }).parse(req.body);
  res.status(201).json(await createServiceToken({ mailboxId: req.user.mailboxId, name }));
}));

tokensRouter.delete('/:id', asyncH(async (req, res) => {
  const tokenId = z.string().uuid().parse(req.params.id);
  const revoked = await revokeServiceToken({ mailboxId: req.user.mailboxId, tokenId });
  if (!revoked) return res.status(404).json({ error: 'Token not found or already revoked' });
  res.json({ ok: true });
}));