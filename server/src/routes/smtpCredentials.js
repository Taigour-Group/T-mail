import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { asyncH, requireUser } from '../middleware.js';
import { getWorkspaceForMailbox } from '../lib/businessAccounts.js';
import { env } from '../env.js';
import {
  createSmtpCredential, listSmtpCredentials, revokeSmtpCredential,
} from '../lib/smtpCredentials.js';

// App passwords for OUR SMTP submission server. A verified workspace mints one
// per address; the plaintext secret is shown exactly once, on creation.
export const smtpCredentialsRouter = Router();
smtpCredentialsRouter.use(requireUser);

const createLimiter = rateLimit({ windowMs: 60 * 60_000, max: 20, standardHeaders: true, legacyHeaders: false });

async function requireVerifiedWorkspace(req, res) {
  const workspace = await getWorkspaceForMailbox(req.user.mailboxId);
  if (!workspace) {
    res.status(403).json({ error: 'Create a TGO Workspace before issuing SMTP credentials' });
    return null;
  }
  if (workspace.verification_status !== 'verified') {
    res.status(403).json({ error: 'TGO team verification is required first', code: 'WORKSPACE_VERIFICATION_REQUIRED' });
    return null;
  }
  if (workspace.role !== 'owner' && workspace.role !== 'admin') {
    res.status(403).json({ error: 'Only a workspace owner or admin can manage SMTP credentials' });
    return null;
  }
  return workspace;
}

// Connection settings a client needs, plus the list of issued credentials.
smtpCredentialsRouter.get('/', asyncH(async (req, res) => {
  const workspace = await requireVerifiedWorkspace(req, res);
  if (!workspace) return;
  res.json({
    server: {
      host: env.smtpSubmission.enabled ? undefined : null, // host is deployment-specific; UI shows guidance
      port: env.smtpSubmission.port,
      enabled: env.smtpSubmission.enabled,
      security: 'STARTTLS',
    },
    credentials: await listSmtpCredentials(workspace.id),
  });
}));

// Mint a new credential for one of the workspace's addresses.
smtpCredentialsRouter.post('/', createLimiter, asyncH(async (req, res) => {
  const workspace = await requireVerifiedWorkspace(req, res);
  if (!workspace) return;
  const { address, label } = z.object({
    address: z.string().trim().toLowerCase().email(),
    label: z.string().trim().max(80).optional(),
  }).parse(req.body);

  const created = await createSmtpCredential({ workspaceId: workspace.id, address, label });
  // `secret` and `username` are returned ONCE here; the client must save them now.
  res.status(201).json({ ok: true, credential: created });
}));

smtpCredentialsRouter.delete('/:id', asyncH(async (req, res) => {
  const workspace = await requireVerifiedWorkspace(req, res);
  if (!workspace) return;
  const credentialId = z.string().uuid().parse(req.params.id);
  const revoked = await revokeSmtpCredential({ workspaceId: workspace.id, credentialId });
  if (!revoked) return res.status(404).json({ error: 'Credential not found or already revoked' });
  res.json({ ok: true });
}));
