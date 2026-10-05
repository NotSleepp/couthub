param(
  [Parameter(Mandatory=$true)]
  [ValidateRange(1,9999)]
  [int]$Slot,
  [string]$ProjectPath
)

$ErrorActionPreference = 'Stop'
if (-not $env:APPDATA) { throw 'Windows no ha definido APPDATA.' }
$profile = Join-Path $env:APPDATA ('AccountHub\codex-profiles\codex-' + $Slot.ToString('00'))
if ([string]::IsNullOrWhiteSpace($ProjectPath)) { $ProjectPath = (Get-Location).Path }
if (-not (Test-Path -LiteralPath $ProjectPath -PathType Container)) {
  throw ('No existe la carpeta de trabajo: ' + $ProjectPath)
}
$ProjectPath = (Resolve-Path -LiteralPath $ProjectPath).Path
New-Item -ItemType Directory -Path $profile -Force | Out-Null
$env:CODEX_HOME = $profile
foreach ($name in @('OPENAI_API_KEY','CODEX_API_KEY','OPENAI_BASE_URL','ELECTRON_RUN_AS_NODE')) {
  Remove-Item ('Env:' + $name) -ErrorAction SilentlyContinue
}
$codex = Get-Command codex -ErrorAction SilentlyContinue
if (-not $codex) { throw 'No se encontró Codex CLI en PATH. Instalalo antes de usar este acceso directo.' }
Set-Location -LiteralPath $ProjectPath
$Host.UI.RawUI.WindowTitle = 'Account Hub · Codex #' + $Slot
Write-Host ('CODEX_HOME: ' + $profile) -ForegroundColor Cyan
& $codex.Source -c 'cli_auth_credentials_store="file"'
