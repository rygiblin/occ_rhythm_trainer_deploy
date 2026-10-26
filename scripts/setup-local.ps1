$ErrorActionPreference = 'Stop'
$practiceRoot = Split-Path -Parent $PSScriptRoot
Push-Location $practiceRoot
try {
    & npm.cmd install --prefix .local-tools --no-save --no-package-lock --no-audit --no-fund node@22
    if ($LASTEXITCODE -ne 0) { throw 'Could not install the project-local Node 22 runtime.' }
    $practiceNode = Join-Path $practiceRoot '.local-tools/node_modules/node/bin'
    $env:PATH = $practiceNode + ';' + $env:PATH
    & npm.cmd ci --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { throw 'Could not install dependencies.' }
    $practiceBash = Join-Path $env:ProgramFiles 'Git/bin/bash.exe'
    if (-not (Test-Path -LiteralPath $practiceBash)) { throw 'Git for Windows with Git Bash is required to build the pinned SDK.' }
    & $practiceBash scripts/install-beta-sdk.sh
    if ($LASTEXITCODE -ne 0) { throw 'Could not build the pinned simulator SDK.' }
    & node --import tsx scripts/download-practice-assets.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Could not download the published practice assets.' }
    & node --import tsx src/assetBundle/check.ts
    if ($LASTEXITCODE -ne 0) { throw 'The published assets do not match this checkout.' }
    Write-Output 'Setup complete. Open Start rhythm practice.cmd to practise.'
} finally { Pop-Location }
