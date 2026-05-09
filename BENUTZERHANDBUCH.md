# CopyMail – Benutzerhandbuch

CopyMail ist ein kleines Windows-Programm, das Ihnen hilft, **Mail-Inhalte
schnell weiterzuverwenden**. Sie ziehen eine `.msg`- oder `.eml`-Datei in das
Fenster, und CopyMail legt mit einem Klick den formatierten Mail-Inhalt
**zusammen mit der Originaldatei** in die Zwischenablage. Beides können Sie
direkt in Outlook, eM Client, Word, Teams oder andere Programme einfügen.

---

## Inhalt

1. [Was kann CopyMail?](#was-kann-copymail)
2. [Installation](#installation)
3. [Programm starten](#programm-starten)
4. [Das Fenster im Überblick](#das-fenster-im-überblick)
5. [Schnellstart in 3 Klicks](#schnellstart-in-3-klicks)
6. [Mehrere Mails auf einmal](#mehrere-mails-auf-einmal)
7. [Maildatei direkt ziehen](#maildatei-direkt-ziehen)
8. [Tastenkürzel](#tastenkürzel)
9. [Optionen](#optionen)
10. [Häufige Fragen](#häufige-fragen)
11. [Datenschutz und Sicherheit](#datenschutz-und-sicherheit)
12. [Hilfe und Kontakt](#hilfe-und-kontakt)

---

## Was kann CopyMail?

- **Mail-Inhalte einfügen wie in Outlook „Weiterleiten":** Sie kopieren den
  Mail-Text inklusive Header (Von / Gesendet / An / Betreff) im
  Outlook-typischen Format Calibri 12 pt. Beim Einfügen in Word oder eine
  neue E-Mail sieht alles aus wie ein klassisches Forward.
- **Maildatei als Anhang:** Mit einem Klick legen Sie die Original-`.msg`
  oder `-.eml` als Anhang in die Zwischenablage. Beim Einfügen in eine neue
  Mail wird sie automatisch als Anhang angefügt.
- **Mehrere Mails gleichzeitig:** Wählen Sie mehrere Dateien aus oder ziehen
  Sie sie zusammen ins Fenster – alle landen mit einem Klick in der
  Zwischenablage.
- **Drag & Drop direkt aus CopyMail in andere Programme:** Statt zu kopieren
  können Sie die Maildatei auch per Maus aus CopyMail in eine offene Mail
  ziehen.
- **Vorschau ohne Outlook:** CopyMail liest `.msg`-Dateien selbst, Sie
  brauchen Outlook nicht installiert.

CopyMail unterstützt aktuell die Dateitypen **`.msg`** (Outlook) und
**`.eml`** (Standard-Format, z. B. Thunderbird oder Gmail-Export).

---

## Installation

CopyMail wird in zwei Varianten ausgeliefert. Beide brauchen **keine
Administrator-Rechte**.

### Variante A · Portable (empfohlen für die ZIP-Auslieferung)

Sie haben ein ZIP wie `CopyMail-1.2.0.zip` erhalten:

1. ZIP an den gewünschten Ort entpacken (z. B. Desktop, USB-Stick,
   Netzlaufwerk – egal wo).
2. Doppelklick auf **`CopyMail.exe`** im entpackten Ordner.
3. Das war's – das Fenster öffnet sich.

CopyMail schreibt **keine Einträge** in die Registry und legt keine
versteckten Ordner an. Wenn Sie es loswerden wollen, löschen Sie einfach den
Ordner.

### Variante B · Klassische Installation

Wenn Sie eine Verknüpfung im Startmenü und auf dem Desktop möchten,
verwenden Sie den Installer (im Portable-ZIP unter `_Installer/` enthalten):

1. Doppelklick auf den Setup-Installer (Dateiname endet auf `Setup.exe`).
2. Windows fragt eventuell, ob Sie der Quelle vertrauen – bestätigen Sie
   mit **„Ja"**.
3. Das Setup erstellt automatisch eine Verknüpfung auf dem Desktop und im
   Startmenü.

### Deinstallation

- Portable-Variante: Ordner löschen.
- Installer-Variante: *Windows-Einstellungen → Apps → CopyMail v2 →
  Deinstallieren*.

---

## Programm starten

- **Portable**: Doppelklick auf `CopyMail.exe`.
- **Installer**: Desktop-Verknüpfung *CopyMail v2* oder Eintrag im
  Startmenü.

Beim Start öffnet sich ein dunkles, kompaktes Fenster (etwa Briefformat).
Sie sehen sofort den Bereich **„Datei(en) hierher ziehen oder klicken"**.

---

## Das Fenster im Überblick

```
┌─────────────────────────────────────────────────────┐
│ CopyMail                       📌  ─  □   ✕         │  ← eigene Titelleiste
├─────────────────────────────────────────────────────┤
│                                                     │
│              ✉  CopyMail                            │
│        Ziehe eine oder mehrere .msg/.eml-           │
│        Dateien hinein – Text kopieren oder          │
│        Maildateien anhängen.                        │
│                                                     │
│   ┌─────────────────────────────────────────┐      │
│   │                                         │      │
│   │              ⬆                          │      │
│   │     Datei(en) hierher ziehen            │      │
│   │     oder klicken                        │      │
│   │     ┌───────────────────────┐           │      │
│   │     │ .msg · .eml · auch    │           │      │
│   │     │ mehrere               │           │      │
│   │     └───────────────────────┘           │      │
│   └─────────────────────────────────────────┘      │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Titelleiste oben:**

- **📌 Pin** – „Always on Top" ein/aus. Bei aktivem Pin (indigo leuchtend)
  bleibt das Fenster vor anderen Programmen sichtbar.
- **─ Minimieren** – Fenster in die Taskleiste.
- **□ Maximieren / Wiederherstellen** – Vollbild-Modus.
- **✕ Schließen** – Programm beenden.

---

## Schnellstart in 3 Klicks

1. **Mail-Datei reinziehen** – ziehen Sie eine `.msg` oder `.eml` aus
   Outlook, dem Datei-Explorer oder dem Posteingang von eM Client direkt in
   das CopyMail-Fenster. Alternativ klicken Sie in den Drop-Bereich und
   wählen die Datei im Auswahldialog.
2. **Modus wählen** – nach dem Drop sehen Sie die Mail-Vorschau. Wählen Sie
   in der Werkzeugleiste:
   - **Text** – kopiert den formatierten Mail-Inhalt mit Outlook-typischem
     Header.
   - **Datei** – kopiert die Original-Maildatei (zum Anhängen in eine neue
     Mail oder zum Speichern in einem Ordner).
3. **Klick auf „Kopieren"** – das war's. Wechseln Sie zu Outlook / eM
   Client / Word und drücken Sie **Strg + V**.

> 💡 **Tipp:** Sobald Sie eine Mail geladen haben, können Sie statt auf
> „Kopieren" zu klicken auch einfach **Strg + C** drücken. CopyMail merkt,
> wenn Sie keinen Text in der Vorschau markiert haben, und löst dann die
> normale Kopier-Aktion aus.

---

## Mehrere Mails auf einmal

Sie können mehrere Mails zusammen verarbeiten – ideal, um z. B. fünf
Belege als Anhang in eine neue Sammelmail zu legen.

1. Ziehen Sie alle gewünschten `.msg`/`.eml`-Dateien gleichzeitig auf das
   Fenster. Alternativ klicken Sie in den Drop-Bereich und wählen mit
   **Strg + Klick** mehrere Dateien aus.
2. Die Vorschau zeigt Ihnen die **erste** Mail. Direkt darunter steht ein
   Hinweis: *„Vorschau zeigt die erste Mail. N Dateien werden im
   'Dateien'-Modus angehängt."*
3. Der Modus-Schalter zeigt jetzt **„Dateien (N)"** statt nur „Datei".
4. Klick auf „Kopieren" → in Outlook/eM Client einfügen → **alle N Dateien
   hängen als Anhang**.

> ℹ️ Im **Text-Modus** wird bei mehreren Mails nur die **erste** als Text
> kopiert. Wenn Sie alle Mail-Texte zusammen brauchen, kopieren Sie die
> Mails einzeln.

---

## Maildatei direkt ziehen

Wenn Sie die Maildatei in eine bereits offene E-Mail ziehen wollen, ohne
den Umweg über die Zwischenablage:

1. Mail in CopyMail laden (Drop oder Klick).
2. In der Werkzeugleiste sehen Sie links das **kleine Brief-Symbol** mit
   drei Punkten daneben – das ist der **Zieh-Griff**.
3. Klicken Sie diesen Griff und ziehen Sie ihn direkt in das offene
   Mail-Fenster (Outlook, eM Client, Teams, …). Lassen Sie die Maus los –
   die Mail hängt als Anhang.

Bei mehreren Mails wird per Drag & Drop nur die **erste** Mail übergeben.
Für alle Mails verwenden Sie den Modus „Dateien (N)" + Kopieren.

---

## Tastenkürzel

| Taste | Wirkung |
|---|---|
| **Strg + C** | Kopiert nach dem aktuell gewählten Modus (Text oder Datei[en]). Funktioniert nur, wenn keine Text-Stelle in der Vorschau markiert ist. |
| **Strg + V** (im Zielprogramm) | Mail einfügen. |
| **Tab** | Springt zwischen den Bedienelementen. |
| **Enter** oder **Leertaste** (auf dem Drop-Bereich) | Datei-Auswahldialog öffnen. |
| **Esc** im Datei-Dialog | Auswahl abbrechen. |

---

## Optionen

### Always on Top (📌 Pin)

Der Pin-Button oben rechts in der Titelleiste hält das CopyMail-Fenster vor
allen anderen sichtbar. Praktisch, wenn Sie nebenbei in Outlook arbeiten und
CopyMail im Blick behalten möchten.

Klicken Sie ein zweites Mal, um den Pin wieder zu lösen. Der Status wird
**nicht gespeichert** – nach dem Neustart ist Always-on-Top wieder
deaktiviert.

### Neue Datei laden

Der **Pfeil-im-Kreis-Button** rechts neben „Kopieren" leert die aktuelle
Vorschau und bringt Sie zurück zum Drop-Bereich. Die zuletzt geladenen
Dateien selbst werden dabei nicht verändert.

---

## Häufige Fragen

**Welche Mail-Programme können das einfügen?**
Getestet sind: Microsoft Outlook (Desktop und Web), eM Client, Microsoft
Word, Microsoft Teams, der Windows-Datei-Explorer, Notepad. In Outlook,
eM Client und Word funktioniert sowohl der Text-Modus (formatierter Header)
als auch der Datei-Modus (Anhang). Notepad zeigt nur den Text in
einfachem Format.

**Mein Drop funktioniert nicht – was tun?**
- Stellen Sie sicher, dass die Datei eine `.msg` oder `.eml` ist (andere
  Formate werden nicht unterstützt).
- Manche Mail-Programme lassen sich beim Drag & Drop nicht in fremde
  Anwendungen ziehen. Speichern Sie die Mail dann zuerst lokal über
  „Speichern unter" und ziehen Sie diese Datei in CopyMail.

**Beim Einfügen in Outlook erscheint nur die Datei, nicht der Text – warum?**
Outlook entscheidet selbst, was es bei einem Einfügen verwendet. Wenn Sie
**„Datei"** als Modus gewählt haben, ist das gewollt. Wenn Sie nur den Text
brauchen, schalten Sie auf **„Text"** und kopieren Sie erneut.

**Die Vorschau ist ganz schwarz / unleserlich.**
Das sollte nicht mehr passieren – CopyMail zeigt den Mail-Inhalt jetzt auf
hellem Hintergrund. Wenn Sie das doch erleben: melden Sie das gerne mit
einem Beispiel.

**Maximale Dateigröße?**
100 MB pro Mail. Größere Dateien werden mit einer Fehlermeldung abgelehnt.

**Kann ich mehrere Mails zu einem zusammenhängenden Text bündeln?**
Aktuell nicht – im Text-Modus wird bei Mehrfach-Auswahl nur die erste Mail
verwendet. Für mehrere Mail-Texte: einzeln laden und einfügen.

**Funktioniert das auch ohne Outlook auf dem Rechner?**
Ja. CopyMail liest `.msg`-Dateien selbst und braucht kein installiertes
Outlook.

---

## Datenschutz und Sicherheit

CopyMail wurde mit dem klaren Anspruch gebaut: **Ihre Mail-Inhalte
verlassen Ihren Rechner nicht.**

- Es gibt **keine Cloud-Verbindung**, keine Telemetrie, keine
  Update-Server.
- Inhalte aus Mails werden vor der Anzeige **bereinigt**: schädliche
  Skripte, externe Tracking-Pixel und ähnliche Inhalte werden entfernt.
- Tracking-Bilder, die normalerweise Ihre IP-Adresse an den Mail-Sender
  zurückmelden, werden **blockiert**.
- Die Maildateien selbst bleiben dort, wo Sie sie gespeichert haben –
  CopyMail kopiert nichts in Hintergrundordner und legt keine Logs an.
- Beim Einfügen in eine neue Mail entscheiden Sie selbst, was passiert.

Wer technisch interessiert ist: `ARCHITECTURE.md` und `CODE_REVIEW.md`
beschreiben die Sicherheitsmaßnahmen im Detail (Sandboxing, Content
Security Policy, Pfad-Whitelist, HTML-Sanitizer).

---

## Hilfe und Kontakt

Bei Problemen oder Wünschen wenden Sie sich an Ihre interne IT oder die
Person, die Ihnen die Software zur Verfügung gestellt hat.

Wenn Sie ein Problem melden, helfen folgende Angaben:

- Windows-Version (z. B. Windows 11 23H2)
- Welche Mail-Anwendung als Quelle / Ziel (Outlook 365, eM Client …)
- Was Sie gemacht haben – möglichst Schritt für Schritt
- Ob eine Fehlermeldung erschienen ist (am besten als Screenshot)

Viel Erfolg mit CopyMail!
