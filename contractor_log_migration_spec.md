# 承攬商日誌系統 - 架構遷移計畫書 (GAS 後端 + GitHub Pages 前端)

## 一、 核心目標與原則
1. **前端 100% 凍結**：維持原本的排版、顏色、按鈕位置、結構、CSS、JS。不導入 React/Vue/Vite 或 Tailwind 等任何前端框架，純靜態 HTML/CSS/JS 呈現。
2. **純靜態託管**：前端程式碼 100% 搬移至 GitHub Pages 運作。
3. **後端 API 化**：GAS 專案僅保留單一 `code.gs` 檔案負責資料處理，並透過 `doPost` 提供 RESTful API 服務。
4. **極簡部署**：使用 GitHub Desktop 進行單擊 Sync 更新前端，不使用複雜的 CI/CD Actions。

---

## 二、 專案檔案結構重組計畫

原本佈署在 GAS 的 6 個檔案，將徹底拆分為「前端」與「後端」兩個分離的運行環境。

### 1. 後端 (Google Apps Script)
僅保留以下核心檔案：
*   `appsscript.json` 
*   `code.gs` 

*(備註：所有的 `.html` 檔案將從 GAS 專案中徹底刪除。)*

### 2. 前端 (本地資料夾 -> GitHub Pages)
建立一個新的本地資料夾（例如 `contractor-log`），將原先 GAS 的 `.html` 檔案內容提取並轉為純前端標準格式：
*   `index.html` (由原 `Index.html` 轉移，保留 DOM 結構，並加入對 CSS/JS 的 `<link>` 與 `<script>` 參照)
*   `style.css` (由原 `CSS.html` 轉移，移除 `<style>` 標籤，保留純 CSS)
*   `dashboard.js` (由原 `JS_Dashboard.html` 轉移，移除 `<script>` 標籤，保留純 JS)
*   `main.js` (由原 `LogJavaScript.html` 轉移，移除 `<script>` 標籤，保留純 JS)

---

## 三、 Google OAuth 與 GAS API 詳細設定指南

要讓純前端網頁能夠登入 Google 帳號並呼叫 GAS，必須進行以下詳細設定。

### 1. Google Cloud Console 設定 (取得 Client ID)
要讓前端擁有 Google 登入功能，必須前往 GCP 設定 OAuth：

