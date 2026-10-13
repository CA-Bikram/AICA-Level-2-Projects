/**
 * OneHR Payroll Manager - Statutory Settings & Configuration View
 */

import React, { useState } from 'react';
import {
  Settings as SettingsIcon,
  ShieldCheck,
  Building2,
  Database,
  RotateCcw,
  Save,
  Plus,
  Trash2,
  Download,
  Upload,
  TestTube2,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';
import { Company, PayrollSettings, PTSlab, TDSSlab } from '../types/payroll';
import { DEFAULT_SETTINGS, DEFAULT_PT_SLABS, DEFAULT_TAX_SLABS } from '../services/payrollEngine';
import { formatIndianCurrency } from '../utils/indianNumber';
import { api } from '../services/api';

interface Props {
  settings: PayrollSettings;
  company: Company | null;
  ptSlabs: PTSlab[];
  taxSlabs: TDSSlab[];
  onRefresh: () => void;
  onOpenTestsModal: () => void;
}

type TabType = 'STATUTORY' | 'PT_SLABS' | 'TAX_SLABS' | 'COMPANY' | 'BACKUP';

export const SettingsView: React.FC<Props> = ({
  settings,
  company,
  ptSlabs,
  taxSlabs,
  onRefresh,
  onOpenTestsModal
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('STATUTORY');

  // Local state for edits
  const [localSettings, setLocalSettings] = useState<PayrollSettings>(settings);
  const [localCompany, setLocalCompany] = useState<Company>(
    company || {
      id: 'comp_default',
      name: 'Demo Industries Private Limited',
      legal_name: 'Demo Industries Private Limited',
      address: 'Unit 402, 4th Floor, Prestige Tech Park',
      city: 'Bengaluru',
      state: 'Karnataka',
      pincode: '560103',
      pan: 'AABCC1234D',
      gstin: '29AABCC1234D1Z5',
      tan: 'BLRC12345E',
      pf_code: 'KN/BNG/0098765/000',
      esic_code: '51000987650001001',
      email: 'payroll@demo.example',
      phone: '+91 80 4123 4567'
    }
  );
  const [localPTSlabs, setLocalPTSlabs] = useState<PTSlab[]>(ptSlabs);
  const [localTaxSlabs, setLocalTaxSlabs] = useState<TDSSlab[]>(taxSlabs);

  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // Sync state if props refresh
  React.useEffect(() => {
    setLocalSettings(settings);
    if (company) setLocalCompany(company);
    setLocalPTSlabs(ptSlabs);
    setLocalTaxSlabs(taxSlabs);
  }, [settings, company, ptSlabs, taxSlabs]);

  const showSuccess = (msg: string) => {
    setSaveMessage(msg);
    setTimeout(() => setSaveMessage(null), 4000);
  };

  // Save Statutory Settings
  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      await api.updateSettings(localSettings);
      showSuccess('Statutory parameters saved successfully.');
      onRefresh();
    } catch (err: any) {
      alert(`Error saving settings: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Reset to Defaults
  const handleResetDefaults = async () => {
    if (confirm('Reset all statutory parameters (PF, ESIC, Salary split, Gratuity, TDS) to government defaults?')) {
      setSaving(true);
      try {
        await api.resetSettings();
        await api.updatePTSlabs(DEFAULT_PT_SLABS);
        await api.updateTaxSlabs(DEFAULT_TAX_SLABS);
        showSuccess('Reset to statutory defaults completed successfully.');
        onRefresh();
      } catch (err: any) {
        alert(err.message);
      } finally {
        setSaving(false);
      }
    }
  };

  // Save Company Profile
  const handleSaveCompany = async () => {
    setSaving(true);
    try {
      await api.updateCompany(localCompany);
      showSuccess('Company profile and statutory codes updated.');
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Save PT Slabs
  const handleSavePTSlabs = async () => {
    setSaving(true);
    try {
      await api.updatePTSlabs(localPTSlabs);
      showSuccess('Professional Tax slabs updated successfully.');
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAddPTSlab = () => {
    setLocalPTSlabs([
      ...localPTSlabs,
      {
        id: `pt_${Date.now()}`,
        state: 'Maharashtra',
        salary_from: 0,
        salary_to: 10000,
        monthly_pt: 200,
        effective_from: '2020-04-01',
        effective_to: '2099-03-31'
      }
    ]);
  };

  const handleDeletePTSlab = (index: number) => {
    setLocalPTSlabs(localPTSlabs.filter((_, idx) => idx !== index));
  };

  // Save Tax Slabs
  const handleSaveTaxSlabs = async () => {
    setSaving(true);
    try {
      await api.updateTaxSlabs(localTaxSlabs);
      showSuccess('Income Tax TDS slabs updated successfully.');
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Backup Import
  const handleBackupUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (confirm(`Restore database from ${file.name}? This will overwrite all tables in the local SQLite database.`)) {
        setSaving(true);
        const res = await api.importBackup(parsed.data || parsed);
        showSuccess(res.message || 'Database restored successfully!');
        onRefresh();
      }
    } catch (err: any) {
      alert(`Invalid backup JSON file: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200/90 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900">
              System Settings & Statutory Config
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
              Deterministic Rules
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure statutory salary splits, PF & ESIC ceilings, State PT slabs, New Regime TDS rules, and database backups
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={onOpenTestsModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-semibold border border-indigo-200 transition"
          >
            <TestTube2 className="w-4 h-4" />
            <span>Verify Calculation Suite</span>
          </button>

          <button
            onClick={handleResetDefaults}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-semibold border border-rose-200 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset to Defaults</span>
          </button>
        </div>
      </div>

      {saveMessage && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-semibold text-emerald-800 flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{saveMessage}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-200 bg-white px-4 rounded-t-xl gap-2 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('STATUTORY')}
          className={`py-3.5 px-4 border-b-2 transition ${
            activeTab === 'STATUTORY'
              ? 'border-emerald-600 text-emerald-700 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Statutory Parameters (PF, ESIC, Gratuity)
        </button>

        <button
          onClick={() => setActiveTab('PT_SLABS')}
          className={`py-3.5 px-4 border-b-2 transition ${
            activeTab === 'PT_SLABS'
              ? 'border-emerald-600 text-emerald-700 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Professional Tax Slabs ({localPTSlabs.length})
        </button>

        <button
          onClick={() => setActiveTab('TAX_SLABS')}
          className={`py-3.5 px-4 border-b-2 transition ${
            activeTab === 'TAX_SLABS'
              ? 'border-emerald-600 text-emerald-700 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Income Tax Slabs (TDS)
        </button>

        <button
          onClick={() => setActiveTab('COMPANY')}
          className={`py-3.5 px-4 border-b-2 transition ${
            activeTab === 'COMPANY'
              ? 'border-emerald-600 text-emerald-700 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Company Profile & Statutory IDs
        </button>

        <button
          onClick={() => setActiveTab('BACKUP')}
          className={`py-3.5 px-4 border-b-2 transition ${
            activeTab === 'BACKUP'
              ? 'border-emerald-600 text-emerald-700 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Local Database & JSON Backup
        </button>
      </div>

      {/* Tab 1: Statutory Parameters */}
      {activeTab === 'STATUTORY' && (
        <div className="bg-white p-6 rounded-b-xl border border-t-0 border-slate-200 shadow-xs space-y-6 text-xs">
          
          {/* Section 1: Salary Split */}
          <div>
            <h3 className="font-bold text-slate-900 text-sm mb-3">1. Simple Salary Split Rules</h3>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Basic % (Default: 45%)</label>
                <input
                  type="number"
                  value={localSettings.simple_basic_pct}
                  onChange={e => setLocalSettings({ ...localSettings, simple_basic_pct: Number(e.target.value) })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm font-bold"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-semibold mb-1">DA % (Default: 5%)</label>
                <input
                  type="number"
                  value={localSettings.simple_da_pct}
                  onChange={e => setLocalSettings({ ...localSettings, simple_da_pct: Number(e.target.value) })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm font-bold"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-semibold mb-1">HRA % (Default: 20%)</label>
                <input
                  type="number"
                  value={localSettings.simple_hra_pct}
                  onChange={e => setLocalSettings({ ...localSettings, simple_hra_pct: Number(e.target.value) })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm font-bold"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Special Allowance % (Remainder)</label>
                <input
                  type="number"
                  value={localSettings.simple_special_pct}
                  onChange={e => setLocalSettings({ ...localSettings, simple_special_pct: Number(e.target.value) })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm font-bold"
                />
              </div>
            </div>
            <div className="mt-2 text-[11px] text-slate-500">
              * The engine strictly enforces: <strong className="text-slate-800">Basic + DA ≥ 50%</strong> of gross salary. Any rounding difference reconciles to Special Allowance.
            </div>
          </div>

          {/* Section 2: Provident Fund */}
          <div className="pt-4 border-t border-slate-200">
            <h3 className="font-bold text-slate-900 text-sm mb-3">2. Provident Fund (EPF & EPS) Statutory Parameters</h3>
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-4 p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Employee PF %</label>
                <input
                  type="number"
                  value={localSettings.pf_employee_pct}
                  onChange={e => setLocalSettings({ ...localSettings, pf_employee_pct: Number(e.target.value) })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm font-bold"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Employer PF %</label>
                <input
                  type="number"
                  value={localSettings.pf_employer_pct}
                  onChange={e => setLocalSettings({ ...localSettings, pf_employer_pct: Number(e.target.value) })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm font-bold"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Wage Ceiling (₹)</label>
                <input
                  type="number"
                  value={localSettings.pf_wage_ceiling}
                  onChange={e => setLocalSettings({ ...localSettings, pf_wage_ceiling: Number(e.target.value) })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm font-bold"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-semibold mb-1">EPS Pension %</label>
                <input
                  type="number"
                  step="0.01"
                  value={localSettings.pf_eps_pct}
                  onChange={e => setLocalSettings({ ...localSettings, pf_eps_pct: Number(e.target.value) })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm font-bold"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-semibold mb-1">EPS Cap (₹)</label>
                <input
                  type="number"
                  value={localSettings.pf_eps_ceiling}
                  onChange={e => setLocalSettings({ ...localSettings, pf_eps_ceiling: Number(e.target.value) })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm font-bold"
                />
              </div>
            </div>
          </div>

          {/* Section 3: ESIC & Gratuity */}
          <div className="pt-4 border-t border-slate-200">
            <h3 className="font-bold text-slate-900 text-sm mb-3">3. ESIC & Gratuity Statutory Accruals</h3>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Employee ESIC %</label>
                <input
                  type="number"
                  step="0.01"
                  value={localSettings.esic_employee_pct}
                  onChange={e => setLocalSettings({ ...localSettings, esic_employee_pct: Number(e.target.value) })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm font-bold"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Employer ESIC %</label>
                <input
                  type="number"
                  step="0.01"
                  value={localSettings.esic_employer_pct}
                  onChange={e => setLocalSettings({ ...localSettings, esic_employer_pct: Number(e.target.value) })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm font-bold"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-semibold mb-1">ESIC Salary Ceiling (₹)</label>
                <input
                  type="number"
                  value={localSettings.esic_salary_ceiling}
                  onChange={e => setLocalSettings({ ...localSettings, esic_salary_ceiling: Number(e.target.value) })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm font-bold"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Gratuity Formula</label>
                <div className="p-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800">
                  (Wages × 15) ÷ 26 ÷ 12
                </div>
              </div>
            </div>
          </div>

          {/* Section 4: 50% Wage Rule */}
          <div className="pt-4 border-t border-slate-200">
            <label className="flex items-start gap-3 p-4 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer">
              <input
                type="checkbox"
                checked={localSettings.wage_rule_50_pct_enabled}
                onChange={e => setLocalSettings({ ...localSettings, wage_rule_50_pct_enabled: e.target.checked })}
                className="w-4 h-4 text-emerald-600 rounded mt-0.5 focus:ring-emerald-500"
              />
              <div>
                <span className="font-bold text-slate-900 text-sm block">Enforce 50% Wage Rule under Code on Wages</span>
                <span className="text-slate-500 text-xs">
                  If non-wage components exceed 50% of total earnings, the excess is automatically added to the statutory PF/ESIC/gratuity wage base.
                </span>
              </div>
            </label>
          </div>

          <div className="pt-4 flex justify-end">
            <button
              onClick={handleSaveSettings}
              disabled={saving}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs shadow-xs transition"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving Changes...' : 'Save Statutory Parameters'}</span>
            </button>
          </div>

        </div>
      )}

      {/* Tab 2: PT Slabs */}
      {activeTab === 'PT_SLABS' && (
        <div className="bg-white p-6 rounded-b-xl border border-t-0 border-slate-200 shadow-xs space-y-4 text-xs">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Professional Tax (PT) Slabs by State</h3>
              <p className="text-slate-500 text-xs">Matches employee state and monthly gross earnings</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleAddPTSlab}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg font-semibold border border-slate-300"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add PT Slab</span>
              </button>
              <button
                onClick={handleSavePTSlabs}
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold shadow-xs"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save PT Slabs</span>
              </button>
            </div>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600 uppercase text-[11px]">
                <tr>
                  <th className="py-2.5 px-3">State</th>
                  <th className="py-2.5 px-3 text-right">Salary From (₹)</th>
                  <th className="py-2.5 px-3 text-right">Salary To (₹)</th>
                  <th className="py-2.5 px-3 text-right">Monthly PT (₹)</th>
                  <th className="py-2.5 px-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {localPTSlabs.map((s, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="py-2 px-3">
                      <input
                        type="text"
                        value={s.state}
                        onChange={e => {
                          const updated = [...localPTSlabs];
                          updated[idx].state = e.target.value;
                          setLocalPTSlabs(updated);
                        }}
                        className="px-2 py-1 border border-slate-200 rounded text-xs font-semibold"
                      />
                    </td>
                    <td className="py-2 px-3 text-right">
                      <input
                        type="number"
                        value={s.salary_from}
                        onChange={e => {
                          const updated = [...localPTSlabs];
                          updated[idx].salary_from = Number(e.target.value);
                          setLocalPTSlabs(updated);
                        }}
                        className="px-2 py-1 border border-slate-200 rounded text-xs text-right w-28"
                      />
                    </td>
                    <td className="py-2 px-3 text-right">
                      <input
                        type="number"
                        value={s.salary_to}
                        onChange={e => {
                          const updated = [...localPTSlabs];
                          updated[idx].salary_to = Number(e.target.value);
                          setLocalPTSlabs(updated);
                        }}
                        className="px-2 py-1 border border-slate-200 rounded text-xs text-right w-28"
                      />
                    </td>
                    <td className="py-2 px-3 text-right">
                      <input
                        type="number"
                        value={s.monthly_pt}
                        onChange={e => {
                          const updated = [...localPTSlabs];
                          updated[idx].monthly_pt = Number(e.target.value);
                          setLocalPTSlabs(updated);
                        }}
                        className="px-2 py-1 border border-slate-200 rounded text-xs text-right font-bold text-purple-700 w-24"
                      />
                    </td>
                    <td className="py-2 px-3 text-center">
                      <button
                        onClick={() => handleDeletePTSlab(idx)}
                        className="p-1 text-rose-500 hover:bg-rose-50 rounded"
                        title="Delete Slab"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Tax Slabs */}
      {activeTab === 'TAX_SLABS' && (
        <div className="bg-white p-6 rounded-b-xl border border-t-0 border-slate-200 shadow-xs space-y-6 text-xs">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Income Tax / TDS Calculation Rules</h3>
                <p className="text-slate-500 text-xs">Tax Year 2026-27 - new regime (rebate with marginal relief) and old regime</p>
              </div>
              <button
                onClick={handleSaveTaxSlabs}
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold shadow-xs"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Tax Configuration</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 p-4 bg-slate-50 border border-slate-200 rounded-xl mb-4">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Tax Assessment Year</label>
                <input
                  type="text"
                  value={localSettings.tax_year}
                  onChange={e => setLocalSettings({ ...localSettings, tax_year: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm font-bold"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Standard Deduction (₹)</label>
                <input
                  type="number"
                  value={localSettings.standard_deduction}
                  onChange={e => setLocalSettings({ ...localSettings, standard_deduction: Number(e.target.value) })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm font-bold"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Nil-Tax Threshold (₹)</label>
                <input
                  type="number"
                  value={localSettings.nil_tax_threshold}
                  onChange={e => setLocalSettings({ ...localSettings, nil_tax_threshold: Number(e.target.value) })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm font-bold text-emerald-700"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Health & Edu Cess %</label>
                <input
                  type="number"
                  value={localSettings.cess_pct}
                  onChange={e => setLocalSettings({ ...localSettings, cess_pct: Number(e.target.value) })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm font-bold"
                />
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600 uppercase text-[11px]">
                  <tr>
                    <th className="py-2.5 px-3">Tax Year</th>
                    <th className="py-2.5 px-3">Regime</th>
                    <th className="py-2.5 px-3 text-right">Income From (₹)</th>
                    <th className="py-2.5 px-3 text-right">Income To (₹)</th>
                    <th className="py-2.5 px-3 text-right">Tax Rate %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {localTaxSlabs.map((s, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="py-2 px-3 font-semibold text-slate-800">{s.tax_year}</td>
                      <td className="py-2 px-3 font-semibold text-indigo-700">{s.regime}</td>
                      <td className="py-2 px-3 text-right font-mono">{formatIndianCurrency(s.from_amount, false)}</td>
                      <td className="py-2 px-3 text-right font-mono">{s.to_amount >= 999999999 ? 'Above' : formatIndianCurrency(s.to_amount, false)}</td>
                      <td className="py-2 px-3 text-right">
                        <input
                          type="number"
                          value={s.rate_percentage}
                          onChange={e => {
                            const updated = [...localTaxSlabs];
                            updated[idx].rate_percentage = Number(e.target.value);
                            setLocalTaxSlabs(updated);
                          }}
                          className="px-2 py-1 border border-slate-200 rounded text-xs text-right font-bold w-20"
                        />
                        %
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

          </div>
        </div>
      )}

      {/* Tab 4: Company Profile */}
      {activeTab === 'COMPANY' && (
        <div className="bg-white p-6 rounded-b-xl border border-t-0 border-slate-200 shadow-xs space-y-4 text-xs">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm">Company Legal Profile & Statutory Identifiers</h3>
            <button
              onClick={handleSaveCompany}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold shadow-xs"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Company Profile</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Company Display Name</label>
              <input
                type="text"
                value={localCompany.name}
                onChange={e => setLocalCompany({ ...localCompany, name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Legal Registered Entity Name</label>
              <input
                type="text"
                value={localCompany.legal_name}
                onChange={e => setLocalCompany({ ...localCompany, legal_name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-slate-700 font-semibold mb-1">Registered Office Address</label>
              <input
                type="text"
                value={localCompany.address}
                onChange={e => setLocalCompany({ ...localCompany, address: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">City</label>
              <input
                type="text"
                value={localCompany.city}
                onChange={e => setLocalCompany({ ...localCompany, city: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">State & PIN Code</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={localCompany.state}
                  onChange={e => setLocalCompany({ ...localCompany, state: e.target.value })}
                  className="w-2/3 px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
                <input
                  type="text"
                  value={localCompany.pincode}
                  onChange={e => setLocalCompany({ ...localCompany, pincode: e.target.value })}
                  placeholder="PIN"
                  className="w-1/3 px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Corporate GSTIN</label>
              <input
                type="text"
                value={localCompany.gstin}
                onChange={e => setLocalCompany({ ...localCompany, gstin: e.target.value.toUpperCase() })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm uppercase"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Company PAN</label>
              <input
                type="text"
                value={localCompany.pan}
                onChange={e => setLocalCompany({ ...localCompany, pan: e.target.value.toUpperCase() })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm uppercase"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">EPFO Establishment Code</label>
              <input
                type="text"
                value={localCompany.pf_code}
                onChange={e => setLocalCompany({ ...localCompany, pf_code: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">ESIC Employer Code</label>
              <input
                type="text"
                value={localCompany.esic_code}
                onChange={e => setLocalCompany({ ...localCompany, esic_code: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: Local Database & JSON Backup */}
      {activeTab === 'BACKUP' && (
        <div className="bg-white p-6 rounded-b-xl border border-t-0 border-slate-200 shadow-xs space-y-6 text-xs">
          
          <div>
            <h3 className="font-bold text-slate-900 text-sm mb-1">Local SQLite Offline Database Management</h3>
            <p className="text-slate-500 text-xs">
              This system operates 100% locally on this computer without cloud or external services. Export complete backups regularly to preserve records.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            
            {/* Native SQLite WAL Backup Card */}
            <div className="p-5 border border-emerald-200 rounded-xl space-y-3 bg-emerald-50/50">
              <div className="p-3 bg-emerald-100 text-emerald-800 rounded-lg w-fit">
                <Database className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-slate-900 text-sm">Create Native SQLite Backup (.sqlite)</h4>
              <p className="text-slate-600 text-xs">
                Generates a live, WAL-consistent binary backup snapshot of the SQLite database using SQLite Online Backup API.
              </p>
              <button
                onClick={async () => {
                  try {
                    const res = await api.backupNativeDatabase();
                    alert(`Native SQLite backup created successfully!\nLocation: ${res.backupFile} (${(res.fileSizeBytes / 1024).toFixed(1)} KB)`);
                  } catch (e: any) {
                    alert(`Backup error: ${e.message}`);
                  }
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-semibold text-xs transition"
              >
                <Database className="w-4 h-4" />
                <span>Create Live SQLite Snapshot</span>
              </button>
            </div>

            {/* Export Card */}
            <div className="p-5 border border-slate-200 rounded-xl space-y-3 bg-slate-50">
              <div className="p-3 bg-slate-200 text-slate-800 rounded-lg w-fit">
                <Download className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-slate-900 text-sm">Export Database (JSON)</h4>
              <p className="text-slate-600 text-xs">
                Downloads a complete portable JSON snapshot of all relational tables: Companies, Employees, Attendance, Payroll, Settings, and Slabs.
              </p>
              <button
                onClick={() => api.exportBackup()}
                className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-semibold text-xs transition"
              >
                <Download className="w-4 h-4" />
                <span>Export JSON Backup File</span>
              </button>
            </div>

            {/* Import Card */}
            <div className="p-5 border border-slate-200 rounded-xl space-y-3 bg-slate-50">
              <div className="p-3 bg-blue-100 text-blue-800 rounded-lg w-fit">
                <Upload className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-slate-900 text-sm">Restore from JSON Backup</h4>
              <p className="text-slate-600 text-xs">
                Restores complete tables into the embedded SQLite database. Use this when migrating data or recovering from a previous state.
              </p>
              <label className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-xs transition cursor-pointer">
                <Upload className="w-4 h-4" />
                <span>Select JSON Backup</span>
                <input
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={handleBackupUpload}
                />
              </label>
            </div>

          </div>

          {/* Database Diagnostics */}
          <div className="p-4 border border-slate-200 rounded-xl bg-white space-y-2">
            <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
              <Database className="w-4 h-4 text-emerald-600" />
              <span>Database Status & Engine Health</span>
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-1">
              <div className="p-2.5 bg-slate-50 rounded-lg">
                <span className="text-slate-500">Storage Engine:</span>
                <div className="font-bold text-slate-900">Native SQLite (better-sqlite3)</div>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-lg">
                <span className="text-slate-500">Journal Mode:</span>
                <div className="font-bold text-emerald-700">WAL (Write-Ahead Logging)</div>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-lg">
                <span className="text-slate-500">Persisted Disk File:</span>
                <div className="font-mono font-bold text-slate-900">data/payroll_compli.sqlite</div>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-lg">
                <span className="text-slate-500">Network Dependency:</span>
                <div className="font-bold text-emerald-700">0% (Completely Offline)</div>
              </div>
            </div>
          </div>

        </div>
      )}

    </div>
  );
};
