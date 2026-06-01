# Changelog

Format orientiert sich an [Keep a Changelog](https://keepachangelog.com/de/1.1.0/)
und [Semver](https://semver.org/lang/de/).

## [1.3.7] – 2026-06-01

### Neu

- **„Ohne Signatur"-Toggle** in der Toolbar (neben „Nur aktuelle Mail"):
  schneidet die Signatur ab, behält Inhalt + Grußformel + Absender-Name.
  - Erkennt deutsche und englische Standard-Grußformeln (Mit freundlichen
    Grüßen, Beste Grüße, Viele Grüße, MfG, VG, LG, Liebe Grüße, Schöne
    Grüße, Freundliche Grüße, Mit kollegialen Grüßen, Kind regards, Best
    regards, Sincerely, Yours sincerely/truly/faithfully, Cheers, Regards).
  - Behält nur die Grußformel selbst plus die nächste nicht-Disclaimer-
    Zeile (= meistens der Name); Telefon-/Mobil-/Adress-/HRB-Zeilen werden
    übersprungen.
  - **Fallback bei fehlender Grußformel**: hängt automatisch
    `Mit freundlichen Grüßen\n[Name aus From-Header]` an. Wenn auch im
    From kein Klartext-Name steht (z.B. nur `max.mustermann@firma.de`),
    wird daraus „Max Mustermann" rekonstruiert.
  - **HTML-Body wird komplett verworfen** — keine Tabellen, keine
    Word-Styles, keine schwarzen Rahmen mehr in strikten Editoren wie
    Bitrix24 oder Confluence.
- **Setting „Ohne Signatur kopieren"** als persistenter Default in den
  Einstellungen unter „Allgemein". Toolbar-Toggle überschreibt pro Mail.

### Notiz zu 1.3.6

- Das in 1.3.6 dokumentierte Bitrix-Problem (Sanitizer entfernt deprecated
  HTML4-Attribute) ist mit dem Signatur-Toggle effektiv gelöst — User
  aktiviert „Ohne Signatur" für Bitrix-Paste, und das Tabellen-Problem
  taucht gar nicht erst auf.

---

## [1.3.6] – 2026-06-01

### Behoben

- **Schwarze Tabellen-Rahmen in Outlook-Signaturen beim Paste in Word /
  Outlook / eM Client** — jetzt finaler Fix:
  - **MSO-Tabellen-Klassen werden entfernt** (`MsoNormalTable`,
    `MsoTableGrid`, …). Diese triggern in der Word-HTML→RTF-Pipeline die
    Word-Default-1pt-Rahmen, die unsere Inline-`border:none`-Styles
    überstimmt haben.
  - **HTML4-Attribute zusätzlich gesetzt** für Programme, die `style="…"`
    beim Paste strippen: `frame="void"`, `rules="none"`,
    `bordercolor="white"`, `cellspacing="0"` — alte Attribute, die
    praktisch alle Sanitizer als harmlos durchlassen.
- **HTML-Entities in Plain-Text-Body** werden jetzt decodiert. Mail-
  Clients generieren den text/plain-Teil manchmal aus dem HTML-Body
  und lassen einzelne `&gt;` / `&amp;` un-decoded zurück — diese tauchten
  beim Paste in Plain-Text-Editoren (Bitrix, Slack) als Roh-Zeichen auf.

### Bekannte Einschränkung

- **Bitrix24-Editor und andere extrem strikte WYSIWYG-Sanitizer** entfernen
  beim Paste auch deprecated HTML4-Attribute (`frame`, `rules`,
  `bordercolor`) und Inline-Styles, sodass die nackte Tabellen-Struktur
  übrig bleibt. Bitrix' eigenes Editor-CSS rendert dann Default-Rahmen
  auf jeder `<td>`. Workaround: **Strg+Shift+V** ("Als Text einfügen")
  oder Inhalt vorher in Word zwischenpasten und von dort kopieren.

---

## [1.3.5] – 2026-06-01

### Behoben

- **Schwarze Tabellen-Rahmen in Signaturen** beim Einfügen in eM Client /
  Outlook / Word – jetzt wirklich. Der Fix aus 1.3.4 (border="0" + `<style>`-
  Block) wurde an zwei Stellen unwirksam:
  - **DOMPurify entfernte den `<style>`-Block**, weil `style` nicht in der
    Allow-List stand UND der HTML-Parser ihn in den `<head>` verschob,
    den DOMPurify dann verwarf. Jetzt explizit über `ADD_TAGS: ['style']`
    + `FORCE_BODY: true` freigegeben.
  - **`border="0"` alleine reichte nicht** — die Word-Tabellen-Engine
    ignoriert das Attribut, wenn die Tabelle eine CSS-Klasse wie
    `MsoNormalTable` trägt, und zeichnet ihre Default-1pt-Rahmen.
  - **Lösung**: `neutralizeTableBorders()` patcht jetzt jede `<table>`,
    `<tr>`, `<td>`, `<th>` mit inline `style="border:none;border-collapse:
    collapse"` — aber nur, wenn der Sender nicht explizit eine Border
    setzen wollte. Zusätzlich `!important`-Reset am Block-Ende als
    Belt-and-Braces.
- **Cellspacing/cellpadding/bordercolor** in der DOMPurify-Allow-List
  ergänzt, damit Outlook-Layouts ihre Padding-Steuerung behalten.

---

## [1.3.4] – 2026-06-01

### Neu

- **SVBM-Wappen als App-Icon.** Die EXE, der NSIS-Setup, die Taskbar, das
  Tray-Icon und der Browser-Tab tragen jetzt das Vereinslogo auf einem
  Indigo-Squircle (Multi-Size-ICO 16/24/32/48/64/128/256). Master als SVG
  mit eingebettetem Wappen, sodass künftige Größen-Anpassungen ohne
  Re-Design auskommen.
- **Browser-Variante ohne EXE** für Umgebungen, in denen ausführbare
  Dateien geblockt werden:
  - `npm run build:web` baut einen Ordner (`dist-web/`) für interne
    Webserver (SharePoint, IIS, GitHub Pages) oder lokal per Doppelklick
    auf `index.html`.
  - `npm run build:singlehtml` baut eine einzige `index.html` mit allem
    inline (JS, CSS, Inter-Fonts als base64).
  - `npm run package:web` zippt beides plus Doku zu einem
    Auslieferungs-Paket. LIESMICH-WEB.txt erklärt die Verteilung.
- **„Ganze Mail" vs. „Nur aktuelle Mail" Wahl** in der Toolbar (Toggle
  erscheint nur wenn ein Zitat erkannt wurde) und als persistenter
  Default in den Einstellungen. Erkennt typische Marker von
  Outlook (DE+EN), eM Client, Thunderbird, Gmail, Apple Mail und Yahoo:
  - Plain-Text: `Von:/Gesendet:/An:/Betreff:`, `-----Original Message-----`,
    `Am … schrieb …:`, `On … wrote:`, `Begin forwarded message:` etc.
  - HTML: `border-top:solid`-Container (single + double quoted),
    `OutlookMessageHeader`, `divRplyFwdMsg`, `gmail_quote`, `yahoo_quoted`,
    `<blockquote>` und `<hr>` als Fallback.
- **Multi-File-Drag-out** aus der Toolbar überträgt jetzt **alle**
  ausgewählten Mails gleichzeitig an Outlook/eM Client/Teams, nicht nur
  die erste (`startDrag({ files: […] })` mit Electron 30+ Array-Variante).

### Verbessert

- **Outlook-Signatur-Tabellen rendern ohne schwarze Default-Rahmen**
  beim Einfügen in eM Client/Word/Outlook:
  - `<style>`-Blöcke aus dem `<head>` werden in den Forward-Body übernommen
    (Outlook-Signaturen nutzen oft CSS-Klassen statt Inline-Styles).
  - Tabellen ohne explizites `border`-Attribut bekommen automatisch
    `border="0"` — Ziel-Programme respektieren das verlässlicher als CSS.
  - Zusätzlicher Default `border-collapse: collapse` für saubere Tabellen.
- **Quoted-Reply-Erkennung greift jetzt auch bei single-quoted Style-
  Attributen.** Outlook schreibt Forward-Container manchmal mit
  `style='border-top:solid'` (statt double-quoted) — das hat den
  Schnitt vorher unwirksam gemacht.
- **F12 öffnet DevTools auch in der Production-EXE** (vorher nur Dev-Mode).
  Per Env `COPYMAIL_DEVTOOLS=1` auch automatisch beim Start.
- **CSP für `file://`-Schema in Production-Builds aufgemacht** —
  Renderer-Assets aus dem asar laden zuverlässig, Custom-Titlebar erscheint
  jetzt auch in der gepackten EXE.

### Behoben

- **Custom-Titlebar war in der Production-EXE unsichtbar.** Verschachteltes
  Zusammenspiel aus `frame: false`, CSP-Origin (`'self'` vs. `file://`)
  und Renderer-CSS-Loading führte dazu, dass die Titlebar im DOM existierte,
  aber kein Styling angewendet wurde. Behoben durch explizites `file:` in
  den CSP-Direktiven.
- **Drag-out von 3 ausgewählten Mails übertrug nur 1 Datei** in das
  Ziel-Programm (Outlook/eM Client). Jetzt werden alle gleichzeitig
  übergeben.

### Doku

- **GITHUB_RELEASES.md** spiegelt die neuen Skripte (`release:patch/minor/major`,
  `package:web`).
- **LIESMICH-WEB.txt** beschreibt die Browser-Variante für Endnutzer und
  Verteilungs-Szenarien (Doppelklick vs. interner Webserver).
- **Verzeichnisstruktur** im README aktualisiert (App jetzt im Repo-Root,
  v1 unter `legacy/v1/`).

### Intern

- 47 Tests, davon 7 neu für `quotedReply.ts` (DE/EN/CRLF/Outlook/eM Client/
  Apple Mail/Gmail/Fallback-Hr).
- Build-Targets: `build`, `build:web`, `build:singlehtml`, plus die
  bestehenden Electron-Targets.
- `vite-plugin-singlefile@^2.1.0` als Dev-Dependency hinzugefügt.

---

## [1.3.3] – 2026-05-29

### Verbessert

- **Multi-File-Drag** überträgt jetzt alle ausgewählten Mail-Dateien an
  das Ziel-Programm gleichzeitig (`startDrag` mit `files`-Array).
- **F12 öffnet DevTools** auch in der Production-EXE für Vor-Ort-Diagnose.
- **CSP-Header explizit `file:`-Schema erlaubt** — Titlebar und Renderer
  laden zuverlässig auch in der gepackten EXE.

### Behoben

- Custom-Titlebar nicht sichtbar in der Portable-/NSIS-EXE.

---

## [1.3.2] – 2026-05-13

### Neu

- **Mail-Listenansicht (Win+V-Stil) bei Multi-Drop**: jede Karte zeigt
  Sender/Datum/Subject/Snippet, Klick auf Karte kopiert nur diese eine
  Mail, Drag am Mail-Symbol zieht die einzelne Datei raus, Checkbox
  steuert Sammelkopie.
- **Verkettete Sammelkopie**: bei N ausgewählten Mails legt der
  „Kopieren"-Button alle Texte als einen Forward-Block + alle Dateien
  als Anhang in die Zwischenablage.
- **Sandbox: false** als Hotfix — Custom-Titlebar, Pin und Drag-out
  funktionieren jetzt zuverlässig (Sandbox-Preload blockierte `webUtils`).
