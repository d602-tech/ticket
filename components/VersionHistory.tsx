import React from 'react';
import { History, Tag } from 'lucide-react';

interface Version {
    version: string;
    date: string;
    features: string[];
}

const versions: Version[] = [
    {
        version: 'v1.5',
        date: '2026-02-17',
        features: [
            '新增專案契約編號顯示及工作隊圖示區分',
            '優化 Excel 匯入/匯出標題為繁體中文',
            '系統總覽承攬商罰款佔比直接顯示總金額'
        ]
    },
    {
        version: 'v1.4',
        date: '2026-02-16',
        features: [
            '新增「累積罰款總金額」統計於首頁',
            '「違規紀錄」更名為「違規講習紀錄」',
            '「人員管理」獨立為專屬頁面',
            '新增「一鍵轉換違規紀錄」功能 (罰款>1萬元自動提示)'
        ]
    },
    {
        version: 'v1.3',
        date: '2026-02-16',
        features: [
            '新增 Excel 匯入/匯出功能',
            '修正罰單編輯與刪除邏輯',
            '優化統計圖表顯示 (使用工程簡稱)'
        ]
    },
    {
        version: 'v1.2',
        date: '2026-02-15',
        features: [
            '新增開單人員管理功能',
            '修正罰單金額計算邏輯',
            '新增單價修改原因與關係欄位'
        ]
    },
    {
        version: 'v1.1',
        date: '2026-02-14',
        features: [
            '整合 Google Sheets 進行資料同步',
            '新增罰款統計圖表 (依月份、工程、工作隊)'
        ]
    },
    {
        version: 'v1.0',
        date: '2026-02-01',
        features: [
            '系統上線',
            '基礎罰單輸入與管理功能',
            '違規紀錄管理'
        ]
    }
];

export function VersionHistory() {
    return (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100/80 mt-6">
            <h3 className="text-lg font-bold text-slate-700 mb-4 flex items-center gap-2">
                <History className="text-indigo-500" size={20} />
                系統更新履歷
            </h3>
            <div className="space-y-6">
                {versions.map((ver, idx) => (
                    <div key={idx} className="relative pl-6 border-l-2 border-indigo-100 last:border-0 pb-2">
                        <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-indigo-50 border-2 border-indigo-400"></div>
                        <div className="flex items-center gap-3 mb-1">
                            <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-bold rounded-full">
                                {ver.version}
                            </span>
                            <span className="text-slate-400 text-xs flex items-center gap-1">
                                <ClockIcon size={12} /> {ver.date}
                            </span>
                        </div>
                        <ul className="space-y-1 mt-2">
                            {ver.features.map((feat, fIdx) => (
                                <li key={fIdx} className="text-sm text-slate-600 flex items-start gap-2">
                                    <Tag size={14} className="mt-0.5 text-slate-400 flex-shrink-0" />
                                    {feat}
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>
        </div>
    );
}

function ClockIcon({ size }: { size: number }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
        </svg>
    );
}
