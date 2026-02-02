// 請將此程式碼複製到 script.google.com 的編輯器中
// 部署為「網頁應用程式」時，請設定：
// 1. 執行身分: 我 (Me)
// 2. 誰可以存取: 任何人 (Anyone)

function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  var lock = LockService.getScriptLock();
  // 避免多人同時寫入衝突，鎖定 10 秒
  lock.tryLock(10000);
  
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // === 自動初始化功能 ===
    // 檢查表單是否存在，若不存在則自動建立並加上標題
    initSheet(ss, 'Projects', ['id', 'name', 'contractor', 'coordinatorName', 'coordinatorEmail']);
    initSheet(ss, 'Violations', ['id', 'contractorName', 'projectName', 'violationDate', 'lectureDeadline', 'description', 'status', 'fileName']);

    var output = {};

    // 處理 POST 請求 (儲存或寄信)
    if (e && e.postData) {
      var data = JSON.parse(e.postData.contents);
      
      if (data.action === 'sendEmail') {
        MailApp.sendEmail({
          to: data.to,
          subject: data.subject,
          body: data.body
        });
        output.success = true;
        output.message = 'Email sent';
      } 
      else if (data.action === 'sync') {
        // 同步資料：如果前端有傳 projects 就更新，有傳 violations 就更新
        if (data.projects) {
          saveData(ss, 'Projects', data.projects);
        }
        if (data.violations) {
          saveData(ss, 'Violations', data.violations);
        }
        output.success = true;
      }
    }

    // 無論 GET 或 POST，最後都回傳最新的完整資料給前端更新畫面
    output.projects = loadData(ss, 'Projects');
    output.violations = loadData(ss, 'Violations');
    
    return ContentService.createTextOutput(JSON.stringify(output))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

// 初始化表單 Helper
function initSheet(ss, sheetName, headers) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow(headers); // 建立第一列標題
  } else {
    // 確保即使表單存在，如果全空也補上標題
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(headers);
    }
  }
}

// 讀取資料 Helper
function loadData(ss, sheetName) {
  var sheet = ss.getSheetByName(sheetName);
  // 如果只有標題列或全空，回傳空陣列
  if (sheet.getLastRow() <= 1) return [];

  var rows = sheet.getDataRange().getValues();
  var headers = rows[0];
  var data = [];
  
  for (var i = 1; i < rows.length; i++) {
    var row = rows[i];
    var obj = {};
    // 將陣列轉為 JSON 物件
    for (var j = 0; j < headers.length; j++) {
      var key = headers[j];
      var value = row[j];
      // 處理日期格式，轉為字串
      if (value instanceof Date) {
        obj[key] = Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM-dd");
      } else {
        obj[key] = value;
      }
    }
    data.push(obj);
  }
  return data;
}

// 儲存資料 Helper (全量更新模式)
function saveData(ss, sheetName, data) {
  var sheet = ss.getSheetByName(sheetName);
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  // 清除舊資料 (保留第一列標題)
  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).clearContent();
  }
  
  if (!data || data.length === 0) return;
  
  // 將 JSON 物件轉回陣列
  var newRows = data.map(function(item) {
    return headers.map(function(header) {
      return item[header] || '';
    });
  });
  
  // 寫入新資料
  sheet.getRange(2, 1, newRows.length, newRows[0].length).setValues(newRows);
}