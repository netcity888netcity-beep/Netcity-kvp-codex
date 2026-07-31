$ErrorActionPreference = 'Stop'

$projectRoot = 'D:\auto-admin'
$launcherDirectory = Join-Path $projectRoot 'launcher\dist\win-unpacked'
$launcher = Get-ChildItem -LiteralPath $launcherDirectory -File -Filter '*.exe' -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -notmatch '^(chrome_proxy|elevate|notification_helper)\.exe$' } |
    Select-Object -First 1 -ExpandProperty FullName
$shortcut = Join-Path $projectRoot 'Launcher.lnk'
$dashboardUrl = 'http://127.0.0.1:18234/dashboard'

function Test-Dashboard {
    try {
        $response = Invoke-WebRequest -Uri $dashboardUrl -UseBasicParsing -TimeoutSec 3
        return $response.StatusCode -eq 200
    }
    catch {
        return $false
    }
}

if (-not (Test-Path -LiteralPath $projectRoot -PathType Container)) {
    throw "AutoAdmin project was not found: $projectRoot"
}

if (-not (Test-Dashboard)) {
    if (Test-Path -LiteralPath $shortcut -PathType Leaf) {
        Start-Process -FilePath $shortcut
    }
    elseif ($launcher -and (Test-Path -LiteralPath $launcher -PathType Leaf)) {
        Start-Process -FilePath $launcher
    }
    else {
        throw 'AutoAdmin Launcher was not found.'
    }

    $ready = $false
    foreach ($attempt in 1..20) {
        Start-Sleep -Milliseconds 500
        if (Test-Dashboard) {
            $ready = $true
            break
        }
    }
    if (-not $ready) {
        throw "AutoAdmin Dashboard did not become ready: $dashboardUrl"
    }
}

if ($launcher -and (Test-Path -LiteralPath $launcher -PathType Leaf)) {
    Start-Process -FilePath $launcher -ArgumentList '--open-dashboard'
}

Write-Output "AutoAdmin operational Dashboard is ready: $dashboardUrl"
