#define AppVersion "0.1.0"
#define SourceRoot "..\release"

[Setup]
AppId={{D0B5B1DA-9D2D-49AA-ABF1-7B7D5B8D8F11}
AppName=NetCity KVP
AppVersion={#AppVersion}
AppPublisher=NetCity KVP
DefaultDirName={localappdata}\Programs\NetCity KVP
DefaultGroupName=NetCity KVP
OutputDir=..\release-installer
OutputBaseFilename=NetCity-KVP-Setup-{#AppVersion}
UninstallDisplayName=NetCity KVP
UninstallDisplayIcon={app}\NetCity-KVP-portable.exe
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
PrivilegesRequired=lowest
DisableProgramGroupPage=yes
WizardStyle=modern
Compression=lzma2/max
SolidCompression=yes
CloseApplications=yes
RestartApplications=no

[Files]
Source: "{#SourceRoot}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{autodesktop}\NetCity KVP Model Studio"; Filename: "{app}\NetCity-KVP-portable.exe"; Parameters: "--surface=studio"; WorkingDir: "{app}"; Comment: "NetCity KVP Model Studio"
Name: "{autodesktop}\NetCity KVP Ops HUD"; Filename: "{app}\NetCity-KVP-portable.exe"; Parameters: "--surface=ops"; WorkingDir: "{app}"; Comment: "NetCity KVP Ops HUD"
Name: "{group}\NetCity KVP Model Studio"; Filename: "{app}\NetCity-KVP-portable.exe"; Parameters: "--surface=studio"; WorkingDir: "{app}"
Name: "{group}\NetCity KVP Ops HUD"; Filename: "{app}\NetCity-KVP-portable.exe"; Parameters: "--surface=ops"; WorkingDir: "{app}"

[Run]
Filename: "{app}\NetCity-KVP-portable.exe"; Parameters: "--surface=studio"; Description: "Запустить NetCity KVP Model Studio"; Flags: nowait postinstall skipifsilent
