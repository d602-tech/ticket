// 請將此程式碼複製到 script.google.com 的編輯器中
// 部署為「網頁應用程式」時，請設定：
// 1. 執行身分: 我 (Me)
// 2. 誰可以存取: 任何人 (Anyone)

// ========== 欄位對照表 (English <-> Chinese) ==========
var HEADER_MAP = {
  'Violations': {
    'id': '此欄位請勿更動 (ID)',
    'contractorName': '承攬商名稱',
    'projectName': '工程名稱',
    'violationDate': '違規日期',
    'lectureDeadline': '講習期限',
    'description': '違規事項',
    'status': '辦理進度',
    'fileName': '罰單檔名',
    'fileUrl': '罰單連結',
    'emailCount': '寄信次數',
    'documentUrl': '簽辦連結',
    'scanFileName': '掃描檔名',
    'scanFileUrl': '掃描檔連結',
    'firstNotifyDate': '首次通知日',
    'secondNotifyDate': '二次通知日',
    'notifyStatus': '通知狀態',
    'managerEmail': '主管信箱',
    'scanFileHistory': '掃描檔歷程',
    'fineAmount': '罰款金額',
    'isMajorViolation': '重大違規',
    'participants': '參加人員',
    'completionDate': '完成日期'
  },
  'Projects': {
    'id': '此欄位請勿更動 (ID)',
    'sequence': '序號',
    'abbreviation': '工程簡稱',
    'name': '工程名稱',
    'contractor': '承攬商',
    'coordinatorName': '承辦人員',
    'coordinatorEmail': '承辦信箱',
    'hostTeam': '主辦工作隊',
    'managerName': '部門主管',
    'managerEmail': '主管信箱'
  },
  'Users': {
    'email': '帳號(Email)',
    'password': '密碼',
    'name': '姓名',
    'role': '權限角色'
  },
  'NotificationLogs': {
    'id': 'ID',
    'violationId': '違規ID',
    'notificationType': '通知類型',
    'recipientEmail': '收件人信箱',
    'recipientRole': '收件人角色',
    'sentAt': '發送時間',
    'status': '狀態'
  },
  'Fine': {
    'seq': '序號',
    'date': '開罰日期',
    'issueDate': '發文日期',
    'ticketNumber': '罰單編號',
    'projectName': '工程名稱',
    'hostTeam': '主辦工作隊',
    'issuer': '開單人',
    'contractor': '承攬商',
    'violationItem': '違規項目',
    'unitPrice': '單價',
    'unitPriceAdj': '單價修改',
    'unitPriceAdjNote': '單價修改備註',
    'count': '件數',
    'multiplier': '倍數',
    'subtotal': '單項金額',
    'cctvType': 'CCTV缺失種類',
    'totalAmount': '總金額',
    'amountNote': '罰單金額備註',
    'lectureDate': '違規講習日期',
    'note': '備註',
    'ticketType': '開單類型',
    'supervisor': '督導人',
    'allocation': '忠哥辦理罰單分配',
    'scanFileName': '罰單掃描檔名稱',
    'scanFileUrl': '罰單掃描檔連結'
  },
  'FineList': {
    'seq': '序號',
    'itemIndex': '項次',
    'violationItem': '違規項目',
    'shortContent': '縮短內容',
    'amount': '金額',
    'type': '種類',
    'unit': '單位'
  },
  'Section': {
    'hostTeam': '主辦工作隊',
    'title': '職稱',
    'name': '姓名',
    'email': '信箱'
  }
};

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

    var output = {};

    // 處理 POST 請求 — 先處理登入等輕量操作，避免不必要的初始化
    if (e && e.postData) {
      var data = JSON.parse(e.postData.contents);

      // ========== 登入驗證 (快速路徑，不需初始化) ==========
      if (data.action === 'login') {
        output = handleLogin(ss, data.username, data.password);
        return jsonOutput(output);
      }

      // ========== Google 登入 (快速路徑) ==========
      if (data.action === 'googleLogin') {
        output = handleGoogleLogin(ss, data.credential);
        return jsonOutput(output);
      }

      // ========== 取得使用者列表 (快速路徑) ==========
      if (data.action === 'getUsers') {
        if (data.adminRole !== 'admin') {
          return jsonOutput({ success: false, error: '無權限' });
        }
        output.users = loadData(ss, 'Users');
        output.success = true;
        return jsonOutput(output);
      }

      // ========== 取得全部資料 (快速路徑，跳過初始化) ==========
      if (data.action === 'getData') {
        output.projects = loadData(ss, 'Projects');
        output.violations = loadData(ss, 'Violations');
        output.fines = loadData(ss, 'Fine');
        output.fineList = loadData(ss, 'FineList');
        output.sections = loadData(ss, 'Section');
        output.users = loadData(ss, 'Users');
        output.success = true;
        return jsonOutput(output);
      }

      // ========== 上傳罰單掃描檔 ==========
      if (data.action === 'uploadFineScan') {
        try {
          var scanFolderId = '1tOlQ484YIcZ5iWCQTTeIxmMVx-hWvNxF';
          var scanFolder = DriveApp.getFolderById(scanFolderId);

          var fileData = data.fileData;
          var fileName = data.fileName || '罰單掃描_' + Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyyMMdd');
          var mimeType = data.mimeType || 'application/pdf';

          var blob = Utilities.newBlob(Utilities.base64Decode(fileData), mimeType, fileName);
          var uploadedFile = scanFolder.createFile(blob);
          uploadedFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

          var scanFileUrl = uploadedFile.getUrl();

          // 更新對應罰單記錄
          if (data.ticketNumber) {
            var fines = loadData(ss, 'Fine');
            fines = fines.map(function (f) {
              if (f.ticketNumber === data.ticketNumber) {
                f.scanFileName = fileName;
                f.scanFileUrl = scanFileUrl;
              }
              return f;
            });
            saveData(ss, 'Fine', fines);
          }

          output.success = true;
          output.scanFileUrl = scanFileUrl;
          output.scanFileName = fileName;
          output.fines = loadData(ss, 'Fine');
          return jsonOutput(output);
        } catch (e) {
          return jsonOutput({ success: false, error: e.toString() });
        }
      }
    }

    // === 自動初始化功能 (僅在非登入操作時執行) ===
    initSheetWithMap(ss, 'Projects');
    initSheetWithMap(ss, 'Violations');
    initSheetWithMap(ss, 'Users');
    initSheetWithMap(ss, 'NotificationLogs');
    initSheetWithMap(ss, 'Fine');
    initSheetWithMap(ss, 'FineList');
    initSheetWithMap(ss, 'Section');

    // 建立預設管理員帳號
    initDefaultAdmin(ss);

    // 處理其他 POST 請求
    if (e && e.postData) {
      var data = JSON.parse(e.postData.contents);

      // ========== 新增使用者 (Admin Only) ==========
      if (data.action === 'addUser') {
        if (data.adminRole !== 'admin') {
          return jsonOutput({ success: false, error: '無權限' });
        }

        var users = loadData(ss, 'Users');
        if (users.some(function (u) { return u.email === data.newUser.email; })) {
          return jsonOutput({ success: false, error: '該 Email 已存在' });
        }

        var newUser = {
          email: data.newUser.email,
          password: data.newUser.password,
          name: data.newUser.name,
          role: data.newUser.role || 'user'
        };

        users.push(newUser);
        saveData(ss, 'Users', users);
        output = { success: true, message: '使用者已新增' };
        return jsonOutput(output);
      }

      // ========== 寄送 Email ==========
      if (data.action === 'sendEmail') {
        var htmlBody = generateManualHtmlEmail({
          subject: data.subject,
          body: data.body,
          projectName: data.projectName || '-',
          contractorName: data.contractorName || '-',
          deadline: data.deadline || '-'
        });

        var users = loadData(ss, 'Users');
        var admins = users.filter(function (u) { return u.role === 'admin'; }).map(function (u) { return u.email; });
        var ccEmails = [];
        if (data.ccEmail) ccEmails.push(data.ccEmail);
        ccEmails = ccEmails.concat(admins);

        var uniqueCc = ccEmails.filter(function (item, pos) {
          return ccEmails.indexOf(item) == pos && item;
        });

        var emailOptions = {
          to: data.to,
          subject: data.subject,
          htmlBody: htmlBody
        };

        if (uniqueCc.length > 0) {
          emailOptions.cc = uniqueCc.join(',');
        }

        if (data.scanFileUrl) {
          try {
            var fileIdMatch = data.scanFileUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
            if (fileIdMatch && fileIdMatch[1]) {
              var scanFile = DriveApp.getFileById(fileIdMatch[1]);
              emailOptions.attachments = [scanFile.getBlob()];
              Logger.log('✅ 已加入附件: ' + scanFile.getName());
            }
          } catch (e) {
            Logger.log('⚠️ 無法加入附件: ' + e.message);
          }
        }

        MailApp.sendEmail(emailOptions);

        if (data.violationId) {
          updateViolationField(ss, data.violationId, 'emailCount', function (current) {
            return (current || 0) + 1;
          });
        }

        output.success = true;
        output.message = 'Email sent';
      }
      // ========== 簽辦生成 ==========
      else if (data.action === 'generateDocument') {
        try {
          var templateId = '1jClhcGQCH4iEeaTNbpSobzkhrlzOEkwMNicwPnc7ikk';
          var targetFolderId = '18rHdPCxrwnk7-l0k1ga1BigMBbEiZ3TA';

          function toROCDate(dateStr) {
            if (!dateStr) return '';
            var parts = dateStr.split('-');
            if (parts.length !== 3) return dateStr;
            var year = parseInt(parts[0]) - 1911;
            var month = parseInt(parts[1]);
            var day = parseInt(parts[2]);
            return year + '年' + month + '月' + day + '日';
          }

          var templateFile = DriveApp.getFileById(templateId);
          var targetFolder = DriveApp.getFolderById(targetFolderId);
          var fileName = '簽辦_' + data.projectName + '_' + Utilities.formatDate(new Date(), "Asia/Taipei", "yyyyMMdd");
          var copiedFile = templateFile.makeCopy(fileName, targetFolder);

          Logger.log('✅ 範本已複製: ' + copiedFile.getId());

          var doc = DocumentApp.openById(copiedFile.getId());
          var body = doc.getBody();

          body.replaceText('【工程名稱】', data.projectName || '');
          body.replaceText('【講習截止日期】', toROCDate(data.lectureDeadline));
          body.replaceText('【承攬商名稱】', data.contractorName || '');
          body.replaceText('【主辦工作隊】', data.hostTeam || '');

          doc.saveAndClose();
          copiedFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
          var documentUrl = copiedFile.getUrl();

          if (data.violationId) {
            updateViolationField(ss, data.violationId, 'documentUrl', function () { return documentUrl; });
          }

          output.success = true;
          output.documentUrl = documentUrl;
          output.documentName = fileName;

          Logger.log('✅ 簽辦已生成: ' + output.documentUrl);
        } catch (e) {
          Logger.log('❌ 簽辦生成失敗: ' + e.message);
          output.success = false;
          output.error = e.message;
        }
      }
      // ========== 上傳簽辦掃描檔 ==========
      else if (data.action === 'uploadScanFile') {
        try {
          var scanFolderId = '1tOlQ484YIcZ5iWCQTTeIxmMVx-hWvNxF';
          var scanFolder = DriveApp.getFolderById(scanFolderId);

          var fileData = data.fileData;
          var fileName = data.fileName || '掃描檔_' + Utilities.formatDate(new Date(), "Asia/Taipei", "yyyyMMdd");
          var mimeType = data.mimeType || 'application/pdf';
          var replaceReason = data.replaceReason || null;

          var blob = Utilities.newBlob(Utilities.base64Decode(fileData), mimeType, fileName);
          var uploadedFile = scanFolder.createFile(blob);
          uploadedFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

          var scanFileUrl = uploadedFile.getUrl();

          if (data.violationId) {
            updateViolationScanFile(ss, data.violationId, fileName, scanFileUrl, replaceReason);
          }

          output.success = true;
          output.scanFileUrl = scanFileUrl;
          output.scanFileName = fileName;
          output.wasReplaced = !!replaceReason;
          Logger.log('✅ 掃描檔已上傳: ' + scanFileUrl);
        } catch (e) {
          Logger.log('❌ 掃描檔上傳失敗: ' + e.message);
          output.success = false;
          output.error = e.message;
        }
      }
      // ========== 資料同步 ==========
      else if (data.action === 'sync') {
        var uploadedFileUrl = "";

        // 檔案上傳部分 (維持原樣)
        if (data.fileUpload && data.fileUpload.fileData) {
          try {
            var folderId = "1dBe4PF_20gXVMqospMQfWxC76v3PeYtv";
            var folder = DriveApp.getFolderById(folderId);

            var originalName = data.fileUpload.fileData.name;
            var contentType = data.fileUpload.fileData.type;
            var fileExt = originalName.substring(originalName.lastIndexOf('.'));

            var customFileName = originalName;
            if (data.fileUpload.projectInfo) {
              var seq = data.fileUpload.projectInfo.sequence || '00';
              var abbr = data.fileUpload.projectInfo.abbreviation || '未命名';
              var vDate = data.fileUpload.violationDate || Utilities.formatDate(new Date(), "Asia/Taipei", "yyyyMMdd");
              customFileName = seq + "_" + abbr + "_" + vDate + fileExt;
            }

            var blob = Utilities.newBlob(Utilities.base64Decode(data.fileUpload.fileData.base64), contentType, customFileName);
            var file = folder.createFile(blob);
            file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
            uploadedFileUrl = file.getUrl();

            output.fileUploadStatus = {
              success: true,
              fileName: customFileName,
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
            output.fileUploadStatus = {
              success: false,
              error: err.toString()
            };
          }
        }

        // 同步資料
        if (data.projects) {
          saveData(ss, 'Projects', data.projects);
        }
        if (data.violations) {
          saveData(ss, 'Violations', data.violations);
        }
        if (data.violations) {
          saveData(ss, 'Violations', data.violations);
        }
        if (data.fines) {
          saveData(ss, 'Fine', data.fines);
        }
        if (data.sections) {
          saveData(ss, 'Section', data.sections);
        }
        if (data.users) { // Support saving users
          saveData(ss, 'Users', data.users);
        }
        output.success = true;
      }
    }

    // 回傳最新資料
    output.projects = loadData(ss, 'Projects');
    output.violations = loadData(ss, 'Violations');
    output.fines = loadData(ss, 'Fine');
    output.fineList = loadData(ss, 'FineList');
    output.sections = loadData(ss, 'Section');
    output.users = loadData(ss, 'Users');

    return jsonOutput(output);

  } catch (error) {
    return jsonOutput({ error: error.toString() });
  } finally {
    lock.releaseLock();
  }
}

