import { useEffect, useState } from 'react';
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
  const [tokens, setTokens] = useState([]);
  const [tokenName, setTokenName] = useState('My verification app');
  const [tokenExpiry, setTokenExpiry] = useState('90');
  const [newToken, setNewToken] = useState(null);
  const [tokenState, setTokenState] = useState('idle');
  const [tokenError, setTokenError] = useState('');
  const [businessAccount, setBusinessAccount] = useState(null);
  const [businessForm, setBusinessForm] = useState({ workspaceName: '', website: '' });
  const [businessState, setBusinessState] = useState('idle');
  const [workspaceAddresses, setWorkspaceAddresses] = useState([]);
  const [addressDomain, setAddressDomain] = useState('tgo.com');
  const [addressForm, setAddressForm] = useState({ localPart: '', label: '' });
  const [addressState, setAddressState] = useState('idle');

  const loadTokens = async () => {
    try {
      const result = await api.serviceTokens();
      setTokens(result.tokens);
    } catch (error) {
      setTokenError(error.message);
    }
  };

  const loadBusinessAccount = async () => {
    try {
      const result = await api.businessAccount();
      setBusinessAccount(result.workspace);
      if (result.workspace) {
        setBusinessForm({
          workspaceName: result.workspace.name,
          website: result.workspace.website || '',
        });
        if (result.workspace.verification_status === 'verified') await loadWorkspaceAddresses();
      }
    } catch (error) {
      setTokenError(error.message);
    }
  };

  const loadWorkspaceAddresses = async () => {
    try {
      const result = await api.workspaceAddresses();
      setWorkspaceAddresses(result.addresses);
      setAddressDomain(result.domain);
    } catch (error) {
      if (error.status !== 403) setTokenError(error.message);
    }
  };

  useEffect(() => {
    loadTokens();
    loadBusinessAccount();
  }, []);

  const requestVerification = async (event) => {
    event.preventDefault();
    setBusinessState('submitting');
    setTokenError('');
    try {
      const result = await api.requestBusinessAccount(businessForm);
      setBusinessAccount(result.workspace);
      await loadWorkspaceAddresses();
      setBusinessState('idle');
    } catch (error) {
      setTokenError(error.message);
      setBusinessState('idle');
    }
  };

  const createToken = async (event) => {
    event.preventDefault();
    setTokenState('creating');
    setTokenError('');
    try {
      const token = await api.createServiceToken(tokenName, tokenExpiry === 'never' ? null : Number(tokenExpiry));
      setNewToken(token);
      setTokenState('idle');
      await loadTokens();
    } catch (error) {
      setTokenError(`${error.message}${error.requestId ? ` (request ${error.requestId})` : ''}`);
      setTokenState('idle');
    }
  };

  const revokeToken = async (id) => {
    setTokenError('');
    try {
      await api.revokeServiceToken(id);
      await loadTokens();
    } catch (error) {
      setTokenError(error.message);
    }
  };

  const createAddress = async (event) => {
    event.preventDefault();
    setAddressState('creating');
    setTokenError('');
    try {
      await api.createWorkspaceAddress(addressForm.localPart, addressForm.label);
      setAddressForm({ localPart: '', label: '' });
      await loadWorkspaceAddresses();
      setAddressState('idle');
    } catch (error) {
      setTokenError(error.message);
      setAddressState('idle');
    }
  };

  const deleteAddress = async (id) => {
    setTokenError('');
    try {
      await api.deleteWorkspaceAddress(id);
      await loadWorkspaceAddresses();
    } catch (error) {
      setTokenError(error.message);
    }
  };

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
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-blue-950">
                <p className="font-semibold">TGO Workspace verification</p>
                <p className="mt-1 text-sm leading-6">Create a workspace for your team. Service tokens belong to the workspace and are available after the TGO team verifies it.</p>
                {businessAccount?.verification_status !== 'verified' && (
                  <form className="mt-4 space-y-3" onSubmit={requestVerification}>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <input className="input bg-white" required maxLength="120" placeholder="Workspace name" value={businessForm.workspaceName} onChange={(event) => setBusinessForm({ ...businessForm, workspaceName: event.target.value })} />
                      <input className="input bg-white" maxLength="200" placeholder="Company website (optional)" type="url" value={businessForm.website} onChange={(event) => setBusinessForm({ ...businessForm, website: event.target.value })} />
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <button className="btn-primary" disabled={businessState === 'submitting'} type="submit">{businessState === 'submitting' ? 'Creating workspace...' : 'Request verification'}</button>
                      {businessAccount && <span className="text-sm font-medium capitalize">Status: {businessAccount.verification_status}</span>}
                    </div>
                  </form>
                )}
                {businessAccount?.verification_status === 'verified' && <p className="mt-3 text-sm font-medium text-green-800">Workspace verified by the TGO team. Your team can create service tokens.</p>}
              </div>
              {businessAccount?.verification_status === 'verified' && <div className="rounded-lg border border-gray-200 bg-white p-4">
                <p className="font-semibold text-gray-950">Custom workspace addresses</p>
                <p className="mt-1 text-sm leading-6">Create addresses such as <code className="rounded bg-gray-100 px-1.5 py-0.5 text-gray-800">no-reply@{addressDomain}</code>. Incoming messages are delivered to your T-mail inbox.</p>
                <form className="mt-4 flex flex-col gap-2 sm:flex-row" onSubmit={createAddress}>
                  <div className="flex min-w-0 flex-1 items-center">
                    <input className="input min-w-0 flex-1 rounded-r-none" required maxLength="64" pattern="[a-zA-Z0-9][a-zA-Z0-9._-]*[a-zA-Z0-9]" placeholder="no-reply" value={addressForm.localPart} onChange={(event) => setAddressForm({ ...addressForm, localPart: event.target.value })} />
                    <span className="border border-l-0 border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-500">@{addressDomain}</span>
                  </div>
                  <input className="input sm:w-44" required maxLength="80" placeholder="Label" value={addressForm.label} onChange={(event) => setAddressForm({ ...addressForm, label: event.target.value })} />
                  <button className="btn-primary shrink-0" disabled={addressState === 'creating'} type="submit">{addressState === 'creating' ? 'Creating...' : 'Create address'}</button>
                </form>
                {workspaceAddresses.length > 0 && <div className="mt-4 space-y-2">
                  {workspaceAddresses.map((item) => <div className="flex items-center justify-between gap-3 rounded border border-gray-200 px-3 py-2 text-sm" key={item.id}>
                    <div className="min-w-0"><p className="truncate font-medium text-gray-900">{item.address}</p><p className="text-xs text-gray-500">{item.label}</p></div>
                    <button className="btn-ghost shrink-0 text-red-700" onClick={() => deleteAddress(item.id)} type="button">Delete</button>
                  </div>)}
                </div>}
              </div>}
              <p>Create a token below, copy it once, and save it in your application backend as <code className="rounded bg-gray-100 px-1.5 py-0.5 text-gray-800">TMAIL_SERVICE_TOKEN</code>. This token can send verification and other system emails through T-mail.</p>
              {businessAccount?.verification_status === 'verified' && <form className="space-y-3 rounded-lg border border-gray-200 bg-white p-4" onSubmit={createToken}>
                <label className="block text-sm font-medium text-gray-900" htmlFor="token-name">Token name</label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input className="input flex-1" id="token-name" maxLength="80" onChange={(event) => setTokenName(event.target.value)} value={tokenName} />
                  <select className="input sm:w-36" id="token-expiry" onChange={(event) => setTokenExpiry(event.target.value)} value={tokenExpiry}>
                    <option value="30">30 days</option>
                    <option value="90">90 days</option>
                    <option value="365">1 year</option>
                    <option value="never">Never expires</option>
                  </select>
                  <button className="btn-primary shrink-0" disabled={tokenState === 'creating'} type="submit">
                    {tokenState === 'creating' ? 'Generating...' : 'Generate token'}
                  </button>
                </div>
              </form>}
              {newToken && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-950">
                  <p className="font-semibold">Copy this token now. It will not be shown again.</p>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <code className="min-w-0 flex-1 break-all rounded bg-white px-3 py-2 text-xs">{newToken.token}</code>
                    <button className="btn-outline shrink-0" onClick={() => navigator.clipboard.writeText(newToken.token)} type="button">Copy token</button>
                  </div>
                </div>
              )}
              {tokens.length > 0 && (
                <div className="space-y-2">
                  <p className="font-medium text-gray-900">Your tokens</p>
                  {tokens.map((token) => (
                    <div className="flex items-center justify-between gap-3 rounded border border-gray-200 bg-white px-3 py-2 text-sm" key={token.id}>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-gray-900">{token.name}</p>
                        <p className="text-xs text-gray-500">{token.token_prefix}... {token.revoked_at ? 'revoked' : token.expires_at && new Date(token.expires_at) < new Date() ? 'expired' : 'active'}</p>
                      </div>
                      {!token.revoked_at && <button className="btn-ghost shrink-0 text-red-700" onClick={() => revokeToken(token.id)} type="button">Revoke</button>}
                    </div>
                  ))}
                </div>
              )}
              {tokenError && <p className="text-sm font-medium text-red-700">{tokenError}</p>}
              <p>Keep this token on your backend only. Never place it in browser JavaScript, mobile code, logs, or a public repository.</p>
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
