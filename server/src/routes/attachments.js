import crypto from 'node:crypto';
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { supabase } from '../supabase.js';
import { asyncH, requireUser } from '../middleware.js';

export const attachmentsRouter = Router();
attachmentsRouter.use(requireUser);

const BUCKET = 'tmail-attachments';
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
});

function safeName(name) {
  return String(name || 'file').replace(/[^\w.\-]+/g, '_').slice(0, 120);
}

// POST /api/attachments  (multipart/form-data, field "file")
// Stores the bytes and returns metadata. The DB row is created when the message
// is actually sent (see routes/messages.js), so uploads can be discarded freely.
attachmentsRouter.post('/', upload.single('file'), asyncH(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded (field "file")' });

  const storagePath = `${req.user.mailboxId}/${crypto.randomUUID()}__${safeName(req.file.originalname)}`;
  const { error } = await supabase.storage.from(BUCKET).upload(storagePath, req.file.buffer, {
    contentType: req.file.mimetype,
    upsert: false,
  });
  if (error) throw error;

  res.status(201).json({
    storagePath,
    filename: req.file.originalname,
    mimeType: req.file.mimetype,
    size: req.file.size,
  });
}));

// GET /api/attachments/:id → short-lived signed download URL (if viewer may see it)
attachmentsRouter.get('/:id', asyncH(async (req, res) => {
  const id = z.string().uuid().parse(req.params.id);

  const { data: att, error } = await supabase
    .from('attachments').select('id, message_id, filename, storage_path').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!att) return res.status(404).json({ error: 'Attachment not found' });

  // Authorization: the viewer must hold a copy of the message this belongs to.
  const { data: view } = await supabase
    .from('mailbox_messages').select('id')
    .eq('mailbox_id', req.user.mailboxId).eq('message_id', att.message_id).maybeSingle();
  if (!view) return res.status(404).json({ error: 'Attachment not found' });

  const { data: signed, error: sErr } = await supabase.storage.from(BUCKET).createSignedUrl(att.storage_path, 60);
  if (sErr) throw sErr;
  res.json({ url: signed.signedUrl, filename: att.filename });
}));
