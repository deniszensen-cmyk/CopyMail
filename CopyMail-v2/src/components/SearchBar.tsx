import { useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';

interface Props {
  open: boolean;
  query: string;
  onChange: (q: string) => void;
  onClose: () => void;
}

export function SearchBar({ open, query, onChange, onClose }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (open) ref.current?.focus(); }, [open]);
  if (!open) return null;
  return (
    <div className="search-bar" role="search">
      <Search size={14} />
      <input
        ref={ref}
        type="text"
        value={query}
        onChange={(e) => onChange(e.target.value)}
        placeholder="In Mail suchen…"
        onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); onClose(); } }}
      />
      <button className="btn-icon small" onClick={onClose} aria-label="Suche schließen" title="Schließen (Esc)">
        <X size={14} />
      </button>
    </div>
  );
}
