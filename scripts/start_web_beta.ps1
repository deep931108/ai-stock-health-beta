$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$ProjectRoot = Split-Path -Parent $Root
$Python = Join-Path $ProjectRoot ".venv\Scripts\python.exe"

if (-not (Test-Path $Python)) {
    throw "Python not found: $Python. Check AI_Stock_Terminal\AI_Stock_Web_Beta."
}

$env:AI_STOCK_ROOT = $ProjectRoot
if (-not $env:AI_STOCK_BETA_REQUIRE_INVITE) {
    $env:AI_STOCK_BETA_REQUIRE_INVITE = "0"
}
$env:AI_STOCK_WEB_HOST = "127.0.0.1"
$env:AI_STOCK_WEB_PORT = "8765"
Start-Process "http://127.0.0.1:8765"
Push-Location $Root
try {
    & $Python -m uvicorn app:app --host 127.0.0.1 --port 8765
} finally {
    Pop-Location
}