// ========== Setup Tool (Phase 10) ==========

function setupFineSystem() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1. 初始化 Sheet 標題
  var fineSheet = initSheetWithMap(ss, 'Fine');
  var fineListSheet = initSheetWithMap(ss, 'FineList');
  var sectionSheet = initSheetWithMap(ss, 'Section');

  // 2. 設定下拉選單 (Data Validation)

  // (A) 工程名稱 -> Fine!E:E (來自 Projects!D:D)
  var projectSheet = ss.getSheetByName('Projects'); // 注意: Projects 標題是中文, 但 Sheet 名仍是 Projects
  if (projectSheet) {
    var range = projectSheet.getRange('D2:D'); // 假設 D 欄是工程名稱
    var rule = SpreadsheetApp.newDataValidation().requireValueInRange(range).build();
    fineSheet.getRange('E2:E').setDataValidation(rule);
  }

  // (B) 開單人 -> Fine!G:G (來自 Section!C:C)
  var sectionRange = sectionSheet.getRange('C2:C');
  var sectionRule = SpreadsheetApp.newDataValidation().requireValueInRange(sectionRange).build();
  fineSheet.getRange('G2:G').setDataValidation(sectionRule);

  // (C) 違規項目 -> Fine!I:I (來自 FineList!C:C)
  var fineListRange = fineListSheet.getRange('C2:C');
  var fineListRule = SpreadsheetApp.newDataValidation().requireValueInRange(fineListRange).build();
  fineSheet.getRange('I2:I').setDataValidation(fineListRule);

  // (D) CCTV 缺失種類 -> Fine!P:P (Hardcoded)
  var cctvRule = SpreadsheetApp.newDataValidation().requireValueInList(['設備', '現檢員', '工安組']).build();
  fineSheet.getRange('P2:P').setDataValidation(cctvRule);

  // (E) 開單類型 -> Fine!U:U
  var ticketTypes = ['走動管理', 'CCTV', '工安查核', '現檢員', '監造', '營建處', '勞檢'];
  var ticketRule = SpreadsheetApp.newDataValidation().requireValueInList(ticketTypes).build();
  fineSheet.getRange('U2:U').setDataValidation(ticketRule);

  // (F) 忠哥辦理罰單分配 -> Fine!W:W
  var allocTypes = ['處長', '副處長', '課長', '部門經理', '工安經理', '工安課長', '現檢員'];
  var allocRule = SpreadsheetApp.newDataValidation().requireValueInList(allocTypes).build();
  fineSheet.getRange('W2:W').setDataValidation(allocRule);

  // 3. 設定公式 (Formulas) - 設定在第 2 列並向下拖曳 (或使用 ArrayFormula)
  // 為了簡單起見，我們將公式設定在第 2 列，使用者可以根據需要複製

  // (A) 單價 (J2) =IFERROR(VLOOKUP(I2, FineList!C:E, 3, 0), "")
  fineSheet.getRange('J2').setFormula('=IFERROR(VLOOKUP(I2, FineList!C:E, 3, 0), "")');

  // (B) 單項金額 (O2) =IFERROR(IF(K2="", J2*M2*IF(N2="", 1, N2), K2*M2*IF(N2="", 1, N2)), "")
  fineSheet.getRange('O2').setFormula('=IFERROR(IF(K2="", J2*M2*IF(N2="", 1, N2), K2*M2*IF(N2="", 1, N2)), "")');

  // (C) 總金額 (P2) =IF(COUNTIF($D$2:D2, D2)=1, SUMIF(D:D, D2, O:O), "")
  fineSheet.getRange('P2').setFormula('=IF(COUNTIF($D$2:D2, D2)=1, SUMIF(D:D, D2, O:O), "")');

  // (D) 罰單金額備註 (R2)
  // 修正 VLOOKUP 欄位已符合 FineList
  var noteFormula = '=IFNA(IF(K2="",TEXT(J2,"#,00"),TEXT(K2,"#,00"))&"元*"&M2&"("&VLOOKUP(I2, FineList!C:G, 5, 0)&")"&IF(N2="","","*加重"&N2&"倍")&"="&TEXT(O2,"#,00")&"元","")';
  fineSheet.getRange('R2').setFormula(noteFormula);

  Logger.log('✅ Fine System Setup Complete');
}

