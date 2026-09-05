import { Router } from 'express';
import { asyncH, requireUser } from '../middleware.js';
import { env } from '../env.js';
import {
  buildAuthUrl, exchangeCode, generatePkce, randomToken, verifyIdToken,
} from '../lib/oidc.js';
import {
  setSession, clearSession, setOAuthState, readOAuthState, clearOAuthState,
} from '../lib/session.js';
import { reconcileMailbox } from '../lib/mailboxes.js';
import { normalizeAddress } from '../lib/addresses.js';

export const authRouter = Router();

// Only allow same-site relative return paths (prevents open redirects).
function safeReturnTo(raw) {
  if (typeof raw === 'string' && raw.startsWith('/') && !raw.startsWith('//')) return raw;
  return '/';
}

// GET /auth/login → redirect to TGO ID's authorize endpoint (Auth Code + PKCE)
authRouter.get('/login', asyncH(async (req, res) => {
  const state = randomToken();
  const nonce = randomToken();
  const { verifier, challenge } = generatePkce();
  const returnTo = safeReturnTo(req.query.returnTo);

  await setOAuthState(res, { state, nonce, verifier, returnTo });
  const url = await buildAuthUrl({ state, nonce, challenge });
  res.redirect(url);
}));

// GET /auth/callback → TGO ID redirects back here with ?code&state
authRouter.get('/callback', asyncH(async (req, res) => {
  const { code, state, error, error_description } = req.query;

  if (error) {
    return res.status(400).send(`Sign-in failed: ${error_description || error}`);
  }

  const saved = await readOAuthState(req);
  clearOAuthState(res);

  if (!saved || !state || state !== saved.state) {
    return res.status(400).send('Invalid or expired sign-in state. Please try again.');
  }
  if (!code) return res.status(400).send('Missing authorization code.');

  const tokens = await exchangeCode({ code, verifier: saved.verifier });
  const claims = await verifyIdToken(tokens.id_token, saved.nonce);

  const sub = claims.sub;
  // TGO ID enforces name@tgo.com, so the email claim is the mailbox address.
  const address = normalizeAddress(claims.email || `${claims.preferred_username}@${env.emailDomain}`);
  const name = claims.name || claims.preferred_username || null;

  if (!sub || !address.includes('@')) {
    return res.status(400).send('TGO ID did not return the expected identity claims.');
  }

  const mailboxId = await reconcileMailbox({ sub, address, name });
  await setSession(res, { mailboxId, sub, address, name });

  res.redirect(`${env.webOrigin}${saved.returnTo || '/'}`);
}));

// POST /auth/logout
authRouter.post('/logout', (req, res) => {
  clearSession(res);
  res.json({ ok: true });
});

// GET /auth/me → current identity (used by the web app on load)
authRouter.get('/me', requireUser, (req, res) => {
  res.json({ user: req.user });
});
