import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import { api } from '../lib/api.js';

export default function WorkspaceDashboard() {
  const { user, logout } = useAuth();
  const [workspace, setWorkspace] = useState(null);
  const [workspaceForm, setWorkspaceForm] = useState({ workspaceName: '', website: '' });
  const [addresses, setAddresses] = useState([]);
  const [domain, setDomain] = useState('tgo.com');
  const [addressForm, setAddressForm] = useState({ localPart: '', label: '' });
  const [tokens, setTokens] = useState([]);
  const [tokenName, setTokenName] = useState('My verification app');
  const [tokenExpiry, setTokenExpiry] = useState('90');
  const [newToken, setNewToken] = useState(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const result = await api.businessAccount();
      setWorkspace(result.workspace);
      if (result.workspace) setWorkspaceForm({ workspaceName: result.workspace.name, website: result.workspace.website || '' });
      if (result.workspace?.verification_status === 'verified') {
        const [addressResult, tokenResult] = await Promise.all([api.workspaceAddresses(), api.serviceTokens()]);
        setAddresses(addressResult.addresses);
        setDomain(addressResult.domain);
        setTokens(tokenResult.tokens);
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

  const verified = workspace?.verification_status === 'verified';

  return (
    <div className="min-h-full bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Link to="/" className="text-xl font-bold tracking-tight text-gray-950">tmail</Link>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden max-w-48 truncate text-gray-500 sm:inline">{user?.address}</span>
            <Link to="/guide" className="btn-outline">Developer guide</Link>
            <Link to="/" className="btn-outline">Inbox</Link>
            <button className="btn-ghost" onClick={logout}>Sign out</button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-10 sm:py-14">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-widest text-accent">TGO Workspace</p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-gray-950 sm:text-5xl">Workspace dashboard</h1>
          <p className="mt-4 text-lg leading-8 text-gray-600">Manage your team workspace, custom email addresses, and service credentials from one place.</p>
        </div>

        {error && <p className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">{error}</p>}

        {!workspace && <section className="mt-10 max-w-2xl rounded-xl border border-blue-200 bg-blue-50 p-6">
          <h2 className="text-xl font-semibold text-gray-950">Create your workspace</h2>
          <p className="mt-2 text-sm leading-6 text-blue-950/75">Submit your team details to the TGO team. Verification is required before custom addresses and service tokens become available.</p>
          <form className="mt-5 space-y-3" onSubmit={requestWorkspace}>
            <input className="input bg-white" required maxLength="120" placeholder="Workspace name" value={workspaceForm.workspaceName} onChange={(event) => setWorkspaceForm({ ...workspaceForm, workspaceName: event.target.value })} />
            <input className="input bg-white" maxLength="200" placeholder="Company website (optional)" type="url" value={workspaceForm.website} onChange={(event) => setWorkspaceForm({ ...workspaceForm, website: event.target.value })} />
            <button className="btn-primary" disabled={busy === 'workspace'} type="submit">{busy === 'workspace' ? 'Submitting...' : 'Request verification'}</button>
          </form>
        </section>}

        {workspace && <>
          <section className="mt-10 flex flex-wrap items-center justify-between gap-4 border-b border-gray-200 pb-6">
            <div><p className="text-2xl font-semibold text-gray-950">{workspace.name}</p><p className="mt-1 text-sm text-gray-500">{workspace.website || 'No website added'}</p></div>
            <span className={`rounded-full px-3 py-1 text-sm font-semibold ${verified ? 'bg-green-100 text-green-800' : workspace.verification_status === 'rejected' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>{workspace.verification_status}</span>
          </section>

          {!verified && <section className="mt-8 rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-950"><h2 className="text-lg font-semibold">Waiting for TGO verification</h2><p className="mt-2 text-sm leading-6">The TGO team must verify this workspace before members can create custom addresses or service tokens.</p></section>}

          {verified && <div className="mt-8 grid gap-8 lg:grid-cols-2">
            <section className="rounded-xl border border-gray-200 bg-white p-6">
              <h2 className="text-xl font-semibold text-gray-950">Custom email addresses</h2>
              <p className="mt-2 text-sm leading-6 text-gray-600">Incoming messages route to your T-mail inbox.</p>
              <form className="mt-5 space-y-3" onSubmit={createAddress}>
                <div className="flex items-center"><input className="input min-w-0 flex-1 rounded-r-none" required maxLength="64" pattern="[a-zA-Z0-9][a-zA-Z0-9._-]*[a-zA-Z0-9]" placeholder="no-reply" value={addressForm.localPart} onChange={(event) => setAddressForm({ ...addressForm, localPart: event.target.value })} /><span className="border border-l-0 border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-500">@{domain}</span></div>
                <div className="flex gap-2"><input className="input min-w-0 flex-1" required maxLength="80" placeholder="Label" value={addressForm.label} onChange={(event) => setAddressForm({ ...addressForm, label: event.target.value })} /><button className="btn-primary shrink-0" disabled={busy === 'address'} type="submit">Create</button></div>
              </form>
              <div className="mt-5 space-y-2">{addresses.map((item) => <div className="flex items-center justify-between gap-3 rounded border border-gray-200 px-3 py-2 text-sm" key={item.id}><div><p className="font-medium text-gray-900">{item.address}</p><p className="text-xs text-gray-500">{item.label}</p></div><button className="btn-ghost text-red-700" onClick={() => deleteAddress(item.id)} type="button">Delete</button></div>)}</div>
            </section>

            <section className="rounded-xl border border-gray-200 bg-white p-6">
              <h2 className="text-xl font-semibold text-gray-950">Service tokens</h2>
              <p className="mt-2 text-sm leading-6 text-gray-600">Use a token from your application backend to send transactional email.</p>
              <form className="mt-5 space-y-3" onSubmit={createToken}><input className="input" required maxLength="80" placeholder="Token name" value={tokenName} onChange={(event) => setTokenName(event.target.value)} /><div className="flex gap-2"><select className="input" value={tokenExpiry} onChange={(event) => setTokenExpiry(event.target.value)}><option value="30">30 days</option><option value="90">90 days</option><option value="365">1 year</option><option value="never">Never expires</option></select><button className="btn-primary" disabled={busy === 'token'} type="submit">Generate</button></div></form>
              {newToken && <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950"><p className="font-semibold">Copy this token now. It will not be shown again.</p><code className="mt-2 block break-all rounded bg-white p-2 text-xs">{newToken.token}</code></div>}
              <div className="mt-5 space-y-2">{tokens.map((token) => <div className="flex items-center justify-between gap-3 rounded border border-gray-200 px-3 py-2 text-sm" key={token.id}><div><p className="font-medium text-gray-900">{token.name}</p><p className="text-xs text-gray-500">{token.token_prefix}... {token.revoked_at ? 'revoked' : 'active'}</p></div>{!token.revoked_at && <button className="btn-ghost text-red-700" onClick={() => revokeToken(token.id)} type="button">Revoke</button>}</div>)}</div>
            </section>
          </div>}
        </>}
      </main>
    </div>
  );
}
