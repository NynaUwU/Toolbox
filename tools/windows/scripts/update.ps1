# Atualizacao forcada do Windows - baixa o script e executa como administrador
$d = 'C:\ProgramData\WinUpdateHelper'
New-Item -ItemType Directory -Force -Path $d | Out-Null
$f = Join-Path $d 'Update-Windows.ps1'
Invoke-WebRequest 'https://raw.githubusercontent.com/NynaUwU/Toolbox/refs/heads/claude/zen-keller-ibizxy/tools/windows/scripts/Update-Windows.ps1' -OutFile $f -UseBasicParsing
Start-Process powershell.exe -Verb RunAs -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$f`""
