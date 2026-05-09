import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  open: boolean;
  onClose: () => void;
  reduceMotion?: boolean | null;
}

const SHORTCUTS: Array<[string, string]> = [
  ['Strg + C', 'Aktuelle Mail kopieren (wenn keine Selection aktiv).'],
  ['Strg + M', 'Modus wechseln (Text ↔ Datei).'],
  ['Strg + P', 'Always on Top umschalten.'],
  ['Strg + F', 'In der Mail-Vorschau suchen.'],
  ['Strg + Alt + M', 'CopyMail von überall in den Vordergrund holen (global).'],
  ['Esc', 'Reset / aktuelle Mail entladen.'],
  ['F2', 'CopyMail-Fenster fokussieren.'],
  ['?', 'Diese Hilfe anzeigen.'],
];

export function HelpDialog({ open, onClose, reduceMotion }: Props) {
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
          <motion.div
            className="help-dialog"
            role="dialog"
            aria-label="Hilfe"
            initial={reduceMotion ? false : { opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="drawer-header">
              <h2>Tastatur-Kürzel</h2>
              <button className="btn-icon" onClick={onClose} aria-label="Schließen" title="Schließen">
                <X size={16} />
              </button>
            </div>
            <table className="help-table">
              <tbody>
                {SHORTCUTS.map(([k, t]) => (
                  <tr key={k}>
                    <th><kbd>{k}</kbd></th>
                    <td>{t}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="help-foot">
              Im Vorschau-Bereich öffnet <kbd>Strg + F</kbd> eine Suche, die Treffer markiert.
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
