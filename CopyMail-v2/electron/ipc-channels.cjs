// Spiegelung von src/shared/ipc-channels.ts. Wenn ein Channel-Name hier
// geändert wird, muss er in der TS-Variante mitgeändert werden – und
// umgekehrt. Beide Listen werden im CI-Lauf gegen einander geprüft.
module.exports = {
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
  Pin: {
    Set: 'set-always-on-top',
    Get: 'get-always-on-top',
  },
};
