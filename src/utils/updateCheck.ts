/**
 * Manueller / automatischer Update-Check ohne Code-Signing.
 * Konfigurierbarer Endpoint, liefert JSON: { version, url, notes }.
 *
 * Wir ziehen kein Update herunter und ersetzen nichts automatisch –
 * stattdessen zeigt die App einen Hinweis und der User klickt zum
 * Download, der in seinem Browser (per shell.openExternal in Electron)
 * geoeffnet wird.
 */

export interface UpdateInfo {
  version: string;
  url: string;
  notes?: string;
}

export interface UpdateCheckResult {
  newer: boolean;
  current: string;
  remote?: UpdateInfo;
  error?: string;
}

const CACHE_KEY = 'copymail.update.cache.v1';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6h

interface CacheEntry {
  fetchedAt: number;
  result: UpdateCheckResult;
}

declare const __APP_VERSION__: string;
const APP_VERSION: string = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0';

export function compareSemver(a: string, b: string): number {
  const pa = a.split(/[.+-]/).map((x) => parseInt(x, 10));
  const pb = b.split(/[.+-]/).map((x) => parseInt(x, 10));
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const ax = pa[i];
    const bx = pb[i];
    const x = ax === undefined || isNaN(ax) ? 0 : ax;
    const y = bx === undefined || isNaN(bx) ? 0 : bx;
    if (x !== y) return x - y;
  }
  return 0;
}

function readCache(): CacheEntry | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry;
    if (Date.now() - entry.fetchedAt > CACHE_TTL_MS) return null;
    return entry;
  } catch {
    return null;
  }
}

function writeCache(result: UpdateCheckResult): void {
  try {
    const entry: CacheEntry = { fetchedAt: Date.now(), result };
    localStorage.setItem(CACHE_KEY, JSON.stringify(entry));
  } catch {
    /* ignore */
  }
}

export async function checkForUpdates(updateUrl: string, force = false): Promise<UpdateCheckResult> {
  if (!updateUrl) {
    return { newer: false, current: APP_VERSION, error: 'Keine Update-URL konfiguriert.' };
  }
  if (!force) {
    const cached = readCache();
    if (cached) return cached.result;
  }
  try {
    const resp = await fetch(updateUrl, { cache: 'no-store' });
    if (!resp.ok) {
      const r: UpdateCheckResult = { newer: false, current: APP_VERSION, error: `HTTP ${resp.status}` };
      writeCache(r);
      return r;
    }
    const raw = (await resp.json()) as Record<string, unknown>;
    const remote = normalize(raw);
    if (!remote) {
      const r: UpdateCheckResult = { newer: false, current: APP_VERSION, error: 'Ungültige JSON-Antwort.' };
      writeCache(r);
      return r;
    }
    const newer = compareSemver(remote.version, APP_VERSION) > 0;
    const r: UpdateCheckResult = { newer, current: APP_VERSION, remote };
    writeCache(r);
    return r;
  } catch (err) {
    return {
      newer: false,
      current: APP_VERSION,
      error: err instanceof Error ? err.message : 'Unbekannter Fehler.',
    };
  }
}

/**
 * Akzeptiert sowohl unser eigenes Schema als auch GitHub-Releases-API.
 */
function normalize(raw: Record<string, unknown>): UpdateInfo | null {
  // GitHub: { tag_name: 'v1.3.0', assets: [{browser_download_url}], body }
  if (typeof raw.tag_name === 'string') {
    const version = raw.tag_name.replace(/^v/, '');
    const assets = Array.isArray(raw.assets) ? (raw.assets as Array<Record<string, unknown>>) : [];
    const portable = assets.find((a) => typeof a.name === 'string' && /portable/i.test(a.name as string));
    const setup = assets.find((a) => typeof a.name === 'string' && /setup/i.test(a.name as string));
    const url =
      ((portable?.browser_download_url as string | undefined) ??
        (setup?.browser_download_url as string | undefined) ??
        (typeof raw.html_url === 'string' ? (raw.html_url as string) : '')) || '';
    return { version, url, notes: typeof raw.body === 'string' ? (raw.body as string) : '' };
  }
  // Eigenes Schema: { version, url, notes }
  if (typeof raw.version === 'string' && typeof raw.url === 'string') {
    return {
      version: raw.version,
      url: raw.url,
      notes: typeof raw.notes === 'string' ? raw.notes : '',
    };
  }
  return null;
}
