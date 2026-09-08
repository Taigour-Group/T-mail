import { Fragment, useEffect, useRef, useState } from 'react';
import DOMPurify from 'dompurify';
import { api } from '../lib/api.js';
import Compose from './Compose.jsx';
import VerifiedBadge from './VerifiedBadge.jsx';
import { useDismiss } from '../lib/useDismiss.js';

function fmt(iso) {
  return new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function kb(bytes) {
  return `${Math.max(1, Math.round((bytes || 0) / 1024))} KB`;
}

function initials(address) {
  const name = String(address || '?').split('@')[0].replace(/[._-]+/g, ' ').trim();
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '?';
}

function avatarUrl(address) {
  return `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(String(address || 'unknown'))}&backgroundColor=17181c&textColor=ffffff&radius=50`;
}

function dayKey(iso) {
  const date = new Date(iso);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function dayLabel(iso) {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (dayKey(date) === dayKey(today)) return 'Today';
  if (dayKey(date) === dayKey(yesterday)) return 'Yesterday';
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── Message context menu (3-dot on desktop, long-press on mobile) ─────────────
// The action set differs by message type — mail and chat are no longer the same
// list — and by folder (Trash gets restore / permanent-delete only).
function MenuIcon({ name }) {
  const paths = {
    reply: <><path d="m9 17-5-5 5-5" /><path d="M4 12h10a6 6 0 0 1 6 6" /></>,
    replyAll: <><path d="m7 17-5-5 5-5" /><path d="m13 17-5-5 5-5" /><path d="M11 12h6a5 5 0 0 1 5 5" /></>,
    forward: <><path d="m15 17 5-5-5-5" /><path d="M20 12H10a6 6 0 0 0-6 6" /></>,
    edit: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" /></>,
    copy: <><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></>,
    star: <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z" />,
    unread: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>,
    trash: <><path d="M4 7h16" /><path d="M10 11v6M14 11v6" /><path d="m6 7 1 13h10l1-13M9 7V4h6v3" /></>,
    restore: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></>,
  };
  return (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

function MenuItem({ icon, label, onClick, danger = false, starred = false }) {
  return (
    <button
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm ${
        danger ? 'text-red-300 hover:bg-red-500/15' : 'hover:bg-white/10'
      }`}
      onClick={onClick}
    >
      <span className={starred ? 'text-amber-400' : danger ? 'text-red-300' : 'text-gray-300'}>
        <MenuIcon name={icon} />
      </span>
      {label}
    </button>
  );
}

function MenuDivider() {
  return <div className="my-1 h-px bg-white/10" />;
}

export default function ThreadView({ threadId, folder, refreshToken = 0, onReply, onReplyAll, onForward, onChanged, onCompose, onBack, user }) {
  const [thread, setThread] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [layoutMode, setLayoutMode] = useState('chat');
  const [messageMenuId, setMessageMenuId] = useState(null);
  const [messageMenuPosition, setMessageMenuPosition] = useState({ x: 0, y: 0 });
  const messageListRef = useRef(null);
  const longPressTimer = useRef(null);
  const longPressFired = useRef(false);
  const menuRef = useRef(null);
  const stickToBottomRef = useRef(true);

  useEffect(() => {
    setMessageMenuId(null);
    stickToBottomRef.current = true;
  }, [threadId]);

  // Outside-click / Escape dismissal for the message menu (was a bare click
  // listener that fought with the long-press ghost-click on touch devices).
  useDismiss(menuRef, Boolean(messageMenuId), () => setMessageMenuId(null));

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('tmail-thread-layout');
      if (saved === 'chat' || saved === 'mail') setLayoutMode(saved);
    } catch {
      // ignore storage issues
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem('tmail-thread-layout', layoutMode);
    } catch {
      // ignore storage issues
    }
  }, [layoutMode]);

  useEffect(() => {
    let alive = true;
    let firstLoad = true;
    let timer;

    const loadThread = async () => {
      try {
        const current = await api.thread(threadId);
        if (alive) {
          setThread(current);
          setErr('');
        }
      } catch (e) {
        if (alive && firstLoad) setErr(e.message);
        if (alive) window.clearInterval(timer);
      } finally {
        if (alive && firstLoad) setLoading(false);
        firstLoad = false;
      }
    };

    setLoading(true);
    setErr('');
    loadThread();
    timer = window.setInterval(loadThread, 2000);

    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [threadId, refreshToken]);

  useEffect(() => {
    if (loading || !thread || !messageListRef.current) return undefined;
    if (!stickToBottomRef.current) return undefined;
    const frame = window.requestAnimationFrame(() => {
      messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [threadId, loading, thread]);

  const stopLongPress = () => {
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  // Open at an explicit viewport point so the menu appears where the user acted.
  const openMenuAt = (x, y, id) => {
    setMessageMenuPosition({ x, y });
    setMessageMenuId(id);
  };

  // Desktop 3-dot: anchor just under the button.
  const openMessageMenu = (event, m) => {
    event?.stopPropagation?.();
    const rect = event?.currentTarget?.getBoundingClientRect?.();
    openMenuAt(
      rect ? rect.left + rect.width / 2 : window.innerWidth / 2,
      rect ? rect.bottom + 6 : 120,
      m.id,
    );
  };

  // Mobile long-press: capture the touch point NOW. By the time the timer fires
  // React has recycled the event and currentTarget is null — that was the old
  // bug where the menu always opened at a fixed spot.
  const beginLongPress = (event, m) => {
    stopLongPress();
    longPressFired.current = false;
    const touch = event.touches && event.touches[0];
    const x = touch ? touch.clientX : window.innerWidth / 2;
    const y = touch ? touch.clientY : 120;
    longPressTimer.current = window.setTimeout(() => {
      longPressFired.current = true;
      openMenuAt(x, y, m.id);
      if (navigator.vibrate) { try { navigator.vibrate(12); } catch { /* ignore */ } }
    }, 420);
  };

  // Suppress the emulated click that trails a long-press so the menu we just
  // opened isn't dismissed a beat later.
  const endLongPress = (event) => {
    stopLongPress();
    if (longPressFired.current) {
      event.preventDefault();
      longPressFired.current = false;
    }
  };

  async function openAttachment(id) {
    try {
      const { url } = await api.attachmentUrl(id);
      window.open(url, '_blank', 'noopener');
    } catch (e) {
      alert(e.message);
    }
  }

  async function copyMessage(m) {
    try {
      await navigator.clipboard.writeText(m.bodyText || '');
      setMessageMenuId(null);
    } catch {
      alert('Unable to copy this message');
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

  // Header actions operate on the whole conversation, not just the last message.
  function threadMailboxIds() {
    return visibleMessages.map((message) => message.mailboxMessageId).filter(Boolean);
  }

  async function trashThread() {
    const ids = threadMailboxIds();
    if (ids.length === 0) return;
    try {
      await Promise.all(ids.map((mid) => api.trashMessage(mid)));
      onChanged?.();
      onBack?.();
    } catch (e) {
      alert(e.message);
    }
  }

  async function markThreadUnread() {
    const ids = threadMailboxIds();
    if (ids.length === 0) return;
    try {
      await Promise.all(ids.map((mid) => api.patchMessage(mid, { isRead: false })));
      onChanged?.();
    } catch (e) {
      alert(e.message);
    }
  }

  async function recover(m) {
    if (!m.mailboxMessageId) return;
    try {
      await api.patchMessage(m.mailboxMessageId, { folder: 'INBOX' });
      onChanged?.();
      onBack?.();
    } catch (e) {
      alert(e.message);
    }
  }

  async function permanentlyDelete(m) {
    if (!m.mailboxMessageId) return;
    if (!window.confirm('Permanently delete this message? This cannot be undone.')) return;
    try {
      if (m.folder !== 'TRASH') await api.trashMessage(m.mailboxMessageId);
      await api.permanentlyDeleteMessage(m.mailboxMessageId);
      onChanged?.();
      onBack?.();
    } catch (e) {
      alert(e.message);
    }
  }

  // Move a single message to Trash (recoverable). Distinct from permanentlyDelete,
  // which only makes sense from the Trash folder itself.
  async function trashOne(m) {
    if (!m.mailboxMessageId) return;
    try {
      await api.trashMessage(m.mailboxMessageId);
      setThread((current) => (current ? {
        ...current,
        messages: current.messages.map((x) => (x.id === m.id ? { ...x, folder: 'TRASH' } : x)),
      } : current));
      onChanged?.();
    } catch (e) {
      alert(e.message);
    }
  }

  async function markMessageUnread(m) {
    if (!m.mailboxMessageId) return;
    try {
      await api.patchMessage(m.mailboxMessageId, { isRead: false });
      onChanged?.();
    } catch (e) {
      alert(e.message);
    }
  }

  async function editChatMessage(m) {
    const nextBody = window.prompt('Edit message', m.bodyText || '');
    if (nextBody === null || nextBody === m.bodyText || !m.mailboxMessageId) return;
    try {
      await api.editMessage(m.mailboxMessageId, nextBody);
      setThread((current) => ({
        ...current,
        messages: current.messages.map((message) => (
          message.id === m.id ? { ...message, bodyText: nextBody } : message
        )),
      }));
      onChanged?.();
    } catch (e) {
      alert(e.message);
    }
  }

  if (loading) return <div className="flex-1 grid place-items-center text-gray-400">Loading…</div>;
  if (err) return <div className="flex-1 grid place-items-center text-red-500 text-sm">{err}</div>;
  if (!thread) return null;

  const visibleMessages = (thread.messages || []).filter((message) => (
    folder === 'TRASH' ? message.folder === 'TRASH' : message.folder !== 'TRASH'
  ));
  const last = visibleMessages[visibleMessages.length - 1];
  const menuMessage = visibleMessages.find((message) => message.id === messageMenuId);
  const myAddress = String(user?.address || user?.email || '').trim().toLowerCase();
  const isChatMode = layoutMode === 'chat';
  const participant = visibleMessages
    .flatMap((message) => [
      message.from,
      ...(message.recipients || []).map((recipient) => recipient.address),
    ])
    .find((address) => String(address || '').trim().toLowerCase() !== myAddress) || 'Conversation';

  return (
    <div className="flex min-w-0 min-h-0 flex-1 flex-col overflow-hidden bg-[#f3f4f6]">
      <div className="sticky top-0 z-10 shrink-0 border-b border-gray-200 bg-white shadow-sm">
        {onBack && (
          <button
            className="absolute left-3 top-3 grid h-9 w-9 place-items-center rounded-full text-gray-600 hover:bg-gray-100 hover:text-gray-900 sm:left-5"
            onClick={onBack}
            aria-label="Back to inbox"
            title="Back to inbox"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        )}

        <div className="flex min-h-[76px] min-w-0 items-center gap-3 px-14 py-3 sm:px-20">
          <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-gray-800 text-center text-[10px] font-semibold leading-9 text-white">
            <img
              src={avatarUrl(participant)}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
              onError={(event) => { event.currentTarget.style.display = 'none'; }}
            />
            {initials(participant)}
          </div>

          <div className="min-w-0">
            <h2 className="truncate text-lg font-normal text-gray-900">{thread.subject || '(no subject)'}</h2>
            <p className="truncate text-[11px] font-medium text-gray-700">{participant}</p>
            <p className="truncate text-[10px] text-gray-500">{visibleMessages.length} messages · {isChatMode ? 'Chat' : 'Mail'} mode</p>
          </div>
        </div>
        <div className="flex h-11 items-center gap-1 border-t border-gray-100 px-3 text-gray-600 sm:px-5">
          <button className="grid h-8 w-8 place-items-center rounded hover:bg-gray-100" onClick={trashThread} aria-label="Delete conversation" title="Delete conversation">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>
          </button>
          <button className="grid h-8 w-8 place-items-center rounded hover:bg-gray-100" onClick={markThreadUnread} aria-label="Mark unread" title="Mark unread">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 5h16v14H4zM4 6l8 6 8-6" /></svg>
          </button>

          {/* Visible Mail/Chat toggle — replaces the old hidden /chat /mail slash
              commands. Switching only changes how the thread is laid out and how
              the next reply is sent; it never alters stored messages. */}
          <div className="ml-auto inline-flex overflow-hidden rounded-full border border-gray-200 bg-gray-50 p-0.5 text-xs" role="group" aria-label="Conversation mode">
            {['mail', 'chat'].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setLayoutMode(value)}
                className={`rounded-full px-3 py-1 font-medium capitalize transition ${
                  layoutMode === value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
                aria-pressed={layoutMode === value}
              >
                {value}
              </button>
            ))}
          </div>
          {last && folder !== 'TRASH' && last.replyable !== false && (
            <button className="btn-outline px-3 py-1.5" onClick={() => onReply(last)}>Reply</button>
          )}
        </div>
      </div>

      <div
        ref={messageListRef}
        onScroll={(event) => {
          const element = event.currentTarget;
          const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
          stickToBottomRef.current = distanceFromBottom < 80;
        }}
        className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain bg-[linear-gradient(#f3f4f6,#f3f4f6)] px-1 py-4 pb-28 sm:px-2 sm:py-6 sm:pb-28"
      >
        <div className={`mx-auto w-full max-w-4xl ${isChatMode ? 'space-y-2' : 'space-y-3'}`}>
          {visibleMessages.map((m, index) => {
            const to = (m.recipients || []).filter((r) => r.kind === 'to').map((r) => r.address);
            const cc = (m.recipients || []).filter((r) => r.kind === 'cc').map((r) => r.address);
            const myAddress = String(user?.address || user?.email || '').trim().toLowerCase();
            const isMine = Boolean(myAddress && String(m.from || '').trim().toLowerCase() === myAddress);
            const messageIsChat = m.mode === 'chat';
            const when = messageIsChat ? fmtTime(m.createdAt) : fmt(m.createdAt);

            return (
              <Fragment key={m.id}>
                {messageIsChat && (index === 0 || dayKey(m.createdAt) !== dayKey(visibleMessages[index - 1].createdAt)) && (
                  <div className="my-4 flex justify-center">
                    <span className="rounded-md bg-gray-200 px-2.5 py-1 text-[11px] font-medium text-gray-500 shadow-sm">{dayLabel(m.createdAt)}</span>
                  </div>
                )}
              <div
                className={`group flex items-start gap-1 ${isMine ? 'justify-end' : 'justify-start'}`}
                onTouchStart={(event) => beginLongPress(event, m)}
                onTouchEnd={endLongPress}
                onTouchCancel={stopLongPress}
                onTouchMove={stopLongPress}
              >
                <article className={messageIsChat
                  ? `relative max-w-[86%] rounded-lg border px-2.5 py-1.5 shadow-sm sm:max-w-[72%] sm:px-3 sm:py-2 ${isMine ? 'border-[#dcf8c6] bg-[#dcf8c6]' : 'border-white bg-white'}`
                  : 'relative w-full rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5'}
                >
                  {!messageIsChat && (
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-accent/10 text-center text-xs font-semibold leading-10 text-accent">
                          <img
                            src={avatarUrl(m.from)}
                            alt=""
                            className="h-full w-full object-cover"
                            loading="lazy"
                            onError={(event) => { event.currentTarget.style.display = 'none'; }}
                          />
                          {initials(m.from)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1 truncate text-sm font-semibold">
                            <span className="truncate">{m.from}</span>
                            {m.senderVerified && <VerifiedBadge className="h-4 w-4" />}
                          </div>
                          <div className="truncate text-xs text-gray-500">
                            <span className="font-medium text-gray-600">From:</span> {m.from || '—'}
                          </div>
                          <div className="truncate text-xs text-gray-500">
                            <span className="font-medium text-gray-600">To:</span> {to.join(', ') || '—'}
                            {cc.length > 0 && <> · <span className="font-medium text-gray-600">Cc:</span> {cc.join(', ')}</>}
                          </div>
                        </div>
                      </div>
                      <span className="text-xs text-gray-400">{when}</span>
                    </div>
                  )}

                  {m.bodyHtml ? (
                    <div
                      className={messageIsChat
                        ? 'email-content max-w-full overflow-x-auto break-words text-[15px] leading-6 text-gray-800'
                        : 'email-content mt-3 max-w-full overflow-x-auto break-words text-sm text-gray-800'}
                      dangerouslySetInnerHTML={{
                        __html: DOMPurify.sanitize(m.bodyHtml, {
                          USE_PROFILES: { html: true },
                          FORBID_TAGS: ['form', 'input', 'button', 'iframe', 'object', 'embed'],
                        }),
                      }}
                    />
                  ) : (
                    <div className={messageIsChat
                      ? 'whitespace-pre-wrap break-words text-[15px] leading-6 text-gray-800'
                      : 'mt-3 whitespace-pre-wrap break-words text-sm text-gray-800'}
                    >
                      {m.bodyText}
                    </div>
                  )}

                  {messageIsChat && (
                    <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-gray-600">
                      {!isMine && m.senderVerified && <VerifiedBadge className="h-3 w-3" />}
                      <span>{when}</span>
                    </div>
                  )}

                  {!messageIsChat && (m.attachments?.length || 0) > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {m.attachments.map((a) => (
                        <button key={a.id} onClick={() => openAttachment(a.id)} className="chip bg-gray-100 text-gray-700 hover:bg-gray-200">
                          <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M8 4a3 3 0 016 0v6a5 5 0 01-10 0V6a1 1 0 112 0v4a3 3 0 006 0V4a1 1 0 10-2 0v6a3 3 0 01-6 0V4z" clipRule="evenodd" />
                          </svg>
                          {a.filename} <span className="text-gray-400">({kb(a.size_bytes)})</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {!messageIsChat && (to.length > 0 || cc.length > 0) && (
                    <div className="mt-2 text-[10px] text-gray-400">
                      <span className="font-medium text-gray-500">From:</span> {m.from || '—'} · <span className="font-medium text-gray-500">To:</span> {to.join(', ') || '—'}
                      {cc.length > 0 && <> · <span className="font-medium text-gray-500">Cc:</span> {cc.join(', ')}</>}
                    </div>
                  )}
                </article>
                <button
                  className="mt-1 hidden h-7 w-7 shrink-0 place-items-center rounded-full bg-black/5 text-gray-500 opacity-0 transition hover:bg-black/10 hover:text-gray-800 focus:opacity-100 group-hover:opacity-100 sm:grid"
                  onMouseDown={(event) => event.stopPropagation()}
                  onClick={(event) => openMessageMenu(event, m)}
                  aria-label="More message actions"
                  title="More message actions"
                >
                  <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <circle cx="4" cy="10" r="1.5" />
                    <circle cx="10" cy="10" r="1.5" />
                    <circle cx="16" cy="10" r="1.5" />
                  </svg>
                </button>
              </div>
              </Fragment>
            );
          })}
        </div>
      </div>

      {messageMenuId && menuMessage && (() => {
        const menuIsChat = menuMessage.mode === 'chat';
        const menuIsMine = Boolean(myAddress && String(menuMessage.from || '').trim().toLowerCase() === myAddress);
        const menuInTrash = folder === 'TRASH' || menuMessage.folder === 'TRASH';
        const menuReplyable = menuMessage.replyable !== false;
        const parties = new Set();
        if (menuMessage.from) parties.add(String(menuMessage.from).toLowerCase());
        (menuMessage.recipients || []).forEach((r) => { if (r.address) parties.add(String(r.address).toLowerCase()); });
        parties.delete(myAddress);
        const canReplyAll = parties.size > 1;
        const close = () => setMessageMenuId(null);
        const run = (fn) => (event) => { event.stopPropagation(); close(); fn(); };

        return (
          <div
            ref={menuRef}
            className="fixed z-50 w-60 text-gray-100"
            style={{
              left: Math.min(Math.max(8, messageMenuPosition.x - 120), window.innerWidth - 248),
              top: Math.max(16, Math.min(messageMenuPosition.y, window.innerHeight - 360)),
            }}
          >
            <div className="rounded-2xl border border-white/10 bg-[#202020] p-1 shadow-2xl">
              {menuInTrash ? (
                // Trash is a graveyard: only restore, copy, or destroy for good.
                <>
                  <MenuItem icon="restore" label="Restore to Inbox" onClick={run(() => recover(menuMessage))} />
                  <MenuItem icon="copy" label="Copy text" onClick={run(() => copyMessage(menuMessage))} />
                  <MenuDivider />
                  <MenuItem icon="trash" label="Delete permanently" danger onClick={run(() => permanentlyDelete(menuMessage))} />
                </>
              ) : menuIsChat ? (
                // Chat: quick, messaging-style actions.
                <>
                  {menuReplyable && <MenuItem icon="reply" label="Reply" onClick={run(() => onReply?.(menuMessage))} />}
                  <MenuItem icon="copy" label="Copy" onClick={run(() => copyMessage(menuMessage))} />
                  {menuIsMine && <MenuItem icon="edit" label="Edit" onClick={run(() => editChatMessage(menuMessage))} />}
                  <MenuItem icon="star" label={menuMessage.isStarred ? 'Unstar' : 'Star'} starred={menuMessage.isStarred} onClick={run(() => toggleStar(menuMessage))} />
                  <MenuDivider />
                  <MenuItem icon="trash" label="Delete" danger onClick={run(() => trashOne(menuMessage))} />
                </>
              ) : (
                // Mail: the fuller email action set.
                <>
                  {menuReplyable && <MenuItem icon="reply" label="Reply" onClick={run(() => onReply?.(menuMessage))} />}
                  {menuReplyable && canReplyAll && <MenuItem icon="replyAll" label="Reply all" onClick={run(() => onReplyAll?.(menuMessage))} />}
                  <MenuItem icon="forward" label="Forward" onClick={run(() => onForward?.(menuMessage))} />
                  <MenuDivider />
                  <MenuItem icon="star" label={menuMessage.isStarred ? 'Unstar' : 'Star'} starred={menuMessage.isStarred} onClick={run(() => toggleStar(menuMessage))} />
                  <MenuItem icon="unread" label="Mark as unread" onClick={run(() => markMessageUnread(menuMessage))} />
                  <MenuItem icon="copy" label="Copy" onClick={run(() => copyMessage(menuMessage))} />
                  <MenuDivider />
                  <MenuItem icon="trash" label="Delete" danger onClick={run(() => trashOne(menuMessage))} />
                </>
              )}
            </div>
          </div>
        );
      })()}

      {/* Composer visibility is a real decision, not a default:
          • Trash is read-only → no composer.
          • A send-only sender (no-reply@ and friends, replyable === false) →
            show a clear non-action state instead of a misleading empty input. */}
      {folder !== 'TRASH' && last && (
        last.replyable === false ? (
          <div className="shrink-0 border-t border-gray-200 bg-[#f7f7f7] px-4 py-3">
            <div className="mx-auto flex w-full max-w-3xl items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 bg-white px-4 py-3 text-sm text-gray-500">
              <svg className="h-4 w-4 shrink-0 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="m2 2 20 20" />
              </svg>
              This address doesn’t accept replies.
            </div>
          </div>
        ) : (
          <Compose
            inline
            initial={{
              to: [last.from],
              subject: /^re:/i.test(last.subject) ? last.subject : `Re: ${last.subject}`,
              inReplyTo: last.rfcMessageId,
            }}
            onSent={() => { onChanged?.(); }}
            onCompose={onCompose}
            onExpand={() => onReply?.(last)}
            onModeChange={setLayoutMode}
            chatMode={isChatMode}
          />
        )
      )}
    </div>
  );
}

