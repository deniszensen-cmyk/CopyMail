import { useState, useCallback, useRef, useEffect } from 'react';
import { Mail, Upload, Copy, Check, FileText, AlertCircle, Trash2, Pin, PinOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { processEmailFile, formatForwardedEmail } from './utils/EmailProcessor';
import type { EmailData } from './utils/EmailProcessor';
import './index.css';

// Detect if running inside Electron
const isElectron = typeof window !== 'undefined' && !!window.electronAPI;

function App() {
  const [isDragging, setIsDragging] = useState(false);
  const [emailData, setEmailData] = useState<EmailData | null>(null);
  const [formattedContent, setFormattedContent] = useState<{ text: string; html: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [alwaysOnTop, setAlwaysOnTop] = useState(false);
  const [filePath, setFilePath] = useState<string | null>(null);
  const [copyMode, setCopyMode] = useState<'combo' | 'text' | 'file'>('combo');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const copyBtnRef = useRef<HTMLButtonElement>(null);

  // Sync always-on-top state on mount
  useEffect(() => {
    if (isElectron) {
      window.electronAPI!.getAlwaysOnTop().then(setAlwaysOnTop);
    }
  }, []);

  const toggleAlwaysOnTop = async () => {
    const next = !alwaysOnTop;
    if (isElectron) {
      await window.electronAPI!.setAlwaysOnTop(next);
    }
    setAlwaysOnTop(next);
  };

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    setCopied(false);
    setIsLoading(true);
    try {
      console.log('File dropped:', file.name);
      
      let path = (file as any).path;
      // In newer Electron, we might need webUtils
      if (!path && (window as any).electronAPI?.getPathForFile) {
        path = await (window as any).electronAPI.getPathForFile(file);
      }
      
      console.log('Path detected:', path);

      const data = await processEmailFile(file);
      setEmailData(data);
      
      if (isElectron && path) {
        setFilePath(path);
      }
      
      const formatted = formatForwardedEmail(data);
      setFormattedContent(formatted);
      setTimeout(() => copyBtnRef.current?.focus(), 100);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Fehler beim Verarbeiten der Datei';
      setError(msg);
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const onDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };
  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  };

  const handleCopy = async () => {
    if (!formattedContent || isCopying) return;
    
    setIsCopying(true);
    if (isElectron) {
      const data: { text?: string; html?: string; filePath?: string } = {};
      
      if (copyMode === 'combo' || copyMode === 'text') {
        data.text = formattedContent.text;
        data.html = formattedContent.html;
      }
      
      if (filePath && (copyMode === 'combo' || copyMode === 'file')) {
        data.filePath = filePath;
      }
      
      const success = await window.electronAPI!.copyToClipboard(data);
      setCopied(success);
      setTimeout(() => setCopied(false), 2500);
    } else {
      // Browser fallback (only text/html)
      if (copyMode === 'combo' || copyMode === 'text') {
        await doClipboard(formattedContent.text, formattedContent.html, setCopied);
      }
    }
    setIsCopying(false);
  };

  const onDragStart = (e: React.DragEvent) => {
    if (isElectron && filePath) {
      console.log('Drag started for:', filePath);
      
      // Clear dataTransfer to let Electron's native drag take control
      // We only set a dummy text to trigger the drag event
      e.dataTransfer.setData('text/plain', 'File Drag');
      
      // Native drag
      window.electronAPI!.startDrag(filePath);
    }
  };

  const reset = () => {
    setEmailData(null);
    setFormattedContent(null);
    setFilePath(null);
    setError(null);
    setCopied(false);
  };

  return (
    <div className="container">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
        className="glass-card"
      >
        {/* Header */}
        <header className="app-header">
          <div className="header-top">
            <div className="icon-wrapper">
              <Mail size={26} strokeWidth={1.8} />
            </div>
            {/* Always-on-top toggle — only shown in Electron */}
            {isElectron && (
              <button
                id="btn-pin"
                onClick={toggleAlwaysOnTop}
                className={`btn-pin${alwaysOnTop ? ' active' : ''}`}
                title={alwaysOnTop ? 'Always on Top deaktivieren' : 'Always on Top aktivieren'}
                aria-label="Always on Top umschalten"
                aria-pressed={alwaysOnTop}
              >
                {alwaysOnTop ? <Pin size={16} /> : <PinOff size={16} />}
                <span>{alwaysOnTop ? 'Angepinnt' : 'Pinnen'}</span>
              </button>
            )}
          </div>
          <h1>CopyMail</h1>
          <p className="subtitle">
            Ziehe eine .msg oder .eml Datei hinein – der Inhalt wird formatiert in die Zwischenablage kopiert.
          </p>
        </header>

        {/* Main content area */}
        <AnimatePresence mode="wait">
          {!emailData ? (
            <motion.div
              key="dropzone"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.22 }}
              className={`drop-zone${isDragging ? ' active' : ''}`}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
              aria-label="Datei ablegen oder auswählen"
            >
              {isLoading ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                  style={{ color: 'var(--accent-indigo)' }}
                >
                  <Upload size={48} strokeWidth={1.5} />
                </motion.div>
              ) : (
                <Upload size={48} strokeWidth={1.5} className="drop-zone-icon" />
              )}
              <p>{isLoading ? 'Verarbeite…' : 'Datei hierher ziehen oder klicken'}</p>
              <span className="drop-zone-hint">.msg · .eml</span>
              <input
                type="file"
                ref={fileInputRef}
                onChange={onFileSelect}
                accept=".msg,.eml"
                style={{ display: 'none' }}
              />
            </motion.div>
          ) : (
            <motion.div
              key="preview"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
              className="preview-panel"
            >
              {/* Toolbar */}
              <div className="preview-toolbar">
                <div className="preview-title">
                  <div 
                    className="drag-handle"
                    title="Datei hierher ziehen, um sie anzuhängen"
                    draggable={true}
                    onDragStart={onDragStart}
                  >
                    <img 
                      src="./mail-icon.png" 
                      alt="Mail" 
                      draggable={false}
                      style={{ width: '22px', height: '22px', pointerEvents: 'none' }}
                    />
                  </div>
                  <span>Mail-Vorschau</span>
                </div>
                
                <div className="copy-mode-toggle">
                  <button 
                    onClick={() => setCopyMode('combo')}
                    className={copyMode === 'combo' ? 'active' : ''}
                    title="Text & Datei kopieren"
                  >Beides</button>
                  <button 
                    onClick={() => setCopyMode('text')}
                    className={copyMode === 'text' ? 'active' : ''}
                    title="Nur Text kopieren"
                  >Text</button>
                  <button 
                    onClick={() => setCopyMode('file')}
                    className={copyMode === 'file' ? 'active' : ''}
                    title="Nur Datei kopieren"
                  >Datei</button>
                </div>

                <div className="toolbar-actions">
                  <button
                    id="btn-copy"
                    ref={copyBtnRef}
                    onClick={handleCopy}
                    disabled={isCopying}
                    className={`btn-primary${copied ? ' success' : (isCopying ? '' : ' pulse')}`}
                  >
                    {isCopying ? (
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                      >
                        <Upload size={16} />
                      </motion.div>
                    ) : (
                      copied ? <Check size={16} /> : <Copy size={16} />
                    )}
                    {isCopying ? 'Kopiere...' : (copied ? 'Kopiert!' : 'Kopieren')}
                  </button>
                  <button
                    id="btn-reset"
                    onClick={reset}
                    className="btn-icon"
                    title="Neue Datei"
                    aria-label="Zurücksetzen"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {/* Meta */}
              <div className="mail-meta">
                <span className="mail-meta-label">Von:</span>
                <span className="mail-meta-value">{emailData.from}</span>

                <span className="mail-meta-label">Datum:</span>
                <span className="mail-meta-value">
                  {new Date(emailData.date).toLocaleString('de-DE', {
                    day: '2-digit', month: '2-digit', year: 'numeric',
                    hour: '2-digit', minute: '2-digit'
                  })}
                </span>

                {emailData.to && (
                  <>
                    <span className="mail-meta-label">An:</span>
                    <span className="mail-meta-value">{emailData.to}</span>
                  </>
                )}

                <span className="mail-meta-label">Betreff:</span>
                <span className="mail-meta-value subject">{emailData.subject}</span>
              </div>

              {/* Body preview */}
              <div className="preview-container">
                <div
                  className="mail-body"
                  dangerouslySetInnerHTML={{
                    __html: emailData.bodyHtml || emailData.body.replace(/\n/g, '<br>')
                  }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              className="error-message"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
            >
              <AlertCircle size={16} />
              <span>{error}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Copied toast */}
      <AnimatePresence>
        {copied && (
          <motion.div
            className="copied-banner"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
          >
            <Check size={18} />
            Inhalt in Zwischenablage kopiert!
          </motion.div>
        )}
      </AnimatePresence>

      <footer className="app-footer">CopyMail v1.0 · Lokal &amp; Sicher · Keine Daten verlassen Ihren Rechner</footer>
    </div>
  );
}

/** Copy both HTML and plain text to clipboard */
async function doClipboard(text: string, html: string, onSuccess: (v: boolean) => void) {
  try {
    const clipItems = [new ClipboardItem({
      'text/html': new Blob([html], { type: 'text/html' }),
      'text/plain': new Blob([text], { type: 'text/plain' }),
    })];
    await navigator.clipboard.write(clipItems);
  } catch {
    await navigator.clipboard.writeText(text);
  }
  onSuccess(true);
  setTimeout(() => onSuccess(false), 2500);
}

export default App;
