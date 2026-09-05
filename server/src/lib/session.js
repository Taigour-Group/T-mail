import { SignJWT, jwtVerify } from 'jose';
import { env } from '../env.js';

// Signed, httpOnly session cookie (parallels TGO ID's `tgo_sid`). We sign a
// compact JWT with the mailbox identity and store it in the cookie; no server
// session store needed. A separate short-lived cookie carries the transient
// OAuth handshake state (PKCE verifier + nonce) between /auth/login and callback.

const secret = new TextEncoder().encode(env.cookieSecret);

export const SESSION_COOKIE = 'tmail_sid';
export const OAUTH_COOKIE = 'tmail_oauth';

const baseCookieOpts = {
  httpOnly: true,
  sameSite: 'lax',
  secure: env.isProd,
  path: '/',
};

async function sign(payload, expSeconds) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${expSeconds}s`)
    .sign(secret);
}

async function verify(token) {
  const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'] });
  return payload;
}

// ── User session ─────────────────────────────────────────────────────────────
export async function setSession(res, { mailboxId, sub, address, name }) {
  const token = await sign({ mailboxId, sub, address, name }, 60 * 60 * 24 * 7); // 7d
  res.cookie(SESSION_COOKIE, token, { ...baseCookieOpts, maxAge: 7 * 24 * 60 * 60 * 1000 });
}

export async function readSession(req) {
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token) return null;
  try {
    return await verify(token);
  } catch {
    return null;
  }
}

export function clearSession(res) {
  res.clearCookie(SESSION_COOKIE, { ...baseCookieOpts });
}

// ── Transient OAuth handshake state ──────────────────────────────────────────
export async function setOAuthState(res, { state, nonce, verifier, returnTo }) {
  const token = await sign({ state, nonce, verifier, returnTo }, 60 * 10); // 10 min
  res.cookie(OAUTH_COOKIE, token, { ...baseCookieOpts, maxAge: 10 * 60 * 1000 });
}

export async function readOAuthState(req) {
  const token = req.cookies?.[OAUTH_COOKIE];
  if (!token) return null;
  try {
    return await verify(token);
  } catch {
    return null;
  }
}

export function clearOAuthState(res) {
  res.clearCookie(OAUTH_COOKIE, { ...baseCookieOpts });
}
