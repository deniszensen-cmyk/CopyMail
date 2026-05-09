# Architektur

Kleine Windows-Desktop-Anwendung (Electron + React + Vite), die `.msg`- und
`.eml`-Dateien einliest, eine Vorschau zeigt und den Mailinhalt als formatierten
Text **plus** die Originaldatei in einem Schritt in die Windows-Zwischenablage
schreibt.

## Komponenten

```
┌─────────────────────────────────────────────────────────────┐
│ Electron-Main (Node)         electron/main.cjs              │
│  • IPC: register-file, copy-to-clipboard, start-drag, ...   │
│  • CSP per webRequest, Sandbox-Renderer, Pfad-Whitelist     │
│  • Tray-Icon, Globaler Hotkey Ctrl+Alt+M                    │
│  • spawnt den C#-Helper bei Bedarf                          │
├─────────────────────────────────────────────────────────────┤
│ Preload (sandboxed)          electron/preload.cjs           │
│  • exposes contextBridge.electronAPI                        │
├─────────────────────────────────────────────────────────────┤
│ Renderer (React 19)          src/                           │
│  • UI, Drag&Drop, Vorschau, Settings, Update-Banner         │
│  • src/utils/EmailProcessor.ts (DOMPurify-Sanitizer)        │
│  • src/utils/MsgParser.ts (eigener OLE2-/MAPI-Parser)       │
│  • src/utils/forwardTemplate.ts (eigene Templates)          │
│  • src/components/* (UI-Bausteine)                          │
├─────────────────────────────────────────────────────────────┤
│ Native Helper (.NET 4.8)     native/ClipboardHelper/        │
│  • Schreibt FileDrop + UnicodeText + HTML-Format            │
│    in die Windows-Zwischenablage (was Electrons Clipboard   │
│    standardmäßig nicht in einem Rutsch kann)                │
└─────────────────────────────────────────────────────────────┘
```

## Sicherheit

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.
- `Content-Security-Policy` per Meta-Tag **und** per `onHeadersReceived`-Header.
- Mail-HTML wird vor dem Rendern und vor dem Clipboard-Write durch
  **DOMPurify** sanitisiert (mit Hooks gegen Outlook-/VML-/MathML-Reste und
  gefährliche `style: url(http…)`-Inhalte).
- `start-drag` und `copy-to-clipboard` akzeptieren ausschließlich Pfade aus
  einer Main-seitig gepflegten Whitelist (Pfad wird einmal beim Drop/Pick
  registriert).
- `will-navigate`/`will-attach-webview` blockiert; externe Links nur per
  `shell.openExternal` und nur für `http(s)`.

## Entwicklung

```powershell
npm install
npm run electron:dev
```

Vite läuft auf `http://localhost:5180`, Electron lädt diese URL. Vor dem ersten
Lauf muss der Native Helper einmal gebaut werden:

```powershell
npm run build:helper
```

Helper wird nach `native/ClipboardHelper/publish/CopyMailClipboard.exe` gebaut.
Voraussetzung: `csc.exe` (entweder via .NET Framework Developer Pack 4.x oder
Visual Studio 2022).

## Tests

```powershell
npm test            # einmalig
npm run test:watch  # watch-mode
npm run test:coverage
```

Vitest mit `jsdom`-Umgebung. Tests liegen in `src/**/*.test.ts(x)`.

## Build (Installer + Portable)

```powershell
npm install
npm run build:helper
npm run build
npm run electron:build:win
```

Ergebnisse in `dist-electron/`:
- `CopyMail v2-1.2.0-Setup.exe` – NSIS-Installer (oneClick, perUser)
- `CopyMail-1.2.0-portable.exe` – Portable EXE (kein Installer nötig)

Anschließend `npm run package` baut ein User-fertiges ZIP mit Doku.

## Verzeichnisstruktur

```
.
├── src/                # Renderer (React + TypeScript)
├── electron/           # Main + Preload (CommonJS)
├── native/             # C#-Helper für Windows-Clipboard
├── public/             # Statische Assets (Icon, mail-icon.png)
├── scripts/            # PowerShell-Helfer (Release, Packaging)
├── .github/workflows/  # CI + Release auf GitHub Actions
├── legacy/v1/          # Archivierte v1 (siehe LEGACY.md)
└── *.md                # Doku
```
