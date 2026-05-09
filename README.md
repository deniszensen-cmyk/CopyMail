# CopyMail

Windows-Desktop-Tool zum Einlesen von `.msg`/`.eml`-Dateien und Kopieren von
formatiertem Mailinhalt + Originaldatei in die Zwischenablage.

Repo: <https://github.com/deniszensen-cmyk/CopyMail>
Releases: <https://github.com/deniszensen-cmyk/CopyMail/releases>
Update-Endpoint: <https://api.github.com/repos/deniszensen-cmyk/CopyMail/releases/latest>

> **Aktive Version:** [`CopyMail-v2/`](./CopyMail-v2/README.md).
>
> Die ursprüngliche v1 liegt in [`legacy/v1/`](./legacy/v1/) und wird nicht
> mehr gepflegt – siehe [LEGACY.md](./LEGACY.md).

## Schnellstart

```powershell
cd CopyMail-v2
npm install
npm run build:helper
npm run electron:dev
```

Details, Architektur und Sicherheits-Hinweise: siehe `CopyMail-v2/README.md`.

## CI

GitHub Actions Workflow unter `.github/workflows/ci.yml` baut und testet
`CopyMail-v2/` bei jedem Push/PR auf `main`.

## Code-Review & Design

- [CODE_REVIEW.md](./CODE_REVIEW.md) – Sicherheits- und Code-Review.
- [DESIGN_CRITIQUE.md](./DESIGN_CRITIQUE.md) – UI/UX-Critique.
