# Converte documentos usando o Microsoft Office JA instalado no PC (automacao COM).
# Uso: powershell -File office.ps1 -App Word|Excel|PowerPoint -In <arquivo> -Out <arquivo> -Target <ext>
param(
  [Parameter(Mandatory)][string]$App,
  [Parameter(Mandatory)][string]$In,
  [Parameter(Mandatory)][string]$Out,
  [Parameter(Mandatory)][string]$Target
)
$ErrorActionPreference = 'Stop'
$In = (Resolve-Path -LiteralPath $In).Path

function Release($o) { if ($o) { [void][Runtime.InteropServices.Marshal]::ReleaseComObject($o) } }

switch ($App) {
  'Word' {
    # WdSaveFormat
    $codes = @{ pdf = 17; docx = 16; doc = 0; odt = 23; rtf = 6; txt = 7; html = 10 }
    $w = New-Object -ComObject Word.Application
    try {
      $w.Visible = $false
      $w.DisplayAlerts = 0
      # Open(FileName, ConfirmConversions, ReadOnly, AddToRecentFiles)
      $doc = $w.Documents.Open($In, $false, $true, $false)
      $doc.SaveAs2($Out, $codes[$Target])
      $doc.Close(0)
      Release $doc
    } finally { $w.Quit(0); Release $w }
  }
  'Excel' {
    # XlFileFormat
    $codes = @{ xlsx = 51; ods = 60; csv = 62; html = 44 }
    $x = New-Object -ComObject Excel.Application
    try {
      $x.Visible = $false
      $x.DisplayAlerts = $false
      $wb = $x.Workbooks.Open($In, 0, $true)
      if ($Target -eq 'pdf') { $wb.ExportAsFixedFormat(0, $Out) } else { $wb.SaveAs($Out, $codes[$Target]) }
      $wb.Close($false)
      Release $wb
    } finally { $x.Quit(); Release $x }
  }
  'PowerPoint' {
    # PpSaveAsFileType
    $codes = @{ pdf = 32; pptx = 24; odp = 35 }
    $p = New-Object -ComObject PowerPoint.Application
    try {
      # Open(FileName, ReadOnly=msoTrue, Untitled=msoFalse, WithWindow=msoFalse)
      $pres = $p.Presentations.Open($In, -1, 0, 0)
      if ($Target -eq 'png') { $pres.Slides.Item(1).Export($Out, 'PNG') } else { $pres.SaveAs($Out, $codes[$Target]) }
      $pres.Close()
      Release $pres
    } finally { $p.Quit(); Release $p }
  }
  default { throw "App desconhecido: $App" }
}
if (-not (Test-Path -LiteralPath $Out)) { throw "O Office nao gerou o arquivo de saida." }
