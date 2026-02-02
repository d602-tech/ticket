import React, { useState, useEffect } from 'react';
import { Send, X, Loader2, Edit3 } from 'lucide-react';
import { Coordinator, Violation } from '../types';
import { sendEmailViaGas } from '../services/apiService';

interface EmailPreviewProps {
  isOpen: boolean;
  onClose: () => void;
  coordinator?: Coordinator;
  violation: Violation;
  onSend: () => void; // This is now used for post-send cleanup
}

export const EmailPreview: React.FC<EmailPreviewProps> = ({ isOpen, onClose, coordinator, violation, onSend }) => {
  const [isSending, setIsSending] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  // 當視窗打開或資料變更時，帶入預設模板
  useEffect(() => {
    if (isOpen && violation) {
        const defaultSubject = `緊急通知：違規講習待辦理 - ${violation.contractorName}`;
        const defaultBody = `${coordinator?.name || '工程承辦人員'} 您好，

這是一封關於工程「${violation.projectName}」安全違規的自動提醒通知。

詳細資訊：
- 承攬商：${violation.contractorName}
- 違規日期：${violation.violationDate}
- 違規內容：${violation.description}

完成強制性安全講習的截止日期為 ${violation.lectureDeadline}。
請務必協助督促承攬商盡速處理，以符合工安規範。

工安衛管理系統 敬上`;

        setSubject(defaultSubject);
        setBody(defaultBody);
    }
  }, [isOpen, violation, coordinator]);

  if (!isOpen) return null;

  const handleConfirmSend = async () => {
      if (!coordinator?.email) {
          alert('錯誤：無收件人信箱');
          return;
      }

      setIsSending(true);
      
      // 呼叫 API 發送郵件 (使用使用者編輯過的 subject 和 body)
      const success = await sendEmailViaGas({
          to: coordinator.email,
          subject: subject,
          body: body
      });

      setIsSending(false);

      if (success) {
          alert(`已發送郵件給 ${coordinator.name}！\n(注意：若為免費版 Gmail，可能會在寄件備份中看到)`);
          onSend(); // 清除狀態
      } else {
          alert('發送失敗，請檢查網路或 Google Script 設定。');
      }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center shrink-0">
            <div className="flex items-center gap-2">
                <Send size={18} />
                <h3 className="font-semibold">發送通知郵件</h3>
            </div>
            <button onClick={onClose} disabled={isSending} className="text-slate-400 hover:text-white transition-colors disabled:opacity-50">
                <X size={20} />
            </button>
        </div>
        
        <div className="p-6 space-y-4 flex-1 overflow-y-auto">
            <div className="bg-blue-50 text-blue-700 text-xs px-4 py-2 rounded-lg flex items-center gap-2 mb-4">
                <Edit3 size={14} />
                您可以直接編輯下方的主旨與內文。
            </div>

            <div className="grid gap-4">
                <div className="flex items-center gap-3 border-b border-slate-100 pb-2">
                    <span className="text-sm font-medium text-slate-500 w-16 shrink-0">收件人：</span>
                    {coordinator ? (
                         <span className="text-sm text-slate-800 bg-indigo-50 px-2 py-1 rounded border border-indigo-100">{coordinator.name} &lt;{coordinator.email}&gt;</span>
                    ) : (
                        <span className="text-sm text-red-500 italic">未找到該工程的承辦人員。請在「承辦人員管理」頁面新增。</span>
                    )}
                </div>
                
                <div className="flex items-center gap-3 pb-2">
                    <span className="text-sm font-medium text-slate-500 w-16 shrink-0">主旨：</span>
                    <input 
                        type="text"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-slate-800 font-medium text-sm transition-all"
                    />
                </div>
            </div>
            
            <div className="space-y-1">
                <label className="text-xs font-medium text-slate-500 ml-1">郵件內容：</label>
                <textarea 
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    className="w-full h-64 p-4 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-slate-700 font-mono text-sm resize-none leading-relaxed transition-all shadow-inner"
                />
            </div>
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 shrink-0">
             <button 
                onClick={onClose} 
                disabled={isSending}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 font-medium disabled:opacity-50"
             >
                取消
             </button>
             <button 
                onClick={handleConfirmSend}
                disabled={!coordinator || isSending}
                className="flex items-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg shadow-lg shadow-indigo-200 transition-all"
            >
                {isSending ? (
                    <>
                        <Loader2 size={16} className="animate-spin" />
                        發送中...
                    </>
                ) : (
                    <>
                        <Send size={16} />
                        確認發送
                    </>
                )}
            </button>
        </div>
      </div>
    </div>
  );
};