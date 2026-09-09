[CmdletBinding()]
param(
    [switch]$NoBrowser,
    [ValidateSet('studio', 'ops')][string]$Surface = 'studio'
)

$ErrorActionPreference = 'Stop'
$adminRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $adminRoot
$backend = Join-Path $repoRoot 'tools\kvp-ops-server.ps1'
$logDirectory = Join-Path $repoRoot 'security-audits'
$opsPort = 18555
$uiPort = 5173

function Test-HttpEndpoint {
    param([string]$Uri)
    try {
        $response = Invoke-WebRequest -Uri $Uri -UseBasicParsing -TimeoutSec 2 -Proxy $null
        return $response.StatusCode -ge 200 -and $response.StatusCode -lt 500
    }
    catch { return $false }
}

function Resolve-NodeRunner {
    $npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
    if ($npm) { return [pscustomobject]@{ path = $npm.Source; prefix = @() } }

    $profileRoot = [Environment]::GetFolderPath('UserProfile')
    $bundledNode = Join-Path $profileRoot '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin'
    $bundledPnpm = Join-Path $bundledNode '..\..\bin\fallback\pnpm.cmd'
    if ((Test-Path -LiteralPath (Join-Path $bundledNode 'node.exe')) -and (Test-Path -LiteralPath $bundledPnpm)) {
        $env:Path = "$bundledNode;" + $env:Path
        return [pscustomobject]@{ path = $bundledPnpm; prefix = @() }
    }

    throw 'Node.js/npm was not found. Install Node.js LTS or expose npm.cmd on PATH.'
}

if (-not (Test-Path -LiteralPath $backend -PathType Leaf)) { throw "Ops backend not found: $backend" }
New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null

if (-not (Test-HttpEndpoint "http://127.0.0.1:$opsPort/api/health")) {
    Start-Process powershell.exe -WindowStyle Hidden -ArgumentList @(
        '-NoProfile',
        '-ExecutionPolicy', 'Bypass',
        '-File', $backend,
        '-Port', $opsPort,
        '-ProjectRoot', $repoRoot,
        '-NoConsole'
    ) -RedirectStandardOutput (Join-Path $logDirectory 'ops-server.out.log') -RedirectStandardError (Join-Path $logDirectory 'ops-server.err.log') | Out-Null
}

foreach ($attempt in 1..20) {
    if (Test-HttpEndpoint "http://127.0.0.1:$opsPort/api/health") { break }
    Start-Sleep -Milliseconds 250
}
if (-not (Test-HttpEndpoint "http://127.0.0.1:$opsPort/api/health")) { throw 'Ops backend did not become ready.' }

if (-not (Test-HttpEndpoint "http://127.0.0.1:$uiPort/")) {
    $env:Path = $env:Path + ';' + [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
    $runner = Resolve-NodeRunner
    Start-Process -FilePath $runner.path -WorkingDirectory $adminRoot -WindowStyle Hidden -ArgumentList @('run', 'dev', '--', '--host', '127.0.0.1') | Out-Null
}

foreach ($attempt in 1..30) {
    if (Test-HttpEndpoint "http://127.0.0.1:$uiPort/") { break }
    Start-Sleep -Milliseconds 250
}
if (-not (Test-HttpEndpoint "http://127.0.0.1:$uiPort/")) { throw 'Admin UI did not become ready.' }

$url = "http://127.0.0.1:$uiPort/?workspace=1&surface=$Surface"
if (-not $NoBrowser) { Start-Process $url | Out-Null }
Write-Output "NetCity KVP $($Surface.ToUpperInvariant()): $url"
