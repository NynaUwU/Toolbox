@echo off
chcp 65001 >nul
title Toolbox
cd /d "%~dp0"

echo.
echo   ==============================
echo             T O O L B O X
echo   ==============================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo   Node.js nao encontrado. Instalando via winget...
  winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
  echo.
  echo   Feche esta janela e abra o Toolbox.bat novamente.
  pause
  exit /b
)

where git >nul 2>nul
if errorlevel 1 (
  echo   Git nao encontrado: atualizacoes automaticas desativadas.
  echo   Para ativar:  winget install -e --id Git.Git
) else (
  echo   Procurando atualizacoes no GitHub...
  git pull --ff-only --quiet
)

call npm install --omit=dev --no-audit --no-fund --loglevel=error
node scripts/setup.mjs --auto

set OPEN=--open
:loop
node server.mjs %OPEN%
set CODE=%errorlevel%
set OPEN=
rem Codigo 42 = atualizacao aplicada, reinicia
if "%CODE%"=="42" (
  call npm install --omit=dev --no-audit --no-fund --loglevel=error
  goto loop
)
echo.
echo   Servidor encerrado.
pause
