/**
 * OneHR Payroll Manager - Payroll Results & Master Register View
 * Complete audit table with expandable breakdown & TDS calculation modal
 */

import React, { useState } from 'react';
import {
  FileCheck2,
  Search,
  Filter,
  Download,
  Receipt,
  Calculator,
  ChevronDown,
  ChevronUp,
  Info,
  ShieldCheck,
  Building2,
  Users
} from 'lucide-react';
import { Company, PayrollRecord, PayrollRun } from '../types/payroll';
import { formatIndianCurrency, formatPayrollMonth } from '../utils/indianNumber';
import { TDSCalculationModal } from '../components/modals/TDSCalculationModal';
import { exportPayrollWorkbook } from '../utils/excelExport';
import { NavModule } from '../components/layout/Sidebar';

interface Props {
  currentMonth: string;
  run: PayrollRun | null;
  records: PayrollRecord[];
  company: Company | null;
  attendanceList: any[];
  onNavigate: (module: NavModule) => void;
  onSelectEmployeeForSlip?: (empId: string) => void;
}

export const PayrollResultsView: React.FC<Props> = ({
  currentMonth,
  run,
  records,
  company,
  attendanceList,
  onNavigate,
  onSelectEmployeeForSlip
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [expandedEmpId, setExpandedEmpId] = useState<string | null>(null);
  const [selectedTdsRecord, setSelectedTdsRecord] = useState<PayrollRecord | null>(null);

  // Departments for filter
  const departments = Array.from(new Set(records.map(r => r.department).filter(Boolean)));

  // Filtered records
  const filteredRecords = records.filter(r => {
    const matchesSearch =
      r.employee_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.employee_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.pan && r.pan.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesDept = deptFilter === 'ALL' || r.department === deptFilter;
    return matchesSearch && matchesDept;
  });

  // Aggregate KPI metrics
  const staffCount = records.length;
  const grossPayroll = records.reduce((acc, r) => acc + r.gross_earned, 0);
  const totalDeductions = records.reduce((acc, r) => acc + r.total_deductions, 0);
  const takeHome = records.reduce((acc, r) => acc + r.take_home_pay, 0);
  const employerPF = records.reduce((acc, r) => acc + r.employer_pf, 0);
  const employerESIC = records.reduce((acc, r) => acc + r.employer_esic, 0);
  const gratuity = records.reduce((acc, r) => acc + r.gratuity, 0);
  const tds = records.reduce((acc, r) => acc + r.tds, 0);
  const companyCost = records.reduce((acc, r) => acc + r.company_cost, 0);

  const toggleExpand = (empId: string) => {
    setExpandedEmpId(prev => (prev === empId ? null : empId));
  };

  return (
    <div className="space-y-6">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200/90 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900">
              Payroll Results Register • {formatPayrollMonth(currentMonth)}
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
              {run?.status || 'PROCESSED'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Deterministic statutory audit register showing gross, statutory recoveries, take home, and company liability (CTC)
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => exportPayrollWorkbook(currentMonth, records, run, company, attendanceList)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition"
          >
            <Download className="w-4 h-4" />
            <span>Download Multi-Sheet Excel</span>
          </button>
        </div>
      </div>

      {/* KPI Cards (All 9 metrics requested by user) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-xs">
        
        {/* 1. Staff Count */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-slate-500 font-medium">Staff Count</span>
          <div className="text-lg font-black text-slate-900 mt-0.5">{staffCount} Active</div>
        </div>

        {/* 2. Gross Payroll */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-slate-500 font-medium">Gross Payroll</span>
          <div className="text-lg font-black text-slate-900 mt-0.5">{formatIndianCurrency(grossPayroll)}</div>
        </div>

        {/* 3. Total Deductions */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-slate-500 font-medium">Total Deductions</span>
          <div className="text-lg font-black text-rose-600 mt-0.5">{formatIndianCurrency(totalDeductions)}</div>
        </div>

        {/* 4. Take Home Pay */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-slate-500 font-medium">Take Home Pay</span>
          <div className="text-lg font-black text-emerald-700 mt-0.5">{formatIndianCurrency(takeHome)}</div>
        </div>

        {/* 5. Employer PF */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-slate-500 font-medium">Employer PF (12%)</span>
          <div className="text-lg font-black text-blue-700 mt-0.5">{formatIndianCurrency(employerPF)}</div>
        </div>

        {/* 6. Employer ESIC */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-slate-500 font-medium">Employer ESIC (3.25%)</span>
          <div className="text-lg font-black text-amber-700 mt-0.5">{formatIndianCurrency(employerESIC)}</div>
        </div>

        {/* 7. Gratuity */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-slate-500 font-medium">Gratuity Provision</span>
          <div className="text-lg font-black text-indigo-700 mt-0.5">{formatIndianCurrency(gratuity)}</div>
        </div>

        {/* 8. TDS Withheld */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-slate-500 font-medium">TDS / Income Tax</span>
          <div className="text-lg font-black text-purple-700 mt-0.5">{formatIndianCurrency(tds)}</div>
        </div>

        {/* 9. Company Cost (CTC) */}
        <div className="col-span-2 sm:col-span-1 bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs bg-slate-900 text-white">
          <span className="text-slate-400 font-medium">Total Company Cost (CTC)</span>
          <div className="text-lg font-black text-emerald-400 mt-0.5">{formatIndianCurrency(companyCost)}</div>
        </div>

      </div>

      {/* Filter / Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search employee, ID, PAN..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-500 font-medium">Department:</span>
          <select
            value={deptFilter}
            onChange={e => setDeptFilter(e.target.value)}
            className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-medium focus:outline-hidden"
          >
            <option value="ALL">All Departments</option>
            {departments.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Master Payroll Table */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-900 text-white font-semibold uppercase tracking-wider select-none">
              <tr>
                <th className="py-3 px-3 text-left w-10"></th>
                <th className="py-3 px-3">Emp ID</th>
                <th className="py-3 px-4">Name & Department</th>
                <th className="py-3 px-2 text-center">Days</th>
                <th className="py-3 px-3 text-right">Gross</th>
                <th className="py-3 px-2 text-right">PF</th>
                <th className="py-3 px-2 text-right">ESIC</th>
                <th className="py-3 px-2 text-right">PT</th>
                <th className="py-3 px-2 text-right">TDS</th>
                <th className="py-3 px-3 text-right">Deductions</th>
                <th className="py-3 px-3 text-right text-emerald-300">Take Home</th>
                <th className="py-3 px-2 text-right">Er PF</th>
                <th className="py-3 px-2 text-right">Er ESIC</th>
                <th className="py-3 px-2 text-right">Gratuity</th>
                <th className="py-3 px-3 text-right text-purple-300">CTC</th>
                <th className="py-3 px-3 text-center">TDS Steps</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={16} className="py-12 text-center text-slate-400">
                    <FileCheck2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm font-semibold text-slate-700">No payroll records found</p>
                    <p className="text-xs text-slate-400 mt-1">Process payroll for {formatPayrollMonth(currentMonth)} to generate data.</p>
                  </td>
                </tr>
              ) : (
                filteredRecords.map(rec => {
                  const isExpanded = expandedEmpId === rec.employee_id;
                  return (
                    <React.Fragment key={rec.employee_id}>
                      <tr className={`hover:bg-slate-50/80 transition ${isExpanded ? 'bg-slate-50/60' : ''}`}>
                        
                        {/* Expand Toggle */}
                        <td className="py-3 px-2 text-center">
                          <button
                            onClick={() => toggleExpand(rec.employee_id)}
                            className="p-1 hover:bg-slate-200 rounded text-slate-600 transition"
                            title="Toggle Calculation Breakdown"
                          >
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </button>
                        </td>

                        {/* Emp ID */}
                        <td className="py-3 px-3 font-mono font-bold text-slate-900">
                          {rec.employee_id}
                        </td>

                        {/* Name & Dept */}
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900">{rec.employee_name}</div>
                          <div className="text-[10px] text-slate-500">{rec.department} • {rec.designation}</div>
                        </td>

                        {/* Days Payable */}
                        <td className="py-3 px-2 text-center font-mono font-semibold text-slate-700">
                          {rec.days_payable} / {rec.calendar_days}
                        </td>

                        {/* Gross Earned */}
                        <td className="py-3 px-3 text-right font-bold text-slate-900">
                          {formatIndianCurrency(rec.gross_earned)}
                        </td>

                        {/* Employee PF */}
                        <td className="py-3 px-2 text-right text-slate-700">
                          {rec.employee_pf ? formatIndianCurrency(rec.employee_pf, false) : '-'}
                        </td>

                        {/* Employee ESIC */}
                        <td className="py-3 px-2 text-right text-slate-700">
                          {rec.employee_esic ? formatIndianCurrency(rec.employee_esic, false) : '-'}
                        </td>

                        {/* Professional Tax */}
                        <td className="py-3 px-2 text-right text-slate-700">
                          {rec.professional_tax ? formatIndianCurrency(rec.professional_tax, false) : '-'}
                        </td>

                        {/* TDS */}
                        <td className="py-3 px-2 text-right font-medium text-slate-800">
                          {rec.tds ? formatIndianCurrency(rec.tds, false) : '0'}
                        </td>

                        {/* Total Deductions */}
                        <td className="py-3 px-3 text-right font-bold text-rose-600">
                          {formatIndianCurrency(rec.total_deductions)}
                        </td>

                        {/* Take Home Pay */}
                        <td className="py-3 px-3 text-right font-extrabold text-emerald-700">
                          {formatIndianCurrency(rec.take_home_pay)}
                        </td>

                        {/* Employer PF */}
                        <td className="py-3 px-2 text-right text-slate-600">
                          {formatIndianCurrency(rec.employer_pf, false)}
                          {((rec.employer_edli || 0) + (rec.employer_pf_admin || 0)) > 0 && (
                            <div className="text-[10px] text-slate-400" title="EDLI and PF administrative charges (included in CTC)">
                              +{formatIndianCurrency((rec.employer_edli || 0) + (rec.employer_pf_admin || 0), false)} charges
                            </div>
                          )}
                        </td>

                        {/* Employer ESIC */}
                        <td className="py-3 px-2 text-right text-slate-600">
                          {rec.employer_esic ? formatIndianCurrency(rec.employer_esic, false) : '-'}
                        </td>

                        {/* Gratuity */}
                        <td className="py-3 px-2 text-right text-slate-600">
                          {formatIndianCurrency(rec.gratuity, false)}
                        </td>

                        {/* Company Cost (CTC) */}
                        <td className="py-3 px-3 text-right font-bold text-purple-700">
                          {formatIndianCurrency(rec.company_cost)}
                        </td>

                        {/* View TDS Calculation Button */}
                        <td className="py-3 px-3 text-center">
                          <button
                            onClick={() => setSelectedTdsRecord(rec)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-[11px] border border-indigo-200 transition"
                          >
                            <Calculator className="w-3 h-3" />
                            <span>View TDS</span>
                          </button>
                        </td>

                      </tr>

                      {/* Expandable Calculation Panel */}
                      {isExpanded && (
                        <tr className="bg-slate-50/90 border-b border-slate-200">
                          <td colSpan={16} className="p-4 pl-12 text-xs">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                              
                              {/* Earned Component Breakdown */}
                              <div>
                                <h5 className="font-bold text-slate-900 mb-2 text-xs uppercase tracking-wider text-emerald-800">
                                  Prorated Earnings Breakdown
                                </h5>
                                <div className="space-y-1 text-slate-600">
                                  <div className="flex justify-between">
                                    <span>Earned Basic:</span>
                                    <span className="font-semibold text-slate-900">{formatIndianCurrency(rec.earned_basic)}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>Earned DA:</span>
                                    <span className="font-semibold text-slate-900">{formatIndianCurrency(rec.earned_da)}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>Earned HRA:</span>
                                    <span className="font-semibold text-slate-900">{formatIndianCurrency(rec.earned_hra)}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>Earned Special Allowance:</span>
                                    <span className="font-semibold text-slate-900">{formatIndianCurrency(rec.earned_special)}</span>
                                  </div>
                                  {rec.overtime_amount > 0 && (
                                    <div className="flex justify-between text-indigo-600 font-medium">
                                      <span>Overtime (Un-prorated):</span>
                                      <span>{formatIndianCurrency(rec.overtime_amount)}</span>
                                    </div>
                                  )}
                                  {rec.bonus_amount > 0 && (
                                    <div className="flex justify-between text-indigo-600 font-medium">
                                      <span>Bonus / Incentive (Un-prorated):</span>
                                      <span>{formatIndianCurrency(rec.bonus_amount)}</span>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Statutory Rules & 50% Wage Check */}
                              <div>
                                <h5 className="font-bold text-slate-900 mb-2 text-xs uppercase tracking-wider text-blue-800">
                                  Statutory Wages & 50% Rule
                                </h5>
                                <div className="space-y-1 text-slate-600">
                                  <div className="flex justify-between">
                                    <span>Wage Components (Basic + DA):</span>
                                    <span className="font-semibold text-slate-900">{formatIndianCurrency(rec.earned_basic + rec.earned_da)}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>50% Wage Rule Status:</span>
                                    <span className={`font-semibold ${rec.wage_rule_applied ? 'text-amber-700' : 'text-emerald-700'}`}>
                                      {rec.wage_rule_applied ? '50% Wage Rule Adjustment Applied' : 'Compliant (Basic+DA ≥ 50%)'}
                                    </span>
                                  </div>
                                  {rec.wage_rule_applied && (
                                    <div className="flex justify-between text-amber-800">
                                      <span>Excess Non-Wage Added to PF Base:</span>
                                      <span className="font-bold">+{formatIndianCurrency(rec.wage_rule_excess)}</span>
                                    </div>
                                  )}
                                  <div className="flex justify-between pt-1 border-t border-slate-100">
                                    <span>Eligible PF Wages (Cap ₹15k):</span>
                                    <span className="font-bold text-slate-900">{formatIndianCurrency(rec.eligible_pf_wages)}</span>
                                  </div>
                                </div>
                              </div>

                              {/* Employer Liability Details */}
                              <div>
                                <h5 className="font-bold text-slate-900 mb-2 text-xs uppercase tracking-wider text-purple-800">
                                  Employer Cost Breakdown
                                </h5>
                                <div className="space-y-1 text-slate-600">
                                  <div className="flex justify-between">
                                    <span>Employer EPS (8.33% cap ₹1,250):</span>
                                    <span className="font-semibold text-slate-900">{formatIndianCurrency(rec.employer_eps)}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>Employer EPF Balance (3.67%):</span>
                                    <span className="font-semibold text-slate-900">{formatIndianCurrency(rec.employer_epf)}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>Employer ESIC (3.25%):</span>
                                    <span className="font-semibold text-slate-900">{formatIndianCurrency(rec.employer_esic)}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>Gratuity Accrual (15/26/12):</span>
                                    <span className="font-semibold text-slate-900">{formatIndianCurrency(rec.gratuity)}</span>
                                  </div>
                                  <div className="flex justify-between pt-1 border-t border-slate-100 text-purple-800 font-bold">
                                    <span>Total CTC Liability:</span>
                                    <span>{formatIndianCurrency(rec.company_cost)}</span>
                                  </div>
                                </div>
                              </div>

                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* TDS Calculation Explanation Modal */}
      {selectedTdsRecord && (
        <TDSCalculationModal
          record={selectedTdsRecord}
          onClose={() => setSelectedTdsRecord(null)}
        />
      )}

    </div>
  );
};
