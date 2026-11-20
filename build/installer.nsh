; DevForge's additions to the installer (electron-builder loads build/installer.nsh by itself).
;
; « Redémarrer et mettre à jour » runs the installer silently with --updated (electron-updater):
; no installer window, DevForge shows its own small window while it installs, then starts again
; (src/main/services/updates/installWindow.ts). A first install keeps every page (who to install
; for, folder, « Lancer DevForge »).

; Is DevForge still running? electron-builder asks PowerShell (Get-CimInstance); on some PCs
; PowerShell never answers, and the update then waited forever, out of sight. The same check
; and the same closing, through tasklist and taskkill only. No label: electron-builder inserts
; this macro more than once in the same section.
!macro customCheckAppRunning
  ${if} ${isUpdated}
    ; DevForge is quitting on its own: give it a moment
    Sleep 500
  ${endif}
  StrCpy $R1 0
  ${Do}
    nsExec::Exec `"$CmdPath" /C tasklist /FI "USERNAME eq %USERNAME%" /FI "IMAGENAME eq ${APP_EXECUTABLE_FILENAME}" /FO CSV /NH | "$SYSDIR\findstr.exe" /B /I /C:"\"${APP_EXECUTABLE_FILENAME}\""`
    Pop $R0
    ${IfThen} $R0 != 0 ${|} ${ExitDo} ${|}
    ${if} $R1 == 0
    ${andIfNot} ${isUpdated}
      ; A first install or an uninstall while DevForge is open: ask before closing it
      MessageBox MB_OKCANCEL|MB_ICONEXCLAMATION "$(appRunning)" /SD IDOK IDOK +2
      Quit
    ${endif}
    DetailPrint "$(appClosing)"
    ${if} $R1 < 2
      nsExec::Exec `"$CmdPath" /C taskkill /IM "${APP_EXECUTABLE_FILENAME}" /FI "USERNAME eq %USERNAME%"`
    ${else}
      nsExec::Exec `"$CmdPath" /C taskkill /F /IM "${APP_EXECUTABLE_FILENAME}" /FI "USERNAME eq %USERNAME%"`
    ${endif}
    Pop $R0
    Sleep 1000
    IntOp $R1 $R1 + 1
    ${if} $R1 > 8
      ; Still there (run as administrator?): the user closes it, or gives up
      MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "$(appCannotBeClosed)" /SD IDCANCEL IDRETRY +2
      Quit
      StrCpy $R1 2
    ${endif}
  ${Loop}
!macroend

; An update does not ask again who DevForge is installed for when there is only one installation
; (read at startup by the installer, /allusers and /currentuser included). With both (installed for
; everyone, then for oneself), the question stays: it is the one case where the answer is not obvious.
!macro customInstallMode
  ${if} ${isUpdated}
    ${if} $hasPerUserInstallation == "1"
    ${andIf} $hasPerMachineInstallation == "0"
      StrCpy $isForceCurrentInstall "1"
    ${elseIf} $hasPerUserInstallation == "0"
    ${andIf} $hasPerMachineInstallation == "1"
      StrCpy $isForceMachineInstall "1"
    ${endIf}
  ${endif}
!macroend

; A real uninstall (not the one an update runs) also removes what DevForge left outside its folder:
; the downloaded updates and the « start with Windows » entry. The data (%APPDATA%\DevForge) stays:
; Settings › Data › Erase everything removes it first, as the uninstall page of the docs says.
!macro customUnInstall
  ${ifNot} ${isUpdated}
    SetShellVarContext current
    RMDir /r "$LOCALAPPDATA\devforge-updater"
    DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "com.devforge.app"
    ${if} $installMode == "all"
      SetShellVarContext all
    ${endif}
  ${endif}
!macroend

; An update shows only the progress page: its header says what is happening, in the installer's language
!macro customPageAfterChangeDir
  !define MUI_PAGE_CUSTOMFUNCTION_SHOW devforgeInstFilesShow
  Function devforgeInstFilesShow
    ${if} ${isUpdated}
      ${if} $LANGUAGE == 1036
        !insertmacro MUI_HEADER_TEXT "Mise à jour de DevForge" "Installation de la version ${VERSION}. DevForge se relance tout seul à la fin."
      ${else}
        !insertmacro MUI_HEADER_TEXT "Updating DevForge" "Installing version ${VERSION}. DevForge starts again by itself when it is done."
      ${endif}
    ${endif}
  FunctionEnd
!macroend

; The last page: « Lancer DevForge » after a first install; an update skips it and starts DevForge at once
!macro customFinishPage
  Function devforgeStartApp
    ${if} ${isUpdated}
      StrCpy $1 "--updated"
    ${else}
      StrCpy $1 ""
    ${endif}
    ${StdUtils.ExecShellAsUser} $0 "$launchLink" "open" "$1"
  FunctionEnd

  Function devforgeSkipFinishOnUpdate
    ${if} ${isUpdated}
      HideWindow
      Call devforgeStartApp
      Abort
    ${endif}
  FunctionEnd

  !define MUI_FINISHPAGE_RUN
  !define MUI_FINISHPAGE_RUN_FUNCTION "devforgeStartApp"
  !define MUI_PAGE_CUSTOMFUNCTION_PRE devforgeSkipFinishOnUpdate
  !insertmacro MUI_PAGE_FINISH
!macroend
