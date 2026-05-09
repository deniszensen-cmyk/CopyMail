# scripts/release.ps1
#
# Helfer fuer Release-Pushes an GitHub.
# Aufrufe:
#   ./scripts/release.ps1 patch    -> 1.2.0 -> 1.2.1
#   ./scripts/release.ps1 minor    -> 1.2.0 -> 1.3.0
#   ./scripts/release.ps1 major    -> 1.2.0 -> 2.0.0
#   ./scripts/release.ps1 1.4.2    -> exakte Version
#
# Was es tut:
#   1) prueft, dass der Working-Tree sauber ist
#   2) bumpt die Version in CopyMail-v2/package.json (npm version)
#   3) committet + tagt
#   4) pusht main + Tag
# Der GitHub-Actions-Workflow .github/workflows/release.yml uebernimmt
# danach den Build und legt das Release mit allen Assets an.

param(
    [Parameter(Mandatory = $true)]
    [string]$Bump
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

# 1) Working-Tree sauber?
$dirty = git status --porcelain
if ($dirty) {
    Write-Error "Working-Tree ist nicht sauber. Erst commiten oder stashen."
    exit 1
}

# 2) Branch == main?
$branch = git rev-parse --abbrev-ref HEAD
if ($branch -ne 'main') {
    Write-Warning "Du bist auf Branch '$branch', nicht 'main'."
    $confirm = Read-Host "Trotzdem weitermachen? (y/N)"
    if ($confirm -ne 'y') { exit 1 }
}

# 3) Version bumpen
Push-Location (Join-Path $repoRoot 'CopyMail-v2')
try {
    Write-Host "npm version $Bump ..."
    $newTag = (npm version $Bump --no-git-tag-version) | Select-Object -Last 1
    if (-not $newTag) {
        throw "npm version hat keine Versionsnummer geliefert."
    }
    $version = $newTag.TrimStart('v')
    Write-Host "neue Version: $version"
}
finally {
    Pop-Location
}

# 4) Commit + Tag im Repo-Root
Set-Location $repoRoot
git add CopyMail-v2/package.json CopyMail-v2/package-lock.json
git commit -m "chore(release): v$version"
git tag "v$version"

# 5) Push
git push origin $branch
git push origin "v$version"

Write-Host ""
Write-Host "OK - Tag v$version gepusht."
Write-Host "GitHub Actions baut jetzt das Release. Status:"
Write-Host "  https://github.com/deniszensen-cmyk/CopyMail/actions"
Write-Host ""
Write-Host "Sobald der Workflow fertig ist, findest du das Release hier:"
Write-Host "  https://github.com/deniszensen-cmyk/CopyMail/releases/tag/v$version"
