import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: number | string;
  icon: LucideIcon;
  colorClass: string;
  trend?: string;
}

export const StatCard: React.FC<StatCardProps> = ({ title, value, icon: Icon, colorClass, trend }) => {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-100 flex items-start justify-between transition-transform hover:scale-[1.02]">
      <div>
        <p className="text-sm font-medium text-slate-500 mb-1">{title}</p>
        <h3 className="text-2xl font-bold text-slate-800">{value}</h3>
        {trend && <p className="text-xs text-slate-400 mt-2">{trend}</p>}
      </div>
      <div className={`p-3 rounded-lg ${colorClass}`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
    </div>
  );
};