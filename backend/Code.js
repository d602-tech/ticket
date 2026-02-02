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
    initSheet(ss, 'Projects', ['id', 'name', 'contractor', 'coordinatorName', 'coordinatorEmail']);
    initSheet(ss, 'Violations', ['id', 'contractorName', 'projectName', 'violationDate', 'lectureDeadline', 'description', 'status', 'fileName', 'fileUrl']);

    var output = {};

    // 處理 POST 請求 (儲存、寄信、上傳)
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
        // 1. 處理檔案上傳 (如果有的話)
        var uploadedFileUrl = "";
        if (data.fileUpload && data.fileUpload.fileData) {
          try {
            // 建立資料夾 (如果不存在)
            var folderName = "SafetyGuard_Uploads";
            var folders = DriveApp.getFoldersByName(folderName);
            var folder;
            if (folders.hasNext()) {
              folder = folders.next();
            } else {
              folder = DriveApp.createFolder(folderName);
            }

            // 解碼 Base64 並建立檔案
            var contentType = data.fileUpload.fileData.type;
            var blob = Utilities.newBlob(Utilities.base64Decode(data.fileUpload.fileData.base64), contentType, data.fileUpload.fileData.name);
            var file = folder.createFile(blob);

            // 設定檔案為公開檢視 (或保持私有但只有使用者能看，這裡設為 Anyone with link 方便測試)
            file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

            uploadedFileUrl = file.getUrl(); // 取得檔案連結

            // 更新該筆違規的 fileUrl
            if (data.violations) {
              data.violations = data.violations.map(function (v) {
                if (v.id === data.fileUpload.violationId) {
                  v.fileUrl = uploadedFileUrl;
                }
                return v;
              });
            }

          } catch (err) {
            // 檔案上傳失敗不應阻擋資料儲存
            output.fileError = err.toString();
          }
        }

        // 2. 同步資料
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

// 每日自動檢查到期日 (請設定 Time-driven Trigger)
function checkDueDates() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var violationSheet = ss.getSheetByName('Violations');
  var projectSheet = ss.getSheetByName('Projects');

  if (!violationSheet || !projectSheet) return;

  var violations = loadData(ss, 'Violations');
  var projects = loadData(ss, 'Projects');

  // 建立專案與承辦人對照表
  var coordinatorMap = {};
  projects.forEach(function (p) {
    if (p.name && p.coordinatorEmail) {
      coordinatorMap[p.name] = p.coordinatorEmail;
    }
  });

  var today = new Date();
  today.setHours(0, 0, 0, 0);

  violations.forEach(function (v) {
    // 只檢查未完成的
    if (v.status !== 'Completed' && v.lectureDeadline) {
      var deadline = new Date(v.lectureDeadline);
      deadline.setHours(0, 0, 0, 0);

      // 計算相差天數
      var diffTime = deadline - today;
      var diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      // 剛好剩餘 5 天時發送通知
      if (diffDays === 5) {
        var email = coordinatorMap[v.projectName];
        if (email) {
          var subject = '【提醒】違規講習即將到期：' + v.projectName;
          var body = '承辦人員您好，\n\n' +
            '專案「' + v.projectName + '」有一筆違規紀錄尚未完成講習。\n' +
            '違規事項：' + v.description + '\n' +
            '講習截止日：' + v.lectureDeadline + '\n\n' +
            '請儘速安排辦理，謝謝。\n\n' +
            '(此為系統自動發送)';

          MailApp.sendEmail({
            to: email,
            subject: subject,
            body: body
          });
        }
      }
    }
  });
}

// 初始化表單 Helper
function initSheet(ss, sheetName, headers) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow(headers);
  } else {
    // 簡單檢查欄位數量，若不足則補齊 (實際運作若有更換欄位結構可能需手動調整)
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(headers);
    } else {
      var currentHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      if (currentHeaders.length < headers.length) {
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      }
    }
  }
}

// 讀取資料 Helper
function loadData(ss, sheetName) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() <= 1) return [];

  var rows = sheet.getDataRange().getValues();
  var headers = rows[0];
  var data = [];

  for (var i = 1; i < rows.length; i++) {
    var row = rows[i];
    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      var key = headers[j];
      var value = row[j];
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

// 儲存資料 Helper (全量更新)
function saveData(ss, sheetName, data) {
  var sheet = ss.getSheetByName(sheetName);
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).clearContent();
  }

  if (!data || data.length === 0) return;

  var newRows = data.map(function (item) {
    return headers.map(function (header) {
      return item[header] || '';
    });
  });

  sheet.getRange(2, 1, newRows.length, newRows[0].length).setValues(newRows);
}