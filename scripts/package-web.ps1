# scripts/package-web.ps1
#
# Baut die EXE-freie Variante von CopyMail und packt sie als ZIP.
#
# Variante A (Ordner-Build): dist-web/ - mehrere Dateien, fuer interne
#   Web-Server (SharePoint, IIS, GitHub Pages) ODER lokal per Doppelklick
#   auf index.html zu oeffnen.
# Variante B (Single-File): copymail.html - eine einzige HTML-Datei,
#   ideal fuer Mail-Versand, USB-Stick oder Wiki-Anhang.
#
# Beide Varianten laufen im Browser, brauchen keine Installation, keine
# EXE-Rechte. Datei-Anhang-Modus ist im Browser eingeschraenkt, der
# Text-Modus (Kopieren in eine neue Mail) funktioniert voll.
#
# Aufruf:
#     npm run package:web

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

$pkg = Get-Content (Join-Path $repoRoot 'package.json') -Raw | ConvertFrom-Json
$version = $pkg.version

$releaseDir = Join-Path $repoRoot 'release'
$payloadDir = Join-Path $releaseDir "CopyMail-$version-web"
$zipPath = Join-Path $releaseDir "CopyMail-$version-web.zip"

# 1) Bauen
Write-Host "==> Baue Web-Variante (Ordner) ..."
npm run build:web | Out-Null
Write-Host "==> Baue Single-File-HTML ..."
npm run build:singlehtml | Out-Null

# 2) Auslieferungs-Ordner vorbereiten
if (Test-Path $payloadDir) { Remove-Item $payloadDir -Recurse -Force }
New-Item -ItemType Directory -Path $payloadDir | Out-Null

# 3) Ordner-Build kopieren
$ordnerDir = Join-Path $payloadDir 'CopyMail-Ordner'
Copy-Item -Recurse (Join-Path $repoRoot 'dist-web') $ordnerDir

# 4) Single-File-HTML kopieren + sinnvoll umbenennen
$single = Get-ChildItem (Join-Path $repoRoot 'dist-single') -Filter '*.html' | Select-Object -First 1
if ($single) {
    Copy-Item $single.FullName (Join-Path $payloadDir 'CopyMail.html')
}

# 5) Doku dazu
$docs = @(
    (Join-Path $repoRoot 'BENUTZERHANDBUCH.pdf'),
    (Join-Path $repoRoot 'BENUTZERHANDBUCH.docx'),
    (Join-Path $repoRoot 'LIESMICH-WEB.txt')
)
foreach ($doc in $docs) {
    if (Test-Path $doc) { Copy-Item $doc -Destination $payloadDir }
}

# 6) ZIP
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
Compress-Archive -Path "$payloadDir\*" -DestinationPath $zipPath -CompressionLevel Optimal
$zipSize = [math]::Round((Get-Item $zipPath).Length / 1MB, 2)

Write-Host ""
Write-Host "OK - Web-Paket fertig:"
Write-Host "  $zipPath  ($zipSize MB)"
Write-Host ""
Write-Host "Inhalt:"
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
