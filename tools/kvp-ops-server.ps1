[CmdletBinding()]
param(
    [int]$Port = 18555,
    [string]$ProjectRoot = 'D:\project-auto\Netcity-kvp-codex',
    [switch]$NoConsole
)

$ErrorActionPreference = 'SilentlyContinue'
$env:Path = $env:Path + ';' + [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
$adminRoot = Join-Path $ProjectRoot 'admin'
$auditScript = 'D:\project-auto\kvp-security-audit.ps1'
if (-not (Test-Path -LiteralPath $auditScript -PathType Leaf)) {
    $auditScript = Join-Path $ProjectRoot 'kvp-security-audit.ps1'
}
$allowedOrigins = @(
    'http://127.0.0.1:5173',
    'http://localhost:5173',
    'http://127.0.0.1:18556',
    'http://localhost:18556'
)
$history = [System.Collections.Generic.List[object]]::new()
$telemetryCache = $null
$telemetryCacheAt = [datetime]::MinValue
$studioConfigPath = Join-Path $adminRoot 'model-studio.json'
$studioConfigCache = $null
$studioConfigCacheAt = [datetime]::MinValue
$userDataRoot = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'NetCity-KVP'
$studioOverridePath = Join-Path $userDataRoot 'model-studio.override.json'
$credentialStorePath = Join-Path $userDataRoot 'provider-secrets.json'

if (-not ('KvpDpapi' -as [type])) {
    Add-Type @'
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Text;

public static class KvpDpapi {
    [StructLayout(LayoutKind.Sequential)] private struct DATA_BLOB { public int cbData; public IntPtr pbData; }
    [DllImport("crypt32.dll", SetLastError = true, CharSet = CharSet.Unicode)] private static extern bool CryptProtectData(ref DATA_BLOB input, string description, IntPtr entropy, IntPtr reserved, IntPtr prompt, int flags, out DATA_BLOB output);
    [DllImport("crypt32.dll", SetLastError = true, CharSet = CharSet.Unicode)] private static extern bool CryptUnprotectData(ref DATA_BLOB input, IntPtr description, IntPtr entropy, IntPtr reserved, IntPtr prompt, int flags, out DATA_BLOB output);
    [DllImport("kernel32.dll", SetLastError = true)] private static extern IntPtr LocalFree(IntPtr handle);

    public static string Protect(string value) {
        var bytes = Encoding.UTF8.GetBytes(value ?? string.Empty);
        var input = new DATA_BLOB { cbData = bytes.Length, pbData = Marshal.AllocHGlobal(bytes.Length) };
        try {
            Marshal.Copy(bytes, 0, input.pbData, bytes.Length);
            DATA_BLOB output;
            if (!CryptProtectData(ref input, "NetCity KVP provider credential", IntPtr.Zero, IntPtr.Zero, IntPtr.Zero, 1, out output)) throw new Win32Exception(Marshal.GetLastWin32Error());
            try { var encrypted = new byte[output.cbData]; Marshal.Copy(output.pbData, encrypted, 0, output.cbData); return Convert.ToBase64String(encrypted); }
            finally { LocalFree(output.pbData); }
        }
        finally { Marshal.FreeHGlobal(input.pbData); }
    }

    public static string Unprotect(string value) {
        var bytes = Convert.FromBase64String(value);
        var input = new DATA_BLOB { cbData = bytes.Length, pbData = Marshal.AllocHGlobal(bytes.Length) };
        try {
            Marshal.Copy(bytes, 0, input.pbData, bytes.Length);
            DATA_BLOB output;
            if (!CryptUnprotectData(ref input, IntPtr.Zero, IntPtr.Zero, IntPtr.Zero, IntPtr.Zero, 1, out output)) throw new Win32Exception(Marshal.GetLastWin32Error());
            try { var clear = new byte[output.cbData]; Marshal.Copy(output.pbData, clear, 0, output.cbData); return Encoding.UTF8.GetString(clear); }
            finally { LocalFree(output.pbData); }
        }
        finally { Marshal.FreeHGlobal(input.pbData); }
    }
}
'@
}

function Get-TextVersion {
    param([string]$Command, [string[]]$Arguments = @('--version'))

    $commandInfo = Get-Command $Command -ErrorAction SilentlyContinue
    if (-not $commandInfo) {
        return [pscustomobject]@{ installed = $false; version = $null; path = $null }
    }

    try {
        $raw = (& $Command @Arguments 2>&1 | Select-Object -First 1 | Out-String).Trim()
        [pscustomobject]@{ installed = $true; version = $raw; path = $commandInfo.Source }
    }
    catch {
        [pscustomobject]@{ installed = $true; version = $null; path = $commandInfo.Source }
    }
}

function Resolve-NodePackageRunner {
    $npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
    if ($npm) { return $npm.Source }

    $profileRoot = [Environment]::GetFolderPath('UserProfile')
    $bundledNode = Join-Path $profileRoot '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin'
    $bundledPnpm = Join-Path $bundledNode '..\..\bin\fallback\pnpm.cmd'
    if ((Test-Path -LiteralPath (Join-Path $bundledNode 'node.exe')) -and (Test-Path -LiteralPath $bundledPnpm)) {
        $env:Path = "$bundledNode;" + $env:Path
        return $bundledPnpm
    }

    throw 'Node.js/npm was not found for the Admin UI build.'
}

function Get-Gigabytes {
    param([double]$Bytes)
    [math]::Round($Bytes / 1GB, 1)
}

function Get-ProjectSummary {
    if (-not (Test-Path -LiteralPath (Join-Path $ProjectRoot '.git') -PathType Container)) {
        return [pscustomobject]@{ branch = 'packaged'; dirty_files = 0; last_commit = 'not available in packaged runtime'; root = $ProjectRoot }
    }
    $branch = ((& git -C $ProjectRoot branch --show-current 2>$null | Out-String).Trim())
    $statusLines = @(& git -C $ProjectRoot status --porcelain 2>$null)
    $commit = ((& git -C $ProjectRoot log -1 --format='%h%x09%s' 2>$null | Out-String).Trim())
    [pscustomobject]@{
        branch = if ($branch) { $branch } else { 'unknown' }
        dirty_files = $statusLines.Count
        last_commit = if ($commit) { $commit } else { 'unknown' }
        root = $ProjectRoot
    }
}

function Get-OperationalTelemetry {
    if ($null -ne $telemetryCache -and ((Get-Date) - $telemetryCacheAt).TotalSeconds -lt 8) {
        return $telemetryCache
    }
    $computer = Get-CimInstance Win32_ComputerSystem
    $os = Get-CimInstance Win32_OperatingSystem
    $cpu = @(Get-CimInstance Win32_Processor)
    $cpuLoad = [math]::Round((($cpu | Measure-Object -Property LoadPercentage -Average).Average), 0)
    $memoryTotal = [double]$computer.TotalPhysicalMemory
    $memoryFree = [double]$os.FreePhysicalMemory * 1KB
    $memoryUsed = [math]::Max([double]0, [double]($memoryTotal - $memoryFree))
    $volume = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='C:'"
    $adapters = @(Get-CimInstance Win32_NetworkAdapter -Filter 'NetEnabled = TRUE')
    $primaryAdapter = $adapters | Where-Object { $_.NetConnectionID -notmatch 'tun|vpn|loopback' -and $_.Name -notmatch 'tun|vpn|loopback' } | Select-Object -First 1
    $tunnel = $adapters | Where-Object { $_.NetConnectionID -match 'tun|vpn|happ' -or $_.Name -match 'tun|vpn|happ' } | Select-Object -First 1
    $netstat = @(netstat -ano 2>$null)
    $listeners = @($netstat | Where-Object { $_ -match '\sLISTENING\s' })
    $externalConnections = @($netstat | Where-Object { $_ -match '\sESTABLISHED\s' -and $_ -notmatch '127\.0\.0\.1|::1' })
    $firewallText = (netsh advfirewall show allprofiles state 2>$null | Out-String)
    $firewallService = Get-Service MpsSvc -ErrorAction SilentlyContinue
    # Get-MpComputerStatus can block for tens of seconds when the Defender
    # provider is busy. SecurityCenter2 is a fast, read-only health signal and
    # keeps the single-threaded HttpListener responsive for the UI.
    $defenderProducts = @(Get-CimInstance -Namespace 'root/SecurityCenter2' -ClassName AntiVirusProduct -ErrorAction SilentlyContinue)
    $defenderPresent = $defenderProducts.Count -gt 0
    $knownTaskNames = @('FamilySafetyRefreshingTask', 'FPRemove', 'RPRemove', 'Usb-Notification', 'CleanupTemporaryStaticFiles')
    $presentTasks = @($knownTaskNames | ForEach-Object {
        $taskName = $_
        $taskResult = & schtasks.exe /Query /TN $taskName /FO LIST /NH 2>$null
        if ($LASTEXITCODE -eq 0 -and $taskResult) { $taskName }
    })
    $isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

    $result = [pscustomobject]@{
        generated_at = (Get-Date).ToString('o')
        host = [pscustomobject]@{
            computer_name = $env:COMPUTERNAME
            os = "$($os.Caption) build $($os.BuildNumber)"
            model = "$($computer.Manufacturer) $($computer.Model)"
        }
        compute = [pscustomobject]@{
            cpu_name = ($cpu | Select-Object -First 1 -ExpandProperty Name)
            cores = (($cpu | Measure-Object -Property NumberOfCores -Sum).Sum)
            threads = (($cpu | Measure-Object -Property NumberOfLogicalProcessors -Sum).Sum)
            load_percent = $cpuLoad
            memory_total_gb = Get-Gigabytes $memoryTotal
            memory_used_gb = Get-Gigabytes $memoryUsed
            memory_used_percent = if ($memoryTotal -gt 0) { [math]::Round(($memoryUsed / $memoryTotal) * 100, 0) } else { 0 }
        }
        storage = [pscustomobject]@{
            drive = 'C:'
            free_gb = Get-Gigabytes $volume.FreeSpace
            total_gb = Get-Gigabytes $volume.Size
            free_percent = if ($volume.Size -gt 0) { [math]::Round(($volume.FreeSpace / $volume.Size) * 100, 0) } else { 0 }
        }
        network = [pscustomobject]@{
            primary = if ($primaryAdapter) { $primaryAdapter.Name } else { 'offline' }
            link_speed = if ($primaryAdapter) { "$([math]::Round(([double]$primaryAdapter.Speed / 1MB), 1)) Mbps" } else { '-' }
            tunnel = if ($tunnel) { if ($tunnel.NetConnectionID) { $tunnel.NetConnectionID } else { $tunnel.Name } } else { 'none' }
            listeners = $listeners.Count
            external_connections = $externalConnections.Count
        }
        security = [pscustomobject]@{
            firewall_enabled = (($firewallText -match '(?i)\bON\b') -or $firewallService.Status -eq 'Running')
            defender_enabled = $defenderPresent
            real_time_protection = $defenderPresent
            tamper_protection = $false
            signature_version = if ($defenderPresent) { 'SecurityCenter2' } else { 'not detected' }
            signature_updated = $null
            quick_scan = $null
            full_scan = $null
            historical_tasks_present = $presentTasks.Count
            exclusions_require_admin_review = (-not $isAdmin)
        }
        toolchain = [ordered]@{
            rust = Get-TextVersion 'rustc'
            cargo = Get-TextVersion 'cargo'
            node = Get-TextVersion 'node'
            npm = Get-TextVersion 'npm.cmd'
            python = Get-TextVersion 'python'
            buf = Get-TextVersion 'buf'
            git = Get-TextVersion 'git'
            docker = Get-TextVersion 'docker'
            github = Get-TextVersion 'gh'
        }
        project = Get-ProjectSummary
        actions = @(
            [pscustomobject]@{ id = 'audit.snapshot'; label = 'Audit snapshot'; detail = 'Save a read-only JSON report'; risk = 'read-only' }
            [pscustomobject]@{ id = 'project.checks'; label = 'Project checks'; detail = 'cargo test, fmt, clippy and buf lint'; risk = 'build' }
            [pscustomobject]@{ id = 'admin.build'; label = 'Build Admin UI'; detail = 'TypeScript and Vite production build'; risk = 'build' }
            [pscustomobject]@{ id = 'open.project'; label = 'Open project'; detail = 'Show the repository in Explorer'; risk = 'desktop' }
        )
    }
    $telemetryCache = $result
    $telemetryCacheAt = Get-Date
    $result
}

function Ensure-StudioUserDataRoot {
    if (-not (Test-Path -LiteralPath $userDataRoot -PathType Container)) {
        New-Item -ItemType Directory -Path $userDataRoot -Force | Out-Null
    }
}

function Read-StudioOverrides {
    if (-not (Test-Path -LiteralPath $studioOverridePath -PathType Leaf)) {
        return [pscustomobject]@{ providers = @() }
    }
    try {
        $raw = [IO.File]::ReadAllText($studioOverridePath, [Text.Encoding]::UTF8)
        $value = $raw | ConvertFrom-Json
        if ($null -eq $value.providers) { return [pscustomobject]@{ providers = @() } }
        return $value
    }
    catch { throw 'Stored provider settings are invalid. Remove the local override file and configure them again.' }
}

function Write-StudioOverrides {
    param($Overrides)
    Ensure-StudioUserDataRoot
    $tempPath = "$studioOverridePath.$([guid]::NewGuid().ToString('n')).tmp"
    try {
        $json = $Overrides | ConvertTo-Json -Depth 8
        [IO.File]::WriteAllText($tempPath, $json, [Text.Encoding]::UTF8)
        Move-Item -LiteralPath $tempPath -Destination $studioOverridePath -Force
    }
    finally {
        if (Test-Path -LiteralPath $tempPath) { Remove-Item -LiteralPath $tempPath -Force -ErrorAction SilentlyContinue }
    }
}

function Read-StudioCredentialStore {
    if (-not (Test-Path -LiteralPath $credentialStorePath -PathType Leaf)) { return [pscustomobject]@{} }
    try {
        $raw = [IO.File]::ReadAllText($credentialStorePath, [Text.Encoding]::UTF8)
        return ($raw | ConvertFrom-Json)
    }
    catch { throw 'Stored provider credentials are invalid. Remove the local credential file and configure them again.' }
}

function Write-StudioCredentialStore {
    param($Store)
    Ensure-StudioUserDataRoot
    $tempPath = "$credentialStorePath.$([guid]::NewGuid().ToString('n')).tmp"
    try {
        $json = $Store | ConvertTo-Json -Depth 4
        [IO.File]::WriteAllText($tempPath, $json, [Text.Encoding]::UTF8)
        Move-Item -LiteralPath $tempPath -Destination $credentialStorePath -Force
    }
    finally {
        if (Test-Path -LiteralPath $tempPath) { Remove-Item -LiteralPath $tempPath -Force -ErrorAction SilentlyContinue }
    }
}

function Set-StudioCredential {
    param($Provider, [string]$Value)
    $envName = [string]$Provider.credential_env
    if (-not $envName -or $envName -notmatch '^[A-Z][A-Z0-9_]{2,63}$') { throw 'This provider does not support a managed API credential.' }
    if ($Value.Length -gt 4096) { throw 'API credential is too long.' }
    $store = Read-StudioCredentialStore
    $existing = $store.PSObject.Properties[$envName]
    if ([string]::IsNullOrWhiteSpace($Value)) {
        if ($existing) { $store.PSObject.Properties.Remove($envName) }
    }
    else {
        $encrypted = [KvpDpapi]::Protect($Value)
        if ($existing) { $existing.Value = $encrypted } else { $store | Add-Member -NotePropertyName $envName -NotePropertyValue $encrypted }
    }
    Write-StudioCredentialStore $store
}

function Invoke-AllowedAction {
    param([string]$ActionId)

    $started = Get-Date
    $success = $false
    $output = ''
    $exitCode = 0
    Push-Location $ProjectRoot
    try {
        switch ($ActionId) {
            'audit.snapshot' {
                if (-not (Test-Path -LiteralPath $auditScript)) { throw "Audit script not found: $auditScript" }
                $output = (& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $auditScript 2>&1 | Out-String).Trim()
                $exitCode = if ($LASTEXITCODE -is [int]) { $LASTEXITCODE } else { 0 }
            }
            'project.checks' {
                $chunks = @()
                & cargo test --workspace 2>&1 | ForEach-Object { $chunks += $_ }
                $testCode = $LASTEXITCODE
                & cargo fmt --all -- --check 2>&1 | ForEach-Object { $chunks += $_ }
                $fmtCode = $LASTEXITCODE
                & cargo clippy --workspace --all-targets -- -D warnings 2>&1 | ForEach-Object { $chunks += $_ }
                $clippyCode = $LASTEXITCODE
                & buf lint 2>&1 | ForEach-Object { $chunks += $_ }
                $bufCode = $LASTEXITCODE
                $output = ($chunks | Out-String).Trim()
                $exitCode = @($testCode, $fmtCode, $clippyCode, $bufCode) | Where-Object { $_ -ne 0 } | Select-Object -First 1
                if ($null -eq $exitCode) { $exitCode = 0 }
            }
            'admin.build' {
                Push-Location $adminRoot
                try {
                    $runner = Resolve-NodePackageRunner
                    $output = (& $runner run build 2>&1 | Out-String).Trim(); $exitCode = $LASTEXITCODE
                }
                finally { Pop-Location }
            }
            'open.project' {
                Start-Process explorer.exe -ArgumentList "`"$ProjectRoot`""
                $output = "Opened $ProjectRoot"
                $exitCode = 0
            }
            default { throw "Action is not in the allowlist: $ActionId" }
        }
        $success = $exitCode -eq 0
    }
    catch {
        $output = $_.Exception.Message
        $exitCode = 1
    }
    finally { Pop-Location }

    $result = [pscustomobject]@{
        id = $ActionId
        success = $success
        exit_code = $exitCode
        output = if ($output.Length -gt 4000) { $output.Substring($output.Length - 4000) } else { $output }
        started_at = $started.ToString('o')
        finished_at = (Get-Date).ToString('o')
    }
    $history.Insert(0, $result)
    while ($history.Count -gt 12) { $history.RemoveAt($history.Count - 1) }
    $result
}

function Get-StudioConfig {
    if ($null -ne $studioConfigCache -and ((Get-Date) - $studioConfigCacheAt).TotalSeconds -lt 30) {
        return $studioConfigCache
    }
    if (-not (Test-Path -LiteralPath $studioConfigPath -PathType Leaf)) {
        throw 'Model Studio configuration is missing.'
    }
    $raw = [IO.File]::ReadAllText($studioConfigPath, [Text.Encoding]::UTF8)
    $config = $raw | ConvertFrom-Json
    if ($config.version -ne 1 -or $config.sensitive_data_policy -ne 'local_only') {
        throw 'Model Studio configuration violates the local-only policy.'
    }
    $overrides = Read-StudioOverrides
    foreach ($override in @($overrides.providers)) {
        $baseProvider = @($config.providers | Where-Object { [string]$_.id -eq [string]$override.id })
        if ($baseProvider.Count -ne 1) { continue }
        if ($null -ne $override.endpoint) { $baseProvider[0].endpoint = [string]$override.endpoint }
        if ($null -ne $override.enabled) { $baseProvider[0].enabled = [bool]$override.enabled }
        if ($null -ne $override.models) { $baseProvider[0].models = @($override.models | ForEach-Object { [string]$_ }) }
    }
    foreach ($provider in @($config.providers)) {
        if ([string]$provider.id -notmatch '^[a-z0-9-]+$') { throw 'Invalid provider identifier.' }
        if ([string]$provider.boundary -eq 'remote' -and [string]$provider.endpoint -notmatch '^https://') {
            throw "Remote provider endpoint must use HTTPS: $($provider.id)"
        }
        if ([string]$provider.boundary -eq 'local' -and [string]$provider.endpoint -and [string]$provider.endpoint -notmatch '^https?://(127\.0\.0\.1|localhost|\[::1\])(:\d+)?(/|$)') {
            throw "Local provider endpoint must stay on loopback: $($provider.id)"
        }
    }
    $studioConfigCache = $config
    $studioConfigCacheAt = Get-Date
    $config
}

function Get-StudioCredentialValue {
    param($Provider)
    $envName = [string]$Provider.credential_env
    if (-not $envName) { return $null }
    $item = Get-Item -Path "Env:$envName" -ErrorAction SilentlyContinue
    if ($item -and [string]$item.Value) { return [string]$item.Value }
    $store = Read-StudioCredentialStore
    $encrypted = $store.PSObject.Properties[$envName]
    if ($encrypted -and [string]$encrypted.Value) {
        try { return [KvpDpapi]::Unprotect([string]$encrypted.Value) }
        catch { throw "Stored credential for $envName could not be decrypted on this Windows profile." }
    }
    $null
}

function Get-StudioCredentialConfigured {
    param($Provider)
    $value = Get-StudioCredentialValue $Provider
    return (-not [string]::IsNullOrWhiteSpace([string]$value))
}

function Invoke-StudioHttpJson {
    param(
        [string]$Uri,
        [ValidateSet('GET', 'POST')][string]$Method = 'GET',
        [hashtable]$Headers = @{},
        [string]$Body = $null,
        [int]$TimeoutSec = 4
    )
    $request = @{
        Uri = $Uri
        Method = $Method
        Headers = $Headers
        UseBasicParsing = $true
        TimeoutSec = $TimeoutSec
        Proxy = $null
        ErrorAction = 'Stop'
    }
    if ($null -ne $Body) {
        $request.Body = $Body
        $request.ContentType = 'application/json; charset=utf-8'
    }
    $response = Invoke-WebRequest @request
    if ([string]$response.Content.Length -gt 2097152) { throw 'Provider response exceeded the local size limit.' }
    $response.Content | ConvertFrom-Json
}

function Get-StudioManualModels {
    param($Provider)
    $models = @([string[]]@($Provider.models) | Where-Object { $_ -and $_.Trim() })
    $manualEnv = switch ([string]$Provider.id) {
        'anthropic' { 'ANTHROPIC_MODELS' }
        default { $null }
    }
    if ($manualEnv) {
        $manual = [Environment]::GetEnvironmentVariable($manualEnv)
        if ($manual) { $models += @($manual -split ',' | ForEach-Object { $_.Trim() } | Where-Object { $_ }) }
    }
    @($models | Select-Object -Unique)
}

function Get-StudioDiscoveredModels {
    param($Provider)
    $kind = [string]$Provider.kind
    $endpoint = ([string]$Provider.endpoint).TrimEnd('/')
    $headers = @{}
    $credential = Get-StudioCredentialValue $Provider
    if ($credential) { $headers.Authorization = "Bearer $credential" }
    try {
        if ($kind -eq 'ollama') {
            $value = Invoke-StudioHttpJson -Uri "$endpoint/api/tags" -Headers @{} -TimeoutSec 3
            return @($value.models | ForEach-Object { [string]$_.name } | Where-Object { $_ })
        }
        if (($kind -eq 'openai_compatible' -or $kind -eq 'openai_responses') -and ($Provider.boundary -eq 'local' -or $credential)) {
            $value = Invoke-StudioHttpJson -Uri "$endpoint/models" -Headers $headers -TimeoutSec 3
            return @($value.data | ForEach-Object { [string]$_.id } | Where-Object { $_ })
        }
    }
    catch { return @() }
    @()
}

function Get-StudioCatalog {
    $config = Get-StudioConfig
    $providers = foreach ($provider in @($config.providers)) {
        $manualModels = Get-StudioManualModels $provider
        $credentialConfigured = Get-StudioCredentialConfigured $provider
        $discoveredModels = @()
        $status = 'configured'
        $detail = 'Configured locally'
        if (-not [bool]$provider.enabled) {
            $status = 'disabled'
            $detail = 'Disabled by configuration'
        }
        elseif ([string]$provider.kind -eq 'mock') {
            $status = 'ready'
            $detail = 'No network or credential required'
        }
        elseif ([string]$provider.boundary -eq 'remote' -and -not $credentialConfigured) {
            $status = 'credential_missing'
            $detail = [string]$provider.credential_env
        }
        else {
            $discoveredModels = Get-StudioDiscoveredModels $provider
            if ($discoveredModels.Count -gt 0) {
                $status = 'online'
                $detail = 'Models discovered on demand'
            }
            elseif ($manualModels.Count -gt 0) {
                $status = 'configured'
                $detail = 'Using configured model IDs'
            }
            else {
                $status = 'offline'
                $detail = 'No model list returned'
            }
        }
        $modelIds = @($manualModels + $discoveredModels | Select-Object -Unique)
        [pscustomobject]@{
            id = [string]$provider.id
            label = [string]$provider.label
            kind = [string]$provider.kind
            boundary = [string]$provider.boundary
            endpoint = if ($provider.endpoint) { [string]$provider.endpoint } else { $null }
            credential_env = if ($provider.credential_env) { [string]$provider.credential_env } else { $null }
            credential_configured = $credentialConfigured
            enabled = [bool]$provider.enabled
            status = $status
            status_detail = $detail
            models = @($modelIds | ForEach-Object { [pscustomobject]@{ id = [string]$_; label = [string]$_ } })
        }
    }
    [pscustomobject]@{
        generated_at = (Get-Date).ToString('o')
        sensitive_data_policy = [string]$config.sensitive_data_policy
        providers = @($providers)
        modes = @($config.modes)
        vectors = @($config.vectors)
    }
}

function Read-StudioJsonBody {
    param($Context)
    if ($Context.Request.ContentLength64 -gt 131072) { throw 'Studio request is too large.' }
    $encoding = $Context.Request.ContentEncoding
    if ($null -eq $encoding) { $encoding = [Text.Encoding]::UTF8 }
    $reader = New-Object IO.StreamReader($Context.Request.InputStream, $encoding)
    try { $body = $reader.ReadToEnd() } finally { $reader.Dispose() }
    if ($body.Length -gt 131072) { throw 'Studio request is too large.' }
    $body | ConvertFrom-Json
}

function Get-StudioProvider {
    param($Config, [string]$Id)
    if ($Id -notmatch '^[a-z0-9-]+$') { throw 'Invalid provider identifier.' }
    $provider = @($Config.providers | Where-Object { [string]$_.id -eq $Id })
    if ($provider.Count -ne 1) { throw 'Unknown model provider.' }
    $provider[0]
}

function Get-StudioConfigEntry {
    param($Config, [string]$Property, [string]$Id)
    $entry = @($Config.$Property | Where-Object { [string]$_.id -eq $Id })
    if ($entry.Count -ne 1) { throw "Unknown Studio $Property entry." }
    $entry[0]
}

function Update-StudioProviderSettings {
    param($Request)
    $config = Get-StudioConfig
    $provider = Get-StudioProvider $config ([string]$Request.provider_id)
    $overrideStore = Read-StudioOverrides
    $overrides = @($overrideStore.providers | Where-Object { [string]$_.id -ne [string]$provider.id })
    $endpoint = if ($null -ne $Request.endpoint) { ([string]$Request.endpoint).Trim() } else { [string]$provider.endpoint }
    if ($endpoint.Length -gt 512) { throw 'Provider endpoint is too long.' }
    if ($endpoint) {
        if ([string]$provider.boundary -eq 'remote' -and $endpoint -notmatch '^https://') { throw 'Remote provider endpoint must use HTTPS.' }
        if ([string]$provider.boundary -eq 'local' -and $endpoint -notmatch '^https?://(127\.0\.0\.1|localhost|\[::1\])(:\d+)?(/|$)') { throw 'Local provider endpoint must stay on loopback.' }
    }
    $models = @()
    if ($null -ne $Request.models) {
        $models = @($Request.models | ForEach-Object { ([string]$_).Trim() } | Where-Object { $_ })
        if ($models.Count -gt 64 -or @($models | Where-Object { $_.Length -gt 200 }).Count -gt 0) { throw 'Model list is invalid or too large.' }
    }
    else { $models = @([string[]]@($provider.models) | Where-Object { $_ }) }
    $enabled = if ($null -ne $Request.enabled) { [bool]$Request.enabled } else { [bool]$provider.enabled }
    $overrides += [pscustomobject]@{ id = [string]$provider.id; endpoint = $endpoint; enabled = $enabled; models = $models }
    Write-StudioOverrides ([pscustomobject]@{ version = 1; providers = @($overrides) })
    if ($Request.PSObject.Properties.Name -contains 'api_key') { Set-StudioCredential $provider ([string]$Request.api_key) }
    $studioConfigCache = $null
    $script:studioConfigCache = $null
    [pscustomobject]@{ ok = $true; provider_id = [string]$provider.id; catalog = (Get-StudioCatalog) }
}

function Invoke-StudioCompletion {
    param($Request)
    $config = Get-StudioConfig
    $provider = Get-StudioProvider $config ([string]$Request.provider_id)
    $mode = Get-StudioConfigEntry $config 'modes' ([string]$Request.mode_id)
    $vector = Get-StudioConfigEntry $config 'vectors' ([string]$Request.vector_id)
    $classification = [string]$Request.data_classification
    if ($classification -notin @('public', 'internal', 'sensitive')) { throw 'Invalid data classification.' }
    $prompt = [string]$Request.prompt
    if ([string]::IsNullOrWhiteSpace($prompt) -or $prompt.Length -gt 32000) { throw 'Prompt must contain 1 to 32000 characters.' }
    if (-not [bool]$provider.enabled) { throw 'Selected provider is disabled.' }
    if ([string]$provider.boundary -eq 'remote' -and $classification -eq 'sensitive') {
        throw 'Sensitive data is local-only and cannot be sent to a remote provider.'
    }
    $catalog = Get-StudioCatalog
    $catalogProvider = @($catalog.providers | Where-Object { $_.id -eq $provider.id })
    if ($catalogProvider.Count -ne 1) { throw 'Selected provider is not present in the Studio catalog.' }
    $catalogProvider = $catalogProvider[0]
    $modelId = [string]$Request.model_id
    if (-not $modelId -or @($catalogProvider.models | Where-Object { $_.id -eq $modelId }).Count -ne 1) {
        throw 'Selected model is not registered or discovered.'
    }
    if ([string]$provider.boundary -eq 'remote' -and -not (Get-StudioCredentialConfigured $provider)) {
        throw 'Provider credential is not configured in the environment.'
    }

    $customVector = [string]$Request.vector_note
    if ($customVector.Length -gt 160) { throw 'Custom vector note is too long.' }
    $system = "$($mode.system)`nProgramming vector: $($vector.label)."
    if ($customVector.Trim()) { $system += "`nAdditional vector: $customVector" }
    if ([bool]$Request.project_context) {
        $project = Get-ProjectSummary
        $system += "`nWorkspace context: NetCity KVP at $($project.root); branch $($project.branch); last commit $($project.last_commit). Do not assume file contents not supplied in the request."
    }
    $messages = @(
        [pscustomobject]@{ role = 'system'; content = $system }
        [pscustomobject]@{ role = 'user'; content = $prompt }
    )
    $started = Get-Date
    $responseText = ''
    $usage = $null
    $credential = Get-StudioCredentialValue $provider
    try {
        switch ([string]$provider.kind) {
            'mock' {
                $responseText = "[KVP local echo] Mode=$($mode.id); vector=$($vector.id); prompt received locally.`n`n$prompt"
            }
            'ollama' {
                $body = [pscustomobject]@{ model = $modelId; messages = $messages; stream = $false; options = [pscustomobject]@{ temperature = 0.2 } } | ConvertTo-Json -Depth 10
                $value = Invoke-StudioHttpJson -Uri "$(([string]$provider.endpoint).TrimEnd('/'))/api/chat" -Method POST -Body $body -TimeoutSec 120
                $responseText = [string]$value.message.content
            }
            'openai_compatible' {
                $headers = @{}
                if ($credential) { $headers.Authorization = "Bearer $credential" }
                $body = [pscustomobject]@{ model = $modelId; messages = $messages; stream = $false; temperature = 0.2 } | ConvertTo-Json -Depth 10
                $value = Invoke-StudioHttpJson -Uri "$(([string]$provider.endpoint).TrimEnd('/'))/chat/completions" -Method POST -Headers $headers -Body $body -TimeoutSec 120
                $responseText = [string]$value.choices[0].message.content
                $usage = $value.usage
            }
            'openai_responses' {
                $headers = @{ Authorization = "Bearer $credential" }
                $body = [pscustomobject]@{ model = $modelId; input = $messages; store = $false } | ConvertTo-Json -Depth 10
                $value = Invoke-StudioHttpJson -Uri "$(([string]$provider.endpoint).TrimEnd('/'))/responses" -Method POST -Headers $headers -Body $body -TimeoutSec 120
                if ($value.output_text) { $responseText = [string]$value.output_text }
                else {
                    $parts = @()
                    foreach ($item in @($value.output)) { foreach ($part in @($item.content)) { if ($part.text) { $parts += [string]$part.text } } }
                    $responseText = ($parts -join "`n")
                }
                $usage = $value.usage
            }
            'anthropic' {
                $headers = @{ 'x-api-key' = $credential; 'anthropic-version' = '2023-06-01' }
                $body = [pscustomobject]@{ model = $modelId; max_tokens = 2048; system = $system; messages = @([pscustomobject]@{ role = 'user'; content = $prompt }) } | ConvertTo-Json -Depth 10
                $value = Invoke-StudioHttpJson -Uri "$(([string]$provider.endpoint).TrimEnd('/'))/v1/messages" -Method POST -Headers $headers -Body $body -TimeoutSec 120
                $parts = @()
                foreach ($part in @($value.content)) { if ($part.text) { $parts += [string]$part.text } }
                $responseText = ($parts -join "`n")
                $usage = $value.usage
            }
            default { throw 'Provider adapter is not implemented.' }
        }
    }
    catch { throw "Provider request failed for $($provider.label). Check its local service, endpoint, model ID, and credential environment." }
    if ([string]::IsNullOrWhiteSpace($responseText)) { throw 'Provider returned an empty response.' }
    if ($responseText.Length -gt 1000000) { $responseText = $responseText.Substring(0, 1000000) }
    [pscustomobject]@{
        ok = $true
        request_id = ([guid]::NewGuid().ToString('n'))
        provider_id = [string]$provider.id
        provider_label = [string]$provider.label
        model_id = $modelId
        mode_id = [string]$mode.id
        vector_id = [string]$vector.id
        boundary = [string]$provider.boundary
        data_classification = $classification
        content = $responseText
        usage = $usage
        latency_ms = [math]::Round(((Get-Date) - $started).TotalMilliseconds, 0)
        warnings = @('Model output is untrusted text; validate code and review side effects before applying changes.')
    }
}

function Test-StudioOrigin {
    param($Context)
    $origin = [string]$Context.Request.Headers['Origin']
    return ([string]::IsNullOrWhiteSpace($origin) -or $allowedOrigins -contains $origin)
}

function Write-JsonResponse {
    param($Context, $Value, [int]$StatusCode = 200)

    $origin = $Context.Request.Headers['Origin']
    if ($allowedOrigins -contains $origin) { $Context.Response.Headers['Access-Control-Allow-Origin'] = $origin }
    $Context.Response.Headers['Vary'] = 'Origin'
    $Context.Response.Headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
    $Context.Response.Headers['Access-Control-Allow-Headers'] = 'Content-Type'
    $Context.Response.StatusCode = $StatusCode
    $Context.Response.ContentType = 'application/json; charset=utf-8'
    $json = $Value | ConvertTo-Json -Depth 10 -Compress
    $bytes = [Text.Encoding]::UTF8.GetBytes($json)
    $Context.Response.ContentLength64 = $bytes.Length
    $Context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    $Context.Response.Close()
}

$listener = [Net.HttpListener]::new()
$listener.Prefixes.Add("http://127.0.0.1:$Port/")
$listener.Start()
if (-not $NoConsole) { Write-Output "KVP ops server listening on http://127.0.0.1:$Port/" }

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        try {
            if ($context.Request.HttpMethod -eq 'OPTIONS') {
                Write-JsonResponse $context ([pscustomobject]@{ ok = $true }) 204
                continue
            }

            $path = $context.Request.Url.AbsolutePath
            if ($path -eq '/api/health') {
                Write-JsonResponse $context ([pscustomobject]@{ ok = $true; service = 'kvp-ops'; port = $Port })
            }
            elseif ($path -eq '/api/telemetry' -and $context.Request.HttpMethod -eq 'GET') {
                Write-JsonResponse $context (Get-OperationalTelemetry)
            }
            elseif ($path -eq '/api/actions' -and $context.Request.HttpMethod -eq 'GET') {
                Write-JsonResponse $context ([pscustomobject]@{ actions = (Get-OperationalTelemetry).actions; history = @($history) })
            }
            elseif ($path -match '^/api/actions/([^/]+)$' -and $context.Request.HttpMethod -eq 'POST') {
                $actionId = [Uri]::UnescapeDataString($Matches[1])
                if (-not (Test-StudioOrigin $context)) { Write-JsonResponse $context ([pscustomobject]@{ error = 'origin_not_allowed' }) 403; continue }
                Write-JsonResponse $context (Invoke-AllowedAction $actionId)
            }
            elseif ($path -eq '/api/studio/catalog' -and $context.Request.HttpMethod -eq 'GET') {
                Write-JsonResponse $context (Get-StudioCatalog)
            }
            elseif ($path -eq '/api/studio/settings' -and $context.Request.HttpMethod -eq 'POST') {
                if (-not (Test-StudioOrigin $context)) { Write-JsonResponse $context ([pscustomobject]@{ error = 'origin_not_allowed' }) 403; continue }
                Write-JsonResponse $context (Update-StudioProviderSettings (Read-StudioJsonBody $context))
            }
            elseif ($path -eq '/api/studio/run' -and $context.Request.HttpMethod -eq 'POST') {
                if (-not (Test-StudioOrigin $context)) { Write-JsonResponse $context ([pscustomobject]@{ error = 'origin_not_allowed' }) 403; continue }
                Write-JsonResponse $context (Invoke-StudioCompletion (Read-StudioJsonBody $context))
            }
            else {
                Write-JsonResponse $context ([pscustomobject]@{ error = 'not_found' }) 404
            }
        }
        catch {
            try { Write-JsonResponse $context ([pscustomobject]@{ error = $_.Exception.Message }) 500 } catch {}
        }
    }
}
finally {
    if ($listener.IsListening) { $listener.Stop() }
    $listener.Close()
}
