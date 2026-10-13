/**
 * OneHR Payroll Manager - Frontend API Client
 * Interfaces with Express + SQLite Backend
 */

import {
  Company,
  Employee,
  PayrollRecord,
  PayrollRun,
  PayrollRunStatus,
  PayrollSettings,
  PTSlab,
  TDSSlab
} from '../types/payroll';

const API_BASE = '/api';

export interface SessionUser {
  username: string;
  display_name: string;
  role: 'ADMIN' | 'MAKER' | 'CHECKER';
}

export interface AuditEntry {
  id: number;
  at: string;
  username: string;
  role: string;
  action: string;
  detail: string;
}

export interface PayrollReview {
  month: string;
  previous_month: string | null;
  totals: Record<string, { current: number; previous: number | null; change: number | null; change_pct: number | null }>;
  exceptions: Array<{ severity: 'HIGH' | 'MEDIUM' | 'INFO'; employee_id: string; check: string; detail: string }>;
  ai_configured: boolean;
}

export interface TaxWorksheet {
  employee_id: string;
  month: string;
  period_from: string;
  period_to: string;
  components: Array<{ label: string; gross: number; exempt: number; taxable: number }>;
  gross_salary: number;
  monthly_tds: Array<{ month: string; tds: number }>;
  tax_deducted_till_date: number;
  details: import('../types/payroll').TDSCalculationDetail;
}

/** Fired when the server says the session has ended, so the app can show the sign-in screen */
export const SESSION_EXPIRED_EVENT = 'payroll-session-expired';

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers
    },
    ...options
  });

  if (res.status === 401 && !url.startsWith('/auth/')) {
    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
  }

  if (!res.ok) {
    let errMsg = `Request failed: ${res.status} ${res.statusText}`;
    try {
      const errData = await res.json();
      if (errData?.error) errMsg = errData.error;
    } catch {}
    throw new Error(errMsg);
  }

  return res.json() as Promise<T>;
}

