import React, { useState, useEffect } from 'react';
import { X, Upload, Calendar, ChevronDown, FileText, DollarSign, Users } from 'lucide-react';
import { Project, Violation, ViolationStatus, Fine } from '../types';
import { addDays, generateId } from '../utils';
import { COMMON_VIOLATIONS } from '../services/storageService';

interface ViolationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (violation: Violation, fileData?: { name: string, type: string, base64: string }) => void;
  projects: Project[];
  fines: Fine[];
  initialData?: Violation | null;
}

// Group Fines array
const groupFinesByTicket = (fines: Fine[]) => {
  const map = new Map<string, { totalAmount: number, items: number }>();
  fines.forEach(f => {
    if (!f.ticketNumber) return;
    if (!map.has(f.ticketNumber)) {
      map.set(f.ticketNumber, { totalAmount: 0, items: 0 });
    }
    const current = map.get(f.ticketNumber)!;
    current.items += 1;
    current.totalAmount += Number(f.subtotal) || 0;
  });
  return map;
};

export const ViolationModal: React.FC<ViolationModalProps> = ({ isOpen, onClose, onSave, projects, fines, initialData }) => {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD 格式

  const [formData, setFormData] = useState<Partial<Violation>>({
    contractorName: '',
    projectName: '',
    violationDate: today,
    description: '',
    status: ViolationStatus.PENDING,
    fineAmount: 0,
    isMajorViolation: false,
    participants: '',
    completionDate: '',
    ticketNumbers: ''
  });
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Initialize form with data when modal opens
  useEffect(() => {
    if (isOpen && initialData) {
      setFormData({
        ...initialData,
        // Ensure numbers/booleans are correctly set
        fineAmount: initialData.fineAmount || 0,
        isMajorViolation: initialData.isMajorViolation || false
      });
    } else if (isOpen) {
      // Reset for new entry
      setFormData({
        contractorName: '',
        projectName: '',
        violationDate: today,
        description: '',
        status: ViolationStatus.PENDING,
        fineAmount: 0,
        isMajorViolation: false,
        participants: '',
        completionDate: '',
        ticketNumbers: ''
      });
    }
  }, [isOpen, initialData]);

  // 拖拉上傳處理
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile && (droppedFile.type.startsWith('image/') || droppedFile.type === 'application/pdf')) {
      setFile(droppedFile);
    }
  };

  useEffect(() => {
    if (formData.violationDate) {
      // Auto calculate deadline: +32 days
      const deadline = addDays(formData.violationDate, 32);
      setFormData((prev) => ({ ...prev, lectureDeadline: deadline }));
    }
  }, [formData.violationDate]);

  // 自動判斷參加人員邏輯
  useEffect(() => {
    let parts: string[] = [];
    const fine = Number(formData.fineAmount) || 0;
    const isMajor = formData.isMajorViolation;

    // 1. 重大職災或永久失能
    if (isMajor) {
      parts = ['承攬商負責人', '工作場所負責人', '工安人員', '領班', '該工作班全體勞工'];
    }
    // 2. 罰款 >= 2萬
    else if (fine >= 20000) {
      parts = ['違規當事人', '承攬商負責人(或代理人)', '工作場所負責人', '工安人員', '領班'];
    }
    // 3. 1萬 <= 罰款 < 2萬
    else if (fine >= 10000) {
      parts = ['違規當事人', '工作場所負責人', '工安人員', '領班'];
    }
    // 4. 罰款 < 1萬 (與累計有關，此處簡化為基本人員，可手動修改)
    else {
      // 預設基本人員，提示使用者若為累計需自行調整
      parts = ['違規當事人', '領班'];
    }

    setFormData(prev => ({
      ...prev,
      participants: parts.join('、')
    }));
  }, [formData.fineAmount, formData.isMajorViolation]);

  // 完成日期連動狀態
  useEffect(() => {
    if (formData.completionDate) {
      setFormData(prev => ({ ...prev, status: ViolationStatus.COMPLETED }));
    }
  }, [formData.completionDate]);

  // When project changes, auto-fill the single contractor
  const handleProjectChange = (projectName: string) => {
    const project = projects.find(p => p.name === projectName);
    setFormData(prev => ({
      ...prev,
      projectName,
      contractorName: project ? project.contractor : '' // Auto-fill 1-to-1 mapping
    }));
  };

  const handleDescriptionPreset = (val: string) => {
    if (!val) return;
    setFormData(prev => ({
      ...prev,
      description: val
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.contractorName || !formData.projectName || !formData.violationDate || !formData.lectureDeadline) return;

    setIsProcessing(true);

    let filePayload = undefined;

    // 如果有檔案，轉為 Base64
    if (file) {
      try {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = error => reject(error);
        });
        // 移除 data:image/png;base64, 前綴
        const base64Content = base64.split(',')[1];

        filePayload = {
          name: file.name,
          type: file.type,
          base64: base64Content
        };
      } catch (error) {
        console.error("File processing failed", error);
        alert("檔案處理失敗，請重試");
        setIsProcessing(false);
        return;
      }
    }

    const newViolation: Violation = {
      id: initialData?.id || generateId(),
      contractorName: formData.contractorName,
      projectName: formData.projectName,
      violationDate: formData.violationDate,
      lectureDeadline: formData.lectureDeadline,
      description: formData.description || '',
      status: formData.status || ViolationStatus.PENDING,
      fileName: file ? file.name : (initialData?.fileName), // Preserve old filename if not replaced
      fileUrl: initialData?.fileUrl || '',
      fineAmount: Number(formData.fineAmount) || 0,
      isMajorViolation: formData.isMajorViolation || false,
      participants: formData.participants || '',
      completionDate: formData.completionDate || '',
      ticketNumbers: formData.ticketNumbers || '',
      // Preserve other fields
      documentUrl: initialData?.documentUrl,
      scanFileName: initialData?.scanFileName,
      scanFileUrl: initialData?.scanFileUrl,
      emailCount: initialData?.emailCount,
      firstNotifyDate: initialData?.firstNotifyDate,
      secondNotifyDate: initialData?.secondNotifyDate,
      scanFileHistory: initialData?.scanFileHistory
    };

    onSave(newViolation, filePayload);
    setIsProcessing(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg md:max-w-xl overflow-hidden animate-fade-in-up flex flex-col my-auto relative">
        <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0 sticky top-0 z-10">
          <h2 className="text-lg font-bold text-slate-800">{initialData ? '編輯違規紀錄' : '新增違規紀錄'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5 overflow-y-auto max-h-[80vh]">

          {/* Project Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">工程名稱</label>
            <div className="relative">
              <select
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all appearance-none bg-white font-medium text-slate-700"
                value={formData.projectName}
                onChange={(e) => handleProjectChange(e.target.value)}
              >
                <option value="">請選擇工程</option>
                {projects.map(p => <option key={p.id} value={p.name}>{(p.sequence ? p.sequence + '. ' : '') + p.name}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-3 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* Contractor Name (Auto-filled & Read-only) */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">承攬商名稱</label>
            <input
              type="text"
              readOnly
              className="w-full px-3 py-2 border border-slate-200 bg-slate-100 text-slate-600 rounded-lg focus:outline-none cursor-not-allowed"
              placeholder="選擇工程後自動帶入"
              value={formData.contractorName}
            />
            {formData.projectName && !formData.contractorName && (
              <p className="text-xs text-red-500 mt-1">錯誤：此工程尚未設定承攬商。</p>
            )}
          </div>

          {/* Associated Fine Tickets (Multi-select) */}
          {formData.projectName && (
            <div className="p-4 bg-indigo-50/50 rounded-lg border border-indigo-100">
              <label className="block text-sm font-bold text-indigo-800 mb-2 flex items-center gap-2">
                <DollarSign size={16} /> 關聯罰單 (多選)
              </label>
              <div className="max-h-32 overflow-y-auto bg-white border border-indigo-100 rounded-lg p-2 space-y-1">
                {(() => {
                  const projectFines = fines.filter(f => f.projectName === formData.projectName && f.ticketNumber);
                  const groupedFines = groupFinesByTicket(projectFines);
                  const currentSelected = formData.ticketNumbers ? formData.ticketNumbers.split(',') : [];

                  if (groupedFines.size === 0) {
                    return <div className="text-sm text-slate-400 p-2 text-center">此工程目前無任何罰款單可以關聯</div>;
                  }

                  return Array.from(groupedFines.entries()).map(([ticketNumber, stats]) => {
                    const isSelected = currentSelected.includes(ticketNumber);
                    return (
                      <label key={ticketNumber} className={`flex items-center justify-between p-2 rounded cursor-pointer transition-colors ${isSelected ? 'bg-indigo-50 border-indigo-200' : 'hover:bg-slate-50 border-transparent'} border`}>
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 border-gray-300"
                            onChange={(e) => {
                              const checked = e.target.checked;
                              let newSelected = [...currentSelected];
                              if (checked) newSelected.push(ticketNumber);
                              else newSelected = newSelected.filter(t => t !== ticketNumber);

                              setFormData({ ...formData, ticketNumbers: newSelected.join(',') });
                            }}
                          />
                          <span className="font-mono text-sm text-slate-700 font-medium">{ticketNumber}</span>
                        </div>
                        <div className="text-xs text-slate-500 flex items-center gap-2">
                          <span>{stats.items} 項</span>
                          <span className="font-bold text-red-600">${stats.totalAmount.toLocaleString()}</span>
                        </div>
                      </label>
                    );
                  });
                })()}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Violation Date */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">違規日期</label>
              <div className="relative">
                <input
                  type="date"
                  required
                  className="w-full px-3 py-2 pl-9 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  value={formData.violationDate}
                  onChange={(e) => setFormData({ ...formData, violationDate: e.target.value })}
                />
                <Calendar className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </div>

            {/* Lecture Deadline (Auto) */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">講習截止日期 (+32天)</label>
              <input
                type="date"
                disabled
                className="w-full px-3 py-2 border border-slate-200 bg-slate-50 text-slate-500 rounded-lg cursor-not-allowed"
                value={formData.lectureDeadline || ''}
              />
              <p className="text-xs text-indigo-600 mt-1">*系統自動計算</p>
            </div>
          </div>

          {/* New Section: Fine & Severity */}
          <div className="p-4 bg-slate-50 rounded-lg border border-slate-100 space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                <Upload size={16} className="text-indigo-500" />
                違規情節與罰款
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">罰款金額</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="number"
                      min="0"
                      step="100"
                      className="w-full pl-8 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                      value={formData.fineAmount}
                      onChange={(e) => setFormData({ ...formData, fineAmount: Number(e.target.value) })}
                    />
                    <DollarSign className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, fineAmount: 10000 })}
                    className="px-3 py-1 text-xs bg-indigo-100 text-indigo-700 hover:bg-indigo-200 rounded border border-indigo-200 whitespace-nowrap"
                  >
                    $1萬
                  </button>
                </div>
              </div>

              <div className="flex items-end pb-3">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={formData.isMajorViolation}
                    onChange={(e) => setFormData({ ...formData, isMajorViolation: e.target.checked })}
                    className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 border-gray-300"
                  />
                  <span className="text-sm font-medium text-red-600">重大職災 / 永久失能</span>
                </label>
              </div>
            </div>

            {/* Participants */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">應參加講習人員 (自動判定)</label>
              <div className="relative">
                <textarea
                  rows={2}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={formData.participants}
                  onChange={(e) => setFormData({ ...formData, participants: e.target.value })}
                  placeholder="系統將根據罰款金額自動帶入..."
                />
                <Users className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-sm font-medium text-slate-700">違規內容說明</label>
              <select
                className="text-xs border-none bg-slate-100 rounded px-2 py-1 text-slate-600 cursor-pointer hover:bg-slate-200 outline-none"
                onChange={(e) => handleDescriptionPreset(e.target.value)}
                value=""
              >
                <option value="">快速帶入違規事項...</option>
                {COMMON_VIOLATIONS.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>

            <textarea
              rows={3}
              required
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none"
              placeholder="請描述違規事項..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          {/* Status & Completion Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">目前狀態</label>
              <div className="relative">
                <select
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none appearance-none bg-white"
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as ViolationStatus })}
                >
                  <option value={ViolationStatus.PENDING}>待辦理</option>
                  <option value={ViolationStatus.NOTIFIED}>已通知</option>
                  <option value={ViolationStatus.SUBMITTED}>已提送</option>
                  <option value={ViolationStatus.COMPLETED}>已完成</option>
                </select>
                <ChevronDown className="absolute right-3 top-3 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">完成日期 (選填)</label>
              <input
                type="date"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                value={formData.completionDate}
                onChange={(e) => setFormData({ ...formData, completionDate: e.target.value })}
              />
            </div>
          </div>

          {/* File Upload with Drag & Drop */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">上傳罰單 (圖片/PDF) - 可拖拉上傳</label>
            <div
              className="flex items-center justify-center w-full"
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <label className={`flex flex-col items-center justify-center w-full h-24 border-2 border-dashed rounded-lg cursor-pointer transition-all duration-200 ${isDragging
                ? 'border-indigo-500 bg-indigo-100 scale-105'
                : file
                  ? 'border-indigo-300 bg-indigo-50'
                  : 'border-slate-300 bg-slate-50 hover:bg-slate-100'
                }`}>
                <div className="flex flex-col items-center justify-center pt-2 pb-3">
                  {file ? (
                    <div className="flex items-center gap-2">
                      <FileText className="w-6 h-6 text-indigo-600" />
                      <p className="text-sm text-indigo-700 font-medium truncate max-w-[200px]">{file.name}</p>
                    </div>
                  ) : isDragging ? (
                    <>
                      <Upload className="w-8 h-8 text-indigo-500 mb-1 animate-bounce" />
                      <p className="text-sm text-indigo-600 font-medium">放開以上傳檔案</p>
                    </>
                  ) : (
                    <>
                      <Upload className="w-6 h-6 text-slate-400 mb-1" />
                      <p className="text-xs text-slate-500">點擊或拖拉檔案至此</p>
                    </>
                  )}
                </div>
                <input type="file" className="hidden" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              </label>
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-3 shrink-0 pb-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={isProcessing}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-md shadow-indigo-200 disabled:bg-slate-400 disabled:shadow-none"
            >
              {isProcessing ? '處理中...' : '儲存紀錄'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};