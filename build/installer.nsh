; DevForge's additions to the installer (electron-builder loads build/installer.nsh by itself).
;
; « Redémarrer et mettre à jour » runs the installer with --updated (electron-updater). It used
; to run it silently: DevForge closed and nothing showed until it came back. Now the installer
; shows only its progress page, then starts DevForge again by itself. A first install keeps
; every page (who to install for, folder, « Lancer DevForge »).

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
