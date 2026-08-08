# AI 股票健康 Web Beta v1.4

這是面向客戶的獨立 PWA，不是內部每日營運報告。它會讀取 AI Stock Terminal 已產生的客戶安全報告，不會向客戶暴露候選代碼、Holdout、研究門檻或內部診斷。

## 目前功能

- 手機、平板、桌面響應式介面
- 自動讀取全部客戶安全報告
- 股票中文名稱與四位數代號搜尋
- 六大板塊篩選與股票卡片比較
- 健康分數、研究等級與風險快速預覽
- 可分享的個股網址，例如 `?stock=2330`
- 健康總分、研究等級、AI 信心與風險
- 財務、技術、法人籌碼、市場環境、新聞情緒五大指標
- 指標原因說明
- 自選股保存在使用者裝置，並可切換只看自選
- Google 表單回饋整合，自動帶入測試者代號與目前股票
- 20 組 Beta 邀請碼、HttpOnly 登入 Cookie 與受保護股票 API
- 載入、無報告與 API 異常畫面
- PWA 主畫面安裝、離線介面快取
- 客戶資料與內部研究資料隔離

## 放置位置

將整個資料夾放到：

```text
D:\AI_Stock_Terminal\AI_Stock_Web_Beta
```

正式報告讀取位置：

```text
D:\AI_Stock_Terminal\database\client_reports\<股票代號>\latest.json
```

找不到正式報告時，只會提供內建的 2330、2891 Beta 展示資料。

## 第一次安裝

在 `D:\AI_Stock_Terminal` PowerShell 執行：

```powershell
powershell.exe -ExecutionPolicy Bypass -File .\AI_Stock_Web_Beta\scripts\install_web_beta.ps1
```

## 開啟客戶端

```powershell
powershell.exe -ExecutionPolicy Bypass -File .\AI_Stock_Web_Beta\scripts\start_web_beta.ps1
```

瀏覽器會開啟：

```text
http://127.0.0.1:8765
```

關閉 PowerShell 視窗或按 `Ctrl+C` 即可停止。

## 執行測試

```powershell
powershell.exe -ExecutionPolicy Bypass -File .\AI_Stock_Web_Beta\scripts\test_web_beta.ps1
```

預期結果：`9 passed`。

## 建立20組邀請碼

只需執行一次：

```powershell
powershell.exe -ExecutionPolicy Bypass -File .\AI_Stock_Web_Beta\scripts\generate_beta_invites.ps1
```

明碼清單輸出至：

```text
database\web_beta\invite-codes-latest.json
```

這份檔案只能由管理者保管，不可放進公開網站。SQLite只會保存邀請碼雜湊。

## 邀請模式啟動

```powershell
powershell.exe -ExecutionPolicy Bypass -File .\AI_Stock_Web_Beta\scripts\start_web_beta_invite.ps1
```

一般 `start_web_beta.ps1` 仍是你的本機免邀請模式。

## 架構原理

```text
手機／瀏覽器
    ↓ HTTP
FastAPI（app.py）
    ↓
ClientReportRepository
    ↓
database/client_reports/<stock_id>/latest.json
```

前端永遠只接觸經過 `client_report_adapter.py` 正規化的客戶安全欄位。未來部署到網路時，前端程式不用重寫，只需要把 FastAPI 與資料庫部署到伺服器。

## 下一階段

1. 用一份真實 `database\client_reports\<股票代號>\latest.json` 核對欄位。
2. 完成自選股完整清單與使用者回報。
3. 建立邀請碼與 20 人 Beta 記錄。
4. 部署免費測試網址。
5. 最後才購買自有網域與包裝 Android／iOS App。
# 邀請碼登入

正式 Beta 設定 `AI_STOCK_BETA_REQUIRE_INVITE=1` 後，未登入的訪客會先看到邀請碼輸入畫面。驗證成功後才會載入股票中心；右上角會顯示測試者代號，並可使用「登出／更換邀請碼」清除目前登入狀態。

若部署後仍直接進入網站，通常是瀏覽器仍保存有效的 Beta Cookie，可按右上角登出，或使用無痕視窗確認邀請碼閘門。
