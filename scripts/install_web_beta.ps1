$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$ProjectRoot = Split-Path -Parent $Root
$Python = Join-Path $ProjectRoot ".venv\Scripts\python.exe"

if (-not (Test-Path $Python)) {
    throw "Python not found: $Python. Place AI_Stock_Web_Beta inside AI_Stock_Terminal."
}

& $Python -m pip install -r (Join-Path $Root "requirements-web.txt")
Write-Host "Installation completed. Next: scripts\start_web_beta.ps1" -ForegroundColor Green
