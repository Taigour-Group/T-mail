// ─────────────────────────────────────────────────────────────────────────────
// Starter template catalog — 50+ modern, responsive, email-safe HTML templates.
//
// Real email clients (Gmail, Outlook, Apple Mail) strip <style> blocks, flexbox
// and grid, so every template is built from table-based sections with *inline*
// styles only. Rather than hand-write 50 near-identical HTML docs, templates are
// composed from a handful of section builders (button, heading, text, code box,
// divider, etc.) wrapped in one shared shell. This keeps the design consistent
// and the file maintainable while still producing standalone, paste-ready HTML.
//
// Each catalog entry: { slug, name, category, description, subject, accent,
// vars, text, html }.  `vars` documents the {{placeholders}} the backend fills.
// ─────────────────────────────────────────────────────────────────────────────

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const INK = '#0f172a';
const MUTE = '#64748b';
const LINE = '#e2e8f0';
const BG = '#f1f5f9';

// ── Section builders ─────────────────────────────────────────────────────────
const esc = (s) => String(s);

function shell({ accent, brand, preheader, blocks, footerNote }) {
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"></head>
<body style="margin:0;padding:0;background:${BG};font-family:${FONT};-webkit-font-smoothing:antialiased;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader || '')}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG};padding:32px 12px;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid ${LINE};box-shadow:0 1px 3px rgba(15,23,42,0.06);">
<tr><td style="height:6px;background:${accent};font-size:0;line-height:0;">&nbsp;</td></tr>
<tr><td style="padding:32px 40px 8px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td style="font-size:18px;font-weight:700;letter-spacing:-0.3px;color:${INK};">${esc(brand || '{{app}}')}</td>
</tr></table>
</td></tr>
<tr><td style="padding:8px 40px 36px;">
${blocks.join('\n')}
</td></tr>
</table>
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
<tr><td style="padding:20px 40px;text-align:center;color:${MUTE};font-size:12px;line-height:18px;">
${esc(footerNote || 'You received this email because you have an account with {{app}}.')}<br>
<span style="color:#94a3b8;">© {{app}} · {{company_address}}</span>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

const h1 = (t) => `<h1 style="margin:20px 0 0;font-size:24px;line-height:32px;font-weight:700;letter-spacing:-0.4px;color:${INK};">${esc(t)}</h1>`;
const h2 = (t) => `<h2 style="margin:20px 0 0;font-size:18px;line-height:26px;font-weight:600;color:${INK};">${esc(t)}</h2>`;
const p = (t) => `<p style="margin:14px 0 0;font-size:15px;line-height:24px;color:#334155;">${esc(t)}</p>`;
const small = (t) => `<p style="margin:14px 0 0;font-size:13px;line-height:20px;color:${MUTE};">${esc(t)}</p>`;

function button(accent, label, href) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:26px 0 6px;"><tr>
<td style="border-radius:10px;background:${accent};">
<a href="${esc(href)}" style="display:inline-block;padding:13px 30px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px;">${esc(label)}</a>
</td></tr></table>`;
}

function codeBox(accent, code) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0 6px;"><tr>
<td align="center" style="border:1px dashed ${accent};border-radius:12px;background:#f8fafc;padding:22px;">
<div style="font-family:'SFMono-Regular',Menlo,Consolas,monospace;font-size:34px;font-weight:700;letter-spacing:10px;color:${INK};">${esc(code)}</div>
</td></tr></table>`;
}

function divider() {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:26px 0 0;"><div style="height:1px;background:${LINE};font-size:0;line-height:0;">&nbsp;</div></td></tr></table>`;
}

function detailRows(rows) {
  const body = rows.map(([k, v]) => `<tr>
<td style="padding:9px 0;font-size:14px;color:${MUTE};border-bottom:1px solid ${LINE};">${esc(k)}</td>
<td style="padding:9px 0;font-size:14px;font-weight:600;color:${INK};text-align:right;border-bottom:1px solid ${LINE};">${esc(v)}</td>
</tr>`).join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:22px 0 0;">${body}</table>`;
}

function infoCard(accent, title, text) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:22px 0 0;"><tr>
<td style="background:#f8fafc;border:1px solid ${LINE};border-left:4px solid ${accent};border-radius:10px;padding:16px 18px;">
<div style="font-size:14px;font-weight:600;color:${INK};">${esc(title)}</div>
<div style="margin-top:4px;font-size:14px;line-height:21px;color:#475569;">${esc(text)}</div>
</td></tr></table>`;
}

function bullets(items) {
  const li = items.map((i) => `<tr><td style="padding:6px 0;font-size:15px;line-height:22px;color:#334155;">•&nbsp;&nbsp;${esc(i)}</td></tr>`).join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:14px 0 0;">${li}</table>`;
}

// Compose a template from an ordered list of blocks + metadata.
function make({ slug, name, category, description, accent, subject, brand, preheader, vars, text, footerNote, blocks }) {
  return {
    slug,
    name,
    category,
    description,
    accent,
    subject,
    vars,
    text,
    html: shell({ accent, brand, preheader, footerNote, blocks }),
  };
}

// ── Palette per category (keeps the gallery visually varied) ─────────────────
const A = {
  security: '#2563eb',
  onboarding: '#7c3aed',
  transactional: '#0891b2',
  ecommerce: '#059669',
  billing: '#0d9488',
  marketing: '#db2777',
  engagement: '#ea580c',
  team: '#4f46e5',
  system: '#475569',
  event: '#c026d3',
};

