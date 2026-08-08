# Beta 邀請碼入口更新

## 完成內容

1. 未登入訪客先顯示邀請碼驗證頁，不會先看到股票資料。
2. 邀請碼會交由既有 `/api/beta/activate` 驗證，成功後才載入股票中心。
3. 支援無效邀請碼、嘗試過多、登入逾期與連線錯誤提示。
4. 右上角顯示 `BETA-xxx` 測試者代號。
5. 新增「登出／更換邀請碼」，登出後立即回到邀請碼頁。
6. 保留原有 Secure、HttpOnly、SameSite Cookie 與 Railway SQLite 資料。
7. 加入手機版邀請碼畫面。
8. Service Worker 快取版本已更新，避免瀏覽器持續使用舊前端。

## 覆蓋與測試

將整個 `AI_Stock_Web_Beta` 覆蓋目前同名資料夾，然後執行：

```powershell
powershell.exe -ExecutionPolicy Bypass -File `
  .\AI_Stock_Web_Beta\scripts\test_web_beta.ps1
```

測試正式站時，請先用無痕視窗開啟網址；應先看到邀請碼輸入頁。登入後，右上角應顯示測試者代號，按「登出／更換邀請碼」應回到驗證頁。

## 部署

```powershell
Set-Location D:\AI_Stock_Terminal\AI_Stock_Web_Beta
git add .
git commit -m "Add Beta invite login gate"
git push
```

Railway 會由 GitHub push 自動重新部署。原有邀請碼存在掛載的 `/data/beta-access.sqlite3`，本次更新不會清除或重建邀請碼。
