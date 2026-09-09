[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$adminRoot = Join-Path $repoRoot 'admin'
$nodePath = (Get-Command node.exe -ErrorAction SilentlyContinue).Source
if (-not $nodePath) { $nodePath = 'C:\Program Files\nodejs\node.exe' }
$npmCli = 'C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js'
if (-not (Test-Path -LiteralPath $nodePath -PathType Leaf) -or -not (Test-Path -LiteralPath $npmCli -PathType Leaf)) {
    throw 'Node.js/npm was not found. Install Node.js LTS before creating the installer.'
}

$iscc = (Get-Command ISCC.exe -ErrorAction SilentlyContinue).Source
if (-not $iscc) {
    $candidates = @(
        (Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'Programs\Inno Setup 6\ISCC.exe'),
        'C:\Program Files (x86)\Inno Setup 6\ISCC.exe',
        'C:\Program Files\Inno Setup 6\ISCC.exe'
    )
    $iscc = $candidates | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } | Select-Object -First 1
}
if (-not $iscc) { throw 'Inno Setup compiler (ISCC.exe) was not found.' }

Push-Location $adminRoot
try {
    & $nodePath $npmCli run build
    & $nodePath (Join-Path $repoRoot 'tools\package-electron-portable.cjs')
    & $iscc (Join-Path $adminRoot 'installer\netcity-kvp.iss')
    $installer = Join-Path $adminRoot 'release-installer\NetCity-KVP-Setup-0.1.0.exe'
    if (-not (Test-Path -LiteralPath $installer -PathType Leaf)) { throw "Installer was not created: $installer" }
    Write-Output $installer
}
finally { Pop-Location }
