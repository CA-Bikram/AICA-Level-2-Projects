/**
 * OneHR Payroll Manager - Salary Slips View
 * Professional payslip preview, PDF generator, and browser print
 */

import React, { useEffect, useState } from 'react';
import {
  Receipt,
  Download,
  Printer,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Building2,
  Calendar,
  CreditCard,
  UserCheck
} from 'lucide-react';
import { Company, Employee, PayrollRecord } from '../types/payroll';
import {
  formatIndianCurrency,
  formatIndianDate,
  formatPayrollMonth,
  numberToIndianWords
} from '../utils/indianNumber';
import { generateSalarySlipPDF } from '../utils/pdfGenerator';
import { api, TaxWorksheet } from '../services/api';
import { buildWorksheetLines, worksheetPeriod } from '../utils/taxWorksheet';

interface Props {
  currentMonth: string;
  records: PayrollRecord[];
  company: Company | null;
  employees: Employee[];
  initialSelectedEmpId?: string;
}

export const SalarySlipsView: React.FC<Props> = ({
  currentMonth,
  records,
  company,
  employees,
  initialSelectedEmpId
}) => {
  const [selectedEmpId, setSelectedEmpId] = useState<string>(
    initialSelectedEmpId || records[0]?.employee_id || ''
  );

  const currentRecord = records.find(r => r.employee_id === selectedEmpId) || records[0];
  const currentEmpMaster = employees.find(e => e.employee_id === selectedEmpId);

  // Income tax worksheet for the selected employee (annual salary, tax computation, month-wise TDS)
  const [worksheet, setWorksheet] = useState<TaxWorksheet | null>(null);
  const worksheetEmpId = currentRecord?.employee_id;
  useEffect(() => {
    setWorksheet(null);
    if (!worksheetEmpId) return;
    let cancelled = false;
    api.getTaxWorksheet(currentMonth, worksheetEmpId)
      .then(ws => { if (!cancelled) setWorksheet(ws); })
      .catch(() => { if (!cancelled) setWorksheet(null); });
    return () => { cancelled = true; };
  }, [currentMonth, worksheetEmpId, currentRecord?.tds]);

  const handleDownloadPDF = () => {
    if (!currentRecord) return;
    generateSalarySlipPDF(currentRecord, company, currentEmpMaster, worksheet);
  };

  const handlePrint = () => {
    window.print();
  };

  if (!currentRecord) {
    return (
      <div className="bg-white p-12 rounded-xl border border-slate-200 text-center text-slate-500">
        <Receipt className="w-12 h-12 mx-auto mb-3 text-slate-400" />
        <h3 className="text-base font-bold text-slate-800">No Salary Slip Available</h3>
        <p className="text-xs text-slate-500 mt-1">Please process payroll for {formatPayrollMonth(currentMonth)} first.</p>
      </div>
    );
  }

  // Earnings items for table
  const earnings = [
    { label: 'Basic Salary', fixed: currentRecord.fixed_basic, earned: currentRecord.earned_basic },
    { label: 'Dearness Allowance (DA)', fixed: currentRecord.fixed_da, earned: currentRecord.earned_da },
    { label: 'House Rent Allowance (HRA)', fixed: currentRecord.fixed_hra, earned: currentRecord.earned_hra },
    { label: 'Conveyance Allowance', fixed: currentRecord.fixed_conveyance, earned: currentRecord.earned_conveyance },
    { label: 'Medical Allowance', fixed: currentRecord.fixed_medical, earned: currentRecord.earned_medical },
    { label: 'Special Allowance', fixed: currentRecord.fixed_special, earned: currentRecord.earned_special },
    { label: 'Overtime (OT)', fixed: 0, earned: currentRecord.overtime_amount },
    { label: 'Incentive / Bonus', fixed: 0, earned: currentRecord.bonus_amount },
  ];

  // Deductions items for table
  const deductions = [
    { label: 'Provident Fund (EPF 12%)', amount: currentRecord.employee_pf },
    { label: 'Employee State Insurance (ESIC 0.75%)', amount: currentRecord.employee_esic },
    { label: 'Professional Tax (PT)', amount: currentRecord.professional_tax },
    { label: 'Tax Deducted at Source (TDS/IT)', amount: currentRecord.tds },
  ];

  return (
    <div className="space-y-6">
      
      {/* Control Bar (hidden in print) */}
      <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200/90 shadow-xs">
        <div className="flex items-center gap-3">
          <label className="text-xs font-bold text-slate-700">Select Employee:</label>
          <select
            value={selectedEmpId}
            onChange={e => setSelectedEmpId(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:outline-hidden"
          >
            {records.map(r => (
              <option key={r.employee_id} value={r.employee_id}>
                {r.employee_name} ({r.employee_id}) - {r.department}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold border border-slate-200 transition cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Payslip</span>
          </button>

          <button
            onClick={handleDownloadPDF}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Download Local PDF</span>
          </button>
        </div>
      </div>

      {/* Payslip Document Container (Designed for print and on-screen preview) */}
      <div className="max-w-4xl mx-auto bg-white border border-slate-300 rounded-2xl shadow-xl p-8 space-y-6 text-slate-900 text-xs">
        
        {/* Company Header */}
        <div className="border-b-2 border-slate-900 pb-5">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-extrabold text-slate-950 uppercase tracking-tight">
                {company?.legal_name || 'Demo Industries Private Limited'}
              </h1>
              <p className="text-slate-600 mt-1 max-w-lg text-[11px] leading-relaxed">
                {company?.address || 'Unit 402, 4th Floor, Prestige Tech Park, Marathahalli-Sarjapur Ring Road'}, {company?.city || 'Bengaluru'}, {company?.state || 'Karnataka'} - {company?.pincode || '560103'}
              </p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-mono font-medium text-slate-500 mt-2">
                <span>GSTIN: <strong className="text-slate-800">{company?.gstin || '29AABCC1234D1Z5'}</strong></span>
                <span>PAN: <strong className="text-slate-800">{company?.pan || 'AABCC1234D'}</strong></span>
                <span>PF Est. Code: <strong className="text-slate-800">{company?.pf_code || 'KN/BNG/0098765/000'}</strong></span>
                <span>ESIC Code: <strong className="text-slate-800">{company?.esic_code || '51000987650001001'}</strong></span>
              </div>
            </div>

            <div className="text-right">
              <div className="inline-block px-3 py-1 bg-slate-900 text-white font-bold text-xs rounded-md uppercase tracking-wider">
                Payslip
              </div>
              <div className="text-sm font-extrabold text-slate-900 mt-2">
                {formatPayrollMonth(currentRecord.payroll_month).toUpperCase()}
              </div>
            </div>
          </div>
        </div>

        {/* Employee & Attendance Info Grid */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-bold">Employee Name</span>
              <span className="font-extrabold text-slate-950 text-sm">{currentRecord.employee_name}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-bold">Employee ID</span>
              <span className="font-mono font-bold text-slate-950 text-sm">{currentRecord.employee_id}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-bold">Department</span>
              <span className="font-semibold text-slate-900">{currentRecord.department}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-bold">Designation</span>
              <span className="font-semibold text-slate-900">{currentRecord.designation}</span>
            </div>

            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-bold">PAN</span>
              <span className="font-mono font-semibold text-slate-900">{currentRecord.pan || 'N/A'}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-bold">Date of Joining</span>
              <span className="font-semibold text-slate-900">{formatIndianDate(currentEmpMaster?.date_of_joining)}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-bold">Bank Name & A/c</span>
              <span className="font-semibold text-slate-900">{currentRecord.bank_name} - {currentRecord.account_number}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-bold">IFSC Code</span>
              <span className="font-mono font-semibold text-slate-900">{currentRecord.ifsc}</span>
            </div>

            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-bold">UAN (Universal A/c No)</span>
              <span className="font-mono font-semibold text-slate-900">{currentRecord.uan || 'N/A'}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-bold">ESIC IP Number</span>
              <span className="font-mono font-semibold text-slate-900">{currentRecord.esic_number || 'N/A'}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-bold">Calendar Days</span>
              <span className="font-bold text-slate-900">{currentRecord.calendar_days} Days</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-bold">Payable Days</span>
              <span className="font-bold text-emerald-700">{currentRecord.days_payable} Days</span>
            </div>
          </div>
        </div>

        {/* Earnings & Deductions Tables (Two Columns) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Earnings Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="bg-slate-100 px-4 py-2.5 font-bold text-slate-900 flex justify-between border-b border-slate-200">
              <span>EARNINGS</span>
              <span>AMOUNT (₹)</span>
            </div>
            <table className="w-full text-xs">
              <tbody className="divide-y divide-slate-100">
                {earnings.map((e, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="py-2 px-4 text-slate-700">{e.label}</td>
                    <td className="py-2 px-4 text-right font-medium text-slate-900">
                      {formatIndianCurrency(e.earned, false)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-slate-300 bg-slate-50 font-bold">
                <tr>
                  <td className="py-2.5 px-4 text-slate-950">GROSS EARNINGS</td>
                  <td className="py-2.5 px-4 text-right text-slate-950 text-sm">
                    {formatIndianCurrency(currentRecord.gross_earned)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Deductions Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden flex flex-col justify-between">
            <div>
              <div className="bg-slate-100 px-4 py-2.5 font-bold text-slate-900 flex justify-between border-b border-slate-200">
                <span>DEDUCTIONS</span>
                <span>AMOUNT (₹)</span>
              </div>
              <table className="w-full text-xs">
                <tbody className="divide-y divide-slate-100">
                  {deductions.map((d, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="py-2 px-4 text-slate-700">{d.label}</td>
                      <td className="py-2 px-4 text-right font-medium text-slate-900">
                        {formatIndianCurrency(d.amount, false)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <table className="w-full text-xs border-t-2 border-slate-300 bg-slate-50 font-bold">
              <tfoot>
                <tr>
                  <td className="py-2.5 px-4 text-rose-700">TOTAL DEDUCTIONS</td>
                  <td className="py-2.5 px-4 text-right text-rose-700 text-sm">
                    {formatIndianCurrency(currentRecord.total_deductions)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

        </div>

        {/* NET PAY HIGHLIGHT CARD */}
        <div className="bg-emerald-50 border-2 border-emerald-500/40 rounded-xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <div className="text-xs font-bold text-emerald-900 uppercase tracking-wider">
              Net Salary Payable (Take Home)
            </div>
            <div className="text-xs text-emerald-700 font-medium italic mt-1">
              {numberToIndianWords(currentRecord.take_home_pay)}
            </div>
          </div>
          <div className="text-3xl font-black text-emerald-900 tracking-tight">
            {formatIndianCurrency(currentRecord.take_home_pay)}
          </div>
        </div>

        {/* Income Tax Worksheet */}
        {worksheet && (
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="bg-slate-100 px-4 py-2.5 text-xs font-bold text-slate-800 uppercase tracking-wider text-center border-b border-slate-200">
              Income Tax Worksheet for the Period {worksheetPeriod(worksheet)} • {worksheet.details.regime === 'OLD' ? 'Old Regime' : 'New Regime'}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 text-xs">
              {/* Annual salary by component */}
              <div className="lg:border-r border-slate-200">
                <table className="w-full">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="py-2 px-4 text-left font-semibold">Description</th>
                      <th className="py-2 px-3 text-right font-semibold">Gross</th>
                      <th className="py-2 px-3 text-right font-semibold">Exempt</th>
                      <th className="py-2 px-4 text-right font-semibold">Taxable</th>
                    </tr>
                  </thead>
                  <tbody>
                    {worksheet.components.map(c => (
                      <tr key={c.label} className="border-t border-slate-100">
                        <td className="py-1.5 px-4 text-slate-700">{c.label}</td>
                        <td className="py-1.5 px-3 text-right text-slate-800">{formatIndianCurrency(c.gross, false)}</td>
                        <td className="py-1.5 px-3 text-right text-slate-500">{formatIndianCurrency(c.exempt, false)}</td>
                        <td className="py-1.5 px-4 text-right text-slate-800">{formatIndianCurrency(c.taxable, false)}</td>
                      </tr>
                    ))}
                    <tr className="border-t border-slate-300 bg-slate-50 font-bold text-slate-900">
                      <td className="py-2 px-4">Gross Salary</td>
                      <td className="py-2 px-3 text-right">{formatIndianCurrency(worksheet.gross_salary, false)}</td>
                      <td className="py-2 px-3 text-right">0</td>
                      <td className="py-2 px-4 text-right">{formatIndianCurrency(worksheet.gross_salary, false)}</td>
                    </tr>
                  </tbody>
                </table>
                <div className="px-4 py-2 text-[10px] text-slate-500 border-t border-slate-100">
                  Actual salary for months processed so far plus fixed salary projected for the remaining months of the year.
                </div>

                <table className="w-full border-t border-slate-200">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="py-2 px-4 text-left font-semibold">Employee Provident Fund</th>
                      <th className="py-2 px-4 text-right font-semibold">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t border-slate-100">
                      <td className="py-1.5 px-4 text-slate-700">Contribution estimated for the year</td>
                      <td className="py-1.5 px-4 text-right text-slate-800">{formatIndianCurrency(worksheet.details.annual_employee_pf ?? 0, false)}</td>
                    </tr>
                    <tr className="border-t border-slate-100">
                      <td className="py-1.5 px-4 text-slate-700">Deduction allowed {worksheet.details.regime === 'OLD' ? '(limit ₹1,50,000)' : '(nil in new regime)'}</td>
                      <td className="py-1.5 px-4 text-right font-semibold text-slate-900">{formatIndianCurrency(worksheet.details.chapter_via ?? 0, false)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Tax computation */}
              <div>
                <table className="w-full">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="py-2 px-4 text-left font-semibold">Tax Computation</th>
                      <th className="py-2 px-4 text-right font-semibold">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {buildWorksheetLines(worksheet, currentRecord.tds).map(l => (
                      <tr key={l.label} className={`border-t border-slate-100 ${l.bold ? 'bg-slate-50 font-bold text-slate-900' : 'text-slate-700'}`}>
                        <td className="py-1.5 px-4">{l.sign === '-' ? 'Less: ' : ''}{l.label}</td>
                        <td className="py-1.5 px-4 text-right">{l.amount === null ? l.text : formatIndianCurrency(l.amount, false)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Month-wise TDS */}
            <div className="border-t border-slate-200 px-4 py-3">
              <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-2">Tax Deducted During the Year</div>
              <div className="flex flex-wrap gap-2 text-xs">
                {worksheet.monthly_tds.map(m => (
                  <div key={m.month} className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-center min-w-[84px]">
                    <div className="text-[10px] text-slate-500">{formatPayrollMonth(m.month)}</div>
                    <div className="font-bold text-slate-900">{formatIndianCurrency(m.tds, false)}</div>
                  </div>
                ))}
                <div className="px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg text-center min-w-[84px]">
                  <div className="text-[10px] text-emerald-700">Total</div>
                  <div className="font-bold text-emerald-900">{formatIndianCurrency(worksheet.monthly_tds.reduce((a, m) => a + m.tds, 0), false)}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Employer Cost & Contributions Box */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
          <div className="font-bold text-slate-700 text-xs uppercase tracking-wider mb-2">
            Employer Contributions & Statutory Accruals (Cost to Company - CTC)
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-slate-500">Employer PF (12%):</span>
              <div className="font-bold text-slate-900">{formatIndianCurrency(currentRecord.employer_pf)}</div>
              <div className="text-[10px] text-slate-400">EPS: ₹{currentRecord.employer_eps} | EPF: ₹{currentRecord.employer_epf}</div>
            </div>
            <div>
              <span className="text-slate-500">Employer ESIC (3.25%):</span>
              <div className="font-bold text-slate-900">{formatIndianCurrency(currentRecord.employer_esic)}</div>
            </div>
            <div>
              <span className="text-slate-500">Gratuity Provision (15/26/12):</span>
              <div className="font-bold text-slate-900">{formatIndianCurrency(currentRecord.gratuity)}</div>
            </div>
            <div>
              <span className="text-slate-500">Total Monthly CTC:</span>
              <div className="font-bold text-purple-700 text-sm">{formatIndianCurrency(currentRecord.company_cost)}</div>
            </div>
          </div>
        </div>

        {/* Signatures & Verification */}
        <div className="pt-8 border-t border-slate-200 flex justify-between items-end text-slate-400 text-[10px]">
          <div>
            <div>System Generated Payslip • Generated by OneHR Payroll Manager Engine</div>
            <div>Deterministic Statutory Compliance Engine • No physical signature required</div>
          </div>
          <div className="text-right">
            <div className="w-40 border-b border-slate-400 mb-1"></div>
            <div className="font-semibold text-slate-600">Authorized Signatory</div>
            <div>Demo Industries Private Limited</div>
          </div>
        </div>

      </div>

    </div>
  );
};
