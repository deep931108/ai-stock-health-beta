$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$ProjectRoot = Split-Path -Parent $Root
$Python = Join-Path $ProjectRoot ".venv\Scripts\python.exe"
$env:AI_STOCK_ROOT = $ProjectRoot
$env:AI_STOCK_BETA_REQUIRE_INVITE = "0"
Push-Location $Root
try {
    & $Python -m pytest tests -q
} finally {
    Pop-Location
}
