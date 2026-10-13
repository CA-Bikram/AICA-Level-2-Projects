/**
 * OneHR Payroll Manager - Reports & Downloads View
 * Local multi-sheet Excel generation and bank transfer advice
 */

import React from 'react';
import {
  FileSpreadsheet,
  Download,
  Building,
  CreditCard,
  ShieldCheck,
  CalendarCheck,
  CheckCircle2,
  FileText
} from 'lucide-react';
import { Company, PayrollRecord, PayrollRun } from '../types/payroll';
import { formatIndianCurrency, formatPayrollMonth } from '../utils/indianNumber';
import { exportBankAdviceExcel, exportPayrollWorkbook } from '../utils/excelExport';

interface Props {
  currentMonth: string;
  run: PayrollRun | null;
  records: PayrollRecord[];
  company: Company | null;
  attendanceList: any[];
}

export const ReportsView: React.FC<Props> = ({
  currentMonth,
  run,
  records,
  company,
  attendanceList
}) => {
  const handleExportFullWorkbook = () => {
    exportPayrollWorkbook(currentMonth, records, run, company, attendanceList);
  };

  const handleExportBankAdvice = () => {
    exportBankAdviceExcel(currentMonth, records, company);
  };

  const totalTakeHome = records.reduce((acc, r) => acc + r.take_home_pay, 0);
  const totalGross = records.reduce((acc, r) => acc + r.gross_earned, 0);
  const totalDeductions = records.reduce((acc, r) => acc + r.total_deductions, 0);

  return (
    <div className="space-y-6">
      
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200/90 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900">
              Statutory Reports & Downloads • {formatPayrollMonth(currentMonth)}
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
              Local Excel Engine
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Generates compliant multi-sheet workbooks locally without external dependencies or online services
          </p>
        </div>

        <button
          onClick={handleExportFullWorkbook}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 transition cursor-pointer"
        >
          <Download className="w-4 h-4" />
          <span>Download Master Excel Workbook</span>
        </button>
      </div>

      {/* Report Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Report 1: Full Payroll Register */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs hover:shadow-md transition space-y-4">
          <div className="flex items-start justify-between">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-bold rounded">
              .XLSX FORMAT
            </span>
          </div>

          <div>
            <h3 className="font-bold text-slate-900 text-base">Full Master Payroll Register</h3>
            <p className="text-xs text-slate-500 mt-1">
              Comprehensive audit register containing employee identifiers, PAN, UAN, fixed vs earned basic/DA/HRA, overtime, bonus, PF, ESIC, PT, TDS, net salary, and employer CTC.
            </p>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg text-xs space-y-1.5 text-slate-600">
            <div className="flex justify-between">
              <span>Included Staff:</span>
              <strong className="text-slate-900">{records.length} Employees</strong>
            </div>
            <div className="flex justify-between">
              <span>Gross Disbursed:</span>
              <strong className="text-slate-900">{formatIndianCurrency(totalGross)}</strong>
            </div>
            <div className="flex justify-between">
              <span>Formulas & Borders:</span>
              <strong className="text-emerald-700">Pre-formatted SheetJS</strong>
            </div>
          </div>

          <button
            onClick={handleExportFullWorkbook}
            className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition"
          >
            <Download className="w-4 h-4" />
            <span>Generate & Download Register</span>
          </button>
        </div>

        {/* Report 2: Bank Salary Transfer Advice */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs hover:shadow-md transition space-y-4">
          <div className="flex items-start justify-between">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
              <CreditCard className="w-6 h-6" />
            </div>
            <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-bold rounded border border-blue-200">
              NEFT / RTGS
            </span>
          </div>

          <div>
            <h3 className="font-bold text-slate-900 text-base">Bank Transfer Advice / NEFT Batch</h3>
            <p className="text-xs text-slate-500 mt-1">
              Bank upload schedule with beneficiary employee name, bank account number, IFSC code, and exact net payable amount for batch salary disbursement.
            </p>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg text-xs space-y-1.5 text-slate-600">
            <div className="flex justify-between">
              <span>Beneficiary Count:</span>
              <strong className="text-slate-900">{records.length} Beneficiaries</strong>
            </div>
            <div className="flex justify-between">
              <span>Total Direct Credit:</span>
              <strong className="text-blue-700">{formatIndianCurrency(totalTakeHome)}</strong>
            </div>
            <div className="flex justify-between">
              <span>Debit Account:</span>
              <strong className="text-slate-800 font-mono">98765432109876 (HDFC)</strong>
            </div>
          </div>

          <button
            onClick={handleExportBankAdvice}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition"
          >
            <Download className="w-4 h-4" />
            <span>Download Bank Advice File</span>
          </button>
        </div>

      </div>

      {/* Multi-Sheet Workbook Specification Breakdown */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
        <h3 className="font-bold text-slate-900 text-sm">Sheets Included in Master Workbook</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
          
          <div className="p-4 border border-slate-200 rounded-xl space-y-2">
            <div className="font-bold text-slate-900 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Sheet 1: Payroll Register</span>
            </div>
            <p className="text-slate-500 text-[11px]">
              Full employee audit register, fixed vs earned basic/DA/HRA, pro-rata factors, deductions & grand totals.
            </p>
          </div>

          <div className="p-4 border border-slate-200 rounded-xl space-y-2">
            <div className="font-bold text-slate-900 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-blue-600" />
              <span>Sheet 2: Deductions</span>
            </div>
            <p className="text-slate-500 text-[11px]">
              Itemized EPF 12%, ESIC 0.75%, Professional Tax (PT), and TDS/IT with PAN matching.
            </p>
          </div>

          <div className="p-4 border border-slate-200 rounded-xl space-y-2">
            <div className="font-bold text-slate-900 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-purple-600" />
              <span>Sheet 3: Summary</span>
            </div>
            <p className="text-slate-500 text-[11px]">
              Executive financial totals for Finance and Auditors: Gross, Deductions, Remittances & CTC.
            </p>
          </div>

          <div className="p-4 border border-slate-200 rounded-xl space-y-2">
            <div className="font-bold text-slate-900 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-amber-600" />
              <span>Sheet 4: Attendance</span>
            </div>
            <p className="text-slate-500 text-[11px]">
              Staff monthly breakdown of present days, weekly offs, holidays, leaves, LOP, OT & Bonus.
            </p>
          </div>

        </div>
      </div>

    </div>
  );
};
