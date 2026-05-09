# Legacy: CopyMail v1

Die ursprüngliche v1-App liegt jetzt unter [`legacy/v1/`](./legacy/v1/) und wird
**nicht mehr gepflegt**. Sie ist hauptsächlich aus diesen Gründen veraltet:

- Schreibt Dateipfade über `clipboard.writeBuffer('FileNameW', …)` – Outlook,
  Word, Teams & Co. erkennen das nicht zuverlässig als Anhang.
- Kein DOMPurify-Sanitizer, keine CSP, kein Renderer-Sandbox.
- IPC akzeptiert beliebige Pfade vom Renderer.
- `console.log`-Debug-Ausgaben in der Produktion.

`CopyMail-v2/` ersetzt das vollständig: nutzt einen kleinen .NET-Helper, der
`FileDrop`, `UnicodeText` und `HTML Format` in einem Rutsch in die
Zwischenablage schreibt, plus DOMPurify, CSP, sandboxed Renderer und
Pfad-Whitelist.

## Was tun?

- **Neue Features / Bugfixes:** in `CopyMail-v2/` einbringen.
- **Builds / Releases:** ausschließlich aus `CopyMail-v2/`.
- **v1 ausprobieren:** im Notfall `cd legacy/v1 && npm install && npm run electron:dev`
  – ohne Garantie und mit den oben genannten Einschränkungen.

## Empfehlung

Sobald nichts mehr aus `legacy/v1/` benötigt wird, kann das Verzeichnis
gelöscht werden (eigener Branch oder Tag `legacy/v1-final` bewahrt den Stand).
