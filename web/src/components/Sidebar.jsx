const FOLDERS = [
  { key: 'INBOX', label: 'Inbox' },
  { key: 'STARRED', label: 'Starred' },
  { key: 'SENT', label: 'Sent' },
  { key: 'DRAFT', label: 'Drafts' },
  { key: 'TRASH', label: 'Trash' },
];

export default function Sidebar({
  folder, labelId, labels, onSelectFolder, onSelectLabel, onCompose, onCreateLabel, user, onLogout,
  open = false, onClose,
}) {
  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/30 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 border-r border-gray-200 bg-white flex flex-col
          transform transition-transform duration-200 ease-out
          lg:static lg:z-auto lg:w-60 lg:shrink-0 lg:translate-x-0
          ${open ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="p-4">
          <div className="flex items-center justify-between mb-4 px-1">
            <div className="text-xl font-bold tracking-tight">tmail</div>
            <button
              className="lg:hidden text-gray-400 hover:text-gray-700 p-1 -mr-1"
              onClick={onClose}
              aria-label="Close menu"
            >
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
          <button className="btn-primary w-full" onClick={onCompose}>Compose</button>
        </div>

        <nav className="px-3 space-y-1 overflow-y-auto flex-1">
          {FOLDERS.map((f) => (
            <div
              key={f.key}
              className={`nav-item ${folder === f.key && !labelId ? 'nav-item-active' : ''}`}
              onClick={() => onSelectFolder(f.key)}
            >
              <span>{f.label}</span>
            </div>
          ))}

          <div className="pt-4 pb-1 px-3 text-xs font-semibold uppercase tracking-wide text-gray-400 flex items-center justify-between">
            <span>Labels</span>
            <button className="text-accent hover:underline normal-case" onClick={onCreateLabel}>New</button>
          </div>
          {labels.length === 0 && <div className="px-3 py-1 text-sm text-gray-400">No labels yet</div>}
          {labels.map((l) => (
            <div
              key={l.id}
              className={`nav-item ${labelId === l.id ? 'nav-item-active' : ''}`}
              onClick={() => onSelectLabel(l.id)}
            >
              <span className="flex items-center gap-2 truncate">
                <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: l.color }} />
                {l.name}
              </span>
            </div>
          ))}
        </nav>

        <div className="border-t border-gray-200 p-3">
          <div className="text-sm font-medium truncate">{user?.name || user?.address}</div>
          <div className="text-xs text-gray-500 truncate mb-2">{user?.address}</div>
          <button className="btn-ghost w-full justify-start px-2" onClick={onLogout}>Sign out</button>
        </div>
      </aside>
    </>
  );
}
