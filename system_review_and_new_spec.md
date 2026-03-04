# 系統開發檢討報告與新系統規格書

## 第一部分：現有管理系統開發檢討報告

在先前系統（罰款與專案管理系統）的開發與部署過程中，我們遭遇並克服了以下核心問題。這些經驗將作為新系統開發的重要避坑指南：

### 1. 部署與跨網域請求 (CORS) 踩坑
*   **問題**：前端部署於 GitHub Pages，後端 API 部署於 Google Apps Script (GAS) 時，遭遇 CORS (跨來源資源共用) 阻擋，且前端路由 (Vite) 的 Base URL 設定錯誤導致白畫面。
*   **解決方案**：
    *   **GAS 端**：在 `doPost` 與 `doGet` 中，必須回傳 `ContentService.createTextOutput().setMimeType(ContentService.MimeType.JSON)`，且前端請求不可帶複雜 Header 觸發 Preflight。利用 `mode: 'no-cors'` 或正確的 GAS web app 重導向機制處理。
    *   **Vite 端**：在 `vite.config.ts` 中將 `base` 設為 `./` 或 `/倉庫名稱/`，確保 GitHub Pages 能正確載入靜態資源。

### 2. 資料庫讀寫與效能瓶頸
*   **問題**：登入時載入過慢。GAS 預設的 SpreadsheetApp 讀寫非常耗時，尤其是當前端在初始化時請求了大量不必要的跨表資料（如：同時請求所有罰單、人員、專案、權限）。
*   **解決方案**：
    *   **後端快取與批次讀取**：在 GAS 中將資料一次性 `getValues()` 讀出後處理，避免在迴圈中呼叫 `getValue()`。
    *   **延遲載入 (Lazy Loading)**：登入 API 僅回傳 Token 與基本權限，其餘大表資料（如歷史紀錄）等使用者切換到該頁面時才非同步請求。

### 3. API 授權與 Google Docs 整合問題
*   **問題**：在實作由 GAS 自動產生「簽辦」Google Docs 時，發生權限拒絕 (Authorization Error)。
*   **解決方案**：GAS 專案預設的 OAuth Scope 不足。必須在 GAS 專案的 `appsscript.json` 中手動加入 `"https://www.googleapis.com/auth/documents"` 與 `"https://www.googleapis.com/auth/drive"` 的 scopes，並重新授權後部署。

### 4. 前端資料綁定與狀態管理的邊角案例 (Edge Cases)
*   **問題**：
    1. 罰單號碼 (Ticket Numbers) 的多選 Checkbox 無法正確儲存進陣列（字串與陣列型別錯亂）。
    2. 例假日回報邏輯漏洞（週五回報週一的資料，系統誤判週六、週日為缺口）。
*   **解決方案**：
    *   表單元件嚴格控管 TypeScript 介面，多選變更時使用 `Array.from` 或展開運算子確保更新為陣列。
    *   日期計算導入 `date-fns` 或自建嚴謹的日曆黑名單機制，精確排除週末與國定假日。

---

## 第二部分：承攬商每日日誌系統 - 系統規格書與部署架構

基於之前的成功模式，本系統將採用 **Frontend (GitHub Pages + React/Vite) + Backend (GAS REST API) + Database (Google Sheets)** 的架構，並導入 Google 帳戶 SSO 登入。

### 1. 系統架構概念
*   **前端 (Frontend)**：React + Vite + TypeScript + TailwindCSS。負責 UI 展示、操作邏輯與 Google SSO 登入。
*   **後端 (Backend)**：Google Apps Script (GAS)。封裝為 Web App，以純 API (`doGet`, `doPost`) 形式提供服務。
*   **資料庫 (Database)**：Google Sheets。以不同的工作表 (Tabs) 儲存日誌紀錄、承攬商名冊、使用者權限等。

### 2. 核心功能需求
1.  **Google SSO 登入**：使用者僅能透過 Google 帳戶登入，系統攔截 Email 並與 Google Sheets 權限表比對，確認是否有寫入/檢視權限。
2.  **日誌填寫模組**：承攬商可填寫每日施工/作業日誌（日期、天氣、施工項目、出工人數、夾帶照片連結等）。
3.  **歷史紀錄查詢**：提供日期區間、承攬商名稱的篩選器，檢視過往日誌。
4.  **防呆機制**：禁止回溯修改超過 N 天的日誌。

### 3. 完整串接與環境變數設置指南 (成功模式完全複製)

這部分是前後端分離與 Google SSO 成功串接的最核心關鍵設定：

