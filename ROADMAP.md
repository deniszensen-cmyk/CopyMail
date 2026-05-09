# Roadmap & Verbesserungsvorschläge – CopyMail v2

Stand: nach v1.2.0 (DOMPurify, Sandbox, Custom-Titlebar, Multi-File, Helper
Self-Test, Portable-Build).

Drei Spuren: **Code-Qualität**, **Deployment/Betrieb**, **Funktionen**.
Zusätzlich am Ende: **„Text + Maildatei gleichzeitig einfügen" – Realitätscheck**.

---

## Code-Qualität

### A1 · MsgParser-Robustheit
- Echte `.msg`-Fixtures unter `src/utils/__fixtures__/` ablegen (anonymisiert
  – Dummy-Sender, Dummy-Subject, Lorem-Body, mit/ohne Anhang, mit/ohne
  HTML-Body, ein Eintrag mit STRING8 + non-default-Codepage, einer mit
  UTF-16-Subject-Sonderzeichen). Den `it.todo` in `MsgParser.test.ts` durch
  parametrisierte Round-Trip-Tests ersetzen.
- Property-Stream-Header bei *Sub-Storages* ist 24 statt 32 Bytes – aktuell
  wird nur der Root-Stream gelesen, das funktioniert. Sobald Recipient- /
  Attachment-Substreams geparst werden, muss die Header-Größe pro Stream
  unterschieden werden.
- **Anhänge auflisten und exponieren**: `__attach_version1.0_#XXXXXXXX`
  enthält pro Anhang Display-Name + Pfad + Daten. Darüber könnte CopyMail
  z. B. „Mail enthält 2 Anhänge: report.pdf, screenshot.png" anzeigen oder
  Anhänge separat extrahieren.
- Embedded `.msg`-Anhänge (verschachtelte Mails) erkennen.

### A2 · TypeScript-Strenge
`tsconfig.app.json` läuft ohne `strict: true`. Erhöhen auf `strict` plus
`noUncheckedIndexedAccess` würde mehrere `as`-Casts in `MsgParser.ts`
sichtbar machen. Schmerzhaft, aber zahlt sich aus.

### A3 · Sanitizer enger ziehen
Aktuell: DOMPurify mit `FORBID_TAGS` und `ALLOWED_URI_REGEXP`. Mögliche
Verbesserungen:
- `<style>`-Inhalte aktuell durchgelassen (sieht in der Vorschau besser
  aus). Risiko: CSS kann via `background-image: url(http://tracker)` HTTP
  triggern. Mit `RETURN_DOM_FRAGMENT: false` und striktem `style`-Filter
  prüfen.
- **CID-Resolver**: Mails mit `cid:`-Bildern referenzieren Inline-Anhänge,
  die CopyMail nicht extrahiert → Bild zeigt „🖼" Icon. Ein Resolver, der
  Inline-Anhänge auf `data:`-URLs umrechnet, würde Logos korrekt darstellen.
- Pre-Sanitize-Hook: konvertiert `<o:p>`-Outlook-Schmu nach `<p>`,
  entfernt `<v:>`-VML-Reste.

### A4 · Renderer-Architektur
- `App.tsx` ist mit ~470 Zeilen am oberen Limit für eine Single-File-Komponente.
  Auftrennen in:
  - `Titlebar.tsx`
  - `Dropzone.tsx`
  - `MailToolbar.tsx`
  - `MailMeta.tsx`
  - `MailPreview.tsx`
  - `useEmails.ts` (State-Hook)
  - `useReducedMotionWrapper.tsx`
- `useReducedMotion()` liefert `null` beim ersten Render – führt zu
  Mini-Hydration-Glitch. Mit `useReducedMotion() ?? false` und
  `useState`-Wrap für Stable-Initial.

### A5 · IPC-Typsicherheit
Aktuell: `preload.cjs` ist JS, Typen leben in `electron.d.ts`. Bei größerem
Wachstum:
- Preload als TypeScript (`preload.ts`, gebaut mit Vite-Electron-Plugin oder
  eigener Build-Pipeline).
