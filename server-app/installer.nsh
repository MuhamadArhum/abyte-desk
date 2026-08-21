; installer.nsh — AByte ERP Server custom NSIS script
; Shown on the installer's finish page to remind users about MariaDB.

!macro customInstall
  ; Nothing extra at install time — DB setup is done inside the app wizard.
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
