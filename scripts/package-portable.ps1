# scripts/package-portable.ps1
#
# Packt die portable EXE plus Benutzerhandbuch und LIESMICH in einen
# Auslieferungs-Ordner und erzeugt zusaetzlich ein ZIP. Nach dem Lauf liegt
# unter ./release/ ein ZIP, das du an Endnutzer ausliefern kannst.
#
# Voraussetzung: vorher
#     cd CopyMail-v2
#     npm install
#     npm run build:helper
#     npm run electron:build:portable
#
# Aufruf:
#     npm run package         (aus CopyMail-v2/)
# oder direkt:
#     powershell -ExecutionPolicy Bypass -File scripts/package-portable.ps1

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$v2Dir = Join-Path $repoRoot 'CopyMail-v2'
$distDir = Join-Path $v2Dir 'dist-electron'
$releaseDir = Join-Path $repoRoot 'release'

# 1. Version aus package.json lesen
$pkg = Get-Content (Join-Path $v2Dir 'package.json') -Raw | ConvertFrom-Json
$version = $pkg.version
Write-Host "Building distribution for CopyMail v$version"

# 2. Portable EXE finden
$portableExe = Get-ChildItem $distDir -Filter "CopyMail-$version-portable.exe" -File -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $portableExe) {
    $portableExe = Get-ChildItem $distDir -Filter '*portable*.exe' -File -ErrorAction SilentlyContinue | Select-Object -First 1
}
if (-not $portableExe) {
    throw "Portable EXE nicht gefunden in $distDir. Vorher 'npm run electron:build:portable' ausfuehren."
}
Write-Host "  portable: $($portableExe.Name)"

# 3. Optional: Setup-Installer mitnehmen, wenn vorhanden
$setupExe = Get-ChildItem $distDir -Filter "*Setup*.exe" -File -ErrorAction SilentlyContinue | Select-Object -First 1

# 4. Zielordner vorbereiten
if (Test-Path $releaseDir) {
    Remove-Item $releaseDir -Recurse -Force
}
New-Item -ItemType Directory -Path $releaseDir | Out-Null

$payloadName = "CopyMail-$version"
$payloadDir = Join-Path $releaseDir $payloadName
New-Item -ItemType Directory -Path $payloadDir | Out-Null

# 5. EXE als CopyMail.exe - damit Endnutzer keinen kryptischen Namen sehen
Copy-Item $portableExe.FullName -Destination (Join-Path $payloadDir 'CopyMail.exe')

# 6. Setup-Installer (falls vorhanden) fuer Power-User in einen Unterordner
if ($setupExe) {
    $optDir = Join-Path $payloadDir '_Installer'
    New-Item -ItemType Directory -Path $optDir | Out-Null
    Copy-Item $setupExe.FullName -Destination (Join-Path $optDir $setupExe.Name)
}

# 7. Doku einpacken
$docs = @(
    (Join-Path $repoRoot 'BENUTZERHANDBUCH.pdf'),
    (Join-Path $repoRoot 'BENUTZERHANDBUCH.docx'),
    (Join-Path $repoRoot 'LIESMICH.txt')
)
foreach ($doc in $docs) {
    if (Test-Path $doc) {
        Copy-Item $doc -Destination $payloadDir
    }
    else {
        Write-Warning "Fehlende Datei: $doc"
    }
}

# 8. ZIP erzeugen
$zipPath = Join-Path $releaseDir "$payloadName.zip"
if (Test-Path $zipPath) {
    Remove-Item $zipPath -Force
}
Compress-Archive -Path "$payloadDir\*" -DestinationPath $zipPath -CompressionLevel Optimal
$zipSize = [math]::Round((Get-Item $zipPath).Length / 1MB, 1)

Write-Host ""
Write-Host "OK - Auslieferungs-Paket fertig:"
Write-Host "  $zipPath ($zipSize MB)"
Write-Host ""
Write-Host "Inhalt des ZIPs:"
Get-ChildItem $payloadDir -Recurse | ForEach-Object {
    $rel = $_.FullName.Substring($payloadDir.Length + 1)
    if ($_.PSIsContainer) {
        Write-Host "  + $rel/"
    }
    else {
        $size = [math]::Round($_.Length / 1KB, 1)
        Write-Host "  - $rel ($size KB)"
    }
}
