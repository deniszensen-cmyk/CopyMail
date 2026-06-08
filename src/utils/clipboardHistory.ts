/**
 * Zwischenablage-Historie: lokales Verlaufs-Panel der CopyMail-Forwards.
 * Speichert jeden Copy-Vorgang in einer rotierenden Liste, mit Pin- und
 * Lösch-Funktion. Pinned Items bleiben erhalten, unpinned rotieren weg.
 *
 * Persistenz:
 *   Electron: userData/clipboard-history.json via IPC.
 *   Browser:  localStorage (mit ~4 MB Hartlimit; ältestes ungepinntes Item
 *             kippt raus, wenn das Limit überschritten wird).
 */

export type EntryOrigin = 'single' | 'multi' | 'history-replay';
/**
 * Woher kommt der Eintrag?
 *   'mail'    – aus einem CopyMail-Forward (Mail-Header bekannt).
 *   'system'  – aus dem System-Clipboard-Watcher (Strg+C aus beliebiger App).
 *   'replay'  – aus dem Verlauf erneut kopiert.
 */
export type EntrySource = 'mail' | 'system' | 'replay';

export interface ClipboardEntry {
  id: string;
  capturedAt: number;
  /** Bei 'mail' das Subject, sonst eine generierte Anzeige-Bezeichnung. */
  subject: string;
  /** Nur bei 'mail' gefüllt. */
  from: string;
  /** Nur bei 'mail' gefüllt. */
  date: string;
  snippet: string;
  text: string;
  html: string;
  filePaths: string[];
  fileCount: number;
  pinned: boolean;
  origin: EntryOrigin;
  source: EntrySource;
}

/** Maximal-Zahl Einträge (gepinnte zählen nicht mit). */
export const MAX_HISTORY_ENTRIES = 50;
/** Maximal-Größe der serialisierten Historie im Browser (4 MB). */
const BROWSER_MAX_BYTES = 4 * 1024 * 1024;

const LS_KEY = 'copymail.history.v1';
const isElectron = typeof window !== 'undefined' && !!window.electronAPI;

/* ---------------- Persistenz ---------------- */

export async function loadHistory(): Promise<ClipboardEntry[]> {
  try {
    if (isElectron && window.electronAPI?.loadClipboardHistory) {
      const remote = await window.electronAPI.loadClipboardHistory();
      return Array.isArray(remote) ? sanitizeAll(remote) : [];
    }
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? sanitizeAll(parsed) : [];
  } catch {
    return [];
  }
}

export async function saveHistory(entries: ClipboardEntry[]): Promise<void> {
  try {
    if (isElectron && window.electronAPI?.saveClipboardHistory) {
      await window.electronAPI.saveClipboardHistory(entries);
      return;
    }
    let serialized = JSON.stringify(entries);
    // Browser-Limit: solange zu groß, älteste ungepinnte rauskickern.
    const work = entries.slice();
    while (serialized.length > BROWSER_MAX_BYTES && work.some((e) => !e.pinned)) {
      const idx = findOldestUnpinnedIndex(work);
      if (idx < 0) break;
      work.splice(idx, 1);
      serialized = JSON.stringify(work);
    }
    localStorage.setItem(LS_KEY, serialized);
  } catch {
    /* ignore */
  }
}

/* ---------------- Operationen ---------------- */

/**
 * Fügt einen Eintrag ein und rotiert ungepinnte ab MAX_HISTORY_ENTRIES weg.
 * Wenn der neue Inhalt identisch zum jüngsten Eintrag ist, wird er nicht
 * doppelt erfasst (Stop-Spam beim wiederholten Strg+C).
 */
export function addEntry(
  entry: ClipboardEntry,
  current: ClipboardEntry[],
): ClipboardEntry[] {
  const newest = current[0];
  if (newest && isSameContent(newest, entry)) {
    // Bestehenden Eintrag „auffrischen" (capturedAt aktualisieren), sonst
    // sammelt sich derselbe Inhalt nicht doppelt.
    const refreshed: ClipboardEntry = { ...newest, capturedAt: entry.capturedAt };
    return [refreshed, ...current.slice(1)];
  }
  const next = [entry, ...current];
  return rotateHistory(next);
}

export function togglePin(id: string, entries: ClipboardEntry[]): ClipboardEntry[] {
  return entries.map((e) => (e.id === id ? { ...e, pinned: !e.pinned } : e));
}

export function removeEntry(id: string, entries: ClipboardEntry[]): ClipboardEntry[] {
  return entries.filter((e) => e.id !== id);
}

export function clearUnpinned(entries: ClipboardEntry[]): ClipboardEntry[] {
  return entries.filter((e) => e.pinned);
}

