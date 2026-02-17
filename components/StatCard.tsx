import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  colorClass: string;
  isCurrency?: boolean;
}

export const StatCard: React.FC<StatCardProps> = ({ title, value, icon: Icon, colorClass, isCurrency = false }) => (
  <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 hover:shadow-md transition-all group">
    <div className="flex justify-between items-start mb-4">
      <div className={`p-3 rounded-lg ${colorClass} bg-opacity-10 group-hover:bg-opacity-20 transition-all`}>
        <Icon className={`w-6 h-6 ${colorClass.replace('bg-', 'text-')}`} />
      </div>
      {isCurrency && <span className="text-xs font-medium text-slate-400 bg-slate-50 px-2 py-1 rounded-full">TWD</span>}
    </div>
    <div className="space-y-1">
      <h3 className="text-slate-500 text-sm font-medium">{title}</h3>
      <p className="text-2xl font-bold text-slate-800 tracking-tight">{value}</p>
    </div>
  </div>
);