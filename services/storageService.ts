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

// 初始假資料
const MOCK_PROJECTS: Project[] = [];
const MOCK_VIOLATIONS: Violation[] = [];

// 取得初始資料
export const fetchInitialData = async (): Promise<{ projects: Project[], violations: Violation[] }> => {
    try {
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

// 同步所有資料到後端 (含檔案上傳處理)
export const syncData = async (
    projects?: Project[],
    violations?: Violation[],
    fileUpload?: { violationId: string, fileData: { name: string, type: string, base64: string } }
): Promise<{ projects: Project[], violations: Violation[] }> => {
    try {
        const payload: any = { action: 'sync' };
        if (projects) payload.projects = projects;
        if (violations) payload.violations = violations;

        // 如果有檔案需要上傳
        if (fileUpload) {
            payload.fileUpload = fileUpload;
        }

        const response = await callGasApi(payload);

        // 如果有檔案上傳，顯示結果
        if (fileUpload && response.fileUploadStatus) {
            if (response.fileUploadStatus.success) {
                console.log('✅ 檔案上傳成功:', response.fileUploadStatus.fileName, response.fileUploadStatus.fileUrl);
            } else {
                console.error('❌ 檔案上傳失敗:', response.fileUploadStatus.error);
                alert('檔案上傳失敗: ' + response.fileUploadStatus.error);
            }
        }

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

export const getProjects = (): Project[] => MOCK_PROJECTS;
export const getViolations = (): Violation[] => MOCK_VIOLATIONS;
export const saveProjects = (p: Project[]) => { };
export const saveViolations = (v: Violation[]) => { };