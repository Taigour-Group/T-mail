import { Router } from 'express';
import { z } from 'zod';
import { supabase } from '../supabase.js';
import { asyncH, requireUser } from '../middleware.js';

export const searchRouter = Router();
searchRouter.use(requireUser);

function snippet(text, n = 140) {
  const s = String(text || '').replace(/\s+/g, ' ').trim();
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

// GET /api/search?q=...  → Postgres full-text search, scoped to the viewer.
searchRouter.get('/', asyncH(async (req, res) => {
  const q = z.string().trim().min(1).max(200).safeParse(req.query.q);
  if (!q.success) return res.json({ results: [] });

  // 1) FTS across all messages
  const { data: hits, error } = await supabase
    .from('messages')
    .select('id, thread_id, from_address, subject, body_text, created_at')
    .textSearch('search_tsv', q.data, { type: 'websearch', config: 'english' })
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  if (!hits?.length) return res.json({ results: [] });

  // 2) Keep only messages the viewer actually holds a copy of
  const ids = hits.map((h) => h.id);
  const { data: views, error: vErr } = await supabase
    .from('mailbox_messages')
    .select('id, message_id, is_read, is_starred, system_folder')
    .eq('mailbox_id', req.user.mailboxId)
    .in('message_id', ids);
  if (vErr) throw vErr;

  const viewByMsg = new Map((views || []).map((v) => [v.message_id, v]));
  const results = hits
    .filter((h) => viewByMsg.has(h.id))
    .map((h) => {
      const v = viewByMsg.get(h.id);
      return {
        messageId: h.id,
        threadId: h.thread_id,
        from: h.from_address,
        subject: h.subject,
        snippet: snippet(h.body_text),
        createdAt: h.created_at,
        mailboxMessageId: v.id,
        isRead: v.is_read,
        isStarred: v.is_starred,
        folder: v.system_folder,
      };
    });

  res.json({ results });
}));
