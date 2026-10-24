; NSIS-інсталятор — лише «рушій» установки: його вікна користувач не бачить, їх замінює власне вікно (installer/Installer.cs), яке запускає
; цей інсталятор тихо (/S). Тут лишається тільки правило режиму: нова установка завжди лише для поточного користувача (без прав
; адміністратора), а вже наявна установка для всіх користувачів оновлюється на місці.

!define MUI_BGCOLOR 161C18
!define MUI_TEXTCOLOR E6EDE8

!macro customInstallMode
  ${If} $hasPerMachineInstallation == "1"
    StrCpy $isForceMachineInstall "1"
  ${Else}
    StrCpy $isForceCurrentInstall "1"
  ${EndIf}
!macroend
