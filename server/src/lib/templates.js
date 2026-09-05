import { env } from '../env.js';

// Transactional templates used by TGO ID (and other first-party apps) via
// POST /api/system/send. Each returns { from, subject, text, html }.
// `vars` is caller-supplied; always HTML-escape it when interpolating into html.

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function shell(title, bodyHtml) {
  return `<!doctype html><html><body style="margin:0;background:#f6f7f9;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111">
  <div style="max-width:480px;margin:0 auto;padding:32px 24px">
    <div style="font-weight:700;font-size:18px;letter-spacing:-.02em;margin-bottom:16px">tmail</div>
    <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:24px">
      <h1 style="font-size:18px;margin:0 0 12px">${esc(title)}</h1>
      ${bodyHtml}
    </div>
    <p style="color:#6b7280;font-size:12px;margin-top:16px">Sent by TGO ID via tmail. If you didn't request this, you can ignore this email.</p>
  </div></body></html>`;
}

const templates = {
  // Email address verification (link-based)
  verify_email({ app = 'your account', link = '#' } = {}) {
    return {
      from: env.systemSenders.noReply,
      subject: `Verify your email for ${app}`,
      text: `Confirm your email address for ${app} by opening this link:\n\n${link}\n\nIf you didn't request this, ignore this email.`,
      html: shell(
        `Verify your email for ${esc(app)}`,
        `<p style="margin:0 0 20px;color:#374151">Confirm your email address to finish signing in to <b>${esc(app)}</b>.</p>
         <p style="margin:0 0 20px"><a href="${esc(link)}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600">Verify email</a></p>
         <p style="margin:0;color:#6b7280;font-size:13px;word-break:break-all">${esc(link)}</p>`,
      ),
    };
  },

  // Login one-time passcode
  verify_login({ app = 'your account', code = '000000' } = {}) {
    return {
      from: env.systemSenders.noReply,
      subject: `${code} is your ${app} verification code`,
      text: `Your verification code for ${app} is: ${code}\n\nIt expires shortly. If you didn't try to sign in, ignore this email.`,
      html: shell(
        `Your ${esc(app)} verification code`,
        `<p style="margin:0 0 16px;color:#374151">Use this code to finish signing in to <b>${esc(app)}</b>:</p>
         <div style="font-size:32px;font-weight:700;letter-spacing:8px;background:#f3f4f6;border-radius:8px;padding:16px;text-align:center">${esc(code)}</div>
         <p style="margin:16px 0 0;color:#6b7280;font-size:13px">This code expires shortly. If you didn't try to sign in, ignore this email.</p>`,
      ),
    };
  },

  // Security alert (new device, password change, etc.)
  security_alert({ app = 'your account', event = 'A security event occurred', when = '', where = '' } = {}) {
    const meta = [when && `When: ${when}`, where && `Where: ${where}`].filter(Boolean).join('\n');
    return {
      from: env.systemSenders.security,
      subject: `Security alert for ${app}`,
      text: `${event} on ${app}.\n${meta}\n\nIf this was you, no action is needed.`,
      html: shell(
        `Security alert`,
        `<p style="margin:0 0 12px;color:#374151">${esc(event)} on <b>${esc(app)}</b>.</p>
         ${when ? `<p style="margin:0;color:#6b7280;font-size:13px">When: ${esc(when)}</p>` : ''}
         ${where ? `<p style="margin:0;color:#6b7280;font-size:13px">Where: ${esc(where)}</p>` : ''}
         <p style="margin:16px 0 0;color:#374151">If this was you, no action is needed.</p>`,
      ),
    };
  },
};

export const TEMPLATE_NAMES = Object.keys(templates);

export function renderTemplate(name, vars = {}) {
  const fn = templates[name];
  if (!fn) {
    const err = new Error(`Unknown template: ${name}. Known: ${TEMPLATE_NAMES.join(', ')}`);
    err.status = 400;
    throw err;
  }
  return fn(vars);
}