1. 登入 **[Google Cloud Console](https://console.cloud.google.com/)**，點擊左上角建立一個新專案（例如命名為 `Contractor Log System`）。
2. 在左側選單進入 **API 與服務 > OAuth 同意畫面 (OAuth consent screen)**：
   * User Type 選擇「**外部 (External)**」，點擊建立。
   * **應用程式名稱**：輸入使用者登入時看到的名稱（如：承攬商日誌系統）。
   * **使用者支援電子郵件**與**開發人員聯絡資訊**：填寫你的 Email。
   * 其他欄位可留空，一路點擊「儲存並繼續」直到完成。
3. 在左側選單進入 **憑證 (Credentials)**，點擊上方 **建立憑證 > OAuth 用戶端 ID**：
   * **應用程式類型**選擇：「**網頁應用程式 (Web Application)**」。
   * **名稱**：填寫名稱（例如 `GitHub Pages Client`）。
   * **已授權的 JavaScript 來源 (Authorized JavaScript origins)**（這是重點，必須填入你的前端網址）：
     * 本地測試用（若你有用 Live Server）：`http://127.0.0.1:5500` 或 `http://localhost:3000`
     * 正式上線用（GitHub Pages）：`https://[你的GitHub帳號].github.io`
   * **已授權的重新導向 URI**：留空即可（純前端 SSO 不需要）。
   * 點擊「建立」。
4. 成功後會跳出視窗，請複製並保存你的 **`Client ID`**（格式如 `123456789-xxxxxx.apps.googleusercontent.com`）。

*(注意：在你的 HTML 中載入 Google SSO 腳本時，需將此 Client ID 填入對應的 `<script>` 標籤或初始化設定中)*

### 2. GAS 後端 API 部署 (取得 Web App URL)
*(⚠️ 規範：我不產生這份修改好的 `code.gs` 檔案，請你自行至 GAS 編輯器中修改！)*

1. 在你的 GAS 專案中，刪除所有的 `.html` 檔案，只留下 `code.gs`。
2. 在 `code.gs` 中加入 `doPost(e)` 函式，用來統一接收前端所有的 fetch 請求。這會取代原本的 `doGet` 渲染 HTML 功能。

```javascript
function doPost(e) {
  try {
    // 解析前端傳來的 JSON 字串
    var params = JSON.parse(e.postData.contents);
    var action = params.action;
    var data = params.data;
    var result;

    // 路由分發 (根據前端傳來的 action 執行你原有的 function)
    if (action === "getLogData") {
      result = getLogData(data.date);  // ← 原本的商業邏輯函式完全不動，只要回傳資料即可
    } else if (action === "submitLog") {
      result = submitLog(data);
    }
    // ...以此類推擴充你的 API

    // 統一回傳 JSON 格式 (解決跨域 CORS 問題的核心！)
    return ContentService.createTextOutput(JSON.stringify({ status: "success", data: result }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
```

3. 點選 GAS 編輯器右上角：**部署 > 新增部署作業**。
4. 網頁左邊的「選取類型」點選齒輪，選擇「**網頁應用程式 (Web App)**」。
5. **說明**：隨意填寫（例如 `API v1`）。
6. **執行身分**：選擇「**我 (Me)**」（代表以你的權限讀寫 Google Sheets）。
7. **誰可以存取**：選擇「**所有人 (Anyone)**」*(⚠️ 絕對關鍵，這決定了從 GitHub Pages 過來的 fetch 能否繞過 CORS 阻擋！)*
8. 點擊「部署」，授權完成後，複製產生的「**網頁應用程式網址 (Web App URL)**」（格式如 `https://script.google.com/macros/s/xxxxxx/exec`）。
9. 將此 URL 記錄下來，貼到前端的 JS 檔案中。*(注意：以後每次修改 `code.gs` 程式碼，都必須選擇「部署 > 管理部署作業 > 編輯 > 建立新版本」，否則舊網址不會更新程式碼！)*

---

## 四、 前端修改與 GitHub Pages 部署指南

### 1. 前端請求方式改寫 (JS 檔案調整)
由於前後端分離，原本前端透過 `google.script.run` 呼叫後端的方式將完全失效，必須手動將原始碼改寫為 `fetch()` API 呼叫。

在你的 `main.js` 與 `dashboard.js` 最上方宣告剛取得的 GAS Web App URL：

```javascript
// 填入你在 GAS 部署取得的 URL
const GAS_API_URL = "https://script.google.com/macros/s/xxxxxxxxx/exec";

// 【修改前】寫法：
// google.script.run.withSuccessHandler(callback).myGasFunction(data);

// 【修改後】寫法 (使用 fetch 送出 POST 請求)：
fetch(GAS_API_URL, {
  method: "POST",
  // body 必須轉字串，並附帶 action 用於後端路由判定
  body: JSON.stringify({
    action: "myGasFunction", 
    data: data 
  })
})
.then(res => res.json())
.then(response => {
  if(response.status === "success") {
    // 執行原有的 callback 或畫面更新邏輯
    callback(response.data);
  } else {
    console.error("後端錯誤：", response.message);
    alert("後端錯誤：" + response.message);
  }
})
.catch(err => {
  console.error("網路請求失敗", err);
  alert("網路連線失敗，請檢查網路或 API 網址");
});
```

### 2. GitHub Desktop 本地倉庫建立與發布
本系統不需要使用 GitHub Actions 處理環境變數，而是直接在 JS 中寫死或動態讀取，以達到最純粹的靜態部署。

1. 打開 **GitHub Desktop**，點擊左上角 **File > New repository**。
2. **Name** 輸入：`contractor-log`（或你想要的英文專案名）。
3. **Local path** 選擇你存放代碼的位址，點擊 **Create repository**。
4. 將拆解好的靜態網頁（`index.html`、`style.css`、`main.js`、`dashboard.js`）放入該資料夾。
5. 回到 GitHub Desktop，左側會顯示新增的檔案。在左下角 summary 填寫 `Initial commit`，按下 **Commit to main**。
6. 點擊上方藍色按鈕 **Publish repository** 將專案同步至 GitHub 平台（取消勾選 `Keep this code private` 設為公開專案以免費使用 Pages 功能）。

### 3. 設定自動託管 GitHub Pages
這一步只要做一次，之後的更新都是全自動的。

1. 前往 **GitHub 網站** (https://github.com/) ，進入你剛建立的 repository (`contractor-log`)。
2. 點選右上方標籤頁的 **Settings**。
3. 點選左側選單的 **Pages**。
4. 找到 **Build and deployment** 區塊：
   * **Source** 選擇 **Deploy from a branch**。
   * **Branch** 下方的兩個下拉選單，分別選擇 `main` 與 `/ (root)`。
   * 按下 **Save** 保存。
5. 靜候 1~3 分鐘後，你的前端靜態網站即正式上線！
   * 網址格式為：`https://[你的GitHub帳號].github.io/contractor-log/`
6. **(重要)**：記得把你剛才取得的這個 GitHub Pages 網址，加回你在 **Google Cloud Console > 憑證 > OAuth 用戶端 ID** 設定中的「**已授權的 JavaScript 來源**」！

### 4. 未來的日常更新方式 (Single-Click Sync)
未來你需要修改 HTML 排版、CSS 顏色或 JS 邏輯時：
1. 本地端開啟 VSCode 修改 `contractor-log` 資料夾內的檔案並存檔。
2. 打開 GitHub Desktop，確認有抓到檔案變更。
3. 左下角輸入更新內容，點選 **Commit to main**。
4. 點選右上角的 **Push origin** (或 Sync)。
5. **結束！** 幾分鐘後重新整理你的網頁，改動就會自動生效。完全不需要進 GAS 重新部署版本。
