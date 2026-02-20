import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  colorClass: string;
  isCurrency?: boolean;
}

export const StatCard: React.FC<StatCardProps> = ({ title, value, icon: Icon, colorClass, isCurrency = false }) => {
  // Extract the base color name (e.g., 'bg-indigo-500' -> 'indigo') to use in other classes
  const colorName = colorClass.split('-')[1];

  return (
    <div className={`relative overflow-hidden bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_30px_-4px_rgba(0,0,0,0.1)] transition-all duration-300 hover:scale-[1.02] group`}>
      {/* Decorative Background Icon */}
      <div className={`absolute -right-4 -top-4 opacity-[0.03] dark:opacity-[0.1] group-hover:opacity-[0.08] dark:group-hover:opacity-[0.15] transition-opacity duration-500 rotate-12`}>
        <Icon size={120} className={colorClass.replace('bg-', 'text-')} />
      </div>

      <div className="relative z-10 flex flex-col h-full justify-between">
        <div className="flex justify-between items-start mb-4">
          <div className={`p-3 rounded-xl ${colorClass} bg-opacity-10 dark:bg-opacity-20 text-${colorName}-600 dark:text-${colorName}-400 group-hover:bg-opacity-20 transition-all shadow-sm`}>
            {/* Note: colorClass passed in is usually `bg-color-500`. We need text color.
                Since we can't easily parse without a map or clsx, I'll rely on the icon receiving the color class text replacement or generic.
                Actually my previous code used: `colorClass.replace('bg-', 'text-')`. I will keep that pattern.
            */}
            <Icon className={`w-6 h-6 ${colorClass.replace('bg-', 'text-')}`} />
          </div>
          {isCurrency && (
            <span className="text-[10px] font-bold tracking-wider text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-700/50 border border-slate-100 dark:border-slate-600 px-2 py-1 rounded-full uppercase">
              TWD
            </span>
          )}
        </div>

        <div className="space-y-1">
          <h3 className="text-slate-400 dark:text-slate-500 text-xs font-semibold tracking-wider uppercase mb-1">{title}</h3>
          <p className="text-3xl font-extrabold text-slate-800 dark:text-white tracking-tight">
            {value}
          </p>
        </div>
      </div>
    </div>
  );
};