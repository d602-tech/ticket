import React, { useState } from 'react';
import { Section } from '../types';
import { Plus, Edit2, Trash2, Save, X, Filter } from 'lucide-react';

interface PersonnelManagementProps {
    sections: Section[];
    onSaveSections: (sections: Section[]) => void;
    syncService: (projects?: any, violations?: any, filePayload?: any, fines?: any, sections?: any) => Promise<any>;
}

export function PersonnelManagement({ sections, onSaveSections, syncService }: PersonnelManagementProps) {
    const [isEditingSection, setIsEditingSection] = useState(false);
    const [currentSection, setCurrentSection] = useState<Partial<Section>>({});
    const [isSaving, setIsSaving] = useState(false);

    // Dropdown options
    const titles = ['經理', '課長', '站長', '專員', '技術員', '處長', '副處長'];
    const hostTeams = ['土木工作隊', '機械工作隊', '建築工作隊', '電氣工作隊', '中部工作隊', '南部工作隊', '工業安全衛生組', '處長室', '工務組', '檢驗組', '規劃組'];

    const handleSaveSection = async () => {
        if (!currentSection.name || !currentSection.hostTeam) {
            alert('請填寫姓名與主辦工作隊');
            return;
        }

        setIsSaving(true);
        try {
            let updatedSections;
            // Check if updating existing by email or name/team combination
            // We rely on finding by name+hostTeam as primitive ID
            const existsIndex = sections.findIndex(s => s.name === currentSection.name && s.hostTeam === currentSection.hostTeam);

            if (existsIndex >= 0 && isEditingSection) {
                updatedSections = [...sections];
                updatedSections[existsIndex] = currentSection as Section;
            } else {
                updatedSections = [...sections, currentSection as Section];
            }

            const result = await syncService(undefined, undefined, undefined, undefined, updatedSections);
            onSaveSections(result.sections);
            setIsEditingSection(false);
            setCurrentSection({});
        } catch (e) {
            console.error(e);
            alert('儲存失敗');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteSection = async (section: Section) => {
        if (!confirm(`確定刪除 ${section.name}?`)) return;
        setIsSaving(true);
        try {
            const updatedSections = sections.filter(s => s !== section);
            const result = await syncService(undefined, undefined, undefined, undefined, updatedSections);
            onSaveSections(result.sections);
        } catch (e) {
            alert('刪除失敗');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-indigo-50/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
                            <Filter size={20} />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-700">開單人員管理</h3>
                            <p className="text-xs text-slate-500">管理可進行開單的人員名單與所屬工作隊</p>
                        </div>
                    </div>
                    <button
                        onClick={() => { setCurrentSection({}); setIsEditingSection(true); }}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm shadow-sm transition-all"
                    >
                        <Plus size={16} /> 新增人員
                    </button>
                </div>

                {isEditingSection && (
                    <div className="p-6 bg-slate-50 border-b border-slate-200 animate-in slide-in-from-top-4 duration-300">
                        <h4 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                            {currentSection.name ? <Edit2 size={16} /> : <Plus size={16} />}
                            {currentSection.name ? '編輯人員' : '新增人員'}
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">姓名 <span className="text-red-500">*</span></label>
                                <input type="text" className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                    value={currentSection.name || ''}
                                    onChange={e => setCurrentSection({ ...currentSection, name: e.target.value })}
                                    placeholder="輸入姓名"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">主辦工作隊 <span className="text-red-500">*</span></label>
                                <select
                                    className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                    value={currentSection.hostTeam || ''}
                                    onChange={e => setCurrentSection({ ...currentSection, hostTeam: e.target.value })}
                                >
                                    <option value="">請選擇工作隊...</option>
                                    {hostTeams.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">職稱</label>
                                <select className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                                    value={currentSection.title || ''}
                                    onChange={e => setCurrentSection({ ...currentSection, title: e.target.value })}
                                >
                                    <option value="">請選擇職稱</option>
                                    {titles.map(t => <option key={t} value={t}>{t}</option>)}
                                    {!titles.includes(currentSection.title || '') && currentSection.title && <option value={currentSection.title}>{currentSection.title}</option>}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Email</label>
                                <input type="email" className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                    value={currentSection.email || ''}
                                    onChange={e => setCurrentSection({ ...currentSection, email: e.target.value })}
                                    placeholder="example@email.com"
                                />
                            </div>
                        </div>
                        <div className="mt-6 flex gap-3 justify-end">
                            <button onClick={() => setIsEditingSection(false)} className="px-5 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 text-sm font-medium transition-colors flex items-center gap-2">
                                <X size={16} /> 取消
                            </button>
                            <button onClick={handleSaveSection} disabled={isSaving} className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium shadow-sm transition-colors flex items-center gap-2">
                                <Save size={16} /> {isSaving ? '儲存中...' : '儲存資料'}
                            </button>
                        </div>
                    </div>
                )}

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider">
                            <tr>
                                <th className="px-6 py-4">主辦工作隊</th>
                                <th className="px-6 py-4">姓名</th>
                                <th className="px-6 py-4">職稱</th>
                                <th className="px-6 py-4">Email</th>
                                <th className="px-6 py-4 text-right">操作</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                            {sections.map((s, idx) => (
                                <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4">
                                        <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs font-bold">
                                            {s.hostTeam}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 font-bold text-slate-700 flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs">
                                            {s.name.charAt(0)}
                                        </div>
                                        {s.name}
                                    </td>
                                    <td className="px-6 py-4 text-slate-600">{s.title || '-'}</td>
                                    <td className="px-6 py-4 text-slate-500 font-mono text-xs">{s.email || '-'}</td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button onClick={() => { setCurrentSection(s); setIsEditingSection(true); }} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-all"><Edit2 size={16} /></button>
                                            <button onClick={() => handleDeleteSection(s)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-all"><Trash2 size={16} /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {sections.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="p-8 text-center text-slate-400">尚無人員資料</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-4 text-sm text-indigo-700 flex items-start gap-2">
                <div className="mt-0.5"><Filter size={16} /></div>
                <div>
                    提示：此頁面資料即時同步至 Google Sheet「Section」分頁。在此新增的人員將會出現在罰單開立系統的「開單人」選單中。
                </div>
            </div>
        </div>
    );
}