// ========== 登入/驗證 Helpers ==========

function handleLogin(ss, username, password) {
  var users = loadData(ss, 'Users');
  var user = users.find(function (u) {
    return (u.email === username || u.name === username) && u.password === password;
  });

  if (user) {
    return {
      success: true,
      user: { email: user.email, name: user.name, role: user.role }
    };
  }
  return { success: false, error: '帳號或密碼錯誤' };
}

function handleGoogleLogin(ss, credential) {
  try {
    var parts = credential.split('.');
    if (parts.length !== 3) return { success: false, error: 'Invalid JWT' };

    var base64Payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (base64Payload.length % 4 !== 0) base64Payload += '=';
    var payload = JSON.parse(Utilities.newBlob(Utilities.base64Decode(base64Payload)).getDataAsString());

    var googleEmail = payload.email;
    var googleName = payload.name || payload.email;

    // 使用 loadData 會自動將中文標題轉為英文 Key (email, name, role)
    var users = loadData(ss, 'Users');
    var user = users.find(function (u) { return u.email === googleEmail; });

    if (user) {
      return {
        success: true,
        user: { email: user.email, name: user.name || googleName, role: user.role }
      };
    }
    return { success: false, error: '此 Google 帳號 (' + googleEmail + ') 未被授權登入本系統，請聯絡管理員' };
  } catch (err) {
    return { success: false, error: 'Google 登入驗證失敗: ' + err.toString() };
  }
}

