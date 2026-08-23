; installer.nsh — AByte ERP Server custom NSIS script

!macro customInstall
  ; Check if MariaDB or MySQL service exists
  nsExec::ExecToStack 'sc query MariaDB'
  Pop $0
  ${If} $0 != 0
    nsExec::ExecToStack 'sc query MySQL'
    Pop $0
  ${EndIf}
  ${If} $0 != 0
    nsExec::ExecToStack 'sc query MySQL80'
    Pop $0
  ${EndIf}

  ; If no DB service found, inform the user — the app wizard will handle install
  ${If} $0 != 0
    MessageBox MB_ICONINFORMATION|MB_OK \
      "MariaDB (database engine) was not detected on this PC.$\n$\nAfter the installer finishes, AByte ERP Server will open a setup wizard that can automatically download and install MariaDB 10.11 LTS for you with one click.$\n$\nInternet connection is required for that step."
  ${EndIf}
!macroend

!macro customUnInstall
  ; Nothing extra at uninstall time.
!macroend

!macro customWelcomePage
  ; Override welcome page header
!macroend

!macro customFinishPage
  ; Add a note on the finish page
  !define MUI_FINISHPAGE_SHOWREADME_NOTCHECKED
  !define MUI_FINISHPAGE_SHOWREADME "$INSTDIR\SETUP_GUIDE.txt"
  !define MUI_FINISHPAGE_SHOWREADME_TEXT "View MariaDB Setup Guide"
!macroend
