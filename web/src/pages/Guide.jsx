import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import { api } from '../lib/api.js';

const sendOtpCode = `const response = await fetch('https://mail.example.com/api/system/send', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: \`Bearer \${process.env.TMAIL_SERVICE_TOKEN}\`,
  },
  body: JSON.stringify({
    to: user.email,
    template: 'verify_login',
    vars: {
      app: 'Acme Portal',
      code: otp,
    },
  }),
});

if (!response.ok) {
  throw new Error('Unable to send verification email');
}`;

const rawEmailCode = `const response = await fetch('https://mail.example.com/api/system/send', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: \`Bearer \${process.env.TMAIL_SERVICE_TOKEN}\`,
  },
  body: JSON.stringify({
    to: user.email,
    subject: 'Your Acme Portal sign-in code',
    text: \`Your verification code is \${otp}. It expires in 10 minutes.\`,
    from: 'security@tgo.com',
  }),
});`;

const verifyCode = `// Store only a hash of the code, never the raw OTP.
const codeHash = await hash(otp);
await db.loginCodes.create({
  userId: user.id,
  codeHash,
  expiresAt: Date.now() + 10 * 60 * 1000,
});

// On the verification request:
const record = await db.loginCodes.latestFor(user.id);
const valid = record && Date.now() < record.expiresAt
  && await verify(submittedCode, record.codeHash);

if (!valid) throw new Error('Invalid or expired code');
await db.loginCodes.consume(record.id);`;

function CodeBlock({ code }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="relative overflow-hidden rounded-lg bg-gray-950 text-gray-100">
      <button
        className="absolute right-3 top-3 rounded-md border border-gray-700 px-2.5 py-1 text-xs text-gray-300 hover:bg-gray-800"
        onClick={copy}
        type="button"
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
      <pre className="overflow-x-auto p-4 pr-20 text-xs leading-6"><code>{code}</code></pre>
    </div>
  );
}

function Step({ id, number, title, children }) {
  return (
    <section id={id} className="border-t border-gray-200 pt-8">
      <div className="flex gap-4">
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent text-sm font-semibold text-white">{number}</div>
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-semibold tracking-tight text-gray-950">{title}</h2>
          <div className="mt-3 space-y-4 text-sm leading-6 text-gray-600">{children}</div>
        </div>
      </div>
    </section>
  );
}

