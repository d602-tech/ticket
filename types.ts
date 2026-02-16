export enum ViolationStatus {
  PENDING = 'PENDING', // 待辦理 (Default)
  NOTIFIED = 'NOTIFIED', // 已通知
  SUBMITTED = 'SUBMITTED', // 已提送
  COMPLETED = 'COMPLETED', // 已完成
}

export interface Violation {
  id: string;
  contractorName: string;
  projectName: string;
  violationDate: string; // ISO Date String YYYY-MM-DD
  lectureDeadline: string; // ISO Date String YYYY-MM-DD
  description: string;
  fileName?: string;
  fileUrl?: string; // Google Drive 檔案連結
  status: ViolationStatus;
  emailCount?: number; // 已寄信次數
  documentUrl?: string; // 簽辦文件連結
  scanFileName?: string; // 簽辦掃描檔名稱
  scanFileUrl?: string; // 簽辦掃描檔連結
  // 通知追蹤欄位
  firstNotifyDate?: string;
  secondNotifyDate?: string;
  notifyStatus?: 'none' | 'first' | 'second' | 'overdue';
  managerEmail?: string;
  // 掃描檔修改歷史（JSON 字串）
  scanFileHistory?: string; // [{date, reason, oldUrl, newUrl}]

  // 新增欄位 (New Fields)
  fineAmount?: number; // 罰款金額
  isMajorViolation?: boolean; // 是否重大違規/永久失能
  participants?: string; // 應參加講習人員
  completionDate?: string; // 完成日期 YYYY-MM-DD
}

export interface Fine {
  seq?: string;            // 序號
  date?: string;           // 開罰日期
  issueDate?: string;      // 發文日期
  ticketNumber?: string;   // 罰單編號
  projectName?: string;    // 工程名稱
  hostTeam?: string;       // 主辦工作隊
  issuer?: string;         // 開單人
  contractor?: string;     // 承攬商
  violationItem?: string;  // 違規項目
  unitPrice?: number | string;      // 單價
  unitPriceAdj?: number | string;   // 單價修改
  unitPriceAdjNote?: string;// 單價修改備註
  priceAdjustmentReason?: string; // 單價修改原因
  relationship?: string;   // 關係 (預設: 舊約)
  count?: number | string;          // 件數
  multiplier?: number | string;     // 倍數
  subtotal?: number | string;       // 單項金額
  cctvType?: string;       // CCTV缺失種類
  totalAmount?: number | string;    // 總金額
  amountNote?: string;     // 罰單金額備註
  lectureDate?: string;    // 違規講習日期
  note?: string;           // 備註
  ticketType?: string;     // 開單類型
  supervisor?: string;     // 督導人
  allocation?: string;     // 忠哥辦理罰單分配
}

export interface FineList {
  seq?: string;
  itemIndex?: string;      // 項次
  violationItem?: string;  // 違規項目
  shortContent?: string;   // 縮短內容
  amount?: number | string;// 金額
  type?: string;           // 種類
  unit?: string;           // 單位
}

export interface Section {
  hostTeam?: string;       // 主辦工作隊
  title?: string;          // 職稱
  name?: string;           // 姓名
  email?: string;          // 信箱
}

export interface Project {
  id: string;
  sequence: number;       // 序號
  abbreviation: string;   // 工程簡稱
  name: string;
  contractor: string; // 承攜商名稱
  coordinatorName: string;
  coordinatorEmail: string;
  hostTeam?: string; // 主辦工作隊
  // 主管相關欄位
  managerName?: string;    // 部門主管姓名
  managerEmail?: string;   // 部門主管 Email
}

export interface User {
  email: string;
  name: string;
  role: string;
  password?: string;
}

// Keeping for backward compatibility if needed, but primarily using Project now
export interface Coordinator {
  id: string;
  projectName: string;
  name: string;
  email: string;
}

export type ViewState = 'DASHBOARD' | 'VIOLATIONS' | 'FINE_STATS' | 'PROJECTS' | 'ADMIN' | 'PERSONNEL' | 'USERS';