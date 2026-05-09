# Smoke-Test-Plan – CopyMail v2

Manuelle Test-Checkliste für Windows. Automatisierte Tests
(`npm test`) decken Parser-Logik und Sanitizer ab; **dieser Plan deckt das
ab, was nur in einer echten Electron-Umgebung mit echtem Outlook/Word/Teams
prüfbar ist**.

## Voraussetzungen

```powershell
cd CopyMail-v2
npm install
npm run build:helper       # baut den C#-Helper inkl. --self-test
npm run electron:dev       # Vite + Electron parallel starten
```

Bereithalten:

- 1 echte `.msg`-Mail aus Outlook (HTML-Body, mit Anhang)
- 1 echte `.eml`-Mail (z. B. Export aus Thunderbird oder Gmail-Original)
- 1 zusätzliche `.msg`-Mail mit Umlauten im Betreff
- Outlook (oder Outlook Web), Word, Teams und **eM Client** als Drop-/Paste-Ziele
- Optional: eine bösartige Test-Mail mit `<script>alert(1)</script>` im HTML-Body
  (zur Verifikation des DOMPurify-Sanitizers)

---

## A · Custom Titlebar

| # | Schritt | Erwartet |
|---|---|---|
| A1 | App starten | Eigene Titelleiste mit „CopyMail"-Schriftzug links und Pin/Min/Max/Close-Buttons rechts. Kein nativer OS-Rahmen. |
| A2 | Drag-Region nutzen | Linke Hälfte der Titelleiste lässt sich ziehen, das Fenster folgt. |
| A3 | Minimize-Button (`Minus`) | Fenster minimiert sich in die Taskleiste. |
| A4 | Maximize-Button (`Square`) | Fenster maximiert. Icon wechselt zu „zwei verschachtelte Quadrate" (`CopySquare`). |
| A5 | Restore | Fenster geht zurück, Icon wechselt zurück zu `Square`. |
| A6 | Close-Button (`X`) | Hover färbt rot (#e81123 / weiß). Klick schließt die App. |
| A7 | Pin-Button | Klick → Button leuchtet indigo, Fenster bleibt im Vordergrund (Test mit anderer App). Klick erneut → Pin deaktiv. |

---

## B · Drop / Datei-Auswahl (Single)

| # | Schritt | Erwartet |
|---|---|---|
| B1 | `.msg`-Datei in die Drop-Zone droppen | Loader spinnt kurz, Vorschau erscheint mit Von/Datum/An/Betreff + Body. |
| B2 | Drop-Zone klicken, Datei im Picker auswählen | Selber Effekt. |
| B3 | Drop einer **nicht unterstützten** Datei (z. B. `.txt`) | Fehlerbanner: „Übersprungen: foo.txt: nicht unterstütztes Format". Vorschau bleibt leer / unverändert. |
| B4 | Tastatur-Test: Tab auf die Drop-Zone, Enter | Datei-Picker öffnet. |
| B5 | Tastatur-Test: Tab auf die Drop-Zone, Space | Datei-Picker öffnet (wichtig: war früher nicht abgefangen). |
| B6 | `.eml`-Datei droppen | Vorschau funktioniert genauso wie für `.msg`. |
| B7 | `.msg`-Datei mit Umlauten droppen | Betreff/Sender/Body zeigen Umlaute korrekt (UTF-16-Pfad bzw. STRING8 mit codepage). |

---

## C · Multi-File-Drop

| # | Schritt | Erwartet |
|---|---|---|
| C1 | 3 `.msg`-Dateien gemeinsam droppen | Vorschau zeigt die **erste** Mail; oberhalb steht das Info-Banner „Vorschau zeigt die erste Mail. 3 Dateien werden im 'Dateien'-Modus angehängt." Drag-Handle zeigt `+2`-Counter. |
| C2 | Mode-Toggle „Datei" | Beschriftung wechselt auf `Dateien (3)`. |
| C3 | Im Datei-Picker mehrere Dateien per `Ctrl+Klick` auswählen | Selber Effekt. |
| C4 | Eine unterstützte + eine `.txt` zusammen droppen | Vorschau für die `.msg`/`.eml`; Fehlerbanner listet die übersprungenen Dateien. |

---

## D · Vorschau / Sanitizer

| # | Schritt | Erwartet |
|---|---|---|
| D1 | HTML-Mail mit dunklen Inline-Styles in der Vorschau | Mail-Body steht auf hellem Hintergrund (`#f7f8fb`), Inline-Schwarz bleibt lesbar. |
| D2 | Plain-Text-Mail | Body wird in `<pre>`-ähnlichem Layout angezeigt (`white-space: pre-wrap`), Zeilenumbrüche bleiben. |
| D3 | **Sicherheits-Test**: Mail mit `<script>alert(1)</script>` | Kein Alert. Im DevTools-DOM-Inspector ist kein `<script>`-Tag im Mail-Body zu finden. |
| D4 | Mail mit `<img src="https://evil.example/track.gif">` | Bild lädt **nicht** (CSP `img-src 'self' data: blob: cid:`). DevTools-Network-Tab zeigt blockierte Anfrage. |
| D5 | Mail mit `<a href="javascript:alert(1)">x</a>` | Klick auf Link tut nichts (DOMPurify hat das Schema rausgefiltert). |
| D6 | Mail mit Inline-Bild via `cid:` | Bild wird in der Vorschau angezeigt (sofern das passende Inline-Attachment in der Mail enthalten ist). |

---

## E · Copy in andere Apps

| # | Schritt | Erwartet |
|---|---|---|
| E1 | Mode „Text", Klick „Kopieren", in Outlook E-Mail einfügen | Forward-Header (`Von:` / `Gesendet:` / `An:` / `Betreff:`) + sanitisierter HTML-Body, Schrift Calibri 12pt. |
| E2 | Selbe Inhalte in Word einfügen | Identisches Ergebnis (Calibri 12pt, Header-Trennlinie sichtbar). |
| E3 | Selbe Inhalte in Notepad einfügen | Plain-Text-Variante (kein HTML), Header korrekt. |
| E4 | **eM Client**: Mode „Text", in eine neue Mail einfügen | Forward-Header + HTML-Body. eM Client interpretiert das HTML-Clipboard-Format genauso wie Outlook. |
| E5 | Mode „Datei", Klick „Kopieren", in Outlook ins Mail-Body-Feld einfügen | `.msg`-Datei hängt als Attachment. |
| E6 | **eM Client**: Mode „Datei", in eine neue Mail einfügen | `.msg` hängt als Attachment (FileDrop-Format). |
| E7 | Mode „Dateien (3)", Klick „Kopieren", in Outlook einfügen | Alle 3 Dateien hängen als Attachments. |
| E8 | Mode „Dateien (3)", in eM Client einfügen | Alle 3 Dateien hängen als Attachments. |
| E9 | Mode „Dateien (3)", Klick „Kopieren", in Windows-Explorer in einen Ordner einfügen | Alle 3 Dateien werden in den Ordner kopiert. |
| E10 | Mode „Datei" wenn Browser-Modus / kein Pfad | Button ist disabled (grauer Stil), Tooltip erklärt warum. |

---

## F · Drag-out

| # | Schritt | Erwartet |
|---|---|---|
| F1 | Drag-Handle (Mail-Icon mit Grip-Punkten) in Outlook-Mail-Body ziehen | `.msg`-Datei hängt als Attachment. Cursor wechselt zu `grabbing`. |
| F2 | Drag-Handle in eM Client ziehen | `.msg`-Datei hängt als Attachment. |
| F3 | Drag-Handle in Teams-Chat ziehen | Datei wird angefügt. |
| F4 | Drag-Handle bei mehreren Dateien | Nur die **erste** Datei wird gedraggt (Electron-Limitierung). Tooltip sagt das. Für alle Dateien: Mode „Dateien (N)" + Copy verwenden. |

---

## G · Shortcuts & UX

| # | Schritt | Erwartet |
|---|---|---|
| G1 | Vorschau steht, kein Text selektiert, `Ctrl+C` | Kopieraktion läuft (Toast „Inhalt in Zwischenablage kopiert!"). |
| G2 | Vorschau steht, Text in der Vorschau selektiert, `Ctrl+C` | Native Copy gewinnt: nur die Selection landet in der Zwischenablage. |
| G3 | Vorschau steht, Fokus in Drop-Zone (Picker offen), `Ctrl+C` | Kein Trigger (Eingabefeld-Fokus). |
| G4 | Hover über Copy-Button | Tooltip „In die Zwischenablage kopieren (Ctrl+C)". |
| G5 | Pulse-Animation am Copy-Button | Läuft nach neuer Datei zweimal, dann Ruhe. |
| G6 | OS-Setting „Animationen reduzieren" aktivieren | Pulse, Spin, Slide-Animationen sind aus oder minimal. |
| G7 | Tab-Reihenfolge | Sinnvolle Reihenfolge durch Drop-Zone / Toolbar / Buttons. Focus-Indicator (Indigo-Ring) gut sichtbar. |
| G8 | Reset-Button (`RotateCcw`) | Vorschau leer, Drop-Zone wieder sichtbar; Hover ist neutral (kein Danger-Rot). |

---

## H · Always-on-Top

| # | Schritt | Erwartet |
|---|---|---|
| H1 | Pin aktivieren | Button leuchtet indigo. |
| H2 | Anderes Fenster fokussieren | CopyMail bleibt sichtbar im Vordergrund. |
| H3 | Pin deaktivieren | CopyMail verhält sich wie ein normales Fenster. |
| H4 | App neu starten | Pin-State ist nicht persistent (intentional – jeder Start neutral). |

---

## I · Browser-Modus (Vite-Dev-Server direkt im Browser, ohne Electron)

| # | Schritt | Erwartet |
|---|---|---|
| I1 | http://localhost:5180 im Browser öffnen | Header zeigt „BROWSER-MODUS"-Pill statt Pin-Button. Custom Titlebar fehlt (nur Browser-Tab). |
| I2 | `.eml` droppen | Vorschau funktioniert. |
| I3 | Mode „Datei" | Button ist disabled. |
| I4 | Klick „Kopieren" im Text-Mode | Browser-Clipboard schreibt Text+HTML (`navigator.clipboard.write`). |

---

## J · Helper Self-Test

| # | Schritt | Erwartet |
|---|---|---|
| J1 | `npm run build:helper` | Build endet mit „Self-test passed." und Exit 0. |
| J2 | Direkt: `native\ClipboardHelper\publish\CopyMailClipboard.exe --self-test` | 4 OKs, kein FAIL, Exit 0. |

---

## K · Sicherheit (manuell, optional)

| # | Schritt | Erwartet |
|---|---|---|
| K1 | DevTools öffnen (DevTools sind in dev mode optional verfügbar — siehe `electron/main.cjs`) und in der Konsole `window.electronAPI.startDrag('C:\\Windows\\System32\\drivers\\etc\\hosts')` aufrufen | **Kein Drag-Effekt**. Im Main-Log steht nichts. Whitelist greift, weil der Pfad nicht via `registerFile` registriert wurde. |
| K2 | `window.electronAPI.copyToClipboard({ filePaths: ['C:\\Windows\\System32\\drivers\\etc\\hosts'] })` | Result `{ success: false, message: 'Dateipfade sind nicht freigegeben.' }`. |
| K3 | DevTools → Network: jede Mail-Vorschau prüfen | Keine ausgehenden Requests an externe Hosts (CSP `connect-src 'self'`). |
| K4 | Mail mit `<form action="https://evil">` | Form ist in DOMPurify rausgefiltert. |

---

## Bekannte Limitierungen

- Drag-out unterstützt nur eine Datei (Electron `startDrag`).
- v1 unter `legacy/v1/` wird nicht mehr getestet.
- HTML-Mails mit komplexen CSS-Layouts können in der Vorschau anders aussehen
  als nach dem Einfügen in Outlook (Outlook normalisiert eigenes CSS).
- Helper-Build benötigt entweder .NET Framework Developer Pack 4.x oder
  VS 2022 Roslyn auf dem Build-Rechner.

---

## Wenn etwas durchfällt

1. Befund in einem GitHub-Issue dokumentieren mit Schritt-Nummer (z. B. „D3").
2. Falls Sicherheits-Sektion (K) durchfällt → Release blocken.
3. Falls Helper-Self-Test (J) durchfällt → C#-Code prüfen, Outlook könnte
   HTML-Format trotzdem akzeptieren, aber Word ist strenger – nicht in
   Produktion releasen.
