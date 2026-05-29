import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Mail, Upload, Copy, Check, AlertCircle, RotateCcw, Loader2 } from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  processEmailFile,
  formatForwardedEmail,
  formatCombinedEmails,
  sanitizeMailHtml,
  escHtml,
  isSupportedFile,
} from './utils/EmailProcessor';
import type { EmailData } from './utils/EmailProcessor';
import { detectQuote } from './utils/quotedReply';
import { useSettings } from './hooks/useSettings';
import { checkForUpdates, type UpdateInfo } from './utils/updateCheck';
import { Titlebar } from './components/Titlebar';
import { SettingsDrawer } from './components/SettingsDrawer';
import { HelpDialog } from './components/HelpDialog';
import { UpdateBanner } from './components/UpdateBanner';
import { MailList } from './components/MailList';
import { AttachmentList } from './components/AttachmentList';
import { SearchBar } from './components/SearchBar';
import { highlight } from './utils/highlight';
import './index.css';

declare const __APP_VERSION__: string;
const appVersion: string = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev';

const isElectron = typeof window !== 'undefined' && !!window.electronAPI;

type CopyMode = 'text' | 'file';

interface ProcessedEmail {
  data: EmailData;
  path: string | null;
  name: string;
}

function App() {
  const reduceMotion = useReducedMotion();
  const { settings, update: updateSettings } = useSettings();

  const [isDragging, setIsDragging] = useState(false);
  const [emails, setEmails] = useState<ProcessedEmail[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [alwaysOnTop, setAlwaysOnTop] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [copyModeOverride, setCopyMode] = useState<CopyMode | null>(null);
  const [stripQuotesOverride, setStripQuotesOverride] = useState<boolean | null>(null);
  const [showPulse, setShowPulse] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [update, setUpdate] = useState<UpdateInfo | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const copyBtnRef = useRef<HTMLButtonElement>(null);
  const requestSeq = useRef(0);
  const handleCopyRef = useRef<() => Promise<void> | void>(() => undefined);

  const primary = emails[activeIndex] ?? emails[0];
  const emailData = primary?.data ?? null;
  const selectedEntries = useMemo(
    () => emails.filter((_, i) => selectedIndices.has(i)),
    [emails, selectedIndices],
  );
  const filePaths = useMemo(
    () => selectedEntries.map((e) => e.path).filter((p): p is string => !!p),
    [selectedEntries],
  );
  const hasFilePaths = filePaths.length > 0;
  const copyMode: CopyMode = copyModeOverride ?? settings.defaultMode;
  const effectiveCopyMode: CopyMode = !hasFilePaths && copyMode === 'file' ? 'text' : copyMode;

  // Always-on-Top + Maximize-Sync
  useEffect(() => {
    if (!isElectron) return;
    window.electronAPI!.getAlwaysOnTop().then(setAlwaysOnTop).catch(() => setAlwaysOnTop(false));
    window.electronAPI!.windowIsMaximized().then(setIsMaximized).catch(() => setIsMaximized(false));
    const off = window.electronAPI!.onMaximizeChanged(setIsMaximized);
    return () => off();
  }, []);

  // Auto-Update-Check (sobald Settings geladen + URL konfiguriert)
  useEffect(() => {
    if (!settings.autoCheckUpdates || !settings.updateUrl) return;
    checkForUpdates(settings.updateUrl).then((r) => {
      if (r.newer && r.remote) setUpdate(r.remote);
    });
  }, [settings.autoCheckUpdates, settings.updateUrl]);

  // "Mail-Verlauf abschneiden" - Per-Mail-Override schlaegt Settings-Default.
  const stripQuotes = stripQuotesOverride ?? settings.stripQuotedHistory;

  // Forward-Format: bei mehreren ausgewählten Mails verkettete Version,
  // sonst die aktive Einzelmail.
  const formattedContent = useMemo(() => {
    if (!emailData) return null;
    const opts = {
      templateText: settings.forwardTemplateText,
      templateHtml: settings.forwardTemplateHtml,
      allowExternalImages: settings.allowExternalImages,
      stripQuotedHistory: stripQuotes,
    };
    if (selectedEntries.length > 1) {
      return formatCombinedEmails(selectedEntries.map((e) => e.data), opts);
    }
    return formatForwardedEmail(emailData, opts);
  }, [emailData, selectedEntries, settings.forwardTemplateText, settings.forwardTemplateHtml, settings.allowExternalImages, stripQuotes]);

  // Erkennen, ob die aktuelle Mail ueberhaupt ein Zitat enthaelt.
  const quoteInfo = useMemo(() => {
    if (!emailData) return { hasQuote: false, cutTextChars: 0 };
    return detectQuote(emailData.body, emailData.bodyHtml);
  }, [emailData]);

  useEffect(() => { if (formattedContent) copyBtnRef.current?.focus(); }, [formattedContent]);

  useEffect(() => {
    if (!showPulse) return;
    const t = setTimeout(() => setShowPulse(false), 3500);
    return () => clearTimeout(t);
  }, [showPulse]);

  const toggleAlwaysOnTop = async () => {
    const next = !alwaysOnTop;
    if (isElectron) {
      try { await window.electronAPI!.setAlwaysOnTop(next); } catch { /* ignore */ }
    }
    setAlwaysOnTop(next);
  };

  const reset = () => {
    requestSeq.current++;
    setEmails([]);
    setActiveIndex(0);
    setSelectedIndices(new Set());
    setError(null);
    setCopied(false);
    setShowPulse(false);
    setSearchOpen(false);
    setSearchQuery('');
  };

  // Globale Tastatur-Shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Ctrl+C
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && (e.key === 'c' || e.key === 'C')) {
        if (!isInputFocused() && (window.getSelection?.()?.toString() ?? '').trim() === '' && formattedContent) {
          e.preventDefault();
          void handleCopyRef.current();
          return;
        }
      }
      // Ctrl+M – Modus wechseln
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && (e.key === 'm' || e.key === 'M')) {
        if (!isInputFocused()) {
          e.preventDefault();
          setCopyMode(copyMode === 'text' ? (hasFilePaths ? 'file' : 'text') : 'text');
        }
      }
      // Ctrl+P – Pin
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && (e.key === 'p' || e.key === 'P')) {
        if (!isInputFocused() && isElectron) {
          e.preventDefault();
          void toggleAlwaysOnTop();
        }
      }
      // Ctrl+F – Suche
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && (e.key === 'f' || e.key === 'F')) {
        if (emailData && !isInputFocused()) {
          e.preventDefault();
          setSearchOpen(true);
        }
      }
      // Esc – Reset / Close
      if (e.key === 'Escape') {
        if (showSettings) { setShowSettings(false); return; }
        if (showHelp) { setShowHelp(false); return; }
        if (searchOpen) { setSearchOpen(false); return; }
        if (emailData && !isInputFocused()) { e.preventDefault(); reset(); }
      }
      // F2 – Window-Fokus
      if (e.key === 'F2' && isElectron) {
        e.preventDefault();
        window.electronAPI!.windowFocus();
      }
      // ? – Hilfe
      if (e.key === '?' && !isInputFocused()) {
        setShowHelp(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formattedContent, emailData, hasFilePaths, showSettings, showHelp, searchOpen]);

  const handleFiles = useCallback(async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (files.length === 0) return;

    const seq = ++requestSeq.current;
    setError(null);
    setCopied(false);
    setIsLoading(true);

    try {
      const accepted: File[] = [];
      const rejected: string[] = [];
      const maxBytes = settings.maxFileSizeMb * 1024 * 1024;
      for (const f of files) {
        if (!isSupportedFile(f)) { rejected.push(`${f.name}: nicht unterstütztes Format`); continue; }
        if (f.size > maxBytes) { rejected.push(`${f.name}: zu groß (über ${settings.maxFileSizeMb} MB)`); continue; }
        accepted.push(f);
      }
      if (accepted.length === 0) throw new Error(rejected.join(' · ') || 'Keine unterstützte Datei.');

      const processed: ProcessedEmail[] = [];
      for (const f of accepted) {
        let path: string | null = null;
        if (isElectron) {
          const candidate =
            (f as File & { path?: string }).path ||
            window.electronAPI?.getPathForFile?.(f) || '';
          if (candidate && window.electronAPI?.registerFile) {
            path = await window.electronAPI.registerFile(candidate);
          }
        }
        const data = await processEmailFile(f, maxBytes);
        if (seq !== requestSeq.current) return;
        processed.push({ data, path, name: f.name });
      }
      if (seq !== requestSeq.current) return;
      setEmails(processed);
      setActiveIndex(0);
      // Beim Drop alle Mails standardmaessig auswaehlen (fuer Combined-Text).
      setSelectedIndices(new Set(processed.map((_, i) => i)));
      if (rejected.length > 0) setError(`Übersprungen: ${rejected.join(' · ')}`);
      if (!reduceMotion) setShowPulse(true);
    } catch (err: unknown) {
      if (seq !== requestSeq.current) return;
      setError(err instanceof Error ? err.message : 'Fehler beim Verarbeiten der Datei.');
    } finally {
      if (seq === requestSeq.current) setIsLoading(false);
    }
  }, [reduceMotion, settings.maxFileSizeMb]);

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const onDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragging(false);
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length) void handleFiles(e.dataTransfer.files);
  };
  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) void handleFiles(e.target.files);
    e.target.value = '';
  };
  const onDropZoneKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInputRef.current?.click(); }
  };

  const handleCopy = async (): Promise<void> => {
    if (!formattedContent || isCopying) return;
    if (effectiveCopyMode === 'file' && !hasFilePaths) {
      setError('Die Datei kann nicht angehängt werden, weil kein lokaler Dateipfad verfügbar ist.');
      return;
    }
    setShowPulse(false);
    setIsCopying(true);
    try {
      if (isElectron) {
        const data: { text?: string; html?: string; filePaths?: string[] } = {};
        if (effectiveCopyMode === 'text') {
          data.text = formattedContent.text;
          data.html = formattedContent.html;
        }
        if (hasFilePaths && effectiveCopyMode === 'file') data.filePaths = filePaths;
        const result = await window.electronAPI!.copyToClipboard(data);
        setCopied(result.success);
        setError(result.partial || !result.success ? result.message ?? null : null);
        if (result.success) setTimeout(() => setCopied(false), 2500);
      } else if (effectiveCopyMode === 'text') {
        await browserClipboardWrite(formattedContent.text, formattedContent.html);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kopieren fehlgeschlagen.');
    } finally {
      setIsCopying(false);
    }
  };

  useEffect(() => { handleCopyRef.current = handleCopy; });

  const onDragStart = (e: React.DragEvent) => {
    if (!isElectron || filePaths.length === 0) return;
    e.preventDefault();
    // Bei mehreren ausgewaehlten Mails: alle Pfade gleichzeitig ziehen.
    // Electron 30+ unterstuetzt das via files-Array im startDrag-Payload.
    window.electronAPI!.startDrag(filePaths.length === 1 ? filePaths[0]! : filePaths);
  };

  /** Kopiert eine einzelne Mail per Klick aus der Liste. */
  const handleCopyOne = async (index: number): Promise<{ success: boolean }> => {
    const entry = emails[index];
    if (!entry) return { success: false };
    try {
      const formatted = formatForwardedEmail(entry.data, {
        templateText: settings.forwardTemplateText,
        templateHtml: settings.forwardTemplateHtml,
        allowExternalImages: settings.allowExternalImages,
        stripQuotedHistory: stripQuotes,
      });
      if (isElectron) {
        const res = await window.electronAPI!.copyToClipboard({
          text: formatted.text,
          html: formatted.html,
        });
        return { success: !!res.success };
      }
      await browserClipboardWrite(formatted.text, formatted.html);
      return { success: true };
    } catch {
      return { success: false };
    }
  };

  /** Drag-out für eine einzelne Mail aus der Liste. */
  const onListDragStart = (index: number, e: React.DragEvent) => {
    const entry = emails[index];
    if (!entry || !entry.path || !isElectron) return;
    e.preventDefault();
    window.electronAPI!.startDrag(entry.path);
  };

  const toggleSelected = (index: number) => {
    setSelectedIndices((cur) => {
      const next = new Set(cur);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const setAllSelected = (selected: boolean) => {
    if (!selected) setSelectedIndices(new Set());
    else setSelectedIndices(new Set(emails.map((_, i) => i)));
  };

  const sanitizedPreview = useMemo(() => {
    if (!emailData) return '';
    let html: string;
    if (emailData.bodyHtml) html = sanitizeMailHtml(emailData.bodyHtml, settings.allowExternalImages);
    else html = escHtml(emailData.body).replace(/\r?\n/g, '<br>');
    if (searchOpen && searchQuery.trim()) html = highlight(html, searchQuery.trim());
    return html;
  }, [emailData, settings.allowExternalImages, searchOpen, searchQuery]);

  const isHtmlBody = !!emailData?.bodyHtml;
  const extraCount = emails.length - 1;

  const onUpdateOpen = () => {
    if (update?.url) {
      // shell.openExternal via setWindowOpenHandler
      window.open(update.url, '_blank');
    }
  };

  return (
    <div className={`app-shell theme-${settings.bodyTheme}`}>
      <Titlebar
        isElectron={isElectron}
        alwaysOnTop={alwaysOnTop}
        isMaximized={isMaximized}
        onTogglePin={toggleAlwaysOnTop}
        onMinimize={() => isElectron && window.electronAPI!.windowMinimize()}
        onToggleMaximize={() => isElectron && window.electronAPI!.windowToggleMaximize()}
        onClose={() => isElectron && window.electronAPI!.windowClose()}
        onOpenSettings={() => setShowSettings(true)}
        onOpenHelp={() => setShowHelp(true)}
      />

      <UpdateBanner
        update={update}
        onOpen={onUpdateOpen}
        onDismiss={() => setUpdate(null)}
        reduceMotion={reduceMotion}
      />

      <div className="container">
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.5, ease: [0.4, 0, 0.2, 1] }}
          className="glass-card"
        >
          <header className="app-header">
            <div className="header-top">
              <div className="icon-wrapper"><Mail size={26} strokeWidth={1.8} /></div>
              {!isElectron && (
                <span className="mode-badge" title="Im Browser-Modus stehen Datei-Anhang und Always-on-Top nicht zur Verfügung.">
                  Browser-Modus
                </span>
              )}
            </div>
            <h1>CopyMail</h1>
            <p className="subtitle">
              Ziehe eine oder mehrere .msg/.eml-Dateien hinein – Text kopieren oder Maildateien anhängen.
            </p>
          </header>

          <AnimatePresence mode="wait">
            {!emailData ? (
              <motion.div
                key="dropzone"
                initial={reduceMotion ? false : { opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.97 }}
                transition={{ duration: reduceMotion ? 0 : 0.22 }}
                className={`drop-zone${isDragging ? ' active' : ''}`}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
                role="button" tabIndex={0}
                onKeyDown={onDropZoneKeyDown}
                aria-label="Datei ablegen oder auswählen"
              >
                {isLoading ? (
                  <motion.div
                    animate={reduceMotion ? undefined : { rotate: 360 }}
                    transition={reduceMotion ? undefined : { repeat: Infinity, duration: 1, ease: 'linear' }}
                    style={{ color: 'var(--accent-indigo)' }}
                  >
                    <Loader2 size={48} strokeWidth={1.5} />
                  </motion.div>
                ) : (
                  <Upload size={48} strokeWidth={1.5} className="drop-zone-icon" />
                )}
                <p>{isLoading ? 'Verarbeite…' : 'Datei(en) hierher ziehen oder klicken'}</p>
                <span className="drop-zone-hint">.msg · .eml · auch mehrere</span>
                <input
                  type="file" ref={fileInputRef} onChange={onFileSelect}
                  accept=".msg,.eml" multiple style={{ display: 'none' }}
                />
              </motion.div>
            ) : (
              <motion.div
                key="preview"
                initial={reduceMotion ? false : { opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -20 }}
                transition={{ duration: reduceMotion ? 0 : 0.25 }}
                className="preview-panel"
              >
                {emails.length > 1 && (
                  <MailList
                    entries={emails}
                    selectedIndices={selectedIndices}
                    onToggleSelected={toggleSelected}
                    onSelectAll={setAllSelected}
                    onCopyOne={handleCopyOne}
                    onDragStart={onListDragStart}
                    reduceMotion={reduceMotion}
                  />
                )}

                <div className="preview-toolbar">
                  <div
                    className="drag-handle"
                    draggable={hasFilePaths}
                    onDragStart={onDragStart}
                    title={hasFilePaths ? 'Ziehen, um die erste Maildatei anzuhängen' : 'Drag & Drop nicht verfügbar'}
                    aria-label="Maildatei zum Ziehen"
                  >
                    <span className="drag-handle-grip" aria-hidden="true">
                      <span /><span /><span />
                    </span>
                    <img src="./mail-icon.png" alt="" draggable={false} className="drag-handle-icon" />
                    <span className="drag-handle-label">Ziehen</span>
                    {extraCount > 0 && (
                      <span className="drag-handle-count" title={`${emails.length} Mails ausgewählt`}>+{extraCount}</span>
                    )}
                  </div>

                  <div className="copy-mode-toggle" role="group" aria-label="Kopier-Modus">
                    <button
                      onClick={() => setCopyMode('text')}
                      className={effectiveCopyMode === 'text' ? 'active' : ''}
                      title={selectedEntries.length > 1
                        ? `Texte aller ${selectedEntries.length} ausgewählten Mails verketten (Strg+M)`
                        : 'Nur Text kopieren (Strg+M)'}
                      aria-pressed={effectiveCopyMode === 'text'}
                    >{selectedEntries.length > 1 ? `Texte (${selectedEntries.length})` : 'Text'}</button>
                    <button
                      onClick={() => setCopyMode('file')}
                      className={effectiveCopyMode === 'file' ? 'active' : ''}
                      disabled={!hasFilePaths}
                      title={hasFilePaths
                        ? `Datei${filePaths.length > 1 ? 'en' : ''} kopieren (Strg+M)`
                        : 'Im Browser-Modus oder ohne lokalen Pfad nicht verfügbar'}
                      aria-pressed={effectiveCopyMode === 'file'}
                    >{filePaths.length > 1 ? `Dateien (${filePaths.length})` : 'Datei'}</button>
                  </div>

                  {quoteInfo.hasQuote && (
                    <button
                      type="button"
                      className={`btn-quote-toggle${stripQuotes ? ' active' : ''}`}
                      onClick={() => setStripQuotesOverride(!stripQuotes)}
                      title={stripQuotes
                        ? 'Aktuell nur der oberste Mail-Text wird kopiert. Klick = wieder ganze Mail.'
                        : 'Aktuell wird die ganze Mail inkl. AW/FW/WG kopiert. Klick = nur oberster Mail-Text.'}
                      aria-pressed={stripQuotes}
                    >
                      {stripQuotes ? 'Nur aktuell' : 'Ganze Mail'}
                    </button>
                  )}

                  <div className="toolbar-actions">
                    <button
                      id="btn-copy" ref={copyBtnRef}
                      onClick={handleCopy} disabled={isCopying}
                      title="In die Zwischenablage kopieren (Strg+C)"
                      className={`btn-primary${copied ? ' success' : (showPulse && !isCopying ? ' pulse' : '')}`}
                    >
                      {isCopying ? (
                        <motion.span
                          animate={reduceMotion ? undefined : { rotate: 360 }}
                          transition={reduceMotion ? undefined : { repeat: Infinity, duration: 1, ease: 'linear' }}
                          style={{ display: 'inline-flex' }}
                        ><Loader2 size={16} /></motion.span>
                      ) : (copied ? <Check size={16} /> : <Copy size={16} />)}
                      {isCopying ? 'Kopiere...' : (copied ? 'Kopiert!' : 'Kopieren')}
                    </button>
                    <button
                      id="btn-reset" onClick={reset} className="btn-icon"
                      title="Neue Datei laden (Esc)" aria-label="Neue Datei laden"
                    ><RotateCcw size={16} /></button>
                  </div>
                </div>

                <SearchBar
                  open={searchOpen}
                  query={searchQuery}
                  onChange={setSearchQuery}
                  onClose={() => { setSearchOpen(false); setSearchQuery(''); }}
                />

                {emails.length > 1 && (
                  <div className="multi-info" role="status">
                    {selectedIndices.size > 0
                      ? `${selectedIndices.size} von ${emails.length} ausgewählt. "Kopieren" verkettet die Texte und legt die Dateien in die Zwischenablage.`
                      : `Keine Mail ausgewählt. Klick auf einen Listeneintrag kopiert nur diese Mail.`}
                  </div>
                )}

                <div className="mail-meta">
                  <span className="mail-meta-label">Von</span>
                  <span className="mail-meta-value">{emailData.from}</span>
                  <span className="mail-meta-label">Datum</span>
                  <span className="mail-meta-value">{formatLocalDate(emailData.date)}</span>
                  {emailData.to && (<>
                    <span className="mail-meta-label">An</span>
                    <span className="mail-meta-value">{emailData.to}</span>
                  </>)}
                  <span className="mail-meta-label">Betreff</span>
                  <span className="mail-meta-value subject">{emailData.subject}</span>
                </div>

                {emailData.attachments && (
                  <AttachmentList attachments={emailData.attachments} />
                )}

                <div className="preview-container">
                  <div
                    className={`mail-body${isHtmlBody ? '' : ' plain'}`}
                    dangerouslySetInnerHTML={{ __html: sanitizedPreview }}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {error && (
              <motion.div
                className="error-message"
                initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
                role="alert"
              >
                <AlertCircle size={16} />
                <span>{error}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        <AnimatePresence>
          {copied && (
            <motion.div
              className="copied-banner"
              initial={reduceMotion ? false : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 20 }}
            >
              <Check size={18} />
              Inhalt in Zwischenablage kopiert!
            </motion.div>
          )}
        </AnimatePresence>

        <footer className="app-footer">
          CopyMail v{appVersion} · Lokal &amp; Sicher · Keine Daten verlassen Ihren Rechner
        </footer>
      </div>

      <SettingsDrawer
        open={showSettings}
        settings={settings}
        onChange={updateSettings}
        onClose={() => setShowSettings(false)}
        reduceMotion={reduceMotion}
        appVersion={appVersion}
      />
      <HelpDialog open={showHelp} onClose={() => setShowHelp(false)} reduceMotion={reduceMotion} />
    </div>
  );
}

function isInputFocused(): boolean {
  const t = document.activeElement;
  if (!t) return false;
  const tag = t.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || (t as HTMLElement).isContentEditable;
}

function formatLocalDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

async function browserClipboardWrite(text: string, html: string) {
  try {
    const clipItems = [new ClipboardItem({
      'text/html': new Blob([html], { type: 'text/html' }),
      'text/plain': new Blob([text], { type: 'text/plain' }),
    })];
    await navigator.clipboard.write(clipItems);
  } catch {
    await navigator.clipboard.writeText(text);
  }
}

export default App;
