export enum ViolationStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
}

export interface Violation {
  id: string;
  contractorName: string;
  projectName: string;
  violationDate: string; // ISO Date String YYYY-MM-DD
  lectureDeadline: string; // ISO Date String YYYY-MM-DD
  description: string;
  fileName?: string;
  fileUrl?: string; // 新增：Google Drive 檔案連結
  status: ViolationStatus;
}

export interface Project {
  id: string;
  sequence: number;       // 序號
  abbreviation: string;   // 工程簡稱
  name: string;
  contractor: string; // Changed from string[] to string (One-to-One)
  coordinatorName: string;
  coordinatorEmail: string;
}

export interface User {
  username: string;
  isAuthenticated: boolean;
}

// Keeping for backward compatibility if needed, but primarily using Project now
export interface Coordinator {
  id: string;
  projectName: string;
  name: string;
  email: string;
}

export type ViewState = 'DASHBOARD' | 'VIOLATIONS' | 'PROJECTS';