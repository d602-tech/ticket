import React, { useState, useEffect, useMemo } from 'react';
import {
    LayoutDashboard, FileWarning, Briefcase, Plus, Menu, X, LogOut,
    Loader2, Database, Users, DollarSign, Edit2, Trash2,
    Pickaxe, Building2, Wrench, Zap, MapPin, Hammer, FileText, Sun, Moon // Added missing icons
} from 'lucide-react';
import {
    Violation, Project, Fine, FineList, Section, User, ViolationStatus, Coordinator
} from './types';
import {
    fetchInitialData, fetchUsers,
    saveViolation, removeViolation, saveProject, removeProject,
    syncData
} from './services/storageService';
import { getApiUrl, setApiUrl, hasDefaultUrl, login, googleLogin } from './services/apiService';
import { Dashboard } from './components/Dashboard';
import { ViolationList } from './components/ViolationList';
import { LoginScreen } from './components/LoginScreen';
import { ViolationModal } from './components/ViolationModal';
import { EmailPreview } from './components/EmailPreview';
import { LoadingModal } from './components/LoadingModal';
import { FineStats } from './components/FineStats';
import { PersonnelManagement } from './components/PersonnelManagement';
import * as XLSX from 'xlsx';

// Constants
const HOST_TEAMS = ['土木工作隊', '建築工作隊', '機械工作隊', '電氣工作隊', '中部工作隊', '南部工作隊'];

