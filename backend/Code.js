// 請將此程式碼複製到 script.google.com 的編輯器中
// 部署為「網頁應用程式」時，請設定：
// 1. 執行身分: 我 (Me)
// 2. 誰可以存取: 任何人 (Anyone)

var CONFIG = {
  SCAN_FOLDER_ID: '1tOlQ484YIcZ5iWCQTTeIxmMVx-hWvNxF',
  TEMPLATE_ID: '1jClhcGQCH4iEeaTNbpSobzkhrlzOEkwMNicwPnc7ikk',
  TARGET_FOLDER_ID: '18rHdPCxrwnk7-l0k1ga1BigMBbEiZ3TA',
  UPLOAD_FOLDER_ID: '1dBe4PF_20gXVMqospMQfWxC76v3PeYtv'
};

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
    'contractNumber': '契約編號',
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
  lock.tryLock(5000); // 縮短 Lock 時間

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var output = {};

    if (e && e.postData) {
      var data = JSON.parse(e.postData.contents);
      var action = data.action;

      switch (action) {
        case 'login':
          return jsonOutput(handleLogin(ss, data.username, data.password));

        case 'googleLogin':
          return jsonOutput(handleGoogleLogin(ss, data.credential));

        case 'getUsers':
          if (data.adminRole !== 'admin') {
            return jsonOutput({ success: false, error: '無權限' });
          }
          return jsonOutput({ success: true, users: loadData(ss, 'Users') });

        case 'getData':
          return jsonOutput({
            success: true,
            projects: loadData(ss, 'Projects'),
            violations: loadData(ss, 'Violations'),
            fines: loadData(ss, 'Fine'),
            fineList: loadData(ss, 'FineList'),
            sections: loadData(ss, 'Section'),
            users: loadData(ss, 'Users')
          });

        case 'updateViolation':
          ensureSheetInitialized(ss, 'Violations');
          return jsonOutput(handleUpdateItem(ss, 'Violations', data.violation));

        case 'deleteViolation':
          ensureSheetInitialized(ss, 'Violations');
          return jsonOutput(handleDeleteItem(ss, 'Violations', data.id));

        case 'updateProject':
          ensureSheetInitialized(ss, 'Projects');
          return jsonOutput(handleUpdateItem(ss, 'Projects', data.project));

        case 'deleteProject':
          ensureSheetInitialized(ss, 'Projects');
          return jsonOutput(handleDeleteItem(ss, 'Projects', data.id));

        case 'uploadFineScan':
          ensureSheetInitialized(ss, 'Fine');
          ensureSheetInitialized(ss, 'Projects');
          return jsonOutput(handleUploadFineScan(ss, data));

        case 'addUser':
          ensureSheetInitialized(ss, 'Users');
          return jsonOutput(handleAddUser(ss, data));

        case 'sendEmail':
          ensureSheetInitialized(ss, 'Violations');
          return jsonOutput(handleSendEmail(ss, data));

        case 'generateDocument':
          ensureSheetInitialized(ss, 'Violations');
          return jsonOutput(handleGenerateDocument(ss, data));

        case 'uploadScanFile':
          ensureSheetInitialized(ss, 'Violations');
          return jsonOutput(handleUploadScanFile(ss, data));

        case 'uploadEvidence':
          ensureSheetInitialized(ss, 'Violations');
          return jsonOutput(handleUploadEvidence(ss, data));

        case 'sync':
          // Fallback for full sync
          initAllSheets(ss);
          return jsonOutput(handleFullSync(ss, data));

        default:
          return jsonOutput({ success: false, error: 'Unknown action: ' + action });
      }
    } else {
      return jsonOutput({ success: false, error: 'No Post Data' });
    }

  } catch (error) {
    return jsonOutput({ success: false, error: error.toString() });
  } finally {
    lock.releaseLock();
  }
}

// ========== Incremental Update Helpers ==========

