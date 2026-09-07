function fmtTime(iso) {
  const d = new Date(iso);
  const now = new Date();
  const seconds = Math.max(0, Math.floor((now.getTime() - d.getTime()) / 1000));
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 172800) return 'yesterday';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function exactTime(iso) {
  return new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

function names(participants) {
  return participants.map((p) => p.split('@')[0]).join(', ');
}

export default function ThreadList({ title, threads, loading, selectedId, onOpen }) {
  return (
    <div className="flex h-full min-h-0 w-full flex-col border-r border-gray-200 bg-white">
      <div className="flex h-12 shrink-0 items-center truncate border-b border-gray-200 px-4 font-semibold">{title}</div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {loading && <div className="p-4 text-sm text-gray-400">Loading…</div>}
        {!loading && threads.length === 0 && (
          <div className="p-8 text-center text-sm text-gray-400">No conversations</div>
        )}
        {threads.map((t) => (
          <button
            key={t.threadId}
            onClick={() => onOpen(t.threadId)}
            className={`w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 ${
              selectedId === t.threadId ? 'bg-accent/5' : ''
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className={`truncate text-sm ${t.unread ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
                {names(t.participants) || '(unknown)'}
              </span>
              <span className="text-xs text-gray-400 shrink-0" title={exactTime(t.lastMessageAt)}>{fmtTime(t.lastMessageAt)}</span>
            </div>
            <div className={`truncate text-sm ${t.unread ? 'font-semibold' : ''}`}>
              {t.starred && <span className="text-amber-500 mr-1">★</span>}
              {t.subject || '(no subject)'}
              {t.messageCount > 1 && <span className="text-gray-400 font-normal"> · {t.messageCount}</span>}
            </div>
            <div className="truncate text-xs text-gray-500">{t.snippet}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
