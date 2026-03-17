param(
  [string]$SourcePath = "C:\Users\Domi\Downloads\Mapping Actividades SUMMAX.xlsx",
  [string]$DestinationPath = "C:\Users\Domi\Downloads\Mapping Actividades SUMMAX - propuesta.xlsx"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.IO.Compression.FileSystem

function Escape-XmlText {
  param([string]$Value)

  if ($null -eq $Value) {
    return ""
  }

  return [System.Security.SecurityElement]::Escape($Value)
}

function Get-ColumnName {
  param([int]$Index)

  $name = ""
  $current = $Index
  while ($current -gt 0) {
    $current--
    $name = [char](65 + ($current % 26)) + $name
    $current = [math]::Floor($current / 26)
  }
  return $name
}

function New-InlineCell {
  param(
    [int]$ColumnIndex,
    [int]$RowIndex,
    [string]$Value
  )

  $cellRef = "{0}{1}" -f (Get-ColumnName $ColumnIndex), $RowIndex
  $escaped = Escape-XmlText $Value
  return "<c r=`"$cellRef`" t=`"inlineStr`"><is><t xml:space=`"preserve`">$escaped</t></is></c>"
}

function New-WorksheetXml {
  param([object[][]]$Rows)

  $rowXml = New-Object System.Collections.Generic.List[string]
  for ($rowIndex = 0; $rowIndex -lt $Rows.Count; $rowIndex++) {
    $cells = New-Object System.Collections.Generic.List[string]
    for ($columnIndex = 0; $columnIndex -lt $Rows[$rowIndex].Count; $columnIndex++) {
      $value = [string]$Rows[$rowIndex][$columnIndex]
      if ([string]::IsNullOrEmpty($value)) {
        continue
      }
      $cells.Add((New-InlineCell -ColumnIndex ($columnIndex + 1) -RowIndex ($rowIndex + 1) -Value $value))
    }
    $rowNumber = $rowIndex + 1
    $rowXml.Add("<row r=`"$rowNumber`" spans=`"1:5`">$($cells -join '')</row>")
  }

  $lastRow = $Rows.Count
  $dimension = "A1:E{0}" -f $lastRow

  return @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <dimension ref="$dimension"/>
  <sheetViews>
    <sheetView workbookViewId="0"/>
  </sheetViews>
  <sheetFormatPr defaultRowHeight="15"/>
  <cols>
    <col min="1" max="1" width="18" customWidth="1"/>
    <col min="2" max="2" width="28" customWidth="1"/>
    <col min="3" max="3" width="24" customWidth="1"/>
    <col min="4" max="4" width="28" customWidth="1"/>
    <col min="5" max="5" width="48" customWidth="1"/>
  </cols>
  <sheetData>
    $($rowXml -join "`n    ")
  </sheetData>
  <pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>
</worksheet>
"@
}

if (-not (Test-Path -LiteralPath $SourcePath)) {
  throw "No se encontro el archivo origen: $SourcePath"
}

$workRoot = Join-Path $env:TEMP ("summax_excel_" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $workRoot | Out-Null

try {
  [System.IO.Compression.ZipFile]::ExtractToDirectory($SourcePath, $workRoot)

  $rows = @(
    @("PROPUESTA DE MODELO", "", "", "", ""),
    @("Jerarquia propuesta: Estado del Lead > Actividad > Tarea", "", "", "", ""),
    @("", "", "", "", ""),
    @("ESTADO DEL LEAD", "", "", "", ""),
    @("EstadoLeadID", "Nombre", "EstadoLeadPrevio", "EsTerminal", "Notas"),
    @("1", "Pendiente de contactar", "", "NO", "Inicio del pipeline"),
    @("2", "En contacto", "Pendiente de contactar", "NO", "Seguimiento comercial"),
    @("3", "Documentacion inicial", "En contacto", "NO", "Envio y revision de documentacion"),
    @("4", "NDA", "Documentacion inicial", "NO", "Firma y rehacer NDA si hace falta"),
    @("5", "Pagina web", "NDA", "NO", "Acceso y uso de la web de financiacion"),
    @("6", "Contrato", "Pagina web", "NO", "LOI, due diligence y contrato"),
    @("7", "Ingreso en cuenta", "Contrato", "SI", "Cobro parcial o completo"),
    @("8", "Descartado", "", "SI", "Estado terminal global; puede saltar desde cualquier estado"),
    @("", "", "", "", ""),
    @("ACTIVIDAD", "", "", "", ""),
    @("ActividadID", "EstadoLeadID", "Actividad", "ActividadPrevia", "Notas"),
    @("1", "1", "Contacto comercial inicial", "", "Parent de tareas de primer contacto"),
    @("2", "2", "Seguimiento comercial", "Contacto comercial inicial", "Parent de contacto y seguimiento"),
    @("3", "3", "Gestion documentacion inicial", "Seguimiento comercial", "Parent del envio y feedback documental"),
    @("4", "4", "Gestion NDA", "Gestion documentacion inicial", "Parent del ciclo NDA"),
    @("5", "5", "Acceso y gestion web", "Gestion NDA", "Parent del uso de la web"),
    @("6", "6", "Proceso LOI", "Acceso y gestion web", "Parent de envio y firma LOI"),
    @("7", "6", "Due Diligence", "Proceso LOI", "Actividad independiente dentro de Contrato"),
    @("8", "6", "Contrato de financiacion", "Due Diligence", "Parent del ciclo contractual"),
    @("9", "7", "Registro de cobros", "Contrato de financiacion", "Parent del registro en cuenta"),
    @("10", "8", "Cierre descartado", "", "Puede activarse desde cualquier estado"),
    @("", "", "", "", ""),
    @("TAREA", "", "", "", ""),
    @("TareaID", "ActividadID", "Tarea", "TareaPrevia", "Notas"),
    @("1", "1", "Contactar", "", "Estado del lead sugerido: Pendiente de contactar"),
    @("2", "2", "Contactado", "", "Cambio a En contacto"),
    @("3", "2", "2ndo contacto", "Contactado", "Mantiene En contacto"),
    @("4", "2", "Interes en documentacion", "Contactado", "Prepara paso a Documentacion inicial"),
    @("5", "3", "Enviar documentacion inicial", "Interes en documentacion", "Cambio a Documentacion inicial"),
    @("6", "3", "Pendiente feedback doc. inicial", "Enviar documentacion inicial", "Mantiene Documentacion inicial"),
    @("7", "4", "Interes en firmar NDA", "Pendiente feedback doc. inicial", "Cambio a NDA"),
    @("8", "4", "Realizar NDA", "Interes en firmar NDA", "Mantiene NDA"),
    @("9", "4", "NDA enviado", "Realizar NDA", "Mantiene NDA"),
    @("10", "4", "Rehacer NDA", "NDA enviado", "Reiteracion dentro del ciclo NDA"),
    @("11", "4", "NDA firmado", "NDA enviado", "Cierra ciclo NDA"),
    @("12", "5", "Acceso web financiacion enviado", "", "Cambio a Pagina web"),
    @("13", "5", "Cuestiones relacionadas con la web", "Acceso web financiacion enviado", "Mantiene Pagina web"),
    @("14", "5", "Interes financiacion confirmado", "Cuestiones relacionadas con la web", "Prepara Contrato"),
    @("15", "6", "Envio LOI", "", "Inicio de actividad Proceso LOI"),
    @("16", "6", "Feedback LOI", "Envio LOI", "Mantiene Contrato"),
    @("17", "6", "Rehacer LOI", "Feedback LOI", "Reiteracion dentro de LOI"),
    @("18", "6", "LOI firmada", "Feedback LOI", "Habilita Due Diligence"),
    @("19", "7", "Due Diligence", "LOI firmada", "Actividad dedicada"),
    @("20", "8", "Contrato de financiacion enviado", "", "Inicio del ciclo contractual"),
    @("21", "8", "Negociacion contrato", "Contrato de financiacion enviado", "Mantiene Contrato"),
    @("22", "8", "Contrato de financiacion firmado", "Negociacion contrato", "Prepara ingreso en cuenta"),
    @("23", "9", "Anticipo en cuenta registrado", "Contrato de financiacion firmado", "Cambio a Ingreso en cuenta"),
    @("24", "9", "Pago completo en cuenta registrado", "Anticipo en cuenta registrado", "Cierre financiero"),
    @("25", "10", "No interesado", "", "Cambio a Descartado"),
    @("", "", "", "", ""),
    @("NOTAS", "", "", "", ""),
    @("1", "Producto financiero de interes", "Campo separado", "", "No modelarlo como tarea; mejor tabla/catalogo aparte"),
    @("2", "Descartado", "Estado global", "", "No depende de la cadena secuencial normal"),
    @("3", "Regla funcional", "Tarea depende de Actividad", "", "Cada tarea debe tener ActividadID obligatorio")
  )

  $newSheetPath = Join-Path $workRoot "xl\worksheets\sheet3.xml"
  $worksheetXml = New-WorksheetXml -Rows $rows
  [System.IO.File]::WriteAllText($newSheetPath, $worksheetXml, [System.Text.Encoding]::UTF8)

  $contentTypesPath = Join-Path $workRoot "[Content_Types].xml"
  $contentTypes = [System.IO.File]::ReadAllText($contentTypesPath)
  $contentTypes = $contentTypes.Replace(
    "</Types>",
    '<Override PartName="/xl/worksheets/sheet3.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>'
  )
  [System.IO.File]::WriteAllText($contentTypesPath, $contentTypes, [System.Text.Encoding]::UTF8)

  $workbookRelsPath = Join-Path $workRoot "xl\_rels\workbook.xml.rels"
  $workbookRels = [System.IO.File]::ReadAllText($workbookRelsPath)
  $workbookRels = $workbookRels.Replace(
    "</Relationships>",
    '<Relationship Id="rId6" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet3.xml"/></Relationships>'
  )
  [System.IO.File]::WriteAllText($workbookRelsPath, $workbookRels, [System.Text.Encoding]::UTF8)

  $workbookPath = Join-Path $workRoot "xl\workbook.xml"
  $workbook = [System.IO.File]::ReadAllText($workbookPath)
  $workbook = $workbook.Replace(
    "</sheets>",
    '<sheet name="Propuesta Modelo" sheetId="3" r:id="rId6"/></sheets>'
  )
  [System.IO.File]::WriteAllText($workbookPath, $workbook, [System.Text.Encoding]::UTF8)

  $appPath = Join-Path $workRoot "docProps\app.xml"
  $appXml = [System.IO.File]::ReadAllText($appPath)
  $appXml = $appXml.Replace("<vt:i4>2</vt:i4>", "<vt:i4>3</vt:i4>")
  $appXml = $appXml.Replace(
    '<vt:vector size="2" baseType="lpstr"><vt:lpstr>Actividades</vt:lpstr><vt:lpstr>Estado</vt:lpstr></vt:vector>',
    '<vt:vector size="3" baseType="lpstr"><vt:lpstr>Actividades</vt:lpstr><vt:lpstr>Estado</vt:lpstr><vt:lpstr>Propuesta Modelo</vt:lpstr></vt:vector>'
  )
  [System.IO.File]::WriteAllText($appPath, $appXml, [System.Text.Encoding]::UTF8)

  if (Test-Path -LiteralPath $DestinationPath) {
    Remove-Item -LiteralPath $DestinationPath -Force
  }

  $zip = [System.IO.Compression.ZipFile]::Open($DestinationPath, [System.IO.Compression.ZipArchiveMode]::Create)
  try {
    $rootPrefix = $workRoot.TrimEnd("\") + "\"
    foreach ($file in Get-ChildItem -LiteralPath $workRoot -Recurse -File) {
      $entryName = $file.FullName.Substring($rootPrefix.Length).Replace("\", "/")
      [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $file.FullName, $entryName) | Out-Null
    }
  }
  finally {
    $zip.Dispose()
  }

  Write-Output "Archivo generado: $DestinationPath"
}
finally {
  if (Test-Path -LiteralPath $workRoot) {
    Remove-Item -LiteralPath $workRoot -Recurse -Force
  }
}
