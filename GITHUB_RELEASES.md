# GitHub-Releases einrichten

Diese Anleitung gilt **konkret für [`deniszensen-cmyk/CopyMail`](https://github.com/deniszensen-cmyk/CopyMail)**. Alle Pfade,
URLs und Defaults sind bereits im Code vorgegeben – du musst nur das
Repo auf GitHub anlegen und dann pushen.

> **Default-Update-URL ist bereits eingebaut:**
> `https://api.github.com/repos/deniszensen-cmyk/CopyMail/releases/latest`
>
> CopyMail liest die URL out-of-the-box. Endnutzer müssen sie nicht
> manuell eintragen – nur überschreiben, wenn sie eine eigene Quelle
> wollen.

---

## Inhalt

1. [Wie der Update-Check funktioniert](#wie-der-update-check-funktioniert)
2. [Einmalige Vorbereitung im Repo](#einmalige-vorbereitung-im-repo)
3. [Release-Workflow: neue Version raushauen](#release-workflow)
4. [Endnutzer einrichten (Update-URL eintragen)](#endnutzer-einrichten)
5. [Was wenn das Repo privat ist?](#privates-repo)
6. [Alternative: eigene `release.json`](#eigene-releasejson)
7. [Häufige Fragen](#häufige-fragen)

---

## Wie der Update-Check funktioniert

CopyMail (ab v1.2) hat einen Update-Check, der so läuft:

1. Beim Start (oder beim Klick auf „Updates → jetzt prüfen", wenn du das
   später ergänzt) ruft der Renderer per `fetch(updateUrl)` ein JSON ab.
2. Das JSON wird zu einem Schema `{ version, url, notes? }` normalisiert.
   GitHub-Releases-API liefert ein anderes Schema, **CopyMail erkennt das
   automatisch** und nimmt das `tag_name`-Feld als Version.
3. Wenn die Version größer ist als die installierte (Semver-Vergleich),
   erscheint oben das Banner „Update verfügbar v1.3.0".
4. Klick auf „Herunterladen" öffnet die Asset-URL im System-Browser.
   CopyMail installiert nichts selbst – der User entpackt das ZIP / startet
   den Setup wie beim ersten Mal.

Das ist absichtlich so primitiv: ohne Code-Signing kann man Auto-Update
nicht sauber bauen, ohne dass Windows SmartScreen den User verschreckt.
Der manuelle Klick ist der saubere Mittelweg.

---

## Einmalige Vorbereitung im Repo

Beides ist im Repo bereits eingerichtet:

- `CopyMail-v2/package.json` zeigt auf `deniszensen-cmyk/CopyMail` (`repository`,
  `homepage`, `bugs`, `build.publish`).
- `.github/workflows/release.yml` ist angelegt und triggert auf Tag-Pushes
  `v*` (siehe unten).
- Default-Update-URL liegt in `src/utils/settings.ts`.

Du musst nur:

1. Auf GitHub das Repo `deniszensen-cmyk/CopyMail` anlegen, falls noch
   nicht geschehen.
2. Lokal pushen (siehe Release-Workflow).
3. Beim ersten Release: in den **Repository Settings → Actions → General**
   sicherstellen, dass „Read and write permissions" für Workflows aktiviert
   ist (sonst kann der Workflow keine Releases anlegen).

Der Workflow für Referenz:

```yaml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    runs-on: windows-latest
    permissions:
      contents: write
    defaults:
      run:
        working-directory: CopyMail-v2

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: CopyMail-v2/package-lock.json

      - name: Install
        run: npm ci

      - name: Lint + Test
        run: |
          npm run lint
          npm test

      - name: Build helper (.NET 4.x csc)
        run: npm run build:helper

      - name: Build Electron (NSIS + portable)
        run: npm run electron:build:win

      - name: Collect artifacts
        shell: pwsh
        run: |
          mkdir ../release
          Copy-Item dist-electron\*.exe ../release/
          Copy-Item ..\BENUTZERHANDBUCH.pdf ../release/
          Copy-Item ..\LIESMICH.txt ../release/

      - name: Publish GitHub Release
        uses: softprops/action-gh-release@v2
        with:
          files: |
            release/*
          draft: false
          prerelease: false
          generate_release_notes: true
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

> Hinweis: Der `build:helper`-Schritt braucht `csc.exe`. `windows-latest`
> bringt das .NET Framework Developer Pack 4.x mit; falls dein Workflow
> da scheitert, ergänze einen Setup-Step für VS-Build-Tools.

### 3) Update-URL in deinem Repo dokumentieren

In der Repo-`README.md` oder einem `INSTALL.md` zwei Zeilen ergänzen:

```
Auto-Update-URL für CopyMail-Einstellungen:
https://api.github.com/repos/deniszensen-cmyk/CopyMail/releases/latest
```

Damit weiß jeder Endnutzer, was er in CopyMail unter „Einstellungen →
Updates" eintragen muss.

---

## Release-Workflow

So gibst du eine neue Version raus:

### Variante A · Mit dem Helper-Skript (empfohlen)

```powershell
# Einmalig: Repo lokal hinzufügen, falls noch nicht geschehen
git remote add origin https://github.com/deniszensen-cmyk/CopyMail.git
git push -u origin main

# Jeder weitere Release:
cd CopyMail-v2
npm run release:patch   # 1.2.0 -> 1.2.1
# oder npm run release:minor / npm run release:major
```

Das Skript `scripts/release.ps1` macht alles in einem Rutsch:
1. Prüft, dass dein Working-Tree sauber ist und dass du auf `main` bist.
2. Bumpt die Version in `CopyMail-v2/package.json` und `package-lock.json`.
3. Committet als „chore(release): vX.Y.Z".
4. Setzt das Tag `vX.Y.Z`.
5. Pusht `main` und das Tag zu GitHub.

GitHub Actions startet dann automatisch den Build (~5 Min) und legt das
Release mit NSIS-EXE, Portable-EXE, ZIP-Paket und PDF an.

### Variante B · Manuell

```powershell
cd CopyMail-v2
npm version patch
cd ..
git push origin main --follow-tags
```

### Variante C · Komplett auf GitHub

Wenn du keine Lust auf lokales Versions-Bumping hast:

1. `CopyMail-v2/package.json` direkt im Web-Editor ändern, neue Version
   committen.
2. Auf der GitHub-Repo-Seite: **Releases → Draft a new release**.
3. Tag-Namen `v1.3.0` (matched `tags: v*` im Workflow), Title
   „CopyMail v1.3.0", Notes bei Bedarf.
4. **Publish release** → Workflow startet automatisch und ergänzt die
   Builds als Assets.

### Tag-Konventionen

- Versions-Tags **immer** mit `v`-Präfix: `v1.2.0`, `v1.2.1`, `v2.0.0`.
  CopyMail strippt das `v` automatisch.
- Pre-Releases (`v1.3.0-rc1`) werden vom Update-Check **erkannt** und
  ggf. als „neuer" angezeigt. Wenn du nur stabile Releases pushen willst,
  setze beim Veröffentlichen den Haken **„Set as a pre-release"** und
  passe später den Update-Endpoint auf
  `…/releases/latest` (zeigt nur Stable) an – das ist der Default.

---

## Endnutzer einrichten

**Standardmäßig bereits konfiguriert** – die Default-URL `https://api.github.com/repos/deniszensen-cmyk/CopyMail/releases/latest`
ist im Code eingebaut und „Update beim Start prüfen" ist standardmäßig
aktiv. Endnutzer brauchen nichts zu tun.

Wenn jemand die URL trotzdem ändern oder Updates abschalten will:

1. CopyMail starten.
2. Oben rechts in der Titelleiste auf das Zahnrad **⚙ Einstellungen**.
3. Tab **„Updates"** → URL anpassen oder „Update beim Start prüfen"
   abhaken.

Settings liegen in `%APPDATA%\CopyMail v2\config.json`. Für Roll-out an
viele Maschinen kannst du diese Datei vorbefüllt verteilen.

---

## Privates Repo

Wenn dein Repo **privat** ist, antwortet die GitHub-API mit `404` und das
JSON ist leer. Drei Optionen:

1. **Repo öffentlich machen.** Sicherste, einfachste Variante. Privat
   bleibt nur der Code – die Releases sind sowieso für die User gedacht.
2. **Persönliches Access-Token + Eigenen Endpoint.** Statt direkt auf
   GitHub-API zu zeigen, schreibt ein kleiner Cloudflare-Worker oder ein
   GitHub-Page-Workflow eine `release.json` zu einem öffentlichen Pfad.
   Siehe nächster Abschnitt.
3. **Eigene `release.json` händisch hochladen.** Auch nächster Abschnitt.

---

## Eigene `release.json`

Wenn du den GitHub-API-Pfad nicht magst, lege eine simple Datei irgendwo
ab, die HTTPS-erreichbar ist:

```json
{
  "version": "1.3.0",
  "url": "https://meinserver.example/CopyMail-1.3.0.zip",
  "notes": "Bugfix-Release: Outlook-Drag, Anhänge-Liste."
}
```

Mögliche Hosts (alle kostenlos):

| Host | Wie | Stabil? |
|---|---|---|
| **GitHub Pages** | Branch `gh-pages`, Datei `release.json` ablegen → URL ist `https://<user>.github.io/<repo>/release.json` | ja |
| **GitHub Raw** | Datei in `main` committen → URL ist `https://raw.githubusercontent.com/<user>/<repo>/main/release.json`. Achtung: CDN cached ~5 min | ja |
| **Eigener Webserver** | Datei mit `Content-Type: application/json` ausliefern | ja, wenn dein Server läuft |

In CopyMail einfach diese URL in „Einstellungen → Updates" eintragen.

### Automatisch befüllen

Im `release.yml`-Workflow zusätzlich einen Step, der nach dem Build
deine `release.json` aktualisiert:

```yaml
- name: Update release.json
  shell: pwsh
  run: |
    $version = "${{ github.ref_name }}".TrimStart('v')
    $portable = (Get-ChildItem CopyMail-v2/dist-electron/*portable*.exe | Select-Object -First 1).Name
    $url = "https://github.com/${{ github.repository }}/releases/download/${{ github.ref_name }}/$portable"
    $json = @{
      version = $version
      url     = $url
      notes   = "${{ github.event.head_commit.message }}"
    } | ConvertTo-Json
    $json | Out-File -Encoding utf8 release.json

- name: Commit release.json to gh-pages
  uses: peaceiris/actions-gh-pages@v3
  with:
    github_token: ${{ secrets.GITHUB_TOKEN }}
    publish_dir: ./release.json-folder
    keep_files: true
```

(Der zweite Step braucht etwas Anpassung an deine gh-pages-Struktur.)

---

## Häufige Fragen

**Brauche ich electron-updater?**
Nein. CopyMail benutzt keinen Auto-Installer; der manuelle Klick auf das
Banner reicht. Wenn du später echtes Auto-Update willst, kommst du um
Code-Signing nicht herum (siehe `ROADMAP.md` Punkt B1).

**Was passiert bei Major-Versions-Sprung (1.x → 2.0.0)?**
CopyMail vergleicht per Semver, also größer = neuer. Banner wird gezeigt.
Inhaltliche Migration (z. B. Settings-Migration) musst du selbst lösen.

**Wie merken meine Nutzer, dass es ein Update gibt, wenn sie CopyMail
nicht starten?**
Gar nicht – CopyMail ist eine Desktop-App ohne Push-Channel. Nutzer
müssen die App starten, dann sehen sie das Banner.

**Was, wenn die Update-URL down ist?**
Banner erscheint nicht. Im Cache liegt die letzte Antwort 6 Stunden.
Logs in `%APPDATA%\CopyMail v2\logs\main.log` enthalten den HTTP-Fehler.

**Wie unterbreche ich Updates für eine bestimmte Version?**
Lass das Release als „Pre-release" markiert oder lösche es. Der Endpoint
`releases/latest` zeigt nur Stable-Releases.

**Warum sehe ich beim ersten Start „SmartScreen hat den PC geschützt"?**
Weil die EXE nicht code-signiert ist. Klick auf „Weitere Informationen"
→ „Trotzdem ausführen". Tritt nur einmal pro Build auf. Der einzige
saubere Workaround ist Code-Signing (siehe `ROADMAP.md` B1).
