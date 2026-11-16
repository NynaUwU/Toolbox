@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"

rem Uma atualizacao pode ter trazido um Toolbox.bat novo: troca e reinicia por ele
if exist "Toolbox.bat.new" ( move /y "Toolbox.bat.new" "Toolbox.bat" >nul & "%~dp0Toolbox.bat" %* & exit /b )

title Toolbox
echo.
echo   ==============================
echo            T O O L B O X
echo   ==============================
echo   Tudo fica dentro desta pasta - nada e instalado no Windows.
echo.

set "NODE=%~dp0runtime\node\node.exe"
if not exist "%NODE%" (
  echo   Baixando Node.js portatil - so na primeira vez...
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\get-node.ps1"
)
if not exist "%NODE%" (
  echo.
  echo   Nao foi possivel baixar o Node.js. Verifique a internet e tente de novo.
  pause
  exit /b 1
)

"%NODE%" scripts\setup.mjs

set "OPEN=--open"
if "%~1"=="--restart" set "OPEN="
"%NODE%" server.mjs %OPEN%

rem Codigo 42 = atualizacao aplicada: reabre pelo .bat (que pode ter sido atualizado)
if "%errorlevel%"=="42" ( "%~f0" --restart )

echo.
echo   Servidor encerrado.
pause
