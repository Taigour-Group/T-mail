import { useEffect, useState } from 'react';
import DOMPurify from 'dompurify';
import { api } from '../lib/api.js';

function fmt(iso) {
  return new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

function kb(bytes) {
  return `${Math.max(1, Math.round((bytes || 0) / 1024))} KB`;
}

export default function ThreadView({ threadId, refreshToken = 0, onReply, onChanged, onBack }) {
  const [thread, setThread] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    let alive = true;
    let firstLoad = true;

    const loadThread = async () => {
      try {
        const current = await api.thread(threadId);
        if (alive) {
          setThread(current);
          setErr('');
        }
      } catch (e) {
        if (alive && firstLoad) setErr(e.message);
      } finally {
        if (alive && firstLoad) setLoading(false);
        firstLoad = false;
      }
    };

    setLoading(true);
    setErr('');
    loadThread();
    const timer = window.setInterval(loadThread, 2000);

    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [threadId, refreshToken]);

  async function openAttachment(id) {
    try {
      const { url } = await api.attachmentUrl(id);
      window.open(url, '_blank', 'noopener');
    } catch (e) {
      alert(e.message);
    }
  }

  async function toggleStar(m) {
    if (!m.mailboxMessageId) return;
    try {
      await api.patchMessage(m.mailboxMessageId, { isStarred: !m.isStarred });
      setThread((t) => ({
        ...t,
        messages: t.messages.map((x) => (x.id === m.id ? { ...x, isStarred: !x.isStarred } : x)),
      }));
      onChanged?.();
    } catch (e) {
      alert(e.message);
    }
  }

  async function trash(m) {
    if (!m.mailboxMessageId) return;
    try {
      await api.trashMessage(m.mailboxMessageId);
      onChanged?.();
    } catch (e) {
      alert(e.message);
    }
  }

  if (loading) return <div className="flex-1 grid place-items-center text-gray-400">Loading…</div>;
  if (err) return <div className="flex-1 grid place-items-center text-red-500 text-sm">{err}</div>;
  if (!thread) return null;

  const last = thread.messages[thread.messages.length - 1];

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <div className="h-12 px-3 sm:px-4 flex items-center gap-2 border-b border-gray-200 bg-white">
        {onBack && (
          <button
            className="lg:hidden text-gray-500 hover:text-gray-800 p-1 -ml-1 shrink-0"
            onClick={onBack}
            aria-label="Back to conversations"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        )}
        <h2 className="font-semibold truncate flex-1 min-w-0">{thread.subject || '(no subject)'}</h2>
        <button className="btn-outline shrink-0" onClick={() => onReply(last)}>Reply</button>
      </div>

      <div className="overflow-y-auto flex-1 p-4 space-y-4">
        {thread.messages.map((m) => {
          const to = m.recipients.filter((r) => r.kind === 'to').map((r) => r.address);
          const cc = m.recipients.filter((r) => r.kind === 'cc').map((r) => r.address);
          return (
            <div key={m.id} className="card p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">{m.from}</div>
                  <div className="text-xs text-gray-500 truncate">
                    to {to.join(', ') || '—'}
                    {cc.length > 0 && <> · cc {cc.join(', ')}</>}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-xs text-gray-400 mr-1">{fmt(m.createdAt)}</span>
                  <button
                    title="Star"
                    onClick={() => toggleStar(m)}
                    className={`px-1 text-lg leading-none ${m.isStarred ? 'text-amber-500' : 'text-gray-300 hover:text-gray-500'}`}
                  >
                    ★
                  </button>
                  <button title="Move to trash" onClick={() => trash(m)} className="px-1 text-gray-300 hover:text-red-500">
                    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M8 2a1 1 0 00-1 1v1H4a1 1 0 100 2h12a1 1 0 100-2h-3V3a1 1 0 00-1-1H8zM6 7a1 1 0 011 1v7a1 1 0 11-2 0V8a1 1 0 011-1zm4 0a1 1 0 011 1v7a1 1 0 11-2 0V8a1 1 0 011-1zm4 0a1 1 0 011 1v7a1 1 0 11-2 0V8a1 1 0 011-1z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              </div>

              {m.bodyHtml ? (
                <div
                  className="email-content mt-3 max-w-full overflow-x-auto break-words text-sm text-gray-800"
                  dangerouslySetInnerHTML={{
                    __html: DOMPurify.sanitize(m.bodyHtml, {
                      USE_PROFILES: { html: true },
                      FORBID_TAGS: ['form', 'input', 'button', 'iframe', 'object', 'embed'],
                    }),
                  }}
                />
              ) : (
                <div className="mt-3 whitespace-pre-wrap break-words text-sm text-gray-800">{m.bodyText}</div>
              )}

              {m.attachments.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {m.attachments.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => openAttachment(a.id)}
                      className="chip bg-gray-100 text-gray-700 hover:bg-gray-200"
                    >
                      <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M8 4a3 3 0 016 0v6a5 5 0 01-10 0V6a1 1 0 112 0v4a3 3 0 006 0V4a1 1 0 10-2 0v6a1 1 0 11-2 0V4z" clipRule="evenodd" />
                      </svg>
                      {a.filename} <span className="text-gray-400">({kb(a.size_bytes)})</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
