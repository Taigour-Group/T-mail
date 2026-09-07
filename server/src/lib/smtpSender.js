import nodemailer from 'nodemailer';
import { getWorkspaceSmtpSecret } from './smtp.js';

// ════════════════════════════════════════════════════════════════════════════
// smtpSender.js — outbound relay for EXTERNAL recipients.
//
// Called from the delivery seam ONLY when a workspace has an enabled SMTP relay.
// Internal @tgo.com delivery never comes through here. Transports are cached per
// workspace so we don't reconnect on every message.
// ════════════════════════════════════════════════════════════════════════════

const transportCache = new Map(); // workspaceId -> { transport, key }

function configKey(cfg) {
  return `${cfg.host}:${cfg.port}:${cfg.secure}:${cfg.username}`;
}

async function getTransport(workspaceId) {
  const cfg = await getWorkspaceSmtpSecret(workspaceId);
  if (!cfg || !cfg.enabled) return null;

  const key = configKey(cfg);
  const cached = transportCache.get(workspaceId);
  if (cached && cached.key === key) return { transport: cached.transport, cfg };

  if (cached) cached.transport.close();
  const transport = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: { user: cfg.username, pass: cfg.password },
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 20_000,
  });
  transportCache.set(workspaceId, { transport, key });
  return { transport, cfg };
}

/**
 * Send one message to a set of external recipients through the workspace relay.
 * Returns { ok, sent: string[], error }.  Does NOT throw — the caller records
 * per-recipient status in delivery_log.
 */
export async function sendExternalViaWorkspace({ workspaceId, from, fromAddress, to, subject, text, html, headers }) {
  const resolved = await getTransport(workspaceId);
  if (!resolved) return { ok: false, sent: [], error: 'Workspace SMTP relay is not enabled' };

  const { transport, cfg } = resolved;
  const fromName = cfg.fromName || undefined;
  const envelopeFrom = cfg.fromAddress || fromAddress || from;

  try {
    await transport.sendMail({
      from: fromName ? { name: fromName, address: envelopeFrom } : envelopeFrom,
      to,
      subject: subject || '',
      text: text || '',
      html: html || undefined,
      headers,
    });
    return { ok: true, sent: to, error: null };
  } catch (e) {
    return { ok: false, sent: [], error: e.message || 'SMTP send failed' };
  }
}
