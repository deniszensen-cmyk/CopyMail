import { useState } from 'react';
import { Download, X, ChevronDown, ChevronUp } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import type { UpdateInfo } from '../utils/updateCheck';

interface Props {
  update: UpdateInfo | null;
  onOpen: () => void;
  onDismiss: () => void;
  reduceMotion?: boolean | null;
}

export function UpdateBanner({ update, onOpen, onDismiss, reduceMotion }: Props) {
  const [expanded, setExpanded] = useState(false);
  const hasNotes = !!update?.notes && update.notes.trim().length > 0;

  return (
    <AnimatePresence>
      {update && (
        <motion.div
          className="update-banner"
          initial={reduceMotion ? false : { opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -16 }}
          role="status"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', width: '100%' }}>
            <span>
              <strong>Update verfügbar:</strong> CopyMail v{update.version}
            </span>
            {hasNotes && (
              <button
                className="btn-secondary small"
                onClick={() => setExpanded((v) => !v)}
                title={expanded ? 'Release-Notes ausblenden' : 'Was ist neu?'}
              >
                {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                {expanded ? 'Weniger' : 'Was ist neu?'}
              </button>
            )}
            <button className="btn-secondary small" onClick={onOpen} title="Im Browser öffnen">
              <Download size={14} /> Herunterladen
            </button>
            <button className="btn-icon small" onClick={onDismiss} aria-label="Schließen" title="Schließen">
              <X size={14} />
            </button>
          </div>
          {hasNotes && expanded && (
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
              style={{
                width: '100%',
                marginTop: 8,
                padding: '10px 12px',
                borderRadius: 6,
                background: 'rgba(255,255,255,0.06)',
                fontSize: '0.85em',
                maxHeight: 280,
                overflowY: 'auto',
                lineHeight: 1.45,
              }}
            >
              <div
                className="release-notes"
                // eslint-disable-next-line react/no-danger
                dangerouslySetInnerHTML={{ __html: renderReleaseNotes(update.notes ?? '') }}
              />
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Mini-Markdown-Renderer für GitHub-Release-Bodies.
 * Unterstützt: Headings (#, ##, ###), Bullet-Lists (- / *), Bold (**x**),
 * Inline-Code (`x`), Links ([text](url)) und Absätze. Bewusst kein voller
 * Markdown-Parser - GitHub-Bodies in CopyMail-Releases sind simpel.
 *
 * Sicherheit: Wir escapen erst alles, ersetzen dann Markdown-Pattern.
 * Daher landet kein roher HTML-Code aus dem Release-Body im DOM.
 */
function renderReleaseNotes(md: string): string {
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const out: string[] = [];
  let listOpen = false;

  const flushList = () => {
    if (listOpen) {
      out.push('</ul>');
      listOpen = false;
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      flushList();
      continue;
    }
    // Headings
    const h3 = /^###\s+(.*)$/.exec(line);
    const h2 = /^##\s+(.*)$/.exec(line);
    const h1 = /^#\s+(.*)$/.exec(line);
    if (h1) {
      flushList();
      out.push(`<h4 style="margin:8px 0 4px;font-size:1em;">${formatInline(esc(h1[1]!))}</h4>`);
      continue;
    }
    if (h2) {
      flushList();
      out.push(`<h4 style="margin:8px 0 4px;font-size:0.95em;">${formatInline(esc(h2[1]!))}</h4>`);
      continue;
    }
    if (h3) {
      flushList();
      out.push(`<h5 style="margin:6px 0 2px;font-size:0.9em;">${formatInline(esc(h3[1]!))}</h5>`);
      continue;
    }
    // Listen-Items
    const li = /^[-*]\s+(.*)$/.exec(line);
    if (li) {
      if (!listOpen) {
        out.push('<ul style="margin:4px 0 4px 18px;padding:0;">');
        listOpen = true;
      }
      out.push(`<li style="margin:2px 0;">${formatInline(esc(li[1]!))}</li>`);
      continue;
    }
    // Normaler Absatz
    flushList();
    out.push(`<p style="margin:4px 0;">${formatInline(esc(line))}</p>`);
  }
  flushList();
  return out.join('');
}

function formatInline(s: string): string {
  return s
    // Bold **x**
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    // Code `x`
    .replace(/`([^`]+)`/g, '<code style="background:rgba(255,255,255,0.1);padding:0 4px;border-radius:3px;">$1</code>')
    // Links [text](url) - url ist bereits durch esc() escapt, also &quot; statt "
    .replace(
      /\[([^\]]+)\]\(([^)\s]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer" style="text-decoration:underline;">$1</a>',
    );
}
