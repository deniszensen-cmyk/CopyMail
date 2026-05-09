# scripts/setup-github.ps1
#
# Erste Veroeffentlichung des CopyMail-Repos zu GitHub.
#
# Voraussetzung: das Repo deniszensen-cmyk/CopyMail muss vorher manuell
# auf https://github.com/new erstellt worden sein (leer, ohne README,
# gitignore oder Lizenz).
#
# Dieses Skript:
#  1) committet alle ausstehenden Aenderungen
#  2) verbindet das lokale Repo mit GitHub (falls noch kein origin)
#  3) pusht main
#  4) erinnert an Workflow-Permissions

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

$repoUrl = 'https://github.com/deniszensen-cmyk/CopyMail.git'
$repoWeb = 'https://github.com/deniszensen-cmyk/CopyMail'

Write-Host "==> Pruefe Git-Status ..."
$dirty = git status --porcelain
if ($dirty) {
    Write-Host "    Es gibt Aenderungen, die committet werden:"
    Write-Host "    $dirty" -ForegroundColor Yellow
    $msg = Read-Host "    Commit-Message (Enter = 'feat: CopyMail v2 mit allen Verbesserungen')"
    if (-not $msg) {
        $msg = 'feat: CopyMail v2 mit allen Verbesserungen'
    }
    git add .
    git commit -m $msg | Out-Null
    Write-Host "    Commit gemacht." -ForegroundColor Green
}
else {
    Write-Host "    Working-Tree sauber." -ForegroundColor Green
}

Write-Host ""
Write-Host "==> Pruefe Remote ..."
$remotes = git remote
$hasOrigin = $false
foreach ($r in $remotes) {
    if ($r -eq 'origin') { $hasOrigin = $true }
}

if (-not $hasOrigin) {
    Write-Host "    Lege origin an: $repoUrl"
    git remote add origin $repoUrl
}
else {
    $current = git remote get-url origin
    if ($current -ne $repoUrl) {
        Write-Host "    origin zeigt auf '$current' - setze auf '$repoUrl'"
        git remote set-url origin $repoUrl
    }
    else {
        Write-Host "    origin ist korrekt." -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "==> Branch ..."
$branch = git rev-parse --abbrev-ref HEAD
if ($branch -ne 'main') {
    Write-Host "    Aktueller Branch ist '$branch' - benenne zu 'main' um."
    git branch -M main
}

Write-Host ""
Write-Host "==> Push zu GitHub ..."
Write-Host "    (Beim ersten Mal fragt Git nach deinem GitHub-Token.)"
Write-Host ""
git push -u origin main
$pushExit = $LASTEXITCODE

if ($pushExit -ne 0) {
    Write-Host ""
    Write-Host "FEHLER beim Push." -ForegroundColor Red
    Write-Host "Haeufige Ursachen:"
    Write-Host "  1. Repo existiert noch nicht auf GitHub:"
    Write-Host "     -> https://github.com/new"
    Write-Host "     -> Owner: deniszensen-cmyk, Name: CopyMail, Public,"
    Write-Host "        OHNE README/gitignore/Lizenz-Vorbelegung."
    Write-Host "  2. Authentifizierung fehlt: erstelle ein Personal Access Token"
    Write-Host "     unter https://github.com/settings/tokens (scope: 'repo'),"
    Write-Host "     dann beim Push als Passwort eingeben."
    exit $pushExit
}

Write-Host ""
Write-Host "==> Fertig." -ForegroundColor Green
Write-Host "    Repo: $repoWeb"
Write-Host ""
Write-Host "Naechste Schritte (einmalig auf GitHub):"
Write-Host "  - Settings -> Actions -> General -> Workflow permissions"
Write-Host "    auf 'Read and write permissions' setzen"
Write-Host "    (sonst kann der Release-Workflow keine Releases anlegen)."
Write-Host ""
Write-Host "Erstes Release ausrollen:"
Write-Host "  cd CopyMail-v2"
Write-Host "  npm run release:patch"
