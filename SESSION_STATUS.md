# CopyMail — Session-Status

Stand: **2026-06-01, Abend**
Letzte aktive Version: **1.3.7** (gepusht), evtl. **1.3.8** ausstehend.

> Diese Datei beim Start der nächsten Session zuerst lesen, um nahtlos
> weiterzumachen.

---

## Schnellüberblick

| Bereich | Stand |
|---|---|
| Code auf `main` | aktuell, alle Features eingebaut |
| Letzter Tag | `v1.3.7` (siehe „Offene Punkte") |
| package.json-Version | `1.3.7` |
| Tests (lokal) | EmailProcessor: 18 grün; gesamt: 47 grün (außer MsgParser-Sandbox-Glitch) |
| Lokaler Build | knapp wegen Festplatte — **Dev-Mode (`npm run electron:dev`) reicht zum Testen** |
| CI / Releases | https://github.com/deniszensen-cmyk/CopyMail/actions |

---

## Was wurde diese Session umgesetzt

1. **CHANGELOG.md** angelegt — Versionen 1.3.2 bis 1.3.7 dokumentiert.
2. **1.3.5 — Tabellen-Rahmen-Fix v2** (`EmailProcessor.ts`):
   - DOMPurify: `ADD_TAGS: ['style']` + `FORCE_BODY: true` (sonst wurden `<style>`-Blöcke verworfen).
   - `neutralizeTableBorders()`: `border="0"`, `border:none` inline auf `<table>/<tr>/<td>/<th>`.
   - `!important`-Reset im globalen Style-Block.
3. **1.3.6 — MSO-Klassen + HTML4-Attribute**:
   - `stripMsoTableClass()` entfernt `MsoNormalTable`, `MsoTableGrid` … aus `<table>`/`<td>`/`<tr>`.
   - Zusätzlich `frame="void" rules="none" bordercolor="white" cellspacing="0"` auf jeder Tabelle (für Programme, die `style="…"` strippen).
   - `decodeBasicEntities()` für Plain-Text-Body (`&gt;`/`&amp;` → echte Zeichen).
4. **1.3.7 — Ohne-Signatur-Toggle** (Hauptlösung für Bitrix):
   - Setting `stripSignature` + Toolbar-Button **„Ohne Signatur"** / **„Mit Signatur"**.
   - `stripSignatureText()` mit Greeting-Regex (DE+EN: MfG/VG/LG, Mit freundlichen/besten/schönen/herzlichen Grüßen, Kind regards …).
   - `extractNameFromHeader()` rekonstruiert Namen aus `Max <max@x>` oder `max.mustermann@x` → „Max Mustermann".
   - `looksLikeDisclaimer()` filtert Telefon/Mobil/HRB/USt/Geschäftsführer aus Name-Suche.
   - Bei `stripSignature: true` wird der **HTML-Body komplett verworfen** → Plain-Text-Pipeline → keine Tabellen → kein Bitrix-Problem.
5. **Update-Banner mit Release-Notes** (eingebaut, evtl. 1.3.8 ausstehend):
   - `UpdateBanner.tsx`: aufklappbarer „Was ist neu?"-Bereich, Mini-Markdown-Renderer (Headings, Listen, Bold, Code, Links).
   - `.github/workflows/release.yml`: extrahiert CHANGELOG-Abschnitt der jeweiligen Version als `body_path` für softprops/action-gh-release.

---

## Bestätigte Funktionsfähigkeit

- ✅ Auskunftsersuchen-Mail in **Word/Outlook/eM Client** mit „Mit Signatur": Tabellen-Rahmen weg.
- ✅ Auskunftsersuchen-Mail in **Bitrix** mit „Ohne Signatur": kein Tabellen-Rahmen-Problem mehr, da reines `<p>`-Layout.
- ✅ Dev-Mode (`npm run electron:dev`) zeigt den Toggle und funktioniert wie erwartet.

---

## Heute noch eingebauter Nachzügler

**User-Kritik nach Test mit `Ohne Signatur` + `Nur aktuell`**: oben fehlen die
Leerzeilen zwischen Anrede / Inhalt / Grußformel — Header sah „doof" aus,
während die `Mit Signatur`-Variante sauber war.

**Ursache**: im Plain-Text-Pfad (`stripSignature: true` aktiviert ihn) wurde
`<p style="margin:0">` ohne vertikalen Abstand erzeugt. Im HTML-Pfad
„Mit Signatur" sind die Word-Original-Absatzstyles drin (≈ 12pt Bottom).

**Fix (uncommitted)**: in `src/utils/EmailProcessor.ts` margin auf
`margin:0 0 12pt 0` geändert. Sollte beide Pfade visuell angleichen.

→ **Bei der nächsten Session zuerst neu im Dev-Mode testen**:
   1. Mail droppen, `Ohne Signatur` + `Nur aktuell` aktivieren, Kopieren.
   2. Paste in Bitrix UND in eM Client. Absätze müssen wie in der
      `Mit Signatur`-Variante getrennt sein.
   3. Wenn passt: committen + 1.3.8 release ziehen (mit den Update-Banner-
      Notes).

---

## Neuer Feature-Wunsch: Zwischenablage-Historie

**Idee**: lokales Verlaufs-Panel in der App, das alle Copy-Vorgänge sammelt
und sie wieder benutzbar macht. Erweiterung zu Windows-Win+V, aber speziell
auf CopyMail-Forwards zugeschnitten.

**Funktionen**:
- Liste der letzten Copy-Vorgänge mit Subject, Absender, Datum, Snippet.
- **Pinnen** (📌) → Item bleibt persistent, auch wenn Historie auto-rotiert.
- **Löschen** (🗑️) je Item, plus „Alles Ungepinnte löschen".
- **Erneut kopieren** (📋) → wirft den gespeicherten Text+HTML+FilePaths
  zurück in die Zwischenablage.

**Datenmodell** (Vorschlag):
```ts
interface ClipboardEntry {
  id: string;             // crypto.randomUUID()
  capturedAt: number;
  subject: string;
  from: string;
  date: string;
  snippet: string;        // <=160 Zeichen Plain-Text
  text: string;
  html: string;
  filePaths: string[];
  fileCount: number;
  pinned: boolean;
  origin: 'single' | 'multi' | 'history-replay';
}
```

**Persistenz**:
- Electron: `userData/clipboard-history.json` via IPC (analog Settings),
  Größenlimit ~10 MB pro Datei (HTML ist groß).
- Browser-Variante: `localStorage` mit 4 MB Hartlimit, dann ältestes
  ungepinnte Item kicken.
- **Auto-Rotation**: bei >50 Einträgen ältestes ungepinntes weg.

**UI-Plan**:
- Neuer Toolbar-Button **„Verlauf"** (📋 oder `History`-Icon aus lucide)
  rechts neben „Ohne Signatur"; Badge mit Anzahl wenn >0.
- Klick → öffnet Drawer/Panel von rechts (analog `SettingsDrawer`).
- Pro Eintrag: kompakte Karte (Subject fett, Absender + Datum klein,
  Snippet zwei Zeilen, drei Action-Icons rechts).
- Suche oben (filtert nach Subject/Absender/Snippet).
- Tastatur: `Strg+H` öffnet Verlauf, Pfeil-rauf/runter navigiert, `Enter`
  kopiert erneut.

**Sicherheits-/Datenschutz-Hinweis**: das Panel speichert komplette
Mail-Inhalte lokal. Bei einem Mandanten-PC heißt das: nicht-gepinnte
Einträge rotieren weg, aber gepinnte bleiben. Default-Setting „Verlauf
aktiv" sollte ggf. konservativ sein (z.B. „nur in der Session, nicht
persistent"), mit User-Toggle in Settings.

**Implementierungs-Schritte für morgen**:
1. `src/utils/clipboardHistory.ts` – Schema, Load/Save, Add, TogglePin,
   Remove, Rotate. Inkl. Vitest-Suite.
2. Setting `clipboardHistoryEnabled: boolean` + `historyRetentionMode:
   'session' | 'persistent'` in `settings.ts` und `SettingsDrawer.tsx`.
3. IPC-Channels in `electron/ipc-channels.cjs`:
   `clipboard:load-history`, `clipboard:save-history`, `clipboard:clear`.
4. `preload.cjs` → entsprechende `electronAPI`-Methoden.
5. `electron/main.cjs` → Handler, persistente Datei in `userData`.
6. `src/components/ClipboardHistoryPanel.tsx` – Drawer-UI mit Suche,
   Karten, Action-Buttons.
7. In `App.tsx` `handleCopy`/`handleCopyOne` ergänzen: nach erfolgreichem
   Copy → `addEntry(formatted)`.
8. Toolbar-Button + Strg+H-Hotkey + Hilfe-Overlay-Eintrag.
9. CHANGELOG-Eintrag + Release als **1.4.0** (Feature, kein Patch).

**Geschätzter Aufwand**: ca. 2-3 Stunden konzentriert.

---

## Offene Punkte / Nächste Session

### 1. Tag v1.3.7 vs. amended Commit

Der User hat nach `release:patch` (Variante A) einen `git commit --amend --no-edit` + `git push --force-with-lease` gemacht, um UpdateBanner.tsx + release.yml dazu zu packen. Damit sitzt der Tag `v1.3.7` möglicherweise auf einem Commit, den es nicht mehr gibt (orphaned).

**Klären zu Beginn:**
- `git log --oneline v1.3.7 main` — zeigt, ob der Tag noch erreichbar ist.
- `git ls-remote --tags origin` — zeigt Remote-Tag-SHA.
- GitHub-Releases-Seite checken: ist v1.3.7 schon released? Mit welchen Notes?

**Optionen:**
- **A**: Tag löschen + neu setzen + Release auf GitHub manuell löschen, CI rebuild.
- **B (empfohlen)**: einfach `npm run release:patch` → **1.3.8** mit Update-Banner-Notes ziehen. 1.3.7 unverändert lassen.

### 2. Bitrix-Edge-Cases nachtesten

- „Ohne Signatur" mit Mails **ohne** Grußformel im Body — wird MfG + Name korrekt angehängt?
- „Ohne Signatur" mit Mails wo Greeting in Signatur-Tabelle ist (häufig bei HTML-only-Mails).
- Plain-Text-Mails ohne HTML-Body: `data.body` leer? → Test mit korrektem Fallback.

### 3. Mögliche Verbesserungen (vom User noch nicht angefragt)

- Auto-Detect: bei MSGs mit >10 Tabellen automatisch „Ohne Signatur" vorschlagen (Toast).
- Mehrsprachige Greeting-Liste (Französisch, Spanisch) — aktuell nur DE+EN.
- Im Settings-Drawer eine kurze Vorschau-Box anzeigen, wie „Ohne Signatur" wirkt.

---

## Bekannte technische Eigenheiten

### Lokaler Build oft am Disk-Speicher

`npm run electron:build:portable` braucht ~1.5–2 GB Peak. Festplatte fiel mehrfach unter 100 MB, was den Build endlos hängen ließ (signtool wartete auf gelockte Datei).

**Workaround**:
1. **Dev-Mode statt Build** (`npm run electron:dev`) — kein Platz-Problem, Hot-Reload, zeigt dieselbe Funktionalität.
2. Cleanup-Reihenfolge: `dist-electron`, `dist`, `node_modules\.vite`, `%LOCALAPPDATA%\electron-builder\Cache`, `%LOCALAPPDATA%\electron\Cache`.
3. **Fallback**: CI bauen lassen, EXE von GitHub-Releases ziehen.

### Cowork-Mount-Sync-Issues

Während der Session gab es mehrfach Diskrepanzen zwischen
- Linux-Mount (`/sessions/.../mnt/CopyMail/`)
- Windows-Disk (`C:\Users\…\CopyMail\`)

Der File-Tool-View zeigte teilweise Cowork-Sandbox-State, der **nicht** auf Windows war. Symptom: `git status` im cmd zeigt keine modifizierten Dateien, obwohl der File-Tool-Read frische Inhalte sieht.

**Diagnose**: immer `git status` im echten cmd + `findstr "version" package.json` zur Bestätigung der Disk-Realität.

### PowerShell-Scripts müssen ASCII bleiben

Umlaute in den PS-Skripten führten zu Parser-Fehlern unter PowerShell 5.1. Alle `scripts/*.ps1` sind ASCII-only.

### Production-EXE-Eigenheiten

- `sandbox: false` ist nötig (sonst kein `webUtils` → kein Drag-Out).
- CSP muss `file:` im default-src/script-src/style-src enthalten (sonst keine Titlebar in NSIS).
- `BrowserWindow({ show: false })` + `ready-to-show`: wenn der Renderer nicht lädt, wird das Fenster nie sichtbar. → bei „EXE startet nicht" zuerst `dist/index.html` + `dist/assets/*` prüfen.

### Test-Suite Sandbox-Glitch

`MsgParser.test.ts` hängt manchmal in der Linux-Sandbox. Im CI (Windows-Runner) läuft sie korrekt. Vitest selektiv aufrufen:
```bash
vitest run src/utils/EmailProcessor.test.ts src/utils/quotedReply.test.ts
```

---

## Wichtige Dateien

| Pfad | Inhalt |
|---|---|
| `src/utils/EmailProcessor.ts` | Kern der Mail-Verarbeitung — Sanitizing, Tabellen-Neutralisierung, Signatur-Stripping, Forward-Format |
| `src/utils/quotedReply.ts` | Zitat-Erkennung für AW/FW/WG |
| `src/utils/updateCheck.ts` | GitHub-Release-API-Abfrage, Caching |
| `src/utils/settings.ts` | Settings-Schema + Persistenz (Electron via IPC, Browser via localStorage) |
| `src/App.tsx` | Hauptseite, Toolbar-Toggles, Copy-Logik |
| `src/components/UpdateBanner.tsx` | Update-Banner inkl. Release-Notes-Anzeige |
| `src/components/SettingsDrawer.tsx` | Einstellungen-UI |
| `electron/main.cjs` | Electron Main-Process: Window, CSP, IPC, Tray, Hotkey |
| `electron/preload.cjs` | contextBridge → `window.electronAPI` |
| `native/ClipboardHelper/Program.cs` | C# CF_HTML-Builder mit Fragment-Markern + Self-Test |
| `.github/workflows/release.yml` | CI-Build + Release inkl. CHANGELOG-Extraktion |
| `scripts/release.ps1` | Versions-Bump + Tag + Push |
| `CHANGELOG.md` | Versions-Notizen, Format Keep-a-Changelog |

---

## Release-Workflow

1. Code-Änderung machen.
2. CHANGELOG.md mit neuem `## [x.y.z] – YYYY-MM-DD`-Abschnitt erweitern (oben einfügen).
3. Lokal testen mit `npm run electron:dev` (Build-Variante nur wenn Disk-Platz da).
4. Committen:
   ```cmd
   git add <Dateien> CHANGELOG.md
   git commit -m "feat/fix: kurze Beschreibung"
   git push origin main
   ```
5. Release auslösen:
   ```cmd
   npm run release:patch   # bumpt x.y.Z+1
   ```
6. CI baut + erstellt GitHub-Release mit Notes aus CHANGELOG.

---

## Konkrete Befehlsketten (für Quick-Reference)

### Lokal testen
```cmd
cd /d C:\Users\denis.zensen.WIR-SYSTEM\Documents\GitHub\CopyMail
npm run electron:dev
```

### Alle hängenden Prozesse killen
```cmd
taskkill /F /IM "CopyMail v2.exe" 2>nul
taskkill /F /IM node.exe 2>nul
taskkill /F /IM electron.exe 2>nul
```

### Disk-Platz schaffen
```cmd
rmdir /S /Q dist-electron 2>nul
rmdir /S /Q dist 2>nul
rmdir /S /Q node_modules\.vite 2>nul
rmdir /S /Q "%LOCALAPPDATA%\electron\Cache" 2>nul
rmdir /S /Q "%LOCALAPPDATA%\electron-builder\Cache" 2>nul
```

### Status-Check
```cmd
git status
git log --oneline -5
findstr "\"version\"" package.json
git tag --sort=-creatordate | findstr v1.3
```
