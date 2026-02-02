import React, { useState, useEffect } from 'react';
import { ShieldCheck, Lock, User, Link } from 'lucide-react';
import { getApiUrl, setApiUrl } from '../services/apiService';

interface LoginScreenProps {
  onLogin: (success: boolean) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [apiUrl, setApiUrlState] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
      setApiUrlState(getApiUrl());
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // 儲存 API URL
    if (apiUrl) {
        setApiUrl(apiUrl);
    }

    if (username === 'admin' && password === 'admin123') {
      onLogin(true);
    } else {
      setError('帳號或密碼錯誤');
      onLogin(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in-up">
        <div className="bg-indigo-600 p-8 text-center">
            <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center mx-auto mb-4">
                <ShieldCheck className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">SafetyGuard</h1>
            <p className="text-indigo-200 text-sm mt-1">違規講習管理系統</p>
        </div>
        
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
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
                    <p className="text-xs text-slate-400 mt-1">請貼上部署後的網頁應用程式網址，系統將自動連線初始化資料庫。</p>
                </div>

                <div className="border-t border-slate-100 my-4"></div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">帳號</label>
                    <div className="relative">
                        <User className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                        <input 
                            type="text" 
                            className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                            placeholder="請輸入帳號 (admin)"
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
                            className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                            placeholder="請輸入密碼 (admin123)"
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
                className="w-full py-3 bg-slate-900 text-white font-bold rounded-lg hover:bg-slate-800 transition-all shadow-lg shadow-slate-300"
            >
                登入系統並連線
            </button>
            
            <p className="text-xs text-center text-slate-400 mt-4">
                預設帳號: admin / 密碼: admin123
            </p>
        </form>
      </div>
    </div>
  );
};