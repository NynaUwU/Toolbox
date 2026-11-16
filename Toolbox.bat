@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"

rem Tudo que a Toolbox grava fica em Output\ (arquivos) e Output\_sistema\ (ferramentas e dados).
set "SYS=%~dp0Output\_sistema"
if not exist "%SYS%" mkdir "%SYS%"

rem Uma atualizacao pode ter trazido um Toolbox.bat novo: troca e reinicia por ele
if exist "%SYS%\Toolbox.bat.new" ( move /y "%SYS%\Toolbox.bat.new" "%~dp0Toolbox.bat" >nul & "%~dp0Toolbox.bat" %* & exit /b )

rem Migracao de versoes antigas: pastas que ficavam na raiz vao para Output\_sistema
for %%D in (runtime bin data) do (
  if exist "%~dp0%%D\" if not exist "%SYS%\%%D\" move "%~dp0%%D" "%SYS%\%%D" >nul
)
if exist "%~dp0tmp\" rmdir /s /q "%~dp0tmp"
if exist "%~dp0Toolbox.bat.new" del /q "%~dp0Toolbox.bat.new"

title Toolbox
echo.
echo   ==============================
echo            T O O L B O X
echo   ==============================
echo   Tudo fica dentro desta pasta - nada e instalado no Windows.
echo   Seus arquivos: Output\
echo.

set "NODE=%SYS%\runtime\node\node.exe"
if not exist "%NODE%" (
  echo   Baixando Node.js portatil - so na primeira vez...
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\get-node.ps1" -Dest "%SYS%\runtime"
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
