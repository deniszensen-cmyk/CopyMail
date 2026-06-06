/**
 * Zentrale Liste aller IPC-Kanäle. Wird von Main, Preload und Renderer
 * geteilt, damit ein Tippfehler an *einer* Stelle den Build sprengt
 * statt erst zur Laufzeit zu scheitern.
 *
 * Wichtig: dieses Modul darf KEINE React/Browser-/Node-spezifischen
 * Imports haben, damit es überall importierbar bleibt.
 */
export const IPC = {
  Window: {
    Minimize: 'window:minimize',
    ToggleMaximize: 'window:toggle-maximize',
    Close: 'window:close',
    IsMaximized: 'window:is-maximized',
    Focus: 'window:focus',
    MaximizeChanged: 'window:maximize-changed',
  },
  Config: {
    Load: 'config:load',
    Save: 'config:save',
    Path: 'config:path',
  },
  Files: {
    Register: 'register-file',
    StartDrag: 'start-drag',
  },
  Clipboard: {
    Copy: 'copy-to-clipboard',
  },
  History: {
    Load: 'history:load',
    Save: 'history:save',
    Clear: 'history:clear',
  },
  Watcher: {
    Start: 'watcher:start',
    Stop: 'watcher:stop',
    Suspend: 'watcher:suspend',
    Changed: 'watcher:changed',
  },
  Pin: {
    Set: 'set-always-on-top',
    Get: 'get-always-on-top',
  },
} as const;

export type IpcChannel =
  | (typeof IPC.Window)[keyof typeof IPC.Window]
  | (typeof IPC.Config)[keyof typeof IPC.Config]
  | (typeof IPC.Files)[keyof typeof IPC.Files]
  | (typeof IPC.Clipboard)[keyof typeof IPC.Clipboard]
  | (typeof IPC.History)[keyof typeof IPC.History]
  | (typeof IPC.Watcher)[keyof typeof IPC.Watcher]
  | (typeof IPC.Pin)[keyof typeof IPC.Pin];
