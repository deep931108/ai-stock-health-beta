$ErrorActionPreference = "Stop"
$WebRoot = Split-Path -Parent $PSScriptRoot
$ProjectRoot = Split-Path -Parent $WebRoot
$Python = Join-Path $ProjectRoot ".venv\Scripts\python.exe"

if (-not (Test-Path $Python)) {
    throw "Python not found: $Python"
}

& $Python (Join-Path $PSScriptRoot "beta_invite_admin.py") "create" "--count" "20"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Invite list created under database\web_beta." -ForegroundColor Green
