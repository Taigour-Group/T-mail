import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import nodemailer from 'nodemailer';
import { asyncH, requireUser } from '../middleware.js';
import { getWorkspaceForMailbox } from '../lib/businessAccounts.js';
import { findWorkspaceAddress } from '../lib/workspaceAddresses.js';
import {
  getWorkspaceSmtp, getWorkspaceSmtpSecret, upsertWorkspaceSmtp,
  deleteWorkspaceSmtp, recordTestResult,
} from '../lib/smtp.js';

export const workspaceSmtpRouter = Router();
workspaceSmtpRouter.use(requireUser);

// SMTP verification opens a real socket to a third party; keep it well rate-limited.
const testLimiter = rateLimit({ windowMs: 60_000, max: 10, standardHeaders: true, legacyHeaders: false });
const writeLimiter = rateLimit({ windowMs: 60_000, max: 30, standardHeaders: true, legacyHeaders: false });

// Only a verified workspace OWNER/ADMIN may touch SMTP — it can send on the
// workspace's behalf and holds a credential, so it's more sensitive than addresses.
async function requireWorkspaceAdmin(req, res) {
  const workspace = await getWorkspaceForMailbox(req.user.mailboxId);
  if (!workspace) {
    res.status(403).json({ error: 'Create a TGO Workspace before configuring SMTP' });
    return null;
  }
  if (workspace.verification_status !== 'verified') {
    res.status(403).json({ error: 'TGO team verification is required before configuring SMTP', code: 'WORKSPACE_VERIFICATION_REQUIRED' });
    return null;
  }
  if (workspace.role !== 'owner' && workspace.role !== 'admin') {
    res.status(403).json({ error: 'Only a workspace owner or admin can configure SMTP' });
    return null;
  }
  return workspace;
}

const configSchema = z.object({
  host: z.string().trim().min(1).max(255),
  port: z.coerce.number().int().min(1).max(65535),
  secure: z.boolean().optional(),
  username: z.string().trim().min(1).max(320),
  password: z.string().min(1).max(1024).optional(),   // omit on update to keep existing
  fromName: z.string().trim().max(120).optional(),
  fromAddress: z.string().trim().toLowerCase().email().optional(),
  enabled: z.boolean().optional(),
});

// If a from address is given it must be an address this workspace actually owns,
// so a workspace can't spoof another workspace's or user's identity.
async function assertOwnedFrom(workspace, fromAddress) {
  if (!fromAddress) return;
  const owned = await findWorkspaceAddress(fromAddress);
  if (!owned || owned.workspace_id !== workspace.id) {
    throw Object.assign(new Error('The From address must be an address owned by this workspace'), { status: 400 });
  }
}

// GET current config (never returns the password).
workspaceSmtpRouter.get('/', asyncH(async (req, res) => {
  const workspace = await requireWorkspaceAdmin(req, res);
  if (!workspace) return;
  res.json({ smtp: await getWorkspaceSmtp(workspace.id) });
}));

// PUT save/update config.
workspaceSmtpRouter.put('/', writeLimiter, asyncH(async (req, res) => {
  const workspace = await requireWorkspaceAdmin(req, res);
  if (!workspace) return;
  const input = configSchema.parse(req.body);

  // On first-time setup a password is mandatory; on update it may be omitted.
  const existing = await getWorkspaceSmtp(workspace.id);
  if (!existing && !input.password) {
    return res.status(400).json({ error: 'A password or app password is required' });
  }
  await assertOwnedFrom(workspace, input.fromAddress);

  const secure = input.secure ?? input.port === 465;
  const smtp = await upsertWorkspaceSmtp(workspace.id, { ...input, secure });
  res.json({ ok: true, smtp });
}));

// POST test — opens a connection and verifies credentials via nodemailer.verify().
// Uses the submitted password if present, else the stored one. Never sends mail.
workspaceSmtpRouter.post('/test', testLimiter, asyncH(async (req, res) => {
  const workspace = await requireWorkspaceAdmin(req, res);
  if (!workspace) return;

  const partial = configSchema.partial().parse(req.body || {});
  const stored = await getWorkspaceSmtpSecret(workspace.id);

  const host = partial.host ?? stored?.host;
  const port = partial.port ?? stored?.port;
  const username = partial.username ?? stored?.username;
  const password = partial.password ?? stored?.password;
  const secure = partial.secure ?? (port === 465);

  if (!host || !port || !username || !password) {
    return res.status(400).json({ error: 'Host, port, username, and password are required to test the connection' });
  }

  const transport = nodemailer.createTransport({
    host, port, secure,
    auth: { user: username, pass: password },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 10_000,
  });

  try {
    await transport.verify();
    if (stored) await recordTestResult(workspace.id, true);
    res.json({ ok: true, message: 'Connection successful' });
  } catch (e) {
    if (stored) await recordTestResult(workspace.id, false, e.message);
    res.status(400).json({ ok: false, error: e.message || 'Connection failed' });
  } finally {
    transport.close();
  }
}));

// DELETE config — reverts external delivery to rejected.
workspaceSmtpRouter.delete('/', writeLimiter, asyncH(async (req, res) => {
  const workspace = await requireWorkspaceAdmin(req, res);
  if (!workspace) return;
  await deleteWorkspaceSmtp(workspace.id);
  res.json({ ok: true });
}));
