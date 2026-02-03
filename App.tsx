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
    RefreshCw
} from 'lucide-react';
import { Violation, Project, ViewState, ViolationStatus, Coordinator } from './types';
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

    // Modal States
    const [isViolationModalOpen, setViolationModalOpen] = useState(false);
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
    };

    const handleLogout = () => {
        setIsAuthenticated(false);
        setCurrentUserEmail('');
        setView('DASHBOARD');
    };

    const handleSaveViolation = async (newViolation: Violation, fileData?: { name: string, type: string, base64: string }) => {
        setIsLoading(true);
        try {
            const updatedList = [newViolation, ...violations];
            // 樂觀更新 (Optimistic Update)
            setViolations(updatedList);

            // 取得工程資訊以建立檔案名稱
            const project = projects.find(p => p.name === newViolation.projectName);

            // 準備檔案上傳參數（含工程資訊）
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

            // 使用後端確認的資料更新 (這時後端應該已經填回 fileUrl)
            setViolations(response.violations);
        } catch (e) {
            console.error(e);
            alert('儲存失敗：' + (e as Error).message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleStatusToggle = async (id: string) => {
        setIsLoading(true);
        try {
            const updatedList = violations.map(v =>
                v.id === id
                    ? { ...v, status: v.status === ViolationStatus.PENDING ? ViolationStatus.COMPLETED : ViolationStatus.PENDING }
                    : v
            );
            setViolations(updatedList);
            const response = await syncData(undefined, updatedList);
            setViolations(response.violations);
        } catch (e) {
            alert('更新失敗');
        } finally {
            setIsLoading(false);
        }
    };

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
    const hostTeams = [...new Set(projects.map(p => p.hostTeam).filter(Boolean))];

    const filteredViolations = violations.filter(v => {
        const matchesSearch = v.contractorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            v.projectName.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === 'ALL' || v.status === statusFilter;
        // 主辦部門篩選
        const project = projects.find(p => p.name === v.projectName);
        const matchesHostTeam = hostTeamFilter === 'ALL' || (project?.hostTeam === hostTeamFilter);
        return matchesSearch && matchesStatus && matchesHostTeam;
    });

    const pendingCount = violations.filter(v => v.status === ViolationStatus.PENDING).length;
    const overdueCount = violations.filter(v => v.status === ViolationStatus.PENDING && getDaysRemaining(v.lectureDeadline) < 0).length;
    const urgentCount = violations.filter(v => v.status === ViolationStatus.PENDING && getDaysRemaining(v.lectureDeadline) <= 5 && getDaysRemaining(v.lectureDeadline) >= 0).length;
    // 新增：2日內到期
    const within2DaysCount = violations.filter(v =>
        v.status === ViolationStatus.PENDING &&
        getDaysRemaining(v.lectureDeadline) <= 2 &&
        getDaysRemaining(v.lectureDeadline) >= 0
    ).length;

    const renderDashboard = () => {
        // 找出到期前5日且未完成的違規
        const urgentViolations = violations.filter(v =>
            v.status === ViolationStatus.PENDING &&
            getDaysRemaining(v.lectureDeadline) <= 5 &&
            getDaysRemaining(v.lectureDeadline) >= 0
        );

        return (
            <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
                    <StatCard
                        title="待辦理違規"
                        value={pendingCount}
                        icon={AlertTriangle}
                        colorClass="bg-orange-500"
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
                        colorClass="bg-red-500"
                    />
                    <StatCard
                        title="本月已完成"
                        value={violations.filter(v => v.status === ViolationStatus.COMPLETED).length}
                        icon={CheckCircle2}
                        colorClass="bg-green-500"
                    />
                </div>

                {/* 到期提醒區域 */}
                {urgentViolations.length > 0 && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 mb-8">
                        <div className="flex items-center gap-3 mb-4">
                            <AlertTriangle className="w-6 h-6 text-yellow-600" />
                            <h2 className="text-lg font-semibold text-yellow-800">
                                ⚠️ 到期前5日提醒 ({urgentViolations.length}件待處理)
                            </h2>
                        </div>
                        <div className="space-y-3">
                            {urgentViolations.map(v => (
                                <div key={v.id} className="flex items-center justify-between bg-white rounded-lg p-4 shadow-sm border border-yellow-100">
                                    <div>
                                        <p className="font-medium text-slate-800">{v.projectName}</p>
                                        <p className="text-sm text-slate-500">{v.contractorName} | {v.description?.substring(0, 30) || '無說明'}</p>
                                    </div>
                                    <div className="text-right">
                                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
                                            剩餘 {getDaysRemaining(v.lectureDeadline)} 天
                                        </span>
                                        <p className="text-xs text-slate-500 mt-1">截止：{formatDate(v.lectureDeadline)}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </>
        );
    };

    const renderViolationList = () => (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            {/* Toolbar */}
            <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <div className="relative flex-1 sm:w-64">
                        <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="搜尋承攬商或工程..."
                            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="relative">
                        <Filter className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                        <select
                            className="pl-9 pr-8 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none appearance-none cursor-pointer"
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value as any)}
                        >
                            <option value="ALL">所有狀態</option>
                            <option value={ViolationStatus.PENDING}>待辦理</option>
                            <option value={ViolationStatus.COMPLETED}>已完成</option>
                        </select>
                    </div>
                    {/* 主辦部門篩選 */}
                    <div className="relative">
                        <Briefcase className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                        <select
                            className="pl-9 pr-8 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none appearance-none cursor-pointer"
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
                <button
                    onClick={() => setViolationModalOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors shadow-md shadow-indigo-200"
                >
                    <Plus size={16} />
                    新增紀錄
                </button>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                            <th className="px-6 py-4">承攬商 / 工程</th>
                            <th className="px-6 py-4">違規事項</th>
                            <th className="px-6 py-4">講習期限</th>
                            <th className="px-6 py-4">狀態</th>
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
                                            <div className="text-sm text-slate-600">{formatDate(violation.lectureDeadline)}</div>
                                            {violation.status === ViolationStatus.PENDING && (
                                                <div className={`text-xs font-medium mt-1 ${isOverdue ? 'text-red-500' : daysRemaining <= 5 ? 'text-orange-500' : 'text-slate-400'}`}>
                                                    {isOverdue ? `已逾期 ${Math.abs(daysRemaining)} 天` : `剩餘 ${daysRemaining} 天`}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <button
                                                onClick={() => handleStatusToggle(violation.id)}
                                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${violation.status === ViolationStatus.COMPLETED
                                                    ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                                    : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                                                    }`}
                                            >
                                                {violation.status === ViolationStatus.COMPLETED ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                                                {getStatusLabel(violation.status)}
                                            </button>
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
                                                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
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

    const renderProjects = () => (
        <div className="space-y-6">
            <div className="flex justify-end">
                <button
                    onClick={() => {
                        setEditingProject({ sequence: 0, abbreviation: '', name: '', coordinatorName: '', coordinatorEmail: '', contractor: '' });
                        setProjectFormOpen(true);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors shadow-md shadow-indigo-200"
                >
                    <Plus size={16} />
                    新增工程專案
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {projects.map(project => (
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
                        <p className="text-sm text-slate-500 mb-4 flex items-center gap-2">
                            <HardHat size={14} />
                            {project.contractor}
                        </p>

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
        return status === ViolationStatus.PENDING ? '待辦理' : '已完成';
    };

    if (!isAuthenticated) {
        return <LoginScreen onLogin={handleLogin} />;
    }

    return (
        <div className="min-h-screen flex bg-slate-50 text-slate-800 font-sans">

            {/* Sidebar */}
            <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col fixed h-full shadow-xl z-20 transition-all">
                <div className="p-6 border-b border-slate-800 flex items-center gap-3">
                    <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center text-white font-bold">
                        SG
                    </div>
                    <span className="text-white font-bold text-lg tracking-tight">違規講習登錄表</span>
                </div>

                <nav className="flex-1 p-4 space-y-2">
                    <button
                        onClick={() => setView('DASHBOARD')}
                        className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl transition-all ${view === 'DASHBOARD' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/50' : 'hover:bg-slate-800'}`}
                    >
                        <LayoutDashboard size={20} />
                        儀表板
                    </button>
                    <button
                        onClick={() => setView('VIOLATIONS')}
                        className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl transition-all ${view === 'VIOLATIONS' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/50' : 'hover:bg-slate-800'}`}
                    >
                        <FileWarning size={20} />
                        違規紀錄
                    </button>
                    <button
                        onClick={() => setView('PROJECTS')}
                        className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl transition-all ${view === 'PROJECTS' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/50' : 'hover:bg-slate-800'}`}
                    >
                        <Briefcase size={20} />
                        工程管理
                    </button>
                </nav>

                <div className="p-4 border-t border-slate-800">
                    <div className="mb-4">
                        {isLoading ? (
                            <div className="flex items-center gap-2 text-indigo-400 text-sm px-2 animate-pulse">
                                <Loader2 size={16} className="animate-spin" />
                                <span>資料同步中...</span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 text-emerald-500 text-sm px-2">
                                <Database size={16} />
                                <span>資料庫已連線</span>
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
            <main className="ml-64 flex-1 p-8 overflow-y-auto relative">
                {isLoading && (
                    <div className="absolute top-4 right-8 z-50 bg-indigo-600 text-white text-xs px-3 py-1 rounded-full shadow-lg flex items-center gap-2 animate-pulse">
                        <Loader2 size={12} className="animate-spin" />
                        <span>處理中...</span>
                    </div>
                )}

                <header className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">
                            {view === 'DASHBOARD' && '系統總覽'}
                            {view === 'VIOLATIONS' && '違規管理紀錄'}
                            {view === 'PROJECTS' && '工程專案管理'}
                        </h1>
                        <p className="text-slate-500 mt-1 text-sm">管理違規事項並確保符合工安規範。</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-slate-200 border border-slate-300 flex items-center justify-center text-slate-600 font-bold">
                            AD
                        </div>
                    </div>
                </header>

                {view === 'DASHBOARD' && renderDashboard()}
                {view === 'VIOLATIONS' && renderViolationList()}
                {view === 'PROJECTS' && renderProjects()}
            </main>

            <ViolationModal
                isOpen={isViolationModalOpen}
                onClose={() => setViolationModalOpen(false)}
                onSave={handleSaveViolation}
                projects={projects}
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