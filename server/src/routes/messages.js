import crypto from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { supabase } from '../supabase.js';
import { asyncH, requireUser } from '../middleware.js';
import { deliverMessage } from '../lib/deliver.js';
import { normalizeSubject } from '../lib/addresses.js';

export const messagesRouter = Router();
messagesRouter.use(requireUser);

const addressList = z.array(z.string().email()).default([]);
const attachmentMeta = z.object({
  storagePath: z.string().min(1),
  filename: z.string().min(1),
  mimeType: z.string().default('application/octet-stream'),
  size: z.coerce.number().nonnegative().default(0),
});

// POST /api/messages → send
messagesRouter.post('/', asyncH(async (req, res) => {
  const body = z.object({
    to: addressList,
    cc: addressList,
    bcc: addressList,
    subject: z.string().max(998).default(''),
    bodyText: z.string().default(''),
    bodyHtml: z.string().optional(),
    inReplyTo: z.string().optional(),
    attachments: z.array(attachmentMeta).default([]),
  }).parse(req.body);

  if (body.to.length + body.cc.length + body.bcc.length === 0) {
    return res.status(400).json({ error: 'At least one recipient is required' });
  }

  const result = await deliverMessage({
    senderMailboxId: req.user.mailboxId,
    fromAddress: req.user.address,
    to: body.to,
    cc: body.cc,
    bcc: body.bcc,
    subject: body.subject,
    bodyText: body.bodyText,
    bodyHtml: body.bodyHtml ?? null,
    inReplyTo: body.inReplyTo ?? null,
  });

  if (body.attachments.length) {
    const rows = body.attachments.map((a) => ({
      message_id: result.messageId,
      filename: a.filename,
      mime_type: a.mimeType,
      size_bytes: a.size,
      storage_path: a.storagePath,
    }));
    const { error } = await supabase.from('attachments').insert(rows);
    if (error) throw error;
  }

  res.status(201).json({ ok: true, ...result });
}));

// POST /api/drafts → save a draft (no delivery)
messagesRouter.post('/drafts', asyncH(async (req, res) => {
  const body = z.object({
    to: addressList,
    cc: addressList,
    bcc: addressList,
    subject: z.string().max(998).default(''),
    bodyText: z.string().default(''),
    bodyHtml: z.string().optional(),
  }).parse(req.body);

  const { data: thread, error: tErr } = await supabase
    .from('threads').insert({ subject_normalized: normalizeSubject(body.subject) }).select('id').single();
  if (tErr) throw tErr;

  const { data: message, error: mErr } = await supabase
    .from('messages').insert({
      thread_id: thread.id,
      from_address: req.user.address,
      subject: body.subject,
      body_text: body.bodyText,
      body_html: body.bodyHtml ?? null,
      rfc_message_id: `<draft-${crypto.randomUUID()}@local>`,
    }).select('id').single();
  if (mErr) throw mErr;

  const recips = [
    ...body.to.map((a) => ({ message_id: message.id, address: a, kind: 'to' })),
    ...body.cc.map((a) => ({ message_id: message.id, address: a, kind: 'cc' })),
    ...body.bcc.map((a) => ({ message_id: message.id, address: a, kind: 'bcc' })),
  ];
  if (recips.length) await supabase.from('recipients').insert(recips);

  const { data: view, error: vErr } = await supabase
    .from('mailbox_messages').insert({
      mailbox_id: req.user.mailboxId, message_id: message.id,
      system_folder: 'DRAFT', is_draft: true, is_read: true,
    }).select('id').single();
  if (vErr) throw vErr;

  res.status(201).json({ ok: true, mailboxMessageId: view.id, messageId: message.id, threadId: thread.id });
}));

// PATCH /api/messages/:mailboxMessageId → flags / move folder
messagesRouter.patch('/:id', asyncH(async (req, res) => {
  const id = z.string().uuid().parse(req.params.id);
  const patch = z.object({
    isRead: z.boolean().optional(),
    isStarred: z.boolean().optional(),
    folder: z.enum(['INBOX', 'SENT', 'DRAFT', 'TRASH', 'SPAM']).optional(),
  }).parse(req.body);

  const update = {};
  if (patch.isRead !== undefined) update.is_read = patch.isRead;
  if (patch.isStarred !== undefined) update.is_starred = patch.isStarred;
  if (patch.folder !== undefined) update.system_folder = patch.folder;
  if (Object.keys(update).length === 0) return res.status(400).json({ error: 'Nothing to update' });

  const { data, error } = await supabase
    .from('mailbox_messages').update(update)
    .eq('id', id).eq('mailbox_id', req.user.mailboxId)
    .select('id, is_read, is_starred, system_folder').maybeSingle();
  if (error) throw error;
  if (!data) return res.status(404).json({ error: 'Message not found' });

  res.json({ ok: true, message: data });
}));

// DELETE /api/messages/:mailboxMessageId → move to TRASH (soft delete)
messagesRouter.delete('/:id', asyncH(async (req, res) => {
  const id = z.string().uuid().parse(req.params.id);
  const { data, error } = await supabase
    .from('mailbox_messages').update({ system_folder: 'TRASH' })
    .eq('id', id).eq('mailbox_id', req.user.mailboxId)
    .select('id').maybeSingle();
  if (error) throw error;
  if (!data) return res.status(404).json({ error: 'Message not found' });
  res.json({ ok: true });
}));
