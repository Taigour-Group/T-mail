import { Router } from 'express';
import { z } from 'zod';
import { supabase } from '../supabase.js';
import { asyncH, requireUser } from '../middleware.js';

export const labelsRouter = Router();
labelsRouter.use(requireUser);

// GET /api/labels
labelsRouter.get('/', asyncH(async (req, res) => {
  const { data, error } = await supabase
    .from('labels').select('id, name, type, color, created_at')
    .eq('mailbox_id', req.user.mailboxId).order('name');
  if (error) throw error;
  res.json({ labels: data || [] });
}));

// POST /api/labels
labelsRouter.post('/', asyncH(async (req, res) => {
  const body = z.object({
    name: z.string().min(1).max(64),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#2563eb'),
  }).parse(req.body);

  const { data, error } = await supabase
    .from('labels').insert({ mailbox_id: req.user.mailboxId, name: body.name, color: body.color, type: 'user' })
    .select('id, name, type, color').single();
  if (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'A label with that name already exists' });
    throw error;
  }
  res.status(201).json({ label: data });
}));

// PATCH /api/labels/:id
labelsRouter.patch('/:id', asyncH(async (req, res) => {
  const id = z.string().uuid().parse(req.params.id);
  const patch = z.object({
    name: z.string().min(1).max(64).optional(),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  }).parse(req.body);
  if (Object.keys(patch).length === 0) return res.status(400).json({ error: 'Nothing to update' });

  const { data, error } = await supabase
    .from('labels').update(patch)
    .eq('id', id).eq('mailbox_id', req.user.mailboxId)
    .select('id, name, type, color').maybeSingle();
  if (error) throw error;
  if (!data) return res.status(404).json({ error: 'Label not found' });
  res.json({ label: data });
}));

// DELETE /api/labels/:id
labelsRouter.delete('/:id', asyncH(async (req, res) => {
  const id = z.string().uuid().parse(req.params.id);
  const { data, error } = await supabase
    .from('labels').delete().eq('id', id).eq('mailbox_id', req.user.mailboxId).select('id').maybeSingle();
  if (error) throw error;
  if (!data) return res.status(404).json({ error: 'Label not found' });
  res.json({ ok: true });
}));

// Verify a label + a mailbox_message both belong to the current user.
async function assertOwnership(mailboxId, labelId, mailboxMessageId) {
  const [{ data: label }, { data: mm }] = await Promise.all([
    supabase.from('labels').select('id').eq('id', labelId).eq('mailbox_id', mailboxId).maybeSingle(),
    supabase.from('mailbox_messages').select('id').eq('id', mailboxMessageId).eq('mailbox_id', mailboxId).maybeSingle(),
  ]);
  return Boolean(label && mm);
}

// POST /api/labels/:id/apply  { mailboxMessageId }
labelsRouter.post('/:id/apply', asyncH(async (req, res) => {
  const labelId = z.string().uuid().parse(req.params.id);
  const { mailboxMessageId } = z.object({ mailboxMessageId: z.string().uuid() }).parse(req.body);

  if (!(await assertOwnership(req.user.mailboxId, labelId, mailboxMessageId))) {
    return res.status(404).json({ error: 'Label or message not found' });
  }
  const { error } = await supabase
    .from('message_labels').upsert({ mailbox_message_id: mailboxMessageId, label_id: labelId });
  if (error) throw error;
  res.status(201).json({ ok: true });
}));

// DELETE /api/labels/:id/apply/:mailboxMessageId
labelsRouter.delete('/:id/apply/:mailboxMessageId', asyncH(async (req, res) => {
  const labelId = z.string().uuid().parse(req.params.id);
  const mailboxMessageId = z.string().uuid().parse(req.params.mailboxMessageId);
  if (!(await assertOwnership(req.user.mailboxId, labelId, mailboxMessageId))) {
    return res.status(404).json({ error: 'Label or message not found' });
  }
  const { error } = await supabase
    .from('message_labels').delete()
    .eq('mailbox_message_id', mailboxMessageId).eq('label_id', labelId);
  if (error) throw error;
  res.json({ ok: true });
}));
