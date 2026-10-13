/**
 * OneHR Payroll Manager - Main Application Sidebar
 * Premium finance dark aesthetic with clear module navigation
 */

import React from 'react';
import {
  LayoutDashboard,
  Users,
  CalendarCheck,
  PlayCircle,
  FileCheck2,
  Receipt,
  FileSpreadsheet,
  Settings,
  ShieldCheck,
  Database,
  History,
  Sparkles
} from 'lucide-react';

export type NavModule =
  | 'dashboard'
  | 'employees'
  | 'attendance'
  | 'processing'
  | 'results'
  | 'salary-slips'
  | 'reports'
  | 'settings'
  | 'ai-review'
  | 'audit';

interface Props {
  currentModule: NavModule;
  onSelectModule: (module: NavModule) => void;
  staffCount?: number;
  payrollStatus?: string;
  showAudit?: boolean;
}

export const Sidebar: React.FC<Props> = ({
  currentModule,
  onSelectModule,
  staffCount = 5,
  payrollStatus = 'PROCESSED',
  showAudit = false
}) => {
  const navItems = [
    { id: 'dashboard' as NavModule, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'employees' as NavModule, label: 'Employees', icon: Users, badge: staffCount },
    { id: 'attendance' as NavModule, label: 'Attendance', icon: CalendarCheck },
    { id: 'processing' as NavModule, label: 'Payroll Processing', icon: PlayCircle },
    { id: 'results' as NavModule, label: 'Payroll Results', icon: FileCheck2, badge: payrollStatus },
    { id: 'ai-review' as NavModule, label: 'AI Review', icon: Sparkles },
    { id: 'salary-slips' as NavModule, label: 'Salary Slips', icon: Receipt },
    { id: 'reports' as NavModule, label: 'Reports & Downloads', icon: FileSpreadsheet },
    { id: 'settings' as NavModule, label: 'Settings', icon: Settings },
    ...(showAudit ? [{ id: 'audit' as NavModule, label: 'Audit Trail', icon: History, badge: undefined as number | string | undefined }] : []),
  ];

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0 select-none z-20">
      
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-white shadow-md shadow-emerald-900/40">
            <ShieldCheck className="w-5 h-5 text-slate-950 font-bold stroke-[2.5]" />
          </div>
          <div>
            <h1 className="font-extrabold text-slate-100 text-base tracking-tight leading-tight">
              OneHR
            </h1>
            <p className="text-[11px] text-emerald-400 font-semibold tracking-wide">
              Payroll Manager
            </p>
          </div>
        </div>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = currentModule === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectModule(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-all group ${
                isActive
                  ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-950/40'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon
                  className={`w-4 h-4 transition-colors ${
                    isActive ? 'text-white' : 'text-slate-400 group-hover:text-emerald-400'
                  }`}
                />
                <span>{item.label}</span>
              </div>

              {item.badge !== undefined && (
                <span
                  className={`px-2 py-0.5 text-[10px] rounded-full font-bold uppercase tracking-wider ${
                    isActive
                      ? 'bg-emerald-800 text-emerald-100'
                      : item.badge === 'LOCKED'
                      ? 'bg-rose-950 text-rose-300 border border-rose-800/50'
                      : item.badge === 'PROCESSED'
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/50'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Local Offline & SQLite Indicator */}
      <div className="p-4 m-3 bg-slate-950/70 border border-slate-800 rounded-xl space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-[11px] font-semibold text-slate-200">Engine Active</span>
          </div>
          <span className="text-[10px] text-emerald-400 font-mono font-bold bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-800/40">
            SQLITE
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
          <Database className="w-3 h-3 text-slate-400" />
          <span>Embedded SQLite 3</span>
        </div>
        <div className="text-[10px] text-slate-500 border-t border-slate-800/60 pt-1.5">
          FY 2026-27 Statutory Rules
        </div>
      </div>

    </aside>
  );
};