function handleUpdateItem(ss, sheetName, item) {
  if (!item || !item.id) return { success: false, error: 'No item or ID provided' };

  var sheet = ss.getSheetByName(sheetName);
  var map = HEADER_MAP[sheetName];
  var idHeader = map['id'] || 'ID';
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var idColIndex = headers.indexOf(idHeader);

  if (idColIndex === -1) return { success: false, error: 'ID column not found' };

  var data = sheet.getDataRange().getValues();
  var rowIndex = -1;

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idColIndex]) === String(item.id)) {
      rowIndex = i + 1;
      break;
    }
  }

  var rowData = [];
  var newRow = false;

  if (rowIndex === -1) {
    rowIndex = sheet.getLastRow() + 1;
    newRow = true;
  }

  // Prepare row data
  // Important: For Update, we should merge with existing data if possible, 
  // but here we assume the frontend sends the *complete* object.
  rowData = headers.map(function (headerName) {
    var key = getKeyByValue(map, headerName) || headerName;
    // Handle Date formatting
    var val = item[key];
    if (val === undefined || val === null) return '';
    return val;
  });

  if (newRow) {
    sheet.appendRow(rowData);
  } else {
    sheet.getRange(rowIndex, 1, 1, rowData.length).setValues([rowData]);
  }

  // Return updated item (or success status)
  // To be perfectly safe, we might reload the item, but for speed we return what we wrote
  return { success: true, item: item, action: newRow ? 'create' : 'update' };
}

function handleDeleteItem(ss, sheetName, id) {
  var sheet = ss.getSheetByName(sheetName);
  var map = HEADER_MAP[sheetName];
  var idHeader = map['id'] || 'ID';
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var idColIndex = headers.indexOf(idHeader);

  if (idColIndex === -1) return { success: false, error: 'ID column not found' };

  var data = sheet.getDataRange().getValues();
  var rowIndex = -1;

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idColIndex]) === String(id)) {
      rowIndex = i + 1;
      break;
    }
  }

  if (rowIndex !== -1) {
    sheet.deleteRow(rowIndex);
    return { success: true, id: id };
  }
  return { success: false, error: 'Item not found' };
}

// ========== Legacy/Specific Handlers ==========

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

function handleFullSync(ss, data) {
  var uploadedFileUrl = "";

  // File Upload (Legacy support)
  if (data.fileUpload && data.fileUpload.fileData) {
    try {
      var folder = DriveApp.getFolderById(CONFIG.UPLOAD_FOLDER_ID);
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

      if (data.violations) {
        data.violations = data.violations.map(function (v) {
          if (v.id === data.fileUpload.violationId) {
            v.fileUrl = uploadedFileUrl;
          }
          return v;
        });
      }
    } catch (err) {
      return { success: false, error: err.toString() };
    }
  }

  if (data.projects) saveData(ss, 'Projects', data.projects);
  if (data.violations) saveData(ss, 'Violations', data.violations);
  if (data.fines) saveData(ss, 'Fine', data.fines);
  if (data.sections) saveData(ss, 'Section', data.sections);
  if (data.users) saveData(ss, 'Users', data.users);

  return {
    success: true,
    projects: loadData(ss, 'Projects'),
    violations: loadData(ss, 'Violations'),
    fines: loadData(ss, 'Fine'),
    fineList: loadData(ss, 'FineList'),
    sections: loadData(ss, 'Section'),
    users: loadData(ss, 'Users'),
    fileUploadStatus: uploadedFileUrl ? { success: true, fileUrl: uploadedFileUrl, fileName: customFileName } : undefined
  };
}

