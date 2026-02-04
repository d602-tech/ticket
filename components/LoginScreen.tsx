import React, { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, Lock, User, Link, Loader2 } from 'lucide-react';
import { getApiUrl, setApiUrl, hasDefaultUrl, login, googleLogin } from '../services/apiService';

declare global {
    interface Window {
        google?: {
            accounts: {
                id: {
                    initialize: (config: any) => void;
                    renderButton: (element: HTMLElement, config: any) => void;
                    prompt: () => void;
                };
            };
        };
    }
}

interface LoginScreenProps {
    onLogin: (success: boolean, user?: { email: string; name: string; role: string }) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [apiUrl, setApiUrlState] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showUrlInput, setShowUrlInput] = useState(!hasDefaultUrl());

    useEffect(() => {
        setApiUrlState(getApiUrl());
    }, []);

    // 初始化 Google Sign-In
    const initGoogleSignIn = useCallback(() => {
        const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
        if (!clientId || !window.google) return;

        window.google.accounts.id.initialize({
            client_id: clientId,
            callback: handleGoogleCallback,
        });

        const buttonDiv = document.getElementById('google-signin-btn');
        if (buttonDiv) {
            window.google.accounts.id.renderButton(buttonDiv, {
                theme: 'outline',
                size: 'large',
                width: '100%',
                text: 'signin_with',
                locale: 'zh_TW',
            });
        }
    }, []);

    useEffect(() => {
        // 等待 Google SDK 載入
        const checkGoogle = setInterval(() => {
            if (window.google) {
                initGoogleSignIn();
                clearInterval(checkGoogle);
            }
        }, 100);

        return () => clearInterval(checkGoogle);
    }, [initGoogleSignIn]);

    const handleGoogleCallback = async (response: any) => {
        setIsLoading(true);
        setError('');

        try {
            const result = await googleLogin(response.credential);
            if (result.success && result.user) {
                onLogin(true, result.user);
            } else {
                setError(result.error || 'Google 登入失敗');
            }
        } catch (e) {
            setError('連線失敗');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        // 儲存 API URL
        if (apiUrl) {
            setApiUrl(apiUrl);
        }

        try {
            const result = await login(username, password);
            if (result.success && result.user) {
                onLogin(true, result.user);
            } else {
                setError(result.error || '帳號或密碼錯誤');
            }
        } catch (e) {
            setError('連線失敗，請檢查 API URL');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in-up">
                <div className="bg-indigo-600 p-8 text-center">
                    <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <ShieldCheck className="w-10 h-10 text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-white">違規講習登錄表</h1>
                    <p className="text-indigo-200 text-sm mt-1">工安組管理系統</p>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-6">
                    {/* API URL 輸入（可展開） */}
                    {showUrlInput ? (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Google Apps Script URL</label>
                                <div className="relative">
                                    <Link className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                                    <input
                                        type="text"
                                        className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
                                        placeholder="https://script.google.com/..."
                                        value={apiUrl}
                                        onChange={(e) => setApiUrlState(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="border-t border-slate-100"></div>
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={() => setShowUrlInput(true)}
                            className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 absolute top-4 right-4"
                        >
                            <Link size={12} />
                            設定
                        </button>
                    )}

                    {/* Google Sign-In (Top) */}
                    <div className="space-y-4">
                        <div id="google-signin-btn" className="flex justify-center w-full"></div>

                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-slate-200"></div>
                            </div>
                            <div className="relative flex justify-center text-sm">
                                <span className="bg-white px-2 text-slate-400 uppercase tracking-wider text-xs">Or login with email</span>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">帳號</label>
                            <div className="relative">
                                <User className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                                <input
                                    type="text"
                                    className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none transition-all"
                                    placeholder="請輸入帳號"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">密碼</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                                <input
                                    type="password"
                                    className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none transition-all"
                                    placeholder="請輸入密碼"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    {error && (
                        <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg text-center font-medium">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full py-3 bg-slate-900 text-white font-bold rounded-lg hover:bg-slate-800 transition-all shadow-lg shadow-slate-300 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                登入中...
                            </>
                        ) : (
                            '登入系統'
                        )}
                    </button>

                    <p className="text-xs text-center text-slate-400 mt-4">
                        預設帳號: admin / 密碼: admin123
                    </p>
                </form>
            </div>
        </div>
    );
};