- IPC-Channel-Namen als Konstanten teilen (`shared/ipc-channels.ts`).
- IPC-Payloads via `zod`-Schema validieren – auf Main-Seite **vor** der
  Whitelist-Logik.

### A6 · Logging und Telemetrie (lokal)
Heute: kein Logging. Für Bug-Reports schwierig. Vorschlag:
- `electron-log` mit Datei in `%LOCALAPPDATA%\CopyMail\logs\`.
- Log-Level über Env-Variable steuerbar (default `warn`).
- Im Helper: nur stderr, kein extra File.
- In der UI ein „Log öffnen"-Button im (versteckten) Debug-Menü
  (Ctrl+Shift+D).

### A7 · Tests-Coverage messen
`vitest --coverage` (V8-Coverage-Provider) einbauen. Schwellen:
EmailProcessor + escHtml ≥ 90 %, MsgParser ≥ 50 % (mehr nur mit Fixtures
realistisch).

### A8 · Dependency-Hygiene
- `npm audit` in CI verankern (heute nicht).
- Renovate Bot einrichten (ein PR pro Major-Update).
- Lockfile-Maintenance (1× pro Monat). Aktuell sind teilweise sehr neue
  Versionen drin (TypeScript ~6.0.2, ESLint ^10.x, Vite ^8) – CI-Lauf
  einmal pro Woche stellt sicher, dass Upstream-Bewegungen früh sichtbar
  sind.

---

## Deployment / Betrieb

### B1 · Code Signing
**Wichtigster offener Punkt für Endnutzer-Auslieferung.** Ohne Signatur:
- SmartScreen blockt die EXE beim ersten Start („Windows hat den PC
  geschützt").
- IT-Admins lehnen ungezeichnete Binaries oft per Policy ab.
- Edge/Defender markiert Downloads als verdächtig.

**Optionen:**
- **Sectigo / DigiCert „Standard Code Signing"**: ~$80–$200/Jahr. Erfordert
  Tokens (HSM-Pflicht ab Juni 2023). Reputation baut sich erst auf.
- **EV (Extended Validation) Code Signing**: ~$300/Jahr. SmartScreen
  vertraut sofort. Aufwändiger Validierungsprozess.
- **Azure Trusted Signing**: $9.99/Monat, fertig managed. Empfohlen für
  Microsoft-Ökosystem-Nähe.

`electron-builder` integriert `signtool` direkt. Ein paar Zeilen in
`package.json` reichen, sobald das Zertifikat da ist.

### B2 · Auto-Update
`electron-updater` mit GitHub-Releases als Update-Quelle:
```js
const { autoUpdater } = require('electron-updater');
autoUpdater.checkForUpdatesAndNotify();
```
Voraussetzung: signierte Builds (siehe B1) und ein Release-Workflow. Für die
ZIP-Portable-Version macht Auto-Update keinen Sinn – User entpackt manuell
neu.

### B3 · Reproducible Builds
Aktuell: `npm install` erzeugt unterschiedliche Lock-Inhalte je nach Reg-
istry-State. Empfohlen:
- `npm ci` in CI (macht's schon) **und** in der Build-Pipeline.
- Lockfile mitcommitten (ist drin).
- Optional: PNPM mit `frozen-lockfile` – schneller, deterministischer als npm.

### B4 · Release-Pipeline auf GitHub Actions
Heute: `ci.yml` macht nur Lint/Test/Build. Erweitern um:
- Trigger auf `git tag v*`.
- Builds für `nsis` + `portable` auf `windows-latest`.
- Signing mit dem in B1 gewählten Cert (Secrets).
- C#-Helper in der Pipeline bauen (.NET Framework Developer Pack als Setup-
  Step oder via `dotnet build` mit SDK-Style-Project, siehe A1 unten).
- `package-portable.ps1` ausführen.
- Release auf GitHub mit dem ZIP + den beiden EXEs als Assets.

### B5 · C#-Helper auf SDK-Style + dotnet build
Aktuell: csc.exe direkt. Vorteile von SDK-Style:
- `dotnet build` funktioniert ohne separates Developer-Pack.
- NuGet-Packages werden möglich (z. B. `System.Text.Json` statt
  `JavaScriptSerializer`).
- Bessere CI-Story.
- Test-Project (xUnit) als zweites csproj möglich.

Migration:
```xml
<Project Sdk="Microsoft.NET.Sdk.WindowsDesktop">
  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>net48</TargetFramework>
    <UseWindowsForms>true</UseWindowsForms>
    <Nullable>enable</Nullable>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="System.Text.Json" Version="8.0.5" />
  </ItemGroup>