function handleUploadFineScan(ss, data) {
  try {
    var scanFolder = DriveApp.getFolderById(CONFIG.SCAN_FOLDER_ID);
    var fileData = data.fileData;
    var mimeType = data.mimeType || 'application/pdf';

    var ext = (data.originalName || 'file.pdf').split('.').pop() || 'pdf';
    var fineRecords = loadData(ss, 'Fine');
    var ticketFines = fineRecords.filter(function (f) { return f.ticketNumber === data.ticketNumber; });
    var totalAmount = ticketFines.reduce(function (sum, f) { return sum + (Number(f.subtotal) || 0); }, 0);
    var projectName = ticketFines.length > 0 ? ticketFines[0].projectName : '';

    var projLabel = projectName || '未知工程';
    if (projectName) {
      var projects = loadData(ss, 'Projects');
      var proj = projects.find(function (p) { return p.name === projectName; });
      if (proj) {
        var seq = String(proj.sequence || '').padStart(3, '0');
        projLabel = seq + (proj.abbreviation || proj.name);
      }
    }

    var formattedAmount = totalAmount.toLocaleString ? totalAmount.toLocaleString() : String(totalAmount);
    var fileName = projLabel + '_$' + formattedAmount + '_' + (data.ticketNumber || 'unknown') + '.' + ext;

    var blob = Utilities.newBlob(Utilities.base64Decode(fileData), mimeType, fileName);
    var uploadedFile = scanFolder.createFile(blob);
    uploadedFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    var scanFileUrl = uploadedFile.getUrl();

    if (data.ticketNumber) {
      fineRecords = fineRecords.map(function (f) {
        if (f.ticketNumber === data.ticketNumber) {
          f.scanFileName = fileName;
          f.scanFileUrl = scanFileUrl;
        }
        return f;
      });
      saveData(ss, 'Fine', fineRecords);
    }

    return {
      success: true,
      scanFileUrl: scanFileUrl,
      scanFileName: fileName,
      fines: loadData(ss, 'Fine')
    };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

function handleAddUser(ss, data) {
  var users = loadData(ss, 'Users');
  if (users.some(function (u) { return u.email === data.newUser.email; })) {
    return { success: false, error: '該 Email 已存在' };
  }
  var newUser = {
    email: data.newUser.email,
    password: data.newUser.password,
    name: data.newUser.name,
    role: data.newUser.role || 'user'
  };
  users.push(newUser);
  saveData(ss, 'Users', users);
  return { success: true, message: '使用者已新增' };
}

function handleSendEmail(ss, data) {
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
      }
    } catch (e) {
      Logger.log('Attachment fail: ' + e.message);
    }
  }

  MailApp.sendEmail(emailOptions);

  if (data.violationId) {
    updateViolationField(ss, data.violationId, 'emailCount', function (current) {
      return (current || 0) + 1;
    });
  }
  return { success: true, message: 'Email sent' };
}

