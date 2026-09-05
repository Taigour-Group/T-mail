import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../lib/auth.jsx';
import { api } from '../lib/api.js';
import Sidebar from '../components/Sidebar.jsx';
import ThreadList from '../components/ThreadList.jsx';
import ThreadView from '../components/ThreadView.jsx';
import Compose from '../components/Compose.jsx';
import SearchBar from '../components/SearchBar.jsx';

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

  const loadThreads = useCallback(async () => {
    setLoading(true);
    try {
      const { threads: ts } = await api.threads(labelId ? 'INBOX' : folder, labelId || undefined);
      setThreads(ts);
    } catch {
      setThreads([]);
    } finally {
      setLoading(false);
    }
  }, [folder, labelId]);

  useEffect(() => { loadLabels(); }, [loadLabels]);
  useEffect(() => { if (!search) loadThreads(); }, [loadThreads, search]);

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
    <div className="h-full flex">
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

      <div className="flex-1 flex flex-col min-w-0">
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
        </div>

        <div className="flex-1 flex min-h-0">
          {/* Thread list: full-width on mobile; hidden on mobile when a thread is open */}
          <div className={`w-full lg:w-96 lg:shrink-0 min-h-0 ${selected ? 'hidden lg:block' : 'block'}`}>
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
                onReply={openReply}
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
      <button
        className="lg:hidden fixed bottom-6 right-6 z-30 h-14 w-14 rounded-full bg-accent text-white shadow-lg grid place-items-center hover:bg-accent-hover"
        onClick={() => setCompose({ initial: {} })}
        aria-label="Compose"
      >
        <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>

      {compose && (
        <Compose
          initial={compose.initial}
          onClose={() => setCompose(null)}
          onSent={() => { setCompose(null); loadThreads(); }}
        />
      )}
    </div>
  );
}
