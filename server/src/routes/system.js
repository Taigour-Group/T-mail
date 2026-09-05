import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { asyncH, requireService } from '../middleware.js';
import { deliverMessage } from '../lib/deliver.js';
import { renderTemplate, TEMPLATE_NAMES } from '../lib/templates.js';
import { env } from '../env.js';

export const systemRouter = Router();

// Transactional endpoint is machine-facing and abuse-sensitive: rate limit hard.
systemRouter.use(rateLimit({ windowMs: 60_000, max: 120, standardHeaders: true, legacyHeaders: false }));
systemRouter.use(requireService);

const toField = z.union([z.string().email(), z.array(z.string().email()).min(1)]);

// POST /api/system/send
// Two modes:
//   templated: { to, template: "verify_login", vars: { app, code } }
//   raw:       { to, subject, text, html? }
systemRouter.post('/send', asyncH(async (req, res) => {
  const body = z.object({
    to: toField,
    template: z.enum(TEMPLATE_NAMES).optional(),
    vars: z.record(z.any()).optional(),
    subject: z.string().max(998).optional(),
    text: z.string().optional(),
    html: z.string().optional(),
    from: z.string().email().optional(),
  }).parse(req.body);

  const to = Array.isArray(body.to) ? body.to : [body.to];

  let from;
  let subject;
  let text;
  let html;

  if (body.template) {
    const rendered = renderTemplate(body.template, body.vars || {});
    ({ from, subject, text, html } = rendered);
  } else {
    if (!body.subject || !body.text) {
      return res.status(400).json({ error: 'Raw sends require both "subject" and "text" (or use a "template")' });
    }
    subject = body.subject;
    text = body.text;
    html = body.html ?? null;
    // Raw sender is restricted to the reserved system identities.
    const allowed = [env.systemSenders.noReply, env.systemSenders.security];
    from = allowed.includes((body.from || '').toLowerCase()) ? body.from.toLowerCase() : env.systemSenders.noReply;
  }

  const result = await deliverMessage({
    senderMailboxId: null, // system sender has no mailbox → no SENT copy
    fromAddress: from,
    to,
    subject,
    bodyText: text,
    bodyHtml: html,
  });

  res.status(201).json({
    ok: true,
    messageId: result.messageId,
    delivered: result.delivered,
    undeliverable: result.undeliverable,
  });
}));
