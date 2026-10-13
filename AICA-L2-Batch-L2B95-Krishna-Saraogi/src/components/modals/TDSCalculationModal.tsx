/**
 * TDS Calculation Explanation Modal
 * Displays exact statutory steps for an employee's Income Tax computation
 */

import React from 'react';
import { X, CheckCircle2, AlertCircle, Calculator, ShieldCheck } from 'lucide-react';
import { PayrollRecord } from '../../types/payroll';
import { formatIndianCurrency } from '../../utils/indianNumber';

interface Props {
  record: PayrollRecord | null;
  onClose: () => void;
}

export const TDSCalculationModal: React.FC<Props> = ({ record, onClose }) => {
  if (!record || !record.tds_details) return null;

  const d = record.tds_details;
  const isOld = d.regime === 'OLD';
  const isYtd = d.basis === 'YTD_PROJECTION';
  const monthsRemaining = d.months_remaining ?? 12;
  const ytdTds = d.ytd_tds ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg border border-emerald-500/30">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">TDS Calculation Breakdown</h3>
              <p className="text-xs text-slate-300">
                {record.employee_name} ({record.employee_id}) • Tax Year 2026-27 • {isOld ? 'Old Regime' : 'New Regime'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-700 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto text-sm text-slate-700">
          
          {/* Quick Summary Banner */}
          <div className="grid grid-cols-3 gap-3 p-4 bg-slate-50 border border-slate-200 rounded-lg">
            <div>
              <div className="text-xs text-slate-500">Gross Monthly Earnings</div>
              <div className="text-base font-bold text-slate-900">{formatIndianCurrency(d.monthly_taxable_salary)}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Taxable Annual Income</div>
              <div className="text-base font-bold text-slate-900">{formatIndianCurrency(d.taxable_income)}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Monthly TDS Deducted</div>
              <div className="text-base font-bold text-emerald-600">{formatIndianCurrency(d.monthly_tds)}</div>
            </div>
          </div>

          {/* Step by step calculation flow */}
          <div className="space-y-3">
            <h4 className="font-semibold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Deterministic Statutory Computation Flow
            </h4>

            <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 overflow-hidden bg-white">
              
              {/* Step 1 */}
              <div className="p-3.5 flex items-center justify-between hover:bg-slate-50">
                <div>
                  <span className="font-medium text-slate-900">Step 1: Monthly Taxable Salary</span>
                  <div className="text-xs text-slate-500">Fixed prorated salary + Overtime ({formatIndianCurrency(record.overtime_amount)}) + Bonus ({formatIndianCurrency(record.bonus_amount)})</div>
                </div>
                <div className="font-semibold text-slate-900">{formatIndianCurrency(d.monthly_taxable_salary)}</div>
              </div>

              {/* Step 2 */}
              <div className="p-3.5 flex items-center justify-between hover:bg-slate-50">
                <div>
                  <span className="font-medium text-slate-900">Step 2: Estimated Annual Salary</span>
                  <div className="text-xs text-slate-500">
                    {isYtd
                      ? `Earlier months ${formatIndianCurrency(d.ytd_gross ?? 0)} + this month ${formatIndianCurrency(d.monthly_taxable_salary)} + projected remaining months ${formatIndianCurrency(d.projected_future_salary ?? 0)}`
                      : `${formatIndianCurrency(d.monthly_taxable_salary)} × 12 months`}
                  </div>
                </div>
                <div className="font-semibold text-slate-900">{formatIndianCurrency(d.annualized_salary)}</div>
              </div>

              {/* Step 3 */}
              <div className="p-3.5 space-y-2 hover:bg-slate-50">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-900">Step 3: Statutory Annual Deductions</span>
                  <div className="text-xs font-semibold text-slate-700">Less Allowed Deductions</div>
                </div>
                <div className="pl-4 space-y-1 text-xs border-l-2 border-slate-200">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Standard Deduction ({isOld ? 'Old Regime' : 'New Regime'})</span>
                    <span className="font-medium text-rose-600">- {formatIndianCurrency(d.standard_deduction)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">{isOld || !d.regime ? 'Professional Tax for the year' : 'Professional Tax (not deductible in the new regime)'}</span>
                    <span className="font-medium text-rose-600">- {formatIndianCurrency(d.annual_pt)}</span>
                  </div>
                  {(d.chapter_via ?? 0) > 0 && (
                    <div className="flex justify-between">
                      <span className="text-slate-600">Employee Provident Fund (old regime, limit ₹1,50,000)</span>
                      <span className="font-medium text-rose-600">- {formatIndianCurrency(d.chapter_via ?? 0)}</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                  <span className="font-semibold text-slate-900">Net Taxable Income</span>
                  <span className="font-bold text-slate-900">{formatIndianCurrency(d.taxable_income)}</span>
                </div>
              </div>

              {/* Step 4: Nil-tax threshold check */}
              <div className="p-3.5 flex items-center justify-between bg-emerald-50/50">
                <div>
                  <div className="flex items-center gap-1.5 font-medium text-slate-900">
                    <span>Step 4: Rebate Threshold Check</span>
                    {d.is_below_threshold ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                        <CheckCircle2 className="w-3 h-3" /> Below Threshold (Tax = ₹0)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                        <AlertCircle className="w-3 h-3" /> Exceeds {formatIndianCurrency(d.nil_tax_threshold)}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500">
                    No tax up to taxable income of {formatIndianCurrency(d.nil_tax_threshold)}
                    {(d.marginal_relief ?? 0) > 0 && ` • Marginal relief of ${formatIndianCurrency(d.marginal_relief ?? 0)} given: tax limited to income above the threshold`}
                  </div>
                </div>
                <div className="font-bold text-slate-800">{d.is_below_threshold ? 'NIL TAX' : 'TAX APPLICABLE'}</div>
              </div>

              {/* Step 5: Slabs breakdown */}
              {!d.is_below_threshold && d.slab_breakdown.length > 0 && (
                <div className="p-3.5 space-y-2">
                  <span className="font-medium text-slate-900">Step 5: Applicable Tax Slab Computation</span>
                  <div className="bg-slate-50 rounded-lg p-2.5 space-y-1.5 text-xs">
                    {d.slab_breakdown.map((slab, idx) => (
                      <div key={idx} className="flex justify-between py-1 border-b border-slate-200 last:border-0">
                        <span className="text-slate-600">{slab.slab_label} on {formatIndianCurrency(slab.taxable_in_slab)}:</span>
                        <span className="font-semibold text-slate-800">{formatIndianCurrency(slab.tax_amount)}</span>
                      </div>
                    ))}
                    {(d.marginal_relief ?? 0) > 0 && (
                      <div className="flex justify-between py-1 border-b border-slate-200">
                        <span className="text-slate-600">Less: marginal relief</span>
                        <span className="font-semibold text-rose-600">- {formatIndianCurrency(d.marginal_relief ?? 0)}</span>
                      </div>
                    )}
                    {(d.surcharge ?? 0) > 0 && (
                      <div className="flex justify-between py-1 border-b border-slate-200">
                        <span className="text-slate-600">Add: surcharge</span>
                        <span className="font-semibold text-slate-800">{formatIndianCurrency(d.surcharge ?? 0)}</span>
                      </div>
                    )}
                    <div className="flex justify-between pt-1 font-semibold text-slate-900">
                      <span>Total Tax Before Cess:</span>
                      <span>{formatIndianCurrency(d.tax_before_cess)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 6 & 7: Cess & Total Annual Tax */}
              <div className="p-3.5 flex items-center justify-between hover:bg-slate-50">
                <div>
                  <span className="font-medium text-slate-900">Step 6: Health & Education Cess (4%)</span>
                  <div className="text-xs text-slate-500">{formatIndianCurrency(d.tax_before_cess)} × 4%</div>
                </div>
                <div className="font-semibold text-slate-900">{formatIndianCurrency(d.cess_amount)}</div>
              </div>

              <div className="p-3.5 flex items-center justify-between bg-slate-50/70">
                <div>
                  <span className="font-semibold text-slate-900">Step 7: Annual Tax Liability</span>
                  <div className="text-xs text-slate-500">Tax before cess + 4% cess</div>
                </div>
                <div className="font-bold text-slate-900">{formatIndianCurrency(d.annual_tax_with_cess)}</div>
              </div>

              {/* Step 8: Monthly TDS */}
              <div className="p-4 flex items-center justify-between bg-emerald-50 border-t border-emerald-200">
                <div>
                  <span className="font-bold text-emerald-950 text-base">Step 8: Monthly TDS Deduction</span>
                  <div className="text-xs text-emerald-700">
                    (Annual tax {formatIndianCurrency(d.annual_tax_with_cess)} − TDS already deducted {formatIndianCurrency(ytdTds)}) ÷ {monthsRemaining} remaining month{monthsRemaining === 1 ? '' : 's'}
                  </div>
                </div>
                <div className="text-xl font-extrabold text-emerald-700">{formatIndianCurrency(d.monthly_tds)}</div>
              </div>

            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-6 py-3.5 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-900 transition"
          >
            Close Breakdown
          </button>
        </div>

      </div>
    </div>
  );
};
