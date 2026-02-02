import React, { useState, useEffect } from 'react';
import { X, Upload, Calendar, ChevronDown } from 'lucide-react';
import { Project, Violation, ViolationStatus } from '../types';
import { addDays, generateId } from '../utils';
import { COMMON_VIOLATIONS } from '../services/storageService';

interface ViolationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (violation: Violation) => void;
  projects: Project[];
}

export const ViolationModal: React.FC<ViolationModalProps> = ({ isOpen, onClose, onSave, projects }) => {
  const [formData, setFormData] = useState<Partial<Violation>>({
    contractorName: '',
    projectName: '',
    violationDate: '',
    description: '',
    status: ViolationStatus.PENDING,
  });
  const [file, setFile] = useState<File | null>(null);
  
  useEffect(() => {
    if (formData.violationDate) {
      // Auto calculate deadline: +30 days
      const deadline = addDays(formData.violationDate, 30);
      setFormData((prev) => ({ ...prev, lectureDeadline: deadline }));
    }
  }, [formData.violationDate]);

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
      if(!val) return;
      setFormData(prev => ({
          ...prev,
          description: val
      }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.contractorName || !formData.projectName || !formData.violationDate || !formData.lectureDeadline) return;

    const newViolation: Violation = {
      id: generateId(),
      contractorName: formData.contractorName,
      projectName: formData.projectName,
      violationDate: formData.violationDate,
      lectureDeadline: formData.lectureDeadline,
      description: formData.description || '',
      status: ViolationStatus.PENDING,
      fileName: file ? file.name : undefined,
    };

    onSave(newViolation);
    // Reset
    setFormData({
        contractorName: '',
        projectName: '',
        violationDate: '',
        description: '',
        status: ViolationStatus.PENDING,
        lectureDeadline: ''
    });
    setFile(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-fade-in-up flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
          <h2 className="text-lg font-bold text-slate-800">新增違規紀錄</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          
          {/* Project Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">工程名稱</label>
            <div className="relative">
                <select
                    required
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all appearance-none bg-white"
                    value={formData.projectName}
                    onChange={(e) => handleProjectChange(e.target.value)}
                >
                    <option value="">請選擇工程</option>
                    {projects.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
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

          <div className="grid grid-cols-2 gap-4">
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
              <label className="block text-sm font-medium text-slate-700 mb-1">講習截止日期 (+30天)</label>
              <input
                type="date"
                disabled
                className="w-full px-3 py-2 border border-slate-200 bg-slate-50 text-slate-500 rounded-lg cursor-not-allowed"
                value={formData.lectureDeadline || ''}
              />
              <p className="text-xs text-indigo-600 mt-1">*系統自動計算</p>
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

          {/* File Upload */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">上傳罰單</label>
            <div className="flex items-center justify-center w-full">
                <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-slate-300 border-dashed rounded-lg cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        {file ? (
                             <p className="text-sm text-indigo-600 font-medium">{file.name}</p>
                        ) : (
                            <>
                                <Upload className="w-6 h-6 text-slate-400 mb-1" />
                                <p className="text-xs text-slate-500">點擊上傳圖片或PDF</p>
                            </>
                        )}
                    </div>
                    <input type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                </label>
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              取消
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-md shadow-indigo-200"
            >
              儲存紀錄
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};