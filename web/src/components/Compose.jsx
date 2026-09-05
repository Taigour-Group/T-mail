import { useState } from 'react';
import { api } from '../lib/api.js';

function parseAddrs(s) {
  return (s || '').split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean);
}

export default function Compose({ initial = {}, onClose, onSent }) {
  const [to, setTo] = useState((initial.to || []).join(', '));
  const [cc, setCc] = useState((initial.cc || []).join(', '));
  const [bcc, setBcc] = useState('');
  const [showCc, setShowCc] = useState(Boolean(initial.cc && initial.cc.length));
  const [subject, setSubject] = useState(initial.subject || '');
  const [body, setBody] = useState(initial.body || '');
  const [attachments, setAttachments] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

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

  async function send() {
    setErr('');
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
        bodyText: body,
        inReplyTo: initial.inReplyTo || undefined,
        attachments,
      });
      if (res.undeliverable?.length) {
        setErr(`Sent, but these external addresses were not delivered (internal-only for now): ${res.undeliverable.join(', ')}`);
        setBusy(false);
        return;
      }
      onSent?.();
    } catch (ex) {
      setErr(ex.message);
      setBusy(false);
    }
  }

  async function saveDraft() {
    setBusy(true);
    try {
      await api.saveDraft({ to: parseAddrs(to), cc: parseAddrs(cc), bcc: parseAddrs(bcc), subject, bodyText: body });
      onClose?.();
    } catch (ex) {
      setErr(ex.message);
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/30 grid place-items-center p-4" onClick={onClose}>
      <div className="card w-full max-w-2xl p-0 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-4 h-11 flex items-center justify-between bg-gray-900 text-white">
          <span className="text-sm font-medium">New message</span>
          <button onClick={onClose} className="text-gray-300 hover:text-white" aria-label="Close">✕</button>
        </div>

        <div className="p-4 space-y-2">
          {err && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{err}</div>}
          <div className="flex items-center gap-2">
            <input className="input" placeholder="To" value={to} onChange={(e) => setTo(e.target.value)} />
            {!showCc && (
              <button className="text-sm text-accent whitespace-nowrap" onClick={() => setShowCc(true)}>
                Cc/Bcc
              </button>
            )}
          </div>
          {showCc && <input className="input" placeholder="Cc" value={cc} onChange={(e) => setCc(e.target.value)} />}
          {showCc && <input className="input" placeholder="Bcc" value={bcc} onChange={(e) => setBcc(e.target.value)} />}
          <input className="input" placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
          <textarea className="textarea" placeholder="Write your message…" value={body} onChange={(e) => setBody(e.target.value)} />
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {attachments.map((a, i) => (
                <span key={i} className="chip bg-gray-100 text-gray-700">
                  {a.filename}
                  <button
                    className="ml-1 text-gray-400 hover:text-red-500"
                    onClick={() => setAttachments((x) => x.filter((_, j) => j !== i))}
                    aria-label={`Remove ${a.filename}`}
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="px-4 py-3 border-t border-gray-200 flex items-center gap-3">
          <button className="btn-primary" disabled={busy} onClick={send}>{busy ? 'Sending…' : 'Send'}</button>
          <button className="btn-ghost" disabled={busy} onClick={saveDraft}>Save draft</button>
          <label className="btn-ghost cursor-pointer">
            Attach
            <input type="file" multiple className="hidden" onChange={onFile} />
          </label>
        </div>
      </div>
    </div>
  );
}
