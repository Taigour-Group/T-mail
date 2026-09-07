import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../lib/auth.jsx';
import { api } from '../lib/api.js';
import Sidebar from '../components/Sidebar.jsx';
import ThreadList from '../components/ThreadList.jsx';
import ThreadView from '../components/ThreadView.jsx';
import Compose from '../components/Compose.jsx';
import SearchBar from '../components/SearchBar.jsx';
import FriendSearch from '../components/FriendSearch.jsx';

const FOLDER_TITLES = { INBOX: 'Inbox', STARRED: 'Starred', SENT: 'Sent', DRAFT: 'Drafts', TRASH: 'Trash' };

export default function Mailbox() {
  const { user, logout } = useAuth();
  const [folder, setFolder] = useState('INBOX');
  const [labelId, setLabelId] = useState(null);
  const [labels, setLabels] = useState([]);
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [compose, setCompose] = useState(null); // null | { initial }
  const [search, setSearch] = useState(null); // null | { q, results }
  const [navOpen, setNavOpen] = useState(false); // mobile drawer

  const loadLabels = useCallback(async () => {
    try {
      const { labels: ls } = await api.labels();
      setLabels(ls);
    } catch {
      /* ignore */
    }
  }, []);

  const loadThreads = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const { threads: ts } = await api.threads(labelId ? 'INBOX' : folder, labelId || undefined);
      setThreads(ts);
      return true;
    } catch {
      setThreads([]);
      return false;
    } finally {
      setLoading(false);
    }
  }, [folder, labelId]);

  useEffect(() => { loadLabels(); }, [loadLabels]);
  useEffect(() => {
    if (search) return undefined;
    let polling = true;
    const refresh = async (silent = false) => {
      polling = await loadThreads({ silent });
    };
    refresh();
    const timer = window.setInterval(() => {
      if (polling) refresh(true);
    }, 2000);
    return () => window.clearInterval(timer);
  }, [loadThreads, search]);

  const onSelectFolder = (f) => { setLabelId(null); setFolder(f); setSelected(null); setSearch(null); setNavOpen(false); };
  const onSelectLabel = (id) => { setLabelId(id); setSelected(null); setSearch(null); setNavOpen(false); };

  const onCreateLabel = async () => {
    const name = window.prompt('New label name');
    if (!name || !name.trim()) return;
    try {
      await api.createLabel(name.trim());
      loadLabels();
    } catch (e) {
      alert(e.message);
    }
  };

  const doSearch = useCallback(async (q) => {
    try {
      const { results } = await api.search(q);
      setSearch({ q, results });
      setSelected(null);
    } catch {
      setSearch({ q, results: [] });
    }
  }, []);
  const clearSearch = useCallback(() => setSearch(null), []);

  const openReply = (m) => {
    setCompose({
      initial: {
        to: [m.from],
        subject: /^re:/i.test(m.subject) ? m.subject : `Re: ${m.subject}`,
        inReplyTo: m.rfcMessageId,
      },
    });
  };

  // Reply to sender + everyone on To/Cc, minus yourself and duplicates.
  const openReplyAll = (m) => {
    const me = String(user?.address || user?.email || '').trim().toLowerCase();
    const dedupe = (list) => {
      const seen = new Set();
      const out = [];
      for (const raw of list) {
        const value = String(raw || '').trim();
        const key = value.toLowerCase();
        if (!value || key === me || seen.has(key)) continue;
        seen.add(key);
        out.push(value);
      }
      return out;
    };
    const toRecipients = (m.recipients || []).filter((r) => r.kind === 'to').map((r) => r.address);
    const ccRecipients = (m.recipients || []).filter((r) => r.kind === 'cc').map((r) => r.address);
    setCompose({
      initial: {
        to: dedupe([m.from, ...toRecipients]),
        cc: dedupe(ccRecipients),
        subject: /^re:/i.test(m.subject || '') ? m.subject : `Re: ${m.subject || ''}`,
        inReplyTo: m.rfcMessageId,
      },
    });
  };

  // Forward opens the full mail composer with the original quoted and an empty To.
  const openForward = (m) => {
    const escapeHtml = (s) => String(s || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const originalHtml = m.bodyHtml
      ? m.bodyHtml
      : escapeHtml(m.bodyText || '').replace(/\n/g, '<br>');
    const header = [
      '---------- Forwarded message ----------',
      `From: ${escapeHtml(m.from || '')}`,
      `Subject: ${escapeHtml(m.subject || '')}`,
    ].join('<br>');
    setCompose({
      initial: {
        to: [],
        subject: /^fwd:/i.test(m.subject || '') ? m.subject : `Fwd: ${m.subject || ''}`,
        bodyHtml: `<br><br><div style="border-left:2px solid #d0d7de;padding-left:12px;color:#57606a">${header}<br><br>${originalHtml}</div>`,
        body: `\n\n---------- Forwarded message ----------\nFrom: ${m.from || ''}\nSubject: ${m.subject || ''}\n\n${m.bodyText || ''}`,
      },
    });
  };

  const startFriendChat = (friend) => {
    const existing = threads.find((thread) => (
      (thread.participants || []).some((address) => address.toLowerCase() === friend.address.toLowerCase())
    ));
    if (existing) {
      setCompose(null);
      setSelected(existing.threadId);
      return;
    }
    setCompose({
      mode: 'chat',
      initial: { to: [friend.address] },
    });
  };

  // Render search results using the same ThreadList shape.
  const searchAsThreads = search
    ? search.results.map((r) => ({
        threadId: r.threadId,
        subject: r.subject,
        snippet: r.snippet,
        lastMessageAt: r.createdAt,
        unread: !r.isRead,
        starred: r.isStarred,
        messageCount: 1,
        participants: [r.from],
      }))
    : null;

  const title = search
    ? `Search: ${search.q}`
    : labelId
      ? labels.find((l) => l.id === labelId)?.name || 'Label'
      : FOLDER_TITLES[folder];

  return (
    <div className="app-shell flex h-full min-h-0 overflow-hidden">
      <Sidebar
        folder={folder}
        labelId={labelId}
        labels={labels}
        onSelectFolder={onSelectFolder}
        onSelectLabel={onSelectLabel}
        onCompose={() => { setCompose({ initial: {} }); setNavOpen(false); }}
        onCreateLabel={onCreateLabel}
        user={user}
        onLogout={logout}
        open={navOpen}
        onClose={() => setNavOpen(false)}
      />

      <div className="flex min-w-0 min-h-0 flex-1 flex-col overflow-hidden">
        <div className="h-14 px-3 sm:px-4 flex items-center gap-2 sm:gap-3 border-b border-gray-200 bg-white">
          <button
            className="lg:hidden text-gray-500 hover:text-gray-800 p-1 -ml-1 shrink-0"
            onClick={() => setNavOpen(true)}
            aria-label="Open menu"
          >
            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <SearchBar onSearch={doSearch} onClear={clearSearch} />
          <FriendSearch onStartChat={startFriendChat} />
        </div>

        <div className="flex min-h-0 flex-1 overflow-hidden">
          {/* Thread list: full-width on mobile; hidden on mobile when a thread is open */}
          <div className={`min-h-0 w-full lg:w-96 lg:shrink-0 ${selected ? 'hidden lg:block' : 'block'}`}>
            <ThreadList
              title={title}
              threads={searchAsThreads || threads}
              loading={loading && !search}
              selectedId={selected}
              onOpen={setSelected}
            />
          </div>

          {/* Thread view: full-screen on mobile when open; placeholder on desktop when none */}
          {selected ? (
            <div className="w-full min-h-0 flex lg:flex-1">
              <ThreadView
                threadId={selected}
                folder={folder}
                user={user}
                onCompose={() => setCompose({ initial: {} })}
                onReply={openReply}
                onReplyAll={openReplyAll}
                onForward={openForward}
                onChanged={loadThreads}
                onBack={() => setSelected(null)}
              />
            </div>
          ) : (
            <div className="hidden lg:grid flex-1 place-items-center text-gray-400 text-sm">Select a conversation</div>
          )}
        </div>
      </div>

      {/* Floating compose button on mobile */}
      {!selected && (
        <button
          className="lg:hidden fixed bottom-6 right-6 z-30 h-14 w-14 rounded-full bg-accent text-white shadow-lg grid place-items-center hover:bg-accent-hover"
          onClick={() => setCompose({ initial: {} })}
          aria-label="Compose"
        >
          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      )}

      {compose && (
        <Compose
          initial={compose.initial}
          chatMode={compose.mode === 'chat'}
          directChat={compose.mode === 'chat'}
          onClose={() => setCompose(null)}
          onSent={() => { setCompose(null); loadThreads(); }}
        />
      )}
    </div>
  );
}