function initDefaultAdmin(ss) {
  var sheet = ss.getSheetByName('Users');
  if (sheet.getLastRow() <= 1) {
    var defaultAdmin = {
      email: 'admin@safetyguard.local',
      password: 'admin123',
      name: 'admin',
      role: 'admin'
    };
    saveData(ss, 'Users', [defaultAdmin]);
  }
}

// ========== 資料映射核心功能 ==========

// 取得 Sheet 對應的中文標題陣列 (照 HEADER_MAP 定義順序)
function getHeaders(sheetName) {
  var map = HEADER_MAP[sheetName];
  if (!map) return [];
  return Object.keys(map).map(function (key) { return map[key]; });
}

// 初始化 Sheet (使用中文標題)
function initSheetWithMap(ss, sheetName) {
  var chineseHeaders = getHeaders(sheetName);
  var sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow(chineseHeaders);
  } else {
    // 檢查標題列是否需要補齊
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(chineseHeaders);
    } else {
      var currentHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      if (currentHeaders.length < chineseHeaders.length) {
        // 補上缺少的標題
        var missingHeaders = chineseHeaders.slice(currentHeaders.length);
        if (missingHeaders.length > 0) {
          sheet.getRange(1, currentHeaders.length + 1, 1, missingHeaders.length).setValues([missingHeaders]);
        }
      }
    }
  }
  return sheet;
}

