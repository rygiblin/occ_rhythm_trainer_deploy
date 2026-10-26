param([switch]$NoBrowser, [switch]$Tutorial)

$ErrorActionPreference = 'Stop'
$practiceRoot = Split-Path -Parent $PSScriptRoot
$practiceNode = Join-Path $practiceRoot '.local-tools/node_modules/node/bin/node.exe'
if (-not (Test-Path -LiteralPath $practiceNode)) { throw 'The local runtime is missing. Run scripts/setup-local.ps1 first.' }
$practiceWebpack = Join-Path $practiceRoot 'node_modules/webpack-cli/bin/cli.js'
if (-not (Test-Path -LiteralPath $practiceWebpack)) { throw 'Dependencies are missing. Run scripts/setup-local.ps1 first.' }
$practiceUrl = 'http://127.0.0.1:8002/?focus=rhythm-loop&invincible=on'
if ($Tutorial) { $practiceUrl += '&tutorial=on' }
$practiceState = Join-Path $practiceRoot '.verify/local-rhythm'
New-Item -ItemType Directory -Path $practiceState -Force | Out-Null

function Get-PracticePage {
    try { return Invoke-WebRequest 'http://127.0.0.1:8002/' -UseBasicParsing -TimeoutSec 2 } catch { return $null }
}

function Test-PracticeOwner {
    try {
        $practiceRecord = Get-Content (Join-Path $practiceState 'server.json') -Raw | ConvertFrom-Json
        if ($practiceRecord.root -ne $practiceRoot) { return $false }
        $practiceOwner = Get-Process -Id ([int]$practiceRecord.pid) -ErrorAction Stop
        if ($practiceOwner.StartTime.ToUniversalTime() -ne ([datetime]$practiceRecord.started).ToUniversalTime()) { return $false }
        $practiceListeners = @(Get-NetTCPConnection -LocalPort 8002 -State Listen -ErrorAction Stop)
        return $practiceListeners.OwningProcess -contains $practiceOwner.Id
    } catch { return $false }
}

$practicePage = Get-PracticePage
if ($null -ne $practicePage -and -not (Test-PracticeOwner)) {
    throw 'Port 8002 is serving another checkout or application. Close that server before starting this trainer.'
}
if ($null -eq $practicePage -and (Test-PracticeOwner)) {
    for ($practiceAttempt = 0; $practiceAttempt -lt 60; $practiceAttempt++) {
        Start-Sleep -Milliseconds 500
        $practicePage = Get-PracticePage
        if ($null -ne $practicePage) { break }
    }
    if ($null -eq $practicePage) { throw 'This checkout is already starting, but did not become ready. Read .verify/local-rhythm/server.log.' }
}
if ($null -eq $practicePage) {
    Push-Location $practiceRoot
    try {
        & $practiceNode --import tsx src/assetBundle/check.ts
        if ($LASTEXITCODE -ne 0) { throw 'The assets are incomplete. Run scripts/setup-local.ps1 first.' }
    } finally { Pop-Location }
    $practiceProcess = Start-Process -FilePath $practiceNode -ArgumentList @(
        ('"' + $practiceWebpack + '"'), 'serve', '--mode', 'development', '--host', '127.0.0.1', '--port', '8002'
    ) -WorkingDirectory $practiceRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $practiceState 'server.log') -RedirectStandardError (Join-Path $practiceState 'server-errors.log')
    @{ pid = $practiceProcess.Id; started = $practiceProcess.StartTime.ToString('o'); root = $practiceRoot } | ConvertTo-Json | Set-Content (Join-Path $practiceState 'server.json')
    for ($practiceAttempt = 0; $practiceAttempt -lt 60; $practiceAttempt++) {
        Start-Sleep -Milliseconds 500
        $practicePage = Get-PracticePage
        if ($null -ne $practicePage) { break }
        if ($practiceProcess.HasExited) { throw ('The trainer stopped. Read ' + (Join-Path $practiceState 'server-errors.log')) }
    }
}
if ($null -eq $practicePage -or $practicePage.Content -notmatch '<title>Archive Ocellus Trainer</title>') {
    throw 'The local trainer did not start, or port 8002 belongs to another application.'
}
Write-Output $practiceUrl
if (-not $NoBrowser) { Start-Process $practiceUrl }