function App() {
    // Data State
    const [projects, setProjects] = useState<Project[]>([]);
    const [violations, setViolations] = useState<Violation[]>([]);
    const [fines, setFines] = useState<Fine[]>([]);
    const [fineList, setFineList] = useState<FineList[]>([]);
    const [sections, setSections] = useState<Section[]>([]);
    const [users, setUsers] = useState<User[]>([]);

    // UI State
    const [isLoading, setIsLoading] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [currentUserEmail, setCurrentUserEmail] = useState('');
    const [currentUserName, setCurrentUserName] = useState('');
    const [currentUserRole, setCurrentUserRole] = useState('user'); // 'admin', 'user', 'viewer'
    const [view, setView] = useState('DASHBOARD');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    // Modal State
    const [isViolationModalOpen, setViolationModalOpen] = useState(false);
    const [editingViolation, setEditingViolation] = useState<Violation | null>(null);
    const [emailState, setEmailState] = useState<{ isOpen: boolean, violation: Violation | null }>({ isOpen: false, violation: null });

    // Project Form State
    const [isProjectFormOpen, setProjectFormOpen] = useState(false);
    const [editingProject, setEditingProject] = useState<Partial<Project>>({});
    const [projectHostTeamFilter, setProjectHostTeamFilter] = useState('ALL');

    // User Form State
    const [newUserForm, setNewUserForm] = useState({ email: '', password: '', name: '', role: 'user' });

    // Theme State
    const [isDarkMode, setIsDarkMode] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('theme') === 'dark';
        }
        return false;
    });

    useEffect(() => {
        if (isDarkMode) {
            document.documentElement.classList.add('dark');
            localStorage.setItem('theme', 'dark');
        } else {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('theme', 'light');
        }
    }, [isDarkMode]);

    // Initialization
    useEffect(() => {
        const init = async () => {
            if (isAuthenticated) {
                setIsLoading(true);
                try {
                    const data = await fetchInitialData();
                    setProjects(data.projects);
                    setViolations(data.violations);
                    setFines(data.fines);
                    setFineList(data.fineList);
                    setSections(data.sections);
                    console.log(`[DEBUG] fetchInitialData loaded ${data.violations.length} violations for role ${currentUserRole}`);
                    // Users are fetched separately based on role
                    if (currentUserRole === 'admin') {
                        const usersData = await fetchUsers(currentUserRole);
                        setUsers(usersData);

                        // Show alert for pending users
                        const pendingCount = usersData.filter((u: User) => u.role === 'pending').length;
                        if (pendingCount > 0) {
                            setTimeout(() => {
                                if (window.confirm(`提示：目前有 ${pendingCount} 名待審核帳號申請，請前往「帳號管理」進行開通作業。\n是否立即前往？`)) {
                                    setView('ACCOUNT_MANAGEMENT');
                                }
                            }, 500);
                        }
                    }
                } catch (e) {
                    console.error('Initialization failed:', e);
                    alert('資料載入失敗，請檢查網路連線');
                } finally {
                    setIsLoading(false);
                }
            }
        };
        init();
    }, [isAuthenticated, currentUserRole]);

    // Login Handler
    const handleLogin = async (success: boolean, user?: any) => {
        if (success && user) {
            setCurrentUserEmail(user.email);
            setCurrentUserRole(user.role);
            setCurrentUserName(user.name);
            setIsAuthenticated(true);

            if (user.role === 'fine_inputter') {
                setView('FINE_STATS');
            } else {
                setView('DASHBOARD');
            }
        } else {
            console.error('Login failed args:', success, user);
            alert(`登入失敗 (Debug): success=${success}, user=${JSON.stringify(user)}`);
        }
    };

    const handleLogout = () => {
        setIsAuthenticated(false);
        setCurrentUserEmail('');
        setCurrentUserRole('user');
        setViolations([]);
        setProjects([]);
    };

    // Incremental Updates: Violation
    const handleSaveViolation = async (newViolation: Violation, fileData?: { name: string, type: string, base64: string }) => {
        const project = projects.find(p => p.name === newViolation.projectName);
        const projectInfo = project ? {
            sequence: project.sequence,
            abbreviation: project.abbreviation
        } : undefined;

        setIsLoading(true);
        try {
            const res = await saveViolation(newViolation, fileData, projectInfo);
            if (res.success && res.violation) {
                setViolations(prev => {
                    const idx = prev.findIndex(v => v.id === res.violation!.id);
                    if (idx >= 0) {
                        const newArr = [...prev];
                        newArr[idx] = res.violation!;
                        return newArr;
                    } else {
                        return [res.violation!, ...prev];
                    }
                });
                setViolationModalOpen(false);
                setEditingViolation(null);
            }
        } catch (e) {
            console.error('Save violation error:', e);
            alert('儲存失敗');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteViolation = async (id: string) => {
        if (!confirm('確定要刪除此違規紀錄嗎？')) return;
        setIsLoading(true);
        try {
            const success = await removeViolation(id);
            if (success) {
                setViolations(prev => prev.filter(v => v.id !== id));
            }
        } catch (e) {
            console.error('Delete violation error:', e);
            alert('刪除失敗');
        } finally {
            setIsLoading(false);
        }
    };

    // Incremental Updates: Project
    const handleSaveProject = async (e: React.FormEvent) => {
        e.preventDefault();
        const projectToSave = editingProject as Project;

        // Basic Validation
        if (!projectToSave.name || !projectToSave.contractor) {
            alert('請填寫完整工程資訊');
            return;
        }

        setIsLoading(true);
        try {
            // Check if creating new
            if (!projectToSave.id) {
                // Generate ID if not present (although backend handles it usually, frontend needs separate tracked ID or backend returns it)
                // My backend `handleUpdateItem` creates row if ID not found. 
                // But wait, `handleUpdateItem` EXPECTS `id` to find row. If no ID, it returns error? 
                // NO, `handleUpdateItem` says `if (!item || !item.id) return error`.
                // So I MUST generate ID on frontend for new items.
                projectToSave.id = Date.now().toString();
            }

            const res = await saveProject(projectToSave);
            if (res.success && res.project) {
                setProjects(prev => {
                    const idx = prev.findIndex(p => p.id === res.project!.id);
                    if (idx >= 0) {
                        const newArr = [...prev];
                        newArr[idx] = res.project!;
                        return newArr;
                    } else {
                        return [...prev, res.project!];
                    }
                });
                setProjectFormOpen(false);
                setEditingProject({});
            }
        } catch (e) {
            console.error('Save project error:', e);
            alert('儲存失敗');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteProject = async (id: string) => {
        if (!confirm('確定要刪除此工程專案嗎？')) return;
        setIsLoading(true);
        try {
            const success = await removeProject(id);
            if (success) {
                setProjects(prev => prev.filter(p => p.id !== id));
            }
        } catch (e) {
            console.error('Delete project error:', e);
            alert('刪除失敗');
        } finally {
            setIsLoading(false);
        }
    };

    // Legacy/Other Handlers (kept mostly as is but cleaned up)

    // Scan File Upload (PDFs)
    const handleUploadScanFile = async (violation: Violation, isReplace: boolean = false) => {
        if (isReplace && !confirm('確定要替換現有的掃描檔嗎？')) return;

        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/pdf,image/*';
        input.onchange = async (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (!file) return;

            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = async () => {
                const base64 = (reader.result as string).split(',')[1];
                setIsLoading(true);
                try {
                    const response = await fetch(getApiUrl()!, {
                        method: 'POST',
                        body: JSON.stringify({
                            action: 'uploadScanFile',
                            violationId: violation.id,
                            fileData: base64,
                            fileName: file.name,
                            mimeType: file.type
                        })
                    });
                    const result = await response.json();
                    if (result.success) {
                        setViolations(prev => prev.map(v =>
                            v.id === violation.id ? { ...v, scanFileUrl: result.scanFileUrl, scanFileName: result.scanFileName } : v
                        ));
                        alert('上傳成功');
                    } else {
                        alert('上傳失敗: ' + result.error);
                    }
                } catch (error) {
                    alert('上傳發生錯誤');
                } finally {
                    setIsLoading(false);
                }
            };
        };
        input.click();
    };

    // Document Generation
    const handleGenerateDocument = async (violation: Violation) => {
        if (!confirm(`確定要生成 ${violation.contractorName} 的簽辦單嗎？`)) return;
        setIsLoading(true);
        try {
            const response = await fetch(getApiUrl()!, {
                method: 'POST',
                body: JSON.stringify({
                    action: 'generateDocument',
                    violation: violation
                })
            });
            const result = await response.json();
            if (result.success) {
                setViolations(prev => prev.map(v =>
                    v.id === violation.id ? { ...v, documentUrl: result.documentUrl } : v
                ));
                window.open(result.documentUrl, '_blank');
            } else {
                alert('生成失敗: ' + result.error);
            }
        } catch (error) {
            alert('生成發生錯誤');
        } finally {
            setIsLoading(false);
        }
    };

    // User Management Handlers
    const handleAddUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            // Still using direct fetch for addUser (not yet in storageService explicitly, but syncData handles users list update?)
            // App.tsx original used fetch with action='addUser'.
            // I'll keep it direct fetch for now or allow `syncData` to handle generic requests? 
            // `callGasApi` in apiService is cleaner.
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
                // Re-fetch users
                const usersData = await fetchUsers(currentUserRole);
                setUsers(usersData);
            } else {
                alert('新增失敗: ' + result.error);
            }
        } catch (e) {
            alert('連線失敗');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteUser = async (user: User) => {
        if (!confirm(`確定要刪除使用者 ${user.name}?`)) return;
        setIsLoading(true);
        try {
            const updatedUsers = users.filter(u => u.email !== user.email);
            // Updating users list usually requires full sync of users list or specific API.
            // Old App.tsx used `syncData(..., updatedUsers)`.
            // Code.js `sync` handles `users` array update.
            const result = await syncData(undefined, undefined, undefined, undefined, undefined, updatedUsers);
            setUsers(result.users);
            alert('使用者已刪除');
        } catch (e) {
            alert('刪除失敗');
        } finally {
            setIsLoading(false);
        }
    };

    const handleChangeUserRole = async (user: User, newRole: string) => {
        setIsLoading(true);
        try {
            const response = await fetch(getApiUrl()!, {
                method: 'POST',
                body: JSON.stringify({
                    action: 'updateUserRole',
                    adminRole: currentUserRole,
                    userEmail: user.email,
                    userName: user.name,
                    newRole: newRole
                })
            });
            const result = await response.json();

            if (result.success) {
                setUsers(result.users);
            } else {
                alert('更改權限失敗: ' + result.error);
            }
        } catch (e) {
            alert('更改權限發生錯誤');
        } finally {
            setIsLoading(false);
        }
    };

    const openEmailModal = (violation: Violation) => {
        setEmailState({ isOpen: true, violation });
    };

    const handleEmailSent = () => {
        setEmailState({ isOpen: false, violation: null });
    };

    // Helpers
    const getCoordinatorForProject = (projectName: string): Coordinator | undefined => {
        const proj = projects.find(p => p.name === projectName);
        return proj ? {
            id: proj.id,
            name: proj.coordinatorName,
            email: proj.coordinatorEmail,
            projectName: proj.name
        } : undefined;
    };

    const getRoleStyle = (role: string) => {
        switch (role) {
            case 'admin': return { card: 'border-indigo-200 bg-gradient-to-br from-indigo-50 to-violet-50', avatar: 'bg-gradient-to-br from-indigo-500 to-violet-600 shadow-indigo-200', badge: 'bg-indigo-100 text-indigo-700 border-indigo-200', badgeLabel: '系統管理員', dot: 'bg-indigo-500' };
            case 'viewer': return { card: 'border-slate-200 bg-gradient-to-br from-slate-50 to-gray-50', avatar: 'bg-gradient-to-br from-slate-400 to-gray-500 shadow-slate-200', badge: 'bg-slate-100 text-slate-600 border-slate-200', badgeLabel: '觀看者', dot: 'bg-slate-400' };
            case 'fine_inputter': return { card: 'border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50', avatar: 'bg-gradient-to-br from-orange-500 to-amber-600 shadow-orange-200', badge: 'bg-orange-100 text-orange-700 border-orange-200', badgeLabel: '罰單輸入者', dot: 'bg-orange-500' };
            case 'pending': return { card: 'border-yellow-200 bg-gradient-to-br from-yellow-50 to-amber-50', avatar: 'bg-gradient-to-br from-yellow-500 to-amber-600 shadow-yellow-200', badge: 'bg-yellow-100 text-yellow-700 border-yellow-200', badgeLabel: '待審核 (Pending)', dot: 'bg-yellow-500' };
            default: return { card: 'border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50', avatar: 'bg-gradient-to-br from-emerald-500 to-teal-600 shadow-emerald-200', badge: 'bg-emerald-100 text-emerald-700 border-emerald-200', badgeLabel: '一般使用者', dot: 'bg-emerald-500' };
        }
    };

    // View Components
    const renderUserManagement = () => (
        <div className="animate-fade-in max-w-7xl mx-auto space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">帳號管理</h2>
                    <p className="text-slate-500 text-sm mt-1">管理系統使用者權限與帳號資訊</p>
                </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                    {['pending', 'admin', 'user', 'fine_inputter', 'viewer'].map(role => {
                        const roleUsers = users.filter(u => u.role === role);
                        if (roleUsers.length === 0) return null;
                        const style = getRoleStyle(role);
                        return (
                            <div key={role}>
                                <div className="flex items-center gap-2 mb-3">
                                    <div className={`w-2.5 h-2.5 rounded-full ${style.dot}`}></div>
                                    <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wider">{style.badgeLabel} ({roleUsers.length})</h3>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {roleUsers.map((user, idx) => {
                                        const s = getRoleStyle(user.role);
                                        return (
                                            <div key={idx} className={`rounded-xl shadow-sm border p-5 flex flex-col justify-between hover:shadow-md transition-shadow group ${s.card}`}>
                                                <div>
                                                    <div className="flex justify-between items-start mb-3">
                                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-md ${s.avatar}`}>
                                                            {user.name ? String(user.name).charAt(0).toUpperCase() : '?'}
                                                        </div>
                                                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium border ${s.badge}`}>{s.badgeLabel}</span>
                                                    </div>
                                                    <h3 className="font-bold text-slate-800 text-lg mb-1">{user.name || '(無名稱)'}</h3>
                                                    <p className="text-slate-500 text-sm font-mono break-all">{user.email || '(無信箱)'}</p>
                                                    <div className="mt-3 pt-3 border-t border-black/5 flex items-center justify-between">
                                                        <label className="text-xs text-slate-500 font-medium">權限：</label>
                                                        <select
                                                            value={user.role}
                                                            onChange={(e) => handleChangeUserRole(user, e.target.value)}
                                                            className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
                                                        >
                                                            {user.role === 'pending' && <option value="pending" disabled>待審核</option>}
                                                            <option value="admin">系統管理員</option>
                                                            <option value="user">一般使用者</option>
                                                            <option value="fine_inputter">罰單輸入者</option>
                                                            <option value="viewer">觀看者</option>
                                                        </select>
                                                    </div>
                                                </div>
                                                <div className="mt-3 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => handleDeleteUser(user)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="刪除帳號"><Trash2 size={18} /></button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
                {/* Add User Form */}
                <div className="space-y-6">
                    <div className="bg-white rounded-xl shadow-lg shadow-indigo-100 border border-indigo-50 p-6 sticky top-8">
                        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-indigo-50">
                            <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg"><Plus size={20} /></div>
                            <h3 className="text-lg font-bold text-slate-800">新增使用者</h3>
                        </div>
                        <form onSubmit={handleAddUser} className="space-y-4">
                            <div><label className="block text-sm font-bold text-slate-700 mb-1.5">姓名</label><input type="text" required className="w-full px-3 py-2.5 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 transition-all bg-slate-50 focus:bg-white" value={newUserForm.name} onChange={e => setNewUserForm({ ...newUserForm, name: e.target.value })} placeholder="輸入使用者姓名" /></div>
                            <div><label className="block text-sm font-bold text-slate-700 mb-1.5">Email (帳號)</label><input type="email" required className="w-full px-3 py-2.5 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 transition-all bg-slate-50 focus:bg-white" value={newUserForm.email} onChange={e => setNewUserForm({ ...newUserForm, email: e.target.value })} placeholder="user@example.com" /></div>
                            <div><label className="block text-sm font-bold text-slate-700 mb-1.5">密碼</label><input type="text" required className="w-full px-3 py-2.5 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 transition-all bg-slate-50 focus:bg-white" value={newUserForm.password} onChange={e => setNewUserForm({ ...newUserForm, password: e.target.value })} placeholder="設定預設密碼" /></div>
                            <div><label className="block text-sm font-bold text-slate-700 mb-1.5">權限角色</label>
                                <select className="w-full px-3 py-2.5 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 transition-all bg-slate-50 focus:bg-white appearance-none" value={newUserForm.role} onChange={e => setNewUserForm({ ...newUserForm, role: e.target.value })}>
                                    <option value="user">一般使用者 (User)</option>
                                    <option value="admin">系統管理員 (Admin)</option>
                                    <option value="fine_inputter">罰單輸入者 (Fine Inputter)</option>
                                    <option value="viewer">觀看者 (Viewer)</option>
                                </select>
                            </div>
                            <button type="submit" className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl transition-all mt-4 shadow-lg shadow-slate-200 hover:shadow-xl active:scale-95 flex items-center justify-center gap-2"><Plus size={18} />新增帳號</button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );

    // Project View
    const handleExportProjects = () => {
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(projects);
        XLSX.utils.book_append_sheet(wb, ws, "Projects");
        XLSX.writeFile(wb, "Projects_Export.xlsx");
    };

    const handleImportProjects = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (evt) => {
            const bstr = evt.target?.result;
            const wb = XLSX.read(bstr, { type: 'binary' });
            const wsname = wb.SheetNames[0];
            const ws = wb.Sheets[wsname];
            const data = XLSX.utils.sheet_to_json(ws) as Project[];
            if (confirm(`即將匯入 ${data.length} 筆工程資料，確定?`)) {
                setIsLoading(true);
                try {
                    // Still using syncData for bulk import which is fine, 
                    // OR I should use `saveProject` in loop? 
                    // Bulk is better. `syncData` handles bulk `projects` updates.
                    // But need to be careful not to overwrite all projects if backend implementation of `sync` is deprecated for full overwrite?
                    // My new `Code.js` `sync` action says "Deprecated... Fallback for full sync".
                    // So I should arguably iterate and save, or assume `sync` still works for this.
                    // The user asked for "All optimizations". 
                    // `sync` in backend: `initAllSheets`, then defaults. 
                    // It OVERWRITES. So for import, it might be dangerous if we don't merge first.
                    // The original code merged: `let updatedProjects = [...projects] ...`.
                    // So `syncData` overwrites the WHOLE sheet with the merged list. This is what was intended.
                    // But if the backend is optimized to NOT overwrite everything, this `syncData` defeats the purpose.
                    // However, for BULK IMPORT, maybe overwriting is okay or at least acceptable.
                    // To be fully optimized, backend should support `bulkUpdateProjects`.
                    // For now I will leave it as `syncData` (Legacy) as it works for this rare operation.
                    let updatedProjects = [...projects];
                    data.forEach(newP => {
                        const idx = updatedProjects.findIndex(p => p.id === newP.id || p.name === newP.name);
                        if (idx >= 0) {
                            updatedProjects[idx] = { ...updatedProjects[idx], ...newP };
                        } else {
                            if (!newP.id) newP.id = Date.now().toString() + Math.random();
                            updatedProjects.push(newP);
                        }
                    });
                    const result = await syncData(updatedProjects, undefined);
                    setProjects(result.projects);
                    alert('匯入成功');
                } catch (err) {
                    alert('匯入失敗');
                    console.error(err);
                } finally {
                    setIsLoading(false);
                }
            }
        };
        reader.readAsBinaryString(file);
    };

    // Project View
    // ... existing export/import handlers ...

    const TEAM_CONFIG: Record<string, { color: string, icon: React.ElementType, label: string }> = {
        '土木工作隊': { color: 'amber', icon: Pickaxe, label: '土木' },
        '建築工作隊': { color: 'emerald', icon: Building2, label: '建築' },
        '機械工作隊': { color: 'blue', icon: Wrench, label: '機械' },
        '電氣工作隊': { color: 'purple', icon: Zap, label: '電氣' },
        '中部工作隊': { color: 'rose', icon: MapPin, label: '中部' },
        '南部工作隊': { color: 'cyan', icon: MapPin, label: '南部' },
        'default': { color: 'slate', icon: Briefcase, label: '其他' }
    };

    const getProjectStyle = (team: string | undefined) => {
        const key = Object.keys(TEAM_CONFIG).find(k => team?.includes(k)) || 'default';
        return TEAM_CONFIG[key];
    };

    const renderProjects = () => (
        <div className="space-y-6">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div className="flex overflow-x-auto pb-2 md:pb-0 items-center gap-2 w-full md:w-auto md:flex-wrap no-scrollbar">
                    <button onClick={() => setProjectHostTeamFilter('ALL')} className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-bold transition-all ${projectHostTeamFilter === 'ALL' ? 'bg-slate-800 text-white shadow-lg shadow-slate-200' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'}`}>全部</button>
                    {HOST_TEAMS.map(team => {
                        const config = TEAM_CONFIG[team];
                        const isSelected = projectHostTeamFilter === team;
                        // Dynamic class for selected state based on team color would be nice, but simple slate-800 is cleaner for consistency
                        return (
                            <button key={team} onClick={() => setProjectHostTeamFilter(team)} className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-bold transition-all flex items-center gap-2 ${isSelected ? 'bg-slate-800 text-white shadow-lg shadow-slate-200' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'}`}>
                                <config.icon size={14} />
                                {team}
                            </button>
                        );
                    })}
                </div>
                <div className="flex gap-2 ml-auto">
                    <button onClick={handleExportProjects} className="flex items-center gap-1 px-3 py-2 border bg-white hover:bg-slate-50 rounded-lg text-sm text-slate-600 shadow-sm"><Loader2 size={16} /> 匯出</button>
                    <label className="flex items-center gap-1 px-3 py-2 border bg-white hover:bg-slate-50 rounded-lg text-sm text-slate-600 cursor-pointer shadow-sm"><Loader2 size={16} /> 匯入<input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleImportProjects} /></label>
                    <button onClick={() => { setEditingProject({ sequence: 0, abbreviation: '', contractNumber: '', name: '', coordinatorName: '', coordinatorEmail: '', contractor: '', hostTeam: '', managerName: '', managerEmail: '' }); setProjectFormOpen(true); }} className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold rounded-lg transition-colors shadow-lg shadow-slate-200"><Plus size={16} />新增工程</button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {projects.filter(p => projectHostTeamFilter === 'ALL' || p.hostTeam === projectHostTeamFilter).map(project => {
                    const style = getProjectStyle(project.hostTeam);
                    const Icon = style.icon;

                    // Tailwind color mapping is tricky with dynamic strings if not safe-listed. 
                    // To be safe, we might need a map for classes, OR use style attribute for specific hex if needed, 
                    // but standard template literals usually work in JIT if the values are static strings in source.
                    // Since I defined 'color' keys (amber, emerald etc), and classes like `bg-amber-500` exist in generic css or safe-listed?
                    // Let's use a safe mapping approach or standard classes if we are sure.
                    // Assuming standard Tailwind colors.

                    const colorClasses = {
                        amber: { header: 'bg-amber-500', light: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
                        emerald: { header: 'bg-emerald-500', light: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
                        blue: { header: 'bg-blue-500', light: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
                        purple: { header: 'bg-purple-500', light: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
                        rose: { header: 'bg-rose-500', light: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
                        cyan: { header: 'bg-cyan-500', light: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200' },
                        slate: { header: 'bg-slate-500', light: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200' },
                    }[style.color] || { header: 'bg-slate-500', light: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200' };

                    return (
                        <div key={project.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-xl transition-all duration-300 group">
                            {/* Color Header */}
                            <div className={`${colorClasses.header} px-6 py-4 flex justify-between items-center relative overflow-hidden`}>
                                <div className="absolute -right-4 -top-4 opacity-20 transform rotate-12">
                                    <Icon size={80} className="text-white" />
                                </div>
                                <div className="flex items-center gap-3 relative z-10 text-white">
                                    <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
                                        <Icon size={20} />
                                    </div>
                                    <span className="font-bold tracking-wide text-sm">{project.hostTeam || '未分類工作隊'}</span>
                                </div>
                                <div className="relative z-10 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => { setEditingProject(project); setProjectFormOpen(true); }} className="p-2 bg-white/20 hover:bg-white text-white hover:text-slate-800 rounded-lg transition-colors backdrop-blur-sm"><Edit2 size={16} /></button>
                                    <button onClick={() => handleDeleteProject(project.id)} className="p-2 bg-white/20 hover:bg-white text-white hover:text-red-600 rounded-lg transition-colors backdrop-blur-sm"><Trash2 size={16} /></button>
                                </div>
                            </div>

                            {/* Body */}
                            <div className="p-6">
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                            {project.contractNumber ? (
                                                <span className="bg-slate-800 text-white text-xs font-mono px-2 py-1 rounded shadow-sm flex items-center gap-1">
                                                    <FileText size={10} /> {project.contractNumber}
                                                </span>
                                            ) : (
                                                <span className="bg-slate-100 text-slate-400 text-xs px-2 py-1 rounded">無契約號</span>
                                            )}
                                            {project.sequence !== undefined && (
                                                <span className="bg-slate-100 text-slate-500 text-xs font-mono px-2 py-1 rounded">
                                                    #{String(project.sequence).padStart(3, '0')}
                                                </span>
                                            )}
                                        </div>
                                        <h3 className="font-extrabold text-lg text-slate-800 leading-snug line-clamp-2 min-h-[3.5rem]" title={project.name}>
                                            {project.name}
                                        </h3>
                                    </div>
                                </div>

                                {/* Info Grid */}
                                <div className="grid grid-cols-2 gap-4 mt-6">
                                    <div className="col-span-2 p-3 bg-slate-50 rounded-xl border border-slate-100">
                                        <div className="text-xs text-slate-400 mb-1 flex items-center gap-1"><Building2 size={12} /> 承攬廠商</div>
                                        <div className="font-bold text-slate-700 truncate">{project.contractor || '-'}</div>
                                    </div>
                                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                                        <div className="text-xs text-slate-400 mb-1 flex items-center gap-1"><Users size={12} /> 承辦人</div>
                                        <div className="font-medium text-slate-700 truncate">{project.coordinatorName || '-'}</div>
                                    </div>
                                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                                        <div className="text-xs text-slate-400 mb-1 flex items-center gap-1"><Briefcase size={12} /> 簡稱</div>
                                        <div className="font-medium text-slate-700 truncate">{project.abbreviation || '-'}</div>
                                    </div>
                                </div>
                            </div>

                            {/* Footer/Contact */}
                            {project.coordinatorEmail && (
                                <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/50 flex justify-between items-center text-xs text-slate-500">
                                    <span>聯絡信箱</span>
                                    <span className="font-mono truncate max-w-[180px]">{project.coordinatorEmail}</span>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {isProjectFormOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                <Briefcase className="text-indigo-600" />
                                {editingProject.id ? '編輯工程專案' : '新增工程專案'}
                            </h2>
                            <button onClick={() => setProjectFormOpen(false)} className="bg-slate-100 p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"><X size={20} /></button>
                        </div>
                        <form onSubmit={handleSaveProject} className="p-8 space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-sm font-medium text-slate-700 mb-1">序號</label><input type="number" min="1" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" value={editingProject.sequence || ''} onChange={e => setEditingProject({ ...editingProject, sequence: parseInt(e.target.value) || 0 })} placeholder="自動編號" /></div>
                                <div><label className="block text-sm font-medium text-slate-700 mb-1">工程簡稱</label><input type="text" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" value={editingProject.abbreviation || ''} onChange={e => setEditingProject({ ...editingProject, abbreviation: e.target.value })} placeholder="例：A01" /></div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-sm font-medium text-slate-700 mb-1">契約編號</label><input type="text" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" value={editingProject.contractNumber || ''} onChange={e => setEditingProject({ ...editingProject, contractNumber: e.target.value })} placeholder="例：112001" /></div>
                                <div><label className="block text-sm font-medium text-slate-700 mb-1">主辦工作隊</label><input type="text" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" value={editingProject.hostTeam || ''} onChange={e => setEditingProject({ ...editingProject, hostTeam: e.target.value })} placeholder="例：建築工作隊" /></div>
                            </div>
                            <div><label className="block text-sm font-medium text-slate-700 mb-1">工程名稱</label><input type="text" required className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" value={editingProject.name || ''} onChange={e => setEditingProject({ ...editingProject, name: e.target.value })} /></div>
                            <div><label className="block text-sm font-medium text-slate-700 mb-1">承攬商名稱</label><input type="text" required className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" value={editingProject.contractor || ''} onChange={e => setEditingProject({ ...editingProject, contractor: e.target.value })} /></div>

                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-sm font-medium text-slate-700 mb-1">承辦人員姓名</label><input type="text" required className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" value={editingProject.coordinatorName || ''} onChange={e => setEditingProject({ ...editingProject, coordinatorName: e.target.value })} /></div>
                                <div><label className="block text-sm font-medium text-slate-700 mb-1">承辦人員信箱</label><input type="email" required className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" value={editingProject.coordinatorEmail || ''} onChange={e => setEditingProject({ ...editingProject, coordinatorEmail: e.target.value })} /></div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-sm font-medium text-slate-700 mb-1">部分主管姓名</label><input type="text" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" value={editingProject.managerName || ''} onChange={e => setEditingProject({ ...editingProject, managerName: e.target.value })} /></div>
                                <div><label className="block text-sm font-medium text-slate-700 mb-1">部門主管信箱</label><input type="email" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" value={editingProject.managerEmail || ''} onChange={e => setEditingProject({ ...editingProject, managerEmail: e.target.value })} /></div>
                            </div>

                            <div className="pt-4 flex justify-end gap-3">
                                <button type="button" onClick={() => setProjectFormOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50">取消</button>
                                <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-md shadow-indigo-200">儲存</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );

    if (!isAuthenticated) return <LoginScreen onLogin={handleLogin} />;

    return (
        <div className="min-h-screen flex bg-[#F3F4F6] text-slate-800 font-sans relative dark:bg-[#1A2234] dark:text-slate-100 transition-colors duration-300">
            {isSidebarOpen && <div className="fixed inset-0 bg-black/50 z-20 md:hidden glass" onClick={() => setIsSidebarOpen(false)} />}

            <aside className={`w-64 bg-sidebar text-slate-300 flex flex-col fixed inset-y-0 left-0 z-30 h-full shadow-xl shadow-slate-900/10 transition-transform duration-300 md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <div className="p-6 border-b border-white/5 flex items-center gap-3">
                    <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-sm">SG</div>
                    <span className="text-white font-bold text-lg">系統管理</span>
                    <button onClick={() => setIsSidebarOpen(false)} className="ml-auto md:hidden text-slate-400 hover:text-white"><X size={20} /></button>
                </div>
                <nav className="flex-1 p-4 space-y-2">
                    {currentUserRole !== 'fine_inputter' && (
                        <button onClick={() => { setView('DASHBOARD'); setIsSidebarOpen(false); }} className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl transition-all ${view === 'DASHBOARD' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : 'hover:bg-sidebarHover text-slate-400 hover:text-slate-200'}`}><LayoutDashboard size={20} />儀表板</button>
                    )}
                    {(currentUserRole === 'admin' || currentUserRole === 'user' || currentUserRole === 'fine_inputter') && (
                        <button onClick={() => { setView('FINE_STATS'); setIsSidebarOpen(false); }} className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl transition-all ${view === 'FINE_STATS' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : 'hover:bg-sidebarHover text-slate-400 hover:text-slate-200'}`}><DollarSign size={20} />罰款統計</button>
                    )}
                    {(currentUserRole === 'admin' || currentUserRole === 'user') && (
                        <>
                            <button onClick={() => { setView('VIOLATIONS'); setIsSidebarOpen(false); }} className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl transition-all ${view === 'VIOLATIONS' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : 'hover:bg-sidebarHover text-slate-400 hover:text-slate-200'}`}><FileWarning size={20} />違規紀錄</button>
                            <button onClick={() => { setView('PERSONNEL'); setIsSidebarOpen(false); }} className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl transition-all ${view === 'PERSONNEL' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : 'hover:bg-sidebarHover text-slate-400 hover:text-slate-200'}`}><Users size={20} />人員管理</button>
                            <button onClick={() => { setView('PROJECTS'); setIsSidebarOpen(false); }} className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl transition-all ${view === 'PROJECTS' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : 'hover:bg-sidebarHover text-slate-400 hover:text-slate-200'}`}><Briefcase size={20} />工程管理</button>
                        </>
                    )}
                    {currentUserRole === 'admin' && <button onClick={() => { setView('USERS'); setIsSidebarOpen(false); }} className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl transition-all ${view === 'USERS' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : 'hover:bg-sidebarHover text-slate-400 hover:text-slate-200'}`}><Users size={20} />帳號管理</button>}
                </nav>
                <div className="p-4 border-t border-white/5">
                    <button onClick={handleLogout} className="flex items-center gap-2 px-4 py-3 text-sm text-slate-400 hover:text-white hover:bg-sidebarHover rounded-xl w-full transition-all"><LogOut size={16} />登出系統</button>
                </div>
            </aside>

            <main className="flex-1 md:ml-64 p-4 md:p-8 overflow-y-auto relative min-h-screen transition-all w-full bg-[#F3F4F6] dark:bg-[#1A2234]">
                <header className="flex justify-between items-center mb-6 md:mb-8">
                    <div className="flex items-center gap-3">
                        <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-slate-600 dark:text-slate-300 md:hidden"><Menu size={24} /></button>
                        <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white">
                            {view === 'DASHBOARD' && '系統總覽'}
                            {view === 'VIOLATIONS' && '違規講習紀錄'}
                            {view === 'PROJECTS' && '工程專案管理'}
                            {view === 'USERS' && '帳號管理'}
                            {view === 'FINE_STATS' && '罰款統計暨違規講習'}
                            {view === 'PERSONNEL' && '開單人員管理'}
                        </h1>
                    </div>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setIsDarkMode(!isDarkMode)}
                            className="p-2 rounded-xl bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-300 shadow-sm border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                        >
                            {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
                        </button>
                    </div>
                </header>

                {view === 'DASHBOARD' && <Dashboard role={currentUserRole} violations={violations} projects={projects} fines={fines} />}
                {view === 'VIOLATIONS' && <ViolationList
                    violations={violations}
                    projects={projects}
                    fines={fines}
                    hostTeams={HOST_TEAMS}
                    isLoading={isLoading}
                    onAdd={() => { setEditingViolation(null); setViolationModalOpen(true); }}
                    onEdit={(v) => { setEditingViolation(v); setViolationModalOpen(true); }}
                    onDelete={handleDeleteViolation}
                    onGenerateDoc={handleGenerateDocument}
                    onUploadScan={handleUploadScanFile}
                    onEmail={(v) => openEmailModal(v)}
                />}
                {view === 'FINE_STATS' && <FineStats projects={projects} fines={fines} fineList={fineList} sections={sections} onSaveFines={setFines} onSaveSections={setSections} onSaveProjects={setProjects} onSaveViolation={handleSaveViolation} violations={violations} role={currentUserRole} />}
                {view === 'PROJECTS' && renderProjects()}
                {view === 'USERS' && renderUserManagement()}
                {view === 'PERSONNEL' && <PersonnelManagement sections={sections} onSaveSections={setSections} syncService={syncData} />}
            </main>

            <ViolationModal isOpen={isViolationModalOpen} onClose={() => setViolationModalOpen(false)} onSave={handleSaveViolation} projects={projects} initialData={editingViolation} fines={fines} />
            <EmailPreview isOpen={emailState.isOpen} onClose={() => setEmailState({ isOpen: false, violation: null })} onSend={handleEmailSent} violation={emailState.violation as Violation} coordinator={emailState.violation ? getCoordinatorForProject(emailState.violation.projectName) : undefined} currentUserEmail={currentUserEmail} />
            <LoadingModal isOpen={isLoading} message="處理中..." />
        </div>
    );
}

export default App;