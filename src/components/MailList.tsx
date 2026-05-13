import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { motion } from 'framer-motion';
import { snippet, type EmailData } from '../utils/EmailProcessor';

interface Entry {
  data: EmailData;
  path: string | null;
}

interface Props {
  entries: Entry[];
  selectedIndices: Set<number>;
  onToggleSelected: (i: number) => void;
  onSelectAll: (selected: boolean) => void;
  onCopyOne: (i: number) => Promise<{ success: boolean } | void> | void;
  onDragStart: (i: number, e: React.DragEvent) => void;
  reduceMotion?: boolean | null;
}

export function MailList({
  entries, selectedIndices, onToggleSelected, onSelectAll,
  onCopyOne, onDragStart, reduceMotion,
}: Props) {
  const allSelected = entries.length > 0 && entries.every((_, i) => selectedIndices.has(i));

  return (
    <div className="mail-list" role="list">
      <div className="mail-list-bar">
        <label className="mail-list-select-all">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={(e) => onSelectAll(e.target.checked)}
          />
          <span>Alle ({entries.length})</span>
        </label>
        <span className="mail-list-hint">Klick = einzelne Mail kopieren · Häkchen = für Sammelkopie</span>
      </div>
      {entries.map((entry, i) => (
        <MailListItem
          key={`${entry.data.subject}-${i}`}
          index={i}
          entry={entry}
          selected={selectedIndices.has(i)}
          onToggleSelected={() => onToggleSelected(i)}
          onCopyOne={() => onCopyOne(i)}
          onDragStart={(e) => onDragStart(i, e)}
          reduceMotion={reduceMotion}
        />
      ))}
    </div>
  );
}

interface ItemProps {
  index: number;
  entry: Entry;
  selected: boolean;
  onToggleSelected: () => void;
  onCopyOne: () => Promise<{ success: boolean } | void> | void;
  onDragStart: (e: React.DragEvent) => void;
  reduceMotion?: boolean | null;
}

function MailListItem({
  index, entry, selected, onToggleSelected, onCopyOne, onDragStart, reduceMotion,
}: ItemProps) {
  const [justCopied, setJustCopied] = useState(false);

  const handleClick = async () => {
    const r = await onCopyOne();
    if (!r || r.success !== false) {
      setJustCopied(true);
      setTimeout(() => setJustCopied(false), 1800);
    }
  };

  return (
    <motion.div
      role="listitem"
      className={`mail-list-item${selected ? ' selected' : ''}${justCopied ? ' just-copied' : ''}`}
      initial={reduceMotion ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.18, delay: reduceMotion ? 0 : index * 0.03 }}
    >
      <input
        type="checkbox"
        className="mail-list-check"
        checked={selected}
        onChange={onToggleSelected}
        aria-label={`Mail ${index + 1} auswählen`}
      />

      <div
        className={`mail-list-drag${entry.path ? '' : ' disabled'}`}
        draggable={!!entry.path}
        onDragStart={onDragStart}
        title={entry.path ? 'Maildatei ziehen' : 'Kein Dateipfad verfügbar'}
        aria-label="Maildatei ziehen"
      >
        <img src="./mail-icon.png" alt="" draggable={false} />
      </div>

      <button
        type="button"
        className="mail-list-content"
        onClick={handleClick}
        title="Diese Mail als Text in die Zwischenablage kopieren"
      >
        <div className="mail-list-row">
          <span className="mail-list-from">{entry.data.from}</span>
          <span className="mail-list-date">{formatDate(entry.data.date)}</span>
        </div>
        <div className="mail-list-subject">{entry.data.subject || '(Kein Betreff)'}</div>
        <div className="mail-list-snippet">{snippet(entry.data)}</div>
      </button>

      <div className="mail-list-action" aria-hidden={!justCopied}>
        {justCopied ? <Check size={16} /> : <Copy size={14} />}
      </div>
    </motion.div>
  );
}

function formatDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}
