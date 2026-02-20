# 專案設計準則與設定指南 (Design Guidelines & Configuration)

本文件旨在提供全面的專案設計規範、身分驗證流程說明，以及 GitHub 與 Google API 的詳細設定指南。

## 1. 設計系統 (Design System)

本專案採用 **Vite + React + TailwindCSS** 作為前端核心技術棧。

### 1.1 色彩規範 (Color Palette)
基於 TailwindCSS 的語意化顏色設定：

*   **主色 (Primary)**: 用於主要按鈕、連結與強調資訊。建議使用藍色系 (e.g., `blue-600`)。
*   **次要色 (Secondary)**: 用於次要操作或背景。建議使用灰色系 (e.g., `gray-500`, `slate-50`).
*   **警告 (Warning)**: 用於刪除、錯誤提示。建議使用紅色系 (e.g., `red-500`)。
*   **成功 (Success)**: 用於完成狀態。建議使用綠色系 (e.g., `green-500`)。

### 1.2 排版 (Typography)
*   **字體**: 優先使用系統預設字體以確保最佳效能，並建議 fallback 至 `Noto Sans TC` 以優化中文顯示。
    ```css
    font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans TC", sans-serif;
    ```
*   **字重**:
    *   標題: `font-bold` (700)
    *   內文: `font-normal` (400)
    *   強調: `font-medium` (500)

### 1.3 UI 元件 (Components)
*   **按鈕 (Button)**: 應具備 hover 效果與適當的 padding (e.g., `px-4 py-2`)。
*   **卡片 (Card)**: 使用白色背景 (`bg-white`) 搭配輕微陰影 (`shadow-sm` 或 `shadow-md`) 與圓角 (`rounded-lg`)。
*   **彈窗 (Modal)**: 需具備半透明遮罩 (`bg-black/50`) 與置中顯示的內容區塊。

---

## 2. 身分驗證流程 (Authentication)

本專案支援 **傳統帳密登入** 與 **Google 登入** 兩種方式，後端由 Google Apps Script (GAS) 處理。

### 2.1 傳統帳密登入
1.  **前端**: 使用者輸入 Email 與密碼。
2.  **API 請求**: 呼叫 `handleRequest`，action 為 `login`。
3.  **後端驗證**: GAS 讀取 Google Sheet 中的 `Users` 分頁，比對 Email 與密碼。
4.  **回應**: 若成功，回傳使用者資訊 (無 Token，僅 session user object)。

### 2.2 Google 登入 (OAuth 2.0)
使用 Google Identity Services (GIS) 進行前端驗證。

1.  **前端**:
    *   使用 Google 官方按鈕或自定義按鈕觸發登入。
    *   取得 `credential` (JWT Token)。
    *   將 `credential` 發送至 GAS (Action: `googleLogin`)。
2.  **後端 (GAS)**:
    *   解析 JWT Token (decode base64 payload)。
    *   取得 Email (`payload.email`)。
    *   **權限檢查**: 比對 `Users` 分頁，若 Email 不在 `Users` 表中，後端應回傳錯誤，拒絕登入。

---

## 3. 設定與部署指南 (Configuration & Deployment)

### 3.1 GitHub 設定 (GitHub Pages)

#### 3.1.1 Repository 設定
1.  確保 `package.json` 中的 `homepage` 欄位已設定為你的 GitHub Pages 網址：
    ```json
    "homepage": "https://<username>.github.io/<repo-name>",
    ```
2.  確保 `vite.config.ts` 中的 `base` 路徑設定正確：
    ```typescript
    export default defineConfig({
      base: './', // 或 '/<repo-name>/'
      // ...
    })
    ```

#### 3.1.2 部署流程
1.  執行打包指令：
    ```bash
    npm run build
    ```
2.  將 `dist` 資料夾內容推送到 `gh-pages` 分支 (或設定 GitHub Action 自動部署)。

### 3.2 Google Apps Script (Backend) 設定

