# CopyMail v2

Kleine Windows-Desktop-Anwendung (Electron + React + Vite), die `.msg`- und
`.eml`-Dateien einliest, eine Vorschau zeigt und den Mailinhalt als formatierten
Text **plus** die Originaldatei in einem Schritt in die Windows-Zwischenablage
schreibt. Inhalt der Mail verlässt den Rechner nicht.

## Architektur

```
┌─────────────────────────────────────────────────────────────┐
│ Electron-Main (Node)         electron/main.cjs              │
│  • IPC: register-file, copy-to-clipboard, start-drag, ...   │
│  • CSP per webRequest, Sandbox-Renderer, Pfad-Whitelist     │
│  • spawnt den C#-Helper bei Bedarf                          │
├─────────────────────────────────────────────────────────────┤
│ Preload (sandboxed)          electron/preload.cjs           │
│  • exposes contextBridge.electronAPI                        │
├─────────────────────────────────────────────────────────────┤
│ Renderer (React 19)          src/                           │
│  • UI, Drag&Drop, Vorschau                                  │
│  • src/utils/EmailProcessor.ts (Sanitizer + Format)         │
│  • src/utils/MsgParser.ts (eigener OLE2-/MAPI-Parser)       │
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
  **DOMPurify** sanitisiert.
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
npm test          # einmalig
npm run test:watch
```

Vitest mit `jsdom`-Umgebung. Tests liegen in `src/**/*.test.ts(x)`.

## Build (Installer)

```powershell
npm install
npm run build:helper
npm run build
npm run electron:build:win
```

Ergebnis: `dist-electron/CopyMail v2 Setup x.x.x.exe` (NSIS, oneClick,
perUser).

## Versionshinweise

- **v1.2.0** – DOMPurify-Sanitizer, CSP, Sandbox-Renderer, Pfad-Whitelist,
  dynamische MAPI-Codepage, Race-Schutz beim Drop, Vitest-Setup, CI.
- **v1.1.0** – C#-Helper für Windows-Clipboard-Mehrformat, „Beides"-Modus
  entfernt.

## Verwandt

- `../CopyMail/` – Legacy-v1, siehe [LEGACY.md](../LEGACY.md).
