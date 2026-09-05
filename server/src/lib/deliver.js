import crypto from 'node:crypto';
import { supabase } from '../supabase.js';
import { env } from '../env.js';
import { cleanList, isInternal, isValidAddress, normalizeAddress, normalizeSubject } from './addresses.js';
import { findWorkspaceAddress } from './workspaceAddresses.js';

// ════════════════════════════════════════════════════════════════════════════
// deliver.js — THE delivery seam.
//
// Everything that sends mail (user compose AND the transactional /api/system/send)
// funnels through deliverMessage(). Today it fans a message out to local mailbox
// rows for internal recipients and rejects external ones. When internet email is
// enabled (PLAN.md §12), only the marked branch below changes: external recipients
// get handed to the outbound MTA queue, and an inbound SMTP receiver calls this
// same function. No caller changes.
// ════════════════════════════════════════════════════════════════════════════

function rfcMessageId() {
  return `<${crypto.randomUUID()}@${env.emailDomain}>`;
}

// Find an existing mailbox by address, or create a "shadow" one so mail (e.g. a
// verification code) is never lost for a user who hasn't opened tmail yet. The
// shadow is reconciled to the real TGO ID `sub` on that user's first login.
async function ensureMailboxByAddress(address) {
  const addr = normalizeAddress(address);
  const alias = await findWorkspaceAddress(addr);
  if (alias) return alias.mailbox_id;
  const { data: existing, error: selErr } = await supabase
    .from('mailboxes').select('id').eq('address', addr).maybeSingle();
  if (selErr) throw selErr;
  if (existing) return existing.id;

  const { data: created, error: insErr } = await supabase
    .from('mailboxes')
    .insert({ tgo_user_id: `pending:${addr}`, address: addr })
    .select('id')
    .single();
  if (insErr) throw insErr;
  return created.id;
}

async function resolveThread({ inReplyTo, subject }) {
  if (inReplyTo) {
    const { data: parent } = await supabase
      .from('messages')
      .select('thread_id, rfc_message_id, msg_references')
      .eq('rfc_message_id', inReplyTo)
      .maybeSingle();
    if (parent) {
      return {
        threadId: parent.thread_id,
        references: [...(parent.msg_references || []), parent.rfc_message_id],
      };
    }
  }
  const { data: thread, error } = await supabase
    .from('threads')
    .insert({ subject_normalized: normalizeSubject(subject) })
    .select('id')
    .single();
  if (error) throw error;
  return { threadId: thread.id, references: [] };
}

/**
 * Send a message.
 * @param {object} p
 * @param {string|null} p.senderMailboxId  mailbox to receive the SENT copy (null for system senders)
 * @param {string} p.fromAddress
 * @param {string[]} p.to
 * @param {string[]} [p.cc]
 * @param {string[]} [p.bcc]
 * @param {string} p.subject
 * @param {string} p.bodyText
 * @param {string|null} [p.bodyHtml]
 * @param {string|null} [p.inReplyTo]  rfc_message_id being replied to
 * @returns {Promise<{messageId,threadId,rfcMessageId,delivered:string[],undeliverable:string[]}>}
 */
export async function deliverMessage(p) {
  const fromAddress = normalizeAddress(p.fromAddress);
  const to = cleanList(p.to);
  const cc = cleanList(p.cc);
  const bcc = cleanList(p.bcc);
  const allRecipients = cleanList([...to, ...cc, ...bcc]);

  if (allRecipients.length === 0) throw Object.assign(new Error('At least one recipient is required'), { status: 400 });
  for (const a of allRecipients) {
    if (!isValidAddress(a)) throw Object.assign(new Error(`Invalid address: ${a}`), { status: 400 });
  }

  const { threadId, references } = await resolveThread({ inReplyTo: p.inReplyTo, subject: p.subject });
  const rfc = rfcMessageId();

  // 1) The single physical message
  const { data: message, error: msgErr } = await supabase
    .from('messages')
    .insert({
      thread_id: threadId,
      from_address: fromAddress,
      subject: p.subject ?? '',
      body_text: p.bodyText ?? '',
      body_html: p.bodyHtml ?? null,
      rfc_message_id: rfc,
      in_reply_to: p.inReplyTo ?? null,
      msg_references: references,
    })
    .select('id')
    .single();
  if (msgErr) throw msgErr;

  // 2) Recipients
  const recipientRows = [
    ...to.map((address) => ({ message_id: message.id, address, kind: 'to' })),
    ...cc.map((address) => ({ message_id: message.id, address, kind: 'cc' })),
    ...bcc.map((address) => ({ message_id: message.id, address, kind: 'bcc' })),
  ];
  if (recipientRows.length) {
    const { error } = await supabase.from('recipients').insert(recipientRows);
    if (error) throw error;
  }

  // 3) Bump the thread
  await supabase.from('threads').update({ last_message_at: new Date().toISOString() }).eq('id', threadId);

  // 4) Fan-out ----------------------------------------------------------------
  const views = [];
  const delivered = [];
  const undeliverable = [];

  // sender's SENT copy (skip for system senders with no mailbox)
  if (p.senderMailboxId) {
    views.push({
      mailbox_id: p.senderMailboxId,
      message_id: message.id,
      system_folder: 'SENT',
      is_read: true,
    });
  }

  for (const address of allRecipients) {
    if (isInternal(address)) {
      const mailboxId = await ensureMailboxByAddress(address);
      // don't double-insert if sender emailed themselves
      if (!(p.senderMailboxId && mailboxId === p.senderMailboxId)) {
        views.push({ mailbox_id: mailboxId, message_id: message.id, system_folder: 'INBOX', is_read: false });
      }
      delivered.push(address);
    } else {
      // ── INTERNET-EMAIL SEAM (P7) ──────────────────────────────────────────
      // Today: reject external recipients. Later: enqueue to outbound MTA here
      // and record status 'queued' instead of 'rejected'.
      undeliverable.push(address);
      await supabase.from('delivery_log').insert({
        message_id: message.id, address, status: 'rejected',
        detail: 'External delivery not enabled (internal-only phase)',
      });
    }
  }

  if (views.length) {
    const { error } = await supabase.from('mailbox_messages').insert(views);
    if (error) throw error;
  }
  for (const address of delivered) {
    await supabase.from('delivery_log').insert({ message_id: message.id, address, status: 'internal' });
  }

  return { messageId: message.id, threadId, rfcMessageId: rfc, delivered, undeliverable };
}
