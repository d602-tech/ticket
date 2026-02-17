import React, { useState, useMemo } from 'react';
import {
    PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import {
    LayoutDashboard, FileWarning, AlertTriangle, CheckCircle2, Clock, DollarSign, FileText
} from 'lucide-react';
import { Violation, Project, Fine, ViolationStatus } from '../types';
import { VersionHistory } from './VersionHistory';
import * as XLSX from 'xlsx';

const getStatusLabel = (status: ViolationStatus) => {
    switch (status) {
        case ViolationStatus.PENDING: return '待辦理';
        case ViolationStatus.NOTIFIED: return '已通知';
        case ViolationStatus.SUBMITTED: return '已提送';
        case ViolationStatus.COMPLETED: return '已完成';
        default: return '未知';
    }
};
import { StatCard } from './StatCard';
import { getDaysRemaining, formatDate } from '../utils';

interface DashboardProps {
    role: string;
    violations: Violation[];
    projects: Project[];
    fines: Fine[];
}

export const Dashboard: React.FC<DashboardProps> = ({ role, violations, projects, fines }) => {
    // State for dashboard controls
    const [selectedMonthOffset, setSelectedMonthOffset] = useState(0); // Viewer Mode
    const [dashboardMonth, setDashboardMonth] = useState(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }); // Admin Mode (YYYY-MM)

    // Helper: Get Host Team Color
    const getHostTeamColor = (team: string | undefined) => {
        const colors: Record<string, { bg: string; text: string; border: string }> = {
            '土木工作隊': { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200' },
            '建築工作隊': { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-200' },
            '機械工作隊': { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200' },
            '電氣工作隊': { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-200' },
            '中部工作隊': { bg: 'bg-teal-100', text: 'text-teal-700', border: 'border-teal-200' },
            '南部工作隊': { bg: 'bg-indigo-100', text: 'text-indigo-700', border: 'border-indigo-200' },
        };
        return colors[team || ''] || { bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200' };
    };

    // Memoize Statistics to prevent re-calculation on every render
    const stats = useMemo(() => {
        const pendingCount = violations.filter(v => v.status !== ViolationStatus.COMPLETED).length;
        const overdueCount = violations.filter(v => v.status !== ViolationStatus.COMPLETED && getDaysRemaining(v.lectureDeadline) < 0).length;
        const totalFineAmount = violations.reduce((sum, v) => sum + (v.fineAmount || 0), 0);
        const completedCount = violations.filter(v => v.status === ViolationStatus.COMPLETED).length;
        const totalFineCount = fines.length;

        // Current Dashboard Month Parsing
        const [year, month] = dashboardMonth.split('-').map(Number);

        // Monthly Fines (Selected Month)
        const monthlyFinesList = fines.filter(f => {
            const d = new Date(f.date || '');
            return d.getFullYear() === year && d.getMonth() === month - 1;
        });

        const monthlyFineAmount = monthlyFinesList.reduce((sum, f) => sum + (Number(f.subtotal) || 0), 0);
        const monthlyFineCount = monthlyFinesList.length;

        // Urgent Violations (<= 5 days)
        const urgentViolations = violations.filter(v =>
            v.status !== ViolationStatus.COMPLETED &&
            getDaysRemaining(v.lectureDeadline) <= 5 &&
            getDaysRemaining(v.lectureDeadline) >= 0
        );

        return {
            pendingCount,
            overdueCount,
            totalFineAmount,
            completedCount,
            totalFineCount,
            monthlyFineAmount,
            monthlyFineCount,
            monthlyFinesList,
            urgentViolations,
            year,
            month
        };
    }, [violations, fines, dashboardMonth]);

    // Chart Data Memoization
    const chartData = useMemo(() => {
        // Group by Host Team
        const teamDataMap = new Map<string, number>();
        violations.forEach(v => {
            const project = projects.find(p => p.name === v.projectName);
            const team = project?.hostTeam || '未歸類';
            teamDataMap.set(team, (teamDataMap.get(team) || 0) + 1);
        });
        const teamChartData = Array.from(teamDataMap, ([name, value]) => ({ name, value }));

        // Group by Status
        const statusDataMap = new Map<string, number>();
        violations.forEach(v => {
            // Simplified status label logic
            const label = v.status === 'PENDING' ? '待辦理' :
                v.status === 'NOTIFIED' ? '已通知' :
                    v.status === 'SUBMITTED' ? '已提送' : '已結案';
            statusDataMap.set(label, (statusDataMap.get(label) || 0) + 1);
        });
        const statusChartData = Array.from(statusDataMap, ([name, value]) => ({ name, value }));

        // Contractor Stats (for selected month)
        const contractorData = Object.entries(stats.monthlyFinesList.reduce((acc, curr) => {
            const name = curr.contractor || '未分類';
            acc[name] = (acc[name] || 0) + (Number(curr.subtotal) || 0);
            return acc;
        }, {} as Record<string, number>))
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);

        return { teamChartData, statusChartData, contractorData };
    }, [violations, projects, stats.monthlyFinesList]);

    const COLORS = ['#6366f1', '#06b6d4', '#f59e0b', '#ef4444', '#8b5cf6', '#10b981'];

    // Viewer Mode Implementation
    if (role === 'viewer') {
        const targetDate = new Date();
        targetDate.setMonth(targetDate.getMonth() + selectedMonthOffset);
        const targetYear = targetDate.getFullYear();
        const targetMonth = targetDate.getMonth();

        const viewerMonthlyFines = fines.filter(f => {
            const d = new Date(f.date || '');
            return d.getFullYear() === targetYear && d.getMonth() === targetMonth;
        });

        const viewerMonthlyTotal = viewerMonthlyFines.reduce((sum, f) => sum + (Number(f.subtotal) || 0), 0);

        return (
            <div className="animate-fade-in space-y-6 max-w-5xl mx-auto">
                <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold text-slate-800">
                        {targetYear}年{targetMonth + 1}月 罰款統計
                    </h2>
                    <div className="flex bg-slate-100 p-1 rounded-lg">
                        <button
                            onClick={() => setSelectedMonthOffset(-1)}
                            className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${selectedMonthOffset === -1 ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            上個月
                        </button>
                        <button
                            onClick={() => setSelectedMonthOffset(0)}
                            className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${selectedMonthOffset === 0 ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            本月
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-2xl p-6 text-white shadow-lg shadow-indigo-200">
                        <div className="flex items-center gap-3 opacity-90 mb-2">
                            <DollarSign size={24} />
                            <span className="text-sm font-medium">本月罰款總額</span>
                        </div>
                        <div className="text-4xl font-bold">${viewerMonthlyTotal.toLocaleString()}</div>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                        <div className="flex items-center gap-3 text-slate-500 mb-2">
                            <FileText size={24} />
                            <span className="text-sm font-medium">本月罰單件數</span>
                        </div>
                        <div className="text-4xl font-bold text-slate-800">{viewerMonthlyFines.length} 件</div>
                    </div>
                </div>

                {/* Table Logic ... (Simplified for brevity, can duplicate if needed or extract further) */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-6 border-b border-slate-50">
                        <h3 className="font-bold text-slate-700">罰單明細</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-500 font-medium">
                                <tr>
                                    <th className="px-6 py-3">日期</th>
                                    <th className="px-6 py-3">承攬商</th>
                                    <th className="px-6 py-3">工程名稱</th>
                                    <th className="px-6 py-3">違規項目</th>
                                    <th className="px-6 py-3 text-right">金額</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {viewerMonthlyFines.map((f, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50">
                                        <td className="px-6 py-4">{f.date}</td>
                                        <td className="px-6 py-4 font-medium text-slate-700">{f.contractor}</td>
                                        <td className="px-6 py-4 text-slate-500">{f.projectName}</td>
                                        <td className="px-6 py-4">{f.violationItem}</td>
                                        <td className="px-6 py-4 text-right font-mono text-slate-700">
                                            ${Number(f.subtotal).toLocaleString()}
                                        </td>
                                    </tr>
                                ))}
                                {viewerMonthlyFines.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                                            本月無罰款紀錄
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    }

    // Admin/User Dashboard
    return (
        <div className="animate-fade-in space-y-6">
            {/* Header & Stats */}
            <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-bold text-slate-700">{stats.year}年{stats.month}月 罰款統計</h2>
                <input
                    type="month"
                    value={dashboardMonth}
                    onChange={e => setDashboardMonth(e.target.value)}
                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
                <StatCard
                    title="已結案/已辦理"
                    value={stats.completedCount}
                    icon={CheckCircle2}
                    colorClass="bg-emerald-500"
                />
                <StatCard
                    title="累積罰款金額"
                    value={`$${stats.totalFineAmount.toLocaleString()}`}
                    icon={DollarSign}
                    colorClass="bg-indigo-900"
                    isCurrency
                />
                <StatCard
                    title={`${stats.month}月罰款金額`}
                    value={`$${stats.monthlyFineAmount.toLocaleString()}`}
                    icon={DollarSign}
                    colorClass="bg-blue-600"
                    isCurrency
                />
                <StatCard
                    title={`${stats.month}月罰款筆數`}
                    value={stats.monthlyFineCount}
                    icon={FileText}
                    colorClass="bg-cyan-600"
                />
                <StatCard
                    title="總罰款筆數"
                    value={stats.totalFineCount}
                    icon={FileText}
                    colorClass="bg-slate-600"
                />
                <StatCard
                    title="未結案違規"
                    value={stats.pendingCount}
                    icon={AlertTriangle}
                    colorClass="bg-amber-500"
                />
            </div>

            {/* Urgent Alerts */}
            {stats.urgentViolations.length > 0 && (
                <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200/60 rounded-2xl p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-amber-500 rounded-xl shadow-lg shadow-amber-500/20">
                            <AlertTriangle className="w-5 h-5 text-white" />
                        </div>
                        <h2 className="text-base font-bold text-amber-900">
                            到期前5日提醒 <span className="text-amber-600 font-normal">({stats.urgentViolations.length}件待處理)</span>
                        </h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {stats.urgentViolations.map(v => (
                            <div key={v.id} className="flex flex-col justify-between bg-white rounded-xl p-4 shadow-sm border border-amber-100/60 h-full hover:shadow-md transition-shadow">
                                <div className="mb-3">
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-100 text-amber-700 text-xs rounded-full font-semibold">
                                            <Clock size={12} /> 剩 {getDaysRemaining(v.lectureDeadline)} 天
                                        </span>
                                        <span className="text-xs text-slate-400">{formatDate(v.lectureDeadline)}</span>
                                    </div>
                                    <p className="font-semibold text-slate-800 line-clamp-1 mt-1" title={v.projectName}>{v.projectName}</p>
                                    <p className="text-sm text-slate-500 mt-0.5">{v.contractorName}</p>
                                </div>
                                <p className="text-xs text-slate-400 line-clamp-2 bg-slate-50/80 p-2 rounded-lg">
                                    {v.description || '無說明'}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                {/* 案件分佈 (Pie) */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100/80 hover:shadow-md transition-shadow">
                    <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">各工作隊違規佔比</h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={chartData.teamChartData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    fill="#8884d8"
                                    paddingAngle={5}
                                    dataKey="value"
                                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                >
                                    {chartData.teamChartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 狀態統計 (Bar) */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100/80 hover:shadow-md transition-shadow">
                    <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">違規案件狀態統計</h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData.statusChartData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                                <YAxis allowDecimals={false} />
                                <Tooltip
                                    cursor={{ fill: '#f1f5f9' }}
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                />
                                <Bar dataKey="value" fill="#4f46e5" radius={[4, 4, 0, 0]} barSize={40} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Contractor Chart */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100/80 hover:shadow-md transition-shadow mb-8">
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">{stats.month}月各承攬商罰款金額佔比</h3>
                <div className="h-80 relative">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={chartData.contractorData}
                                cx="50%"
                                cy="50%"
                                innerRadius={80}
                                outerRadius={110}
                                fill="#8884d8"
                                paddingAngle={2}
                                dataKey="value"
                                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                            >
                                {chartData.contractorData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip />
                            <Legend layout="vertical" verticalAlign="middle" align="right" />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Recent Violations & Version History */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2">
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-100/80 overflow-hidden h-full">
                        <div className="p-6 border-b border-slate-50 flex justify-between items-center">
                            <h3 className="font-bold text-slate-700 flex items-center gap-2">
                                <FileWarning size={20} className="text-indigo-500" />
                                最近違規紀錄
                            </h3>
                        </div>
                        <div className="divide-y divide-slate-50">
                            {violations.slice(0, 5).map(v => (
                                <div key={v.id} className="p-4 hover:bg-slate-50 transition-colors flex items-center justify-between group">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-1.5 h-10 rounded-full ${v.status === ViolationStatus.COMPLETED ? 'bg-emerald-500' : 'bg-amber-500'}`}></div>
                                        <div>
                                            <div className="font-bold text-slate-700 line-clamp-1">{v.contractorName}</div>
                                            <div className="text-sm text-slate-400 flex items-center gap-1">
                                                <span className="bg-slate-100 px-1.5 rounded text-xs text-slate-500">{v.projectName}</span>
                                                <span>• {v.violationDate}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${v.status === ViolationStatus.COMPLETED ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                                            {getStatusLabel(v.status)}
                                        </span>
                                    </div>
                                </div>
                            ))}
                            {violations.length === 0 && (
                                <div className="p-8 text-center text-slate-400">目前無違規紀錄</div>
                            )}
                        </div>
                    </div>
                </div>
                <div>
                    <VersionHistory />
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
