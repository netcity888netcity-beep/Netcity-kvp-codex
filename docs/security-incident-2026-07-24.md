# Workstation security incident — 2026-07-24

## Status

**Contained at user level; administrator cleanup is still required.**

The workstation was running an unauthorized XMRig cryptocurrency miner and
contained additional remote-access components. The active miner was stopped,
known payloads were moved out of their launch paths, and reversible directory
sentinels now prevent the known scheduled tasks from recreating executable
files at those paths.

Do not treat browser sessions, stored passwords, access tokens, or SSH keys
used on this workstation as trusted until the administrator cleanup, offline
scan, reboot, and credential rotation are complete.

## Confirmed indicators

- Process window title: `XMRig 6.21.3`.
- Miner SHA-256:
  `E199D88569FB54346D5FA20EE7B59B2EA6F16F4ECCA3EA1E1C937B11AAB7B2B0`.
- The same hash is independently identified as XMRig by
  [ANY.RUN](https://any.run/report/e199d88569fb54346d5fa20ee7b59b2ea6f16f4ecca3ea1e1c937b11aab7b2b0/86fa69f4-5e61-4e9f-9f47-f98a165ef97e)
  and
  [Triage](https://tria.ge/240707-x3szesxbkp/static1).
- `Runtime_Broker.exe` SHA-256:
  `B7F9549AD86339639141DB595DBA3F5A18CB41B5D1905D1BE76AD3D92886462A`;
  an external sandbox classified this sample as malicious Quasar RAT.
- Observed mining-pool traffic: TCP port `3333`, including remote addresses
  `141.94.96.71` and `141.94.96.144` through the local proxy.
- Microsoft Defender event 5007 recorded malware-created exclusions for the
  two payload directories at 02:13 local time.
- A probable installer working directory, `%TEMP%\is-S3MCC.tmp`, was created at
  the same time. It contained an unsigned Inno Setup helper, a full inventory
  of installed/user directories, and `_setup64.tmp` with SHA-256
  `388A796580234EFC95F3B1C70AD4CB44BFDDC7BA0F9203BF4902B9929B136F95`.
  The original parent installer was not recovered, so the initial delivery
  source remains unconfirmed.

## Persistence found

The following scheduled tasks are malicious and require removal from an
elevated administrator session:

| Task | Payload |
| --- | --- |
| `\Microsoft\Windows\Shell\FamilySafetyRefreshingTask` | `%LOCALAPPDATA%\Microsoft\Edge\System\update.exe` |
| `\Microsoft\Windows\MUI\FPRemove` | `%APPDATA%\DriversUpdate\taskhostupdate.exe` |
| `\Microsoft\Windows\MUI\RPRemove` | `%APPDATA%\Microsoft\Crypto\CRC\Runtime.exe` |
| `\Microsoft\Windows\USB\Usb-Notification` | `%APPDATA%\DriversUpdate\Runtime_Broker.exe` |
| `\Microsoft\Windows\ApplicationData\CleanupTemporaryStaticFiles` | cleanup command for the installer drop directory |

Direct disabling failed because the current process is not elevated. Their
payload paths are currently blocked with directory sentinels. At 20:40 and
again at 21:00 the recurring task failed with `0x80070005`; no new XMRig
process or active port-3333 connection was present afterward.

No malicious Run/RunOnce entry, non-standard Windows service, or malicious WMI
event subscription was found during the user-level audit.

## Quarantine

Recoverable samples are stored outside the project repository at:

`%USERPROFILE%\KVP-Security-Quarantine\2026-07-24`

The probable installer working directory is preserved in the
`Installer-is-S3MCC.tmp` subdirectory. Its original temporary path is also
blocked with a directory sentinel.

The project `.gitignore` prevents local credentials, environment files, raw
chat exports, Python caches, and document-source files from entering Git.
Quarantine content is outside the repository and must never be uploaded.

## Required administrator cleanup

Perform these steps locally from an elevated PowerShell session. Do not paste
credentials into that session.

```powershell
$tasks = @(
  @{ Path = '\Microsoft\Windows\Shell\'; Name = 'FamilySafetyRefreshingTask' },
  @{ Path = '\Microsoft\Windows\MUI\'; Name = 'FPRemove' },
  @{ Path = '\Microsoft\Windows\MUI\'; Name = 'RPRemove' },
  @{ Path = '\Microsoft\Windows\USB\'; Name = 'Usb-Notification' },
  @{ Path = '\Microsoft\Windows\ApplicationData\'; Name = 'CleanupTemporaryStaticFiles' }
)

foreach ($task in $tasks) {
  Unregister-ScheduledTask -TaskPath $task.Path -TaskName $task.Name -Confirm:$false
}

Remove-MpPreference -ExclusionPath "$env:LOCALAPPDATA\Microsoft\Edge\System"
Remove-MpPreference -ExclusionPath "$env:APPDATA\DriversUpdate"
```

Then run Microsoft Defender Offline scan from Windows Security, reboot, and run
a full scan. After the clean reboot, verify that the five tasks and both
Defender exclusions are absent before removing the sentinel directories.

## Credential recovery gate

From a separate clean device:

1. Revoke active Telegram, GitHub, email, and other important web sessions.
2. Change passwords and enable phishing-resistant MFA where available.
3. Revoke GitHub personal access tokens, OAuth grants, deploy keys, and SSH keys
   that were accessible from this workstation; create replacements only after
   the workstation is clean.
4. Do not publish or push NetCityOS/KVP until this gate is complete.