</Project>
```

### B6 · MSI-Paket statt NSIS
Für Unternehmens-Auslieferung über SCCM/Intune ist MSI Standard. `electron-
builder` kann mit `target: 'msi'` direkt MSI erzeugen.

### B7 · Group-Policy-fähige Konfiguration
Optional für Enterprise: ADMX-Template, das Default-Werte für Always-on-Top
und Pfad-Whitelisten setzt. Erst sinnvoll, wenn die App in 50+ Installa-
tionen läuft.

### B8 · Crash-Reports lokal
Electron hat einen eingebauten Crash-Reporter. Default off, kann aktiviert
werden, schreibt Minidumps nach `userData/crashpad/`. Für Bug-Reports
hilfreich. Endpoint nicht setzen (sonst geht's übers Netz – würde dem
Datenschutz-Versprechen widersprechen).

### B9 · Telemetrie-Frei-Bestätigung
Dem README einen kleinen „Telemetrie: keine"-Abschnitt hinzufügen, am
besten mit einem Hash der Build-Artefakte, gegen den Misstrauische selber
prüfen können (`Get-FileHash`). Vor allem Compliance-Officer mögen das.

---

## Funktionen

### C1 · Vorschau-Verbesserungen
- **CID-Resolver für Inline-Bilder** (siehe A3).
- **Bild- und Tabellen-Skalierung**: aktuell `max-width: 100%` – funktioniert,
  aber breite Tabellen werden gequetscht. Eventuell horizontaler Scroll.
- **Dark-Mode-Switch in der Vorschau**: hellem `--mail-body-bg` ist gut für
  HTML-Mails, aber Plain-Text-Body wirkt auf Hell zu hart. Toggle „heller/
  dunkler Body" oder automatisch nach Mail-Inhalt entscheiden.
- **Suche in der Mail** (Strg+F) im Vorschau-Body.

### C2 · Mail-Liste statt nur Vorschau-erste-Mail
Bei Multi-File-Drop sieht man aktuell nur die erste Mail. Vorschlag: Tabs
oder eine kleine Liste links mit Sender/Betreff, Klick wechselt die
Vorschau. Beim Kopieren werden weiterhin alle Dateien angehängt.

### C3 · Anhang-Liste sichtbar machen
„Diese Mail enthält 2 Anhänge: report.pdf (1.2 MB), foto.jpg (340 KB)."
Klein unter der Mail-Meta. Optional Button „Anhänge separat extrahieren"
(öffnet Datei-Dialog für Speicherpfad).

### C4 · Drag-out für mehrere Dateien
Electron `startDrag` kann nur eine Datei. Workaround: ein temporärer Ordner
mit den Dateien drin und Ordner-Drag. Oder via Custom Native Modul. Realis-
tisch eher: deutlicher Hinweis behalten und „Datei (N)" + Copy als primären
Multi-Workflow vermarkten.

### C5 · Konfiguration / Settings-Panel
Aktuell hardcoded:
- Dateigrößen-Limit (100 MB).
- Default-Copy-Modus (Text).
- Sprache (Deutsch).

Settings-Panel mit Persistenz in `userData/config.json`:
- Sprache wechseln (Deutsch/Englisch).
- Default-Modus.
- Dateigrößen-Limit.
- HTML-Body in Vorschau hell/dunkel.
- Externe Bilder anzeigen ja/nein (heute hart blockiert via CSP – wenn
  Setting an, dann CSP entsprechend lockern in der Vorschau).
- Theme (Glas-Dark / Solid-Light).

### C6 · Mehrsprachigkeit (i18n)
`react-i18next` mit Locales `de` (default) und `en`. Texte gibt's nicht
viele – einmaliger Initial-Aufwand ~½ Tag.

### C7 · Drag-Source aus Outlook direkt
Outlook erlaubt Drag-Out einer ausgewählten Mail in andere Apps. CopyMail
empfängt das aktuell als Datei mit `.msg`-Endung – das funktioniert. Aber:
manche Mailclients (Thunderbird) liefern beim Drag andere MIME-Daten. Test
und ggf. Erweiterung.

### C8 · Tastatur-Workflow optimieren
- Esc → Reset (zurück zur Drop-Zone).
- F2 → Mail-Fenster fokussieren.
- Ctrl+M → Modus wechseln (Text ↔ Datei).
- Ctrl+P → Pin-Toggle.
- Sichtbares Tastatur-Hilfefenster (?-Button in der Titelleiste).

### C9 · Quick-Actions-Menü
Rechtsklick auf das App-Icon im System-Tray:
- „Letzte Mail erneut kopieren"
- „Zwischenablage leeren"
- „Beenden"

Verlangt System-Tray-Icon, was nicht trivial ist mit `frame: false`. Eher
Phase 2.

### C10 · Globaler Hotkey
Globaler Hotkey (z. B. Ctrl+Alt+M), der CopyMail in den Vordergrund holt
und die aktuelle Datei aus dem Clipboard (falls eine .msg/.eml im Clip-
board ist) lädt. Ist über `globalShortcut`-API in Electron leicht.

### C11 · Vorlagen für Forwarded-Header
Manche Firmen haben eigene Forward-Templates. Statt hartem
„Von / Gesendet / An / Betreff" eine Template-Datei in `userData` ladbar.

---

## Text + Maildatei gleichzeitig einfügen

**Kurze Antwort: Mit *einem* Strg+V auf das Ziel zuverlässig in mehreren
Apps einzufügen geht nicht – die Standard-Windows-Zwischenablage erlaubt
das nicht, weil das Ziel-Programm pro Paste *ein* Format auswählt.**

Hier die ehrliche Lage und vier konkrete Optionen.

### Warum es nicht „einfach so" geht

Die Zwischenablage hält pro Format eine Daten-Variante (UnicodeText, HTML
Format, FileDrop, …). Beim Paste fragt das Ziel-Programm: „welches Format
verstehe ich, das ich akzeptieren mag?" Outlook & Co. priorisieren in ihrer
Mail-Body-Region:

| Format | Outlook | Word | eM Client | Notepad |
|---|---|---|---|---|
| FileDrop | **Anhang** | Datei-Symbol als Inline-Objekt | **Anhang** | Pfad-Text |
| HTML Format | Body-Text | Body-Text | Body-Text | – |
| UnicodeText | Body-Text | Body-Text | Body-Text | Body-Text |

Wenn FileDrop **und** HTML/Text gleichzeitig im Clipboard sind, gewinnt in
Outlook/eM Client immer FileDrop. Word zeigt einen Paste-Options-Knopf, der
beides anbietet, aber das ist Word-spezifisch.

Genau aus diesem Grund war der „Beides"-Modus aus v1 entfernt worden.

### Option 1: Zwei Pastes hintereinander

Workflow: Text-Modus + Strg+V einmal → Datei-Modus aktivieren + Strg+V ein
zweites Mal. Funktioniert in jedem Client. Ist halt zwei Klicks/Pastes.

**Implementierung**: bereits jetzt möglich, kein Code-Change nötig –
einfach der Workflow, den der User selbst macht.

**Pros**: 100 % zuverlässig, in jeder App.
**Cons**: zwei Aktionen statt einer.

### Option 2: „Auto-Sequenz" – CopyMail wechselt das Clipboard nach Strg+V

Idee: User klickt „Beides", CopyMail schreibt zuerst Text, registriert den
nächsten globalen Strg+V (oder einen Timer von z. B. 1.5 s) und wechselt
dann das Clipboard auf FileDrop. Beim zweiten Strg+V kommt die Datei.

**Pros**: ein Klick im CopyMail.
**Cons**: brüchig (User merkt nicht, *wann* gewechselt wurde; erstes
Strg+V kann auch in einer falschen App landen). UX-Risiko hoch.

### Option 3: Outlook-Direkt-Modus (COM-Automation)

Wenn das Ziel **Outlook ist und Outlook installiert**, kann der C#-Helper
via COM Outlook direkt steuern: „Erzeuge eine neue Mail, setze HTMLBody, leg
die `.msg` als Anhang an, zeige sie." Der User landet in einer fertig
befüllten Outlook-Mail.

**Pseudo-Code:**
```cs
var t = Type.GetTypeFromProgID("Outlook.Application");
dynamic ol = Activator.CreateInstance(t);
dynamic mail = ol.CreateItem(0); // olMailItem
mail.HTMLBody = htmlBody;
foreach (var path in filePaths) mail.Attachments.Add(path);
mail.Display(false); // false = nicht modal
```

**Pros**: ein Klick, perfekte Integration in Outlook (User kann editieren,
versenden).
**Cons**: nur Outlook (eM Client, Word, Teams nicht). Outlook muss
installiert sein. COM-Aufrufe sind Win32-spezifisch.

**Empfehlung**: als zusätzlichen Modus „Neue Mail in Outlook" anbieten,
nicht als Ersatz für „Text"/„Datei". User wählt explizit. Erkennung „ist
Outlook installiert" via Registry-Key `HKCR\Outlook.Application`.

### Option 4: eM Client / andere Mailclients via mailto-Link mit Anhang

`mailto:?body=...&subject=...` ist Standard, aber `&attachment=` ist *nicht*
Standard und wird von Sicherheits-Patches in Outlook 2024+ ignoriert
(Sicherheitsbedenken). eM Client unterstützt es teilweise. Unzuverlässig.

**Pros**: theoretisch app-unabhängig.
**Cons**: praktisch instabil, von Sicherheits-Updates kaputtgemacht.

### Empfehlung

**Default-Modi unverändert lassen** (Text / Datei / Drag-out), aber
**„Neue Outlook-Mail" als optionalen vierten Modus** ergänzen, der nur
sichtbar wird, wenn Outlook installiert ist.

UI-Skizze:

```
[ Text ] [ Datei ] [ Dateien (3) ] [ ✉ → Outlook ]
```

Klick auf den vierten Button → CopyMail ruft den Helper mit `--outlook
"<json>"` → Helper öffnet eine fertige Outlook-Mail mit HTML-Body und
allen Anhängen. User editiert/sendet wie gewohnt.

Aufwand: ~2 Tage.
- C#-Helper: COM-Wrapper + neuer Modus.
- App.tsx: vierter Toggle-Button + Detection.
- main.cjs: IPC-Endpoint, Helper-Aufruf.
- TEST_PLAN.md: Sektion „Outlook-Direkt".

Falls das gewünscht ist – sag Bescheid, dann setze ich es um.

---

## Priorisierungs-Vorschlag (mein Bauchgefühl)

| Priorität | Punkt | Warum |
|---|---|---|
| 🔴 hoch | **B1 Code Signing** | Blocker für Endnutzer-Akzeptanz. |
| 🔴 hoch | **C5 Settings-Panel (zumindest Sprache + Default-Modus)** | Häufigste „kannst du noch …"-Anfragen. |
| 🟡 mittel | **„Outlook-Direkt"-Modus (Option 3 oben)** | Killer-Feature für Outlook-Power-User. |
| 🟡 mittel | **B4 Release-Pipeline GHA** | Macht Releases reproduzierbar und schneller. |
| 🟡 mittel | **A1 .msg-Fixtures + Round-Trip-Tests** | Verhindert MSG-Parser-Regressionen. |
| 🟢 niedrig | **C2 Mail-Liste bei Multi-Drop** | Nice-to-have, nicht häufig nachgefragt. |
| 🟢 niedrig | **A4 Renderer-Architektur** | Refactoring-Aufwand ohne unmittelbaren Nutzwert. |
| 🟢 niedrig | **C9 System-Tray, C10 Globaler Hotkey** | Kosmetik. |
