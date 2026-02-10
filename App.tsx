import React, { useState, useEffect } from 'react';
import {
    LayoutDashboard,
    FileWarning,
    Users,
    Plus,
    Search,
    Filter,
    AlertTriangle,
    CheckCircle2,
    Clock,
    Mail,
    Download,
    Trash2,
    HardHat,
    Briefcase,
    Edit2,
    LogOut,
    X,
    Loader2,
    Database,
    ExternalLink,
    FileText,
    Upload,
    RefreshCw,
    DollarSign,
    Menu,
    Edit
} from 'lucide-react';
import {
    PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { Violation, Project, ViewState, ViolationStatus, Coordinator, User } from './types';
import { fetchInitialData, syncData } from './services/storageService';
import { getApiUrl } from './services/apiService';
import { formatDate, getDaysRemaining, generateId } from './utils';
import { StatCard } from './components/StatCard';
import { ViolationModal } from './components/ViolationModal';
import { EmailPreview } from './components/EmailPreview';
import { LoginScreen } from './components/LoginScreen';
import { LoadingModal } from './components/LoadingModal';

function App() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [currentUserEmail, setCurrentUserEmail] = useState<string>(''); // 登入者信箱
    const [view, setView] = useState<ViewState>('DASHBOARD');
    const [violations, setViolations] = useState<Violation[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Mobile Sidebar State

    // User Management State (Admin Only)
    const [newUserForm, setNewUserForm] = useState({ email: '', password: '', name: '', role: 'user' });
    const [currentUserRole, setCurrentUserRole] = useState<string>(''); // Current logged in user role

    // Modal States
    const [isViolationModalOpen, setViolationModalOpen] = useState(false);
    const [editingViolation, setEditingViolation] = useState<Violation | null>(null);
    const [emailState, setEmailState] = useState<{ isOpen: boolean; violation: Violation | null }>({ isOpen: false, violation: null });

    // Project Management State
    const [isProjectFormOpen, setProjectFormOpen] = useState(false);
    const [editingProject, setEditingProject] = useState<Partial<Project>>({
        sequence: 0,
        abbreviation: '',
        name: '',
        coordinatorName: '',
        coordinatorEmail: '',
        contractor: '',
        hostTeam: '',
        managerName: '',
        managerEmail: ''
    });

    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<'ALL' | ViolationStatus>('ALL');
    const [hostTeamFilter, setHostTeamFilter] = useState<string>('ALL');
    const [projectHostTeamFilter, setProjectHostTeamFilter] = useState<string>('ALL');

    const loadData = async () => {
        const url = getApiUrl();
        if (!url) return;

        setIsLoading(true);
        try {
            const data = await fetchInitialData();
            setProjects(data.projects);
            setViolations(data.violations);
        } catch (e) {
            alert('連線失敗，請檢查 API URL 是否正確。');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (isAuthenticated) {
            loadData();
        }
    }, [isAuthenticated]);

    const handleLogin = (success: boolean, user?: { email: string; name: string; role: string }) => {
        setIsAuthenticated(success);
        if (user?.email) setCurrentUserEmail(user.email);
        if (user?.role) setCurrentUserRole(user.role);
    };

    const handleLogout = () => {
        setIsAuthenticated(false);
        setCurrentUserEmail('');
        setView('DASHBOARD');
    };

    const handleSaveViolation = async (newViolation: Violation, fileData?: { name: string, type: string, base64: string }) => {
        setIsLoading(true);
        try {
            let updatedList = [];

            // Check if edit or create
            const exists = violations.find(v => v.id === newViolation.id);
            if (exists) {
                updatedList = violations.map(v => v.id === newViolation.id ? newViolation : v);
            } else {
                updatedList = [newViolation, ...violations];
            }

            // 樂觀更新
            setViolations(updatedList);

            // 取得工程資訊以建立檔案名稱
            const project = projects.find(p => p.name === newViolation.projectName);

            // 準備檔案上傳參數
            const uploadPayload = fileData ? {
                violationId: newViolation.id,
                fileData: fileData,
                projectInfo: project ? {
                    sequence: project.sequence || 0,
                    abbreviation: project.abbreviation || ''
                } : undefined,
                violationDate: newViolation.violationDate?.replace(/-/g, '')
            } : undefined;

            // 同步後端
            const response = await syncData(undefined, updatedList, uploadPayload);

            // 檢查是否剛完成結案，若是則通知主辦人員
            const isCompletedNow = newViolation.status === ViolationStatus.COMPLETED;
            const wasCompletedBefore = exists && exists.status === ViolationStatus.COMPLETED;

            if (isCompletedNow && !wasCompletedBefore && project && project.coordinatorEmail) {
                // 不阻擋 UI 更新，背景發送
                fetch(getApiUrl()!, {
                    method: 'POST',
                    body: JSON.stringify({
                        action: 'sendEmail',
                        to: project.coordinatorEmail,
                        subject: `[案件完成通知] ${project.name} - ${newViolation.contractorName}`,
                        body: `
                            <p>承辦人員您好，</p>
                            <p>承攬商「<b>${newViolation.contractorName}</b>」於工程「<b>${project.name}</b>」之違規事項已修正並結案。</p>
                            <ul>
                                <li><b>違規內容：</b>${newViolation.description}</li>
                                <li><b>完成日期：</b>${formatDate(new Date().toISOString())}</li>
                            </ul>
                            <p>系統自動發送，請勿直接回覆。</p>
                        `,
                        violationId: newViolation.id
                    })
                }).then(res => res.json()).then(res => {
                    if (res.success) {
                        console.log('結案通知已發送');
                    }
                }).catch(err => console.error('通知發送失敗', err));
            }

            setViolations(response.violations);
            setEditingViolation(null); // Clear editing state
        } catch (e) {
            console.error(e);
            alert('儲存失敗：' + (e as Error).message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleEditViolation = (violation: Violation) => {
        setEditingViolation(violation);
        setViolationModalOpen(true);
    };

    // Remove handleStatusToggle entirely or reimplement if needed. 
    // We will use Edit Modal for status changes.

    const handleDeleteViolation = async (id: string) => {
        if (confirm('確定要刪除此筆紀錄嗎？')) {
            setIsLoading(true);
            try {
                const updatedList = violations.filter(v => v.id !== id);
                setViolations(updatedList);
                const response = await syncData(undefined, updatedList);
                setViolations(response.violations);
            } catch (e) {
                alert('刪除失敗');
            } finally {
                setIsLoading(false);
            }
        }
    };

    // Project Management Handlers
    const handleSaveProject = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingProject.name || !editingProject.coordinatorName || !editingProject.contractor) return;

        setIsLoading(true);

        const newProj: Project = {
            id: editingProject.id || generateId(),
            sequence: editingProject.sequence || (projects.length + 1),
            abbreviation: editingProject.abbreviation || '',
            name: editingProject.name!,
            coordinatorName: editingProject.coordinatorName!,
            coordinatorEmail: editingProject.coordinatorEmail || '',
            contractor: editingProject.contractor!,
            hostTeam: editingProject.hostTeam || '',
            managerName: editingProject.managerName || '',
            managerEmail: editingProject.managerEmail || ''
        };

        let updatedProjects;
        if (editingProject.id) {
            updatedProjects = projects.map(p => p.id === newProj.id ? newProj : p);
        } else {
            updatedProjects = [...projects, newProj];
        }

        try {
            setProjects(updatedProjects);
            const response = await syncData(updatedProjects, undefined);
            setProjects(response.projects);
            setProjectFormOpen(false);
            setEditingProject({ sequence: 0, abbreviation: '', name: '', coordinatorName: '', coordinatorEmail: '', contractor: '', hostTeam: '', managerName: '', managerEmail: '' });
        } catch (e) {
            alert('儲存工程失敗');
        } finally {
            setIsLoading(false);
        }
    };

    // 簽辦生成處理
    const handleGenerateDocument = async (violation: Violation) => {
        // 如果已有簽辦，直接開啟
        if (violation.documentUrl) {
            window.open(violation.documentUrl, '_blank');
            return;
        }

        setIsLoading(true);
        try {
            // 取得工程資訊
            const project = projects.find(p => p.name === violation.projectName);

            const response = await fetch(getApiUrl()!, {
                method: 'POST',
                body: JSON.stringify({
                    action: 'generateDocument',
                    violationId: violation.id, // 傳遞 ID 以儲存 URL
                    projectName: violation.projectName,
                    contractorName: violation.contractorName,
                    lectureDeadline: violation.lectureDeadline,
                    hostTeam: project?.hostTeam || '未指定'
                })
            });

            const result = await response.json();

            if (result.success && result.documentUrl) {
                // 更新本地 violations 狀態
                setViolations(prev => prev.map(v =>
                    v.id === violation.id
                        ? { ...v, documentUrl: result.documentUrl }
                        : v
                ));
                window.open(result.documentUrl, '_blank');
                alert('簽辦已生成！');
            } else {
                alert('簽辦生成失敗: ' + (result.error || '未知錯誤'));
            }
        } catch (e) {
            console.error(e);
            alert('簽辦生成失敗：' + (e as Error).message);
        } finally {
            setIsLoading(false);
        }
    };

    // 掃描檔上傳處理
    const handleUploadScanFile = async (violation: Violation, isReplace: boolean = false) => {
        // 如果是重新上傳，先要求輸入原因
        let replaceReason: string | null = null;
        if (isReplace && violation.scanFileUrl) {
            replaceReason = prompt('請輸入修改掃描檔的原因：');
            if (!replaceReason || replaceReason.trim() === '') {
                alert('必須填寫修改原因才能替換掃描檔');
                return;
            }
        }

        // 建立隱藏的 file input
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*,application/pdf';

        input.onchange = async (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (!file) return;

            setIsLoading(true);
            try {
                // 轉換為 base64
                const reader = new FileReader();
                reader.onload = async () => {
                    const base64 = (reader.result as string).split(',')[1];

                    const response = await fetch(getApiUrl()!, {
                        method: 'POST',
                        body: JSON.stringify({
                            action: 'uploadScanFile',
                            violationId: violation.id,
                            fileData: base64,
                            fileName: file.name,
                            mimeType: file.type,
                            replaceReason: replaceReason // 傳遞修改原因
                        })
                    });

                    const result = await response.json();

                    if (result.success) {
                        // 更新本地狀態
                        setViolations(prev => prev.map(v =>
                            v.id === violation.id
                                ? { ...v, scanFileName: result.scanFileName, scanFileUrl: result.scanFileUrl }
                                : v
                        ));
                        alert(result.wasReplaced ? '掃描檔已替換！（已記錄修改歷史）' : '掃描檔已上傳！');
                    } else {
                        alert('上傳失敗: ' + (result.error || '未知錯誤'));
                    }
                    setIsLoading(false);
                };
                reader.readAsDataURL(file);
            } catch (e) {
                console.error(e);
                alert('上傳失敗：' + (e as Error).message);
                setIsLoading(false);
            }
        };

        input.click();
    };

    const handleEditProject = (project: Project) => {
        setEditingProject({ ...project });
        setProjectFormOpen(true);
    };

    const handleDeleteProject = async (id: string) => {
        if (confirm('確定要刪除此工程嗎？')) {
            setIsLoading(true);
            try {
                const updated = projects.filter(p => p.id !== id);
                setProjects(updated);
                const response = await syncData(updated, undefined);
                setProjects(response.projects);
            } catch (e) {
                alert('刪除失敗');
            } finally {
                setIsLoading(false);
            }
        }
    };

    // Derived State
    // 取得所有主辦部門（去重）
    const hostTeams = ['土木工作隊', '建築工作隊', '機械工作隊', '電氣工作隊', '中部工作隊', '南部工作隊'];

    const filteredViolations = violations.filter(v => {
        const matchesSearch = v.contractorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            v.projectName.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === 'ALL' || v.status === statusFilter;
        // 主辦部門篩選
        const project = projects.find(p => p.name === v.projectName);
        const matchesHostTeam = hostTeamFilter === 'ALL' || (project?.hostTeam === hostTeamFilter);
        return matchesSearch && matchesStatus && matchesHostTeam;
    });

    const pendingCount = violations.filter(v => v.status !== ViolationStatus.COMPLETED).length;
    const overdueCount = violations.filter(v => v.status !== ViolationStatus.COMPLETED && getDaysRemaining(v.lectureDeadline) < 0).length;
    const urgentCount = violations.filter(v => v.status !== ViolationStatus.COMPLETED && getDaysRemaining(v.lectureDeadline) <= 5 && getDaysRemaining(v.lectureDeadline) >= 0).length;
    // 新增：2日內到期
    const within2DaysCount = violations.filter(v =>
        v.status !== ViolationStatus.COMPLETED &&
        getDaysRemaining(v.lectureDeadline) <= 2 &&
        getDaysRemaining(v.lectureDeadline) >= 0
    ).length;

    // 計算累積罰款金額
    const totalFineAmount = violations.reduce((sum, v) => sum + (v.fineAmount || 0), 0);
    // 已辦理場次 (Completed Statistics)
    const completedCount = violations.filter(v => v.status === ViolationStatus.COMPLETED).length;

    // 主辦工作隊顏色對應（六種顏色）
    const getHostTeamColor = (team: string | undefined) => {
        const colors: Record<string, { bg: string; text: string; border: string }> = {
            '土木工作隊': { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200' },
            '建築工作隊': { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-200' },
            '機械工作隊': { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200' },
            '電氣工作隊': { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-200' },
            '中部工作隊': { bg: 'bg-teal-100', text: 'text-teal-700', border: 'border-teal-200' },
            '南部工作隊': { bg: 'bg-indigo-100', text: 'text-indigo-700', border: 'border-indigo-200' },
            // Keep others just in case
            '環安工作隊': { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-200' },
            '綜合工作隊': { bg: 'bg-pink-100', text: 'text-pink-700', border: 'border-pink-200' }
        };
        return colors[team || ''] || { bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200' };
    };

    // 工程專案篩選
    const filteredProjects = projects.filter(p =>
        projectHostTeamFilter === 'ALL' || p.hostTeam === projectHostTeamFilter
    );

    // Charts Data Preparation
    const renderCharts = () => {
        // Group by Host Team
        const teamDataMap = new Map<string, number>();
        filteredViolations.forEach(v => {
            const project = projects.find(p => p.name === v.projectName);
            const team = project?.hostTeam || '未歸類';
            teamDataMap.set(team, (teamDataMap.get(team) || 0) + 1);
        });
        const teamChartData = Array.from(teamDataMap, ([name, value]) => ({ name, value }));

        // Group by Status
        const statusDataMap = new Map<string, number>();
        filteredViolations.forEach(v => {
            const label = getStatusLabel(v.status);
            statusDataMap.set(label, (statusDataMap.get(label) || 0) + 1);
        });
        const statusChartData = Array.from(statusDataMap, ([name, value]) => ({ name, value }));

        const COLORS = ['#6366f1', '#06b6d4', '#f59e0b', '#ef4444', '#8b5cf6', '#10b981'];

        return (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                {/* 案件分佈 (Pie) */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100/80 hover:shadow-md transition-shadow">
                    <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">各工作隊違規佔比</h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={teamChartData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    fill="#8884d8"
                                    paddingAngle={5}
                                    dataKey="value"
                                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                >
                                    {teamChartData.map((entry, index) => (
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
                            <BarChart data={statusChartData}>
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
        );
    };

    const renderDashboard = () => {
        // 找出到期前5日且未完成的違規
        const urgentViolations = violations.filter(v =>
            v.status !== ViolationStatus.COMPLETED &&
            getDaysRemaining(v.lectureDeadline) <= 5 &&
            getDaysRemaining(v.lectureDeadline) >= 0
        );

        return (
            <div className="animate-fade-in space-y-6">
                {/* 數據卡片列 */}
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
                    <StatCard
                        title="已結案/已辦理"
                        value={completedCount}
                        icon={CheckCircle2}
                        colorClass="bg-emerald-500"
                    />
                    <StatCard
                        title="累積罰款金額"
                        value={`$${totalFineAmount.toLocaleString()}`}
                        icon={DollarSign}
                        colorClass="bg-indigo-900"
                        isCurrency
                    />
                    <StatCard
                        title="未結案違規"
                        value={pendingCount}
                        icon={AlertTriangle}
                        colorClass="bg-amber-500"
                    />
                    <StatCard
                        title="5天內到期"
                        value={urgentCount}
                        icon={Clock}
                        colorClass="bg-yellow-500"
                    />
                    <StatCard
                        title="2天內到期"
                        value={within2DaysCount}
                        icon={AlertTriangle}
                        colorClass="bg-orange-600"
                    />
                    <StatCard
                        title="已逾期案件"
                        value={overdueCount}
                        icon={FileWarning}
                        colorClass="bg-rose-600"
                    />
                </div>

                {/* 到期提醒區域 */}
                {urgentViolations.length > 0 && (
                    <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200/60 rounded-2xl p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-amber-500 rounded-xl shadow-lg shadow-amber-500/20">
                                <AlertTriangle className="w-5 h-5 text-white" />
                            </div>
                            <h2 className="text-base font-bold text-amber-900">
                                到期前5日提醒 <span className="text-amber-600 font-normal">({urgentViolations.length}件待處理)</span>
                            </h2>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {urgentViolations.map(v => (
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

                {/* 圖表區域 */}
                {renderCharts()}
            </div>
        );
    };

    const renderViolationList = () => (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
            {/* Toolbar */}
            {/* Toolbar */}
            <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex flex-col md:flex-row items-center gap-3 w-full md:w-auto flex-1">
                    <div className="relative w-full md:w-64">
                        <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="搜尋承攬商或工程..."
                            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-slate-500 outline-none"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3 w-full md:w-auto md:flex">
                        <div className="relative">
                            <Filter className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                            <select
                                className="w-full pl-9 pr-8 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-slate-500 outline-none appearance-none cursor-pointer"
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value as any)}
                            >
                                <option value="ALL">所有狀態</option>
                                <option value={ViolationStatus.PENDING}>待辦理</option>
                                <option value={ViolationStatus.NOTIFIED}>已通知</option>
                                <option value={ViolationStatus.SUBMITTED}>已提送</option>
                                <option value={ViolationStatus.COMPLETED}>已完成</option>
                            </select>
                        </div>
                        <div className="relative">
                            <Briefcase className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                            <select
                                className="w-full pl-9 pr-8 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-slate-500 outline-none appearance-none cursor-pointer"
                                value={hostTeamFilter}
                                onChange={(e) => setHostTeamFilter(e.target.value)}
                            >
                                <option value="ALL">所有部門</option>
                                {hostTeams.map(team => (
                                    <option key={team} value={team}>{team}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>
                <button
                    onClick={() => {
                        setEditingViolation(null);
                        setViolationModalOpen(true);
                    }}
                    className="w-full md:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-lg transition-colors shadow-md shadow-slate-300"
                >
                    <Plus size={16} />
                    新增紀錄
                </button>
            </div>

            {/* Mobile Card View */}
            <div className="xl:hidden">
                {filteredViolations.length === 0 ? (
                    <div className="p-8 text-center text-slate-400">
                        {isLoading ? '載入中...' : '查無資料'}
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {filteredViolations.map((violation) => {
                            const daysRemaining = getDaysRemaining(violation.lectureDeadline);
                            const isOverdue = daysRemaining < 0 && violation.status === ViolationStatus.PENDING;
                            return (
                                <div key={violation.id} className="p-4 hover:bg-slate-50/50 active:bg-slate-100 transition-colors">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex-1 mr-2">
                                            <h3 className="font-bold text-slate-900 mb-1 leading-snug">{violation.contractorName}</h3>
                                            <p className="text-xs text-slate-500 leading-normal">{violation.projectName}</p>
                                        </div>
                                        <span className={`flex-shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${violation.status === ViolationStatus.COMPLETED ? 'bg-green-100 text-green-700' :
                                            violation.status === ViolationStatus.NOTIFIED ? 'bg-blue-100 text-blue-700' :
                                                violation.status === ViolationStatus.SUBMITTED ? 'bg-purple-100 text-purple-700' :
                                                    'bg-yellow-100 text-yellow-700'
                                            }`}>
                                            {getStatusLabel(violation.status)}
                                        </span>
                                    </div>

                                    <p className="text-sm text-slate-600 mb-3 line-clamp-2 bg-slate-50/80 p-2.5 rounded-lg">
                                        {violation.description}
                                    </p>

                                    <div className="flex items-center justify-between text-xs text-slate-500 mb-3">
                                        <span>期限：{formatDate(violation.lectureDeadline)}</span>
                                        {violation.status !== ViolationStatus.COMPLETED && (
                                            <span className={`${isOverdue ? 'text-red-600 font-bold' : daysRemaining <= 5 ? 'text-orange-600 font-bold' : ''}`}>
                                                {isOverdue ? `(已逾期 ${Math.abs(daysRemaining)} 天)` : `(剩餘 ${daysRemaining} 天)`}
                                            </span>
                                        )}
                                    </div>

                                    <div className="flex items-center justify-end gap-1.5 border-t border-slate-100 pt-3">
                                        <button
                                            onClick={() => openEmailModal(violation)}
                                            className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-lg"
                                        >
                                            <Mail size={18} />
                                        </button>
                                        <button
                                            onClick={() => handleGenerateDocument(violation)}
                                            className={`p-2 rounded-lg ${violation.documentUrl ? 'text-green-600 bg-green-50' : 'text-slate-500 hover:bg-slate-100'}`}
                                        >
                                            <FileText size={18} />
                                        </button>
                                        <button
                                            onClick={() => violation.scanFileUrl ? window.open(violation.scanFileUrl, '_blank') : handleUploadScanFile(violation, false)}
                                            className={`p-2 rounded-lg ${violation.scanFileUrl ? 'text-purple-600 bg-purple-50' : 'text-slate-500 hover:bg-slate-100'}`}
                                        >
                                            <Upload size={18} />
                                        </button>
                                        <button
                                            onClick={() => handleEditViolation(violation)}
                                            className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-lg"
                                        >
                                            <Edit size={18} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Desktop Table */}
            <div className="hidden xl:block overflow-x-auto">
                <table className="w-full min-w-[1000px] text-left border-collapse">
                    <thead>
                        <tr className="bg-gradient-to-r from-slate-50 to-slate-100/50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                            <th className="px-6 py-4">承攬商 / 工程</th>
                            <th className="px-6 py-4">違規事項</th>
                            <th className="px-6 py-4">講習期限</th>
                            <th className="px-6 py-4">完成日期</th>
                            <th className="px-6 py-4">辦理進度</th>
                            <th className="px-6 py-4 text-right">操作</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filteredViolations.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                                    {isLoading ? '載入中...' : '查無資料'}
                                </td>
                            </tr>
                        ) : (
                            filteredViolations.map((violation) => {
                                const daysRemaining = getDaysRemaining(violation.lectureDeadline);
                                const isOverdue = daysRemaining < 0 && violation.status === ViolationStatus.PENDING;

                                return (
                                    <tr key={violation.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="font-medium text-slate-900">{violation.contractorName}</div>
                                            <div className="text-xs text-slate-500 mt-0.5">{violation.projectName}</div>
                                        </td>
                                        <td className="px-6 py-4 max-w-xs">
                                            <div className="text-sm text-slate-700 truncate" title={violation.description}>
                                                {violation.description}
                                            </div>
                                            {violation.fileUrl ? (
                                                <a
                                                    href={violation.fileUrl}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="flex items-center gap-1 mt-1 text-xs text-indigo-600 cursor-pointer hover:underline"
                                                >
                                                    <Download size={12} />
                                                    查看罰單 ({violation.fileName || '附件'})
                                                </a>
                                            ) : violation.fileName ? (
                                                <div className="flex items-center gap-1 mt-1 text-xs text-slate-400">
                                                    <FileWarning size={12} />
                                                    {violation.fileName} (未上傳)
                                                </div>
                                            ) : null}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm text-slate-600">
                                                {formatDate(violation.lectureDeadline)}
                                                {violation.status !== ViolationStatus.COMPLETED && (
                                                    <div className={`text-xs font-medium mt-1 ${isOverdue ? 'text-red-500' : daysRemaining <= 5 ? 'text-orange-500' : 'text-slate-400'}`}>
                                                        {isOverdue ? `已逾期 ${Math.abs(daysRemaining)} 天` : `剩餘 ${daysRemaining} 天`}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm text-slate-600">
                                                {violation.completionDate ? (
                                                    <span className="text-green-600 font-medium">{formatDate(violation.completionDate)}</span>
                                                ) : (
                                                    <span className="text-slate-400">-</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span
                                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${violation.status === ViolationStatus.COMPLETED ? 'bg-green-100 text-green-700' :
                                                    violation.status === ViolationStatus.NOTIFIED ? 'bg-blue-100 text-blue-700' :
                                                        violation.status === ViolationStatus.SUBMITTED ? 'bg-purple-100 text-purple-700' :
                                                            'bg-yellow-100 text-yellow-700'
                                                    }`}
                                            >
                                                {violation.status === ViolationStatus.COMPLETED ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                                                {getStatusLabel(violation.status)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                {/* 寄信次數徽章 */}
                                                {(violation.emailCount || 0) > 0 && (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700" title={`已寄信 ${violation.emailCount} 次`}>
                                                        <Mail size={10} className="mr-1" />
                                                        {violation.emailCount}
                                                    </span>
                                                )}
                                                <button
                                                    onClick={() => openEmailModal(violation)}
                                                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 rounded-lg transition-all"
                                                    title="發送通知信"
                                                >
                                                    <Mail size={18} />
                                                </button>
                                                <button
                                                    onClick={() => handleGenerateDocument(violation)}
                                                    className={`p-1.5 rounded-lg transition-all ${violation.documentUrl
                                                        ? 'text-green-600 bg-green-50 hover:bg-green-100'
                                                        : 'text-slate-400 hover:text-green-600 hover:bg-green-50'
                                                        }`}
                                                    title={violation.documentUrl ? '下載簽辦' : '生成簽辦'}
                                                >
                                                    <FileText size={18} />
                                                </button>
                                                <button
                                                    onClick={() => violation.scanFileUrl ? window.open(violation.scanFileUrl, '_blank') : handleUploadScanFile(violation, false)}
                                                    className={`p-1.5 rounded-lg transition-all ${violation.scanFileUrl
                                                        ? 'text-purple-600 bg-purple-50 hover:bg-purple-100'
                                                        : 'text-slate-400 hover:text-purple-600 hover:bg-purple-50'
                                                        }`}
                                                    title={violation.scanFileUrl ? `查看 ${violation.scanFileName}` : '上傳簽辦掃描檔'}
                                                >
                                                    <Upload size={18} />
                                                </button>
                                                {/* 替換按鈕（僅已上傳時顯示） */}
                                                {violation.scanFileUrl && (
                                                    <button
                                                        onClick={() => handleUploadScanFile(violation, true)}
                                                        className="p-1.5 text-orange-500 bg-orange-50 hover:bg-orange-100 rounded-lg transition-all"
                                                        title="替換掃描檔（需填寫原因）"
                                                    >
                                                        <RefreshCw size={18} />
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => handleEditViolation(violation)}
                                                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 rounded-lg transition-all"
                                                    title="編輯詳細資料"
                                                >
                                                    <Edit2 size={18} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteViolation(violation.id)}
                                                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                                    title="刪除"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );

    const handleAddUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            const response = await fetch(getApiUrl()!, {
                method: 'POST',
                body: JSON.stringify({
                    action: 'addUser',
                    adminRole: currentUserRole,
                    newUser: newUserForm
                })
            });
            const result = await response.json();
            if (result.success) {
                alert('使用者新增成功');
                setNewUserForm({ email: '', password: '', name: '', role: 'user' });
            } else {
                alert('新增失敗: ' + result.error);
            }
        } catch (e) {
            alert('連線失敗');
        } finally {
            setIsLoading(false);
        }
    };

    const renderUserManagement = () => (
        <div className="animate-fade-in max-w-2xl mx-auto">
            <div className="flex items-center gap-4 mb-6">
                <h2 className="text-xl font-bold text-slate-800">帳號管理</h2>
                <span className="bg-amber-100 text-amber-800 px-3 py-1 rounded-full text-xs font-medium">
                    管理員專用
                </span>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <h3 className="text-lg font-semibold text-slate-800 mb-4">新增使用者</h3>
                <form onSubmit={handleAddUser} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">姓名</label>
                        <input
                            type="text"
                            required
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-slate-500"
                            value={newUserForm.name}
                            onChange={e => setNewUserForm({ ...newUserForm, name: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Email (帳號)</label>
                        <input
                            type="email"
                            required
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-slate-500"
                            value={newUserForm.email}
                            onChange={e => setNewUserForm({ ...newUserForm, email: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">密碼</label>
                        <input
                            type="text" // Visible for admin creation
                            required
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-slate-500"
                            value={newUserForm.password}
                            onChange={e => setNewUserForm({ ...newUserForm, password: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">權限角色</label>
                        <select
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-slate-500 bg-white"
                            value={newUserForm.role}
                            onChange={e => setNewUserForm({ ...newUserForm, role: e.target.value })}
                        >
                            <option value="user">一般使用者 (User)</option>
                            <option value="admin">系統管理員 (Admin)</option>
                        </select>
                    </div>
                    <button
                        type="submit"
                        className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-lg transition-colors mt-4 shadow-lg shadow-slate-200"
                    >
                        新增帳號
                    </button>
                </form>
            </div>
        </div>
    );

    const renderProjects = () => (
        <div className="space-y-6">
            {/* 工具列：篩選和新增 */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                {/* 主辦工作隊篩選器 - 6 Buttons */}
                <div className="flex overflow-x-auto pb-2 md:pb-0 items-center gap-2 w-full md:w-auto md:flex-wrap no-scrollbar">
                    <button
                        onClick={() => setProjectHostTeamFilter('ALL')}
                        className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${projectHostTeamFilter === 'ALL'
                            ? 'bg-slate-900 text-white shadow-md'
                            : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                            }`}
                    >
                        全部
                    </button>
                    {hostTeams.map(team => (
                        <button
                            key={team}
                            onClick={() => setProjectHostTeamFilter(team)}
                            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${projectHostTeamFilter === team
                                ? 'bg-slate-900 text-white shadow-md'
                                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                                }`}
                        >
                            {team}
                        </button>
                    ))}
                </div>

                <button
                    onClick={() => {
                        setEditingProject({ sequence: 0, abbreviation: '', name: '', coordinatorName: '', coordinatorEmail: '', contractor: '' });
                        setProjectFormOpen(true);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-lg transition-colors shadow-md shadow-slate-300 ml-auto"
                >
                    <Plus size={16} />
                    新增工程專案
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredProjects.map(project => (
                    <div key={project.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-4">
                            <div className="bg-indigo-50 p-3 rounded-lg">
                                <Briefcase className="w-6 h-6 text-indigo-600" />
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => handleEditProject(project)}
                                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                >
                                    <Edit2 size={16} />
                                </button>
                                <button
                                    onClick={() => handleDeleteProject(project.id)}
                                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-0.5 rounded">
                                #{project.sequence || '-'}
                            </span>
                            {project.abbreviation && (
                                <span className="bg-slate-100 text-slate-600 text-xs font-medium px-2 py-0.5 rounded">
                                    {project.abbreviation}
                                </span>
                            )}
                        </div>
                        <h3 className="font-bold text-lg text-slate-800 mb-1">{project.name}</h3>
                        <p className="text-sm text-slate-500 mb-2 flex items-center gap-2">
                            <HardHat size={14} />
                            {project.contractor}
                        </p>
                        {/* 主辦工作隊標籤 */}
                        {project.hostTeam && (
                            <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium mb-4 ${getHostTeamColor(project.hostTeam).bg} ${getHostTeamColor(project.hostTeam).text} ${getHostTeamColor(project.hostTeam).border} border`}>
                                {project.hostTeam}
                            </span>
                        )}

                        <div className="pt-4 border-t border-slate-100 space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-500">承辦人員</span>
                                <span className="font-medium text-slate-800">{project.coordinatorName}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-500">聯絡信箱</span>
                                <span className="font-medium text-slate-800 truncate max-w-[150px]" title={project.coordinatorEmail}>
                                    {project.coordinatorEmail || '-'}
                                </span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {isProjectFormOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-fade-in-up">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h2 className="text-lg font-bold text-slate-800">
                                {editingProject.id ? '編輯工程' : '新增工程'}
                            </h2>
                            <button onClick={() => setProjectFormOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleSaveProject} className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">序號</label>
                                    <input
                                        type="number"
                                        min="1"
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                        value={editingProject.sequence || ''}
                                        onChange={e => setEditingProject({ ...editingProject, sequence: parseInt(e.target.value) || 0 })}
                                        placeholder="自動編號"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">工程簡稱</label>
                                    <input
                                        type="text"
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                        value={editingProject.abbreviation || ''}
                                        onChange={e => setEditingProject({ ...editingProject, abbreviation: e.target.value })}
                                        placeholder="例：A01"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">工程名稱</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                    value={editingProject.name}
                                    onChange={e => setEditingProject({ ...editingProject, name: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">承攬商名稱</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                    value={editingProject.contractor}
                                    onChange={e => setEditingProject({ ...editingProject, contractor: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">承辦人員姓名</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                    value={editingProject.coordinatorName}
                                    onChange={e => setEditingProject({ ...editingProject, coordinatorName: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">承辦人員信箱</label>
                                <input
                                    type="email"
                                    required
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                    value={editingProject.coordinatorEmail}
                                    onChange={e => setEditingProject({ ...editingProject, coordinatorEmail: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">主辦工作隊</label>
                                <input
                                    type="text"
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                    value={editingProject.hostTeam || ''}
                                    onChange={e => setEditingProject({ ...editingProject, hostTeam: e.target.value })}
                                    placeholder="例：建築工作隊"
                                />
                            </div>
                            {/* 主管欄位 */}
                            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100 mt-2">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">部門主管姓名</label>
                                    <input
                                        type="text"
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                        value={editingProject.managerName || ''}
                                        onChange={e => setEditingProject({ ...editingProject, managerName: e.target.value })}
                                        placeholder="主管姓名"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">部門主管 Email</label>
                                    <input
                                        type="email"
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                        value={editingProject.managerEmail || ''}
                                        onChange={e => setEditingProject({ ...editingProject, managerEmail: e.target.value })}
                                        placeholder="主管信箱"
                                    />
                                </div>
                            </div>
                            <div className="pt-4 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setProjectFormOpen(false)}
                                    className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
                                >
                                    取消
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-md shadow-indigo-200"
                                >
                                    儲存
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );

    const getCoordinatorForProject = (projectName: string): Coordinator | undefined => {
        const proj = projects.find(p => p.name === projectName);
        if (proj) {
            return {
                id: proj.id,
                name: proj.coordinatorName,
                email: proj.coordinatorEmail,
                projectName: proj.name
            };
        }
        return undefined;
    };

    const openEmailModal = (violation: Violation) => {
        setEmailState({ isOpen: true, violation });
    };

    const handleEmailSent = () => {
        // Just close the modal, the actual sending is handled in EmailPreview
        setEmailState({ isOpen: false, violation: null });
    };

    const getStatusLabel = (status: ViolationStatus) => {
        const map = {
            [ViolationStatus.PENDING]: '待辦理',
            [ViolationStatus.NOTIFIED]: '已通知',
            [ViolationStatus.SUBMITTED]: '已提送',
            [ViolationStatus.COMPLETED]: '已完成'
        };
        return map[status] || '未知';
    };

    if (!isAuthenticated) {
        return <LoginScreen onLogin={handleLogin} />;
    }

    return (
        <div className="min-h-screen flex bg-slate-100 text-slate-800 font-sans relative">

            {/* Mobile Sidebar Overlay */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-20 md:hidden glass"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside className={`w-64 bg-gradient-to-b from-slate-900 to-slate-950 text-slate-300 flex flex-col fixed inset-y-0 left-0 z-30 h-full shadow-2xl transition-transform duration-300 md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <div className="p-6 border-b border-white/5 flex items-center gap-3">
                    <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl flex items-center justify-center text-white font-bold shadow-lg shadow-indigo-500/30 text-sm">
                        SG
                    </div>
                    <span className="text-white font-bold text-lg tracking-tight">違規講習登錄表</span>
                    <button
                        onClick={() => setIsSidebarOpen(false)}
                        className="ml-auto md:hidden text-slate-400 hover:text-white"
                    >
                        <X size={20} />
                    </button>
                </div>

                <nav className="flex-1 p-4 space-y-2">
                    <button
                        onClick={() => { setView('DASHBOARD'); setIsSidebarOpen(false); }}
                        className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl transition-all ${view === 'DASHBOARD' ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-lg shadow-indigo-600/30' : 'hover:bg-white/5 text-slate-400 hover:text-slate-200'}`}
                    >
                        <LayoutDashboard size={20} />
                        儀表板
                    </button>
                    <button
                        onClick={() => { setView('VIOLATIONS'); setIsSidebarOpen(false); }}
                        className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl transition-all ${view === 'VIOLATIONS' ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-lg shadow-indigo-600/30' : 'hover:bg-white/5 text-slate-400 hover:text-slate-200'}`}
                    >
                        <FileWarning size={20} />
                        違規紀錄
                    </button>
                    <button
                        onClick={() => { setView('PROJECTS'); setIsSidebarOpen(false); }}
                        className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl transition-all ${view === 'PROJECTS' ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-lg shadow-indigo-600/30' : 'hover:bg-white/5 text-slate-400 hover:text-slate-200'}`}
                    >
                        <Briefcase size={20} />
                        工程管理
                    </button>
                    {currentUserRole === 'admin' && (
                        <button
                            onClick={() => { setView('ADMIN'); setIsSidebarOpen(false); }}
                            className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl transition-all ${view === 'ADMIN' ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-lg shadow-indigo-600/30' : 'hover:bg-white/5 text-slate-400 hover:text-slate-200'}`}
                        >
                            <Users size={20} />
                            帳號管理
                        </button>
                    )}
                </nav>

                <div className="p-4 border-t border-white/5">
                    <div className="mb-4">
                        {isLoading ? (
                            <div className="flex items-center gap-2 text-indigo-400 text-sm px-2 animate-pulse">
                                <Loader2 size={16} className="animate-spin" />
                                <span className="hidden sm:inline">資料同步中...</span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 text-emerald-500 text-sm px-2">
                                <Database size={16} />
                                <span className="hidden sm:inline">資料庫已連線</span>
                            </div>
                        )}
                    </div>
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors w-full"
                    >
                        <LogOut size={16} />
                        登出系統
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 md:ml-64 p-4 md:p-8 overflow-y-auto relative min-h-screen transition-all w-full bg-slate-50/50">
                {isLoading && (
                    <div className="absolute top-4 right-8 z-50 bg-indigo-600 text-white text-xs px-3 py-1 rounded-full shadow-lg flex items-center gap-2 animate-pulse">
                        <Loader2 size={12} className="animate-spin" />
                        <span>處理中...</span>
                    </div>
                )}

                <header className="flex justify-between items-center mb-6 md:mb-8">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setIsSidebarOpen(true)}
                            className="p-2 text-slate-600 hover:bg-slate-200 rounded-lg md:hidden"
                        >
                            <Menu size={24} />
                        </button>
                        <div>
                            <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
                                {view === 'DASHBOARD' && '系統總覽'}
                                {view === 'VIOLATIONS' && '違規管理紀錄'}
                                {view === 'PROJECTS' && '工程專案管理'}
                                {view === 'ADMIN' && '系統管理'}
                            </h1>
                            <p className="text-slate-400 mt-0.5 text-sm hidden md:block">管理違規事項並確保符合工安規範</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-white font-bold text-xs md:text-sm shadow-md shadow-indigo-500/20">
                            AD
                        </div>
                    </div>
                </header>

                {view === 'DASHBOARD' && renderDashboard()}
                {view === 'VIOLATIONS' && renderViolationList()}
                {view === 'PROJECTS' && renderProjects()}
                {view === 'ADMIN' && renderUserManagement()}
            </main>

            <ViolationModal
                isOpen={isViolationModalOpen}
                onClose={() => setViolationModalOpen(false)}
                onSave={handleSaveViolation}
                projects={projects}
                initialData={editingViolation}
            />

            <EmailPreview
                isOpen={emailState.isOpen}
                onClose={() => setEmailState({ isOpen: false, violation: null })}
                onSend={handleEmailSent}
                violation={emailState.violation as Violation}
                coordinator={emailState.violation ? getCoordinatorForProject(emailState.violation.projectName) : undefined}
                currentUserEmail={currentUserEmail}
            />

            {/* Loading Modal - 上傳/同步時顯示 */}
            <LoadingModal isOpen={isLoading} message="資料同步中..." />

        </div>
    );
}

export default App;