/** Rotiert ungepinnte Einträge ab MAX_HISTORY_ENTRIES weg (älteste zuerst). */
export function rotateHistory(
  entries: ClipboardEntry[],
  max = MAX_HISTORY_ENTRIES,
): ClipboardEntry[] {
  const pinned = entries.filter((e) => e.pinned);
  const unpinned = entries.filter((e) => !e.pinned);
  // unpinned sind in Einfügereihenfolge (newest first) — wir behalten die
  // ersten `max` und werfen den Rest weg.
  const keepUnpinned = unpinned.slice(0, max);
  // Pinned bleiben in ihrer ursprünglichen Reihenfolge, oben dazwischen
  // sortiert nach capturedAt (neuere oben). Wir mischen pinned + unpinned
  // nach capturedAt.
  const merged = [...pinned, ...keepUnpinned].sort((a, b) => b.capturedAt - a.capturedAt);
  return merged;
}

/* ---------------- Helfer ---------------- */

/** Erzeugt einen neuen Eintrag aus einem CopyMail-Forward-Ergebnis. */
export function makeEntry(args: {
  subject: string;
  from: string;
  date: string;
  text: string;
  html: string;
  filePaths: string[];
  origin: EntryOrigin;
}): ClipboardEntry {
  return {
    id: makeId(),
    capturedAt: Date.now(),
    subject: args.subject || '(Kein Betreff)',
    from: args.from || '',
    date: args.date || '',
    snippet: buildSnippet(args.text),
    text: args.text,
    html: args.html,
    filePaths: args.filePaths,
    fileCount: args.filePaths.length,
    pinned: false,
    origin: args.origin,
    source: args.origin === 'history-replay' ? 'replay' : 'mail',
  };
}

/** Erzeugt einen Eintrag aus dem System-Clipboard-Watcher. */
export function makeSystemEntry(args: {
  text: string;
  html?: string;
  filePaths?: string[];
}): ClipboardEntry {
  const snippet = buildSnippet(args.text);
  const headline = makeSystemHeadline(args.text);
  return {
    id: makeId(),
    capturedAt: Date.now(),
    subject: headline,
    from: '',
    date: '',
    snippet,
    text: args.text,
    html: args.html ?? '',
    filePaths: args.filePaths ?? [],
    fileCount: (args.filePaths ?? []).length,
    pinned: false,
    origin: 'single',
    source: 'system',
  };
}

function makeSystemHeadline(text: string): string {
  const firstLine = text.split(/\r?\n/)[0]?.trim() ?? '';
  if (!firstLine) return '(Zwischenablage)';
  if (firstLine.length <= 60) return firstLine;
  return firstLine.slice(0, 57).trimEnd() + '…';
}

function makeId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    /* fallthrough */
  }
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

function buildSnippet(text: string, maxLen = 160): string {
  const raw = text.replace(/\s+/g, ' ').trim();
  if (raw.length <= maxLen) return raw;
  return raw.slice(0, maxLen).trimEnd() + '…';
}

function isSameContent(a: ClipboardEntry, b: ClipboardEntry): boolean {
  return a.subject === b.subject && a.text === b.text && sameStringArray(a.filePaths, b.filePaths);
}

function sameStringArray(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function findOldestUnpinnedIndex(entries: ClipboardEntry[]): number {
  let idx = -1;
  let oldest = Infinity;
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i]!;
    if (e.pinned) continue;
    if (e.capturedAt < oldest) {
      oldest = e.capturedAt;
      idx = i;
    }
  }
  return idx;
}

function sanitizeAll(arr: unknown[]): ClipboardEntry[] {
  const out: ClipboardEntry[] = [];
  for (const item of arr) {
    const e = sanitize(item);
    if (e) out.push(e);
  }
  return out;
}

function sanitize(raw: unknown): ClipboardEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== 'string' || typeof r.text !== 'string') return null;
  const filePaths = Array.isArray(r.filePaths) ? (r.filePaths.filter((p) => typeof p === 'string') as string[]) : [];
  return {
    id: r.id,
    capturedAt: typeof r.capturedAt === 'number' ? r.capturedAt : Date.now(),
    subject: typeof r.subject === 'string' ? r.subject : '',
    from: typeof r.from === 'string' ? r.from : '',
    date: typeof r.date === 'string' ? r.date : '',
    snippet: typeof r.snippet === 'string' ? r.snippet : buildSnippet(r.text),
    text: r.text,
    html: typeof r.html === 'string' ? r.html : '',
    filePaths,
    fileCount: typeof r.fileCount === 'number' ? r.fileCount : filePaths.length,
    pinned: r.pinned === true,
    origin: r.origin === 'multi' || r.origin === 'history-replay' ? r.origin : 'single',
    source:
      r.source === 'system' || r.source === 'replay' || r.source === 'mail'
        ? r.source
        : 'mail',
  };
}
