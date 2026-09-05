import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import { api } from '../lib/api.js';
import { TEMPLATE_CATALOG, TEMPLATE_CATEGORIES, CATEGORY_LABELS, fillDemo } from '../lib/templateCatalog.js';

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

const CATEGORY_COLORS = {
  security: '#2563eb', onboarding: '#7c3aed', transactional: '#0891b2', ecommerce: '#059669',
  billing: '#0d9488', marketing: '#db2777', engagement: '#ea580c', team: '#4f46e5',
  event: '#c026d3', system: '#475569', custom: '#64748b',
};

// A live, scaled-down preview of the email HTML rendered in a sandboxed iframe so
// its inline styles can't leak into (or break) the admin console.
function EmailPreview({ html, className = '' }) {
  if (!html) {
    return (
      <div className={`grid place-items-center bg-gray-50 text-gray-400 ${className}`}>
        <span className="text-xs">Text-only template</span>
      </div>
    );
  }
  return (
    <iframe
      title="Email preview"
      sandbox=""
      scrolling="no"
      className={className}
      srcDoc={fillDemo(html)}
      style={{ border: 0, background: '#fff', pointerEvents: 'none' }}
    />
  );
}

function CategoryTag({ category }) {
  if (!category) return null;
  const color = CATEGORY_COLORS[category] || CATEGORY_COLORS.custom;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium capitalize text-gray-600">
      <span className="h-2 w-2 rounded-full" style={{ background: color }} />
      {CATEGORY_LABELS[category] || category}
    </span>
  );
}

// Visual template card: framed thumbnail preview on top, meta + actions below.
function TemplateCard({ title, meta, category, subject, html, visibility, onPreview, actions }) {
  return (
    <div className="group flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white transition-shadow hover:shadow-md">
      <button type="button" onClick={onPreview} className="relative block h-44 w-full overflow-hidden border-b border-gray-100 bg-gray-50 text-left">
        {/* Scale a 600px email down into the card without a scrollbar. */}
        <div className="pointer-events-none absolute left-0 top-0 origin-top-left" style={{ width: '600px', transform: 'scale(0.5)' }}>
          <EmailPreview html={html} className="h-[352px] w-[600px]" />
        </div>
        <span className="absolute bottom-2 right-2 rounded-md bg-black/60 px-2 py-1 text-[11px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">Preview</span>
        {visibility === 'public' && (
          <span className="absolute left-2 top-2 rounded-md bg-green-600 px-2 py-0.5 text-[11px] font-semibold text-white">Public</span>
        )}
      </button>
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 flex-1 truncate font-semibold text-gray-900">{title}</p>
          <CategoryTag category={category} />
        </div>
        {subject && <p className="mt-1 truncate text-sm text-gray-600">{subject}</p>}
        {meta && <p className="mt-0.5 truncate text-xs text-gray-400">{meta}</p>}
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-gray-100 pt-3">
          <button type="button" className="btn-ghost px-2 text-sm" onClick={onPreview}>Preview</button>
          {actions}
        </div>
      </div>
    </div>
  );
}

