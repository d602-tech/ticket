# SafetyGuard 系統完整架設指南

> **目標讀者**：接手本系統的管理員或開發者。
> **系統架構**：React 前端（GitHub Pages）+ Google Apps Script 後端（Google Sheets 作為資料庫）。

---

## 目錄

1. [前置需求](#1-前置需求)
2. [Google Sheets 資料庫設定](#2-google-sheets-資料庫設定)
3. [Google Apps Script 後端部署](#3-google-apps-script-後端部署)
4. [Google Cloud Platform：OAuth 設定（Google 登入）](#4-google-cloud-platform-oauth-設定google-登入)
5. [前端設定與環境變數](#5-前端設定與環境變數)
6. [GitHub Pages 部署](#6-github-pages-部署)
7. [資安注意事項](#7-資安注意事項)
8. [首次登入與初始化](#8-首次登入與初始化)
9. [常見問題排除](#9-常見問題排除)

---

## 1. 前置需求

在開始之前，請確認你擁有以下帳號與工具：

| 需求        | 說明                                        |
| ----------- | ------------------------------------------- |
| Google 帳號 | 用於 Google Drive、Sheets、Apps Script、GCP |
| GitHub 帳號 | 用於程式碼版本控制與 Pages 部署             |
| Node.js 18+ | 本地開發環境                                |
| Git         | 版本控制工具                                |

---

## 2. Google Sheets 資料庫設定

本系統使用 Google Sheets 作為資料庫，GAS 會在首次呼叫時自動建立所需的分頁（Sheets）。

### 2.1 建立 Google Spreadsheet

1. 前往 [Google Drive](https://drive.google.com)，點擊「新增」→「Google 試算表」。
2. 將試算表命名為 `SafetyGuard DB`（或任意名稱）。
3. **記下試算表的 URL**，格式如下：
   ```
   https://docs.google.com/spreadsheets/d/【SPREADSHEET_ID】/edit
   ```
   `SPREADSHEET_ID` 就是你後面會用到的 ID。

### 2.2 建立 Google Drive 資料夾

系統需要 4 個 Google Drive 資料夾來存放上傳的檔案：

| 資料夾用途     | 建議命名                | 對應 CONFIG 變數                           |
| -------------- | ----------------------- | ------------------------------------------ |
| 罰單掃描檔     | `SafetyGuard_Scans`     | `SCAN_FOLDER_ID`                           |
| 簽辦文件範本   | `SafetyGuard_Templates` | `TEMPLATE_ID`（這是**檔案** ID，非資料夾） |
| 產出的簽辦文件 | `SafetyGuard_Documents` | `TARGET_FOLDER_ID`                         |
| 違規佐證上傳   | `SafetyGuard_Uploads`   | `UPLOAD_FOLDER_ID`                         |

**取得資料夾 ID 的方法**：
1. 在 Google Drive 中開啟資料夾。
2. 網址列格式為 `https://drive.google.com/drive/folders/【FOLDER_ID】`。
3. 複製 `FOLDER_ID` 備用。

### 2.3 建立簽辦文件範本（Google Docs）

1. 在 `SafetyGuard_Templates` 資料夾中，建立一份 Google 文件。
2. 在文件中使用以下佔位符（系統會自動替換）：
   - `【工程名稱】`
   - `【講習截止日期】`
   - `【承攬商名稱】`
   - `【主辦工作隊】`
3. 開啟此文件，從網址取得 `TEMPLATE_ID`：
   ```
   https://docs.google.com/document/d/【TEMPLATE_ID】/edit
   ```

---

## 3. Google Apps Script 後端部署

### 3.1 建立 GAS 專案

1. 前往 [script.google.com](https://script.google.com)，點擊「新增專案」。
2. 將專案命名為 `SafetyGuard Backend`。
3. 將 `backend/Code.js` 的**完整內容**複製貼上到 GAS 編輯器中（取代預設的 `function myFunction(){}`）。

### 3.2 綁定 Google Spreadsheet

GAS 需要與你的試算表綁定：

1. 在 GAS 編輯器中，點擊左側「服務」旁的「+」。
2. 或者，直接在程式碼中使用 `SpreadsheetApp.getActiveSpreadsheet()` 時，GAS 需要知道是哪一份試算表。

**最簡單的方法**：從試算表建立 GAS 專案：
1. 開啟你的 Google Sheets 試算表。
2. 點擊選單「擴充功能」→「Apps Script」。
3. 這樣建立的 GAS 專案會自動綁定該試算表，`getActiveSpreadsheet()` 就能正確運作。
4. 將 `backend/Code.js` 的內容貼入。

### 3.3 修改 CONFIG 常數

在 GAS 編輯器頂部，找到 `CONFIG` 物件並填入你的 ID：

```javascript
var CONFIG = {
  SCAN_FOLDER_ID: '貼上你的 SafetyGuard_Scans 資料夾 ID',
  TEMPLATE_ID: '貼上你的簽辦文件範本 Google Docs 檔案 ID',
  TARGET_FOLDER_ID: '貼上你的 SafetyGuard_Documents 資料夾 ID',
  UPLOAD_FOLDER_ID: '貼上你的 SafetyGuard_Uploads 資料夾 ID'
};
```

### 3.4 部署為網頁應用程式（Web App）

> ⚠️ **這是最關鍵的步驟，設定錯誤會導致前端無法連線。**

1. 點擊右上角「部署」→「新增部署作業」。
2. 點擊「類型」旁的齒輪圖示，選擇「**網頁應用程式**」。
3. 填寫設定：
   - **說明**：`v1`（或任意版本描述）
   - **執行身分**：選擇「**我（your.email@gmail.com）**」
     > 這讓 GAS 以你的身分存取 Drive 和 Sheets，必須選這個。
   - **誰可以存取**：選擇「**任何人**」
     > 這讓前端可以不需要登入 Google 就能呼叫 API（CORS 需要）。
4. 點擊「部署」，首次部署需要授權：
   - 點擊「授予存取權」。
   - 選擇你的 Google 帳號。
   - 若出現「Google 尚未驗證此應用程式」，點擊「進階」→「前往 SafetyGuard Backend（不安全）」→「允許」。
5. 部署完成後，複製 **Web App URL**，格式如下：
   ```
   https://script.google.com/macros/s/AKfycb.../exec
   ```
   **這個 URL 就是你的後端 API 位址，請妥善保存。**

> **重要**：每次修改 `Code.js` 後，必須重新部署（「部署」→「管理部署作業」→「編輯」→「版本」選「建立新版本」→「部署」），否則修改不會生效。

---

## 4. Google Cloud Platform：OAuth 設定（Google 登入）

> 若不需要 Google 登入功能，可跳過此步驟，系統仍可使用帳密登入。

### 4.1 建立 GCP 專案

1. 前往 [Google Cloud Console](https://console.cloud.google.com/)。
2. 點擊頂部專案下拉選單→「新增專案」。
3. 命名為 `SafetyGuard`，點擊「建立」。

### 4.2 設定 OAuth 同意畫面

1. 在左側選單，前往「API 和服務」→「OAuth 同意畫面」。
2. 使用者類型選「**外部**」，點擊「建立」。
3. 填寫必填欄位：
   - **應用程式名稱**：`SafetyGuard`
   - **使用者支援電子郵件**：你的 Gmail
   - **開發人員聯絡資訊**：你的 Gmail
4. 點擊「儲存並繼續」，其餘步驟（範圍、測試使用者）可直接點「儲存並繼續」跳過。
5. 回到摘要頁，點擊「發布應用程式」（否則只有測試使用者能登入）。

### 4.3 建立 OAuth 用戶端 ID

1. 前往「API 和服務」→「憑證」。
2. 點擊「建立憑證」→「OAuth 用戶端 ID」。
3. **應用程式類型**：選「**網頁應用程式**」。
4. **名稱**：`SafetyGuard Web`。
5. **已授權的 JavaScript 來源**（必填，加入以下所有網址）：
   ```
   http://localhost:5173
   http://localhost:4173
   https://【你的GitHub帳號】.github.io
   ```
6. **已授權的重新導向 URI**：本系統不需要填寫（使用 One Tap 模式）。
7. 點擊「建立」，複製「**用戶端 ID**」（格式：`xxxxxxxx.apps.googleusercontent.com`）。

---

## 5. 前端設定與環境變數

### 5.1 Clone 專案

```bash
git clone https://github.com/【你的帳號】/ticket.git
cd ticket
npm install
```

### 5.2 建立環境變數檔案

> ⚠️ **資安重點**：`.env.local` 絕對不能 commit 到 Git！

複製範本並填入實際值：

```bash
cp .env.example .env.local
```

編輯 `.env.local`：

```ini
# Google Apps Script Web App URL（步驟 3.4 取得）
VITE_GAS_URL=https://script.google.com/macros/s/你的_SCRIPT_ID/exec

# Google OAuth Client ID（步驟 4.3 取得，若不用 Google 登入可留空）
VITE_GOOGLE_CLIENT_ID=你的_CLIENT_ID.apps.googleusercontent.com
```

### 5.3 確認 .gitignore

確認 `.gitignore` 包含以下內容（避免 API 金鑰外洩）：

```
*.local
.env
.env.*
!.env.example
```

> 目前專案的 `.gitignore` 已包含 `*.local`，`.env.local` 已受保護。

### 5.4 本地開發測試

```bash
npm run dev
```

開啟瀏覽器前往 `http://localhost:5173`，確認可以正常登入。

---

## 6. GitHub Pages 部署

### 6.1 建立 GitHub Repository

1. 前往 [github.com](https://github.com)，點擊「New repository」。
2. 命名為 `ticket`（或任意名稱）。
3. 設為 **Public**（GitHub Pages 免費版需要 Public）。
4. 不要勾選「Initialize this repository」。

### 6.2 推送程式碼

```bash
git remote add origin https://github.com/【你的帳號】/ticket.git
git branch -M main
git push -u origin main
```

### 6.3 設定 GitHub Secrets（保護 API 金鑰）

> ⚠️ **資安關鍵**：不要把 `.env.local` 推上 GitHub。改用 GitHub Secrets 在 CI/CD 時注入環境變數。

1. 在 GitHub Repository 頁面，點擊「Settings」→「Secrets and variables」→「Actions」。
2. 點擊「New repository secret」，新增以下兩個 Secret：

   | Secret 名稱             | 值                   |
   | ----------------------- | -------------------- |
   | `VITE_GAS_URL`          | 你的 GAS Web App URL |
   | `VITE_GOOGLE_CLIENT_ID` | 你的 OAuth Client ID |

### 6.4 建立 GitHub Actions 自動部署

在專案中建立 `.github/workflows/deploy.yml`：

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: false

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build
        env:
          VITE_GAS_URL: ${{ secrets.VITE_GAS_URL }}
          VITE_GOOGLE_CLIENT_ID: ${{ secrets.VITE_GOOGLE_CLIENT_ID }}
        run: npm run build

      - name: Setup Pages
        uses: actions/configure-pages@v4

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: './dist'

      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

### 6.5 啟用 GitHub Pages

1. 在 GitHub Repository，點擊「Settings」→「Pages」。
2. **Source** 選擇「**GitHub Actions**」。
3. 推送任何 commit 到 `main` 分支，GitHub Actions 會自動 build 並部署。
4. 部署完成後，網址為：
   ```
   https://【你的帳號】.github.io/ticket/
   ```

### 6.6 更新 GCP 授權來源

部署到 GitHub Pages 後，回到 [GCP Console](https://console.cloud.google.com/)：

1. 「API 和服務」→「憑證」→ 點擊你的 OAuth 用戶端。
2. 在「已授權的 JavaScript 來源」中，確認已加入：
   ```
   https://【你的帳號】.github.io
   ```
3. 儲存。

---

## 7. 資安注意事項

### 7.1 API 金鑰保護

| 風險                   | 防護措施                                                                               |
| ---------------------- | -------------------------------------------------------------------------------------- |
| `.env.local` 被 commit | `.gitignore` 已包含 `*.local`，**請勿手動移除**                                        |
| GAS URL 外洩           | GAS URL 本身不含敏感資訊，但建議不要公開分享，避免被濫用                               |
| OAuth Client ID 外洩   | Client ID 是公開的（前端 JS 中可見），但需搭配授權來源限制，**不要外洩 Client Secret** |
| 密碼明文儲存           | ⚠️ 目前系統密碼以明文存於 Google Sheets，**建議限制試算表分享權限**                     |

### 7.2 Google Sheets 存取控制

> **重要**：Google Sheets 是本系統的資料庫，必須嚴格控制存取權限。

1. 開啟試算表，點擊右上角「共用」。
2. 確認只有需要的人有存取權限。
3. **絕對不要**將試算表設為「知道連結的人皆可檢視/編輯」。
4. GAS 以你的帳號身分執行，不需要額外共用給 GAS。

### 7.3 Google Drive 資料夾存取控制

同樣地，`SCAN_FOLDER_ID`、`TARGET_FOLDER_ID`、`UPLOAD_FOLDER_ID` 對應的資料夾：

1. 確認資料夾**未公開**分享。
2. 上傳的檔案雖然設定為「知道連結的人可檢視」（方便前端顯示），但資料夾本身不應公開。

### 7.4 GAS 後端安全

目前 GAS 設定為「任何人可存取」，這是 CORS 的需求。為了防止未授權呼叫：

- 所有需要管理員權限的 action（如 `getUsers`）已在後端檢查 `adminRole`。
- 建議定期檢查 GAS 的「執行項目」日誌，確認沒有異常呼叫。

### 7.5 預設密碼修改

系統初始化後，預設管理員帳號為：
- **帳號**：`admin@safetyguard.local`
- **密碼**：`admin123`

**首次登入後，請立即在「帳號管理」中修改密碼或新增正式帳號，並停用預設帳號。**

---

## 8. 首次登入與初始化

### 8.1 觸發系統初始化

首次使用前，需要初始化 Google Sheets 的分頁結構：

1. 開啟 GAS 編輯器。
2. 在函式下拉選單中選擇 `initAllSheets`。
3. 點擊「執行」。
4. 這會自動建立所有必要的分頁（Violations、Projects、Users、Fine 等）並設定預設管理員帳號。

### 8.2 登入系統

1. 開啟前端網址（本地：`http://localhost:5173`，正式：GitHub Pages 網址）。
2. 若 `VITE_GAS_URL` 未設定，登入頁面會顯示「Google Apps Script URL」輸入框，手動填入 GAS Web App URL。
3. 使用預設帳號登入：
   - 帳號：`admin@safetyguard.local`
   - 密碼：`admin123`

### 8.3 新增正式使用者

1. 登入後，前往「帳號管理」頁面。
2. 新增使用者時填入：
   - Email（若使用 Google 登入，需與 Google 帳號 Email 一致）
   - 密碼
   - 姓名
   - 角色（`admin` 或 `user`）

---

## 9. 常見問題排除

### Q1：登入時出現「連線失敗，請檢查 API URL」

- 確認 `VITE_GAS_URL` 是否正確設定。
- 確認 GAS 已部署且設定為「任何人可存取」。
- 在瀏覽器直接開啟 GAS URL，若回傳 JSON 則表示後端正常。

### Q2：Google 登入按鈕沒有出現

- 確認 `VITE_GOOGLE_CLIENT_ID` 已設定。
- 確認 `index.html` 中有載入 Google SDK：
  ```html
  <script src="https://accounts.google.com/gsi/client" async defer></script>
  ```
- 確認 GCP 的「已授權 JavaScript 來源」包含當前網址。

### Q3：Google 登入出現「Error 400: redirect_uri_mismatch」

- GCP Console → 憑證 → 你的 OAuth 用戶端 → 確認「已授權的 JavaScript 來源」包含當前網址（注意 `http` vs `https`、有無 trailing slash）。

### Q4：Google 登入成功但顯示「此 Google 帳號未被授權」

- 這是正常的安全機制。需要在 Google Sheets 的 `Users` 分頁中，新增該 Google 帳號的 Email。

### Q5：GAS 修改後沒有生效

- GAS 修改後**必須重新部署**：「部署」→「管理部署作業」→ 點擊鉛筆圖示 → 版本選「建立新版本」→「部署」。

### Q6：GitHub Actions 部署失敗

- 確認 GitHub Secrets 已正確設定（`VITE_GAS_URL`、`VITE_GOOGLE_CLIENT_ID`）。
- 確認 GitHub Pages 的 Source 設定為「GitHub Actions」。
- 查看 Actions 頁面的錯誤日誌。

### Q7：上傳檔案失敗

- 確認 `CONFIG` 中的資料夾 ID 正確。
- 確認 GAS 執行帳號對該資料夾有「編輯者」權限。
- 查看 GAS 的「執行項目」日誌確認錯誤訊息。

---

## 附錄：系統架構圖

```
使用者瀏覽器
    │
    │ HTTPS
    ▼
GitHub Pages（靜態前端）
    │
    │ POST JSON（VITE_GAS_URL）
    ▼
Google Apps Script（後端 API）
    ├── Google Sheets（資料庫）
    │       ├── Users（帳號）
    │       ├── Projects（工程）
    │       ├── Violations（違規）
    │       ├── Fine（罰單）
    │       ├── FineList（罰款項目）
    │       └── Section（工作隊）
    ├── Google Drive（檔案儲存）
    │       ├── 掃描檔資料夾
    │       ├── 文件範本
    │       ├── 產出文件資料夾
    │       └── 上傳資料夾
    └── Gmail（Email 通知）
```
