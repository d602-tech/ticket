import React, { useState, useMemo } from 'react';
import {
    Search, Filter, Briefcase, Plus, Mail, FileText, Upload, RefreshCw, Edit2, Trash2,
    FileWarning, Download, CheckCircle2, Clock
} from 'lucide-react';
import { Violation, Project, ViolationStatus } from '../types';
import { getDaysRemaining, formatDate, getStatusLabel } from '../utils';

interface ViolationListProps {
    violations: Violation[];
    projects: Project[];
    hostTeams: string[];
    isLoading: boolean;
    onAdd: () => void;
    onEdit: (v: Violation) => void;
    onDelete: (id: string) => void;
    onGenerateDoc: (v: Violation) => void;
    onUploadScan: (v: Violation, isReplace: boolean) => void;
    onEmail: (v: Violation) => void;
}

export const ViolationList: React.FC<ViolationListProps> = ({
    violations, projects, hostTeams, isLoading,
    onAdd, onEdit, onDelete, onGenerateDoc, onUploadScan, onEmail
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<ViolationStatus | 'ALL'>('ALL');
    const [hostTeamFilter, setHostTeamFilter] = useState<string>('ALL');

    const filteredViolations = useMemo(() => {
        return violations.filter(v => {
            const matchesSearch =
                v.contractorName?.includes(searchTerm) ||
                v.projectName?.includes(searchTerm) ||
                v.description?.includes(searchTerm);
            const matchesStatus = statusFilter === 'ALL' || v.status === statusFilter;

            let matchesTeam = true;
            if (hostTeamFilter !== 'ALL') {
                const project = projects.find(p => p.name === v.projectName);
                matchesTeam = project?.hostTeam === hostTeamFilter;
            }

            return matchesSearch && matchesStatus && matchesTeam;
        }).sort((a, b) => {
            // Sort by Date Descending
            return new Date(b.violationDate).getTime() - new Date(a.violationDate).getTime();
        });
    }, [violations, searchTerm, statusFilter, hostTeamFilter, projects]);

    return (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200/60 dark:border-slate-700/60 overflow-hidden">
            {/* Toolbar */}
            <div className="p-4 border-b border-slate-100 dark:border-slate-700/50 flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex flex-col md:flex-row items-center gap-3 w-full md:w-auto flex-1">
                    <div className="relative w-full md:w-64">
                        <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400 dark:text-slate-500" />
                        <input
                            type="text"
                            placeholder="搜尋承攬商或工程..."
                            className="w-full pl-9 pr-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-slate-500 outline-none bg-white dark:bg-slate-900 dark:text-slate-100"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3 w-full md:w-auto md:flex">
                        <div className="relative">
                            <Filter className="absolute left-3 top-2.5 w-4 h-4 text-slate-400 dark:text-slate-500" />
                            <select
                                className="w-full pl-9 pr-8 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-slate-500 outline-none appearance-none cursor-pointer"
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
                            <Briefcase className="absolute left-3 top-2.5 w-4 h-4 text-slate-400 dark:text-slate-500" />
                            <select
                                className="w-full pl-9 pr-8 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-slate-500 outline-none appearance-none cursor-pointer"
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
                    onClick={onAdd}
                    className="w-full md:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 dark:bg-indigo-600 hover:bg-slate-800 dark:hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors shadow-md shadow-slate-300 dark:shadow-none"
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
                                <div key={violation.id} className="p-4 hover:bg-slate-50/50 dark:hover:bg-slate-700/30 active:bg-slate-100 transition-colors">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex-1 mr-2">
                                            <h3 className="font-bold text-slate-900 dark:text-slate-100 mb-1 leading-snug">{violation.contractorName}</h3>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 leading-normal">{violation.projectName}</p>
                                        </div>
                                        <span className={`flex-shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${violation.status === ViolationStatus.COMPLETED ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' :
                                            violation.status === ViolationStatus.NOTIFIED ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400' :
                                                violation.status === ViolationStatus.SUBMITTED ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400' :
                                                    'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400'
                                            }`}>
                                            {getStatusLabel(violation.status)}
                                        </span>
                                    </div>

                                    <p className="text-sm text-slate-600 dark:text-slate-300 mb-3 line-clamp-2 bg-slate-50/80 dark:bg-slate-900/50 p-2.5 rounded-lg">
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
                                            onClick={() => onEmail(violation)}
                                            className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-lg"
                                        >
                                            <Mail size={18} />
                                        </button>
                                        <button
                                            onClick={() => onGenerateDoc(violation)}
                                            className={`p-2 rounded-lg ${violation.documentUrl ? 'text-green-600 bg-green-50' : 'text-slate-500 hover:bg-slate-100'}`}
                                        >
                                            <FileText size={18} />
                                        </button>
                                        <button
                                            onClick={() => violation.scanFileUrl ? window.open(violation.scanFileUrl, '_blank') : onUploadScan(violation, false)}
                                            className={`p-2 rounded-lg ${violation.scanFileUrl ? 'text-purple-600 bg-purple-50' : 'text-slate-500 hover:bg-slate-100'}`}
                                        >
                                            <Upload size={18} />
                                        </button>
                                        <button
                                            onClick={() => onEdit(violation)}
                                            className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-lg"
                                        >
                                            <Edit2 size={18} />
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
                                <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
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
                                                    onClick={() => onEmail(violation)}
                                                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 rounded-lg transition-all"
                                                    title="發送通知信"
                                                >
                                                    <Mail size={18} />
                                                </button>
                                                <button
                                                    onClick={() => onGenerateDoc(violation)}
                                                    className={`p-1.5 rounded-lg transition-all ${violation.documentUrl
                                                        ? 'text-green-600 bg-green-50 hover:bg-green-100'
                                                        : 'text-slate-400 hover:text-green-600 hover:bg-green-50'
                                                        }`}
                                                    title={violation.documentUrl ? '下載簽辦' : '生成簽辦'}
                                                >
                                                    <FileText size={18} />
                                                </button>
                                                <button
                                                    onClick={() => violation.scanFileUrl ? window.open(violation.scanFileUrl, '_blank') : onUploadScan(violation, false)}
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
                                                        onClick={() => onUploadScan(violation, true)}
                                                        className="p-1.5 text-orange-500 bg-orange-50 hover:bg-orange-100 rounded-lg transition-all"
                                                        title="替換掃描檔（需填寫原因）"
                                                    >
                                                        <RefreshCw size={18} />
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => onEdit(violation)}
                                                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 rounded-lg transition-all"
                                                    title="編輯詳細資料"
                                                >
                                                    <Edit2 size={18} />
                                                </button>
                                                <button
                                                    onClick={() => onDelete(violation.id)}
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
};
