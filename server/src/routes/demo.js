import crypto from 'node:crypto';
import rateLimit from 'express-rate-limit';
import { Router } from 'express';
import { asyncH, requireUser } from '../middleware.js';
import { deliverMessage } from '../lib/deliver.js';
import { renderTemplate } from '../lib/templates.js';
import { env } from '../env.js';

export const demoRouter = Router();
demoRouter.use(requireUser);
demoRouter.use(rateLimit({ windowMs: 5 * 60_000, max: 3, standardHeaders: true, legacyHeaders: false }));

// POST /api/demo/otp -> send a test code only to the signed-in user's mailbox.
demoRouter.post('/otp', asyncH(async (req, res) => {
  const code = String(crypto.randomInt(100000, 1000000));
  const rendered = renderTemplate('verify_login', { app: 'T-mail demo', code });

  await deliverMessage({
    senderMailboxId: null,
    fromAddress: env.systemSenders.noReply,
    to: [req.user.address],
    subject: rendered.subject,
    bodyText: rendered.text,
    bodyHtml: rendered.html,
  });

  res.status(201).json({ ok: true });
}));
