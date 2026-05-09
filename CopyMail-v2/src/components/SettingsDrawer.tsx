import { useState } from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Settings } from '../utils/settings';
import { DEFAULT_SETTINGS } from '../utils/settings';
import { DEFAULT_HTML_TEMPLATE, DEFAULT_TEXT_TEMPLATE } from '../utils/forwardTemplate';

interface Props {
  open: boolean;
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
  onClose: () => void;
  reduceMotion?: boolean | null;
  appVersion: string;
}

export function SettingsDrawer({ open, settings, onChange, onClose, reduceMotion, appVersion }: Props) {
  const [tab, setTab] = useState<'general' | 'preview' | 'updates' | 'templates'>('general');
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="drawer-overlay"
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={onClose}
        >
          <motion.aside
            className="drawer"
            role="dialog"
            aria-label="Einstellungen"
            initial={reduceMotion ? false : { x: 320 }}
            animate={{ x: 0 }}
            exit={reduceMotion ? { x: 320 } : { x: 320 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="drawer-header">
              <h2>Einstellungen</h2>
              <button className="btn-icon" onClick={onClose} aria-label="Schließen" title="Schließen">
                <X size={16} />
              </button>
            </div>

            <nav className="drawer-tabs" role="tablist">
              <button role="tab" aria-selected={tab === 'general'} onClick={() => setTab('general')} className={tab === 'general' ? 'active' : ''}>Allgemein</button>
              <button role="tab" aria-selected={tab === 'preview'} onClick={() => setTab('preview')} className={tab === 'preview' ? 'active' : ''}>Vorschau</button>
              <button role="tab" aria-selected={tab === 'updates'} onClick={() => setTab('updates')} className={tab === 'updates' ? 'active' : ''}>Updates</button>
              <button role="tab" aria-selected={tab === 'templates'} onClick={() => setTab('templates')} className={tab === 'templates' ? 'active' : ''}>Vorlagen</button>
            </nav>

            <div className="drawer-body">
              {tab === 'general' && (
                <>
                  <Field label="Standard-Modus">
                    <select
                      value={settings.defaultMode}
                      onChange={(e) => onChange({ defaultMode: e.target.value as Settings['defaultMode'] })}
                    >
                      <option value="text">Text</option>
                      <option value="file">Datei</option>
                    </select>
                  </Field>
                  <Field label="Maximale Dateigröße (MB)">
                    <input
                      type="number"
                      min={1}
                      max={2048}
                      value={settings.maxFileSizeMb}
                      onChange={(e) => onChange({ maxFileSizeMb: clampInt(e.target.value, 1, 2048, 100) })}
                    />
                  </Field>
                </>
              )}

              {tab === 'preview' && (
                <>
                  <Field label="Mail-Body anzeigen">
                    <select
                      value={settings.bodyTheme}
                      onChange={(e) => onChange({ bodyTheme: e.target.value as Settings['bodyTheme'] })}
                    >
                      <option value="light">Hell (empfohlen)</option>
                      <option value="dark">Dunkel</option>
                    </select>
                  </Field>
                  <Field label="Externe Bilder zulassen" hint="Aus Datenschutzgründen empfohlen: aus.">
                    <input
                      type="checkbox"
                      checked={settings.allowExternalImages}
                      onChange={(e) => onChange({ allowExternalImages: e.target.checked })}
                    />
                  </Field>
                </>
              )}

              {tab === 'updates' && (
                <>
                  <Field label="Update beim Start prüfen">
                    <input
                      type="checkbox"
                      checked={settings.autoCheckUpdates}
                      onChange={(e) => onChange({ autoCheckUpdates: e.target.checked })}
                    />
                  </Field>
                  <Field
                    label="Update-URL"
                    hint='JSON-Endpoint mit { "version": "x.y.z", "url": "...", "notes": "..." } oder GitHub-Releases-API.'
                  >
                    <input
                      type="text"
                      value={settings.updateUrl}
                      placeholder="https://example.com/copymail/release.json"
                      onChange={(e) => onChange({ updateUrl: e.target.value })}
                    />
                  </Field>
                  <p className="drawer-info">Aktuell installiert: v{appVersion}</p>
                </>
              )}

              {tab === 'templates' && (
                <>
                  <Field label="Text-Template" hint="Variablen: {from} {to} {date} {subject} {body}">
                    <textarea
                      rows={6}
                      value={settings.forwardTemplateText ?? DEFAULT_TEXT_TEMPLATE}
                      onChange={(e) => onChange({ forwardTemplateText: e.target.value })}
                    />
                  </Field>
                  <Field label="HTML-Template">
                    <textarea
                      rows={8}
                      value={settings.forwardTemplateHtml ?? DEFAULT_HTML_TEMPLATE}
                      onChange={(e) => onChange({ forwardTemplateHtml: e.target.value })}
                    />
                  </Field>
                  <button
                    className="btn-secondary"
                    onClick={() => onChange({ forwardTemplateText: null, forwardTemplateHtml: null })}
                  >
                    Auf Standard zurücksetzen
                  </button>
                </>
              )}
            </div>

            <div className="drawer-footer">
              <button className="btn-secondary" onClick={() => onChange({ ...DEFAULT_SETTINGS })}>
                Alles zurücksetzen
              </button>
            </div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="drawer-field">
      <span className="drawer-field-label">{label}</span>
      {children}
      {hint && <span className="drawer-field-hint">{hint}</span>}
    </label>
  );
}

function clampInt(raw: string, min: number, max: number, fallback: number): number {
  const n = parseInt(raw, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}
