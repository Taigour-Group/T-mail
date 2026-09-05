// Thin fetch wrapper. In dev, paths are relative and Vite proxies them to the
// server; VITE_API_BASE can point elsewhere in production. credentials:'include'
// sends the tmail_sid session cookie.
const BASE = import.meta.env.VITE_API_BASE || '';

async function req(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    err.requestId = data.requestId || res.headers.get('x-tmail-request-id');
    throw err;
  }
  return data;
}

export const api = {
  // auth
  loginUrl: () => `${BASE}/auth/login`,
  me: () => req('/auth/me'),
  logout: () => req('/auth/logout', { method: 'POST' }),

  // threads / messages
  threads: (folder = 'INBOX', labelId) =>
    req(`/api/threads?folder=${encodeURIComponent(folder)}${labelId ? `&labelId=${labelId}` : ''}`),
  thread: (id) => req(`/api/threads/${id}`),
  send: (payload) => req('/api/messages', { method: 'POST', body: JSON.stringify(payload) }),
  saveDraft: (payload) => req('/api/messages/drafts', { method: 'POST', body: JSON.stringify(payload) }),
  patchMessage: (id, patch) => req(`/api/messages/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  trashMessage: (id) => req(`/api/messages/${id}`, { method: 'DELETE' }),

  // labels
  labels: () => req('/api/labels'),
  createLabel: (name, color) => req('/api/labels', { method: 'POST', body: JSON.stringify({ name, color }) }),
  applyLabel: (labelId, mailboxMessageId) =>
    req(`/api/labels/${labelId}/apply`, { method: 'POST', body: JSON.stringify({ mailboxMessageId }) }),

  // search
  search: (q) => req(`/api/search?q=${encodeURIComponent(q)}`),
  demoOtp: () => req('/api/demo/otp', { method: 'POST' }),

  // service tokens
  serviceTokens: () => req('/api/tokens'),
  createServiceToken: (name, expiresInDays) => req('/api/tokens', { method: 'POST', body: JSON.stringify({ name, expiresInDays }) }),
  revokeServiceToken: (id) => req(`/api/tokens/${id}`, { method: 'DELETE' }),
  businessAccount: () => req('/api/business-account'),
  requestBusinessAccount: (payload) => req('/api/business-account', { method: 'POST', body: JSON.stringify(payload) }),
  workspaceAddresses: () => req('/api/workspace-addresses'),
  createWorkspaceAddress: (localPart, label) => req('/api/workspace-addresses', { method: 'POST', body: JSON.stringify({ localPart, label }) }),
  deleteWorkspaceAddress: (id) => req(`/api/workspace-addresses/${id}`, { method: 'DELETE' }),
  workspaceTemplates: () => req('/api/workspace-templates'),
  publicTemplates: () => req('/api/workspace-templates/public'),
  createWorkspaceTemplate: (payload) => req('/api/workspace-templates', { method: 'POST', body: JSON.stringify(payload) }),
  deleteWorkspaceTemplate: (id) => req(`/api/workspace-templates/${id}`, { method: 'DELETE' }),
  sendWorkspaceEmail: (payload) => req('/api/workspace-send', { method: 'POST', body: JSON.stringify(payload) }),

  // attachments (multipart upload; JSON metadata back)
  uploadAttachment: async (file) => {
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch(`${BASE}/api/attachments`, { method: 'POST', credentials: 'include', body: fd });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Upload failed');
    return data;
  },
  attachmentUrl: (id) => req(`/api/attachments/${id}`),
};
