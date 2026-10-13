/**
 * OneHR Payroll Manager - Application Header
 */

import React from 'react';
import { Calendar, Building2, CheckCircle2, Lock, ShieldCheck, RefreshCw, TestTube2, LogOut } from 'lucide-react';
import { Company, PayrollRun } from '../../types/payroll';
import { formatPayrollMonth } from '../../utils/indianNumber';

interface Props {
  currentMonth: string;
  onMonthChange: (month: string) => void;
  company: Company | null;
  currentRun: PayrollRun | null;
  onRefresh: () => void;
  onOpenTestsModal: () => void;
  user?: { display_name: string; role: string } | null;
  onLogout?: () => void;
}

// Financial year 2026-27: April 2026 to March 2027
export const AVAILABLE_MONTHS: string[] = [];
for (let y = 2026, m = 4; y < 2027 || m <= 3; m === 12 ? (y++, m = 1) : m++) {
  AVAILABLE_MONTHS.push(`${y}-${String(m).padStart(2, '0')}`);
}

export const Header: React.FC<Props> = ({
  currentMonth,
  onMonthChange,
  company,
  currentRun,
  onRefresh,
  onOpenTestsModal,
  user,
  onLogout
}) => {
  const status = currentRun?.status || 'READY';

  const getStatusBadge = () => {
    switch (status) {
      case 'LOCKED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">
            <Lock className="w-3.5 h-3.5" />
            LOCKED
          </span>
        );
      case 'PROCESSED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5" />
            PROCESSED
          </span>
        );
      case 'REVIEWED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
            <ShieldCheck className="w-3.5 h-3.5" />
            REVIEWED
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
            {status}
          </span>
        );
    }
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between z-10 shrink-0">
      
      {/* Left: Company & Organization */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700">
            <Building2 className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 leading-tight">
              {company?.name || 'Demo Industries Private Limited'}
            </h2>
            <div className="text-[11px] text-slate-500 font-medium">
              GSTIN: {company?.gstin || '29AABCC1234D1Z5'} • TAN: {company?.tan || 'BLRC12345E'}
            </div>
          </div>
        </div>
      </div>

      {/* Right: Month Selector, Run Status, Test Suite trigger */}
      <div className="flex items-center gap-3">
        
        {/* Payroll Month Picker */}
        <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
          <Calendar className="w-4 h-4 text-slate-500 mr-2 shrink-0" />
          <span className="text-xs text-slate-500 font-medium mr-2">Payroll Month:</span>
          <select
            value={currentMonth}
            onChange={e => onMonthChange(e.target.value)}
            className="bg-transparent text-xs font-bold text-slate-900 focus:outline-hidden cursor-pointer"
          >
            {AVAILABLE_MONTHS.map(m => (
              <option key={m} value={m}>
                {formatPayrollMonth(m)}
              </option>
            ))}
          </select>
        </div>

        {/* Status Badge */}
        {getStatusBadge()}

        {/* Database Status Badge */}
        <span
          className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200"
          title="Engine: Native SQLite (better-sqlite3) | Journal: WAL"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
          SQLite WAL
        </span>

        {/* Run Tests Button */}
        <button
          onClick={onOpenTestsModal}
          title="Run Statutory Calculation Unit Tests"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition border border-slate-200"
        >
          <TestTube2 className="w-3.5 h-3.5 text-indigo-600" />
          <span>Verify Engine</span>
        </button>

        {/* Refresh */}
        <button
          onClick={onRefresh}
          title="Reload Data"
          className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition border border-slate-200"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>

        {/* Signed-in user */}
        {user && (
          <div className="flex items-center gap-2 pl-3 border-l border-slate-200">
            <div className="text-right leading-tight">
              <div className="text-xs font-bold text-slate-900">{user.display_name}</div>
              <div className="text-[10px] font-semibold text-emerald-700 uppercase tracking-wider">{user.role}</div>
            </div>
            <button
              onClick={onLogout}
              title="Sign out"
              className="p-2 text-slate-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition border border-slate-200"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

      </div>

    </header>
  );
};
