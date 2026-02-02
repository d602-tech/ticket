// API URL 金鑰名稱
export const GAS_URL_KEY = 'safety_guard_gas_url';

export const getApiUrl = () => localStorage.getItem(GAS_URL_KEY) || '';
export const setApiUrl = (url: string) => localStorage.setItem(GAS_URL_KEY, url);

export interface EmailData {
    to: string;
    subject: string;
    body: string;
}

// 通用的請求函式
export const callGasApi = async (payload: any) => {
    const url = getApiUrl();
    if (!url) {
        throw new Error('API URL 未設定');
    }

    // Google Apps Script Web App 對於 POST 請求需要使用 'text/plain' 才能避免 CORS 預檢請求失敗
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