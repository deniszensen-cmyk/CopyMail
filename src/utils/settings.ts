/**
 * Settings-Schema und Persistenz.
 * Electron: ueber IPC -> userData/config.json (Main-Prozess).
 * Browser:  localStorage.
 */

export type CopyMode = 'text' | 'file';
export type BodyTheme = 'light' | 'dark';

export interface Settings {
  defaultMode: CopyMode;
  /** in MB */
  maxFileSizeMb: number;
  bodyTheme: BodyTheme;
  allowExternalImages: boolean;
  autoCheckUpdates: boolean;
  /** URL, die JSON {version, url, notes} liefert. */
  updateUrl: string;
  /** Eigene Forward-Templates – null = built-in benutzen. */
  forwardTemplateText: string | null;
  forwardTemplateHtml: string | null;
  /**
   * Wenn true: zitierte Mail-Verlaeufe (AW/FW/WG) werden vor dem Kopieren
   * abgeschnitten - es bleibt nur der obere, "aktuelle" Mail-Text.
   */
  stripQuotedHistory: boolean;
  /**
   * Wenn true: HTML-Body und Signatur-Tabellen werden verworfen, statt-
   * dessen wird der Plain-Text-Inhalt + Grußformel + Absender-Name benutzt.
   * Zielsetzung: sauberes Paste in Bitrix24, Confluence und anderen
   * strikten WYSIWYG-Editoren ohne Tabellen-Rahmen-Probleme.
   */
  stripSignature: boolean;
  /**
   * Wenn true: jeder Copy-Vorgang wird in der lokalen Zwischenablage-
   * Historie gespeichert. Zugriff per Strg+H oder Toolbar-Button.
   */
  historyEnabled: boolean;
  /**
   * 'session'   = Historie nur im aktuellen App-Lauf, beim Neustart leer.
   * 'persistent'= Historie wird auf Disk gespeichert (userData bzw. localStorage).
   * In beiden Modi rotieren ungepinnte Einträge bei Überlauf weg; gepinnte
   * Einträge bleiben.
   */
  historyRetention: 'session' | 'persistent';
  /**
   * Wenn true: System-Zwischenablage wird beobachtet (Win+V-Stil). Alles
   * was außerhalb von CopyMail mit Strg+C kopiert wird, landet auch im
   * Verlauf. Default aus aus Datenschutz-Gründen (Mandanten-PC).
   */
  watchSystemClipboard: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  defaultMode: 'text',
  maxFileSizeMb: 100,
  bodyTheme: 'light',
  allowExternalImages: false,
  autoCheckUpdates: true,
  // Standard-Update-Endpoint für deniszensen-cmyk/CopyMail – kann im
  // Settings-Drawer überschrieben werden (z.B. für eine eigene Fork).
  updateUrl: 'https://api.github.com/repos/deniszensen-cmyk/CopyMail/releases/latest',
  forwardTemplateText: null,
  forwardTemplateHtml: null,
  stripQuotedHistory: false,
  stripSignature: false,
  historyEnabled: true,
  historyRetention: 'persistent',
  watchSystemClipboard: false,
};

const LS_KEY = 'copymail.settings.v1';
const isElectron = typeof window !== 'undefined' && !!window.electronAPI;

export async function loadSettings(): Promise<Settings> {
  try {
    if (isElectron && window.electronAPI?.loadSettings) {
      const remote = await window.electronAPI.loadSettings();
      return { ...DEFAULT_SETTINGS, ...(remote ?? {}) };
    }
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveSettings(settings: Settings): Promise<void> {
  try {
    if (isElectron && window.electronAPI?.saveSettings) {
      await window.electronAPI.saveSettings(settings);
      return;
    }
    localStorage.setItem(LS_KEY, JSON.stringify(settings));
  } catch {
    /* ignore */
  }
}
