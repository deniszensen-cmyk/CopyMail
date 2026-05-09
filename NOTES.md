# CopyMail v2

Diese Variante laesst die Original-App im uebergeordneten Ordner unangetastet.

## Was ist neu?

- Text-only nutzt weiterhin Electron Clipboard.
- Datei nutzt einen kleinen Windows-Helper:
  - `UnicodeText`
  - `HTML Format`
  - `FileDrop`
- Der Helper wird nur beim Kopieren gestartet und laeuft nicht dauerhaft im Hintergrund.
- Der fruehere Modus `Beides` ist deaktiviert, weil Zielprogramme bei Datei + Text oft nur die Datei einfuegen.
- Fuer Firefox ist Drag & Drop der empfohlene Weg, um die Maildatei anzuhaengen.

## Start

Per Doppelklick:

```text
CopyMail-v2 starten.vbs
```

Der Starter startet den Vite-Server und Electron ohne sichtbares Terminalfenster.

## Build

```powershell
npm install
npm run build:helper
npm run build
npm run electron:build:win
```

Der Helper wird nach `native/ClipboardHelper/publish/CopyMailClipboard.exe` gebaut und beim Electron-Build als `clipboard-helper` mit ausgeliefert.
