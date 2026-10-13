/**
 * Employee Add / Edit Modal
 */

import React, { useState, useEffect } from 'react';
import { X, UserPlus, Save, Calculator, AlertCircle } from 'lucide-react';
import { Employee, EmploymentStatus, SalaryStructureType, TaxRegime } from '../../types/payroll';
import { calculateSimpleSalarySplit } from '../../services/payrollEngine';
import { formatIndianCurrency } from '../../utils/indianNumber';
import { api } from '../../services/api';

interface Props {
  employee: Employee | null; // null for new employee
  onClose: () => void;
  onSuccess: () => void;
}

const INDIAN_STATES = [
  'Maharashtra',
  'Karnataka',
  'Tamil Nadu',
  'Telangana',
  'West Bengal',
  'Gujarat',
  'Delhi',
  'Uttar Pradesh',
  'Haryana',
  'Kerala',
  'Rajasthan',
  'Madhya Pradesh',
  'Andhra Pradesh',
  'Punjab'
];

export const EmployeeModal: React.FC<Props> = ({ employee, onClose, onSuccess }) => {
  const isEdit = Boolean(employee);

  const [formData, setFormData] = useState<Partial<Employee>>({
    employee_id: employee?.employee_id || '',
    name: employee?.name || '',
    pan: employee?.pan || '',
    date_of_joining: employee?.date_of_joining || new Date().toISOString().split('T')[0],
    date_of_leaving: employee?.date_of_leaving || '',
    department: employee?.department || 'Engineering',
    designation: employee?.designation || 'Software Engineer',
    location: employee?.location || 'Bengaluru',
    employment_status: employee?.employment_status || 'ACTIVE',
    bank_name: employee?.bank_name || 'HDFC Bank',
    account_number: employee?.account_number || '',
    ifsc: employee?.ifsc || '',
    uan: employee?.uan || '',
    esic_number: employee?.esic_number || '',
    monthly_gross_salary: employee?.monthly_gross_salary || 35000,
    salary_structure_type: employee?.salary_structure_type || 'SIMPLE',
    basic: employee?.basic || 15750,
    da: employee?.da || 1750,
    hra: employee?.hra || 7000,
    conveyance: employee?.conveyance || 0,
    medical: employee?.medical || 0,
    special_allowance: employee?.special_allowance || 10500,
    pf_applicable: employee?.pf_applicable !== undefined ? employee.pf_applicable : true,
    esic_applicable: employee?.esic_applicable !== undefined ? employee.esic_applicable : false,
    professional_tax_applicable: employee?.professional_tax_applicable !== undefined ? employee.professional_tax_applicable : true,
    income_tax_applicable: employee?.income_tax_applicable !== undefined ? employee.income_tax_applicable : true,
    tax_regime: employee?.tax_regime || 'NEW',
    state: employee?.state || 'Karnataka'
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Real-time simple split calculation
  const simpleSplit = calculateSimpleSalarySplit(formData.monthly_gross_salary || 0);

  // Detailed sum check
  const detailedSum =
    (formData.basic || 0) +
    (formData.da || 0) +
    (formData.hra || 0) +
    (formData.conveyance || 0) +
    (formData.medical || 0) +
    (formData.special_allowance || 0);

  // Auto-sync ESIC applicability when gross is changed: <= 21,000 auto checks ESIC
  useEffect(() => {
    if (!isEdit && formData.monthly_gross_salary !== undefined) {
      if (formData.monthly_gross_salary <= 21000) {
        setFormData(prev => ({ ...prev, esic_applicable: true }));
      } else {
        setFormData(prev => ({ ...prev, esic_applicable: false }));
      }
    }
  }, [formData.monthly_gross_salary, isEdit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.name?.trim()) {
      setError('Employee name is required');
      return;
    }

    if (!formData.monthly_gross_salary || formData.monthly_gross_salary <= 0) {
      setError('Monthly gross salary must be greater than zero');
      return;
    }

    if (formData.salary_structure_type === 'DETAILED') {
      if (Math.round(detailedSum) !== Math.round(formData.monthly_gross_salary)) {
        setError(`Detailed salary components (Sum: ${formatIndianCurrency(detailedSum)}) must exactly equal Monthly Gross Salary (${formatIndianCurrency(formData.monthly_gross_salary)})`);
        return;
      }
    }

    setSaving(true);
    try {
      const payload: Partial<Employee> = {
        ...formData,
        pan: formData.pan?.toUpperCase(),
        ifsc: formData.ifsc?.toUpperCase()
      };

      if (formData.salary_structure_type === 'SIMPLE') {
        payload.basic = simpleSplit.basic;
        payload.da = simpleSplit.da;
        payload.hra = simpleSplit.hra;
        payload.conveyance = 0;
        payload.medical = 0;
        payload.special_allowance = simpleSplit.special_allowance;
      }

      if (isEdit && employee?.id) {
        await api.updateEmployee(employee.id, payload);
      } else {
        await api.createEmployee(payload);
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">{isEdit ? 'Edit Employee Record' : 'Add New Employee'}</h3>
              <p className="text-xs text-slate-300">Statutory payroll parameters and salary configuration</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto text-sm">
            
            {error && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 flex items-center gap-2 text-xs font-medium">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Section 1: Basic Profile */}
            <div>
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">1. Employee Profile</h4>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Employee ID <span className="text-slate-400 font-normal">(Auto if blank)</span>
                  </label>
                  <input
                    type="text"
                    value={formData.employee_id || ''}
                    onChange={e => setFormData({ ...formData, employee_id: e.target.value })}
                    placeholder="e.g. EMP006"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Full Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name || ''}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Sunita Sharma"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">PAN Number</label>
                  <input
                    type="text"
                    value={formData.pan || ''}
                    onChange={e => setFormData({ ...formData, pan: e.target.value.toUpperCase() })}
                    placeholder="e.g. ABCDE1234F"
                    maxLength={10}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm uppercase focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Date of Joining</label>
                  <input
                    type="date"
                    value={formData.date_of_joining || ''}
                    onChange={e => setFormData({ ...formData, date_of_joining: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Department</label>
                  <input
                    type="text"
                    value={formData.department || ''}
                    onChange={e => setFormData({ ...formData, department: e.target.value })}
                    placeholder="e.g. Operations"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Designation</label>
                  <input
                    type="text"
                    value={formData.designation || ''}
                    onChange={e => setFormData({ ...formData, designation: e.target.value })}
                    placeholder="e.g. Lead Analyst"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Location / Office</label>
                  <input
                    type="text"
                    value={formData.location || ''}
                    onChange={e => setFormData({ ...formData, location: e.target.value })}
                    placeholder="e.g. Mumbai"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Employment State (for PT)</label>
                  <select
                    value={formData.state || 'Maharashtra'}
                    onChange={e => setFormData({ ...formData, state: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  >
                    {INDIAN_STATES.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Employment Status</label>
                  <select
                    value={formData.employment_status || 'ACTIVE'}
                    onChange={e => setFormData({ ...formData, employment_status: e.target.value as EmploymentStatus })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                    <option value="ON_LEAVE">ON_LEAVE</option>
                    <option value="TERMINATED">TERMINATED</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Section 2: Salary Structure */}
            <div className="pt-2 border-t border-slate-200">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">2. Salary Structure & Components</h4>
                
                {/* Switch between Simple and Detailed */}
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, salary_structure_type: 'SIMPLE' })}
                    className={`px-3 py-1 rounded-md font-medium transition ${formData.salary_structure_type === 'SIMPLE' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                  >
                    Simple (Auto Split)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, salary_structure_type: 'DETAILED' })}
                    className={`px-3 py-1 rounded-md font-medium transition ${formData.salary_structure_type === 'DETAILED' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                  >
                    Detailed Breakdown
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="col-span-1">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Monthly Gross Salary (₹) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={formData.monthly_gross_salary || ''}
                    onChange={e => setFormData({ ...formData, monthly_gross_salary: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-base font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Simple Mode Split Preview */}
              {formData.salary_structure_type === 'SIMPLE' ? (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                      <Calculator className="w-4 h-4 text-emerald-600" />
                      Statutory Simple Split Preview (Basic: 45%, DA: 5%, HRA: 20%, Special: 30%)
                    </span>
                    <span className="text-xs text-emerald-700 font-semibold bg-emerald-100 px-2 py-0.5 rounded-full">
                      Basic + DA ≥ 50% Enforced
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-3 text-xs">
                    <div className="bg-white p-2.5 rounded-md border border-slate-200">
                      <span className="text-slate-500">Basic (45%):</span>
                      <div className="font-bold text-slate-800 text-sm">{formatIndianCurrency(simpleSplit.basic)}</div>
                    </div>
                    <div className="bg-white p-2.5 rounded-md border border-slate-200">
                      <span className="text-slate-500">DA (5%):</span>
                      <div className="font-bold text-slate-800 text-sm">{formatIndianCurrency(simpleSplit.da)}</div>
                    </div>
                    <div className="bg-white p-2.5 rounded-md border border-slate-200">
                      <span className="text-slate-500">HRA (20%):</span>
                      <div className="font-bold text-slate-800 text-sm">{formatIndianCurrency(simpleSplit.hra)}</div>
                    </div>
                    <div className="bg-white p-2.5 rounded-md border border-slate-200">
                      <span className="text-slate-500">Special Allowance:</span>
                      <div className="font-bold text-slate-800 text-sm">{formatIndianCurrency(simpleSplit.special_allowance)}</div>
                    </div>
                  </div>
                </div>
              ) : (
                /* Detailed Mode Breakdown inputs */
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-700">Detailed Components Breakdown</span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${Math.round(detailedSum) === Math.round(formData.monthly_gross_salary || 0) ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                      Sum: {formatIndianCurrency(detailedSum)} / {formatIndianCurrency(formData.monthly_gross_salary || 0)}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs text-slate-600 mb-1">Basic Salary</label>
                      <input
                        type="number"
                        value={formData.basic || ''}
                        onChange={e => setFormData({ ...formData, basic: Number(e.target.value) })}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-600 mb-1">Dearness Allowance (DA)</label>
                      <input
                        type="number"
                        value={formData.da || ''}
                        onChange={e => setFormData({ ...formData, da: Number(e.target.value) })}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-600 mb-1">HRA</label>
                      <input
                        type="number"
                        value={formData.hra || ''}
                        onChange={e => setFormData({ ...formData, hra: Number(e.target.value) })}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-600 mb-1">Conveyance</label>
                      <input
                        type="number"
                        value={formData.conveyance || ''}
                        onChange={e => setFormData({ ...formData, conveyance: Number(e.target.value) })}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-600 mb-1">Medical Allowance</label>
                      <input
                        type="number"
                        value={formData.medical || ''}
                        onChange={e => setFormData({ ...formData, medical: Number(e.target.value) })}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-600 mb-1">Special Allowance</label>
                      <input
                        type="number"
                        value={formData.special_allowance || ''}
                        onChange={e => setFormData({ ...formData, special_allowance: Number(e.target.value) })}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md text-xs"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Section 3: Statutory Applicability */}
            <div className="pt-2 border-t border-slate-200">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">3. Statutory Applicability & Tax Regime</h4>
              <div className="grid grid-cols-4 gap-4 p-4 bg-slate-50 border border-slate-200 rounded-lg">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.pf_applicable}
                    onChange={e => setFormData({ ...formData, pf_applicable: e.target.checked })}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <div>
                    <div className="text-xs font-semibold text-slate-800">PF Applicable</div>
                    <div className="text-[11px] text-slate-500">12% EPF + EPS</div>
                  </div>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.esic_applicable}
                    onChange={e => setFormData({ ...formData, esic_applicable: e.target.checked })}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <div>
                    <div className="text-xs font-semibold text-slate-800">ESIC Applicable</div>
                    <div className="text-[11px] text-slate-500">Gross ≤ ₹21,000</div>
                  </div>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.professional_tax_applicable}
                    onChange={e => setFormData({ ...formData, professional_tax_applicable: e.target.checked })}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <div>
                    <div className="text-xs font-semibold text-slate-800">Professional Tax (PT)</div>
                    <div className="text-[11px] text-slate-500">State Slabs Rule</div>
                  </div>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.income_tax_applicable}
                    onChange={e => setFormData({ ...formData, income_tax_applicable: e.target.checked })}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <div>
                    <div className="text-xs font-semibold text-slate-800">TDS / Income Tax</div>
                    <div className="text-[11px] text-slate-500">Nil ≤ ₹12 Lakhs</div>
                  </div>
                </label>
              </div>

              <div className="grid grid-cols-3 gap-4 mt-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Tax Regime</label>
                  <select
                    value={formData.tax_regime || 'NEW'}
                    onChange={e => setFormData({ ...formData, tax_regime: e.target.value as TaxRegime })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  >
                    <option value="NEW">New Tax Regime (Tax Year 2026-27 - Standard Deduction ₹75,000)</option>
                    <option value="OLD">Old Tax Regime</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">UAN (Universal Account Number)</label>
                  <input
                    type="text"
                    value={formData.uan || ''}
                    onChange={e => setFormData({ ...formData, uan: e.target.value })}
                    placeholder="12-digit UAN"
                    maxLength={12}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">ESIC IP Number</label>
                  <input
                    type="text"
                    value={formData.esic_number || ''}
                    onChange={e => setFormData({ ...formData, esic_number: e.target.value })}
                    placeholder="17-digit ESIC"
                    maxLength={17}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Section 4: Bank Details */}
            <div className="pt-2 border-t border-slate-200">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">4. Bank & Disbursement Account</h4>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Bank Name</label>
                  <input
                    type="text"
                    value={formData.bank_name || ''}
                    onChange={e => setFormData({ ...formData, bank_name: e.target.value })}
                    placeholder="e.g. State Bank of India"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Account Number</label>
                  <input
                    type="text"
                    value={formData.account_number || ''}
                    onChange={e => setFormData({ ...formData, account_number: e.target.value })}
                    placeholder="Bank account number"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">IFSC Code</label>
                  <input
                    type="text"
                    value={formData.ifsc || ''}
                    onChange={e => setFormData({ ...formData, ifsc: e.target.value.toUpperCase() })}
                    placeholder="e.g. SBIN0001234"
                    maxLength={11}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm uppercase"
                  />
                </div>
              </div>
            </div>

          </div>

          {/* Modal Footer */}
          <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex justify-between items-center">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-100 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 transition disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : isEdit ? 'Update Employee' : 'Save Employee'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
