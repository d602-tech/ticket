import React, { useState, useEffect, useMemo } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell
} from 'recharts';
import { Fine, Project, FineList, Section } from '../types';
import { Plus, X, Trash2, Edit2, Loader2, Filter, Download, Upload, AlertTriangle } from 'lucide-react';
import { syncData } from '../services/storageService';
import { formatDate } from '../utils';
import * as XLSX from 'xlsx';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658'];

interface FineStatsProps {
    projects: Project[];
    fines: Fine[];
    fineList: FineList[];
    sections: Section[];
    onSaveFines: (fines: Fine[]) => void;
}

// Helper to group fines by ticket number
interface TicketGroup {
    ticketNumber: string;
    date: string;
    projectName: string;
    items: Fine[];
    totalAmount: number;
}

export function FineStats({ projects, fines, fineList, sections, onSaveFines }: FineStatsProps) {
    const [activeTab, setActiveTab] = useState<'stats' | 'manage'>('stats');
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Ticket State
    const [currentTicket, setCurrentTicket] = useState<Partial<Fine>>({
        date: new Date().toISOString().split('T')[0],
        relationship: '舊約' // Default relationship
    });

    // Items for the current ticket
    const [ticketItems, setTicketItems] = useState<Partial<Fine>[]>([]);

    // Current Item being edited/added
    const [currentItem, setCurrentItem] = useState<Partial<Fine>>({
        count: 1,
        multiplier: 1,
        relationship: '舊約'
    });

    // Validations
    const [showValidationAlert, setShowValidationAlert] = useState(false);

    // Filtered lists
    const [availableIssuers, setAvailableIssuers] = useState<Section[]>([]);

    // Dropdown Options
    const ticketTypes = ['走動管理', 'CCTV', '工安查核', '現檢員', '監造', '營建處', '勞檢'];
    const cctvTypes = ['設備', '現檢員', '工安組'];
    const allocTypes = ['處長', '副處長', '課長', '部門經理', '工安經理', '工安課長', '現檢員'];
    const relationships = ['舊約', '新約'];

    // --- Effects for Ticket Level ---

    // Auto-fill Host Team/Contractor based on Project
    useEffect(() => {
        if (currentTicket.projectName) {
            const proj = projects.find(p => p.name === currentTicket.projectName);
            if (proj) {
                setCurrentTicket(prev => ({
                    ...prev,
                    hostTeam: proj.hostTeam,
                    contractor: proj.contractor
                }));
            }
        }
    }, [currentTicket.projectName, projects]);

    // Update Issuers based on Host Team
    useEffect(() => {
        if (currentTicket.hostTeam) {
            setAvailableIssuers(sections.filter(s => s.hostTeam === currentTicket.hostTeam));
        } else {
            setAvailableIssuers([]);
        }
    }, [currentTicket.hostTeam, sections]);

    // --- Effects for Item Level ---

    // Auto-fill Unit Price/Unit based on Violation Item
    useEffect(() => {
        if (currentItem.violationItem) {
            const item = fineList.find(i => i.violationItem === currentItem.violationItem);
            if (item) {
                setCurrentItem(prev => ({
                    ...prev,
                    unitPrice: item.amount,
                    unit: item.unit
                }));
            }
        }
    }, [currentItem.violationItem, fineList]);

    // Auto-calculate Subtotal
    useEffect(() => {
        const price = Number(currentItem.unitPrice) || 0;
        const count = Number(currentItem.count) || 1;
        const mult = Number(currentItem.multiplier) || 1;
        const subtotal = price * count * mult;

        if (currentItem.subtotal !== subtotal) {
            setCurrentItem(prev => ({ ...prev, subtotal, totalAmount: subtotal }));
        }
    }, [currentItem.unitPrice, currentItem.count, currentItem.multiplier]);

    // Total Amount Validation for Ticket
    const currentTicketTotal = useMemo(() => {
        return ticketItems.reduce((sum, item) => sum + (Number(item.subtotal) || 0), 0);
    }, [ticketItems]);

    useEffect(() => {
        if (currentTicketTotal > 10000) {
            setShowValidationAlert(true);
        } else {
            setShowValidationAlert(false);
        }
    }, [currentTicketTotal]);

    // --- Handlers ---

    const handleAddItem = () => {
        if (!currentItem.violationItem) {
            alert('請選擇違規項目');
            return;
        }

        // Price change validation
        if (currentItem.violationItem) {
            const originalItem = fineList.find(i => i.violationItem === currentItem.violationItem);
            if (originalItem && Number(currentItem.unitPrice) !== Number(originalItem.amount)) {
                if (!currentItem.priceAdjustmentReason) {
                    alert('修改單價時必須填寫「修改原因」');
                    return;
                }
            }
        }

        const newItem = {
            ...currentItem,
            // Inherit ticket level fields
            date: currentTicket.date,
            issueDate: currentTicket.issueDate,
            ticketNumber: currentTicket.ticketNumber,
            projectName: currentTicket.projectName,
            hostTeam: currentTicket.hostTeam,
            issuer: currentTicket.issuer,
            contractor: currentTicket.contractor,
            supervisor: currentTicket.supervisor,
            ticketType: currentTicket.ticketType,
            cctvType: currentTicket.cctvType,
            allocation: currentTicket.allocation,
            seq: Date.now().toString() + Math.random().toString(36).substr(2, 5)
        };

        setTicketItems([...ticketItems, newItem]);
        setCurrentItem({
            count: 1,
            multiplier: 1,
            relationship: '舊約'
        });
    };

    const handleRemoveItem = (index: number) => {
        const newItems = [...ticketItems];
        newItems.splice(index, 1);
        setTicketItems(newItems);
    };

    const handleSaveTicket = async () => {
        if (ticketItems.length === 0) {
            alert('請至少新增一筆罰款細項');
            return;
        }
        if (!currentTicket.ticketNumber || !currentTicket.projectName || !currentTicket.date) {
            alert('請填寫罰單編號、日期與工程名稱');
            return;
        }

        if (showValidationAlert) {
            if (!confirm('本單總金額超過 10,000 元，請確認是否繼續儲存？(應進行違規講習)')) {
                return;
            }
        }

        setIsSaving(true);
        try {
            // Filter out items that are part of this ticket being edited (if editing existing)
            // But since input method separates creation, we can just append new items 
            // OR if we support editing a whole ticket, we need to remove old items with this ticket number.
            // For simplicity in this version, we act as 'Upsert' based on seq, but logic simpler to just add new ones
            // or replace if we are implementing full ticket editing.

            // Current Save Logic:
            // 1. Identify all items in `ticketItems`.
            // 2. Ensure they have all latest Ticket Level fields.
            // 3. Update main `fines` state.

            const finalItems = ticketItems.map(item => ({
                ...item,
                ...currentTicket,
                seq: item.seq || Date.now().toString() + Math.random().toString(36).substr(2, 5)
            })) as Fine[];

            // If we are editing a ticket (based on ticketNumber presence in existing fines?),
            // we should probably remove old entries for this ticket to avoid duplicates if user modified them.
            // But unique ID is `seq`.

            // Let's assume we are replacing any existing fines with same IDs, or adding new.
            // To support "Edit Ticket", we would need to know which fines belonged to it.

            // Merge logic: Remove fines with same seq as finalItems, then add finalItems.
            const statsSeqs = finalItems.map(f => f.seq);
            const otherFines = fines.filter(f => !statsSeqs.includes(f.seq));
            const updatedFines = [...otherFines, ...finalItems];

            const result = await syncData(undefined, undefined, undefined, updatedFines);
            onSaveFines(result.fines);
            setIsEditing(false);
            resetForm();
        } catch (error) {
            console.error(error);
            alert('儲存失敗');
        } finally {
            setIsSaving(false);
        }
    };

    const resetForm = () => {
        setCurrentTicket({
            date: new Date().toISOString().split('T')[0],
            relationship: '舊約'
        });
        setTicketItems([]);
        setCurrentItem({
            count: 1,
            multiplier: 1,
            relationship: '舊約'
        });
        setShowValidationAlert(false);
    };

    const handleEditTicket = (ticketNo: string) => {
        const items = fines.filter(f => f.ticketNumber === ticketNo);
        if (items.length > 0) {
            // Load ticket level info from first item
            const first = items[0];
            setCurrentTicket({
                date: first.date,
                issueDate: first.issueDate,
                ticketNumber: first.ticketNumber,
                projectName: first.projectName,
                hostTeam: first.hostTeam,
                contractor: first.contractor,
                issuer: first.issuer,
                supervisor: first.supervisor,
                ticketType: first.ticketType,
                cctvType: first.cctvType,
                allocation: first.allocation,
                note: first.note
            });
            setTicketItems(items);
            setIsEditing(true);
            setActiveTab('manage');
        }
    };

    const handleDeleteTicket = async (ticketNo: string) => {
        if (!confirm(`確定刪除罰單 ${ticketNo} 及其所有細項?`)) return;
        setIsSaving(true);
        try {
            const updatedFines = fines.filter(f => f.ticketNumber !== ticketNo);
            const result = await syncData(undefined, undefined, undefined, updatedFines);
            onSaveFines(result.fines);
        } catch (e) {
            alert('刪除失敗');
        } finally {
            setIsSaving(false);
        }
    };

    // Excel Export
    const handleExport = () => {
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(fines);
        XLSX.utils.book_append_sheet(wb, ws, "Fines");
        XLSX.writeFile(wb, "Fines_Export.xlsx");
    };

    // Excel Import
    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
            const bstr = evt.target?.result;
            const wb = XLSX.read(bstr, { type: 'binary' });
            const wsname = wb.SheetNames[0];
            const ws = wb.Sheets[wsname];
            const data = XLSX.utils.sheet_to_json(ws) as Fine[];

            if (confirm(`即將匯入 ${data.length} 筆資料，這將合併至現有資料。確定?`)) {
                setIsSaving(true);
                try {
                    // Merge: append new data. You might want strategies (skip duplicates based on seq?)
                    // For now, simple append.
                    const updatedFines = [...fines, ...data];
                    const result = await syncData(undefined, undefined, undefined, updatedFines);
                    onSaveFines(result.fines);
                    alert('匯入成功');
                } catch (err) {
                    alert('匯入失敗');
                    console.error(err);
                } finally {
                    setIsSaving(false);
                }
            }
        };
        reader.readAsBinaryString(file);
    };

    // Render Stats ... (Keep logic but maybe update grouping)
    // Grouping by Ticket for management view
    const tickets = useMemo(() => {
        const groups: Record<string, TicketGroup> = {};
        fines.forEach(f => {
            const tNo = f.ticketNumber || 'Unknown';
            if (!groups[tNo]) {
                groups[tNo] = {
                    ticketNumber: tNo,
                    date: f.date || '',
                    projectName: f.projectName || '',
                    items: [],
                    totalAmount: 0
                };
            }
            groups[tNo].items.push(f);
            groups[tNo].totalAmount += (Number(f.subtotal) || 0);
        });
        return Object.values(groups).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [fines]);

    // Existing Stats Render Logic (Simplified for brevity, or kept same)
    const renderStats = () => {
        // ... (Keep existing stats logic, it relies on `fines` prop which is still flat list)
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
                </div>
            </div>
        )
    };

    const renderManage = () => {
        if (isEditing) {
            return (
                <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-200 animate-in zoom-in-95 duration-200">
                    {/* Ticket Header Inputs */}
                    <div className="border-b border-slate-100 p-4 bg-slate-50 rounded-t-xl">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-slate-700">罰單基本資料</h3>
                            <div className="text-xl font-bold text-red-600">
                                自計總額: ${currentTicketTotal.toLocaleString()}
                                {showValidationAlert && <span className="text-xs ml-2 bg-red-100 text-red-600 px-2 py-1 rounded-full"><AlertTriangle size={12} className="inline mr-1" />超過1萬</span>}
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">罰單編號 *</label>
                                <input type="text" className="w-full p-2 border rounded-lg"
                                    value={currentTicket.ticketNumber || ''}
                                    onChange={e => setCurrentTicket({ ...currentTicket, ticketNumber: e.target.value })}
                                    placeholder="輸入罰單編號"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">開罰日期 *</label>
                                <input type="date" className="w-full p-2 border rounded-lg"
                                    value={currentTicket.date || ''}
                                    onChange={e => setCurrentTicket({ ...currentTicket, date: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">發文日期</label>
                                <input type="date" className="w-full p-2 border rounded-lg"
                                    value={currentTicket.issueDate || ''}
                                    onChange={e => setCurrentTicket({ ...currentTicket, issueDate: e.target.value })}
                                />
                            </div>

                            <div className="md:col-span-3">
                                <label className="block text-sm font-medium text-slate-700 mb-1">工程名稱 (序號+簡稱) *</label>
                                <select className="w-full p-2 border rounded-lg font-mono"
                                    value={currentTicket.projectName || ''}
                                    onChange={e => setCurrentTicket({ ...currentTicket, projectName: e.target.value })}
                                >
                                    <option value="">請選擇工程...</option>
                                    {projects.map(p => (
                                        <option key={p.id} value={p.name}>
                                            {String(p.sequence).padStart(3, '0')} - {p.abbreviation}
                                        </option>
                                    ))}
                                </select>
                                {currentTicket.projectName && (
                                    <div className="mt-1 text-sm text-slate-500 pl-2 border-l-2 border-slate-300">
                                        {currentTicket.projectName}
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">主辦工作隊</label>
                                <div className="p-2 bg-slate-100 rounded-lg text-slate-600 text-sm h-10 flex items-center">
                                    {currentTicket.hostTeam || '-'}
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">開單人 *</label>
                                <select className="w-full p-2 border rounded-lg"
                                    value={currentTicket.issuer || ''}
                                    onChange={e => setCurrentTicket({ ...currentTicket, issuer: e.target.value })}
                                >
                                    <option value="">請選擇...</option>
                                    {availableIssuers.map((s, idx) => (
                                        <option key={idx} value={s.name}>{s.name} ({s.title})</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">CCTV 缺失種類</label>
                                <select className="w-full p-2 border rounded-lg" value={currentTicket.cctvType || ''} onChange={e => setCurrentTicket({ ...currentTicket, cctvType: e.target.value })}>
                                    <option value="">請選擇</option>
                                    {cctvTypes.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">開單類型</label>
                                <select className="w-full p-2 border rounded-lg" value={currentTicket.ticketType || ''} onChange={e => setCurrentTicket({ ...currentTicket, ticketType: e.target.value })}>
                                    <option value="">請選擇</option>
                                    {ticketTypes.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">督導人</label>
                                <input type="text" className="w-full p-2 border rounded-lg" value={currentTicket.supervisor || ''} onChange={e => setCurrentTicket({ ...currentTicket, supervisor: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">忠哥分配</label>
                                <select className="w-full p-2 border rounded-lg" value={currentTicket.allocation || ''} onChange={e => setCurrentTicket({ ...currentTicket, allocation: e.target.value })}>
                                    <option value="">請選擇</option>
                                    {allocTypes.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                            <div className="md:col-span-3">
                                <label className="block text-sm font-medium text-slate-700 mb-1">備註</label>
                                <input type="text" className="w-full p-2 border rounded-lg" value={currentTicket.note || ''} onChange={e => setCurrentTicket({ ...currentTicket, note: e.target.value })} />
                            </div>
                        </div>
                    </div>

                    {/* Fine Items Input Area */}
                    <div className="p-4 bg-indigo-50 border-b border-indigo-100">
                        <h4 className="font-bold text-indigo-800 mb-2 flex items-center gap-2">
                            <Plus size={16} /> 新增罰款項目
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end">
                            <div className="md:col-span-4">
                                <label className="block text-xs font-medium text-indigo-700 mb-1">違規項目</label>
                                <select className="w-full p-2 border border-indigo-200 rounded text-sm"
                                    value={currentItem.violationItem || ''}
                                    onChange={e => setCurrentItem({ ...currentItem, violationItem: e.target.value })}
                                >
                                    <option value="">選擇違規項目...</option>
                                    {fineList.map((item, idx) => (
                                        <option key={idx} value={item.violationItem}>{item.violationItem?.substring(0, 20)}...</option>
                                    ))}
                                </select>
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-xs font-medium text-indigo-700 mb-1">單價</label>
                                <input type="number" className="w-full p-2 border border-indigo-200 rounded text-sm"
                                    value={currentItem.unitPrice || 0}
                                    onChange={e => setCurrentItem({ ...currentItem, unitPrice: e.target.value })}
                                />
                            </div>
                            <div className="md:col-span-1">
                                <label className="block text-xs font-medium text-indigo-700 mb-1">件數</label>
                                <input type="number" className="w-full p-2 border border-indigo-200 rounded text-sm"
                                    value={currentItem.count}
                                    onChange={e => setCurrentItem({ ...currentItem, count: e.target.value })}
                                />
                            </div>
                            <div className="md:col-span-1">
                                <label className="block text-xs font-medium text-indigo-700 mb-1">倍數</label>
                                <input type="number" className="w-full p-2 border border-indigo-200 rounded text-sm"
                                    value={currentItem.multiplier}
                                    onChange={e => setCurrentItem({ ...currentItem, multiplier: e.target.value })}
                                />
                            </div>
                            <div className="md:col-span-1">
                                <label className="block text-xs font-medium text-indigo-700 mb-1">關係</label>
                                <select className="w-full p-2 border border-indigo-200 rounded text-sm"
                                    value={currentItem.relationship || '舊約'}
                                    onChange={e => setCurrentItem({ ...currentItem, relationship: e.target.value })}
                                >
                                    {relationships.map(r => <option key={r} value={r}>{r}</option>)}
                                </select>
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-xs font-medium text-indigo-700 mb-1">修改單價原因</label>
                                <input type="text" className="w-full p-2 border border-indigo-200 rounded text-sm"
                                    placeholder="若修改單價必填"
                                    value={currentItem.priceAdjustmentReason || ''}
                                    onChange={e => setCurrentItem({ ...currentItem, priceAdjustmentReason: e.target.value })}
                                />
                            </div>
                            <div className="md:col-span-1">
                                <button onClick={handleAddItem} className="w-full py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 text-sm">
                                    加入
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Added Items List */}
                    <div className="p-4">
                        <h4 className="font-bold text-slate-700 mb-2">已加入項目</h4>
                        <table className="w-full text-sm text-left border rounded-lg overflow-hidden">
                            <thead className="bg-slate-100 text-slate-600">
                                <tr>
                                    <th className="px-3 py-2">違規項目</th>
                                    <th className="px-3 py-2 text-right">單價</th>
                                    <th className="px-3 py-2 text-right">件數</th>
                                    <th className="px-3 py-2 text-right">倍數</th>
                                    <th className="px-3 py-2 text-right">小計</th>
                                    <th className="px-3 py-2">關係</th>
                                    <th className="px-3 py-2">原因</th>
                                    <th className="px-3 py-2">操作</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {ticketItems.map((item, idx) => (
                                    <tr key={idx}>
                                        <td className="px-3 py-2 truncate max-w-xs">{item.violationItem}</td>
                                        <td className="px-3 py-2 text-right">{Number(item.unitPrice).toLocaleString()}</td>
                                        <td className="px-3 py-2 text-right">{item.count}</td>
                                        <td className="px-3 py-2 text-right">{item.multiplier}</td>
                                        <td className="px-3 py-2 text-right font-bold text-slate-700">{Number(item.subtotal).toLocaleString()}</td>
                                        <td className="px-3 py-2">{item.relationship}</td>
                                        <td className="px-3 py-2 text-slate-500 text-xs">{item.priceAdjustmentReason}</td>
                                        <td className="px-3 py-2">
                                            <button onClick={() => handleRemoveItem(idx)} className="text-red-500 hover:text-red-700"><X size={14} /></button>
                                        </td>
                                    </tr>
                                ))}
                                {ticketItems.length === 0 && <tr><td colSpan={8} className="p-4 text-center text-slate-400">尚無項目</td></tr>}
                            </tbody>
                        </table>
                    </div>

                    <div className="p-4 border-t flex justify-between items-center bg-slate-50 rounded-b-xl">
                        {showValidationAlert && (
                            <div className="text-red-600 font-bold flex items-center gap-2">
                                <AlertTriangle size={20} />
                                總額超過 10,000 元，請發起違規講習！
                            </div>
                        )}
                        <div className="flex gap-3 ml-auto">
                            <button onClick={() => { setIsEditing(false); resetForm(); }} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">取消</button>
                            <button onClick={handleSaveTicket} disabled={isSaving} className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2">
                                {isSaving && <Loader2 className="animate-spin" size={18} />}
                                儲存整張罰單
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in duration-500">
                <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <h3 className="font-bold text-slate-700">罰單列表 (依單號群組)</h3>
                        <div className="flex gap-2">
                            <button onClick={handleExport} className="flex items-center gap-1 px-3 py-1.5 border hover:bg-slate-50 rounded text-sm text-slate-600">
                                <Download size={14} /> 匯出 Excel
                            </button>
                            <label className="flex items-center gap-1 px-3 py-1.5 border hover:bg-slate-50 rounded text-sm text-slate-600 cursor-pointer">
                                <Upload size={14} /> 匯入 Excel
                                <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleImport} />
                            </label>
                        </div>
                    </div>
                    <button onClick={() => { resetForm(); setIsEditing(true); }} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm transition-colors">
                        <Plus size={16} /> 新增罰單
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 font-medium">
                            <tr>
                                <th className="px-4 py-3">罰單編號</th>
                                <th className="px-4 py-3">日期</th>
                                <th className="px-4 py-3">工程名稱</th>
                                <th className="px-4 py-3 text-center">細項數</th>
                                <th className="px-4 py-3 text-right">總金額</th>
                                <th className="px-4 py-3 text-right">操作</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {tickets.map((t, idx) => (
                                <tr key={idx} className="hover:bg-slate-50 transition-colors group cursor-pointer" onClick={() => handleEditTicket(t.ticketNumber)}>
                                    <td className="px-4 py-3 font-mono font-medium text-slate-700">{t.ticketNumber}</td>
                                    <td className="px-4 py-3 font-mono text-xs">{formatDate(t.date)}</td>
                                    <td className="px-4 py-3 font-medium text-slate-600">{t.projectName}</td>
                                    <td className="px-4 py-3 text-center">
                                        <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-xs">{t.items.length}</span>
                                    </td>
                                    <td className="px-4 py-3 text-right font-bold text-red-600">${t.totalAmount.toLocaleString()}</td>
                                    <td className="px-4 py-3 text-right">
                                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={(e) => { e.stopPropagation(); handleEditTicket(t.ticketNumber); }} className="p-1 text-slate-400 hover:text-indigo-600 transition-colors"><Edit2 size={16} /></button>
                                            <button onClick={(e) => { e.stopPropagation(); handleDeleteTicket(t.ticketNumber); }} className="p-1 text-slate-400 hover:text-red-600 transition-colors"><Trash2 size={16} /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {tickets.length === 0 && (
                                <tr><td colSpan={6} className="p-8 text-center text-slate-400">目前沒有資料，請點擊「新增罰單」建立第一筆資料。</td></tr>
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
                    提示：此系統資料與 Google Sheet「Fine」同步。支援 Excel 匯入/匯出。
                </div>
            </div>
        </div>
    );
}
