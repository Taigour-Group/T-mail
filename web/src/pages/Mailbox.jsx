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

  const onSelectFolder = (f) => { setLabelId(null); setFolder(f); setSelected(null); setSearch(null); };
  const onSelectLabel = (id) => { setLabelId(id); setSelected(null); setSearch(null); };

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
        onCompose={() => setCompose({ initial: {} })}
        onCreateLabel={onCreateLabel}
        user={user}
        onLogout={logout}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <div className="h-14 px-4 flex items-center gap-3 border-b border-gray-200 bg-white">
          <SearchBar onSearch={doSearch} onClear={clearSearch} />
        </div>

        <div className="flex-1 flex min-h-0">
          <ThreadList
            title={title}
            threads={searchAsThreads || threads}
            loading={loading && !search}
            selectedId={selected}
            onOpen={setSelected}
          />
          {selected ? (
            <ThreadView
              threadId={selected}
              onReply={openReply}
              onChanged={loadThreads}
            />
          ) : (
            <div className="flex-1 grid place-items-center text-gray-400 text-sm">Select a conversation</div>
          )}
        </div>
      </div>

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
