/**
 * OneHR Payroll Manager - Payroll Processing Workflow Engine
 */

import React, { useState } from 'react';
import {
  PlayCircle,
  RefreshCw,
  Lock,
  Unlock,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Calendar,
  Layers,
  ArrowRight,
  Calculator,
  FileCheck2,
  Info
} from 'lucide-react';
import { PayrollRecord, PayrollRun, PayrollRunStatus } from '../types/payroll';
import { formatIndianCurrency, formatPayrollMonth, getDaysInPayrollMonth } from '../utils/indianNumber';
import { api } from '../services/api';
import { NavModule } from '../components/layout/Sidebar';

interface Props {
  currentMonth: string;
  run: PayrollRun | null;
  records: PayrollRecord[];
  attendanceList: any[];
  onRefresh: () => void;
  onNavigate: (module: NavModule) => void;
}

export const PayrollProcessingView: React.FC<Props> = ({
  currentMonth,
  run,
  records,
  attendanceList,
  onRefresh,
  onNavigate
}) => {
  const [processing, setProcessing] = useState(false);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);

  const daysInMonth = getDaysInPayrollMonth(currentMonth);
  const isLocked = run?.status === 'LOCKED';
  const isProcessed = run?.status === 'PROCESSED' || run?.status === 'REVIEWED' || isLocked;

  // Validation checks
  const totalEmployees = attendanceList.length;
  const completedAttendance = attendanceList.filter(a => a.has_record !== false && a.days_payable > 0).length;
  const attendanceCompletionPct = totalEmployees > 0 ? Math.round((completedAttendance / totalEmployees) * 100) : 100;

  const handleValidateAttendance = () => {
    if (completedAttendance < totalEmployees) {
      setValidationMessage(`Warning: attendance is pending or shows 0 payable days for ${totalEmployees - completedAttendance} employee(s). Upload or mark attendance before processing.`);
    } else {
      setValidationMessage(`✓ Attendance validated! All ${totalEmployees} employees have active attendance data.`);
    }
  };

  const handleProcessPayroll = async () => {
    if (isLocked) {
      alert('Payroll is locked. Please unlock first before reprocessing.');
      return;
    }

    setProcessing(true);
    setValidationMessage(null);
    try {
      const res = await api.processPayroll(currentMonth);
      onRefresh();
      setValidationMessage(`✓ Success! Processed ${res.count} employees for ${formatPayrollMonth(currentMonth)}. Overwrote previous payroll records cleanly.`);
    } catch (err: any) {
      alert(`Processing error: ${err.message}`);
    } finally {
      setProcessing(false);
    }
  };

  const handleLockPayroll = async () => {
    if (confirm(`Lock payroll for ${formatPayrollMonth(currentMonth)}? Once locked, attendance and salary slips cannot be altered without unlocking.`)) {
      try {
        await api.lockPayroll(currentMonth);
        onRefresh();
      } catch (err: any) {
        alert(err.message);
      }
    }
  };

  const handleUnlockPayroll = async () => {
    const reason = prompt(`Unlock payroll for ${formatPayrollMonth(currentMonth)}? This allows adjustments and reprocessing.\n\nEnter the reason (recorded in the audit trail):`);
    if (reason && reason.trim().length >= 5) {
      try {
        await api.unlockPayroll(currentMonth, reason.trim());
        onRefresh();
      } catch (err: any) {
        alert(err.message);
      }
    }
  };

  const handleSetStatus = async (status: PayrollRunStatus) => {
    try {
      await api.setPayrollStatus(currentMonth, status);
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200/90 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900">
              Payroll Processing Engine • {formatPayrollMonth(currentMonth)}
            </h2>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
              isLocked
                ? 'bg-rose-100 text-rose-800 border border-rose-200'
                : isProcessed
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                : 'bg-amber-100 text-amber-800 border border-amber-200'
            }`}>
              {run?.status || 'READY'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Step-by-step statutory execution: Attendance → Validation → Deterministic Engine → Review → Final Lock
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {isLocked ? (
            <button
              onClick={handleUnlockPayroll}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg text-xs font-semibold border border-amber-300 transition"
            >
              <Unlock className="w-3.5 h-3.5" />
              <span>Unlock Payroll</span>
            </button>
          ) : (
            <button
              onClick={handleLockPayroll}
              disabled={!isProcessed}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold border border-slate-200 transition disabled:opacity-50"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Lock Payroll</span>
            </button>
          )}

          <button
            onClick={handleProcessPayroll}
            disabled={processing || isLocked}
            className="inline-flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition disabled:opacity-50 cursor-pointer"
          >
            <PlayCircle className="w-4 h-4" />
            <span>{processing ? 'Processing Engine Running...' : isProcessed ? 'Reprocess Payroll' : 'Process Payroll'}</span>
          </button>
        </div>
      </div>

      {/* Workflow Stepper */}
      <div className="bg-white p-6 rounded-xl border border-slate-200/90 shadow-xs">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">
          Statutory Processing Steps
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          
          {/* Step 1: Attendance */}
          <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/40 relative">
            <div className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-bold flex items-center justify-center mb-2">
              1
            </div>
            <h4 className="font-bold text-slate-900 text-sm">Attendance Grid</h4>
            <p className="text-xs text-slate-600 mt-1">
              Monthly grid completion: <strong className="text-emerald-800">{attendanceCompletionPct}%</strong>
            </p>
            <div className="mt-3">
              <button
                onClick={() => onNavigate('attendance')}
                className="text-xs text-emerald-700 hover:text-emerald-800 font-semibold flex items-center gap-1"
              >
                <span>Edit Attendance</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Step 2: Validation */}
          <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/40 relative">
            <div className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center mb-2">
              2
            </div>
            <h4 className="font-bold text-slate-900 text-sm">Data Validation</h4>
            <p className="text-xs text-slate-600 mt-1">
              Check unverified zero payables, salary rules, & PT slabs.
            </p>
            <div className="mt-3">
              <button
                onClick={handleValidateAttendance}
                className="text-xs text-blue-700 hover:text-blue-800 font-semibold flex items-center gap-1"
              >
                <span>Run Validation Check</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Step 3: Engine Execution */}
          <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/40 relative">
            <div className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center mb-2">
              3
            </div>
            <h4 className="font-bold text-slate-900 text-sm">Engine Execution</h4>
            <p className="text-xs text-slate-600 mt-1">
              Deterministic calculations for PF, ESIC, PT, TDS & CTC.
            </p>
            <div className="mt-3">
              <button
                onClick={handleProcessPayroll}
                disabled={isLocked || processing}
                className="text-xs text-indigo-700 hover:text-indigo-800 font-semibold flex items-center gap-1 disabled:opacity-50"
              >
                <span>{isProcessed ? 'Recompute All' : 'Run Engine'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Step 4: Lock / Disburse */}
          <div className={`p-4 rounded-xl border relative ${isLocked ? 'border-rose-200 bg-rose-50/40' : 'border-slate-200 bg-slate-50'}`}>
            <div className={`w-6 h-6 rounded-full text-white text-xs font-bold flex items-center justify-center mb-2 ${isLocked ? 'bg-rose-600' : 'bg-slate-400'}`}>
              4
            </div>
            <h4 className="font-bold text-slate-900 text-sm">Finalize & Lock</h4>
            <p className="text-xs text-slate-600 mt-1">
              {isLocked ? 'Locked by Finance Lead' : 'Lock to prevent unintended modifications'}
            </p>
            <div className="mt-3">
              <span className="text-xs font-semibold text-slate-600">
                {isLocked ? 'Status: LOCKED' : 'Status: READY TO LOCK'}
              </span>
            </div>
          </div>

        </div>

        {/* Validation message feedback */}
        {validationMessage && (
          <div className="mt-4 p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 flex items-center gap-2">
            <Info className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{validationMessage}</span>
          </div>
        )}

      </div>

      {/* Pre-computation Run Parameters Box */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Run Parameters Card */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-xs space-y-3">
          <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <Calendar className="w-4 h-4 text-emerald-600" />
            <span>Cycle Specifications</span>
          </h4>
          <div className="divide-y divide-slate-100 text-xs">
            <div className="py-2 flex justify-between">
              <span className="text-slate-500">Payroll Month:</span>
              <span className="font-semibold text-slate-800">{formatPayrollMonth(currentMonth)}</span>
            </div>
            <div className="py-2 flex justify-between">
              <span className="text-slate-500">Calendar Days:</span>
              <span className="font-semibold text-slate-800">{daysInMonth} Days</span>
            </div>
            <div className="py-2 flex justify-between">
              <span className="text-slate-500">Working Days:</span>
              <span className="font-semibold text-slate-800">{daysInMonth - 8} Days (Approx)</span>
            </div>
            <div className="py-2 flex justify-between">
              <span className="text-slate-500">Employees on Roll:</span>
              <span className="font-semibold text-slate-800">{totalEmployees} Active</span>
            </div>
            <div className="py-2 flex justify-between">
              <span className="text-slate-500">Payroll Run Key:</span>
              <span className="font-mono text-slate-700">EMP_ID + {currentMonth}</span>
            </div>
          </div>
        </div>

        {/* Statutory Engine Rules Card */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-xs space-y-3">
          <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-blue-600" />
            <span>Statutory Rules Applied</span>
          </h4>
          <div className="divide-y divide-slate-100 text-xs">
            <div className="py-2 flex justify-between">
              <span className="text-slate-500">50% Wage Rule:</span>
              <span className="font-semibold text-emerald-700">ACTIVE (Basic+DA ≥ 50%)</span>
            </div>
            <div className="py-2 flex justify-between">
              <span className="text-slate-500">EPF Ceiling:</span>
              <span className="font-semibold text-slate-800">₹15,000 / month</span>
            </div>
            <div className="py-2 flex justify-between">
              <span className="text-slate-500">EPS Cap (8.33%):</span>
              <span className="font-semibold text-slate-800">₹1,250 / month</span>
            </div>
            <div className="py-2 flex justify-between">
              <span className="text-slate-500">ESIC Eligibility Ceiling:</span>
              <span className="font-semibold text-slate-800">₹21,000 / month</span>
            </div>
            <div className="py-2 flex justify-between">
              <span className="text-slate-500">TDS Regime:</span>
              <span className="font-semibold text-indigo-700">Tax Year 2026-27 (new regime nil ≤ 12L)</span>
            </div>
          </div>
        </div>

        {/* Processed Summary Card */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Calculator className="w-4 h-4 text-purple-600" />
              <span>Processed Financials</span>
            </h4>
            <button
              onClick={() => onNavigate('results')}
              className="text-xs text-emerald-600 font-semibold hover:underline"
            >
              View Results
            </button>
          </div>
          <div className="divide-y divide-slate-100 text-xs">
            <div className="py-2 flex justify-between">
              <span className="text-slate-500">Gross Payroll:</span>
              <span className="font-bold text-slate-900">{formatIndianCurrency(run?.total_gross_payroll || 0)}</span>
            </div>
            <div className="py-2 flex justify-between">
              <span className="text-slate-500">Total Deductions:</span>
              <span className="font-semibold text-rose-600">- {formatIndianCurrency(run?.total_deductions || 0)}</span>
            </div>
            <div className="py-2 flex justify-between">
              <span className="text-slate-500">Take Home Payable:</span>
              <span className="font-bold text-emerald-700">{formatIndianCurrency(run?.total_take_home || 0)}</span>
            </div>
            <div className="py-2 flex justify-between">
              <span className="text-slate-500">Company Cost (CTC):</span>
              <span className="font-bold text-purple-700">{formatIndianCurrency(run?.total_company_cost || 0)}</span>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
};
