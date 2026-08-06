param(
    [Parameter(Mandatory = $true)]
    [string]$SiteUrl,
    [int]$Count = 20
)

$ErrorActionPreference = "Stop"
$AdminToken = Read-Host "Paste AI_STOCK_BETA_ADMIN_TOKEN"
$Headers = @{ "X-Admin-Token" = $AdminToken }
$Body = @{ count = $Count } | ConvertTo-Json
$Base = $SiteUrl.TrimEnd("/")

$Result = Invoke-RestMethod `
    -Method Post `
    -Uri "$Base/api/admin/bootstrap-invites" `
    -Headers $Headers `
    -ContentType "application/json" `
    -Body $Body

$Root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$SecretDir = Join-Path $Root "database\web_beta"
New-Item -ItemType Directory -Path $SecretDir -Force | Out-Null

$Output = Join-Path $SecretDir "invite-codes-production.json"
$Result | ConvertTo-Json -Depth 6 |
    Set-Content -Path $Output -Encoding UTF8

Write-Host "Production invites saved to: $Output"
Write-Host "Do not upload or commit this file."
