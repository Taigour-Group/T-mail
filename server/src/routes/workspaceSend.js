import { Router } from 'express';
import { z } from 'zod';
import { asyncH, requireUser } from '../middleware.js';
import { getWorkspaceForMailbox } from '../lib/businessAccounts.js';
import { findWorkspaceAddress } from '../lib/workspaceAddresses.js';
import { getWorkspaceTemplate, renderWorkspaceTemplate } from '../lib/workspaceTemplates.js';
import { deliverMessage } from '../lib/deliver.js';
import { isInternal } from '../lib/addresses.js';

export const workspaceSendRouter = Router();
workspaceSendRouter.use(requireUser);

const recipients = z.union([z.string().email(), z.array(z.string().email()).min(1)]);

workspaceSendRouter.post('/', asyncH(async (req, res) => {
  const workspace = await getWorkspaceForMailbox(req.user.mailboxId);
  if (!workspace || workspace.verification_status !== 'verified') {
    return res.status(403).json({ error: 'TGO team verification is required before sending workspace email', code: 'WORKSPACE_VERIFICATION_REQUIRED' });
  }

  const body = z.object({
    to: recipients,
    template: z.string().trim().max(64).optional(),
    vars: z.record(z.any()).optional(),
    from: z.string().email().optional(),
    subject: z.string().trim().max(998).optional(),
    text: z.string().max(100000).optional(),
    html: z.string().max(200000).optional(),
  }).parse(req.body);

  let rendered;
  if (body.template) {
    const template = await getWorkspaceTemplate(workspace.id, body.template);
    if (!template) return res.status(404).json({ error: 'Workspace template not found' });
    rendered = renderWorkspaceTemplate(template, body.vars || {});
  } else {
    if (!body.from || !body.subject || !body.text) {
      return res.status(400).json({ error: 'Custom email requires from, subject, and text' });
    }
    rendered = { from: body.from, subject: body.subject, text: body.text, html: body.html || null };
  }

  const sender = await findWorkspaceAddress(rendered.from);
  if (!sender || sender.workspace_id !== workspace.id) {
    return res.status(403).json({ error: 'The sender address is not owned by this workspace' });
  }

  const recipientList = Array.isArray(body.to) ? body.to : [body.to];
  const externalRecipients = recipientList.filter((address) => !isInternal(address));
  if (externalRecipients.length > 0) {
    return res.status(503).json({
      error: 'External customer delivery is not configured yet. T-mail currently delivers only to @tgo.com addresses.',
      code: 'EXTERNAL_DELIVERY_NOT_CONFIGURED',
      recipients: externalRecipients,
    });
  }

  const result = await deliverMessage({
    senderMailboxId: sender.mailbox_id,
    fromAddress: sender.address,
    to: recipientList,
    subject: rendered.subject,
    bodyText: rendered.text,
    bodyHtml: rendered.html,
  });

  res.status(201).json({ ok: true, ...result });
}));