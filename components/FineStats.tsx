import React, { useState, useEffect } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell
} from 'recharts';
import { Fine, Project, FineList, Section } from '../types';
import { Plus, X, Trash2, Edit2, Loader2, Filter } from 'lucide-react';
import { syncData } from '../services/storageService';
import { formatDate } from '../utils';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658'];

interface FineStatsProps {
    projects: Project[];
    fines: Fine[];
    fineList: FineList[];
    sections: Section[];
    onSaveFines: (fines: Fine[]) => void;
}

export function FineStats({ projects, fines, fineList, sections, onSaveFines }: FineStatsProps) {
    const [activeTab, setActiveTab] = useState<'stats' | 'manage'>('stats');
    const [isEditing, setIsEditing] = useState(false);
    const [currentFine, setCurrentFine] = useState<Partial<Fine>>({});
    const [isSaving, setIsSaving] = useState(false);

    // Form Dropdown Options
    const ticketTypes = ['走動管理', 'CCTV', '工安查核', '現檢員', '監造', '營建處', '勞檢'];
    const cctvTypes = ['設備', '現檢員', '工安組'];
    const allocTypes = ['處長', '副處長', '課長', '部門經理', '工安經理', '工安課長', '現檢員'];

    // Auto-fill logic
    useEffect(() => {
        if (currentFine.projectName) {
            const proj = projects.find(p => p.name === currentFine.projectName);
            if (proj) {
                setCurrentFine(prev => ({
                    ...prev,
                    hostTeam: proj.hostTeam,
                    contractor: proj.contractor
                }));
            }
        }
    }, [currentFine.projectName, projects]);

    useEffect(() => {
        if (currentFine.violationItem) {
            const item = fineList.find(i => i.violationItem === currentFine.violationItem);
            if (item) {
                setCurrentFine(prev => ({
                    ...prev,
                    unitPrice: item.amount,
                    unit: item.unit // Auto-fill unit if available
                }));
            }
        }
    }, [currentFine.violationItem, fineList]);

    // Calculate amounts
    useEffect(() => {
        const price = Number(currentFine.unitPrice) || 0;
        const count = Number(currentFine.count) || 1; // Default to 1
        const mult = Number(currentFine.multiplier) || 1;
        const subtotal = price * count * mult;

        // Update subtotal if it changes
        if (currentFine.subtotal !== subtotal) {
            setCurrentFine(prev => ({ ...prev, subtotal, totalAmount: subtotal }));
        }
    }, [currentFine.unitPrice, currentFine.count, currentFine.multiplier]);

    const handleSave = async () => {
        if (!currentFine.date || !currentFine.projectName || !currentFine.violationItem) {
            alert('請填寫必填欄位 (開罰日期, 工程名稱, 違規項目)');
            return;
        }

        setIsSaving(true);
        try {
            const newFine = { ...currentFine } as Fine;
            if (!newFine.seq) newFine.seq = Date.now().toString();

            let updatedFines;
            if (isEditing && currentFine.seq) {
                updatedFines = fines.map(f => f.seq === currentFine.seq ? newFine : f);
            } else {
                updatedFines = [...fines, newFine];
            }

            const result = await syncData(undefined, undefined, undefined, updatedFines);
            onSaveFines(result.fines);
            setIsEditing(false);
            setCurrentFine({});
        } catch (error) {
            console.error(error);
            alert('儲存失敗');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (seq: string) => {
        if (!confirm('確定刪除此筆罰款資料?')) return;
        setIsSaving(true);
        try {
            const updatedFines = fines.filter(f => f.seq !== seq);
            const result = await syncData(undefined, undefined, undefined, updatedFines);
            onSaveFines(result.fines);
        } catch (e) {
            alert('刪除失敗');
        } finally {
            setIsSaving(false);
        }
    };

    const renderStats = () => {
        // 1. By Project
        const finesByProject = fines.reduce((acc, curr) => {
            const name = curr.projectName || '未分類';
            if (!acc[name]) acc[name] = 0;
            acc[name] += (Number(curr.subtotal) || 0);
            return acc;
        }, {} as Record<string, number>);

        const projectData = Object.entries(finesByProject).map(([name, value]) => ({ name, value }));

        // 2. By Host Team
        const finesByTeam = fines.reduce((acc, curr) => {
            const team = curr.hostTeam || '未分類';
            if (!acc[team]) acc[team] = 0;
            acc[team] += (Number(curr.subtotal) || 0);
            return acc;
        }, {} as Record<string, number>);

        const teamData = Object.entries(finesByTeam).map(([name, value]) => ({ name, value }));

        // 3. By Month
        const finesByMonth = fines.reduce((acc, curr) => {
            const dateStr = curr.date || curr.issueDate;
            const d = dateStr ? new Date(dateStr) : new Date();
            if (isNaN(d.getTime())) return acc;
            const key = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}`;
            if (!acc[key]) acc[key] = 0;
            acc[key] += (Number(curr.subtotal) || 0);
            return acc;
        }, {} as Record<string, number>);

        const monthData = Object.entries(finesByMonth)
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([name, value]) => ({ name, value }));

        return (
            <div className="space-y-6 animate-in fade-in duration-500">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                        <h3 className="text-slate-500 text-sm font-medium">總罰款金額</h3>
                        <p className="text-3xl font-bold text-red-600 mt-2">
                            ${fines.reduce((sum, f) => sum + (Number(f.subtotal) || 0), 0).toLocaleString()}
                        </p>
                    </div>
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                        <h3 className="text-slate-500 text-sm font-medium">總開單件數</h3>
                        <p className="text-3xl font-bold text-slate-800 mt-2">
                            {fines.length} 件
                        </p>
                    </div>
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                        <h3 className="text-slate-500 text-sm font-medium">本月罰款</h3>
                        <p className="text-3xl font-bold text-indigo-600 mt-2">
                            ${monthData.find(d => d.name === `${new Date().getFullYear()}/${String(new Date().getMonth() + 1).padStart(2, '0')}`)?.value.toLocaleString() || 0}
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                        <h3 className="font-bold text-slate-700 mb-4">各工程罰款統計</h3>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={projectData} layout="vertical">
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                    <XAxis type="number" />
                                    <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12 }} />
                                    <Tooltip formatter={(value) => `$${Number(value).toLocaleString()}`} />
                                    <Bar dataKey="value" fill="#8884d8" name="金額" radius={[0, 4, 4, 0]}>
                                        {projectData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                        <h3 className="font-bold text-slate-700 mb-4">各工作隊罰款統計</h3>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={teamData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        fill="#8884d8"
                                        paddingAngle={5}
                                        dataKey="value"
                                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                    >
                                        {teamData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(value) => `$${Number(value).toLocaleString()}`} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 col-span-1 lg:col-span-2">
                        <h3 className="font-bold text-slate-700 mb-4">每月罰款趨勢</h3>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={monthData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="name" />
                                    <YAxis />
                                    <Tooltip formatter={(value) => `$${Number(value).toLocaleString()}`} />
                                    <Bar dataKey="value" fill="#82ca9d" name="金額" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderManage = () => {
        if (isEditing) {
            return (
                <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-200 max-w-4xl mx-auto animate-in zoom-in-95 duration-200">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-bold text-slate-800">{currentFine.seq ? '編輯罰款' : '新增罰款'}</h3>
                        <button onClick={() => { setIsEditing(false); setCurrentFine({}); }} className="text-slate-400 hover:text-slate-600">
                            <X size={24} />
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">開罰日期 *</label>
                            <input type="date" className="w-full p-2 border rounded-lg" value={currentFine.date || ''} onChange={e => setCurrentFine({ ...currentFine, date: e.target.value })} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">發文日期</label>
                            <input type="date" className="w-full p-2 border rounded-lg" value={currentFine.issueDate || ''} onChange={e => setCurrentFine({ ...currentFine, issueDate: e.target.value })} />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">罰單編號</label>
                            <input type="text" className="w-full p-2 border rounded-lg" value={currentFine.ticketNumber || ''} onChange={e => setCurrentFine({ ...currentFine, ticketNumber: e.target.value })} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">工程名稱 *</label>
                            <select className="w-full p-2 border rounded-lg" value={currentFine.projectName || ''} onChange={e => setCurrentFine({ ...currentFine, projectName: e.target.value })}>
                                <option value="">請選擇</option>
                                {projects.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                            </select>
                        </div>

                        <div className="bg-slate-50 p-3 rounded-lg">
                            <label className="block text-xs font-medium text-slate-500">主辦工作隊</label>
                            <div className="font-medium">{currentFine.hostTeam || '-'}</div>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-lg">
                            <label className="block text-xs font-medium text-slate-500">承攬商</label>
                            <div className="font-medium">{currentFine.contractor || '-'}</div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">開單人</label>
                            <select className="w-full p-2 border rounded-lg" value={currentFine.issuer || ''} onChange={e => setCurrentFine({ ...currentFine, issuer: e.target.value })}>
                                <option value="">請選擇</option>
                                <option value="manual">自行輸入...</option>
                                {sections.filter(s => !currentFine.hostTeam || s.hostTeam === currentFine.hostTeam).map((s, idx) => (
                                    <option key={idx} value={s.name}>{s.name} ({s.title})</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">違規項目 *</label>
                            <select className="w-full p-2 border rounded-lg" value={currentFine.violationItem || ''} onChange={e => setCurrentFine({ ...currentFine, violationItem: e.target.value })}>
                                <option value="">請選擇</option>
                                {fineList.map((item, idx) => (
                                    <option key={idx} value={item.violationItem}>{item.violationItem?.substring(0, 30)}...</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">單價</label>
                            <input type="number" disabled className="w-full p-2 border rounded-lg bg-slate-50 text-slate-500" value={currentFine.unitPrice || 0} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">件數</label>
                            <input type="number" className="w-full p-2 border rounded-lg" value={currentFine.count || 1} onChange={e => setCurrentFine({ ...currentFine, count: e.target.value })} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">倍數</label>
                            <input type="number" className="w-full p-2 border rounded-lg" value={currentFine.multiplier || ''} placeholder="1" onChange={e => setCurrentFine({ ...currentFine, multiplier: e.target.value })} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">單項金額 (自動計算)</label>
                            <div className="text-xl font-bold text-red-600">${Number(currentFine.subtotal || 0).toLocaleString()}</div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">CCTV 缺失種類</label>
                            <select className="w-full p-2 border rounded-lg" value={currentFine.cctvType || ''} onChange={e => setCurrentFine({ ...currentFine, cctvType: e.target.value })}>
                                <option value="">請選擇</option>
                                {cctvTypes.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">開單類型</label>
                            <select className="w-full p-2 border rounded-lg" value={currentFine.ticketType || ''} onChange={e => setCurrentFine({ ...currentFine, ticketType: e.target.value })}>
                                <option value="">請選擇</option>
                                {ticketTypes.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">督導人</label>
                            <input type="text" className="w-full p-2 border rounded-lg" value={currentFine.supervisor || ''} onChange={e => setCurrentFine({ ...currentFine, supervisor: e.target.value })} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">忠哥分配</label>
                            <select className="w-full p-2 border rounded-lg" value={currentFine.allocation || ''} onChange={e => setCurrentFine({ ...currentFine, allocation: e.target.value })}>
                                <option value="">請選擇</option>
                                {allocTypes.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-slate-700 mb-1">備註</label>
                            <textarea className="w-full p-2 border rounded-lg" rows={3} value={currentFine.note || ''} onChange={e => setCurrentFine({ ...currentFine, note: e.target.value })}></textarea>
                        </div>
                    </div>

                    <div className="mt-8 flex justify-end gap-3">
                        <button onClick={() => { setIsEditing(false); setCurrentFine({}); }} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">取消</button>
                        <button onClick={handleSave} disabled={isSaving} className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2">
                            {isSaving && <Loader2 className="animate-spin" size={18} />}
                            儲存
                        </button>
                    </div>
                </div>
            );
        }

        return (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in duration-500">
                <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <h3 className="font-bold text-slate-700">罰款明細列表</h3>
                        <div className="text-sm text-slate-500">共 {fines.length} 筆</div>
                    </div>
                    <button onClick={() => { setCurrentFine({}); setIsEditing(true); }} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm transition-colors">
                        <Plus size={16} /> 新增罰款
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 font-medium">
                            <tr>
                                <th className="px-4 py-3">日期</th>
                                <th className="px-4 py-3">工程名稱</th>
                                <th className="px-4 py-3">主辦工作隊</th>
                                <th className="px-4 py-3">承攬商</th>
                                <th className="px-4 py-3">違規項目</th>
                                <th className="px-4 py-3 text-right">金額</th>
                                <th className="px-4 py-3 text-right">操作</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {fines.map((fine, idx) => (
                                <tr key={fine.seq || idx} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-4 py-3 font-mono text-xs">{formatDate(fine.date)}</td>
                                    <td className="px-4 py-3 font-medium">{fine.projectName}</td>
                                    <td className="px-4 py-3 text-slate-500">{fine.hostTeam}</td>
                                    <td className="px-4 py-3 text-slate-500">{fine.contractor}</td>
                                    <td className="px-4 py-3 max-w-xs truncate" title={fine.violationItem}>{fine.violationItem}</td>
                                    <td className="px-4 py-3 text-right font-medium text-red-600">${Number(fine.subtotal).toLocaleString()}</td>
                                    <td className="px-4 py-3 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button onClick={() => { setCurrentFine(fine); setIsEditing(true); }} className="p-1 text-slate-400 hover:text-indigo-600 transition-colors"><Edit2 size={16} /></button>
                                            <button onClick={() => fine.seq && handleDelete(fine.seq)} className="p-1 text-slate-400 hover:text-red-600 transition-colors"><Trash2 size={16} /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {fines.length === 0 && (
                                <tr><td colSpan={7} className="p-8 text-center text-slate-400">目前沒有罰款資料，請點擊「新增罰款」建立第一筆資料。</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-slate-800">罰款管理系統</h2>
                <div className="flex bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
                    <button
                        onClick={() => setActiveTab('stats')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'stats' ? 'bg-indigo-100 text-indigo-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                        統計圖表
                    </button>
                    <button
                        onClick={() => setActiveTab('manage')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'manage' ? 'bg-indigo-100 text-indigo-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                        資料管理
                    </button>
                </div>
            </div>

            {activeTab === 'stats' ? renderStats() : renderManage()}

            <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-4 text-sm text-indigo-700 flex items-start gap-2">
                <div className="mt-0.5"><Filter size={16} /></div>
                <div>
                    提示：此系統資料與 Google Sheet「Fine」同步。新增資料後，請稍候片刻等待後端同步。
                </div>
            </div>
        </div>
    );
}
