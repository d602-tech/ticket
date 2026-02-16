import React from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell
} from 'recharts';
import { Fine } from '../types';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658'];

interface FineStatsProps {
    projects: any[]; // Assuming we might filter by projects later
    fines: Fine[];
}

export function FineStats({ projects, fines }: FineStatsProps) {
    // --- Statistics Logic ---

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

    // 3. By Month (using issueDate or date)
    const finesByMonth = fines.reduce((acc, curr) => {
        // Try getting date from various fields if needed, assuming 'date' is reliable from backend.
        // Backend maps 'date' to '開罰日期'.
        const dateStr = curr.date || curr.issueDate;
        const d = dateStr ? new Date(dateStr) : new Date();

        // Handle potential invalid dates
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
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-slate-800">罰款統計分析</h2>

            {/* Top Cards for Summary */}
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
                        {/* Simple current month logic */}
                        ${monthData.find(d => d.name === `${new Date().getFullYear()}/${String(new Date().getMonth() + 1).padStart(2, '0')}`)?.value.toLocaleString() || 0}
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Chart 1: Project */}
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

                {/* Chart 2: Team */}
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

                {/* Chart 3: Month Trend */}
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

            <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-4 text-sm text-indigo-700">
                💡 提示：此頁面數據來自 Google Sheet「Fine (罰款明細表)」，請定期至後台更新資料。
            </div>
        </div>
    );
}