// ─────────────────────────────────────────────────────────────────────────────
// The catalog
// ─────────────────────────────────────────────────────────────────────────────
export const TEMPLATE_CATALOG = [
  // ── Security & authentication ──────────────────────────────────────────────
  make({
    slug: 'otp-verification', name: 'One-time passcode', category: 'security', accent: A.security,
    description: 'Numeric verification code with expiry, for sign-in and 2FA.',
    subject: 'Your {{app}} verification code is {{code}}',
    preheader: 'Your code expires in 10 minutes.',
    vars: ['app', 'code', 'name'],
    text: 'Hi {{name}}, your {{app}} verification code is {{code}}. It expires in 10 minutes. If you did not request this, ignore this email.',
    blocks: [h1('Verify your sign-in'), p('Hi {{name}}, use this code to finish signing in to {{app}}.'), codeBox(A.security, '{{code}}'), small('This code expires in 10 minutes. If you didn’t request it, you can safely ignore this email.')],
  }),
  make({
    slug: 'magic-link', name: 'Magic sign-in link', category: 'security', accent: A.security,
    description: 'Passwordless one-click sign-in button.',
    subject: 'Your sign-in link for {{app}}',
    preheader: 'Click to sign in — no password needed.',
    vars: ['app', 'name', 'link'],
    text: 'Hi {{name}}, sign in to {{app}} with this link: {{link}} (expires in 15 minutes).',
    blocks: [h1('Sign in to {{app}}'), p('Hi {{name}}, click the button below to sign in. No password required.'), button(A.security, 'Sign in', '{{link}}'), small('This link expires in 15 minutes and can only be used once.')],
  }),
  make({
    slug: 'password-reset', name: 'Password reset', category: 'security', accent: A.security,
    description: 'Reset-password button with a security note.',
    subject: 'Reset your {{app}} password',
    preheader: 'Reset your password with the button inside.',
    vars: ['app', 'name', 'link'],
    text: 'Hi {{name}}, reset your {{app}} password here: {{link}}. If you didn’t request this, ignore it.',
    blocks: [h1('Reset your password'), p('Hi {{name}}, we received a request to reset the password for your {{app}} account.'), button(A.security, 'Choose a new password', '{{link}}'), small('If you didn’t ask to reset your password, no action is needed — your password stays the same.')],
  }),
  make({
    slug: 'password-changed', name: 'Password changed', category: 'security', accent: A.security,
    description: 'Confirmation that the account password was updated.',
    subject: 'Your {{app}} password was changed',
    preheader: 'This is a confirmation that your password changed.',
    vars: ['app', 'name', 'support_email'],
    text: 'Hi {{name}}, your {{app}} password was just changed. If this wasn’t you, contact {{support_email}} immediately.',
    blocks: [h1('Your password was changed'), p('Hi {{name}}, this confirms the password for your {{app}} account was just updated.'), infoCard(A.security, 'Didn’t make this change?', 'Contact us right away at {{support_email}} so we can secure your account.')],
  }),
  make({
    slug: 'new-device-login', name: 'New device sign-in', category: 'security', accent: A.security,
    description: 'Security alert when a new device signs in.',
    subject: 'New sign-in to your {{app}} account',
    preheader: 'A new device just signed in.',
    vars: ['app', 'name', 'device', 'location', 'time', 'link'],
    text: 'Hi {{name}}, a new sign-in to {{app}} was detected: {{device}} in {{location}} at {{time}}. If this wasn’t you, secure your account: {{link}}',
    blocks: [h1('New sign-in detected'), p('Hi {{name}}, your {{app}} account was just accessed from a new device.'), detailRows([['Device', '{{device}}'], ['Location', '{{location}}'], ['Time', '{{time}}']]), button(A.security, 'This wasn’t me', '{{link}}'), small('If this was you, no action is needed.')],
  }),
  make({
    slug: 'email-verify', name: 'Confirm email address', category: 'security', accent: A.security,
    description: 'Double opt-in email confirmation.',
    subject: 'Confirm your email for {{app}}',
    preheader: 'One click to confirm your address.',
    vars: ['app', 'name', 'link'],
    text: 'Hi {{name}}, confirm your email for {{app}}: {{link}}',
    blocks: [h1('Confirm your email'), p('Hi {{name}}, please confirm this is your email address so we can secure your {{app}} account.'), button(A.security, 'Confirm email', '{{link}}'), small('If you didn’t create a {{app}} account, you can ignore this email.')],
  }),
  make({
    slug: 'two-factor-enabled', name: 'Two-factor enabled', category: 'security', accent: A.security,
    description: 'Confirms 2FA was turned on.',
    subject: 'Two-factor authentication is on',
    preheader: 'Your account is now more secure.',
    vars: ['app', 'name'],
    text: 'Hi {{name}}, two-factor authentication is now enabled on your {{app}} account.',
    blocks: [h1('Two-factor authentication is on'), p('Hi {{name}}, you’ve added an extra layer of security to your {{app}} account. You’ll now enter a code from your authenticator app when signing in.'), infoCard(A.security, 'Save your backup codes', 'Keep them somewhere safe in case you lose access to your device.')],
  }),
  make({
    slug: 'suspicious-activity', name: 'Suspicious activity', category: 'security', accent: A.security,
    description: 'Alert for unusual account activity.',
    subject: 'Unusual activity on your {{app}} account',
    preheader: 'We paused some activity to keep you safe.',
    vars: ['app', 'name', 'link'],
    text: 'Hi {{name}}, we noticed unusual activity on your {{app}} account and temporarily limited it. Review here: {{link}}',
    blocks: [h1('We spotted something unusual'), p('Hi {{name}}, to protect your {{app}} account we’ve temporarily limited some activity while you confirm it was you.'), button(A.security, 'Review activity', '{{link}}')],
  }),

  // ── Onboarding ───────────────────────────────────────────────────────────
  make({
    slug: 'welcome', name: 'Welcome', category: 'onboarding', accent: A.onboarding,
    description: 'Warm welcome with a get-started button.',
    subject: 'Welcome to {{app}}, {{name}}!',
    preheader: 'We’re glad you’re here. Here’s how to start.',
    vars: ['app', 'name', 'link'],
    text: 'Welcome to {{app}}, {{name}}! Get started here: {{link}}',
    blocks: [h1('Welcome to {{app}} 👋'), p('Hi {{name}}, we’re thrilled to have you. Let’s get your account set up in just a couple of minutes.'), button(A.onboarding, 'Get started', '{{link}}'), divider(), h2('What you can do first'), bullets(['Complete your profile', 'Invite a teammate', 'Explore the dashboard'])],
  }),
  make({
    slug: 'getting-started', name: 'Getting started guide', category: 'onboarding', accent: A.onboarding,
    description: 'Step checklist to activate new users.',
    subject: 'Your first steps with {{app}}',
    preheader: 'Three quick steps to get value fast.',
    vars: ['app', 'name', 'link'],
    text: 'Hi {{name}}, here are three steps to get started with {{app}}: {{link}}',
    blocks: [h1('Let’s get you set up'), p('Hi {{name}}, follow these steps and you’ll be up and running with {{app}} in no time.'), bullets(['1. Set up your workspace', '2. Connect your data', '3. Invite your team']), button(A.onboarding, 'Open my checklist', '{{link}}')],
  }),
  make({
    slug: 'verify-then-welcome', name: 'Account activated', category: 'onboarding', accent: A.onboarding,
    description: 'Confirms activation and points to the dashboard.',
    subject: 'Your {{app}} account is active',
    preheader: 'You’re all set — jump in.',
    vars: ['app', 'name', 'link'],
    text: 'Hi {{name}}, your {{app}} account is now active. Open your dashboard: {{link}}',
    blocks: [h1('You’re all set!'), p('Hi {{name}}, your email is confirmed and your {{app}} account is fully active.'), button(A.onboarding, 'Go to dashboard', '{{link}}')],
  }),
  make({
    slug: 'complete-profile', name: 'Complete your profile', category: 'onboarding', accent: A.onboarding,
    description: 'Nudge to finish profile setup.',
    subject: 'Finish setting up your profile',
    preheader: 'You’re almost there.',
    vars: ['app', 'name', 'link'],
    text: 'Hi {{name}}, your {{app}} profile is almost complete. Finish it here: {{link}}',
    blocks: [h1('You’re almost there'), p('Hi {{name}}, add a few more details so {{app}} works better for you.'), button(A.onboarding, 'Complete profile', '{{link}}')],
  }),
  make({
    slug: 'invite-teammate', name: 'Team invitation', category: 'team', accent: A.team,
    description: 'Invite to join a workspace/team.',
    subject: '{{inviter}} invited you to {{app}}',
    preheader: 'Join your team’s workspace.',
    vars: ['app', 'inviter', 'team', 'link'],
    text: '{{inviter}} invited you to join {{team}} on {{app}}. Accept: {{link}}',
    blocks: [h1('You’ve been invited'), p('{{inviter}} has invited you to join {{team}} on {{app}}.'), button(A.team, 'Accept invitation', '{{link}}'), small('This invitation will expire in 7 days.')],
  }),
  make({
    slug: 'trial-started', name: 'Free trial started', category: 'onboarding', accent: A.onboarding,
    description: 'Confirms a trial has begun with the end date.',
    subject: 'Your {{app}} free trial has started',
    preheader: 'Enjoy full access until {{trial_end}}.',
    vars: ['app', 'name', 'trial_end', 'link'],
    text: 'Hi {{name}}, your {{app}} free trial is active until {{trial_end}}. Explore: {{link}}',
    blocks: [h1('Your free trial is live'), p('Hi {{name}}, you now have full access to {{app}} until {{trial_end}}. No credit card needed.'), button(A.onboarding, 'Start exploring', '{{link}}')],
  }),

  // ── Transactional / notifications ──────────────────────────────────────────
  make({
    slug: 'generic-notification', name: 'General notification', category: 'transactional', accent: A.transactional,
    description: 'Flexible notification with a title, body, and action.',
    subject: '{{title}}',
    preheader: '{{preview}}',
    vars: ['app', 'name', 'title', 'body', 'link', 'cta'],
    text: 'Hi {{name}}, {{body}} — {{link}}',
    blocks: [h1('{{title}}'), p('Hi {{name}}, {{body}}'), button(A.transactional, '{{cta}}', '{{link}}')],
  }),
  make({
    slug: 'comment-mention', name: 'You were mentioned', category: 'engagement', accent: A.engagement,
    description: 'Notify a user they were @mentioned.',
    subject: '{{author}} mentioned you in {{context}}',
    preheader: '{{author}}: {{excerpt}}',
    vars: ['app', 'name', 'author', 'context', 'excerpt', 'link'],
    text: '{{author}} mentioned you in {{context}}: "{{excerpt}}" — {{link}}',
    blocks: [h1('{{author}} mentioned you'), p('In {{context}}:'), infoCard(A.engagement, '{{author}}', '{{excerpt}}'), button(A.engagement, 'View & reply', '{{link}}')],
  }),
  make({
    slug: 'assigned-task', name: 'Task assigned', category: 'team', accent: A.team,
    description: 'Notify a user a task was assigned to them.',
    subject: '{{assigner}} assigned you: {{task}}',
    preheader: 'Due {{due_date}}.',
    vars: ['app', 'name', 'assigner', 'task', 'due_date', 'link'],
    text: '{{assigner}} assigned you "{{task}}", due {{due_date}}: {{link}}',
    blocks: [h1('New task for you'), p('{{assigner}} assigned you a task on {{app}}.'), detailRows([['Task', '{{task}}'], ['Due', '{{due_date}}']]), button(A.team, 'Open task', '{{link}}')],
  }),
  make({
    slug: 'weekly-digest', name: 'Weekly digest', category: 'engagement', accent: A.engagement,
    description: 'Roundup of the week’s activity.',
    subject: 'Your week on {{app}}',
    preheader: 'Here’s what happened this week.',
    vars: ['app', 'name', 'stat_one', 'stat_two', 'stat_three', 'link'],
    text: 'Hi {{name}}, your weekly {{app}} summary: {{stat_one}}, {{stat_two}}, {{stat_three}}. {{link}}',
    blocks: [h1('Your week in review'), p('Hi {{name}}, here’s a snapshot of your activity on {{app}} this week.'), detailRows([['Highlight', '{{stat_one}}'], ['Also', '{{stat_two}}'], ['And', '{{stat_three}}']]), button(A.engagement, 'See full report', '{{link}}')],
  }),
  make({
    slug: 'reminder', name: 'Reminder', category: 'transactional', accent: A.transactional,
    description: 'Gentle reminder about a pending action.',
    subject: 'Reminder: {{subject_line}}',
    preheader: 'Just a quick nudge.',
    vars: ['app', 'name', 'subject_line', 'body', 'link', 'cta'],
    text: 'Hi {{name}}, reminder: {{body}} — {{link}}',
    blocks: [h1('Just a reminder'), p('Hi {{name}}, {{body}}'), button(A.transactional, '{{cta}}', '{{link}}')],
  }),
  make({
    slug: 'approval-request', name: 'Approval requested', category: 'team', accent: A.team,
    description: 'Ask a reviewer to approve or reject.',
    subject: '{{requester}} needs your approval',
    preheader: '{{item}} is waiting for review.',
    vars: ['app', 'requester', 'item', 'link'],
    text: '{{requester}} requested your approval for {{item}}: {{link}}',
    blocks: [h1('Approval needed'), p('{{requester}} has requested your approval on {{app}}.'), infoCard(A.team, 'Awaiting review', '{{item}}'), button(A.team, 'Review request', '{{link}}')],
  }),
  make({
    slug: 'export-ready', name: 'Export ready', category: 'system', accent: A.system,
    description: 'Notify that a data export/download is ready.',
    subject: 'Your export is ready to download',
    preheader: 'Your file is ready.',
    vars: ['app', 'name', 'link', 'expiry'],
    text: 'Hi {{name}}, your export is ready: {{link}} (available until {{expiry}}).',
    blocks: [h1('Your export is ready'), p('Hi {{name}}, the file you requested from {{app}} has finished processing.'), button(A.system, 'Download file', '{{link}}'), small('This download link is available until {{expiry}}.')],
  }),

  // ── E-commerce ─────────────────────────────────────────────────────────────
  make({
    slug: 'order-confirmation', name: 'Order confirmation', category: 'ecommerce', accent: A.ecommerce,
    description: 'Confirms an order with items and total.',
    subject: 'Order {{order_number}} confirmed',
    preheader: 'Thanks for your order!',
    vars: ['app', 'name', 'order_number', 'item', 'total', 'link'],
    text: 'Hi {{name}}, your order {{order_number}} is confirmed. Total: {{total}}. Track: {{link}}',
    blocks: [h1('Thanks for your order!'), p('Hi {{name}}, we’re getting order {{order_number}} ready. Here’s a summary.'), detailRows([['Item', '{{item}}'], ['Order number', '{{order_number}}'], ['Total', '{{total}}']]), button(A.ecommerce, 'Track order', '{{link}}')],
  }),
  make({
    slug: 'shipping-confirmation', name: 'Order shipped', category: 'ecommerce', accent: A.ecommerce,
    description: 'Shipping notice with tracking.',
    subject: 'Your order {{order_number}} has shipped',
    preheader: 'It’s on the way.',
    vars: ['app', 'name', 'order_number', 'carrier', 'tracking', 'eta', 'link'],
    text: 'Hi {{name}}, order {{order_number}} shipped via {{carrier}}. Tracking {{tracking}}, arriving {{eta}}. {{link}}',
    blocks: [h1('Your order is on its way 🚚'), p('Hi {{name}}, good news — order {{order_number}} has shipped.'), detailRows([['Carrier', '{{carrier}}'], ['Tracking', '{{tracking}}'], ['Arriving', '{{eta}}']]), button(A.ecommerce, 'Track package', '{{link}}')],
  }),
  make({
    slug: 'delivery-confirmation', name: 'Order delivered', category: 'ecommerce', accent: A.ecommerce,
    description: 'Confirms delivery and asks for a review.',
    subject: 'Your order was delivered',
    preheader: 'How did we do?',
    vars: ['app', 'name', 'order_number', 'link'],
    text: 'Hi {{name}}, order {{order_number}} was delivered. Leave a review: {{link}}',
    blocks: [h1('Delivered!'), p('Hi {{name}}, order {{order_number}} has been delivered. We’d love to hear what you think.'), button(A.ecommerce, 'Leave a review', '{{link}}')],
  }),
  make({
    slug: 'abandoned-cart', name: 'Abandoned cart', category: 'ecommerce', accent: A.ecommerce,
    description: 'Recover a cart left behind.',
    subject: 'You left something behind',
    preheader: 'Your cart is waiting.',
    vars: ['app', 'name', 'item', 'link'],
    text: 'Hi {{name}}, you left {{item}} in your cart. Complete your order: {{link}}',
    blocks: [h1('Still thinking it over?'), p('Hi {{name}}, you left {{item}} in your cart. We saved it for you.'), button(A.ecommerce, 'Complete my order', '{{link}}'), small('Items in your cart aren’t reserved and may sell out.')],
  }),
  make({
    slug: 'back-in-stock', name: 'Back in stock', category: 'ecommerce', accent: A.ecommerce,
    description: 'Notify a shopper an item is available again.',
    subject: '{{item}} is back in stock',
    preheader: 'Grab it before it’s gone.',
    vars: ['app', 'name', 'item', 'link'],
    text: 'Hi {{name}}, {{item}} is back in stock: {{link}}',
    blocks: [h1('It’s back!'), p('Hi {{name}}, {{item}} is back in stock — and it tends to go fast.'), button(A.ecommerce, 'Shop now', '{{link}}')],
  }),
  make({
    slug: 'review-request', name: 'Review request', category: 'ecommerce', accent: A.ecommerce,
    description: 'Ask a customer to review a recent purchase.',
    subject: 'How was {{item}}?',
    preheader: 'Share your thoughts in 30 seconds.',
    vars: ['app', 'name', 'item', 'link'],
    text: 'Hi {{name}}, how was {{item}}? Leave a quick review: {{link}}',
    blocks: [h1('How did we do?'), p('Hi {{name}}, you recently got {{item}}. A quick review helps other shoppers and helps us improve.'), button(A.ecommerce, 'Rate your purchase', '{{link}}')],
  }),

  // ── Billing & subscriptions ──────────────────────────────────────────────
  make({
    slug: 'receipt', name: 'Payment receipt', category: 'billing', accent: A.billing,
    description: 'Itemized payment receipt.',
    subject: 'Your receipt from {{app}}',
    preheader: 'Payment received — thank you.',
    vars: ['app', 'name', 'amount', 'plan', 'date', 'invoice_number', 'link'],
    text: 'Hi {{name}}, we received {{amount}} for {{plan}} on {{date}}. Invoice {{invoice_number}}: {{link}}',
    blocks: [h1('Payment received'), p('Hi {{name}}, thanks for your payment. Here’s your receipt.'), detailRows([['Plan', '{{plan}}'], ['Amount', '{{amount}}'], ['Date', '{{date}}'], ['Invoice', '{{invoice_number}}']]), button(A.billing, 'View invoice', '{{link}}')],
  }),
  make({
    slug: 'invoice-due', name: 'Invoice due', category: 'billing', accent: A.billing,
    description: 'Upcoming invoice reminder.',
    subject: 'Invoice {{invoice_number}} is due {{due_date}}',
    preheader: 'A quick heads-up on your upcoming payment.',
    vars: ['app', 'name', 'invoice_number', 'amount', 'due_date', 'link'],
    text: 'Hi {{name}}, invoice {{invoice_number}} for {{amount}} is due {{due_date}}: {{link}}',
    blocks: [h1('Your invoice is due soon'), p('Hi {{name}}, a friendly reminder about your upcoming payment.'), detailRows([['Invoice', '{{invoice_number}}'], ['Amount', '{{amount}}'], ['Due', '{{due_date}}']]), button(A.billing, 'Pay now', '{{link}}')],
  }),
  make({
    slug: 'payment-failed', name: 'Payment failed', category: 'billing', accent: A.billing,
    description: 'Dunning email for a failed charge.',
    subject: 'We couldn’t process your payment',
    preheader: 'Please update your payment method.',
    vars: ['app', 'name', 'amount', 'link'],
    text: 'Hi {{name}}, we couldn’t process your {{amount}} payment. Update your payment method: {{link}}',
    blocks: [h1('Payment didn’t go through'), p('Hi {{name}}, we tried to charge {{amount}} but the payment failed. Please update your payment method to avoid any interruption.'), button(A.billing, 'Update payment method', '{{link}}')],
  }),
  make({
    slug: 'subscription-renewed', name: 'Subscription renewed', category: 'billing', accent: A.billing,
    description: 'Confirms a successful renewal.',
    subject: 'Your {{plan}} plan has renewed',
    preheader: 'You’re all set for another cycle.',
    vars: ['app', 'name', 'plan', 'amount', 'next_date', 'link'],
    text: 'Hi {{name}}, your {{plan}} plan renewed for {{amount}}. Next renewal: {{next_date}}. {{link}}',
    blocks: [h1('Your plan renewed'), p('Hi {{name}}, your subscription has renewed successfully.'), detailRows([['Plan', '{{plan}}'], ['Amount', '{{amount}}'], ['Next renewal', '{{next_date}}']]), button(A.billing, 'Manage subscription', '{{link}}')],
  }),
  make({
    slug: 'trial-ending', name: 'Trial ending soon', category: 'billing', accent: A.billing,
    description: 'Warn that a trial is about to end.',
    subject: 'Your trial ends in {{days}} days',
    preheader: 'Keep your access — upgrade anytime.',
    vars: ['app', 'name', 'days', 'trial_end', 'link'],
    text: 'Hi {{name}}, your {{app}} trial ends in {{days}} days ({{trial_end}}). Upgrade to keep access: {{link}}',
    blocks: [h1('Your trial ends soon'), p('Hi {{name}}, your free trial of {{app}} ends on {{trial_end}} — that’s {{days}} days away. Upgrade now to keep everything you’ve set up.'), button(A.billing, 'Choose a plan', '{{link}}')],
  }),
  make({
    slug: 'subscription-cancelled', name: 'Subscription cancelled', category: 'billing', accent: A.billing,
    description: 'Confirms cancellation and access-until date.',
    subject: 'Your {{app}} subscription is cancelled',
    preheader: 'You have access until {{end_date}}.',
    vars: ['app', 'name', 'end_date', 'link'],
    text: 'Hi {{name}}, your {{app}} subscription is cancelled. You keep access until {{end_date}}. Reactivate anytime: {{link}}',
    blocks: [h1('Sorry to see you go'), p('Hi {{name}}, your subscription has been cancelled. You’ll keep full access until {{end_date}}.'), button(A.billing, 'Reactivate', '{{link}}'), small('Changed your mind? You can reactivate anytime before {{end_date}}.')],
  }),
  make({
    slug: 'upgrade-confirmation', name: 'Plan upgraded', category: 'billing', accent: A.billing,
    description: 'Confirms an upgrade to a higher plan.',
    subject: 'Welcome to {{plan}}',
    preheader: 'Your new features are live.',
    vars: ['app', 'name', 'plan', 'link'],
    text: 'Hi {{name}}, you’ve upgraded to {{plan}}. Explore your new features: {{link}}',
    blocks: [h1('You’re on {{plan}} now'), p('Hi {{name}}, thanks for upgrading. Your new features are ready to use.'), button(A.billing, 'Explore new features', '{{link}}')],
  }),

  // ── Marketing & lifecycle ──────────────────────────────────────────────────
  make({
    slug: 'newsletter', name: 'Newsletter', category: 'marketing', accent: A.marketing,
    description: 'Simple, clean newsletter layout.',
    subject: '{{headline}}',
    preheader: '{{preview}}',
    vars: ['app', 'headline', 'story_one', 'story_two', 'link'],
    text: '{{headline}} — {{story_one}} / {{story_two}} — read more: {{link}}',
    blocks: [h1('{{headline}}'), p('{{story_one}}'), divider(), h2('Also this week'), p('{{story_two}}'), button(A.marketing, 'Read more', '{{link}}')],
  }),
  make({
    slug: 'product-announcement', name: 'Product announcement', category: 'marketing', accent: A.marketing,
    description: 'Announce a new feature or product.',
    subject: 'Introducing {{feature}}',
    preheader: 'Something new just landed.',
    vars: ['app', 'name', 'feature', 'body', 'link'],
    text: 'Hi {{name}}, meet {{feature}}: {{body}} — {{link}}',
    blocks: [h1('Introducing {{feature}}'), p('Hi {{name}}, {{body}}'), button(A.marketing, 'Try it now', '{{link}}')],
  }),
  make({
    slug: 'promo-offer', name: 'Promotional offer', category: 'marketing', accent: A.marketing,
    description: 'Discount / limited-time offer.',
    subject: '{{discount}} off — today only',
    preheader: 'A limited-time offer just for you.',
    vars: ['app', 'name', 'discount', 'code', 'expiry', 'link'],
    text: 'Hi {{name}}, save {{discount}} with code {{code}} until {{expiry}}: {{link}}',
    blocks: [h1('{{discount}} off, just for you'), p('Hi {{name}}, use this code at checkout before {{expiry}}.'), codeBox(A.marketing, '{{code}}'), button(A.marketing, 'Shop the sale', '{{link}}')],
  }),
  make({
    slug: 'event-invite', name: 'Event invitation', category: 'event', accent: A.event,
    description: 'Invite to a webinar or event.',
    subject: 'You’re invited: {{event_name}}',
    preheader: '{{date}} · {{time}}',
    vars: ['app', 'name', 'event_name', 'date', 'time', 'link'],
    text: 'Hi {{name}}, join us for {{event_name}} on {{date}} at {{time}}. Register: {{link}}',
    blocks: [h1('You’re invited'), p('Hi {{name}}, we’d love for you to join {{event_name}}.'), detailRows([['Event', '{{event_name}}'], ['Date', '{{date}}'], ['Time', '{{time}}']]), button(A.event, 'Register now', '{{link}}')],
  }),
  make({
    slug: 'event-reminder', name: 'Event reminder', category: 'event', accent: A.event,
    description: 'Reminder shortly before an event.',
    subject: '{{event_name}} starts {{when}}',
    preheader: 'Don’t miss it.',
    vars: ['app', 'name', 'event_name', 'when', 'link'],
    text: 'Hi {{name}}, {{event_name}} starts {{when}}. Join: {{link}}',
    blocks: [h1('Starting {{when}}'), p('Hi {{name}}, this is a reminder that {{event_name}} is about to begin.'), button(A.event, 'Join now', '{{link}}')],
  }),
  make({
    slug: 'feedback-survey', name: 'Feedback survey', category: 'engagement', accent: A.engagement,
    description: 'Ask users for feedback via a survey.',
    subject: 'Got 2 minutes? We’d love your feedback',
    preheader: 'Help us make {{app}} better.',
    vars: ['app', 'name', 'link'],
    text: 'Hi {{name}}, we’d love your feedback on {{app}}. Quick survey: {{link}}',
    blocks: [h1('We’d love your feedback'), p('Hi {{name}}, you’ve been using {{app}} for a bit now. A couple of minutes of your time would really help us improve.'), button(A.engagement, 'Take the survey', '{{link}}')],
  }),
  make({
    slug: 'referral-invite', name: 'Referral invite', category: 'marketing', accent: A.marketing,
    description: 'Encourage users to refer friends.',
    subject: 'Give {{reward}}, get {{reward}}',
    preheader: 'Share {{app}} with a friend.',
    vars: ['app', 'name', 'reward', 'link'],
    text: 'Hi {{name}}, refer a friend to {{app}} and you both get {{reward}}: {{link}}',
    blocks: [h1('Share {{app}}, get {{reward}}'), p('Hi {{name}}, when a friend joins {{app}} through your link, you both get {{reward}}.'), button(A.marketing, 'Get my referral link', '{{link}}')],
  }),
  make({
    slug: 're-engagement', name: 'We miss you', category: 'engagement', accent: A.engagement,
    description: 'Win back inactive users.',
    subject: 'We miss you, {{name}}',
    preheader: 'Here’s what’s new since you’ve been gone.',
    vars: ['app', 'name', 'link'],
    text: 'Hi {{name}}, it’s been a while! Here’s what’s new on {{app}}: {{link}}',
    blocks: [h1('We miss you'), p('Hi {{name}}, it’s been a while since we last saw you on {{app}}. A lot has changed — come see what’s new.'), button(A.engagement, 'See what’s new', '{{link}}')],
  }),

  // ── System & account ───────────────────────────────────────────────────────
  make({
    slug: 'maintenance-notice', name: 'Scheduled maintenance', category: 'system', accent: A.system,
    description: 'Warn of upcoming scheduled downtime.',
    subject: 'Scheduled maintenance on {{date}}',
    preheader: '{{app}} will be briefly unavailable.',
    vars: ['app', 'date', 'window', 'link'],
    text: '{{app}} will be down for maintenance on {{date}} during {{window}}. Details: {{link}}',
    blocks: [h1('Scheduled maintenance'), p('We’ll be performing scheduled maintenance to improve {{app}}. During this time the service may be briefly unavailable.'), detailRows([['Date', '{{date}}'], ['Window', '{{window}}']]), small('We’ve chosen a low-traffic window to keep disruption minimal.')],
  }),
  make({
    slug: 'incident-update', name: 'Service incident update', category: 'system', accent: A.system,
    description: 'Status update during an outage.',
    subject: 'Service update: {{status}}',
    preheader: 'An update on the current incident.',
    vars: ['app', 'status', 'body', 'link'],
    text: '{{app}} status: {{status}}. {{body}} — {{link}}',
    blocks: [h1('Service update'), infoCard(A.system, 'Current status: {{status}}', '{{body}}'), button(A.system, 'View status page', '{{link}}')],
  }),
  make({
    slug: 'account-deleted', name: 'Account deleted', category: 'system', accent: A.system,
    description: 'Confirms account deletion.',
    subject: 'Your {{app}} account has been deleted',
    preheader: 'Confirmation of account deletion.',
    vars: ['app', 'name', 'support_email'],
    text: 'Hi {{name}}, your {{app}} account and data have been deleted. Questions? {{support_email}}',
    blocks: [h1('Your account has been deleted'), p('Hi {{name}}, as requested, your {{app}} account and associated data have been permanently deleted.'), small('If you didn’t request this, contact us immediately at {{support_email}}.')],
  }),
  make({
    slug: 'data-request-ready', name: 'Data request ready', category: 'system', accent: A.system,
    description: 'GDPR/data-export download is ready.',
    subject: 'Your data is ready to download',
    preheader: 'Your data export is available.',
    vars: ['app', 'name', 'link', 'expiry'],
    text: 'Hi {{name}}, your {{app}} data export is ready: {{link}} (until {{expiry}}).',
    blocks: [h1('Your data is ready'), p('Hi {{name}}, we’ve prepared the copy of your {{app}} data you requested.'), button(A.system, 'Download my data', '{{link}}'), small('For your security, this link expires on {{expiry}}.')],
  }),
  make({
    slug: 'terms-update', name: 'Terms update', category: 'system', accent: A.system,
    description: 'Notify users of policy/terms changes.',
    subject: 'We’re updating our terms',
    preheader: 'A summary of what’s changing.',
    vars: ['app', 'name', 'effective_date', 'link'],
    text: 'Hi {{name}}, we’re updating the {{app}} terms, effective {{effective_date}}. Review: {{link}}',
    blocks: [h1('We’re updating our terms'), p('Hi {{name}}, we’re making some changes to our Terms of Service, effective {{effective_date}}. By continuing to use {{app}}, you agree to the updated terms.'), button(A.system, 'Read the changes', '{{link}}')],
  }),

  // ── Team & collaboration ───────────────────────────────────────────────────
  make({
    slug: 'role-changed', name: 'Role changed', category: 'team', accent: A.team,
    description: 'Notify a member their role changed.',
    subject: 'Your role in {{team}} changed',
    preheader: 'You’re now a {{role}}.',
    vars: ['app', 'name', 'team', 'role', 'link'],
    text: 'Hi {{name}}, your role in {{team}} is now {{role}}: {{link}}',
    blocks: [h1('Your role was updated'), p('Hi {{name}}, your role in {{team}} on {{app}} is now {{role}}.'), button(A.team, 'View workspace', '{{link}}')],
  }),
  make({
    slug: 'invite-accepted', name: 'Invite accepted', category: 'team', accent: A.team,
    description: 'Tell the inviter their invite was accepted.',
    subject: '{{member}} joined {{team}}',
    preheader: 'Your team is growing.',
    vars: ['app', 'member', 'team', 'link'],
    text: '{{member}} accepted your invite and joined {{team}}: {{link}}',
    blocks: [h1('{{member}} joined the team'), p('Good news — {{member}} accepted your invitation and is now part of {{team}} on {{app}}.'), button(A.team, 'View team', '{{link}}')],
  }),
  make({
    slug: 'shared-with-you', name: 'Shared with you', category: 'team', accent: A.team,
    description: 'Notify a user something was shared with them.',
    subject: '{{sharer}} shared {{item}} with you',
    preheader: 'You now have access.',
    vars: ['app', 'name', 'sharer', 'item', 'link'],
    text: '{{sharer}} shared {{item}} with you on {{app}}: {{link}}',
    blocks: [h1('Something was shared with you'), p('Hi {{name}}, {{sharer}} shared {{item}} with you on {{app}}.'), button(A.team, 'Open', '{{link}}')],
  }),
  make({
    slug: 'mention-daily', name: 'Daily activity summary', category: 'team', accent: A.team,
    description: 'Daily summary of team activity.',
    subject: 'Your daily summary from {{team}}',
    preheader: 'What happened today.',
    vars: ['app', 'name', 'team', 'item_one', 'item_two', 'link'],
    text: 'Hi {{name}}, today in {{team}}: {{item_one}}; {{item_two}}. {{link}}',
    blocks: [h1('Today in {{team}}'), p('Hi {{name}}, here’s what happened while you were away.'), bullets(['{{item_one}}', '{{item_two}}']), button(A.team, 'Open workspace', '{{link}}')],
  }),

  // ── Support ────────────────────────────────────────────────────────────────
  make({
    slug: 'ticket-received', name: 'Support ticket received', category: 'transactional', accent: A.transactional,
    description: 'Acknowledge a support request.',
    subject: 'We got your request ({{ticket_number}})',
    preheader: 'Our team is on it.',
    vars: ['app', 'name', 'ticket_number', 'link'],
    text: 'Hi {{name}}, we received your request {{ticket_number}} and will reply soon. Track: {{link}}',
    blocks: [h1('We’ve got your request'), p('Hi {{name}}, thanks for reaching out. Your ticket is logged and our team will get back to you shortly.'), detailRows([['Ticket', '{{ticket_number}}']]), button(A.transactional, 'View ticket', '{{link}}')],
  }),
  make({
    slug: 'ticket-resolved', name: 'Support ticket resolved', category: 'transactional', accent: A.transactional,
    description: 'Notify that a ticket was resolved.',
    subject: 'Your request {{ticket_number}} is resolved',
    preheader: 'We hope that sorted it out.',
    vars: ['app', 'name', 'ticket_number', 'link'],
    text: 'Hi {{name}}, your ticket {{ticket_number}} is resolved. Reopen or rate: {{link}}',
    blocks: [h1('Your request is resolved'), p('Hi {{name}}, we’ve marked ticket {{ticket_number}} as resolved. If anything’s still off, just reply and we’ll reopen it.'), button(A.transactional, 'View resolution', '{{link}}')],
  }),
  make({
    slug: 'quota-warning', name: 'Usage limit warning', category: 'system', accent: A.system,
    description: 'Warn a user they’re approaching a limit.',
    subject: 'You’ve used {{percent}} of your {{resource}}',
    preheader: 'A heads-up on your usage.',
    vars: ['app', 'name', 'percent', 'resource', 'link'],
    text: 'Hi {{name}}, you’ve used {{percent}} of your {{resource}} on {{app}}: {{link}}',
    blocks: [h1('You’re approaching your limit'), p('Hi {{name}}, you’ve used {{percent}} of your available {{resource}}. Upgrade to avoid any interruption.'), button(A.system, 'Manage plan', '{{link}}')],
  }),
  make({
    slug: 'birthday', name: 'Birthday / anniversary', category: 'engagement', accent: A.engagement,
    description: 'Celebrate a customer milestone with a gift.',
    subject: 'Happy anniversary, {{name}}! 🎉',
    preheader: 'A little something to celebrate.',
    vars: ['app', 'name', 'reward', 'code', 'link'],
    text: 'Happy anniversary {{name}}! Here’s {{reward}} — use code {{code}}: {{link}}',
    blocks: [h1('Happy anniversary! 🎉'), p('Hi {{name}}, thanks for being with {{app}}. To celebrate, here’s {{reward}} on us.'), codeBox(A.engagement, '{{code}}'), button(A.engagement, 'Claim your gift', '{{link}}')],
  }),
];

