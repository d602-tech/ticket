import React, { useState, useMemo } from 'react';
import {
    PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ComposedChart, Line, Area
} from 'recharts';
import {
    LayoutDashboard, FileWarning, AlertTriangle, CheckCircle2, Clock, DollarSign, FileText, Users, Calendar, BarChart3, TrendingUp
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
    const [statusPieMode, setStatusPieMode] = useState<'AMOUNT' | 'COUNT'>('AMOUNT');
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
        // 1. Group by Host Team (Amount & Count)
        const teamDataMap = new Map<string, { amount: number; count: number }>();
        violations.forEach(v => {
            const project = projects.find(p => p.name === v.projectName);
            const team = project?.hostTeam || '未歸類';
            const current = teamDataMap.get(team) || { amount: 0, count: 0 };
            teamDataMap.set(team, {
                amount: current.amount + (v.fineAmount || 0),
                count: current.count + 1
            });
        });
        const teamChartData = Array.from(teamDataMap, ([name, { amount, count }]) => ({ name, amount, count }));

        // 2. Group by Status (Amount & Count)
        const statusDataMap = new Map<string, { amount: number; count: number }>();
        violations.forEach(v => {
            const label = v.status === 'PENDING' ? '待辦理' :
                v.status === 'NOTIFIED' ? '已通知' :
                    v.status === 'SUBMITTED' ? '已提送' : '已結案';
            const current = statusDataMap.get(label) || { amount: 0, count: 0 };
            statusDataMap.set(label, {
                amount: current.amount + (v.fineAmount || 0),
                count: current.count + 1
            });
        });
        const statusChartData = Array.from(statusDataMap, ([name, { amount, count }]) => ({ name, amount, count }));

        // 3. 6-Month Trend Data
        const trendDataMap = new Map<string, { amount: number; count: number }>();
        const now = new Date();
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            trendDataMap.set(monthStr, { amount: 0, count: 0 });
        }

        violations.forEach(v => {
            if (!v.violationDate) return;
            const monthStr = v.violationDate.substring(0, 7);
            if (trendDataMap.has(monthStr)) {
                const current = trendDataMap.get(monthStr)!;
                current.amount += (v.fineAmount || 0);
                current.count += 1;
            }
        });
        const trendChartData = Array.from(trendDataMap, ([name, { amount, count }]) => ({ name, amount, count }));

        return { teamChartData, statusChartData, trendChartData };
    }, [violations, projects]);

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
                    <div className="bg-gradient-to-br from-[#4F46E5] to-[#7C3AED] dark:from-[#3730A3] dark:to-[#5B21B6] rounded-[32px] p-8 text-white shadow-xl shadow-indigo-500/20">
                        <div className="flex items-center gap-3 opacity-90 mb-4">
                            <div className="p-3 bg-white/20 text-white rounded-2xl backdrop-blur-md">
                                <DollarSign size={24} strokeWidth={2.5} />
                            </div>
                            <span className="text-sm font-bold tracking-wider">本月罰款總額</span>
                        </div>
                        <div className="text-4xl font-black tracking-tight">${viewerMonthlyTotal.toLocaleString()}</div>
                    </div>
                    <div className="bg-white dark:bg-[#1E2024] border border-transparent dark:border-white/[0.02] shadow-md shadow-indigo-900/5 dark:shadow-none rounded-[32px] p-8">
                        <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400 mb-4">
                            <div className="p-3 bg-indigo-50 dark:bg-[#2B2F36] text-indigo-600 dark:text-indigo-400 rounded-2xl shadow-sm">
                                <FileText size={24} strokeWidth={2.5} />
                            </div>
                            <span className="text-sm font-bold tracking-wider">本月罰單件數</span>
                        </div>
                        <div className="text-4xl font-black text-slate-800 dark:text-white tracking-tight">{viewerMonthlyFines.length} 件</div>
                    </div>
                </div>

                <div className="bg-white dark:bg-[#1E2024] rounded-[32px] shadow-md shadow-indigo-900/5 dark:shadow-none border border-transparent dark:border-white/[0.02] overflow-hidden">
                    <div className="p-8 border-b border-slate-50 dark:border-white/[0.02]">
                        <h3 className="text-xl font-extrabold text-slate-800 dark:text-white tracking-tight">罰單明細</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">本月所有登錄之罰單資訊</p>
                    </div>
                    <div className="overflow-x-auto p-4">
                        <table className="w-full text-sm text-left border-separate border-spacing-y-2">
                            <thead className="bg-slate-50 dark:bg-[#2B2F36] text-slate-500 dark:text-slate-400 font-medium rounded-xl">
                                <tr>
                                    <th className="px-6 py-4 rounded-l-2xl">日期</th>
                                    <th className="px-6 py-4">承攬商</th>
                                    <th className="px-6 py-4">工程名稱</th>
                                    <th className="px-6 py-4">違規項目</th>
                                    <th className="px-6 py-4 text-right rounded-r-2xl">金額</th>
                                </tr>
                            </thead>
                            <tbody>
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

            {/* KPI Metrics Grid - Material 3 Style */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                {/* Metric 1: HERO Card (Total Fines) */}
                <div className="relative bg-gradient-to-br from-[#4F46E5] to-[#7C3AED] dark:from-[#3730A3] dark:to-[#5B21B6] rounded-[32px] p-8 shadow-xl shadow-indigo-500/20 hover:shadow-2xl hover:shadow-indigo-500/30 hover:-translate-y-1 transition-all duration-300 overflow-hidden group">
                    <div className="absolute -right-10 -top-10 w-48 h-48 bg-white/10 rounded-full blur-3xl group-hover:bg-white/20 transition-all"></div>
                    <div className="relative z-10 flex flex-col h-full justify-between">
                        <div className="flex justify-between items-start mb-6">
                            <div className="p-4 bg-white/20 text-white rounded-2xl backdrop-blur-md group-hover:scale-110 transition-transform">
                                <DollarSign size={28} strokeWidth={2.5} />
                            </div>
                            <span className="text-xs font-bold px-3 py-1.5 bg-white/20 text-white rounded-xl backdrop-blur-md">累積總額</span>
                        </div>
                        <div>
                            <h3 className="text-indigo-100 font-medium text-sm tracking-wider uppercase mb-1">罰款總額</h3>
                            <div className="text-4xl font-black text-white tracking-tight">
                                ${stats.totalRealFineAmount.toLocaleString()}
                            </div>
                            <p className="text-sm text-indigo-100/80 mt-3 flex items-center gap-1.5 font-medium">
                                <FileText size={16} /> 共計 {stats.totalFineCount} 筆紀錄
                            </p>
                        </div>
                    </div>
                </div>

                {/* Metric 2: Monthly Fine Amount */}
                <div className="relative bg-indigo-50 dark:bg-[#1E2024] rounded-[32px] p-8 shadow-md shadow-indigo-900/5 dark:shadow-none hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden group border border-transparent dark:border-white/[0.02]">
                    <div className="relative z-10 flex flex-col h-full justify-between">
                        <div className="flex justify-between items-start mb-6">
                            <div className="p-4 bg-white dark:bg-[#2B2F36] text-indigo-600 dark:text-indigo-400 rounded-2xl shadow-sm group-hover:scale-110 transition-transform">
                                <Calendar size={28} strokeWidth={2.5} />
                            </div>
                            <span className="text-xs font-bold px-3 py-1.5 bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 rounded-xl">{stats.month} 月</span>
                        </div>
                        <div>
                            <h3 className="text-indigo-900/60 dark:text-indigo-200/50 font-medium text-sm tracking-wider uppercase mb-1">本月新增罰款</h3>
                            <div className="text-3xl font-black text-indigo-950 dark:text-white tracking-tight">
                                ${stats.monthlyFineAmount.toLocaleString()}
                            </div>
                            <p className="text-sm text-indigo-900/50 dark:text-indigo-200/50 mt-3 flex items-center gap-1.5 font-medium">
                                <FileText size={16} /> 本月共 {stats.monthlyFineCount} 筆
                            </p>
                        </div>
                    </div>
                </div>

                {/* Metric 3: Total Violation Lectures */}
                <div className="relative bg-purple-50 dark:bg-[#1E2024] rounded-[32px] p-8 shadow-md shadow-purple-900/5 dark:shadow-none hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden group border border-transparent dark:border-white/[0.02]">
                    <div className="relative z-10 flex flex-col h-full justify-between">
                        <div className="flex justify-between items-start mb-6">
                            <div className="p-4 bg-white dark:bg-[#2B2F36] text-purple-600 dark:text-purple-400 rounded-2xl shadow-sm group-hover:scale-110 transition-transform">
                                <FileWarning size={28} strokeWidth={2.5} />
                            </div>
                            <span className="text-xs font-bold px-3 py-1.5 bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 rounded-xl">已辦理 {stats.completedCount} 件</span>
                        </div>
                        <div>
                            <h3 className="text-purple-900/60 dark:text-purple-200/50 font-medium text-sm tracking-wider uppercase mb-1">講習總扣款</h3>
                            <div className="text-3xl font-black text-purple-950 dark:text-white tracking-tight">
                                ${stats.totalViolationAmount.toLocaleString()}
                            </div>
                            <p className="text-sm text-purple-900/50 dark:text-purple-200/50 mt-3 flex items-center gap-1.5 font-medium">
                                <CheckCircle2 size={16} /> 包含所有狀態
                            </p>
                        </div>
                    </div>
                </div>

                {/* Metric 4: Pending Items */}
                <div className="relative bg-rose-50 dark:bg-[#1E2024] rounded-[32px] p-8 shadow-md shadow-rose-900/5 dark:shadow-none hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden group border border-transparent dark:border-white/[0.02]">
                    <div className="relative z-10 flex flex-col h-full justify-between">
                        <div className="flex justify-between items-start mb-6">
                            <div className="p-4 bg-white dark:bg-[#2B2F36] text-rose-500 dark:text-rose-400 rounded-2xl shadow-sm group-hover:scale-110 transition-transform">
                                <AlertTriangle size={28} strokeWidth={2.5} />
                            </div>
                            {stats.overdueCount > 0 && (
                                <span className="text-[11px] font-black px-3 py-1.5 bg-rose-200 text-rose-800 dark:bg-rose-500/30 dark:text-rose-300 rounded-xl animate-pulse uppercase">
                                    {stats.overdueCount} 逾期
                                </span>
                            )}
                        </div>
                        <div>
                            <h3 className="text-rose-900/60 dark:text-rose-200/50 font-medium text-sm tracking-wider uppercase mb-1">未結案違規紀錄</h3>
                            <div className="text-3xl font-black text-rose-950 dark:text-white tracking-tight flex items-baseline gap-2">
                                {stats.pendingCount} <span className="text-sm font-bold text-rose-900/50 dark:text-rose-200/50">件</span>
                            </div>
                            <p className="text-sm text-rose-900/50 dark:text-rose-200/50 mt-3 flex items-center gap-1.5 font-medium">
                                <Clock size={16} /> 需盡快提送
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Urgent Alerts Banner (Material 3) */}
            {stats.urgentViolations.length > 0 && (
                <div className="relative overflow-hidden bg-orange-50 dark:bg-[#2B1B15] rounded-[32px] border border-orange-100 dark:border-orange-900/30 shadow-md shadow-orange-900/5 dark:shadow-none">
                    <div className="p-8 flex flex-col lg:flex-row items-start lg:items-center gap-8">
                        <div className="flex-shrink-0 flex items-center gap-5 relative z-10">
                            <div className="p-4 bg-orange-500 text-white rounded-[24px] animate-pulse shadow-lg shadow-orange-500/30">
                                <AlertTriangle size={32} strokeWidth={2.5} />
                            </div>
                            <div>
                                <h2 className="text-2xl font-black text-orange-900 dark:text-orange-300 tracking-tight">
                                    緊急處理事項
                                </h2>
                                <p className="text-orange-700 dark:text-orange-400 text-sm font-bold flex items-center gap-1.5 mt-1">
                                    <Clock size={16} /> 有 {stats.urgentViolations.length} 件違規紀錄即將到期
                                </p>
                            </div>
                        </div>

                        {/* Scrollable Alerts Row */}
                        <div className="flex-1 w-full overflow-x-auto pb-4 -mb-4 smooth-scroll no-scrollbar relative z-10">
                            <div className="flex gap-4 w-max pr-8">
                                {stats.urgentViolations.map(v => (
                                    <div key={v.id} className="w-80 bg-white dark:bg-[#1E110C] border border-transparent dark:border-white/[0.02] rounded-[24px] p-6 flex flex-col justify-between hover:bg-orange-100/50 dark:hover:bg-[#2B1B15] cursor-pointer transition-all duration-300 group shadow-sm hover:shadow-md hover:-translate-y-1">
                                        <div className="flex justify-between items-start mb-4">
                                            <span className="text-base font-bold text-slate-800 dark:text-slate-100 line-clamp-1 mr-2">{v.projectName}</span>
                                            <span className="px-3 py-1.5 bg-orange-100 dark:bg-orange-500/20 text-orange-800 dark:text-orange-300 text-[11px] tracking-widest font-black rounded-xl whitespace-nowrap shadow-sm">剩 {getDaysRemaining(v.lectureDeadline)} 天</span>
                                        </div>
                                        <div className="text-xs font-medium text-slate-500 dark:text-slate-400 flex justify-between items-center">
                                            <span className="bg-slate-50 dark:bg-[#201511] px-3 py-1.5 rounded-xl shadow-sm border border-slate-100 dark:border-white/[0.02] font-bold text-slate-700 dark:text-slate-300">{v.contractorName}</span>
                                            <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-orange-600 flex items-center gap-1 font-bold">盡速處理 <Clock size={14} /></span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Background Accents */}
                        <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/10 dark:bg-orange-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                {/* 1. 各工作隊違規與罰款分佈 (Composed Chart) */}
                <div className="bg-white dark:bg-[#1E2024] p-8 rounded-[32px] shadow-md shadow-indigo-900/5 dark:shadow-none border border-transparent dark:border-white/[0.02]">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h3 className="text-xl font-extrabold text-slate-800 dark:text-white tracking-tight">各工作隊違規與罰款分佈</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">雙軸長條+折線混合圖</p>
                        </div>
                        <div className="p-3 bg-indigo-50 dark:bg-[#2B2F36] text-indigo-600 dark:text-indigo-400 rounded-2xl shadow-sm">
                            <BarChart3 size={24} strokeWidth={2.5} />
                        </div>
                    </div>
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={chartData.teamChartData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" opacity={document.documentElement.classList.contains('dark') ? 0.05 : 1} />
                                <XAxis dataKey="name" tick={{ fontSize: 13, fill: '#64748b', fontWeight: 500 }} axisLine={false} tickLine={false} dy={10} />
                                <YAxis yAxisId="left" tickFormatter={(v) => `$${v}`} tick={{ fontSize: 13, fill: '#64748b' }} axisLine={false} tickLine={false} />
                                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 13, fill: '#64748b' }} axisLine={false} tickLine={false} />
                                <Tooltip
                                    cursor={{ fill: document.documentElement.classList.contains('dark') ? 'rgba(255,255,255,0.02)' : 'rgba(99, 102, 241, 0.04)' }}
                                    contentStyle={{
                                        backgroundColor: document.documentElement.classList.contains('dark') ? 'rgba(43, 47, 54, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                                        backdropFilter: 'blur(12px)',
                                        border: 'none',
                                        borderRadius: '16px',
                                        color: document.documentElement.classList.contains('dark') ? '#f8fafc' : '#1e293b',
                                        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
                                    }}
                                />
                                <Legend />
                                <Bar yAxisId="left" dataKey="amount" name="罰款總額" fill="#6366f1" radius={[8, 8, 0, 0]} maxBarSize={50} />
                                <Line yAxisId="right" type="monotone" dataKey="count" name="違規件數" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 2. 案件狀態統計 (Pie Chart with Segmented Toggle) */}
                <div className="bg-white dark:bg-[#1E2024] p-8 rounded-[32px] shadow-md shadow-indigo-900/5 dark:shadow-none border border-transparent dark:border-white/[0.02]">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h3 className="text-xl font-extrabold text-slate-800 dark:text-white tracking-tight">案件狀態統計</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">目前所有違規案件處理進度</p>
                        </div>
                        {/* Segmented Toggle */}
                        <div className="flex bg-slate-100 dark:bg-[#2B2F36] p-1 rounded-xl shadow-inner">
                            <button
                                onClick={() => setStatusPieMode('AMOUNT')}
                                className={`px-4 py-2 text-[13px] font-bold rounded-lg transition-all ${statusPieMode === 'AMOUNT' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                            >
                                💰 罰款金額
                            </button>
                            <button
                                onClick={() => setStatusPieMode('COUNT')}
                                className={`px-4 py-2 text-[13px] font-bold rounded-lg transition-all ${statusPieMode === 'COUNT' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                            >
                                📄 違規件數
                            </button>
                        </div>
                    </div>
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={chartData.statusChartData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={90}
                                    outerRadius={120}
                                    cornerRadius={8}
                                    fill="#8884d8"
                                    paddingAngle={4}
                                    dataKey={statusPieMode === 'AMOUNT' ? 'amount' : 'count'}
                                    label={({ name, percent, value }) => statusPieMode === 'AMOUNT' ? `${name} $${value.toLocaleString()}` : `${name} ${value}件`}
                                    stroke="none"
                                >
                                    {chartData.statusChartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    formatter={(value: number) => statusPieMode === 'AMOUNT' ? [`$${value.toLocaleString()}`, '金額'] : [`${value} 件`, '件數']}
                                    contentStyle={{
                                        backgroundColor: document.documentElement.classList.contains('dark') ? 'rgba(43, 47, 54, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                                        backdropFilter: 'blur(12px)',
                                        border: 'none',
                                        borderRadius: '16px',
                                        color: document.documentElement.classList.contains('dark') ? '#f8fafc' : '#1e293b',
                                        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
                                    }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* 3. 年度違規與罰款趨勢 (Trend Composed Chart) */}
            <div className="bg-white dark:bg-[#1E2024] p-8 rounded-[32px] shadow-md shadow-indigo-900/5 dark:shadow-none border border-transparent dark:border-white/[0.02] mb-8">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h3 className="text-xl font-extrabold text-slate-800 dark:text-white tracking-tight">年度違規與罰款趨勢</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">最近半年歷史趨勢圖</p>
                    </div>
                    <div className="p-3 bg-purple-50 dark:bg-[#2B2F36] text-purple-600 dark:text-purple-400 rounded-2xl shadow-sm">
                        <TrendingUp size={24} strokeWidth={2.5} />
                    </div>
                </div>
                <div className="h-80 relative">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={chartData.trendChartData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" opacity={document.documentElement.classList.contains('dark') ? 0.05 : 1} />
                            <XAxis dataKey="name" tick={{ fontSize: 13, fill: '#64748b', fontWeight: 500 }} axisLine={false} tickLine={false} dy={10} />
                            <YAxis yAxisId="left" tickFormatter={(v) => `$${v}`} tick={{ fontSize: 13, fill: '#64748b' }} axisLine={false} tickLine={false} />
                            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 13, fill: '#64748b' }} axisLine={false} tickLine={false} />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: document.documentElement.classList.contains('dark') ? 'rgba(43, 47, 54, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                                    backdropFilter: 'blur(12px)',
                                    border: 'none',
                                    borderRadius: '16px',
                                    color: document.documentElement.classList.contains('dark') ? '#f8fafc' : '#1e293b',
                                    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
                                }}
                            />
                            <Legend />
                            <Area yAxisId="left" type="monotone" dataKey="amount" name="罰款總額" fill="#8b5cf6" stroke="none" fillOpacity={0.15} />
                            <Line yAxisId="right" type="monotone" dataKey="count" name="違規件數" stroke="#ec4899" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Recent Violations & Version History */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2">
                    <div className="bg-white dark:bg-[#1E2024] rounded-[32px] shadow-md shadow-indigo-900/5 dark:shadow-none border border-transparent dark:border-white/[0.02] overflow-hidden h-full">
                        <div className="p-8 border-b border-slate-50 dark:border-white/[0.02] flex justify-between items-center">
                            <div>
                                <h3 className="text-xl font-extrabold text-slate-800 dark:text-white tracking-tight">最近違規動態</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">系統最新登錄的違規案件</p>
                            </div>
                            <div className="p-3 bg-slate-50 dark:bg-[#2B2F36] text-slate-600 dark:text-slate-400 rounded-2xl shadow-sm">
                                <Clock size={24} strokeWidth={2.5} />
                            </div>
                        </div>
                        <div className="p-6">
                            <div className="relative border-l-2 border-slate-100 dark:border-[#2B2F36] ml-6 space-y-6 pb-4">
                                {violations.slice(0, 5).map((v, i) => (
                                    <div key={v.id} className="relative pl-8 group">
                                        {/* Timeline Dot */}
                                        <div className={`absolute -left-[11px] top-2 w-5 h-5 rounded-full border-4 border-white dark:border-[#1E2024] shadow-sm z-10 ${v.status === ViolationStatus.COMPLETED ? 'bg-emerald-500' : v.status === ViolationStatus.PENDING ? 'bg-amber-500' : 'bg-indigo-500'}`}></div>

                                        <div className="bg-slate-50 dark:bg-[#2B2F36] p-6 rounded-[24px] border border-transparent dark:border-white/[0.02] shadow-sm hover:shadow-lg hover:shadow-indigo-500/5 transition-all duration-300 group-hover:-translate-y-1 cursor-pointer">
                                            <div className="flex justify-between items-start mb-3">
                                                <div className="flex flex-col gap-1">
                                                    <span className="font-bold text-slate-800 dark:text-white text-lg">{v.contractorName}</span>
                                                    <span className="bg-white dark:bg-[#1E2024] px-2.5 py-1 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 shadow-sm border border-slate-100 dark:border-white/[0.02] line-clamp-1 w-fit max-w-[200px] md:max-w-xs">{v.projectName}</span>
                                                </div>
                                                <span className={`inline-flex items-center px-3 py-1.5 rounded-xl text-[11px] font-black tracking-widest uppercase shadow-sm ${v.status === ViolationStatus.COMPLETED
                                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300'
                                                    : v.status === ViolationStatus.PENDING
                                                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300'
                                                        : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-500/20 dark:text-indigo-300'
                                                    }`}>
                                                    {getStatusLabel(v.status)}
                                                </span>
                                            </div>
                                            <div className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2 mb-4">
                                                {v.description || '無詳細說明'}
                                            </div>
                                            <div className="text-xs text-slate-400 dark:text-slate-500 font-bold flex items-center gap-1.5 bg-white dark:bg-[#1E2024] px-3 py-1.5 rounded-xl block w-fit shadow-sm">
                                                <Clock size={14} /> 違規日期: {v.violationDate}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {violations.length === 0 && (
                                    <div className="pl-8 py-8 text-slate-400 flex flex-col items-center gap-3">
                                        <div className="p-4 bg-slate-50 dark:bg-[#2B2F36] rounded-2xl shadow-sm">
                                            <FileWarning size={32} />
                                        </div>
                                        <p className="font-bold">目前無違規紀錄</p>
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
