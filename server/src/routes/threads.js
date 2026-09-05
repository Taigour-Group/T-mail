import { Router } from 'express';
import { z } from 'zod';
import { supabase } from '../supabase.js';
import { asyncH, requireUser } from '../middleware.js';

export const threadsRouter = Router();
threadsRouter.use(requireUser);

function snippet(text, n = 140) {
  const s = String(text || '').replace(/\s+/g, ' ').trim();
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

// GET /api/threads?folder=INBOX|SENT|DRAFT|TRASH|SPAM|STARRED&limit=50
threadsRouter.get('/', asyncH(async (req, res) => {
  const q = z.object({
    folder: z.enum(['INBOX', 'SENT', 'DRAFT', 'TRASH', 'SPAM', 'STARRED']).default('INBOX'),
    labelId: z.string().uuid().optional(),
    limit: z.coerce.number().min(1).max(100).default(50),
  }).parse(req.query);

  let query = supabase
    .from('mailbox_messages')
    .select('id, is_read, is_starred, is_draft, system_folder, created_at, message:messages(id, thread_id, from_address, subject, body_text, created_at)')
    .eq('mailbox_id', req.user.mailboxId)
    .order('created_at', { ascending: false })
    .limit(400);

  if (q.folder === 'STARRED') query = query.eq('is_starred', true);
  else query = query.eq('system_folder', q.folder);

  const { data, error } = await query;
  if (error) throw error;

  let rows = data || [];

  // Optional label filter (join table lookup, then intersect)
  if (q.labelId) {
    const { data: labelRows, error: lErr } = await supabase
      .from('message_labels').select('mailbox_message_id').eq('label_id', q.labelId);
    if (lErr) throw lErr;
    const allowed = new Set((labelRows || []).map((r) => r.mailbox_message_id));
    rows = rows.filter((r) => allowed.has(r.id));
  }

  // Group into threads
  const threads = new Map();
  for (const r of rows) {
    const m = r.message;
    if (!m) continue;
    const t = threads.get(m.thread_id) || {
      threadId: m.thread_id, subject: m.subject, snippet: '',
      lastMessageAt: m.created_at, unread: false, starred: false,
      messageCount: 0, participants: new Set(),
    };
    t.messageCount += 1;
    t.participants.add(m.from_address);
    if (!r.is_read) t.unread = true;
    if (r.is_starred) t.starred = true;
    if (m.created_at >= t.lastMessageAt) {
      t.lastMessageAt = m.created_at;
      t.subject = m.subject;
      t.snippet = snippet(m.body_text);
    }
    threads.set(m.thread_id, t);
  }

  const list = [...threads.values()]
    .map((t) => ({ ...t, participants: [...t.participants] }))
    .sort((a, b) => (a.lastMessageAt < b.lastMessageAt ? 1 : -1))
    .slice(0, q.limit);

  res.json({ threads: list });
}));

// GET /api/threads/:id → full conversation the viewer is allowed to see
threadsRouter.get('/:id', asyncH(async (req, res) => {
  const threadId = z.string().uuid().parse(req.params.id);
  const viewer = req.user.address;

  // The viewer's own per-message views in this thread (authorization + flags)
  const { data: views, error: vErr } = await supabase
    .from('mailbox_messages')
    .select('id, message_id, is_read, is_starred, system_folder, message:messages!inner(thread_id)')
    .eq('mailbox_id', req.user.mailboxId)
    .eq('message.thread_id', threadId);
  if (vErr) throw vErr;
  if (!views || views.length === 0) {
    return res.status(404).json({ error: 'Thread not found' });
  }
  const viewByMessage = new Map(views.map((v) => [v.message_id, v]));

  const { data: messages, error: mErr } = await supabase
    .from('messages')
    .select('id, from_address, subject, body_text, body_html, created_at, rfc_message_id, in_reply_to, recipients(address, kind), attachments(id, filename, mime_type, size_bytes)')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true });
  if (mErr) throw mErr;

  const shaped = (messages || []).map((m) => {
    const view = viewByMessage.get(m.id) || null;
    // Hide bcc from everyone except the sender or the bcc'd viewer.
    const recipients = (m.recipients || []).filter(
      (r) => r.kind !== 'bcc' || m.from_address === viewer || r.address === viewer,
    );
    return {
      id: m.id,
      from: m.from_address,
      subject: m.subject,
      bodyText: m.body_text,
      bodyHtml: m.body_html,
      createdAt: m.created_at,
      rfcMessageId: m.rfc_message_id,
      inReplyTo: m.in_reply_to,
      recipients,
      attachments: m.attachments || [],
      mailboxMessageId: view?.id || null,
      isRead: view?.is_read ?? true,
      isStarred: view?.is_starred ?? false,
      folder: view?.system_folder || null,
    };
  });

  // Mark the viewer's copies read
  const unreadIds = views.filter((v) => !v.is_read).map((v) => v.id);
  if (unreadIds.length) {
    await supabase.from('mailbox_messages').update({ is_read: true }).in('id', unreadIds);
  }

  res.json({
    threadId,
    subject: shaped[shaped.length - 1]?.subject || '',
    messages: shaped,
  });
}));
