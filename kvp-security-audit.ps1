[CmdletBinding()]
param(
    [string]$OutputDirectory = ''
)

$ErrorActionPreference = 'SilentlyContinue'
if ([string]::IsNullOrWhiteSpace($OutputDirectory)) {
    $auditBase = if ($env:LOCALAPPDATA) { $env:LOCALAPPDATA } else { (Get-Location).Path }
    $OutputDirectory = Join-Path $auditBase 'NetCity KVP\security-audits'
}
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null

function Safe-Value {
    param([scriptblock]$Expression)
    try { & $Expression } catch { $null }
}

$processes = @{}
Get-Process | ForEach-Object {
    $processes[$_.Id] = [pscustomobject]@{
        Name = $_.ProcessName
        Path = $_.Path
    }
}

$listeners = Get-NetTCPConnection -State Listen | ForEach-Object {
    $p = $processes[[int]$_.OwningProcess]
    [pscustomobject]@{
        LocalAddress = $_.LocalAddress
        LocalPort = $_.LocalPort
        ProcessId = $_.OwningProcess
        Process = $p.Name
        Path = $p.Path
    }
}

$connections = Get-NetTCPConnection -State Established | ForEach-Object {
    $p = $processes[[int]$_.OwningProcess]
    [pscustomobject]@{
        LocalAddress = $_.LocalAddress
        LocalPort = $_.LocalPort
        RemoteAddress = $_.RemoteAddress
        RemotePort = $_.RemotePort
        ProcessId = $_.OwningProcess
        Process = $p.Name
        Path = $p.Path
    }
}

$suspiciousTaskNames = @(
    'FamilySafetyRefreshingTask', 'FPRemove', 'RPRemove',
    'Usb-Notification', 'CleanupTemporaryStaticFiles'
)
$suspiciousTasks = foreach ($name in $suspiciousTaskNames) {
    Get-ScheduledTask -TaskName $name | ForEach-Object {
        [pscustomobject]@{
            TaskPath = $_.TaskPath
            TaskName = $_.TaskName
            State = $_.State
            Actions = ($_.Actions | ForEach-Object { "$($_.Execute) $($_.Arguments)" }) -join ' | '
        }
    }
}

$report = [ordered]@{
    GeneratedAt = (Get-Date).ToString('o')
    Computer = Safe-Value { Get-ComputerInfo | Select-Object WindowsProductName, WindowsVersion, OsBuildNumber, OsArchitecture, CsName, CsManufacturer, CsModel, CsTotalPhysicalMemory }
    Cpu = Safe-Value { Get-CimInstance Win32_Processor | Select-Object Name, NumberOfCores, NumberOfLogicalProcessors, MaxClockSpeed }
    Memory = Safe-Value { [math]::Round(((Get-CimInstance Win32_PhysicalMemory | Measure-Object Capacity -Sum).Sum / 1GB), 2) }
    NetworkAdapters = Safe-Value { Get-NetAdapter | Select-Object Name, Status, MacAddress, LinkSpeed, InterfaceDescription }
    NetworkProfiles = Safe-Value { Get-NetConnectionProfile | Select-Object Name, InterfaceAlias, NetworkCategory, IPv4Connectivity, IPv6Connectivity }
    Routes = Safe-Value { Get-NetRoute -AddressFamily IPv4 | Select-Object ifIndex, DestinationPrefix, NextHop, RouteMetric, InterfaceAlias }
    Dns = Safe-Value { Get-DnsClientServerAddress -AddressFamily IPv4 | Select-Object InterfaceAlias, ServerAddresses }
    Firewall = Safe-Value { Get-NetFirewallProfile | Select-Object Name, Enabled, DefaultInboundAction, DefaultOutboundAction, LogAllowed, LogBlocked }
    Defender = Safe-Value { Get-MpComputerStatus | Select-Object AMServiceEnabled, AntivirusEnabled, RealTimeProtectionEnabled, BehaviorMonitorEnabled, IoavProtectionEnabled, IsTamperProtected, AntivirusSignatureVersion, AntivirusSignatureLastUpdated, QuickScanEndTime, FullScanEndTime }
    DefenderExclusions = Safe-Value { Get-MpPreference | Select-Object ExclusionPath, ExclusionProcess, ExclusionExtension }
    Listeners = @($listeners)
    EstablishedConnections = @($connections)
    SuspiciousTasks = @($suspiciousTasks)
    Rdp = Safe-Value { Get-ItemProperty 'HKLM:\System\CurrentControlSet\Control\Terminal Server' | Select-Object fDenyTSConnections }
    Services = Safe-Value { Get-CimInstance Win32_Service | Where-Object { $_.Name -in @('WinRM', 'WinDefend', 'LMS') } | Select-Object Name, DisplayName, State, StartMode, PathName }
    Detections = Safe-Value { Get-MpThreatDetection | Select-Object InitialDetectionTime, ThreatID, ActionSuccess, Resources }
}

$path = Join-Path $OutputDirectory "audit-$timestamp.json"
$report | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $path -Encoding UTF8
Write-Output $path
