import React, { useState } from 'react';
import { Section } from '../types';
import { Plus, Edit2, Trash2, Save, X, Filter, Loader2 } from 'lucide-react';

interface PersonnelManagementProps {
    sections: Section[];
    onSaveSections: (sections: Section[]) => void;
    syncService: (projects?: any, violations?: any, filePayload?: any, fines?: any, sections?: any) => Promise<any>;
}

export function PersonnelManagement({ sections, onSaveSections, syncService }: PersonnelManagementProps) {
    const [isEditingSection, setIsEditingSection] = useState(false);
    const [currentSection, setCurrentSection] = useState<Partial<Section>>({});
    const [isSaving, setIsSaving] = useState(false);

    const hostTeams = ['土木工作隊', '建築工作隊', '機械工作隊', '電氣工作隊', '中部工作隊', '南部工作隊'];
    const titles = ['隊長', '副隊長', '工程師', '助理工程師', '技術員', '管理師', '副管理師'];

    const handleSaveSection = async () => {
        if (!currentSection.name || !currentSection.hostTeam) {
            alert('請填寫姓名和主辦工作隊');
            return;
        }
        setIsSaving(true);
        try {
            let updatedSections: Section[];
            const existing = sections.find(s => s.name === currentSection.name && s.hostTeam === currentSection.hostTeam);
            if (existing) {
                updatedSections = sections.map(s =>
                    (s.name === existing.name && s.hostTeam === existing.hostTeam) ? { ...s, ...currentSection } as Section : s
                );
            } else {
                updatedSections = [...sections, {
                    name: currentSection.name,
                    hostTeam: currentSection.hostTeam,
                    title: currentSection.title || '',
                    email: currentSection.email || ''
                } as Section];
            }
            const result = await syncService(undefined, undefined, undefined, undefined, updatedSections);
            onSaveSections(result.sections || updatedSections);
            setIsEditingSection(false);
            setCurrentSection({});
        } catch (e) {
            alert('儲存失敗');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteSection = async (section: Section) => {
        if (!confirm(`確定要刪除「${section.name}」嗎？`)) return;
        setIsSaving(true);
        try {
            const updatedSections = sections.filter(s => !(s.name === section.name && s.hostTeam === section.hostTeam));
            const result = await syncService(undefined, undefined, undefined, undefined, updatedSections);
            onSaveSections(result.sections || updatedSections);
        } catch (e) {
            alert('刪除失敗');
        } finally {
            setIsSaving(false);
        }
    };

    const teamColors: Record<string, { bg: string; text: string; border: string; headerBg: string }> = {
        '土木工作隊': { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', headerBg: 'bg-blue-100' },
        '建築工作隊': { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200', headerBg: 'bg-green-100' },
        '機械工作隊': { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', headerBg: 'bg-orange-100' },
        '電氣工作隊': { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200', headerBg: 'bg-yellow-100' },
        '中部工作隊': { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200', headerBg: 'bg-teal-100' },
        '南部工作隊': { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', headerBg: 'bg-indigo-100' },
    };
    const defaultTeamColor = { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200', headerBg: 'bg-slate-100' };

    // Group sections by hostTeam
    const groupedSections = sections.reduce((acc, s) => {
        const team = s.hostTeam || '未分類';
        if (!acc[team]) acc[team] = [];
        acc[team].push(s);
        return acc;
    }, {} as Record<string, Section[]>);

    const teamOrder = ['土木工作隊', '建築工作隊', '機械工作隊', '電氣工作隊', '中部工作隊', '南部工作隊'];
    const sortedTeams = Object.keys(groupedSections).sort((a, b) => {
        const ia = teamOrder.indexOf(a);
        const ib = teamOrder.indexOf(b);
        return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    });

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* 同步中遮罩 */}
            {isSaving && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl p-8 shadow-2xl flex flex-col items-center space-y-4 min-w-[300px]">
                        <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
                        <p className="text-lg font-medium text-slate-700">資料同步中...</p>
                        <p className="text-sm text-slate-500">請稍候...</p>
                    </div>
                </div>
            )}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-indigo-50/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
                            <Filter size={20} />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-700">開單人員管理</h3>
                            <p className="text-xs text-slate-500">管理可進行開單的人員名單，依主辦工作隊分區顯示</p>
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

                {/* 分區顯示 */}
                <div className="divide-y divide-slate-100">
                    {sortedTeams.map(team => {
                        const members = groupedSections[team];
                        const color = teamColors[team] || defaultTeamColor;
                        return (
                            <div key={team}>
                                <div className={`px-6 py-3 ${color.headerBg} flex items-center justify-between`}>
                                    <div className="flex items-center gap-2">
                                        <span className={`inline-block w-3 h-3 rounded-full ${color.text.replace('text-', 'bg-')}`}></span>
                                        <span className={`font-bold text-sm ${color.text}`}>{team}</span>
                                    </div>
                                    <span className={`text-xs font-medium ${color.text} opacity-70`}>{members.length} 人</span>
                                </div>
                                <div className="bg-white">
                                    {members.map((s, idx) => (
                                        <div key={idx} className="flex items-center justify-between px-6 py-3 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 rounded-full ${color.headerBg} flex items-center justify-center ${color.text} font-bold text-xs`}>
                                                    {s.name.charAt(0)}
                                                </div>
                                                <div>
                                                    <span className="font-bold text-slate-700 text-sm">{s.name}</span>
                                                    {s.title && <span className="text-slate-400 text-xs ml-2">({s.title})</span>}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className="text-slate-400 font-mono text-xs hidden md:inline">{s.email || '-'}</span>
                                                <div className="flex gap-1">
                                                    <button onClick={() => { setCurrentSection(s); setIsEditingSection(true); }} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-all"><Edit2 size={14} /></button>
                                                    <button onClick={() => handleDeleteSection(s)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-all"><Trash2 size={14} /></button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                    {sections.length === 0 && (
                        <div className="p-8 text-center text-slate-400">尚無人員資料</div>
                    )}
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
