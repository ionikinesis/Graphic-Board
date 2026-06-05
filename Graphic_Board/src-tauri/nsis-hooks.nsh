; NSIS_HOOK_POSTINSTALL runs after all files are extracted and registry keys are
; written, but still within the install section.
;
; Problem this solves: when upgrading an existing install, Tauri's NSIS script
; sets $UpdateMode = 1 and the CreateOrUpdateDesktopShortcut / Start Menu functions
; return early without touching the existing shortcuts.  The old shortcuts keep
; their cached icon (the default Tauri logo) even though the exe now has the
; correct icon embedded.
;
; Fix: recreate every shortcut we find with an explicit path to icon.ico, which
; was installed into $INSTDIR via bundle.resources.  An explicit icon path means
; Windows can never confuse it with a stale cache entry for the exe path.

!macro NSIS_HOOK_POSTINSTALL
  ${If} ${FileExists} "$INSTDIR\icon.ico"

    ; --- Desktop shortcut ---
    ${If} ${FileExists} "$DESKTOP\${PRODUCTNAME}.lnk"
      Delete "$DESKTOP\${PRODUCTNAME}.lnk"
      CreateShortcut "$DESKTOP\${PRODUCTNAME}.lnk" \
        "$INSTDIR\${MAINBINARYNAME}.exe" "" "$INSTDIR\icon.ico" 0
      !insertmacro SetLnkAppUserModelId "$DESKTOP\${PRODUCTNAME}.lnk"
    ${EndIf}

    ; --- Start Menu shortcuts (two possible locations) ---
    ${If} ${FileExists} "$SMPROGRAMS\$AppStartMenuFolder\${PRODUCTNAME}.lnk"
      Delete "$SMPROGRAMS\$AppStartMenuFolder\${PRODUCTNAME}.lnk"
      CreateShortcut "$SMPROGRAMS\$AppStartMenuFolder\${PRODUCTNAME}.lnk" \
        "$INSTDIR\${MAINBINARYNAME}.exe" "" "$INSTDIR\icon.ico" 0
      !insertmacro SetLnkAppUserModelId "$SMPROGRAMS\$AppStartMenuFolder\${PRODUCTNAME}.lnk"
    ${EndIf}

    ${If} ${FileExists} "$SMPROGRAMS\${PRODUCTNAME}.lnk"
      Delete "$SMPROGRAMS\${PRODUCTNAME}.lnk"
      CreateShortcut "$SMPROGRAMS\${PRODUCTNAME}.lnk" \
        "$INSTDIR\${MAINBINARYNAME}.exe" "" "$INSTDIR\icon.ico" 0
      !insertmacro SetLnkAppUserModelId "$SMPROGRAMS\${PRODUCTNAME}.lnk"
    ${EndIf}

  ${EndIf}
!macroend
