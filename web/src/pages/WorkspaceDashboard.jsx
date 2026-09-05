import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import { api } from '../lib/api.js';

const PREBUILT_TEMPLATES = [
  { name: 'Login verification', slug: 'login-verification', subject: 'Your {{code}} verification code', textBody: 'Your verification code is {{code}}. It expires in 10 minutes.', htmlBody: '<h1>Verify your sign-in</h1><p>Your verification code is <strong>{{code}}</strong>.</p>' },
  { name: 'Welcome email', slug: 'welcome', subject: 'Welcome to {{app}}', textBody: 'Welcome to {{app}}, {{name}}! We are glad to have you here.', htmlBody: '<h1>Welcome to {{app}}</h1><p>We are glad to have you here, {{name}}.</p>' },
  { name: 'Password reset', slug: 'password-reset', subject: 'Reset your {{app}} password', textBody: 'Reset your password here: {{link}}', htmlBody: '<h1>Password reset</h1><p><a href="{{link}}">Reset your password</a></p>' },
];

// Sidebar sections — mirrors the Google Workspace admin console layout: a single
// persistent nav rail, one working panel visible at a time.
const NAV = [
  { key: 'overview', label: 'Overview', icon: 'grid' },
  { key: 'addresses', label: 'Email addresses', icon: 'at' },
  { key: 'tokens', label: 'Service tokens', icon: 'key' },
  { key: 'templates', label: 'Templates', icon: 'doc' },
  { key: 'send', label: 'Send email', icon: 'send' },
];

function Icon({ name, className = 'h-5 w-5' }) {
  const paths = {
    grid: 'M3 3h7v7H3V3zm11 0h7v7h-7V3zM3 14h7v7H3v-7zm11 0h7v7h-7v-7z',
    at: 'M12 12m-4 0a4 4 0 108 0 4 4 0 10-8 0M16 12v1.5a2.5 2.5 0 005 0V12a9 9 0 10-3.5 7.1',
    key: 'M21 2l-2 2m-7.6 7.6a5 5 0 11-2-2l7-7 3 3-1.5 1.5-2-2',
    doc: 'M14 3v4a1 1 0 001 1h4M5 3h9l6 6v11a1 1 0 01-1 1H5a1 1 0 01-1-1V4a1 1 0 011-1z',
    send: 'M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z',
  };
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d={paths[name]} />
    </svg>
  );
}