// 讀取資料 (Sheet 中文 -> JSON 英文)
function loadData(ss, sheetName) {
  var sheet = ss.getSheetByName(sheetName);
  // 如果 Sheet 沒資料，回傳空陣列
  if (!sheet || sheet.getLastRow() <= 1) return [];

  var rows = sheet.getDataRange().getValues();
  var sheetHeaders = rows[0]; // 實際 Sheet 上的標題 (可能是中文)

  // 建立 反向映射表 (中文標題 -> 英文 Key)
  var map = HEADER_MAP[sheetName];
  var reverseMap = {};
  if (map) {
    for (var key in map) {
      reverseMap[map[key]] = key;
    }
  }

  var data = [];
  for (var i = 1; i < rows.length; i++) {
    var row = rows[i];
    var obj = {};
    for (var j = 0; j < sheetHeaders.length; j++) {
      var headerName = sheetHeaders[j];
      // 關鍵修復：確保能找到對應的英文 Key
      var engKey = reverseMap[headerName];

      // 如果找不到對應的英文 Key，可能是舊的英文標題，或者未定義的欄位
      // 為了相容性，如果找不到映射，就直接使用 headerName 作為 Key
      if (!engKey) {
        engKey = headerName;
      }

      var value = row[j];

      if (value instanceof Date) {
        obj[engKey] = Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM-dd");
      } else {
        obj[engKey] = value;
      }
    }
    data.push(obj);
  }
  return data;
}

