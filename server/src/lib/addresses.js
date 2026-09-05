import { env } from '../env.js';

// Basic, pragmatic email validation. Not RFC-perfect, but safe for internal use
// and a sane gate before the internet-email phase adds stricter parsing.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeAddress(addr) {
  return String(addr || '').trim().toLowerCase();
}

export function isValidAddress(addr) {
  return EMAIL_RE.test(normalizeAddress(addr));
}

export function domainOf(addr) {
  return normalizeAddress(addr).split('@')[1] || '';
}

// Internal = belongs to our own email domain (e.g. @tgo.com).
export function isInternal(addr) {
  return domainOf(addr) === env.emailDomain;
}

// De-duplicate + normalize a list of addresses.
export function cleanList(list) {
  const seen = new Set();
  const out = [];
  for (const a of list || []) {
    const n = normalizeAddress(a);
    if (n && !seen.has(n)) {
      seen.add(n);
      out.push(n);
    }
  }
  return out;
}

// Strip Re:/Fwd:/Fw: prefixes for thread subject normalization.
export function normalizeSubject(subject) {
  return String(subject || '')
    .replace(/^(\s*(re|fwd|fw)\s*:\s*)+/i, '')
    .trim();
}
