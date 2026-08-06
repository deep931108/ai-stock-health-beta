# AI 股票健康 Beta：Railway 部署說明

這份部署包包含 28 檔客戶研究報告、邀請登入、Google 表單回饋與 PWA 客戶端。

## 安全原則

- 不要提交 `database/web_beta/`、`.env` 或任何邀請碼檔案。
- Railway 必須掛載 Volume 到 `/data`，否則重新部署會遺失登入狀態。
- 正式站必須設定安全 Cookie，部署包預設已啟用。

## 1. 建立私人 GitHub Repository

在 GitHub 建立 Private repository，將本資料夾內容放在 repository 根目錄後提交。

```powershell
git init
git add .
git status
git commit -m "Deploy AI Stock Health Beta"
git branch -M main
git remote add origin YOUR_PRIVATE_REPOSITORY_URL
git push -u origin main
```

執行 `git status` 時，確認沒有 `invite-codes`、`beta-access.sqlite3` 或 `.env`。

## 2. 建立 Railway 服務

1. Railway 選擇 **New Project → Deploy from GitHub repo**。
2. 選擇剛建立的私人 repository。
3. Railway 會依 `Dockerfile` 自動建置。
4. 在服務的 **Variables** 新增：

```text
AI_STOCK_BETA_ADMIN_TOKEN=<至少32字元的隨機密碼>
AI_STOCK_BETA_REQUIRE_INVITE=1
AI_STOCK_WEB_SECURE_COOKIE=1
AI_STOCK_ROOT=/app
AI_STOCK_BETA_DB_PATH=/data/beta-access.sqlite3
```

可用 PowerShell 產生管理密碼：

```powershell
[Convert]::ToHexString((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

## 3. 掛載持久化 Volume

在 Railway 服務新增 Volume，Mount Path 必須設定：

```text
/data
```

完成後重新部署服務。

## 4. 取得 HTTPS 網址

在服務 **Settings → Networking → Generate Domain** 產生網址，確認：

```text
https://你的網址/api/health
```

回傳 `status: healthy` 才繼續。

## 5. 首次建立正式邀請碼

只執行一次：

```powershell
powershell.exe -ExecutionPolicy Bypass -File `
  .\scripts\bootstrap_production_invites.ps1 `
  -SiteUrl "https://你的Railway網址" `
  -Count 20
```

邀請碼會存入本機專案外層的：

```text
database\web_beta\invite-codes-production.json
```

伺服器只保存雜湊，不保存明碼；第二次初始化會被拒絕。

## 6. 正式驗收

1. 無痕視窗開啟網站，確認先看到邀請登入。
2. 使用一組邀請碼登入。
3. 確認股票中心顯示 28 檔、六個板塊。
4. 開啟個股報告並測試自選功能。
5. 開啟 Google 表單，確認自動帶入測試者與股票代號。
6. 重新部署一次，確認原帳號仍可登入（驗證 Volume）。

## 更新研究報告

替換 `database/client_reports/` 後提交並推送。不要動 `/data` 或邀請資料庫。
