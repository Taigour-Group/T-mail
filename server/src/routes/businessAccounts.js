import { Router } from 'express';
import { z } from 'zod';
import { asyncH, requireUser } from '../middleware.js';
import { getWorkspaceForMailbox, requestWorkspace } from '../lib/businessAccounts.js';

export const businessAccountsRouter = Router();
businessAccountsRouter.use(requireUser);

businessAccountsRouter.get('/', asyncH(async (req, res) => {
  res.json({ workspace: await getWorkspaceForMailbox(req.user.mailboxId) });
}));

businessAccountsRouter.post('/', asyncH(async (req, res) => {
  const input = z.object({
    workspaceName: z.string().trim().min(2).max(120),
    website: z.string().trim().url().max(200).optional().or(z.literal('')),
  }).parse(req.body);

  const existing = await getWorkspaceForMailbox(req.user.mailboxId);
  if (existing) {
    return res.json({ workspace: existing });
  }

  res.status(201).json({
    workspace: await requestWorkspace({ mailboxId: req.user.mailboxId, ...input }),
  });
}));