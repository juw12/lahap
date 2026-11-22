; Lahap for Windows - per-user installer (no admin rights). build.py compiles it with:
;   iscc /DAppVersion=1.0.0 /DSourceDir=<dist\Lahap> /DOutputDir=<dist> /DIconFile=<build\lahap.ico> lahap.iss
; Installs to %LOCALAPPDATA%\Programs\Lahap, adds Lahap to the Start menu (and optionally the desktop) and lists it
; in Settings > Apps. The window keeps its data (what you saved in it) in %LOCALAPPDATA%\Lahap, which
; uninstalling leaves in place so a reinstall finds it again.

#ifndef AppVersion
  #define AppVersion "1.0.0"
#endif
#ifndef SourceDir
  #define SourceDir "dist\Lahap"
#endif
#ifndef OutputDir
  #define OutputDir "dist"
#endif
#ifndef IconFile
  #define IconFile "build\lahap.ico"
#endif

[Setup]
AppId={{E81247BA-698B-569E-A6DE-E1E1C366EEFB}
AppName=Lahap
AppVersion={#AppVersion}
AppVerName=Lahap {#AppVersion}
AppPublisher=Juwen Lie
AppPublisherURL=https://juw12.github.io/lahap/
AppSupportURL=https://github.com/juw12/lahap
DefaultDirName={autopf}\Lahap
DisableDirPage=yes
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
OutputDir={#OutputDir}
OutputBaseFilename=Lahap-Windows-Setup
SetupIconFile={#IconFile}
UninstallDisplayIcon={app}\Lahap.exe
UninstallDisplayName=Lahap
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
CloseApplications=no
SetupLogging=yes

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"

[Files]
Source: "{#SourceDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{userprograms}\Lahap"; Filename: "{app}\Lahap.exe"; Comment: "Private food diary: cut-outs, stamp book, collections, food map"
Name: "{userdesktop}\Lahap"; Filename: "{app}\Lahap.exe"; Comment: "Private food diary: cut-outs, stamp book, collections, food map"; Tasks: desktopicon

[Run]
Filename: "{app}\Lahap.exe"; Description: "{cm:LaunchProgram,Lahap}"; Flags: nowait postinstall skipifsilent

[UninstallRun]
Filename: "{app}\Lahap.exe"; Parameters: "--stop"; Flags: runhidden waituntilterminated; RunOnceId: "StopLahap"

[Code]
function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  ResultCode: Integer;
begin
  Result := '';
  { Updating: close an open Lahap window first so its files can be replaced. }
  if FileExists(ExpandConstant('{app}\Lahap.exe')) then
    Exec(ExpandConstant('{app}\Lahap.exe'), '--stop', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
end;
