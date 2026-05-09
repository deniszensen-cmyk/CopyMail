import { Download, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import type { UpdateInfo } from '../utils/updateCheck';

interface Props {
  update: UpdateInfo | null;
  onOpen: () => void;
  onDismiss: () => void;
  reduceMotion?: boolean | null;
}

export function UpdateBanner({ update, onOpen, onDismiss, reduceMotion }: Props) {
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
          <span>
            <strong>Update verfügbar:</strong> CopyMail v{update.version}
          </span>
          <button className="btn-secondary small" onClick={onOpen} title="Im Browser öffnen">
            <Download size={14} /> Herunterladen
          </button>
          <button className="btn-icon small" onClick={onDismiss} aria-label="Schließen" title="Schließen">
            <X size={14} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