#### 3.2.1 建立 GAS 專案
1.  前往 Google Drive，建立新的 Google Apps Script。
2.  將 `backend/code.js` 的內容完整複製到 GAS 編輯器中。

#### 3.2.2 設定常數 (Config)
在 `code.js` 頂部，修改 `CONFIG` 物件以對應你的 Google Drive 資料夾 ID：
```javascript
var CONFIG = {
  SCAN_FOLDER_ID: '你的_掃描檔資料夾_ID',
  TEMPLATE_ID: '你的_文件範本_ID',
  TARGET_FOLDER_ID: '你的_產出文件存放資料夾_ID',
  UPLOAD_FOLDER_ID: '你的_一般上傳資料夾_ID'
};
```

#### 3.2.3 部署為網頁應用程式 (Web App)
1.  點擊右上角「部署」 -> 「新增部署作業」。
2.  類型選擇「網頁應用程式」。
3.  **執行身分**: 選擇 **「我」(Me)** (這很重要，確保程式有權限存取你的 Drive/Sheets)。
4.  **誰可以存取**: 選擇 **「任何人」(Anyone)** (確保前端可以跨網域呼叫)。
5.  部署後取得 **Web App URL** (格式如 `https://script.google.com/macros/s/.../exec`)。

### 3.3 Google Cloud Platform (GCP) 設定

為了使用 Google 登入，需設定 OAuth Client ID。

1.  前往 [Google Cloud Console](https://console.cloud.google.com/)。
2.  建立一個新專案。
3.  前往 **「API 和服務」** -> **「憑證」**。
4.  點擊 **「建立憑證」** -> **「OAuth 用戶端 ID」**。
5.  **應用程式類型**: 選擇 **「網頁應用程式」**。
6.  **已授權的 JavaScript 來源**:
    *   加入本地開發網址: `http://localhost:5173` (或你的 Port)
    *   加入正式站網址: `https://<username>.github.io`
7.  建立後，取得 **用戶端 ID (Client ID)**。

### 3.4 環境變數設定 (.env)

在專案根目錄建立 `.env` 檔案 (參考 `.env.example`)，填入上述取得的資訊：

```ini
# Google Apps Script Web App URL
VITE_GAS_URL=https://script.google.com/macros/s/你的_GAS_部署_ID/exec

# Google OAuth Client ID
VITE_GOOGLE_CLIENT_ID=你的_OAUTH_CLIENT_ID.apps.googleusercontent.com
```

---

## 4. API 串接說明

前端透過 `services/apiService.ts` 統一管理 API 呼叫。

*   **基本請求格式**: POST JSON payload。
*   **Action 參數**: 每個請求必須包含 `action` 欄位，以觸發後端對應的 function。
    *   例如: `action: 'getData'` 取得所有資料。
*   **CORS 處理**: GAS 通常會處理 CORS，但前端 fetch 時需注意 `redirect: 'follow'` (雖然 GAS 輸出的是 JSON，但實際上是透過 redirect 轉發內容)。本專案使用 `text/plain` content-type 傳送 POST 以避免 OPTIONS preflight 複雜化 (這是 GAS 常用技巧)。

---

## 5. 常見問題排除 (Troubleshooting)

*   **CORS 錯誤**:
    *   檢查 GAS 部署是否設為「任何人」(Anyone)。
    *   檢查 GAS 是否有發生執行錯誤 (由 GAS 後台查看執行項目)。
*   **Google 登入失敗 (popup_closed_by_user)**:
    *   瀏覽器阻擋彈窗，請確認允許彈窗。
*   **Google 登入失敗 (idpiframe_initialization_failed)**:
    *   確認 GCP Console 的「已授權來源」是否包含當前網址 (包含 http/https 差異)。
    *   本地開發時，盡量使用 `localhost` 而非 `127.0.0.1`。
*   **資料未更新**:
    *   GAS 即使重新部署，若未選擇「新增版本」，網址可能不變但內容未更新。建議每次修改 Code 後都建立「新版本」部署。
