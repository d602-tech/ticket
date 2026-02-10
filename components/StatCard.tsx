import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: number | string;
  icon: LucideIcon;
  colorClass: string;
  trend?: string;
  isCurrency?: boolean;
}

export const StatCard: React.FC<StatCardProps> = ({ title, value, icon: Icon, colorClass, trend, isCurrency }) => {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-5 border border-slate-100/80 flex items-start justify-between transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 group">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">{title}</p>
        <h3 className={`text-2xl font-bold tracking-tight ${isCurrency ? 'text-indigo-600 font-mono' : 'text-slate-800'}`}>{value}</h3>
        {trend && <p className="text-xs text-slate-400 mt-2">{trend}</p>}
      </div>
      <div className={`p-2.5 rounded-xl ${colorClass} shadow-lg shadow-current/20 transition-transform group-hover:scale-110`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
    </div>
  );
};