// 儲存資料 (JSON 英文 -> Sheet 中文)
function saveData(ss, sheetName, data) {
  var sheet = ss.getSheetByName(sheetName);
  // 重新取得目前 Sheet 上的標題順序，確保寫入位置正確
  var sheetHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  var map = HEADER_MAP[sheetName];

  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).clearContent();
  }

  if (!data || data.length === 0) return;

  var newRows = data.map(function (item) {
    return sheetHeaders.map(function (headerName) {
      // headerName 是中文，要找回對應的英文 Key 才能從 item 取值
      var engKey = null;
      if (map) {
        for (var k in map) {
          if (map[k] === headerName) {
            engKey = k;
            break;
          }
        }
      }
      // 如果找不到對應，表示 Sheet 標題可能是英文 (舊資料) 或未定義
      var key = engKey || headerName;
      return item[key] || '';
    });
  });

  sheet.getRange(2, 1, newRows.length, newRows[0].length).setValues(newRows);
}

// ========== 單一欄位更新 Helper (使用中文標題查找 Column) ==========

function getColumnIndex(sheet, headerName) {
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  return headers.indexOf(headerName);
}

function updateViolationField(ss, violationId, engFieldKey, valueUpdater) {
  var sheet = ss.getSheetByName('Violations');
  var map = HEADER_MAP['Violations'];
  var idHeader = map['id'];
  var targetHeader = map[engFieldKey];

  var idCol = getColumnIndex(sheet, idHeader);
  var targetCol = getColumnIndex(sheet, targetHeader);

  if (idCol === -1 || targetCol === -1) return;

  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][idCol] === violationId) {
      var currentValue = data[i][targetCol];
      var newValue = typeof valueUpdater === 'function' ? valueUpdater(currentValue) : valueUpdater;
      sheet.getRange(i + 1, targetCol + 1).setValue(newValue);
      break;
    }
  }
}

