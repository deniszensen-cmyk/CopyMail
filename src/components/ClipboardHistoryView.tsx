import { useMemo, useState } from 'react';
import { Pin, PinOff, Trash2, Copy, Search, Mail, Clipboard, AlertCircle } from 'lucide-react';
import type { ClipboardEntry } from '../utils/clipboardHistory';

interface Props {
  entries: ClipboardEntry[];
  watcherActive: boolean;
  onTogglePin: (id: string) => void;
  onRemove: (id: string) => void;
  onCopy: (entry: ClipboardEntry) => void;
  onClearUnpinned: () => void;
  onActivateWatcher?: () => void;
}

export function ClipboardHistoryView({
  entries,
  watcherActive,
  onTogglePin,
  onRemove,
  onCopy,
  onClearUnpinned,
  onActivateWatcher,
}: Props) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((e) =>
      `${e.subject} ${e.from} ${e.snippet}`.toLowerCase().includes(q),
    );
  }, [entries, query]);

  const unpinnedCount = entries.filter((e) => !e.pinned).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 320 }}>
      {!watcherActive && (
        <div
          style={{
            display: 'flex',
            gap: 10,
            padding: '10px 12px',
            marginBottom: 10,
            borderRadius: 6,
            background: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            alignItems: 'flex-start',
            fontSize: '0.85em',
          }}
        >
          <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 2, color: '#f59e0b' }} />
          <div style={{ flex: 1 }}>
            <strong>Nur CopyMail-Forwards werden erfasst.</strong>
            <div style={{ opacity: 0.8, marginTop: 2 }}>
              System-weite Zwischenablage (alles was Sie außerhalb von CopyMail mit
              Strg+C kopieren) ist aktuell aus. In den Einstellungen aktivieren oder
              hier direkt:
            </div>
            {onActivateWatcher && (
              <button
                className="btn-secondary small"
                onClick={onActivateWatcher}
                style={{ marginTop: 6 }}
              >
                System-Zwischenablage beobachten
              </button>
            )}
          </div>
        </div>
      )}

      <div
        style={{
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          marginBottom: 10,
        }}
      >
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'rgba(255,255,255,0.06)',
            borderRadius: 6,
            padding: '6px 10px',
            flex: 1,
          }}
        >
          <Search size={14} />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="In Verlauf suchen…"
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'inherit',
              flex: 1,
              fontSize: '0.9em',
            }}
          />
        </label>
        {unpinnedCount > 0 && (
          <button
            className="btn-secondary small"
            onClick={onClearUnpinned}
            title="Alle nicht-gepinnten Einträge entfernen"
            style={{ fontSize: '0.8em' }}
          >
            <Trash2 size={12} /> Ungepinnte löschen ({unpinnedCount})
          </button>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', maxHeight: '50vh' }}>
        {filtered.length === 0 ? (
          <p style={{ opacity: 0.6, fontSize: '0.9em', padding: '32px 12px', textAlign: 'center' }}>
            {entries.length === 0
              ? watcherActive
                ? 'Noch leer — kopieren Sie etwas aus einer beliebigen App (Strg+C), dann erscheint es hier.'
                : 'Noch leer — sobald Sie eine Mail kopieren, erscheint sie hier.'
              : 'Keine Treffer für die Suche.'}
          </p>
        ) : (
          filtered.map((e) => (
            <HistoryCard
              key={e.id}
              entry={e}
              onTogglePin={() => onTogglePin(e.id)}
              onRemove={() => onRemove(e.id)}
              onCopy={() => onCopy(e)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function HistoryCard({
  entry,
  onTogglePin,
  onRemove,
  onCopy,
}: {
  entry: ClipboardEntry;
  onTogglePin: () => void;
  onRemove: () => void;
  onCopy: () => void;
}) {
  return (
    <article
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        padding: '10px 12px',
        marginBottom: 6,
        borderRadius: 6,
        background: entry.pinned ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255,255,255,0.04)',
        border: '1px solid ' + (entry.pinned ? 'rgba(99, 102, 241, 0.4)' : 'rgba(255,255,255,0.06)'),
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontWeight: 600,
              fontSize: '0.9em',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
            title={entry.subject}
          >
            <span
              style={{ opacity: 0.7, flexShrink: 0, display: 'inline-flex' }}
              title={entry.source === 'system' ? 'System-Zwischenablage' : 'CopyMail-Forward'}
            >
              {entry.source === 'system' ? <Clipboard size={12} /> : <Mail size={12} />}
            </span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{entry.subject}</span>
          </div>
          <div style={{ fontSize: '0.75em', opacity: 0.7, marginTop: 1 }}>
            {entry.source === 'system' ? 'Zwischenablage' : entry.from || '—'}
            {entry.fileCount > 0 && (
              <span style={{ marginLeft: 6, opacity: 0.85 }}>
                · {entry.fileCount} {entry.fileCount === 1 ? 'Datei' : 'Dateien'}
              </span>
            )}
            <span style={{ marginLeft: 6 }}>· {formatRelativeTime(entry.capturedAt)}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 2 }}>
          <button className="btn-icon small" onClick={onCopy} title="Erneut in Zwischenablage kopieren" aria-label="Erneut kopieren">
            <Copy size={14} />
          </button>
          <button
            className="btn-icon small"
            onClick={onTogglePin}
            title={entry.pinned ? 'Pin entfernen' : 'Anpinnen'}
            aria-label={entry.pinned ? 'Pin entfernen' : 'Anpinnen'}
          >
            {entry.pinned ? <PinOff size={14} /> : <Pin size={14} />}
          </button>
          <button className="btn-icon small" onClick={onRemove} title="Aus Verlauf entfernen" aria-label="Entfernen">
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      <div
        style={{
          fontSize: '0.78em',
          opacity: 0.85,
          lineHeight: 1.4,
          display: '-webkit-box',
          WebkitLineClamp: 3,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {entry.snippet || '(leer)'}
      </div>
    </article>
  );
}

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'gerade';
  if (diff < 3_600_000) return `vor ${Math.floor(diff / 60_000)} Min`;
  if (diff < 86_400_000) return `vor ${Math.floor(diff / 3_600_000)} Std`;
  const days = Math.floor(diff / 86_400_000);
  if (days < 7) return `vor ${days} Tg`;
  const d = new Date(ts);
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });
}
