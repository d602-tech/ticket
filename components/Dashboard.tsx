import React, { useState, useMemo } from 'react';
import {
    PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import {
    LayoutDashboard, FileWarning, AlertTriangle, CheckCircle2, Clock, DollarSign, FileText, Users, Calendar
} from 'lucide-react';
import { Violation, Project, Fine, ViolationStatus } from '../types';
import { VersionHistory } from './VersionHistory';
import * as XLSX from 'xlsx';

import { StatCard } from './StatCard';
import { getDaysRemaining, formatDate, getStatusLabel } from '../utils';

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
        // Previously totalFineAmount was derived from violations (lecture fees)
        const totalViolationAmount = violations.reduce((sum, v) => sum + (v.fineAmount || 0), 0);
        // New: Total from Fines sheet
        const totalRealFineAmount = fines.reduce((sum, f) => sum + (Number(f.subtotal) || 0), 0);

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
            totalViolationAmount, // Renamed
            totalRealFineAmount, // New
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
            const label = v.status === 'PENDING' ? '待辦理' :
                v.status === 'NOTIFIED' ? '已通知' :
                    v.status === 'SUBMITTED' ? '已提送' : '已完工'; // Matches COMPLETED, or typically "已結案"/"已完成"
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

    const COLORS = ['#818cf8', '#34d399', '#f472b6', '#fbbf24', '#38bdf8', '#c084fc', '#f87171']; // Refined modern palette

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
                    <div className="bg-white dark:bg-sidebar border border-slate-200 dark:border-white/5 rounded-2xl p-6 shadow-sm">
                        <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400 mb-2">
                            <FileText size={24} />
                            <span className="text-sm font-medium">本月罰單件數</span>
                        </div>
                        <div className="text-4xl font-bold text-slate-800 dark:text-white">{viewerMonthlyFines.length} 件</div>
                    </div>
                </div>

                <div className="bg-white dark:bg-sidebar rounded-2xl shadow-sm border border-slate-200 dark:border-white/5 overflow-hidden">
                    <div className="p-6 border-b border-slate-50 dark:border-white/5">
                        <h3 className="font-bold text-slate-700 dark:text-slate-200">罰單明細</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 dark:bg-[#1A2234] text-slate-500 dark:text-slate-400 font-medium">
                                <tr>
                                    <th className="px-6 py-3">日期</th>
                                    <th className="px-6 py-3">承攬商</th>
                                    <th className="px-6 py-3">工程名稱</th>
                                    <th className="px-6 py-3">違規項目</th>
                                    <th className="px-6 py-3 text-right">金額</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                                {viewerMonthlyFines.map((f, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-500 dark:text-slate-300">
                                        <td className="px-6 py-4">{f.date}</td>
                                        <td className="px-6 py-4 font-medium text-slate-700 dark:text-slate-200">{f.contractor}</td>
                                        <td className="px-6 py-4">{f.projectName}</td>
                                        <td className="px-6 py-4">{f.violationItem}</td>
                                        <td className="px-6 py-4 text-right font-mono text-slate-700 dark:text-slate-200">
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
                <h2 className="text-lg font-bold text-slate-700 dark:text-slate-200">{stats.year}年{stats.month}月 罰款統計</h2>
                <input
                    type="month"
                    value={dashboardMonth}
                    onChange={e => setDashboardMonth(e.target.value)}
                    className="border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white dark:bg-slate-800 dark:text-white shadow-sm"
                />
            </div>

            {/* KPI Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                {/* Metric 1: 總罰款金額 (Total Fine Amount) */}
                <div className="relative bg-white dark:bg-sidebar rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-white/5 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden group">
                    <div className="absolute -right-6 -top-6 w-32 h-32 bg-blue-50 dark:bg-blue-900/10 rounded-full blur-2xl group-hover:bg-blue-100 dark:group-hover:bg-blue-900/20 transition-all"></div>
                    <div className="relative z-10 flex flex-col h-full justify-between">
                        <div className="flex justify-between items-start mb-6">
                            <div className="p-3 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-2xl group-hover:scale-110 transition-transform">
                                <DollarSign size={24} strokeWidth={2.5} />
                            </div>
                            <span className="text-xs font-bold px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-lg">累積總額</span>
                        </div>
                        <div>
                            <h3 className="text-slate-500 dark:text-slate-400 font-medium text-xs tracking-wider uppercase mb-1">罰款總額</h3>
                            <div className="text-3xl font-black text-slate-800 dark:text-white tracking-tight">
                                ${stats.totalRealFineAmount.toLocaleString()}
                            </div>
                            <p className="text-xs text-slate-400 mt-2 flex items-center gap-1 font-medium">
                                <FileText size={12} /> 共計 {stats.totalFineCount} 筆紀錄
                            </p>
                        </div>
                    </div>
                </div>

                {/* Metric 2: 本月罰款 (Monthly Fine Amount) */}
                <div className="relative bg-white dark:bg-sidebar rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-white/5 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden group">
                    <div className="absolute -right-6 -top-6 w-32 h-32 bg-indigo-50 dark:bg-indigo-900/10 rounded-full blur-2xl group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/20 transition-all"></div>
                    <div className="relative z-10 flex flex-col h-full justify-between">
                        <div className="flex justify-between items-start mb-6">
                            <div className="p-3 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-2xl group-hover:scale-110 transition-transform">
                                <Calendar size={24} strokeWidth={2.5} />
                            </div>
                            <span className="text-xs font-bold px-2 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg">{stats.month} 月</span>
                        </div>
                        <div>
                            <h3 className="text-slate-500 dark:text-slate-400 font-medium text-xs tracking-wider uppercase mb-1">本月新增罰款</h3>
                            <div className="text-3xl font-black text-slate-800 dark:text-white tracking-tight">
                                ${stats.monthlyFineAmount.toLocaleString()}
                            </div>
                            <p className="text-xs text-slate-400 mt-2 flex items-center gap-1 font-medium">
                                <FileText size={12} /> 本月共 {stats.monthlyFineCount} 筆
                            </p>
                        </div>
                    </div>
                </div>

                {/* Metric 3: 違規講習金額 (Total Violation Lectures) */}
                <div className="relative bg-white dark:bg-sidebar rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-white/5 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden group">
                    <div className="absolute -right-6 -top-6 w-32 h-32 bg-emerald-50 dark:bg-emerald-900/10 rounded-full blur-2xl group-hover:bg-emerald-100 dark:group-hover:bg-emerald-900/20 transition-all"></div>
                    <div className="relative z-10 flex flex-col h-full justify-between">
                        <div className="flex justify-between items-start mb-6">
                            <div className="p-3 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-2xl group-hover:scale-110 transition-transform">
                                <FileWarning size={24} strokeWidth={2.5} />
                            </div>
                            <span className="text-xs font-bold px-2 py-1 bg-emerald-50 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 rounded-lg">已辦理 {stats.completedCount} 件</span>
                        </div>
                        <div>
                            <h3 className="text-slate-500 dark:text-slate-400 font-medium text-xs tracking-wider uppercase mb-1">違規講習總扣款</h3>
                            <div className="text-3xl font-black text-slate-800 dark:text-white tracking-tight">
                                ${stats.totalViolationAmount.toLocaleString()}
                            </div>
                            <p className="text-xs text-slate-400 mt-2 flex items-center gap-1 font-medium">
                                <AlertTriangle size={12} /> 包含所有未結與已結案
                            </p>
                        </div>
                    </div>
                </div>

                {/* Metric 4: 待結案違規 (Pending Items) */}
                <div className="relative bg-white dark:bg-sidebar rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-white/5 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden group border-b-4 border-rose-500">
                    <div className="absolute -right-6 -top-6 w-32 h-32 bg-rose-50 dark:bg-rose-900/10 rounded-full blur-2xl group-hover:bg-rose-100 dark:group-hover:bg-rose-900/20 transition-all"></div>
                    <div className="relative z-10 flex flex-col h-full justify-between">
                        <div className="flex justify-between items-start mb-6">
                            <div className="p-3 bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-2xl group-hover:scale-110 transition-transform">
                                <AlertTriangle size={24} strokeWidth={2.5} />
                            </div>
                            {stats.overdueCount > 0 && (
                                <span className="text-[10px] font-black px-2 py-1 bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400 rounded-full animate-pulse uppercase">
                                    {stats.overdueCount} 件已逾期
                                </span>
                            )}
                        </div>
                        <div>
                            <h3 className="text-slate-500 dark:text-slate-400 font-medium text-xs tracking-wider uppercase mb-1">未結案違規紀錄</h3>
                            <div className="text-3xl font-black text-slate-800 dark:text-white tracking-tight">
                                {stats.pendingCount}
                            </div>
                            <p className="text-xs text-slate-400 mt-2 flex items-center gap-1 font-medium">
                                <Clock size={12} /> 需盡速安排講習與提送
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Urgent Alerts Timeline Banner */}
            {stats.urgentViolations.length > 0 && (
                <div className="relative overflow-hidden bg-gradient-to-r from-orange-400 to-rose-500 rounded-[2rem] p-[2px] shadow-lg shadow-orange-500/20">
                    <div className="bg-white/95 dark:bg-[#1A2234]/95 backdrop-blur-xl rounded-[30px] p-6 lg:p-8 flex flex-col lg:flex-row items-start lg:items-center gap-8">
                        <div className="flex-shrink-0 flex items-center gap-5">
                            <div className="p-4 bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 rounded-2xl animate-pulse ring-4 ring-orange-50 dark:ring-orange-500/10">
                                <AlertTriangle size={32} strokeWidth={2.5} />
                            </div>
                            <div>
                                <h2 className="text-xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight">
                                    緊急處理事項
                                </h2>
                                <p className="text-orange-600 dark:text-orange-400 text-sm font-bold flex items-center gap-1 mt-1">
                                    <Clock size={16} /> 有 {stats.urgentViolations.length} 件違規紀錄即將到期
                                </p>
                            </div>
                        </div>

                        {/* Scrollable Alerts Row */}
                        <div className="flex-1 w-full overflow-x-auto pb-4 -mb-4 smooth-scroll no-scrollbar">
                            <div className="flex gap-4 w-max pr-8">
                                {stats.urgentViolations.map(v => (
                                    <div key={v.id} className="w-80 bg-slate-50 dark:bg-[#20293A] border border-slate-100 dark:border-white/5 rounded-2xl p-5 flex flex-col justify-between hover:bg-orange-50 dark:hover:bg-orange-500/10 hover:border-orange-200 dark:hover:border-orange-500/30 cursor-pointer transition-all duration-300 group shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]">
                                        <div className="flex justify-between items-start mb-3">
                                            <span className="text-sm font-bold text-slate-800 dark:text-slate-200 line-clamp-1 mr-2">{v.projectName}</span>
                                            <span className="px-2.5 py-1 bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400 text-[10px] tracking-wider font-black rounded-lg whitespace-nowrap">剩 {getDaysRemaining(v.lectureDeadline)} 天</span>
                                        </div>
                                        <div className="text-xs font-medium text-slate-500 dark:text-slate-400 flex justify-between items-center">
                                            <span className="bg-white dark:bg-sidebar px-2 py-1 rounded-md shadow-sm border border-slate-100 dark:border-white/5">{v.contractorName}</span>
                                            <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-orange-500 flex items-center gap-1 font-bold">盡速處理 <Clock size={12} /></span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                {/* 案件分佈 (Pie) */}
                <div className="bg-white dark:bg-sidebar p-8 rounded-3xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-slate-100 dark:border-white/5">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">各工作隊案件分佈</h3>
                            <p className="text-sm text-slate-400">各部門違規佔比統計</p>
                        </div>
                        <div className="p-2 bg-indigo-50 text-indigo-500 rounded-xl">
                            <LayoutDashboard size={20} />
                        </div>
                    </div>
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
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: document.documentElement.classList.contains('dark') ? 'rgba(26, 34, 52, 0.85)' : 'rgba(255, 255, 255, 0.95)',
                                        backdropFilter: 'blur(12px)',
                                        border: document.documentElement.classList.contains('dark') ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.05)',
                                        borderRadius: '16px',
                                        color: document.documentElement.classList.contains('dark') ? '#f1f5f9' : '#1e293b',
                                        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
                                    }}
                                    itemStyle={{
                                        color: document.documentElement.classList.contains('dark') ? '#e2e8f0' : '#475569',
                                        fontWeight: 600
                                    }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 狀態統計 (Bar) */}
                <div className="bg-white dark:bg-sidebar p-8 rounded-3xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-slate-100 dark:border-white/5">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">案件狀態統計</h3>
                            <p className="text-sm text-slate-400">目前所有違規案件處理進度</p>
                        </div>
                        <div className="p-2 bg-blue-50 dark:bg-blue-900/30 text-blue-500 dark:text-blue-400 rounded-xl">
                            <CheckCircle2 size={20} />
                        </div>
                    </div>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData.statusChartData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} dy={10} />
                                <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                                <Tooltip
                                    cursor={{ fill: document.documentElement.classList.contains('dark') ? 'rgba(255,255,255,0.03)' : '#f8fafc' }}
                                    contentStyle={{
                                        backgroundColor: document.documentElement.classList.contains('dark') ? 'rgba(26, 34, 52, 0.85)' : 'rgba(255, 255, 255, 0.95)',
                                        backdropFilter: 'blur(12px)',
                                        border: document.documentElement.classList.contains('dark') ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.05)',
                                        borderRadius: '16px',
                                        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
                                    }}
                                    itemStyle={{
                                        color: document.documentElement.classList.contains('dark') ? '#e2e8f0' : '#475569',
                                        fontWeight: 600
                                    }}
                                />
                                <Bar dataKey="value" fill="#6366f1" radius={[6, 6, 0, 0]} barSize={40}>
                                    {chartData.statusChartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.name === '已結案' || entry.name === '已完成' ? '#10b981' : '#6366f1'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Contractor Chart */}
            <div className="bg-white dark:bg-sidebar p-8 rounded-3xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-slate-100 dark:border-white/5 mb-8">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">承攬商罰款佔比 ({stats.month}月)</h3>
                        <p className="text-sm text-slate-400">本月各廠商違規金額統計</p>
                    </div>
                    <div className="p-2 bg-indigo-50 text-indigo-500 rounded-xl">
                        <Users size={20} />
                    </div>
                </div>
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
                                paddingAngle={3}
                                dataKey="value"
                                label={({ name, value, percent }) => `${name} $${value.toLocaleString()} (${(percent * 100).toFixed(0)}%)`}
                            >
                                {chartData.contractorData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} strokeWidth={2} stroke="#fff" />
                                ))}
                            </Pie>
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: document.documentElement.classList.contains('dark') ? 'rgba(26, 34, 52, 0.85)' : 'rgba(255, 255, 255, 0.95)',
                                    backdropFilter: 'blur(12px)',
                                    border: document.documentElement.classList.contains('dark') ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.05)',
                                    borderRadius: '16px',
                                    color: document.documentElement.classList.contains('dark') ? '#f1f5f9' : '#1e293b',
                                    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
                                }}
                                itemStyle={{
                                    color: document.documentElement.classList.contains('dark') ? '#e2e8f0' : '#475569',
                                    fontWeight: 600
                                }}
                            />
                            <Legend layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{ right: 0 }} />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Recent Violations & Version History */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2">
                    <div className="bg-white dark:bg-sidebar rounded-3xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-slate-100 dark:border-white/5 overflow-hidden h-full">
                        <div className="p-8 border-b border-slate-50 dark:border-white/5 flex justify-between items-center">
                            <div>
                                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">最近違規動態</h3>
                                <p className="text-sm text-slate-400">系統最新登錄的違規案件</p>
                            </div>
                            <div className="p-2 bg-slate-50 dark:bg-slate-800/50 text-slate-500 rounded-xl">
                                <Clock size={20} />
                            </div>
                        </div>
                        <div className="p-6">
                            <div className="relative border-l-2 border-slate-100 dark:border-slate-700/50 ml-6 space-y-6 pb-4">
                                {violations.slice(0, 5).map((v, i) => (
                                    <div key={v.id} className="relative pl-8 group">
                                        {/* Timeline Dot */}
                                        <div className={`absolute -left-[11px] top-1.5 w-5 h-5 rounded-full border-4 border-white dark:border-sidebar shadow-sm ${v.status === ViolationStatus.COMPLETED ? 'bg-emerald-500' : v.status === ViolationStatus.PENDING ? 'bg-amber-500' : 'bg-indigo-500'}`}></div>

                                        <div className="bg-slate-50 dark:bg-[#20293A] p-5 rounded-2xl border border-slate-100 dark:border-white/5 shadow-sm group-hover:shadow-md transition-all group-hover:-translate-y-1">
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-slate-800 dark:text-slate-100 text-base">{v.contractorName}</span>
                                                    <span className="bg-white dark:bg-sidebar px-2 py-0.5 rounded-md text-xs font-medium text-slate-500 dark:text-slate-400 border border-slate-100 dark:border-white/5 shadow-sm line-clamp-1 max-w-[120px] md:max-w-xs">{v.projectName}</span>
                                                </div>
                                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black tracking-wider uppercase ${v.status === ViolationStatus.COMPLETED
                                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400'
                                                    : v.status === ViolationStatus.PENDING
                                                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400'
                                                        : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-400'
                                                    }`}>
                                                    {getStatusLabel(v.status)}
                                                </span>
                                            </div>
                                            <div className="text-sm text-slate-500 dark:text-slate-400 line-clamp-1 mb-2">
                                                {v.description || '無詳細說明'}
                                            </div>
                                            <div className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
                                                <Clock size={12} /> 違規日期: {v.violationDate}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {violations.length === 0 && (
                                    <div className="pl-8 py-8 text-slate-400 flex flex-col items-center gap-3">
                                        <div className="p-4 bg-slate-50 rounded-full">
                                            <FileWarning size={32} />
                                        </div>
                                        <p>目前無違規紀錄</p>
                                    </div>
                                )}
                            </div>
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