#### 步驟一：Google Cloud Console 設定 (取得 Client ID)
要讓前端擁有 Google 登入按鈕，必須前往 GCP 設定 OAuth：
1. 前往 **[Google Cloud Console](https://console.cloud.google.com/)**，建立一個新專案。
2. 進入 **API 與服務 > OAuth 同意畫面 (Consent Screen)**：
   * User Type 選擇「外部 (External)」。
   * 填寫應用程式名稱與聯絡 Email 並儲存。
3. 進入 **憑證 (Credentials)** > **建立憑證** > **OAuth 用戶端 ID**：
   * 應用程式類型設定為「**網頁應用程式 (Web Application)**」。
   * **已授權的 JavaScript 來源 (Authorized JavaScript origins)** 填入開發環境與 GitHub Pages 網址：
     * `http://localhost:5173` (本地開發)
     * `https://[你的GitHub帳號].github.io` (正式上線)
   * **已授權的重新導向 URI (Authorized redirect URIs)**：純前端介接 SSO 可留空或設定與來源相同網址。
4. **取得並保存 `Client ID`** (以 `.apps.googleusercontent.com` 結尾的字串)。

#### 步驟二：GAS 後端設置 (取得 GAS API URL)
1. 在 Google Drive 建立一個新的 Google Sheet，打開 **擴充功能 > Apps Script**。
2. 撰寫 `doGet(e)` 與 `doPost(e)` 作為路由入口：
   ```javascript
   function doPost(e) {
     const data = JSON.parse(e.postData.contents);
     // 處理登入與資料寫入邏輯 ...
     return ContentService.createTextOutput(JSON.stringify({ status: 'success', data: result }))
       .setMimeType(ContentService.MimeType.JSON);
   }
   ```
3. 點擊右上角 **部署 > 新增部署作業**：
   * 類型選擇：「**網頁應用程式 (Web App)**」。
   * 執行身分：「**我 (Me)**」。
   * 誰可以存取：「**所有人 (Anyone)**」*(這是讓前端不被 CORS 擋下的絕對關鍵！)*。
4. **取得並保存 `網頁應用程式網址 (Web App URL)`**。

#### 步驟三：GitHub 環境變數與 Action 設置
在前端專案的 GitHub Repo 中，前往 **Settings > Secrets and variables > Actions > Variables** 建立以下變數：

*   `VITE_GAS_API_URL` = `[你的 GAS 網頁應用程式網址]`
*   `VITE_GOOGLE_CLIENT_ID` = `[你的 Google OAuth Client ID]`

在 `./.github/workflows/deploy.yml` 加入環境變數寫入步驟：
```yaml
name: Deploy Next.js site to Pages
# ... 前面觸發條件略 ...
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Install dependencies
        run: npm install
      - name: Build
        env:
          VITE_GAS_API_URL: ${{ vars.VITE_GAS_API_URL }}
          VITE_GOOGLE_CLIENT_ID: ${{ vars.VITE_GOOGLE_CLIENT_ID }}
        run: npm run build
      # ... 部署到 GitHub Pages 步驟略 ...
```

#### 步驟四：前端 Vite 專案串接
前端安裝 `@react-oauth/google` 來實作登入：

1. **入口包裝** (`main.tsx` 或 `App.tsx`)：
   ```tsx
   import { GoogleOAuthProvider } from '@react-oauth/google';

   const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

   ReactDOM.createRoot(document.getElementById('root')!).render(
     <GoogleOAuthProvider clientId={clientId}>
       <App />
     </GoogleOAuthProvider>
   );
   ```

2. **登入呼叫與驗證邏輯**：
   ```tsx
   import { GoogleLogin } from '@react-oauth/google';
   import { jwtDecode } from 'jwt-decode';

   // 元件內使用
   <GoogleLogin
     onSuccess={(credentialResponse) => {
       const user: any = jwtDecode(credentialResponse.credential!);
       const userEmail = user.email;

       // 呼叫 GAS API 檢查權限
       fetch(import.meta.env.VITE_GAS_API_URL, {
         method: 'POST',
         body: JSON.stringify({ action: 'login', email: userEmail }),
         // 勿加 Content-Type: application/json，避免 CORS preflight (OPTIONS) 請求被擋
       })
       .then(res => res.json())
       .then(data => {
            if(data.hasPermission) { 
                /* 登入成功處理 */ 
            }
       });
     }}
     onError={() => { console.log('Login Failed'); }}
   />
   ```