function StatusPill({ status }) {
  const styles = status === 'verified'
    ? 'bg-green-100 text-green-800'
    : status === 'rejected'
      ? 'bg-red-100 text-red-800'
      : 'bg-amber-100 text-amber-800';
  return <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${styles}`}>{status}</span>;
}

function SectionHeader({ title, description, children }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-gray-200 pb-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-gray-950">{title}</h1>
        {description && <p className="mt-1 text-sm leading-6 text-gray-600">{description}</p>}
      </div>
      {children}
    </div>
  );
}

function StatCard({ label, value, hint }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-gray-950">{value}</p>
      {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
    </div>
  );
}

function LockedNotice() {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-950">
      <h2 className="text-lg font-semibold">Verification required</h2>
      <p className="mt-2 text-sm leading-6">The TGO team must verify this workspace before you can use this section. You'll get access to custom addresses, service tokens, templates, and sending once verification is complete.</p>
    </div>
  );
}

export default function WorkspaceDashboard() {
  const { user, logout } = useAuth();
  const [section, setSection] = useState('overview');
  const [workspace, setWorkspace] = useState(null);
  const [workspaceForm, setWorkspaceForm] = useState({ workspaceName: '', website: '' });
  const [addresses, setAddresses] = useState([]);
  const [domain, setDomain] = useState('tgo.com');
  const [addressForm, setAddressForm] = useState({ localPart: '', label: '' });
  const [tokens, setTokens] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [tokenName, setTokenName] = useState('My verification app');
  const [tokenExpiry, setTokenExpiry] = useState('90');
  const [newToken, setNewToken] = useState(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [sendNotice, setSendNotice] = useState('');
  const [templateForm, setTemplateForm] = useState({ name: '', slug: '', senderAddress: '', subject: '', textBody: '', htmlBody: '' });
  const [sendForm, setSendForm] = useState({ to: '', template: '', from: '', subject: '', text: '', html: '', vars: '{\n  "name": "Customer"\n}' });

  const load = async () => {
    try {
      const result = await api.businessAccount();
      setWorkspace(result.workspace);
      if (result.workspace) setWorkspaceForm({ workspaceName: result.workspace.name, website: result.workspace.website || '' });
      if (result.workspace?.verification_status === 'verified') {
        const [addressResult, tokenResult, templateResult] = await Promise.all([api.workspaceAddresses(), api.serviceTokens(), api.workspaceTemplates()]);
        setAddresses(addressResult.addresses);
        setDomain(addressResult.domain);
        setTokens(tokenResult.tokens);
        setTemplates(templateResult.templates);
        if (!templateForm.senderAddress && addressResult.addresses[0]) setTemplateForm((current) => ({ ...current, senderAddress: addressResult.addresses[0].address }));
      }
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  useEffect(() => { load(); }, []);

  const requestWorkspace = async (event) => {
    event.preventDefault();
    setBusy('workspace');
    setError('');
    try {
      const result = await api.requestBusinessAccount(workspaceForm);
      setWorkspace(result.workspace);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy('');
    }
  };

  const createAddress = async (event) => {
    event.preventDefault();
    setBusy('address');
    setError('');
    try {
      await api.createWorkspaceAddress(addressForm.localPart, addressForm.label);
      setAddressForm({ localPart: '', label: '' });
      await load();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy('');
    }
  };

  const deleteAddress = async (id) => {
    setError('');
    try {
      await api.deleteWorkspaceAddress(id);
      await load();
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const createToken = async (event) => {
    event.preventDefault();
    setBusy('token');
    setError('');
    try {
      setNewToken(await api.createServiceToken(tokenName, tokenExpiry === 'never' ? null : Number(tokenExpiry)));
      await load();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy('');
    }
  };

  const revokeToken = async (id) => {
    setError('');
    try {
      await api.revokeServiceToken(id);
      await load();
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const saveTemplate = async (event) => {
    event.preventDefault();
    setBusy('template');
    setError('');
    try {
      await api.createWorkspaceTemplate(templateForm);
      setTemplateForm({ name: '', slug: '', senderAddress: addresses[0]?.address || '', subject: '', textBody: '', htmlBody: '' });
      await load();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy('');
    }
  };

  const deleteTemplate = async (id) => {
    setError('');
    try {
      await api.deleteWorkspaceTemplate(id);
      await load();
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const usePreset = (preset) => setTemplateForm((current) => ({ ...current, ...preset }));

  const sendEmail = async (event) => {
    event.preventDefault();
    setBusy('send');
    setError('');
    setSendNotice('');
    try {
      let vars = {};
      if (sendForm.template && sendForm.vars.trim()) vars = JSON.parse(sendForm.vars);
      const result = await api.sendWorkspaceEmail({
        to: sendForm.to.split(',').map((address) => address.trim()).filter(Boolean),
        template: sendForm.template || undefined,
        vars,
        from: sendForm.from || undefined,
        subject: sendForm.subject || undefined,
        text: sendForm.text || undefined,
        html: sendForm.html || undefined,
      });
      setSendForm((current) => ({ ...current, to: '', subject: '', text: '', html: '' }));
      setSendNotice(`Email delivered to ${result.delivered.join(', ')}`);
    } catch (requestError) {
      setError(requestError instanceof SyntaxError ? 'Variables must be valid JSON' : requestError.message);
    } finally {
      setBusy('');
    }
  };

  const verified = workspace?.verification_status === 'verified';
  const activeTokens = tokens.filter((token) => !token.revoked_at);

  // ── No workspace yet: focused onboarding screen (no admin chrome) ────────────
  if (!workspace) {
    return (
      <div className="min-h-full bg-gray-50">
        <ConsoleHeader user={user} logout={logout} />
        <main className="mx-auto max-w-2xl px-5 py-16">
          <p className="text-sm font-semibold uppercase tracking-widest text-accent">TGO Workspace</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-gray-950">Create your workspace</h1>
          <p className="mt-4 text-base leading-7 text-gray-600">Submit your team details to the TGO team. Verification is required before custom addresses and service tokens become available.</p>
          {error && <p className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">{error}</p>}
          <form className="mt-8 space-y-4 rounded-xl border border-gray-200 bg-white p-6" onSubmit={requestWorkspace}>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Workspace name</span>
              <input className="input mt-1.5" required maxLength="120" placeholder="Acme Inc." value={workspaceForm.workspaceName} onChange={(event) => setWorkspaceForm({ ...workspaceForm, workspaceName: event.target.value })} />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Company website <span className="text-gray-400">(optional)</span></span>
              <input className="input mt-1.5" maxLength="200" placeholder="https://acme.com" type="url" value={workspaceForm.website} onChange={(event) => setWorkspaceForm({ ...workspaceForm, website: event.target.value })} />
            </label>
            <button className="btn-primary w-full" disabled={busy === 'workspace'} type="submit">{busy === 'workspace' ? 'Submitting…' : 'Request verification'}</button>
          </form>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col bg-gray-50">
      <ConsoleHeader user={user} logout={logout} />

      <div className="mx-auto flex w-full max-w-7xl flex-1 gap-8 px-5 py-8">
        {/* Left nav rail */}
        <aside className="hidden w-60 shrink-0 lg:block">
          <div className="sticky top-8">
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="truncate text-sm font-semibold text-gray-950">{workspace.name}</p>
              <div className="mt-2"><StatusPill status={workspace.verification_status} /></div>
            </div>
            <nav className="mt-4 space-y-1">
              {NAV.map((item) => {
                const locked = !verified && item.key !== 'overview';
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setSection(item.key)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      section === item.key ? 'bg-accent/10 text-accent' : 'text-gray-700 hover:bg-gray-100'
                    } ${locked ? 'opacity-50' : ''}`}
                  >
                    <Icon name={item.icon} />
                    <span className="flex-1 text-left">{item.label}</span>
                    {locked && (
                      <svg className="h-3.5 w-3.5 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 018 0v4" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>
        </aside>

        {/* Content */}
        <main className="min-w-0 flex-1">
          {/* Mobile section switcher */}
          <div className="mb-6 lg:hidden">
            <select className="input" value={section} onChange={(event) => setSection(event.target.value)}>
              {NAV.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
            </select>
          </div>

          {error && <p className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">{error}</p>}

          {section === 'overview' && (
            <div className="space-y-6">
              <SectionHeader title="Overview" description="Your workspace at a glance." />
              {!verified && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-950">
                  <h2 className="text-lg font-semibold">Waiting for TGO verification</h2>
                  <p className="mt-2 text-sm leading-6">The TGO team must verify this workspace before members can create custom addresses or service tokens. We'll enable the rest of the console automatically once that's done.</p>
                </div>
              )}
              <div className="grid gap-4 sm:grid-cols-3">
                <StatCard label="Custom addresses" value={verified ? addresses.length : '—'} hint={verified ? `@${domain}` : 'After verification'} />
                <StatCard label="Active tokens" value={verified ? activeTokens.length : '—'} hint={verified ? `${tokens.length} total` : 'After verification'} />
                <StatCard label="Templates" value={verified ? templates.length : '—'} hint={verified ? 'Reusable emails' : 'After verification'} />
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-6">
                <h2 className="text-base font-semibold text-gray-950">Workspace details</h2>
                <dl className="mt-4 grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
                  <div><dt className="text-gray-500">Name</dt><dd className="mt-0.5 font-medium text-gray-900">{workspace.name}</dd></div>
                  <div><dt className="text-gray-500">Website</dt><dd className="mt-0.5 font-medium text-gray-900">{workspace.website || '—'}</dd></div>
                  <div><dt className="text-gray-500">Status</dt><dd className="mt-0.5"><StatusPill status={workspace.verification_status} /></dd></div>
                  <div><dt className="text-gray-500">Your role</dt><dd className="mt-0.5 font-medium capitalize text-gray-900">{workspace.role || 'member'}</dd></div>
                </dl>
                <div className="mt-6 flex flex-wrap gap-3 border-t border-gray-100 pt-5">
                  <Link to="/guide" className="btn-outline">Developer guide</Link>
                  {verified && <button className="btn-primary" type="button" onClick={() => setSection('send')}>Send an email</button>}
                </div>
              </div>
            </div>
          )}

          {section === 'addresses' && (
            <div className="space-y-6">
              <SectionHeader title="Email addresses" description={`Custom @${domain} addresses that route incoming messages to your T-mail inbox.`} />
              {!verified ? <LockedNotice /> : (
                <>
                  <form className="rounded-xl border border-gray-200 bg-white p-6" onSubmit={createAddress}>
                    <h2 className="text-base font-semibold text-gray-950">Add an address</h2>
                    <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                      <label className="block">
                        <span className="text-sm font-medium text-gray-700">Address</span>
                        <div className="mt-1.5 flex items-center">
                          <input className="input min-w-0 flex-1 rounded-r-none" required maxLength="64" pattern="[a-zA-Z0-9][a-zA-Z0-9._-]*[a-zA-Z0-9]" placeholder="no-reply" value={addressForm.localPart} onChange={(event) => setAddressForm({ ...addressForm, localPart: event.target.value })} />
                          <span className="whitespace-nowrap rounded-r-lg border border-l-0 border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-500">@{domain}</span>
                        </div>
                      </label>
                      <label className="block">
                        <span className="text-sm font-medium text-gray-700">Label</span>
                        <input className="input mt-1.5" required maxLength="80" placeholder="Transactional" value={addressForm.label} onChange={(event) => setAddressForm({ ...addressForm, label: event.target.value })} />
                      </label>
                      <button className="btn-primary" disabled={busy === 'address'} type="submit">{busy === 'address' ? 'Adding…' : 'Add'}</button>
                    </div>
                  </form>

                  <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                    {addresses.length === 0 ? (
                      <p className="p-8 text-center text-sm text-gray-500">No custom addresses yet.</p>
                    ) : addresses.map((item) => (
                      <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-3.5 last:border-0" key={item.id}>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-gray-900">{item.address}</p>
                          <p className="truncate text-xs text-gray-500">{item.label}</p>
                        </div>
                        <button className="btn-ghost shrink-0 text-red-700" onClick={() => deleteAddress(item.id)} type="button">Delete</button>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {section === 'tokens' && (
            <div className="space-y-6">
              <SectionHeader title="Service tokens" description="Use a token from your application backend to send transactional email through T-mail." />
              {!verified ? <LockedNotice /> : (
                <>
                  <form className="rounded-xl border border-gray-200 bg-white p-6" onSubmit={createToken}>
                    <h2 className="text-base font-semibold text-gray-950">Generate a token</h2>
                    <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
                      <label className="block">
                        <span className="text-sm font-medium text-gray-700">Token name</span>
                        <input className="input mt-1.5" required maxLength="80" placeholder="My verification app" value={tokenName} onChange={(event) => setTokenName(event.target.value)} />
                      </label>
                      <label className="block">
                        <span className="text-sm font-medium text-gray-700">Expiry</span>
                        <select className="input mt-1.5" value={tokenExpiry} onChange={(event) => setTokenExpiry(event.target.value)}>
                          <option value="30">30 days</option>
                          <option value="90">90 days</option>
                          <option value="365">1 year</option>
                          <option value="never">Never expires</option>
                        </select>
                      </label>
                      <button className="btn-primary" disabled={busy === 'token'} type="submit">{busy === 'token' ? 'Generating…' : 'Generate'}</button>
                    </div>
                  </form>

                  {newToken && (
                    <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
                      <p className="font-semibold">Copy this token now. It won't be shown again.</p>
                      <code className="mt-2 block break-all rounded bg-white p-2.5 text-xs">{newToken.token}</code>
                    </div>
                  )}

                  <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                    {tokens.length === 0 ? (
                      <p className="p-8 text-center text-sm text-gray-500">No service tokens yet.</p>
                    ) : tokens.map((token) => (
                      <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-3.5 last:border-0" key={token.id}>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-gray-900">{token.name}</p>
                          <p className="truncate text-xs text-gray-500">
                            <code>{token.token_prefix}…</code>
                            <span className={`ml-2 ${token.revoked_at ? 'text-red-600' : 'text-green-600'}`}>{token.revoked_at ? 'revoked' : 'active'}</span>
                          </p>
                        </div>
                        {!token.revoked_at && <button className="btn-ghost shrink-0 text-red-700" onClick={() => revokeToken(token.id)} type="button">Revoke</button>}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {section === 'templates' && (
            <div className="space-y-6">
              <SectionHeader title="Templates" description="Reusable email designs with {{variable}} placeholders your backend fills in at send time.">
                <div className="flex flex-wrap gap-2">
                  {PREBUILT_TEMPLATES.map((preset) => (
                    <button className="btn-outline text-xs" key={preset.slug} onClick={() => usePreset(preset)} type="button" disabled={!verified}>Use {preset.name}</button>
                  ))}
                </div>
              </SectionHeader>
              {!verified ? <LockedNotice /> : (
                <>
                  <form className="rounded-xl border border-gray-200 bg-white p-6" onSubmit={saveTemplate}>
                    <h2 className="text-base font-semibold text-gray-950">New template</h2>
                    <p className="mt-1 text-xs text-gray-500">Placeholders such as {'{{code}}'}, {'{{name}}'}, {'{{app}}'}, {'{{link}}'} are supplied by your backend when sending.</p>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <input className="input" required maxLength="80" placeholder="Template name" value={templateForm.name} onChange={(event) => setTemplateForm({ ...templateForm, name: event.target.value })} />
                      <input className="input" required maxLength="64" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" placeholder="template-slug" value={templateForm.slug} onChange={(event) => setTemplateForm({ ...templateForm, slug: event.target.value })} />
                      <select className="input" required value={templateForm.senderAddress} onChange={(event) => setTemplateForm({ ...templateForm, senderAddress: event.target.value })}>
                        <option value="">Select sender address</option>
                        {addresses.map((item) => <option key={item.id} value={item.address}>{item.address}</option>)}
                      </select>
                      <input className="input" required maxLength="998" placeholder="Subject" value={templateForm.subject} onChange={(event) => setTemplateForm({ ...templateForm, subject: event.target.value })} />
                      <textarea className="input min-h-32 md:col-span-2" required placeholder="Plain text body" value={templateForm.textBody} onChange={(event) => setTemplateForm({ ...templateForm, textBody: event.target.value })} />
                      <textarea className="input min-h-32 font-mono text-xs md:col-span-2" placeholder="Optional HTML body" value={templateForm.htmlBody} onChange={(event) => setTemplateForm({ ...templateForm, htmlBody: event.target.value })} />
                    </div>
                    <button className="btn-primary mt-4" disabled={busy === 'template'} type="submit">{busy === 'template' ? 'Publishing…' : 'Publish template'}</button>
                  </form>

                  <div className="grid gap-3 md:grid-cols-2">
                    {templates.length === 0 ? (
                      <p className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500 md:col-span-2">No templates yet.</p>
                    ) : templates.map((template) => (
                      <div className="rounded-xl border border-gray-200 bg-white p-4" key={template.id}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate font-medium text-gray-900">{template.name}</p>
                            <p className="truncate text-xs text-gray-500">{template.slug} · from {template.sender_address}</p>
                          </div>
                          <button className="btn-ghost shrink-0 text-red-700" onClick={() => deleteTemplate(template.id)} type="button">Delete</button>
                        </div>
                        <p className="mt-2 truncate text-sm text-gray-600">{template.subject}</p>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {section === 'send' && (
            <div className="space-y-6">
              <SectionHeader title="Send email" description="Send from a workspace address using a saved template or a custom message." />
              {!verified ? <LockedNotice /> : (
                <>
                  {sendNotice && <p className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm font-medium text-green-800">{sendNotice}</p>}
                  <form className="rounded-xl border border-gray-200 bg-white p-6" onSubmit={sendEmail}>
                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="block md:col-span-2">
                        <span className="text-sm font-medium text-gray-700">To <span className="text-gray-400">(comma-separated)</span></span>
                        <input className="input mt-1.5" required placeholder="customer@example.com" value={sendForm.to} onChange={(event) => setSendForm({ ...sendForm, to: event.target.value })} />
                      </label>
                      <label className="block">
                        <span className="text-sm font-medium text-gray-700">From</span>
                        <select className="input mt-1.5" required value={sendForm.from} onChange={(event) => setSendForm({ ...sendForm, from: event.target.value })}>
                          <option value="">Select sender address</option>
                          {addresses.map((item) => <option key={item.id} value={item.address}>{item.address}</option>)}
                        </select>
                      </label>
                      <label className="block">
                        <span className="text-sm font-medium text-gray-700">Template</span>
                        <select className="input mt-1.5" value={sendForm.template} onChange={(event) => setSendForm({ ...sendForm, template: event.target.value })}>
                          <option value="">Custom email</option>
                          {templates.map((template) => <option key={template.id} value={template.slug}>{template.name}</option>)}
                        </select>
                      </label>
                      {sendForm.template ? (
                        <label className="block md:col-span-2">
                          <span className="text-sm font-medium text-gray-700">Template variables (JSON)</span>
                          <textarea className="input mt-1.5 min-h-28 font-mono text-xs" placeholder={'{"code":"123456"}'} value={sendForm.vars} onChange={(event) => setSendForm({ ...sendForm, vars: event.target.value })} />
                        </label>
                      ) : (
                        <>
                          <label className="block md:col-span-2">
                            <span className="text-sm font-medium text-gray-700">Subject</span>
                            <input className="input mt-1.5" required placeholder="Subject" value={sendForm.subject} onChange={(event) => setSendForm({ ...sendForm, subject: event.target.value })} />
                          </label>
                          <textarea className="input min-h-32 md:col-span-2" required placeholder="Plain text message" value={sendForm.text} onChange={(event) => setSendForm({ ...sendForm, text: event.target.value })} />
                          <textarea className="input min-h-32 font-mono text-xs md:col-span-2" placeholder="Optional HTML message" value={sendForm.html} onChange={(event) => setSendForm({ ...sendForm, html: event.target.value })} />
                        </>
                      )}
                    </div>
                    <button className="btn-primary mt-4" disabled={busy === 'send'} type="submit">{busy === 'send' ? 'Sending…' : 'Send email'}</button>
                  </form>
                </>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function ConsoleHeader({ user, logout }) {
  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5">
        <div className="flex items-center gap-2.5">
          <Link to="/" className="text-xl font-bold tracking-tight text-gray-950">tmail</Link>
          <span className="hidden rounded-md bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-500 sm:inline">Admin</span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="hidden max-w-48 truncate text-gray-500 sm:inline">{user?.address}</span>
          <Link to="/guide" className="btn-outline">Developer guide</Link>
          <Link to="/" className="btn-outline">Inbox</Link>
          <button className="btn-ghost" onClick={logout}>Sign out</button>
        </div>
      </div>
    </header>
  );
}
