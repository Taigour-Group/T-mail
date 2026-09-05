import crypto from 'node:crypto';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { env } from '../env.js';

// ── OIDC discovery (cached) ──────────────────────────────────────────────────
// tmail never hardcodes TGO ID's endpoints; it reads them from the standard
// discovery document so it keeps working if TGO ID's routes change.
let _discovery = null;
let _jwks = null;

function normalizeEndpoint(endpoint) {
  if (!endpoint) return endpoint;

  const parsed = new URL(endpoint);
  const issuer = new URL(env.oidc.issuer);
  if (parsed.hostname === 'localhost' && parsed.port === '4000' && issuer.hostname !== 'localhost') {
    return new URL(`${parsed.pathname}${parsed.search}`, issuer).toString();
  }
  return endpoint;
}

export async function getDiscovery() {
  if (_discovery) return _discovery;
  const url = `${env.oidc.issuer}/.well-known/openid-configuration`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`OIDC discovery failed (${res.status}) at ${url}`);
  }
  const discovery = await res.json();
  for (const key of ['authorization_endpoint', 'token_endpoint', 'userinfo_endpoint', 'jwks_uri', 'revocation_endpoint']) {
    discovery[key] = normalizeEndpoint(discovery[key]);
  }
  _discovery = discovery;
  return _discovery;
}

async function getJwks() {
  if (_jwks) return _jwks;
  const disc = await getDiscovery();
  _jwks = createRemoteJWKSet(new URL(disc.jwks_uri));
  return _jwks;
}

// ── PKCE (S256) + random state/nonce ─────────────────────────────────────────
function base64url(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function generatePkce() {
  const verifier = base64url(crypto.randomBytes(32));
  const challenge = base64url(crypto.createHash('sha256').update(verifier).digest());
  return { verifier, challenge };
}

export function randomToken() {
  return base64url(crypto.randomBytes(24));
}

// ── Build the authorize redirect ─────────────────────────────────────────────
export async function buildAuthUrl({ state, nonce, challenge }) {
  const disc = await getDiscovery();
  const u = new URL(disc.authorization_endpoint);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('client_id', env.oidc.clientId);
  u.searchParams.set('redirect_uri', env.oidc.redirectUri);
  u.searchParams.set('scope', 'openid email profile');
  u.searchParams.set('state', state);
  u.searchParams.set('nonce', nonce);
  u.searchParams.set('code_challenge', challenge);
  u.searchParams.set('code_challenge_method', 'S256');
  return u.toString();
}

// ── Exchange the authorization code for tokens ───────────────────────────────
export async function exchangeCode({ code, verifier }) {
  const disc = await getDiscovery();
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: env.oidc.redirectUri,
    code_verifier: verifier,
  });

  const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
  const methods = disc.token_endpoint_auth_methods_supported || ['client_secret_basic'];

  if (methods.includes('client_secret_basic')) {
    const basic = Buffer.from(`${env.oidc.clientId}:${env.oidc.clientSecret}`).toString('base64');
    headers.Authorization = `Basic ${basic}`;
  } else {
    // client_secret_post fallback
    body.set('client_id', env.oidc.clientId);
    body.set('client_secret', env.oidc.clientSecret);
  }

  const res = await fetch(disc.token_endpoint, { method: 'POST', headers, body });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Token exchange failed (${res.status}): ${detail}`);
  }
  return res.json(); // { id_token, access_token, ... }
}

// ── Verify the id_token and return its claims ────────────────────────────────
export async function verifyIdToken(idToken, expectedNonce) {
  const disc = await getDiscovery();
  const jwks = await getJwks();
  const { payload } = await jwtVerify(idToken, jwks, {
    issuer: disc.issuer,
    audience: env.oidc.clientId,
  });
  if (expectedNonce && payload.nonce !== expectedNonce) {
    throw new Error('OIDC nonce mismatch');
  }
  return payload; // { sub, email, name, ... }
}
