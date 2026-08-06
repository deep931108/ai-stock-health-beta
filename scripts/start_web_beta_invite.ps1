$ErrorActionPreference = "Stop"
$env:AI_STOCK_BETA_REQUIRE_INVITE = "1"
& (Join-Path $PSScriptRoot "start_web_beta.ps1")
