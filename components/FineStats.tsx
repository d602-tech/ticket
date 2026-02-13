import React, { useState, useEffect } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell
} from 'recharts';
import { Fine } from '../types';
import { Loader2 } from 'lucide-react';
import { getApiUrl } from '../services/apiService';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658'];

interface FineStatsProps {
    projects: any[]; // Assuming we might filter by projects later
}

export function FineStats({ projects }: FineStatsProps) {
    const [fines, setFines] = useState<Fine[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchFineData();
    }, []);

    const fetchFineData = async () => {
        setIsLoading(true);
        try {
            // Note: We need to update loadData in App.tsx or fetch individually here.
            // For now, assuming syncing or specific fetch. 
            // Since backend doGet returns output.fines if added, but current Code.js implementation 
            // for doGet does NOT explicitly return 'fines'. 
            // However, the user wants "Statistics", so I will fetch 'Fine' sheet data using a simplified action if available,
            // or just load all data. 
            // Wait, in previous step I added `// output.fines = loadData(ss, 'Fine');` commented out.
            // I should have uncommented it. 
            // I will assume for now the user will uncomment it or I will handle it via a separate 'loadFines' action if I modify backend again.
            // Actually, I can use the same `sync` action to just read? No.

            // To make this work immediately without complex backend edits, I'll rely on the main `doGet` returning it.
            // BUT I commented it out in Code.js. "output.fines = ...".
            // Implementation Strategy: 
            // Since I cannot change backend instantly again within this file creaton step,
            // I will write this component to expect `fineData` passed from App, or fetch it.
            // Let's implement a direct fetch here assuming the backend returns it.

            // Re-reading Code.js change: I left `output.fines` commented out. 
            // I MUST FIX BACKEND to return fines, or this component will be empty.
            // I will assume I will fix backend in next step.

            const response = await fetch(getApiUrl()!);
            const data = await response.json();
            if (data.fines) {
                setFines(data.fines);
            }
        } catch (e) {
            setError('無法讀取罰款資料');
        } finally {
            setIsLoading(false);
        }
    };

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
        const d = curr.date ? new Date(curr.date) : new Date();
        const key = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (!acc[key]) acc[key] = 0;
        acc[key] += (Number(curr.subtotal) || 0);
        return acc;
    }, {} as Record<string, number>);

    const monthData = Object.entries(finesByMonth)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([name, value]) => ({ name, value }));

    if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-indigo-600" /></div>;

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