function updateViolationScanFile(ss, violationId, fileName, fileUrl, replaceReason) {
  var sheet = ss.getSheetByName('Violations');
  var map = HEADER_MAP['Violations'];

  var idHeader = map['id'];
  var nameHeader = map['scanFileName'];
  var urlHeader = map['scanFileUrl'];
  var historyHeader = map['scanFileHistory'];

  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var idCol = headers.indexOf(idHeader);
  var nameCol = headers.indexOf(nameHeader);
  var urlCol = headers.indexOf(urlHeader);
  var historyCol = headers.indexOf(historyHeader);

  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][idCol] === violationId) {
      // 記錄歷史
      if (replaceReason && historyCol !== -1) {
        var oldUrl = data[i][urlCol];
        var oldName = data[i][nameCol];
        if (oldUrl) {
          var historyJson = data[i][historyCol] || '[]';
          var history = [];
          try { history = JSON.parse(historyJson); } catch (e) { }
          history.push({
            date: Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd HH:mm'),
            reason: replaceReason,
            oldFileName: oldName,
            oldUrl: oldUrl,
            newFileName: fileName,
            newUrl: fileUrl
          });
          sheet.getRange(i + 1, historyCol + 1).setValue(JSON.stringify(history));
        }
      }

      sheet.getRange(i + 1, nameCol + 1).setValue(fileName);
      sheet.getRange(i + 1, urlCol + 1).setValue(fileUrl);
      break;
    }
  }
}

// ========== 移轉工具 (執行一次即可) ==========

function updateHeadersToChinese() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // 更新使用者定義的 Sheet
  ['Violations', 'Projects', 'Users', 'NotificationLogs', 'Fine', 'FineList', 'Section'].forEach(function (sheetName) {
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) return;

    var map = HEADER_MAP[sheetName];
    if (!map) return;

    // 讀取目前第一列標題
    var lastCol = sheet.getLastColumn();
    if (lastCol === 0) return;

    var range = sheet.getRange(1, 1, 1, lastCol);
    var headers = range.getValues()[0];

    var newHeaders = headers.map(function (h) {
      // 如果目前標題是英文 Key，就轉成中文
      return map[h] || h;
    });

    range.setValues([newHeaders]);
    Logger.log('✅ ' + sheetName + ' 標題已更新為中文');
  });
}

// ========== 輔助功能 ==========

function jsonOutput(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function generateManualHtmlEmail(data) {
  return generateHtmlEmail('manual',
    { contractorName: data.contractorName },
    { name: data.projectName },
    'manual'
  ) + '<hr><p>內容：' + data.body + '</p>';
}

// 簡化版每日檢查 (需配合中文標題更新)
function checkDueDates() {
  // 建議重新對應邏輯再開啟此功能
  // 因 checkDueDates 依賴欄位讀取，loadData 已經會自動轉回英文 Key
  // 所以這裡的邏輯其實不用大改，只要確保 loadData 正常運作即可
  Logger.log('checkDueDates: 請確認 loadData 運作正常後再啟用排程');
}