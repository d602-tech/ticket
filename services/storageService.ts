import { Violation, Project } from '../types';
import { callGasApi } from './apiService';

export const COMMON_VIOLATIONS = [
    "未依規定配戴安全帽",
    "高處作業未繫安全帶",
    "施工架未鋪設滿踏板",
    "開口處未設置防護措施",
    "電氣設備未裝設漏電斷路器",
    "高壓氣瓶未直立固定",
    "施工架無檢查合格標示",
    "動火作業無滅火設備",
    "未設置警示帶或圍籬",
    "吊掛作業無人指揮"
];

// 初始假資料 (僅當沒有後端且沒有快取時使用，或是用於展示)
const MOCK_PROJECTS: Project[] = [];
const MOCK_VIOLATIONS: Violation[] = [];

// 取得初始資料 (從後端拉取)
export const fetchInitialData = async (): Promise<{ projects: Project[], violations: Violation[] }> => {
    try {
        // 發送空物件或簡單的 get 請求，後端 doGet 會回傳所有資料
        // 但因為我們用 POST 統一處理比較方便避開 CORS 快取問題，這裡用 POST 傳遞 action
        // 其實 GAS 的 doPost 只要不傳特定 action，我們的腳本也會回傳資料
        const data = await callGasApi({}); 
        
        return {
            projects: data.projects || MOCK_PROJECTS,
            violations: data.violations || MOCK_VIOLATIONS
        };
    } catch (error) {
        console.error("Failed to fetch data from GAS:", error);
        throw error;
    }
};

// 同步所有資料到後端
export const syncData = async (
    projects?: Project[], 
    violations?: Violation[]
): Promise<{ projects: Project[], violations: Violation[] }> => {
    try {
        const payload: any = { action: 'sync' };
        if (projects) payload.projects = projects;
        if (violations) payload.violations = violations;

        const response = await callGasApi(payload);
        
        // 後端會回傳更新後的最新資料
        return {
            projects: response.projects || [],
            violations: response.violations || []
        };
    } catch (error) {
        console.error("Sync failed:", error);
        throw error;
    }
};

// 為了相容舊程式碼介面，但現在我們主要透過 App.tsx 的 State 管理
// 這兩個函式現在僅作輔助或本地測試用
export const getProjects = (): Project[] => MOCK_PROJECTS;
export const getViolations = (): Violation[] => MOCK_VIOLATIONS;
export const saveProjects = (p: Project[]) => {}; 
export const saveViolations = (v: Violation[]) => {};