export default function Guide() {
  const { user, logout } = useAuth();
  const [demoState, setDemoState] = useState('idle');

  const sendDemo = async () => {
    setDemoState('sending');
    try {
      await api.demoOtp();
      setDemoState('sent');
    } catch {
      setDemoState('error');
    }
  };

  return (
    <div className="min-h-full bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Link to="/" className="text-xl font-bold tracking-tight text-gray-950">tmail</Link>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden max-w-48 truncate text-gray-500 sm:inline">{user?.address}</span>
            <Link to="/" className="btn-outline">Back to inbox</Link>
            <button className="btn-ghost" onClick={logout}>Sign out</button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-10 sm:py-14">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-widest text-accent">Developer guide</p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-gray-950 sm:text-5xl">Use T-mail for OTP email</h1>
          <p className="mt-5 text-lg leading-8 text-gray-600">
            Send sign-in codes and security emails from your application through T-mail's authenticated service API.
            Your application creates and verifies the code; T-mail delivers the message to the user's inbox.
          </p>
        </div>

        <div className="mt-12 grid gap-12 lg:grid-cols-[minmax(0,1fr)_260px]">
          <div className="max-w-3xl space-y-10">
            <Step id="setup" number="1" title="Configure your service credentials">
              <p>Workspace members manage verification, custom email addresses, and service tokens in the dedicated workspace dashboard.</p>
              <Link className="btn-primary inline-flex" to="/workspace">Open workspace dashboard</Link>
              <p>After the TGO team verifies your workspace, create a service token there and store it in your application backend as <code className="rounded bg-gray-100 px-1.5 py-0.5 text-gray-800">TMAIL_SERVICE_TOKEN</code>.</p>
            </Step>

            <Step id="generate" number="2" title="Generate and store the OTP">
              <p>Generate a cryptographically secure six-digit code, store a hash with a short expiry, and limit attempts. The raw code should exist only long enough to send the message.</p>
              <CodeBlock code={verifyCode} />
            </Step>

            <Step id="send" number="3" title="Send the verification email">
              <p>Use the built-in <code className="rounded bg-gray-100 px-1.5 py-0.5 text-gray-800">verify_login</code> template. The request must come from your backend and include the T-mail service token.</p>
              <CodeBlock code={sendOtpCode} />
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
                The template accepts <code>app</code> and <code>code</code> variables. T-mail creates the recipient's internal mailbox automatically when needed.
              </div>
            </Step>

            <section id="try-it" className="border-t border-gray-200 pt-8">
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 sm:p-6">
                <p className="text-sm font-semibold uppercase tracking-widest text-accent">Try it now</p>
                <h2 className="mt-2 text-xl font-semibold tracking-tight text-gray-950">Send a test OTP to your inbox</h2>
                <p className="mt-2 text-sm leading-6 text-blue-950/70">
                  This protected demo sends a real test message from no-reply to your signed-in T-mail address:
                  <span className="font-medium"> {user?.address}</span>
                </p>
                <button
                  className="btn-primary mt-4"
                  disabled={demoState === 'sending'}
                  onClick={sendDemo}
                  type="button"
                >
                  {demoState === 'sending' ? 'Sending...' : 'Send test OTP'}
                </button>
                {demoState === 'sent' && <p className="mt-3 text-sm font-medium text-green-700">Sent. Check your inbox for the T-mail demo code.</p>}
                {demoState === 'error' && <p className="mt-3 text-sm font-medium text-red-700">The demo could not send. Check the server logs or try again later.</p>}
                <p className="mt-3 text-xs text-blue-900/60">Limited to three test messages every five minutes.</p>
              </div>
            </section>

            <Step id="verify" number="4" title="Verify the submitted code">
              <p>When the user submits the code, compare it with the stored hash, check expiry and attempt count, then consume it so it cannot be reused.</p>
              <p>Return a generic error such as “Invalid or expired code” for both wrong and expired codes. Do not reveal whether an email address exists.</p>
            </Step>

            <Step id="custom" number="5" title="Use a custom security email when needed">
              <p>For a custom subject and body, omit <code className="rounded bg-gray-100 px-1.5 py-0.5 text-gray-800">template</code> and send <code className="rounded bg-gray-100 px-1.5 py-0.5 text-gray-800">subject</code> plus <code className="rounded bg-gray-100 px-1.5 py-0.5 text-gray-800">text</code>.</p>
              <CodeBlock code={rawEmailCode} />
              <p>The optional <code className="rounded bg-gray-100 px-1.5 py-0.5 text-gray-800">from</code> value is restricted to T-mail's configured system senders, such as <code className="rounded bg-gray-100 px-1.5 py-0.5 text-gray-800">security@tgo.com</code>.</p>
            </Step>

            <section id="api" className="border-t border-gray-200 pt-8">
              <h2 className="text-xl font-semibold tracking-tight text-gray-950">API reference</h2>
              <div className="mt-4 overflow-hidden rounded-lg border border-gray-200 bg-white">
                <div className="grid grid-cols-[110px_1fr] border-b border-gray-200 p-4 text-sm">
                  <span className="font-mono font-semibold text-accent">POST</span>
                  <code>/api/system/send</code>
                </div>
                <div className="grid gap-3 p-4 text-sm text-gray-600 sm:grid-cols-[110px_1fr]">
                  <span className="font-medium text-gray-900">Auth</span>
                  <code>Authorization: Bearer TMAIL_SERVICE_TOKEN</code>
                  <span className="font-medium text-gray-900">Template</span>
                  <code>to, template, vars</code>
                  <span className="font-medium text-gray-900">Raw</span>
                  <code>to, subject, text, html?, from?</code>
                  <span className="font-medium text-gray-900">Success</span>
                  <code>201 {'{ ok, messageId, delivered, undeliverable }'}</code>
                </div>
              </div>
            </section>

            <section id="security" className="border-t border-gray-200 pt-8">
              <h2 className="text-xl font-semibold tracking-tight text-gray-950">Security checklist</h2>
              <ul className="mt-4 grid gap-3 text-sm leading-6 text-gray-600 sm:grid-cols-2">
                <li className="border-l-2 border-accent pl-3">Expire codes after 10 minutes or less.</li>
                <li className="border-l-2 border-accent pl-3">Allow only a small number of verification attempts.</li>
                <li className="border-l-2 border-accent pl-3">Rate-limit requests per account and IP address.</li>
                <li className="border-l-2 border-accent pl-3">Hash codes at rest and consume them after success.</li>
                <li className="border-l-2 border-accent pl-3">Keep T-mail tokens in server-side secrets.</li>
                <li className="border-l-2 border-accent pl-3">Use HTTPS for every production request.</li>
              </ul>
            </section>
          </div>

          <aside className="hidden lg:block">
            <div className="sticky top-8 border-l border-gray-200 pl-5 text-sm">
              <p className="font-semibold text-gray-900">On this page</p>
              <nav className="mt-4 space-y-3 text-gray-500">
                <a className="block hover:text-accent" href="#setup">Configure credentials</a>
                <a className="block hover:text-accent" href="#generate">Generate and store</a>
                <a className="block hover:text-accent" href="#send">Send the email</a>
                <a className="block hover:text-accent" href="#try-it">Try it now</a>
                <a className="block hover:text-accent" href="#verify">Verify the code</a>
                <a className="block hover:text-accent" href="#api">API reference</a>
                <a className="block hover:text-accent" href="#security">Security checklist</a>
              </nav>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