export const api = {
  // Sign-in & audit trail
  async me() {
    return fetchJson<{ user: SessionUser }>('/auth/me');
  },

  async login(username: string, password: string) {
    return fetchJson<{ success: boolean; user: SessionUser }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
  },

  async logout() {
    return fetchJson<{ success: boolean }>('/auth/logout', { method: 'POST' });
  },

  async getDemoInfo() {
    return fetchJson<{ demo: boolean; users: Array<{ username: string; password: string; role: string }> }>('/auth/demo');
  },

  async getAuditLog() {
    return fetchJson<AuditEntry[]>('/audit');
  },

  // AI-assisted review
  async getPayrollReview(month: string) {
    return fetchJson<PayrollReview>(`/ai/review/${month}`);
  },

  async getAiCommentary(month: string) {
    return fetchJson<{ commentary: string }>('/ai/commentary', {
      method: 'POST',
      body: JSON.stringify({ month })
    });
  },

  async explainPayslip(month: string, employee_id: string, question: string) {
    return fetchJson<{ answer: string }>('/ai/explain', {
      method: 'POST',
      body: JSON.stringify({ month, employee_id, question })
    });
  },

  // Health & Verification
  async checkHealth() {
    return fetchJson<{ status: string; app: string; timestamp: string }>('/health');
  },

  async runTests() {
    return fetchJson<{
      passed: boolean;
      total: number;
      passedCount: number;
      failedCount: number;
      results: Array<{ suiteName: string; testName: string; passed: boolean; message: string; expected?: any; actual?: any }>;
    }>('/tests/run', { method: 'POST' });
  },

  // Company
  async getCompany() {
    return fetchJson<Company>('/company');
  },

  async updateCompany(data: Company) {
    return fetchJson<{ success: boolean; message: string }>('/company', {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  // Settings
  async getSettings() {
    return fetchJson<PayrollSettings>('/settings');
  },

  async updateSettings(data: PayrollSettings) {
    return fetchJson<{ success: boolean; message: string }>('/settings', {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  async resetSettings() {
    return fetchJson<{ success: boolean; message: string }>('/settings/reset', {
      method: 'POST'
    });
  },

  // PT Slabs
  async getPTSlabs() {
    return fetchJson<PTSlab[]>('/pt-slabs');
  },

  async updatePTSlabs(slabs: PTSlab[]) {
    return fetchJson<{ success: boolean; message: string }>('/pt-slabs', {
      method: 'PUT',
      body: JSON.stringify(slabs)
    });
  },

  // Tax Slabs
  async getTaxSlabs() {
    return fetchJson<TDSSlab[]>('/tax-slabs');
  },

  async updateTaxSlabs(slabs: TDSSlab[]) {
    return fetchJson<{ success: boolean; message: string }>('/tax-slabs', {
      method: 'PUT',
      body: JSON.stringify(slabs)
    });
  },

  // Employees
  async getEmployees() {
    return fetchJson<Employee[]>('/employees');
  },

  async createEmployee(data: Partial<Employee>) {
    return fetchJson<{ success: boolean; employee_id: string; message: string }>('/employees', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async updateEmployee(id: string, data: Partial<Employee>) {
    return fetchJson<{ success: boolean; message: string }>(`/employees/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  async deleteEmployee(id: string) {
    return fetchJson<{ success: boolean; message: string }>(`/employees/${id}`, {
      method: 'DELETE'
    });
  },

  async bulkImportEmployees(rows: any[], mode: 'SIMPLE' | 'DETAILED') {
    return fetchJson<{
      total: number;
      valid: number;
      warnings: number;
      errors: number;
      details: Array<{ row: number; status: 'VALID' | 'WARNING' | 'ERROR'; message: string }>;
    }>('/employees/bulk-import', {
      method: 'POST',
      body: JSON.stringify({ rows, mode })
    });
  },

  // Attendance
  async getAttendance(month: string) {
    return fetchJson<any[]>(`/attendance?month=${month}`);
  },

  async updateAttendance(payload: {
    employee_id: string;
    payroll_month: string;
    days_map: Record<number, string>;
    overtime_amount?: number;
    bonus_amount?: number;
    remarks?: string;
  }) {
    return fetchJson<{ success: boolean; summary: any }>('/attendance/update', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async bulkImportAttendance(month: string, rows: any[]) {
    return fetchJson<{
      total: number;
      valid: number;
      warnings: number;
      errors: number;
      details: Array<{ row: number; status: 'VALID' | 'WARNING' | 'ERROR'; message: string }>;
    }>('/attendance/bulk-import', {
      method: 'POST',
      body: JSON.stringify({ month, rows })
    });
  },

  // Payroll Runs & Records
  async getPayrollRuns() {
    return fetchJson<PayrollRun[]>('/payroll/runs');
  },

  async getPayrollRun(month: string) {
    return fetchJson<{ run: PayrollRun | null; records: PayrollRecord[] }>(`/payroll/run/${month}`);
  },

  async getTaxWorksheet(month: string, employeeId: string) {
    return fetchJson<TaxWorksheet>(`/payroll/worksheet/${month}/${encodeURIComponent(employeeId)}`);
  },

  async processPayroll(month: string) {
    return fetchJson<{
      success: boolean;
      message: string;
      count: number;
      summary: any;
    }>('/payroll/process', {
      method: 'POST',
      body: JSON.stringify({ month })
    });
  },

  async lockPayroll(month: string) {
    return fetchJson<{ success: boolean; message: string }>('/payroll/lock', {
      method: 'POST',
      body: JSON.stringify({ month })
    });
  },

  async unlockPayroll(month: string, reason: string) {
    return fetchJson<{ success: boolean; message: string }>('/payroll/unlock', {
      method: 'POST',
      body: JSON.stringify({ month, reason })
    });
  },

  async setPayrollStatus(month: string, status: PayrollRunStatus) {
    return fetchJson<{ success: boolean; status: PayrollRunStatus }>('/payroll/status', {
      method: 'POST',
      body: JSON.stringify({ month, status })
    });
  },

  // Backup & Restore
  async exportBackup() {
    const res = await fetch(`${API_BASE}/backup/export`);
    if (!res.ok) {
      const errData = await res.json().catch(() => null);
      throw new Error(errData?.error || 'Backup export failed');
    }
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `onehr_payroll_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },

  async importBackup(jsonData: any) {
    return fetchJson<{ success: boolean; message: string }>('/backup/import', {
      method: 'POST',
      body: JSON.stringify({ data: jsonData })
    });
  },

  async getDbHealth() {
    return fetchJson<any>('/db/health');
  },

  async backupNativeDatabase() {
    return fetchJson<{ success: boolean; message: string; backupFile: string; fileSizeBytes: number }>('/backup/database', {
      method: 'POST'
    });
  }
};

