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
  lock.tryLock(10000);

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // === 自動初始化功能 ===
    initSheet(ss, 'Projects', ['id', 'sequence', 'abbreviation', 'name', 'contractor', 'coordinatorName', 'coordinatorEmail']);
    initSheet(ss, 'Violations', ['id', 'contractorName', 'projectName', 'violationDate', 'lectureDeadline', 'description', 'status', 'fileName', 'fileUrl']);
    initSheet(ss, 'Users', ['email', 'password', 'name', 'role']);

    // 建立預設管理員帳號
    initDefaultAdmin(ss);

    var output = {};

    // 處理 POST 請求
    if (e && e.postData) {
      var data = JSON.parse(e.postData.contents);

      // ========== 登入驗證 ==========
      if (data.action === 'login') {
        output = handleLogin(ss, data.username, data.password);
        return jsonOutput(output);
      }

      // ========== Google 登入 ==========
      if (data.action === 'googleLogin') {
        output = handleGoogleLogin(ss, data.credential);
        return jsonOutput(output);
      }

      // ========== 寄送 Email ==========
      if (data.action === 'sendEmail') {
        MailApp.sendEmail({
          to: data.to,
          subject: data.subject,
          body: data.body
        });
        output.success = true;
        output.message = 'Email sent';
      }
      // ========== 資料同步 ==========
      else if (data.action === 'sync') {
        // 1. 處理檔案上傳
        var uploadedFileUrl = "";

        // 🔍 調試日誌
        Logger.log("=== 開始處理 sync 請求 ===");
        Logger.log("是否有 fileUpload: " + (data.fileUpload ? "是" : "否"));
        Logger.log("是否有 fileData: " + (data.fileUpload && data.fileUpload.fileData ? "是" : "否"));

        if (data.fileUpload && data.fileUpload.fileData) {
          Logger.log("📁 開始上傳檔案: " + data.fileUpload.fileData.name);
          Logger.log("檔案類型: " + data.fileUpload.fileData.type);
          Logger.log("Base64 長度: " + (data.fileUpload.fileData.base64 ? data.fileUpload.fileData.base64.length : 0));

          try {
            // 使用指定的 Google Drive 資料夾
            var folderId = "1dBe4PF_20gXVMqospMQfWxC76v3PeYtv";
            Logger.log("目標資料夾 ID: " + folderId);

            var folder = DriveApp.getFolderById(folderId);
            Logger.log("✅ 成功取得資料夾: " + folder.getName());

            var contentType = data.fileUpload.fileData.type;
            var blob = Utilities.newBlob(Utilities.base64Decode(data.fileUpload.fileData.base64), contentType, data.fileUpload.fileData.name);
            Logger.log("✅ Blob 建立成功");

            var file = folder.createFile(blob);
            Logger.log("✅ 檔案建立成功: " + file.getName());

            file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
            uploadedFileUrl = file.getUrl();
            Logger.log("✅ 檔案上傳完成，URL: " + uploadedFileUrl);

            // 回報上傳成功
            output.fileUploadStatus = {
              success: true,
              fileName: data.fileUpload.fileData.name,
              fileUrl: uploadedFileUrl
            };

            if (data.violations) {
              data.violations = data.violations.map(function (v) {
                if (v.id === data.fileUpload.violationId) {
                  v.fileUrl = uploadedFileUrl;
                }
                return v;
              });
            }
          } catch (err) {
            Logger.log("❌ 上傳失敗: " + err.toString());
            output.fileUploadStatus = {
              success: false,
              error: err.toString()
            };
          }
        } else {
          Logger.log("⏭️ 沒有檔案需要上傳");
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

    // 回傳最新資料
    output.projects = loadData(ss, 'Projects');
    output.violations = loadData(ss, 'Violations');

    return jsonOutput(output);

  } catch (error) {
    return jsonOutput({ error: error.toString() });
  } finally {
    lock.releaseLock();
  }
}

// ========== 登入處理函數 ==========
function handleLogin(ss, username, password) {
  var users = loadData(ss, 'Users');

  // 支援用 email 或 name 當作 username
  var user = users.find(function (u) {
    return (u.email === username || u.name === username) && u.password === password;
  });

  if (user) {
    return {
      success: true,
      user: {
        email: user.email,
        name: user.name,
        role: user.role
      }
    };
  }

  return {
    success: false,
    error: '帳號或密碼錯誤'
  };
}

// ========== Google 登入處理 ==========
function handleGoogleLogin(ss, credential) {
  try {
    // 解碼 JWT (不驗證簽章，因為我們信任 Google)
    var parts = credential.split('.');
    if (parts.length !== 3) {
      return { success: false, error: 'Invalid JWT format' };
    }

    // URL-safe base64 解碼：替換 - 為 +, _ 為 /, 並補齊 padding
    var base64Payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (base64Payload.length % 4 !== 0) {
      base64Payload += '=';
    }

    var payload = JSON.parse(Utilities.newBlob(Utilities.base64Decode(base64Payload)).getDataAsString());

    var googleEmail = payload.email;
    var googleName = payload.name || payload.email;

    // 檢查是否在白名單中
    var users = loadData(ss, 'Users');
    var user = users.find(function (u) {
      return u.email === googleEmail;
    });

    if (user) {
      return {
        success: true,
        user: {
          email: user.email,
          name: user.name || googleName,
          role: user.role
        }
      };
    }

    // 嚴格白名單制：未授權的 Google 帳號將被拒絕
    return {
      success: false,
      error: '此 Google 帳號 (' + googleEmail + ') 未被授權登入本系統，請聯絡管理員'
    };

  } catch (err) {
    return {
      success: false,
      error: 'Google 登入驗證失敗: ' + err.toString()
    };
  }
}

// ========== 初始化預設管理員 ==========
function initDefaultAdmin(ss) {
  var sheet = ss.getSheetByName('Users');
  if (sheet.getLastRow() <= 1) {
    // 沒有任何使用者，建立預設管理員
    var defaultAdmin = {
      email: 'admin@safetyguard.local',
      password: 'admin123',
      name: 'admin',
      role: 'admin'
    };
    saveData(ss, 'Users', [defaultAdmin]);
  }
}

// ========== Helper Functions ==========
function jsonOutput(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function initSheet(ss, sheetName, headers) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow(headers);
  } else {
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

// ========== 每日自動檢查到期日 ==========
function checkDueDates() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var violationSheet = ss.getSheetByName('Violations');
  var projectSheet = ss.getSheetByName('Projects');

  if (!violationSheet || !projectSheet) return;

  var violations = loadData(ss, 'Violations');
  var projects = loadData(ss, 'Projects');

  var coordinatorMap = {};
  projects.forEach(function (p) {
    if (p.name && p.coordinatorEmail) {
      coordinatorMap[p.name] = p.coordinatorEmail;
    }
  });

  var today = new Date();
  today.setHours(0, 0, 0, 0);

  violations.forEach(function (v) {
    if (v.status !== 'Completed' && v.lectureDeadline) {
      var deadline = new Date(v.lectureDeadline);
      deadline.setHours(0, 0, 0, 0);

      var diffTime = deadline - today;
      var diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

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