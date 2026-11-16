# Baixa o Node.js PORTATIL (zip oficial) para runtime\node. Nao instala nada no Windows.
param([string]$Dest)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'   # deixa o download muito mais rapido no PowerShell 5
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$root    = Split-Path $PSScriptRoot -Parent
$runtime = if ($Dest) { $Dest } else { Join-Path $root 'runtime' }
$target  = Join-Path $runtime 'node'
$arch    = if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64') { 'arm64' } else { 'x64' }

New-Item -ItemType Directory -Force -Path $runtime | Out-Null

$index   = Invoke-RestMethod 'https://nodejs.org/dist/index.json'
$version = ($index | Where-Object { $_.lts } | Select-Object -First 1).version
$name    = "node-$version-win-$arch"
$zip     = Join-Path $runtime "$name.zip"

Write-Host "   Baixando Node.js $version ($arch)..."
Invoke-WebRequest "https://nodejs.org/dist/$version/$name.zip" -OutFile $zip -UseBasicParsing

Write-Host '   Extraindo...'
if (Test-Path $target) { Remove-Item $target -Recurse -Force }
Expand-Archive -Path $zip -DestinationPath $runtime -Force
Rename-Item (Join-Path $runtime $name) 'node'
Remove-Item $zip -Force
Write-Host "   Node.js $version pronto em $target"
