import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import { useDismiss } from '../lib/useDismiss.js';

function initials(nameOrAddress) {
  const base = String(nameOrAddress || '?').split('@')[0].replace(/[._-]+/g, ' ').trim();
  return base.split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase() || '?';
}

export default function FriendSearch({ onStartChat }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [friends, setFriends] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [touched, setTouched] = useState(false); // has a search actually run?

  const panelRef = useRef(null);
  const triggerRef = useRef(null);
  const inputRef = useRef(null);

  // Outside-click + Escape dismissal — the whole point of this redesign.
  const close = () => setOpen(false);
  useDismiss(panelRef, open, close, triggerRef);

  // Focus the field and reset transient state each time the panel opens.
  useEffect(() => {
    if (!open) return;
    setErr('');
    const t = window.setTimeout(() => inputRef.current?.focus(), 20);
    return () => window.clearTimeout(t);
  }, [open]);

  // Debounced live search — no separate "Find" button, results stream in as you
  // type, the way Gmail's people search does.
  useEffect(() => {
    if (!open) return undefined;
    const value = query.trim();
    if (!value) {
      setFriends([]);
      setTouched(false);
      setErr('');
      return undefined;
    }
    setBusy(true);
    const timer = window.setTimeout(async () => {
      try {
        const result = await api.findFriends(value);
        setFriends(result.friends || []);
        setErr('');
      } catch (error) {
        setErr(error.message);
        setFriends([]);
      } finally {
        setBusy(false);
        setTouched(true);
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query, open]);

  function choose(friend) {
    onStartChat?.(friend);
    setOpen(false);
    setQuery('');
    setFriends([]);
    setTouched(false);
  }

  return (
    <div className="relative shrink-0">
      <button
        ref={triggerRef}
        className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition ${
          open ? 'border-accent bg-accent/5 text-accent' : 'border-gray-200 text-gray-600 hover:bg-gray-100 hover:text-gray-900'
        }`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="9" cy="8" r="3.2" />
          <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
          <path d="M18 8v6M15 11h6" />
        </svg>
        <span className="hidden sm:inline">New chat</span>
      </button>

      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Start a chat"
          className="absolute right-0 top-12 z-40 w-[min(92vw,20rem)] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl"
        >
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5">
            <span className="text-sm font-semibold text-gray-900">Start a chat</span>
            <button className="grid h-7 w-7 place-items-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-700" onClick={close} aria-label="Close">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </div>

          <div className="p-3">
            <div className="relative">
              <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.45 4.39l3.08 3.08a1 1 0 01-1.42 1.42l-3.08-3.08A7 7 0 012 9z" clipRule="evenodd" />
              </svg>
              <input
                ref={inputRef}
                className="w-full rounded-full border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm outline-none focus:border-accent focus:bg-white"
                placeholder="Search people by @tgo.com address"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => { if (event.key === 'Escape') close(); }}
              />
            </div>
          </div>

          <div className="max-h-72 overflow-y-auto px-2 pb-2">
            {err && <p className="px-2 py-2 text-xs text-red-600">{err}</p>}

            {!err && !query.trim() && (
              <p className="px-2 py-6 text-center text-xs text-gray-400">Type a name or address to find someone on T-mail.</p>
            )}

            {!err && query.trim() && busy && !touched && (
              <p className="px-2 py-6 text-center text-xs text-gray-400">Searching…</p>
            )}

            {!err && query.trim() && touched && friends.length === 0 && !busy && (
              <p className="px-2 py-6 text-center text-xs text-gray-500">No T-mail friends found.</p>
            )}

            {friends.length > 0 && (
              <div className="space-y-0.5">
                {friends.map((friend) => (
                  <button
                    key={friend.address}
                    className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-gray-100"
                    onClick={() => choose(friend)}
                  >
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent/10 text-xs font-semibold text-accent">
                      {initials(friend.name || friend.address)}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-gray-900">{friend.name || friend.address}</span>
                      {friend.name && friend.name !== friend.address && (
                        <span className="block truncate text-xs text-gray-500">{friend.address}</span>
                      )}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
