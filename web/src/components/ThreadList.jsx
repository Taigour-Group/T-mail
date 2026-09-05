function fmtTime(iso) {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay
    ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function names(participants) {
  return participants.map((p) => p.split('@')[0]).join(', ');
}

export default function ThreadList({ title, threads, loading, selectedId, onOpen }) {
  return (
    <div className="w-96 shrink-0 border-r border-gray-200 bg-white flex flex-col">
      <div className="px-4 h-12 flex items-center border-b border-gray-200 font-semibold truncate">{title}</div>
      <div className="overflow-y-auto flex-1">
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
              <span className="text-xs text-gray-400 shrink-0">{fmtTime(t.lastMessageAt)}</span>
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
