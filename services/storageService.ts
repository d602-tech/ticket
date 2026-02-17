import { Violation, Project, Fine, FineList, Section, User } from '../types';
import { callGasApi, updateViolation, deleteViolation, updateProject, deleteProject, uploadEvidence } from './apiService';

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
const MOCK_FINES: Fine[] = [];
const MOCK_FINE_LIST: FineList[] = [];
const MOCK_SECTIONS: Section[] = [];

// 取得初始資料
export const fetchInitialData = async (): Promise<{
    projects: Project[],
    violations: Violation[],
    fines: Fine[],
    fineList: FineList[],
    sections: Section[],
    users: User[]
}> => {
    try {
        const data = await callGasApi({ action: 'getData' });
        return {
            projects: data.projects || MOCK_PROJECTS,
            violations: data.violations || MOCK_VIOLATIONS,
            fines: data.fines || MOCK_FINES,
            fineList: data.fineList || MOCK_FINE_LIST,
            sections: data.sections || MOCK_SECTIONS,
            users: data.users || []
        };
    } catch (error) {
        console.error("Failed to fetch data from GAS:", error);
        throw error;
    }
};

// 獨立取得使用者列表
export const fetchUsers = async (adminRole: string): Promise<User[]> => {
    try {
        const response = await callGasApi({
            action: 'getUsers',
            adminRole
        });
        if (response.success && response.users) {
            return response.users;
        }
        return [];
    } catch (error) {
        console.error("Failed to fetch users:", error);
        return [];
    }
};

// Legacy Sync (保留用於大量更新或 migration，但建議改用單筆更新)
export const syncData = async (
    projects?: Project[],
    violations?: Violation[],
    fileUpload?: {
        violationId: string,
        fileData: { name: string, type: string, base64: string },
        projectInfo?: { sequence: number | string, abbreviation: string },
        violationDate?: string
    },
    fines?: Fine[],
    sections?: Section[],
    users?: User[]
): Promise<{
    projects: Project[],
    violations: Violation[],
    fines: Fine[],
    fineList: FineList[],
    sections: Section[],
    users: User[]
}> => {
    try {
        // Fallback to legacy sync if needed
        const payload: any = { action: 'sync' };
        if (projects) payload.projects = projects;
        if (violations) payload.violations = violations;
        if (fines) payload.fines = fines;
        if (sections) payload.sections = sections;
        if (users) payload.users = users;
        if (fileUpload) payload.fileUpload = fileUpload;

        const response = await callGasApi(payload);
        return {
            projects: response.projects || [],
            violations: response.violations || [],
            fines: response.fines || [],
            fineList: response.fineList || [],
            sections: response.sections || [],
            users: response.users || []
        };
    } catch (error) {
        console.error("Sync failed:", error);
        throw error;
    }
};

// ========== Incremental Update Functions ==========

export const saveViolation = async (violation: Violation, fileData?: { name: string, type: string, base64: string }, projectInfo?: any) => {
    try {
        // 1. Upload Evidence if exists
        let updatedViolation = { ...violation };

        if (fileData) {
            const uploadRes = await uploadEvidence({
                violationId: violation.id,
                fileData: fileData.base64,
                fileName: fileData.name,
                mimeType: fileData.type,
                projectInfo: projectInfo,
                violationDate: violation.violationDate?.replace(/-/g, '')
            });

            if (uploadRes.success) {
                updatedViolation.fileUrl = uploadRes.fileUrl;
                updatedViolation.fileName = uploadRes.fileName;
            } else {
                throw new Error('File upload failed: ' + uploadRes.error);
            }
        }

        // 2. Update Violation Data
        const res = await updateViolation(updatedViolation);
        if (!res.success) throw new Error(res.error);

        return { success: true, violation: updatedViolation };
    } catch (e) {
        console.error("Save violation failed:", e);
        throw e;
    }
};

export const removeViolation = async (id: string) => {
    try {
        const res = await deleteViolation(id);
        if (!res.success) throw new Error(res.error);
        return true;
    } catch (e) {
        console.error("Delete violation failed:", e);
        throw e;
    }
};

export const saveProject = async (project: Project) => {
    try {
        const res = await updateProject(project);
        if (!res.success) throw new Error(res.error);
        return { success: true, project };
    } catch (e) {
        console.error("Save project failed:", e);
        throw e;
    }
};

export const removeProject = async (id: string) => {
    try {
        const res = await deleteProject(id);
        if (!res.success) throw new Error(res.error);
        return true;
    } catch (e) {
        console.error("Delete project failed:", e);
        throw e;
    }
};

export const getProjects = (): Project[] => MOCK_PROJECTS;
export const getViolations = (): Violation[] => MOCK_VIOLATIONS;
export const getFines = (): Fine[] => MOCK_FINES;
export const saveProjects = (p: Project[]) => { };
export const saveViolations = (v: Violation[]) => { };