function EmptyTemplates({ label, onBrowse }) {
  return (
    <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center">
      <p className="text-sm text-gray-500">{label}</p>
      {onBrowse && <button type="button" className="btn-outline mt-4" onClick={onBrowse}>Browse the starter gallery</button>}
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
  const [publicTemplates, setPublicTemplates] = useState([]);
  const [tokenName, setTokenName] = useState('My verification app');
  const [tokenExpiry, setTokenExpiry] = useState('90');
  const [newToken, setNewToken] = useState(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [sendNotice, setSendNotice] = useState('');
  const [templateForm, setTemplateForm] = useState({ name: '', slug: '', senderAddress: '', subject: '', textBody: '', htmlBody: '', category: 'custom', visibility: 'private' });
  // Templates UI: which tab (mine | gallery | public), category filter, preview + create modals.
  const [templateTab, setTemplateTab] = useState('mine');
  const [templateFilter, setTemplateFilter] = useState('all');
  const [preview, setPreview] = useState(null);   // { name, subject, html, meta }
  const [showCreate, setShowCreate] = useState(false);
  const [forkedFrom, setForkedFrom] = useState(null); // id of the public template being cloned
  const [sendForm, setSendForm] = useState({ to: '', template: '', from: '', subject: '', text: '', html: '', vars: '{\n  "name": "Customer"\n}' });

  const load = async () => {
    try {
      const result = await api.businessAccount();
      setWorkspace(result.workspace);
      if (result.workspace) setWorkspaceForm({ workspaceName: result.workspace.name, website: result.workspace.website || '' });
      if (result.workspace?.verification_status === 'verified') {
        const [addressResult, tokenResult, templateResult, publicResult] = await Promise.all([
          api.workspaceAddresses(), api.serviceTokens(), api.workspaceTemplates(), api.publicTemplates().catch(() => ({ templates: [] })),
        ]);
        setAddresses(addressResult.addresses);
        setDomain(addressResult.domain);
        setTokens(tokenResult.tokens);
        setTemplates(templateResult.templates);
        setPublicTemplates(publicResult.templates || []);
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

  const resetTemplateForm = () => {
    setTemplateForm({ name: '', slug: '', senderAddress: addresses[0]?.address || '', subject: '', textBody: '', htmlBody: '', category: 'custom', visibility: 'private' });
    setForkedFrom(null);
  };

  const saveTemplate = async (event) => {
    event.preventDefault();
    setBusy('template');
    setError('');
    try {
      await api.createWorkspaceTemplate({ ...templateForm, forkedFrom: forkedFrom || undefined });
      resetTemplateForm();
      setShowCreate(false);
      setTemplateTab('mine');
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

  // Turn a slug into a unique one within this workspace (append -2, -3, … if taken).
  const uniqueSlug = (base) => {
    const taken = new Set(templates.map((t) => t.slug));
    if (!taken.has(base)) return base;
    let n = 2;
    while (taken.has(`${base}-${n}`)) n += 1;
    return `${base}-${n}`;
  };

  // Open the create modal pre-filled from a catalog starter or a public template.
  const cloneIntoForm = ({ name, slug, subject, textBody, htmlBody, category, sourceId }) => {
    setTemplateForm({
      name,
      slug: uniqueSlug(slug),
      senderAddress: addresses[0]?.address || '',
      subject,
      textBody: textBody || '',
      htmlBody: htmlBody || '',
      category: category || 'custom',
      visibility: 'private',
    });
    setForkedFrom(sourceId || null);
    setShowCreate(true);
  };

  const useCatalogTemplate = (t) => cloneIntoForm({
    name: t.name, slug: t.slug, subject: t.subject, textBody: t.text, htmlBody: t.html, category: t.category,
  });

  const usePublicTemplate = (t) => cloneIntoForm({
    name: t.name, slug: t.slug, subject: t.subject, textBody: t.text_body, htmlBody: t.html_body, category: t.category, sourceId: t.id,
  });

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

  // Category filter applied to whichever template list the active tab shows.
  const filterByCategory = (list, getCat) => (templateFilter === 'all' ? list : list.filter((t) => getCat(t) === templateFilter));
  const galleryList = useMemo(() => filterByCategory(TEMPLATE_CATALOG, (t) => t.category), [templateFilter]);
  const publicList = useMemo(() => filterByCategory(publicTemplates, (t) => t.category), [publicTemplates, templateFilter]);
  const mineList = useMemo(() => filterByCategory(templates, (t) => t.category), [templates, templateFilter]);

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
              <SectionHeader title="Templates" description="Ready-to-use email designs with {{variable}} placeholders your backend fills at send time. Browse the gallery, reuse community templates, or build your own.">
                <button className="btn-primary" type="button" disabled={!verified} onClick={() => { resetTemplateForm(); setShowCreate(true); }}>Create template</button>
              </SectionHeader>
              {!verified ? <LockedNotice /> : (
                <>
                  {/* Tabs */}
                  <div className="flex flex-wrap items-center gap-2 border-b border-gray-200">
                    {[
                      { key: 'mine', label: `My templates (${templates.length})` },
                      { key: 'gallery', label: `Starter gallery (${TEMPLATE_CATALOG.length})` },
                      { key: 'public', label: `Community (${publicTemplates.length})` },
                    ].map((tab) => (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => setTemplateTab(tab.key)}
                        className={`-mb-px border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                          templateTab === tab.key ? 'border-accent text-accent' : 'border-transparent text-gray-500 hover:text-gray-800'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* Category filter */}
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => setTemplateFilter('all')} className={`chip ${templateFilter === 'all' ? 'bg-accent text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>All</button>
                    {TEMPLATE_CATEGORIES.map((cat) => (
                      <button key={cat} type="button" onClick={() => setTemplateFilter(cat)} className={`chip ${templateFilter === cat ? 'bg-accent text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>{CATEGORY_LABELS[cat]}</button>
                    ))}
                  </div>

                  {/* My templates */}
                  {templateTab === 'mine' && (
                    mineList.length === 0 ? (
                      <EmptyTemplates label={templates.length === 0 ? 'You haven’t created any templates yet.' : 'No templates in this category.'} onBrowse={() => setTemplateTab('gallery')} />
                    ) : (
                      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                        {mineList.map((t) => (
                          <TemplateCard
                            key={t.id}
                            title={t.name}
                            meta={`${t.slug} · from ${t.sender_address}`}
                            category={t.category}
                            subject={t.subject}
                            html={t.html_body}
                            visibility={t.visibility}
                            onPreview={() => setPreview({ name: t.name, subject: t.subject, html: t.html_body, category: t.category, visibility: t.visibility })}
                            actions={<button className="btn-ghost text-red-700" type="button" onClick={() => deleteTemplate(t.id)}>Delete</button>}
                          />
                        ))}
                      </div>
                    )
                  )}

                  {/* Starter gallery (built-in catalog) */}
                  {templateTab === 'gallery' && (
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                      {galleryList.map((t) => (
                        <TemplateCard
                          key={t.slug}
                          title={t.name}
                          meta={t.description}
                          category={t.category}
                          subject={t.subject}
                          html={t.html}
                          accent={t.accent}
                          onPreview={() => setPreview({ name: t.name, subject: t.subject, html: t.html, category: t.category })}
                          actions={<button className="btn-outline" type="button" onClick={() => useCatalogTemplate(t)}>Use template</button>}
                        />
                      ))}
                    </div>
                  )}

                  {/* Community / public templates */}
                  {templateTab === 'public' && (
                    publicList.length === 0 ? (
                      <EmptyTemplates label={publicTemplates.length === 0 ? 'No community templates have been shared yet. Publish one of yours as public to start the gallery.' : 'No community templates in this category.'} />
                    ) : (
                      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                        {publicList.map((t) => (
                          <TemplateCard
                            key={t.id}
                            title={t.name}
                            meta={`by ${t.published_by || 'a workspace'}${t.fork_count ? ` · used ${t.fork_count}×` : ''}`}
                            category={t.category}
                            subject={t.subject}
                            html={t.html_body}
                            onPreview={() => setPreview({ name: t.name, subject: t.subject, html: t.html_body, category: t.category })}
                            actions={<button className="btn-outline" type="button" onClick={() => usePublicTemplate(t)}>Use template</button>}
                          />
                        ))}
                      </div>
                    )
                  )}
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

      {/* Preview modal — full email rendered with demo values */}
      {preview && (
        <PreviewModal preview={preview} onClose={() => setPreview(null)} />
      )}

      {/* Create / clone template modal */}
      {showCreate && (
        <CreateTemplateModal
          form={templateForm}
          setForm={setTemplateForm}
          addresses={addresses}
          busy={busy === 'template'}
          forked={Boolean(forkedFrom)}
          onSubmit={saveTemplate}
          onClose={() => { setShowCreate(false); }}
        />
      )}
    </div>
  );
}

function PreviewModal({ preview, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:p-8" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 p-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-lg font-semibold text-gray-950">{preview.name}</h2>
              <CategoryTag category={preview.category} />
            </div>
            <p className="mt-1 truncate text-sm text-gray-500">Subject: {fillDemo(preview.subject)}</p>
          </div>
          <button className="btn-ghost shrink-0 px-2" onClick={onClose} aria-label="Close">
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto bg-gray-100 p-4">
          {preview.html ? (
            <iframe title="Email preview" sandbox="" srcDoc={fillDemo(preview.html)} className="h-[600px] w-full rounded-lg border border-gray-200 bg-white" />
          ) : (
            <p className="rounded-lg bg-white p-8 text-center text-sm text-gray-500">This template is plain-text only — no HTML preview.</p>
          )}
        </div>
        <p className="border-t border-gray-100 px-5 py-3 text-xs text-gray-400">Preview uses sample data. {'{{placeholders}}'} are filled by your backend at send time.</p>
      </div>
    </div>
  );
}

function CreateTemplateModal({ form, setForm, addresses, busy, forked, onSubmit, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:p-8" onClick={onClose}>
      <div className="w-full max-w-3xl rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-gray-200 p-5">
          <h2 className="text-lg font-semibold text-gray-950">{forked ? 'Reuse template' : 'Create template'}</h2>
          <button className="btn-ghost px-2" onClick={onClose} aria-label="Close">
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
          </button>
        </div>
        <form onSubmit={onSubmit} className="max-h-[75vh] overflow-y-auto p-5">
          {forked && <p className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">Starting from an existing design. Pick a sender address and tweak anything you like before saving — it becomes your own template.</p>}
          <p className="mb-4 text-xs text-gray-500">Placeholders such as {'{{code}}'}, {'{{name}}'}, {'{{app}}'}, {'{{link}}'} are supplied by your backend when sending.</p>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Template name</span>
              <input className="input mt-1.5" required maxLength="80" placeholder="Order confirmation" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Slug</span>
              <input className="input mt-1.5" required maxLength="64" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" placeholder="order-confirmation" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Sender address</span>
              <select className="input mt-1.5" required value={form.senderAddress} onChange={(e) => setForm({ ...form, senderAddress: e.target.value })}>
                <option value="">Select sender address</option>
                {addresses.map((item) => <option key={item.id} value={item.address}>{item.address}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Category</span>
              <select className="input mt-1.5" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {TEMPLATE_CATEGORIES.map((cat) => <option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>)}
                <option value="custom">Custom</option>
              </select>
            </label>
            <label className="block md:col-span-2">
              <span className="text-sm font-medium text-gray-700">Subject</span>
              <input className="input mt-1.5" required maxLength="998" placeholder="Your order {{order_number}} is confirmed" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
            </label>
            <label className="block md:col-span-2">
              <span className="text-sm font-medium text-gray-700">Plain text body</span>
              <textarea className="input mt-1.5 min-h-28" required placeholder="Hi {{name}}, …" value={form.textBody} onChange={(e) => setForm({ ...form, textBody: e.target.value })} />
            </label>
            <label className="block md:col-span-2">
              <span className="text-sm font-medium text-gray-700">HTML body <span className="text-gray-400">(optional)</span></span>
              <textarea className="input mt-1.5 min-h-40 font-mono text-xs" placeholder="<html>…</html>" value={form.htmlBody} onChange={(e) => setForm({ ...form, htmlBody: e.target.value })} />
            </label>
          </div>

          {/* Visibility */}
          <fieldset className="mt-5">
            <legend className="text-sm font-medium text-gray-700">Visibility</legend>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              {[
                { key: 'private', title: 'Private', desc: 'Only your workspace can see and use this template.' },
                { key: 'public', title: 'Public', desc: 'Share it in the community gallery so any workspace can reuse it.' },
              ].map((opt) => (
                <label key={opt.key} className={`flex cursor-pointer gap-3 rounded-xl border p-4 ${form.visibility === opt.key ? 'border-accent bg-accent/5 ring-1 ring-accent' : 'border-gray-200 hover:border-gray-300'}`}>
                  <input type="radio" name="visibility" className="mt-0.5" checked={form.visibility === opt.key} onChange={() => setForm({ ...form, visibility: opt.key })} />
                  <span>
                    <span className="block text-sm font-semibold text-gray-900">{opt.title}</span>
                    <span className="mt-0.5 block text-xs text-gray-500">{opt.desc}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="mt-6 flex justify-end gap-3 border-t border-gray-100 pt-5">
            <button type="button" className="btn-outline" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Saving…' : form.visibility === 'public' ? 'Publish to community' : 'Save template'}</button>
          </div>
        </form>
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