function handleGenerateDocument(ss, data) {
  try {
    var templateFile = DriveApp.getFileById(CONFIG.TEMPLATE_ID);
    var targetFolder = DriveApp.getFolderById(CONFIG.TARGET_FOLDER_ID);

    function toROCDate(dateStr) {
      if (!dateStr) return '';
      var parts = dateStr.split('-');
      if (parts.length !== 3) return dateStr;
      var year = parseInt(parts[0]) - 1911;
      return year + '年' + month + '月' + day + '日'; // Note: month/day were missing in scope
    }
    // Fix Scope for toROCDate
    function toROCDateFixed(dateStr) {
      if (!dateStr) return '';
      var parts = dateStr.split('-');
      if (parts.length !== 3) return dateStr;
      var year = parseInt(parts[0]) - 1911;
      var month = parseInt(parts[1]);
      var day = parseInt(parts[2]);
      return year + '年' + month + '月' + day + '日';
    }

    var fileName = '簽辦_' + data.projectName + '_' + Utilities.formatDate(new Date(), "Asia/Taipei", "yyyyMMdd");
    var copiedFile = templateFile.makeCopy(fileName, targetFolder);

    var doc = DocumentApp.openById(copiedFile.getId());
    var body = doc.getBody();

    body.replaceText('【工程名稱】', data.projectName || '');
    body.replaceText('【講習截止日期】', toROCDateFixed(data.lectureDeadline));
    body.replaceText('【承攬商名稱】', data.contractorName || '');
    body.replaceText('【主辦工作隊】', data.hostTeam || '');

    doc.saveAndClose();
    copiedFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    var documentUrl = copiedFile.getUrl();

    if (data.violationId) {
      updateViolationField(ss, data.violationId, 'documentUrl', function () { return documentUrl; });
    }

    return { success: true, documentUrl: documentUrl, documentName: fileName };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function handleUploadScanFile(ss, data) {
  try {
    var scanFolder = DriveApp.getFolderById(CONFIG.SCAN_FOLDER_ID);
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

    return { success: true, scanFileUrl: scanFileUrl, scanFileName: fileName, wasReplaced: !!replaceReason };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function handleUploadEvidence(ss, data) {
  try {
    var folder = DriveApp.getFolderById(CONFIG.UPLOAD_FOLDER_ID);
    var originalName = data.fileName;
    var mimeType = data.mimeType || 'image/jpeg';
    var fileExt = originalName.indexOf('.') !== -1 ? originalName.substring(originalName.lastIndexOf('.')) : '.jpg';

    var customFileName = originalName;
    if (data.projectInfo) {
      var seq = data.projectInfo.sequence || '00';
      var abbr = data.projectInfo.abbreviation || '未命名';
      var vDate = data.violationDate || Utilities.formatDate(new Date(), "Asia/Taipei", "yyyyMMdd");
      customFileName = seq + "_" + abbr + "_" + vDate + fileExt;
    }

    var blob = Utilities.newBlob(Utilities.base64Decode(data.fileData), mimeType, customFileName);
    var file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    var fileUrl = file.getUrl();

    if (data.violationId) {
      updateViolationField(ss, data.violationId, 'fileUrl', function () { return fileUrl; });
      updateViolationField(ss, data.violationId, 'fileName', function () { return customFileName; });
    }

    return { success: true, fileUrl: fileUrl, fileName: customFileName };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

// ========== Sheet Initialization ==========

function ensureSheetInitialized(ss, sheetName) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    initSheetWithMap(ss, sheetName);
  }
}

function initAllSheets(ss) {
  initSheetWithMap(ss, 'Projects');
  initSheetWithMap(ss, 'Violations');
  initSheetWithMap(ss, 'Users');
  initSheetWithMap(ss, 'NotificationLogs');
  initSheetWithMap(ss, 'Fine');
  initSheetWithMap(ss, 'FineList');
  initSheetWithMap(ss, 'Section');
  initDefaultAdmin(ss);
}

function initSheetWithMap(ss, sheetName) {
  var chineseHeaders = getHeaders(sheetName);
  var sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow(chineseHeaders);
  } else {
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(chineseHeaders);
    } else {
      var currentHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      if (currentHeaders.length < chineseHeaders.length) {
        var missingHeaders = chineseHeaders.slice(currentHeaders.length);
        if (missingHeaders.length > 0) {
          sheet.getRange(1, currentHeaders.length + 1, 1, missingHeaders.length).setValues([missingHeaders]);
        }
      }
    }
  }
  return sheet;
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

// ========== Data Mapping Core ==========

function getHeaders(sheetName) {
  var map = HEADER_MAP[sheetName];
  if (!map) return [];
  return Object.keys(map).map(function (key) { return map[key]; });
}

function loadData(ss, sheetName) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() <= 1) return [];

  var rows = sheet.getDataRange().getValues();
  var sheetHeaders = rows[0];
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
      var engKey = reverseMap[headerName];
      if (!engKey) engKey = headerName;
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

function saveData(ss, sheetName, data) {
  var sheet = ss.getSheetByName(sheetName);
  var sheetHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var map = HEADER_MAP[sheetName];

  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).clearContent();
  }

  if (!data || data.length === 0) return;

  var newRows = data.map(function (item) {
    return sheetHeaders.map(function (headerName) {
      var engKey = null;
      if (map) {
        for (var k in map) {
          if (map[k] === headerName) {
            engKey = k;
            break;
          }
        }
      }
      var key = engKey || headerName;
      return item[key] || '';
    });
  });

  sheet.getRange(2, 1, newRows.length, newRows[0].length).setValues(newRows);
}

// ========== Field Update Helpers ==========

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

// ========== Utilities ==========

function getKeyByValue(object, value) {
  return Object.keys(object).find(key => object[key] === value);
}

function jsonOutput(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function generateManualHtmlEmail(data) {
  return "<p>承辦人員您好，</p>" +
    "<p>承攬商「<b>" + data.contractorName + "</b>」於工程「<b>" + data.projectName + "</b>」之違規事項：" +
    "<br/>" + data.body + "</p>" +
    "<p>系統自動發送，請勿直接回覆。</p>";
}