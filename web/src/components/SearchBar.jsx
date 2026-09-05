import { useEffect, useRef, useState } from 'react';

// Debounced search input. onSearch / onClear should be stable (useCallback).
export default function SearchBar({ onSearch, onClear }) {
  const [q, setQ] = useState('');
  const timer = useRef(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (!q.trim()) {
      onClear?.();
      return undefined;
    }
    timer.current = setTimeout(() => onSearch(q.trim()), 300);
    return () => timer.current && clearTimeout(timer.current);
  }, [q, onSearch, onClear]);

  return (
    <div className="relative flex-1 max-w-xl">
      <input
        className="input pl-9"
        placeholder="Search mail"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <svg className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
        <path
          fillRule="evenodd"
          d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.45 4.39l3.08 3.08a1 1 0 01-1.42 1.42l-3.08-3.08A7 7 0 012 9z"
          clipRule="evenodd"
        />
      </svg>
    </div>
  );
}
