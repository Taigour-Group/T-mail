import crypto from 'node:crypto';
import { env } from './env.js';
import { readSession } from './lib/session.js';

// Wrap async handlers so thrown/rejected errors reach the error middleware.
export const asyncH = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// ── User plane: authenticated via the tmail_sid session cookie (from TGO ID) ──
export const requireUser = asyncH(async (req, res, next) => {
  const session = await readSession(req);
  if (!session?.mailboxId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  req.user = {
    mailboxId: session.mailboxId,
    sub: session.sub,
    address: session.address,
    name: session.name,
  };
  next();
});

// ── Service plane: machine-to-machine bearer token (TGO ID → tmail) ───────────
function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

export function requireService(req, res, next) {
  const header = req.get('authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match || !safeEqual(match[1], env.serviceToken)) {
    return res.status(401).json({ error: 'Invalid service token' });
  }
  next();
}

// ── 404 + centralized error handler ───────────────────────────────────────────
export function notFound(req, res) {
  res.status(404).json({ error: 'Not found' });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  if (status >= 500) console.error('✖', err);
  res.status(status).json({
    error: status >= 500 && env.isProd ? 'Internal server error' : err.message,
  });
}
