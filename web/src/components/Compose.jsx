import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import FormatToolbar from './FormatToolbar.jsx';
import EmojiPicker from './EmojiPicker.jsx';

// ════════════════════════════════════════════════════════════════════════════
// Compose — one component, three surfaces:
//   • inline   → the reply bar docked under a thread (compact, expands on focus)
//   • full     → the full-screen "New Message" composer (mail)
//   • directChat → the WhatsApp-style new-chat sheet
//
// Design rules this rewrite enforces (previous version violated all three):
//   1. ONE formatting toolbar (FormatToolbar), never hand-duplicated per surface.
//   2. NO duplicate actions in a single surface — each action appears once, in a
//      clear hierarchy: [Send] primary, then attach/format, then discard.
//   3. Mail vs Chat is a VISIBLE toggle, not a hidden "/chat" slash command. The
//      chosen mode decides how the NEXT message is sent (mode: 'mail'|'chat').
//
// The rich editor stays uncontrolled (seed innerHTML once, read it on send) so the
// caret never jumps — that bug was fixed before and we keep the pattern.
// ════════════════════════════════════════════════════════════════════════════

function parseAddrs(s) {
  return (s || '').split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean);
}

function Icon({ name, className = 'h-4 w-4' }) {
  const paths = {
    send: <><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></>,
    paperclip: <path d="M8 4a3 3 0 016 0v6a5 5 0 01-10 0V6a1 1 0 112 0v4a3 3 0 006 0V4a1 1 0 10-2 0v6a3 3 0 01-6 0V4z" />,
    format: <><path d="M4 7V4h16v3M9 20h6M12 4v16" /></>,
    trash: <><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    back: <path d="m15 18-6-6 6-6" />,
    close: <><path d="M18 6 6 18M6 6l12 12" /></>,
    mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>,
    chat: <path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7a8.5 8.5 0 0 1-.9-3.8 8.38 8.38 0 0 1 8.5-8.5A8.5 8.5 0 0 1 21 11.5Z" />,
  };
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

function ModeToggle({ mode, onChange }) {
  return (
    <div className="inline-flex overflow-hidden rounded-full border border-gray-200 bg-gray-50 p-0.5 text-xs" role="group" aria-label="Message mode">
      {['mail', 'chat'].map((value) => (
        <button
          key={value}
          type="button"
          onClick={() => onChange(value)}
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-medium capitalize transition ${
            mode === value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
          aria-pressed={mode === value}
        >
          <Icon name={value} className="h-3.5 w-3.5" />
          {value}
        </button>
      ))}
    </div>
  );
}

function AttachmentChips({ attachments, onRemove }) {
  if (!attachments.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {attachments.map((a, i) => (
        <span key={i} className="chip bg-gray-100 text-gray-700">
          {a.filename}
          <button className="ml-1 text-gray-400 hover:text-red-500" onClick={() => onRemove(i)} aria-label={`Remove ${a.filename}`}>✕</button>
        </span>
      ))}
    </div>
  );
}

export default function Compose({
  initial = {},
  onClose,
  onSent,
  inline = false,
  onCompose,
  onExpand,
  onModeChange,
  chatMode = false,
  directChat = false,
}) {
  const [to, setTo] = useState((initial.to || []).join(', '));
  const [cc, setCc] = useState((initial.cc || []).join(', '));
  const [bcc, setBcc] = useState('');
  const [showCc, setShowCc] = useState(Boolean(initial.cc && initial.cc.length));
  const [subject, setSubject] = useState(initial.subject || '');
  const [body, setBody] = useState(initial.body || '');
  const [bodyHtml, setBodyHtml] = useState(initial.bodyHtml || '');
  const [attachments, setAttachments] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [notice, setNotice] = useState('');
  // 'mail' | 'chat' — the mode the NEXT sent message will use.
  const [composeMode, setComposeMode] = useState(chatMode || directChat ? 'chat' : 'mail');
  const [expanded, setExpanded] = useState(false); // inline reply expanded into a mail card
  const [showFormatting, setShowFormatting] = useState(false);
  const editorRef = useRef(null);
  const textareaRef = useRef(null);

  // Keep the reply bar's mode in sync when the thread's layout mode changes.
  useEffect(() => { setComposeMode(chatMode || directChat ? 'chat' : 'mail'); }, [chatMode, directChat]);

  // The rich editor is only mounted for mail mode. Seed it once when it appears;
  // do NOT rebind innerHTML on every render (that resets the caret).
  const richEditorActive = composeMode === 'mail' && (!inline || expanded);
  useEffect(() => {
    if (!richEditorActive || !editorRef.current) return;
    const html = bodyHtml || body || '';
    if (editorRef.current.innerHTML !== html) editorRef.current.innerHTML = html;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [richEditorActive]);

  function readEditor() {
    if (richEditorActive && editorRef.current) {
      return { text: editorRef.current.innerText, html: editorRef.current.innerHTML };
    }
    return { text: body, html: bodyHtml };
  }

  async function onFile(e) {
    const files = [...e.target.files];
    e.target.value = '';
    for (const f of files) {
      try {
        const meta = await api.uploadAttachment(f);
        setAttachments((a) => [...a, meta]);
      } catch (ex) {
        setErr(ex.message);
      }
    }
  }

  function switchMode(next) {
    setComposeMode(next);
    onModeChange?.(next); // let the thread mirror the layout, if it wants to
  }

  async function send() {
    const { text, html } = readEditor();
    const trimmedBody = text.trim();
    if (!trimmedBody && !attachments.length) {
      setErr('Write a message first');
      return;
    }

    setErr('');
    setNotice('');

    // Reply bar seeds `to` from initial; full compose requires an explicit recipient.
    const toList = parseAddrs(to);
    if (toList.length === 0) {
      setErr('Add at least one recipient');
      return;
    }

    setBusy(true);
    try {
      const res = await api.send({
        to: toList,
        cc: parseAddrs(cc),
        bcc: parseAddrs(bcc),
        subject,
        bodyText: text,
        bodyHtml: composeMode === 'mail' ? (html || undefined) : undefined,
        mode: composeMode,
        inReplyTo: initial.inReplyTo || undefined,
        attachments,
      });
      if (res.undeliverable?.length) {
        // Not a hard failure — the message was delivered internally. Surface which
        // external addresses were skipped so the user isn't misled.
        setNotice(`Sent. External delivery is off, so these weren't reached: ${res.undeliverable.join(', ')}`);
      }
      setBody('');
      setBodyHtml('');
      if (editorRef.current) editorRef.current.innerHTML = '';
      setAttachments([]);
      setBusy(false);
      if (inline) setExpanded(false);
      onSent?.();
    } catch (ex) {
      setErr(ex.message);
      setBusy(false);
    }
  }

  async function saveDraft() {
    const { text } = readEditor();
    setBusy(true);
    try {
      await api.saveDraft({ to: parseAddrs(to), cc: parseAddrs(cc), bcc: parseAddrs(bcc), subject, bodyText: text });
      onClose?.();
    } catch (ex) {
      setErr(ex.message);
      setBusy(false);
    }
  }

  function formatMail(command, value = null) {
    editorRef.current?.focus();
    // Color commands need CSS styling turned on; hiliteColor also isn't supported
    // everywhere, so fall back to backColor when it reports failure.
    if (command === 'foreColor' || command === 'hiliteColor') {
      try { document.execCommand('styleWithCSS', false, true); } catch { /* ignore */ }
    }
    const applied = document.execCommand(command, false, value);
    if (!applied && command === 'hiliteColor') {
      document.execCommand('backColor', false, value);
    }
    if (editorRef.current) {
      setBody(editorRef.current.innerText);
      setBodyHtml(editorRef.current.innerHTML);
    }
  }
  const onLink = () => { const url = window.prompt('Link URL'); if (url) formatMail('createLink', url); };
  const onSignature = () => { const s = window.prompt('Signature text', 'Best regards,'); if (s) formatMail('insertText', `\n\n${s}`); };

  // Chat/plain-textarea emoji insert: drop the glyph at the caret (or append),
  // then restore the caret just after it. Chat mode has no rich editor, so this
  // is the plain-text counterpart to the toolbar's insertText.
  function insertChatEmoji(emoji) {
    const el = textareaRef.current;
    if (!el) { setBody((b) => b + emoji); return; }
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    const next = body.slice(0, start) + emoji + body.slice(end);
    setBody(next);
    requestAnimationFrame(() => {
      el.focus();
      const caret = start + emoji.length;
      try { el.setSelectionRange(caret, caret); } catch { /* ignore */ }
    });
  }
  const toolbar = (
    <FormatToolbar onFormat={formatMail} onLink={onLink} onSignature={onSignature} onImage={onFile} />
  );

  const canSend = !busy && (body.trim().length > 0 || attachments.length > 0);

  // ── Surface 1: inline reply bar ───────────────────────────────────────────
  if (inline) {
    const isChat = composeMode === 'chat';
    return (
      <div className="shrink-0 border-t border-gray-200 bg-[#f7f7f7] px-2 py-2 sm:px-5 sm:py-3">
        <div className="mx-auto w-full max-w-3xl">
          {(err || notice) && (
            <div className={`mb-2 rounded-lg px-3 py-1.5 text-xs ${err ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-700'}`}>
              {err || notice}
            </div>
          )}

          {/* When expanded into a mail reply, show recipient context + toolbar. */}
          {isChat === false && expanded && (
            <div className="mb-2 rounded-xl border border-gray-300 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-gray-100 px-3 py-1.5 text-xs text-gray-500">
                <span className="truncate">To <strong className="font-medium text-gray-700">{to || '—'}</strong></span>
                <button className="text-gray-400 hover:text-gray-700" onClick={() => setExpanded(false)} aria-label="Collapse reply">Collapse</button>
              </div>
              <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                className="min-h-[150px] w-full overflow-y-auto px-3 py-2 text-sm text-gray-800 outline-none"
                onInput={(e) => { setBody(e.currentTarget.innerText); setBodyHtml(e.currentTarget.innerHTML); }}
                onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) send(); }}
                aria-label="Rich email reply"
              />
              <div className="border-t border-gray-100 px-2 py-1.5">{toolbar}</div>
            </div>
          )}

          <div className="flex items-end gap-2">
            {onCompose && (
              <button
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-gray-200 bg-white text-gray-500 transition hover:bg-gray-100 hover:text-gray-800"
                onClick={onCompose}
                aria-label="Compose new message"
                title="Compose new message"
              >
                <Icon name="plus" />
              </button>
            )}

            <div className="flex flex-1 items-end gap-1 rounded-[22px] border border-gray-200 bg-white px-2 py-1 shadow-sm">
              {/* Collapsed input. In mail mode, focusing expands into the card above. */}
              {!(isChat === false && expanded) && (
                <textarea
                  ref={textareaRef}
                  className="max-h-32 min-h-[38px] flex-1 resize-none bg-transparent px-2 py-2 text-sm text-gray-800 outline-none placeholder:text-gray-400"
                  placeholder={isChat ? 'Message' : 'Reply…'}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  onFocus={() => { if (!isChat) setExpanded(true); }}
                  onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) send(); }}
                  aria-label={isChat ? 'Chat message' : 'Reply message'}
                />
              )}
              {(isChat === false && expanded) && (
                <span className="flex-1 px-2 py-2 text-sm text-gray-400">Reply is open above</span>
              )}
              {isChat && (
                <EmojiPicker
                  onSelect={insertChatEmoji}
                  triggerClassName="grid h-9 w-9 shrink-0 place-items-center rounded-full text-gray-500 transition hover:bg-gray-100 hover:text-gray-800"
                />
              )}
              <label className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-full text-gray-500 transition hover:bg-gray-100 hover:text-gray-800" title="Attach file" aria-label="Attach file">
                <Icon name="paperclip" />
                <input type="file" multiple className="hidden" onChange={onFile} />
              </label>
            </div>

            <button
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#1f6feb] text-white shadow-sm transition hover:bg-[#1858c8] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!canSend}
              onClick={send}
              aria-label={busy ? 'Sending' : 'Send'}
              title="Send"
            >
              <Icon name="send" />
            </button>
          </div>

          <AttachmentChips attachments={attachments} onRemove={(i) => setAttachments((x) => x.filter((_, j) => j !== i))} />

          <div className="mt-1.5 flex items-center justify-between px-1">
            <ModeToggle mode={composeMode} onChange={switchMode} />
            {onExpand && composeMode === 'mail' && (
              <button className="text-xs text-gray-500 hover:text-accent" onClick={onExpand}>Full composer</button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Surface 2 + 3: full mail composer / direct chat sheet ─────────────────
  return (
    <div className={`fixed inset-0 z-50 ${directChat ? 'grid place-items-center bg-black/30 p-4' : 'bg-white'}`} onClick={onClose}>
      <div
        className={`pointer-events-auto flex h-full w-full flex-col overflow-hidden bg-white ${
          directChat ? 'max-h-[calc(100vh-2rem)] max-w-md rounded-2xl border border-gray-300 shadow-2xl' : ''
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`flex h-14 shrink-0 items-center gap-3 px-4 ${directChat ? 'bg-[#202c33] text-white' : 'border-b border-gray-200 bg-white text-gray-700'}`}>
          {!directChat && (
            <button onClick={onClose} className="inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900" aria-label="Back to inbox">
              <Icon name="back" />Back
            </button>
          )}
          <div className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{directChat ? 'New chat' : 'New message'}</span>
            {directChat && <span className="block truncate text-xs text-[#aebac1]">{to}</span>}
          </div>
          {!directChat && <ModeToggle mode={composeMode} onChange={switchMode} />}
          {directChat && <button onClick={onClose} className="text-gray-300 hover:text-white" aria-label="Close"><Icon name="close" /></button>}
        </div>

        {/* Body */}
        <div className={`flex-1 space-y-2 overflow-y-auto ${directChat ? 'bg-[#efeae2] p-3' : 'p-4'}`}>
          {err && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{err}</div>}
          {notice && <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">{notice}</div>}

          {!directChat && (
            <>
              <div className="flex items-center gap-2">
                <input className="input flex-1" placeholder="To" value={to} onChange={(e) => setTo(e.target.value)} />
                {!showCc && <button className="whitespace-nowrap text-sm text-accent" onClick={() => setShowCc(true)}>Cc/Bcc</button>}
              </div>
              {showCc && <input className="input" placeholder="Cc" value={cc} onChange={(e) => setCc(e.target.value)} />}
              {showCc && <input className="input" placeholder="Bcc" value={bcc} onChange={(e) => setBcc(e.target.value)} />}
              {composeMode === 'mail' && (
                <input className="w-full border-0 border-b border-gray-200 px-3 py-2 text-sm outline-none focus:border-accent" placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
              )}
            </>
          )}

          {composeMode === 'mail' && !directChat ? (
            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              className="min-h-[250px] w-full px-3 py-3 text-sm text-gray-800 outline-none"
              onInput={(e) => { setBody(e.currentTarget.innerText); setBodyHtml(e.currentTarget.innerHTML); }}
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) send(); }}
              aria-label="Rich email message"
            />
          ) : (
            <textarea
              ref={textareaRef}
              className={directChat
                ? 'min-h-[120px] w-full resize-none rounded-xl border border-gray-200 bg-white p-3 text-sm outline-none focus:border-accent'
                : 'textarea'}
              placeholder={composeMode === 'chat' ? 'Type a message' : 'Write your message…'}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          )}

          <AttachmentChips attachments={attachments} onRemove={(i) => setAttachments((x) => x.filter((_, j) => j !== i))} />
        </div>

        {/* Footer / action bar */}
        <div className={`border-t border-gray-200 px-4 py-3 ${directChat ? 'bg-[#f0f2f5]' : ''}`}>
          {directChat ? (
            <div className="flex items-center gap-2">
              <EmojiPicker
                onSelect={insertChatEmoji}
                triggerClassName="grid h-10 w-10 shrink-0 place-items-center rounded-full text-gray-500 hover:bg-gray-200"
              />
              <label className="grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-full text-gray-500 hover:bg-gray-200" title="Attach file" aria-label="Attach file">
                <Icon name="paperclip" className="h-5 w-5" />
                <input type="file" multiple className="hidden" onChange={onFile} />
              </label>
              <button
                className="ml-auto grid h-10 w-10 place-items-center rounded-full bg-[#128c7e] text-white shadow-sm disabled:opacity-50"
                disabled={!canSend}
                onClick={send}
                aria-label="Send message"
              >
                <Icon name="send" />
              </button>
            </div>
          ) : (
            <>
              {/* Formatting toolbar: mail mode only, toggled, single instance. */}
              {composeMode === 'mail' && showFormatting && (
                <div className="mb-3 border-b border-gray-200 pb-2">{toolbar}</div>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  className="rounded-full bg-[#0b57d0] px-6 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[#0847ad] disabled:opacity-50"
                  disabled={!canSend}
                  onClick={send}
                >
                  {busy ? 'Sending…' : 'Send'}
                </button>
                <button className="btn-ghost" disabled={busy} onClick={saveDraft}>Save draft</button>

                {composeMode === 'mail' && (
                  <button
                    type="button"
                    className={`grid h-9 w-9 place-items-center rounded-lg text-gray-500 hover:bg-gray-100 ${showFormatting ? 'bg-gray-100 text-gray-800' : ''}`}
                    onClick={() => setShowFormatting((v) => !v)}
                    aria-label="Formatting options"
                    aria-pressed={showFormatting}
                    title="Formatting options"
                  >
                    <Icon name="format" />
                  </button>
                )}
                <label className="grid h-9 w-9 cursor-pointer place-items-center rounded-lg text-gray-500 hover:bg-gray-100" title="Attach files" aria-label="Attach files">
                  <Icon name="paperclip" />
                  <input type="file" multiple className="hidden" onChange={onFile} />
                </label>

                <button type="button" className="ml-auto grid h-9 w-9 place-items-center rounded-lg text-gray-500 hover:bg-gray-100" onClick={onClose} aria-label="Discard" title="Discard">
                  <Icon name="trash" />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
