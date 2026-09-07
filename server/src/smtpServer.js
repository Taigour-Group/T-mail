import { SMTPServer } from 'smtp-server';
import { simpleParser } from 'mailparser';
import { env } from './env.js';
import { authenticateSmtpCredential } from './lib/smtpCredentials.js';
import { getWorkspaceSmtp } from './lib/smtp.js';
import { deliverMessage } from './lib/deliver.js';
import { normalizeAddress, isInternal } from './lib/addresses.js';

// ════════════════════════════════════════════════════════════════════════════
// smtpServer.js — OUR inbound SMTP submission server.
//
// A mail client / app connects here with a workspace address as the username
// and an app password (see lib/smtpCredentials.js) as the password. On success
// we parse the message, enforce that the From matches the authenticated address,
// and hand the message to the ONE delivery seam, deliverMessage(). Internal
// @tgo.com recipients fan out to local mailboxes; external recipients only leave
// the building when the workspace has an enabled SMTP relay (relayWorkspaceId),
// exactly like the web compose path — no second delivery path.
// ════════════════════════════════════════════════════════════════════════════

const MAX_MESSAGE_BYTES = 15 * 1024 * 1024; // 15 MB, matches typical submission caps

function collect(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let tooBig = false;
    stream.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_MESSAGE_BYTES) { tooBig = true; return; }
      chunks.push(chunk);
    });
    stream.on('end', () => (tooBig ? reject(Object.assign(new Error('Message exceeds size limit'), { responseCode: 552 })) : resolve(Buffer.concat(chunks))));
    stream.on('error', reject);
  });
}

function addressList(parsedField) {
  if (!parsedField) return [];
  const values = Array.isArray(parsedField) ? parsedField : [parsedField];
  return values.flatMap((entry) => (entry.value || []).map((v) => normalizeAddress(v.address)).filter(Boolean));
}

async function onAuth(auth, session, callback) {
  try {
    const identity = await authenticateSmtpCredential(auth.username, auth.password);
    if (!identity) return callback(new Error('Invalid SMTP credentials'));
    // Stash the authed identity on the session for onData to enforce against.
    session.tmail = identity;
    callback(null, { user: identity.address });
  } catch (e) {
    callback(new Error('Authentication failed'));
  }
}

async function onData(stream, session, callback) {
  let raw;
  try {
    raw = await collect(stream);
  } catch (e) {
    return callback(e);
  }

  const identity = session.tmail;
  if (!identity) return callback(new Error('Not authenticated'));

  let parsed;
  try {
    parsed = await simpleParser(raw);
  } catch (e) {
    return callback(Object.assign(new Error('Could not parse message'), { responseCode: 550 }));
  }

  // The From header must be the authenticated address — no sending as someone else.
  const fromHeader = addressList(parsed.from)[0];
  if (!fromHeader || fromHeader !== identity.address) {
    return callback(Object.assign(new Error(`From must be ${identity.address}`), { responseCode: 550 }));
  }

  // Recipients: prefer the SMTP envelope (RCPT TO), fall back to headers.
  const envelopeTo = (session.envelope?.rcptTo || []).map((r) => normalizeAddress(r.address)).filter(Boolean);
  const headerTo = addressList(parsed.to);
  const headerCc = addressList(parsed.cc);
  const to = envelopeTo.length ? envelopeTo : headerTo;
  const cc = envelopeTo.length ? [] : headerCc; // envelope already includes cc/bcc recipients
  if (!to.length && !cc.length) {
    return callback(Object.assign(new Error('No recipients'), { responseCode: 550 }));
  }

  // External recipients only relay out if this workspace has an enabled relay.
  const external = [...to, ...cc].filter((addr) => !isInternal(addr));
  let relayWorkspaceId;
  if (external.length) {
    const relay = await getWorkspaceSmtp(identity.workspaceId);
    if (!relay || !relay.enabled) {
      return callback(Object.assign(
        new Error(`External delivery is not enabled for this workspace. Configure an SMTP relay to reach: ${external.join(', ')}`),
        { responseCode: 550 },
      ));
    }
    relayWorkspaceId = identity.workspaceId;
  }

  try {
    await deliverMessage({
      senderMailboxId: identity.mailboxId,
      fromAddress: identity.address,
      to,
      cc,
      subject: parsed.subject || '',
      bodyText: parsed.text || '',
      bodyHtml: parsed.html || null,
      inReplyTo: parsed.inReplyTo || null,
      relayWorkspaceId,
    });
    callback();
  } catch (e) {
    callback(Object.assign(new Error(e.message || 'Delivery failed'), { responseCode: 451 }));
  }
}

export function startSmtpSubmissionServer() {
  if (!env.smtpSubmission.enabled) return null;

  const hasTls = Boolean(env.smtpSubmission.tlsKey && env.smtpSubmission.tlsCert);
  const server = new SMTPServer({
    name: env.emailDomain,
    banner: `tmail submission (${env.emailDomain})`,
    authMethods: ['PLAIN', 'LOGIN'],
    // Never accept credentials over a cleartext link in production. On localhost
    // (no cert) we allow it so the flow is testable without a cert.
    authOptional: false,
    allowInsecureAuth: !hasTls,
    secure: false,          // STARTTLS upgrade, not implicit TLS
    ...(hasTls ? { key: env.smtpSubmission.tlsKey, cert: env.smtpSubmission.tlsCert } : {}),
    size: MAX_MESSAGE_BYTES,
    onAuth,
    onData,
  });

  server.on('error', (err) => console.error('[smtp] server error:', err.message));
  server.listen(env.smtpSubmission.port, () => {
    console.log(`tmail SMTP submission on port ${env.smtpSubmission.port}  (TLS: ${hasTls ? 'STARTTLS' : 'none — dev only'})`);
  });
  return server;
}
