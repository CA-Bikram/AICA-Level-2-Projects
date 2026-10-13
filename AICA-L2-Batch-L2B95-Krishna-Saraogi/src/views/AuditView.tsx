/**
 * OneHR Payroll Manager - Audit trail (checker and admin only)
 */

import React, { useEffect, useState } from 'react';
import { History, RefreshCw } from 'lucide-react';
import { api, AuditEntry } from '../services/api';

const ACTION_LABELS: Record<string, string> = {
  LOGIN: 'Signed in',
  LOGOUT: 'Signed out',
  LOGIN_FAILED: 'Failed sign-in',
  DENIED: 'Blocked: role not permitted',
  DEMO_SEED: 'Demo data loaded',
  'POST /api/payroll/process': 'Payroll processed',
  'POST /api/payroll/lock': 'Payroll locked',
  'POST /api/payroll/unlock': 'Payroll unlocked',
  'POST /api/payroll/status': 'Payroll status changed',
  'POST /api/employees': 'Employee created',
  'PUT /api/employees/:id': 'Employee updated',
  'DELETE /api/employees/:id': 'Employee deleted',
  'POST /api/employees/bulk-import': 'Employees imported',
  'POST /api/attendance/update': 'Attendance updated',
  'POST /api/attendance/bulk-import': 'Attendance imported',
  'PUT /api/settings': 'Statutory settings changed',
  'POST /api/settings/reset': 'Statutory settings reset',
  'PUT /api/pt-slabs': 'PT slabs changed',
  'PUT /api/tax-slabs': 'Tax slabs changed',
  'PUT /api/company': 'Company profile changed',
  'GET /api/backup/export': 'Backup exported',
  'POST /api/backup/import': 'Backup restored',
  'POST /api/backup/database': 'Database backup created',
  'POST /api/ai/commentary': 'AI commentary generated',
  'POST /api/ai/explain': 'AI payslip explanation requested'
};

export const AuditView: React.FC = () => {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setEntries(await api.getAuditLog());
    } catch (err: any) {
      setError(err.message || 'Could not load the audit trail');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <History className="w-5 h-5 text-emerald-600" />
            Audit Trail
          </h2>
          <p className="text-xs text-slate-500">Who changed what and when. Latest 200 entries; entries cannot be edited or deleted from the application.</p>
        </div>
        <button
          onClick={load}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold border border-slate-200"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {error && <div className="text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</div>}

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-slate-600 text-left">
            <tr>
              <th className="py-2 px-3 font-semibold">Date & time</th>
              <th className="py-2 px-3 font-semibold">User</th>
              <th className="py-2 px-3 font-semibold">Role</th>
              <th className="py-2 px-3 font-semibold">Action</th>
              <th className="py-2 px-3 font-semibold">Details</th>
            </tr>
          </thead>
          <tbody>
            {entries.map(e => (
              <tr key={e.id} className="border-t border-slate-100">
                <td className="py-2 px-3 whitespace-nowrap font-mono text-slate-600">{new Date(e.at).toLocaleString('en-IN')}</td>
                <td className="py-2 px-3 font-semibold text-slate-800">{e.username}</td>
                <td className="py-2 px-3 text-slate-500">{e.role}</td>
                <td className="py-2 px-3 text-slate-800">{ACTION_LABELS[e.action] || e.action}</td>
                <td className="py-2 px-3 text-slate-600">{e.detail}</td>
              </tr>
            ))}
            {!loading && entries.length === 0 && (
              <tr><td colSpan={5} className="py-6 text-center text-slate-500">No entries yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
