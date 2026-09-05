import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { asyncH, requireService } from '../middleware.js';
import { deliverMessage } from '../lib/deliver.js';
import { renderTemplate, TEMPLATE_NAMES } from '../lib/templates.js';
import { getWorkspaceTemplate, renderWorkspaceTemplate } from '../lib/workspaceTemplates.js';
import { findWorkspaceAddress } from '../lib/workspaceAddresses.js';
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
    template: z.string().trim().max(64).optional(),
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
    const custom = req.serviceAuth.workspaceId ? await getWorkspaceTemplate(req.serviceAuth.workspaceId, body.template) : null;
    if (!custom && !TEMPLATE_NAMES.includes(body.template)) {
      return res.status(400).json({ error: `Unknown template: ${body.template}` });
    }
    const rendered = custom ? renderWorkspaceTemplate(custom, body.vars || {}) : renderTemplate(body.template, body.vars || {});
    ({ from, subject, text, html } = rendered);
  } else {
    if (!body.subject || !body.text) {
      return res.status(400).json({ error: 'Raw sends require both "subject" and "text" (or use a "template")' });
    }
    subject = body.subject;
    text = body.text;
    html = body.html ?? null;
    const requestedFrom = (body.from || '').toLowerCase();
    if (req.serviceAuth.workspaceId && requestedFrom) {
      const workspaceAddress = await findWorkspaceAddress(requestedFrom);
      if (!workspaceAddress || workspaceAddress.workspace_id !== req.serviceAuth.workspaceId) {
        return res.status(403).json({ error: 'The sender address is not owned by this workspace' });
      }
      from = workspaceAddress.address;
    } else {
      const allowed = [env.systemSenders.noReply, env.systemSenders.security];
      from = allowed.includes(requestedFrom) ? requestedFrom : env.systemSenders.noReply;
    }
  }

  const senderAlias = req.serviceAuth.workspaceId ? await findWorkspaceAddress(from) : null;
  if (req.serviceAuth.workspaceId && (!senderAlias || senderAlias.workspace_id !== req.serviceAuth.workspaceId)) {
    return res.status(403).json({ error: 'The sender address is not owned by this workspace' });
  }

  const result = await deliverMessage({
    senderMailboxId: senderAlias?.mailbox_id || null,
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
