$ErrorActionPreference = 'Stop'

$outDir = Join-Path $PSScriptRoot 'publish'
$outFile = Join-Path $outDir 'CopyMailClipboard.exe'
$source = Join-Path $PSScriptRoot 'Program.cs'

# Mehrere moegliche csc.exe-Pfade ausprobieren, statt v4.0.30319 hart zu kodieren.
$cscCandidates = @(
    (Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'),
    (Join-Path $env:WINDIR 'Microsoft.NET\Framework\v4.0.30319\csc.exe')
)

# Roslyn (via Visual Studio)
$roslynRoots = @(
    'C:\Program Files\Microsoft Visual Studio\2022\Community\MSBuild\Current\Bin\Roslyn',
    'C:\Program Files\Microsoft Visual Studio\2022\Professional\MSBuild\Current\Bin\Roslyn',
    'C:\Program Files\Microsoft Visual Studio\2022\Enterprise\MSBuild\Current\Bin\Roslyn',
    'C:\Program Files (x86)\MSBuild\14.0\Bin'
)
foreach ($root in $roslynRoots) {
    $candidate = Join-Path $root 'csc.exe'
    if (Test-Path $candidate) {
        $cscCandidates += $candidate
    }
}

$csc = $cscCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $csc) {
    throw "C# compiler (csc.exe) not found. Bitte .NET Framework Developer Pack 4.x oder Visual Studio installieren."
}

New-Item -ItemType Directory -Force -Path $outDir | Out-Null

& $csc `
    /nologo `
    /optimize+ `
    /target:exe `
    /out:$outFile `
    /reference:System.Windows.Forms.dll `
    /reference:System.Web.Extensions.dll `
    $source

if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}

# Self-Test: prueft die HTML-Clipboard-Format-Berechnung. Ausgabe nur bei Fehler.
$selfTestOutput = & $outFile --self-test 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Error "Self-test failed (exit $LASTEXITCODE):`n$selfTestOutput"
    exit $LASTEXITCODE
}

Write-Host "Built $outFile"
