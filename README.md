# CopyMail

Windows-Desktop-Tool zum Einlesen von `.msg`/`.eml`-Dateien und Kopieren von
formatiertem Mailinhalt + Originaldatei in die Zwischenablage.

Repo: <https://github.com/deniszensen-cmyk/CopyMail>
Releases: <https://github.com/deniszensen-cmyk/CopyMail/releases>
Update-Endpoint: <https://api.github.com/repos/deniszensen-cmyk/CopyMail/releases/latest>

> Die Legacy-v1 liegt in [`legacy/v1/`](./legacy/v1/) und wird nicht mehr
> gepflegt – siehe [LEGACY.md](./LEGACY.md).

## Schnellstart

```powershell
npm install
npm run build:helper
npm run electron:dev
```

Details, Architektur und Sicherheits-Hinweise: siehe
[ARCHITECTURE.md](./ARCHITECTURE.md).

## CI

GitHub Actions Workflow unter `.github/workflows/ci.yml` baut und testet
bei jedem Push/PR auf `main`.

## Releases

```powershell
npm run release:patch     # 1.2.0 -> 1.2.1
# oder release:minor / release:major
```

Mehr dazu: [GITHUB_RELEASES.md](./GITHUB_RELEASES.md).

## Code-Review & Design

- [CODE_REVIEW.md](./CODE_REVIEW.md) – Sicherheits- und Code-Review.
- [DESIGN_CRITIQUE.md](./DESIGN_CRITIQUE.md) – UI/UX-Critique.
- [ROADMAP.md](./ROADMAP.md) – offene Verbesserungen.
- [TEST_PLAN.md](./TEST_PLAN.md) – manuelle Smoke-Test-Checkliste.
