import React from 'react';

interface LoadingModalProps {
    isOpen: boolean;
    message?: string;
}

export const LoadingModal: React.FC<LoadingModalProps> = ({ isOpen, message = '資料同步中...' }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-8 shadow-2xl flex flex-col items-center space-y-4 min-w-[300px]">
                {/* Spinner */}
                <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>

                {/* Message */}
                <p className="text-lg font-medium text-slate-700">{message}</p>
                <p className="text-sm text-slate-500">請稍候...</p>
            </div>
        </div>
    );
};
