import { Link } from 'react-router-dom';

const FOLDERS = [
  { key: 'INBOX', label: 'Inbox' },
  { key: 'STARRED', label: 'Starred' },
  { key: 'SENT', label: 'Sent' },
  { key: 'DRAFT', label: 'Drafts' },
  { key: 'TRASH', label: 'Trash' },
];

export default function Sidebar({
  folder, labelId, labels, onSelectFolder, onSelectLabel, onCompose, onCreateLabel, user, onLogout,
}) {
  return (
    <aside className="w-60 shrink-0 border-r border-gray-200 bg-white flex flex-col">
      <div className="p-4">
        <div className="text-xl font-bold tracking-tight mb-4 px-1">tmail</div>
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
        <Link to="/guide" className="nav-item mt-4">
          <span>OTP integration guide</span>
        </Link>
        <Link to="/workspace" className="nav-item">
          <span>Workspace dashboard</span>
        </Link>
      </nav>

      <div className="border-t border-gray-200 p-3">
        <div className="text-sm font-medium truncate">{user?.name || user?.address}</div>
        <div className="text-xs text-gray-500 truncate mb-2">{user?.address}</div>
        <button className="btn-ghost w-full justify-start px-2" onClick={onLogout}>Sign out</button>
      </div>
    </aside>
  );
}