// Every distinct category, in a sensible display order.
export const TEMPLATE_CATEGORIES = ['security', 'onboarding', 'transactional', 'ecommerce', 'billing', 'marketing', 'engagement', 'team', 'event', 'system'];

export const CATEGORY_LABELS = {
  security: 'Security & auth',
  onboarding: 'Onboarding',
  transactional: 'Transactional',
  ecommerce: 'E-commerce',
  billing: 'Billing',
  marketing: 'Marketing',
  engagement: 'Engagement',
  team: 'Team',
  event: 'Events',
  system: 'System',
  custom: 'Custom',
};

// Replace {{placeholders}} with readable demo values so previews look real.
const DEMO_VALUES = {
  app: 'Acme', name: 'Alex', company_address: '123 Market St, San Francisco',
  code: '481920', link: '#', cta: 'Continue', support_email: 'support@acme.com',
  device: 'iPhone 15', location: 'San Francisco, US', time: 'Today, 2:14 PM',
  inviter: 'Jordan', team: 'Acme Design', order_number: 'AC-10428', item: 'Aero Running Shoes',
  total: '$129.00', carrier: 'UPS', tracking: '1Z999AA10123456784', eta: 'Mon, Sep 8',
  amount: '$29.00', plan: 'Pro', date: 'Sep 5, 2026', invoice_number: 'INV-2043',
  due_date: 'Sep 12, 2026', next_date: 'Oct 5, 2026', trial_end: 'Sep 19, 2026', days: '3',
  end_date: 'Sep 30, 2026', discount: '20%', expiry: 'Sep 7', headline: 'What’s new this month',
  story_one: 'We shipped a faster dashboard and three new integrations.', story_two: 'Community spotlight and upcoming events.',
  feature: 'Smart Insights', body: 'it surfaces trends in your data automatically.', preview: 'Take a look inside.',
  event_name: 'Product Deep Dive', when: 'in 1 hour', reward: '$10 credit',
  title: 'Your report is ready', author: 'Sam', context: 'Q3 Planning', excerpt: 'Can you take a look at this section?',
  assigner: 'Priya', task: 'Review homepage copy', requester: 'Dev', member: 'Riley', sharer: 'Casey',
  status: 'Investigating', role: 'Admin', resource: 'API calls', percent: '90%', ticket_number: '#48210',
  subject_line: 'Finish your setup', stat_one: '12 new sign-ups', stat_two: '4 deals closed', stat_three: '98% uptime',
  item_one: 'Sam commented on your doc', item_two: 'Priya closed 2 tasks', effective_date: 'Oct 1, 2026',
};

export function fillDemo(html) {
  return String(html || '').replace(/{{\s*([a-zA-Z0-9_.-]+)\s*}}/g, (_, key) => DEMO_VALUES[key] ?? `{{${key}}}`);
}
