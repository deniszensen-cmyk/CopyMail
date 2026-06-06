import { Pin, Minus, Square, X, Copy as CopySquare, Settings as SettingsIcon, HelpCircle, History } from 'lucide-react';

interface Props {
  isElectron: boolean;
  alwaysOnTop: boolean;
  isMaximized: boolean;
  onTogglePin: () => void;
  onMinimize: () => void;
  onToggleMaximize: () => void;
  onClose: () => void;
  onOpenSettings: () => void;
  onOpenHelp: () => void;
  onOpenHistory?: () => void;
  historyCount?: number;
}

export function Titlebar(props: Props) {
  const {
    isElectron, alwaysOnTop, isMaximized,
    onTogglePin, onMinimize, onToggleMaximize, onClose, onOpenSettings, onOpenHelp,
    onOpenHistory, historyCount,
  } = props;

  return (
    <div className="titlebar" role="toolbar" aria-label="Fensterleiste">
      <div className="titlebar-drag">
        <span className="titlebar-title">CopyMail</span>
      </div>

      {onOpenHistory && (
        <button
          type="button"
          className="titlebar-btn"
          title={`Zwischenablage-Verlauf (Strg+H)${historyCount ? ` – ${historyCount} Eintrag${historyCount === 1 ? '' : 'e'}` : ''}`}
          aria-label="Zwischenablage-Verlauf öffnen"
          onClick={onOpenHistory}
          style={{ position: 'relative' }}
        >
          <History size={14} />
          {!!historyCount && historyCount > 0 && (
            <span
              style={{
                position: 'absolute',
                top: -2,
                right: -2,
                fontSize: '0.6em',
                background: '#6366f1',
                color: 'white',
                borderRadius: '50%',
                minWidth: 14,
                height: 14,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 3px',
                lineHeight: 1,
              }}
            >
              {historyCount > 99 ? '99+' : historyCount}
            </span>
          )}
        </button>
      )}

      <button
        type="button"
        className="titlebar-btn"
        title="Hilfe (?)"
        aria-label="Hilfe"
        onClick={onOpenHelp}
      >
        <HelpCircle size={14} />
      </button>
      <button
        type="button"
        className="titlebar-btn"
        title="Einstellungen"
        aria-label="Einstellungen"
        onClick={onOpenSettings}
      >
        <SettingsIcon size={14} />
      </button>

      {isElectron && (
        <button
          type="button"
          onClick={onTogglePin}
          className={`titlebar-btn pin${alwaysOnTop ? ' active' : ''}`}
          title={alwaysOnTop ? 'Always on Top deaktivieren (Ctrl+P)' : 'Always on Top aktivieren (Ctrl+P)'}
          aria-label="Always on Top umschalten"
          aria-pressed={alwaysOnTop}
        >
          <Pin size={14} />
        </button>
      )}

      {isElectron && (
        <>
          <button type="button" className="titlebar-btn" title="Minimieren" aria-label="Minimieren" onClick={onMinimize}>
            <Minus size={14} />
          </button>
          <button
            type="button"
            className="titlebar-btn"
            title={isMaximized ? 'Wiederherstellen' : 'Maximieren'}
            aria-label={isMaximized ? 'Wiederherstellen' : 'Maximieren'}
            onClick={onToggleMaximize}
          >
            {isMaximized ? <CopySquare size={13} /> : <Square size={12} />}
          </button>
          <button type="button" className="titlebar-btn close" title="Schließen" aria-label="Schließen" onClick={onClose}>
            <X size={14} />
          </button>
        </>
      )}
    </div>
  );
}
