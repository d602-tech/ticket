import React from 'react';
import { Loader2 } from 'lucide-react';

export const LoadingModal = ({ isOpen, message }: { isOpen: boolean, message: string }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl p-8 flex flex-col items-center gap-4 animate-scale-in">
                <div className="p-4 bg-indigo-50 rounded-full">
                    <Loader2 size={32} className="text-indigo-600 animate-spin" />
                </div>
                <p className="text-slate-700 font-medium text-lg">{message}</p>
            </div>
        </div>
    );
};
