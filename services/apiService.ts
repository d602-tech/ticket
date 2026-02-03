// API URL 金鑰名稱
export const GAS_URL_KEY = 'safety_guard_gas_url';

// 從環境變數取得預設 URL
const DEFAULT_GAS_URL = import.meta.env.VITE_GAS_URL || 'https://script.google.com/macros/s/AKfycbzLmt5zmH3YPIUnBzoeyrT9nrGJZzw28wzPBqhPtplhEKzqt2jc35PnwgBMaTxepeuH/exec';

// 優先使用環境變數，如果沒有才用 localStorage
export const getApiUrl = () => DEFAULT_GAS_URL || localStorage.getItem(GAS_URL_KEY);
export const setApiUrl = (url: string) => localStorage.setItem(GAS_URL_KEY, url);
export const hasDefaultUrl = () => !!DEFAULT_GAS_URL;

export interface EmailData {
    to: string;
    subject: string;
    body: string;
}

export interface LoginResult {
    success: boolean;
    user?: { email: string; name: string; role: string };
    error?: string;
}

// 通用的請求函式
export const callGasApi = async (payload: any) => {
    const url = getApiUrl();
    if (!url) {
        throw new Error('API URL 未設定');
    }

    const response = await fetch(url, {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: {
            'Content-Type': 'text/plain;charset=utf-8',
        },
    });

    const json = await response.json();
    return json;
};

// 帳密登入
export const login = async (username: string, password: string): Promise<LoginResult> => {
    try {
        const result = await callGasApi({
            action: 'login',
            username,
            password
        });
        return result;
    } catch (error) {
        return { success: false, error: (error as Error).message };
    }
};

// Google 登入
export const googleLogin = async (credential: string): Promise<LoginResult> => {
    try {
        const result = await callGasApi({
            action: 'googleLogin',
            credential
        });
        return result;
    } catch (error) {
        return { success: false, error: (error as Error).message };
    }
};

export const sendEmailViaGas = async (data: EmailData): Promise<boolean> => {
    try {
        const result = await callGasApi({
            action: 'sendEmail',
            ...data
        });
        return result.success === true;
    } catch (error) {
        console.error('Email sending failed:', error);
        return false;
    }
};