param(
    [Parameter(Mandatory = $true)]
    [string]$SiteUrl,
    [int]$Count = 20
)

$ErrorActionPreference = "Stop"
$AdminToken = Read-Host "請貼上 Railway 的 AI_STOCK_BETA_ADMIN_TOKEN"
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
$Result | ConvertTo-Json -Depth 6 | Set-Content -Path $Output -Encoding utf8
Write-Host "正式邀請碼已建立：$Output" -ForegroundColor Green
Write-Host "請勿上傳此檔案或提交到 Git。" -ForegroundColor Yellow
