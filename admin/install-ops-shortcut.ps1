[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$adminRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$launcher = Join-Path $adminRoot 'start-ops-dashboard.ps1'
$portable = Join-Path $adminRoot 'release\NetCity-KVP-portable.exe'
$desktop = [Environment]::GetFolderPath('Desktop')
if (-not (Test-Path -LiteralPath $launcher -PathType Leaf)) { throw "Launcher not found: $launcher" }

$shell = New-Object -ComObject WScript.Shell
$powershellPath = (Get-Command powershell.exe).Source

foreach ($entry in @(
    @{ Name = 'NetCity KVP Model Studio.lnk'; Surface = 'studio'; Description = 'Local NetCity KVP Model Studio' },
    @{ Name = 'NetCity KVP Ops HUD.lnk'; Surface = 'ops'; Description = 'Local NetCity KVP Ops HUD' }
)) {
    $shortcutPath = Join-Path $desktop $entry.Name
    $shortcut = $shell.CreateShortcut($shortcutPath)
    if (Test-Path -LiteralPath $portable -PathType Leaf) {
        $shortcut.TargetPath = $portable
        $shortcut.Arguments = "--surface=$($entry.Surface)"
        $shortcut.WorkingDirectory = (Split-Path -Parent $portable)
    } else {
        $shortcut.TargetPath = $powershellPath
        $shortcut.Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$launcher`" -Surface $($entry.Surface)"
        $shortcut.WorkingDirectory = $adminRoot
    }
    $shortcut.Description = $entry.Description
    $shortcut.IconLocation = "$env:SystemRoot\System32\imageres.dll,109"
    $shortcut.Save()
    Write-Output $shortcutPath
}
