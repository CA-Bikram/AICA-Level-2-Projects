/**
 * OneHR Payroll Manager - Attendance Repository
 * Data Access Layer for Attendance with atomic transactions and validation.
 */

import { getDb, runInTransaction } from '../database';
import {
  calculateAttendanceSummary,
  getEmploymentWindow,
  validateAttendanceImportRow
} from '../../../services/payrollEngine';
import { AttendanceCode } from '../../../types/payroll';
import { getDaysInPayrollMonth } from '../../../utils/indianNumber';

export interface AttendanceRowModel {
  id: string;
  employee_id: string;
  payroll_month: string;
  days_json: string;
  overtime_amount: number;
  bonus_amount: number;
  remarks?: string;
  present_days: number;
  half_days: number;
  paid_leaves: number;
  weekly_offs: number;
  public_holidays: number;
  lop_days: number;
  days_payable: number;
  // Joined employee fields
  employee_name?: string;
  department?: string;
  designation?: string;
}

export const attendanceRepository = {
  /**
   * One row per employee in service during the month, whether or not attendance has been
   * entered yet. has_record = false means attendance is still to be marked or uploaded.
   * from_day / to_day give the service window for mid-month joiners and leavers.
   */
  getByMonth(month: string): any[] {
    const db = getDb();
    const calendarDays = getDaysInPayrollMonth(month);
    const employees = db.prepare('SELECT * FROM employees ORDER BY name ASC').all() as any[];
    const records = db.prepare('SELECT * FROM attendance WHERE payroll_month = ?').all(month) as any[];
    const recordMap = new Map<string, any>(records.map(r => [r.employee_id, r]));

    const rows: any[] = [];
    for (const e of employees) {
      const window = getEmploymentWindow(e, month);
      const rec = recordMap.get(e.employee_id);
      const separated = e.employment_status === 'TERMINATED' || e.employment_status === 'INACTIVE';
      const inService = window.days > 0 && (!separated || Boolean(e.date_of_leaving));
      if (!inService && !rec) continue;

      const base = {
        employee_id: e.employee_id,
        employee_name: e.name,
        department: e.department,
        designation: e.designation,
        payroll_month: month,
        from_day: window.days > 0 ? window.fromDay : 1,
        to_day: window.days > 0 ? window.toDay : calendarDays
      };

      if (rec) {
        rows.push({ ...rec, ...base, has_record: true, days_map: JSON.parse(rec.days_json || '{}') });
      } else {
        rows.push({
          ...base,
          has_record: false,
          days_map: {},
          overtime_amount: 0,
          bonus_amount: 0,
          remarks: '',
          present_days: 0,
          half_days: 0,
          paid_leaves: 0,
          weekly_offs: 0,
          public_holidays: 0,
          lop_days: 0,
          days_payable: 0
        });
      }
    }
    return rows;
  },

  /** Service window of an employee in a month (full month if the employee is not found) */
  getWindow(empId: string, month: string): { fromDay: number; toDay: number } {
    const calendarDays = getDaysInPayrollMonth(month);
    const emp = getDb().prepare('SELECT date_of_joining, date_of_leaving FROM employees WHERE employee_id = ?').get(empId) as any;
    if (!emp) return { fromDay: 1, toDay: calendarDays };
    const window = getEmploymentWindow(emp, month);
    return window.days > 0 ? { fromDay: window.fromDay, toDay: window.toDay } : { fromDay: 1, toDay: calendarDays };
  },

  getRecord(empId: string, month: string): any | null {
    const db = getDb();
    const row = db.prepare(`
      SELECT a.*, e.name as employee_name, e.department, e.designation
      FROM attendance a
      JOIN employees e ON a.employee_id = e.employee_id
      WHERE a.employee_id = ? AND a.payroll_month = ?
    `).get(empId, month) as any;

    if (!row) return null;
    return {
      ...row,
      days_map: JSON.parse(row.days_json || '{}')
    };
  },

  saveRecord(
    empId: string,
    month: string,
    daysMap: Record<number, AttendanceCode>,
    ot: number = 0,
    bonus: number = 0,
    remarks: string = ''
  ) {
    const db = getDb();
    const calendarDays = getDaysInPayrollMonth(month);
    const window = this.getWindow(empId, month);
    const summary = calculateAttendanceSummary(daysMap, calendarDays, window.fromDay, window.toDay);

    const stmt = db.prepare(`
      INSERT OR REPLACE INTO attendance (
        id, employee_id, payroll_month, days_json, overtime_amount, bonus_amount, remarks,
        present_days, half_days, paid_leaves, weekly_offs, public_holidays, lop_days, days_payable
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      `att_${empId}_${month}`,
      empId,
      month,
      JSON.stringify(daysMap),
      ot,
      bonus,
      remarks,
      summary.present_days,
      summary.half_days,
      summary.paid_leaves,
      summary.weekly_offs,
      summary.public_holidays,
      summary.lop_days,
      summary.days_payable
    );

    return summary;
  },

  bulkImport(month: string, rows: any[]) {
    const db = getDb();
    const calendarDays = getDaysInPayrollMonth(month);

    const report = {
      total: rows.length,
      valid: 0,
      warnings: 0,
      errors: 0,
      details: [] as Array<{ row: number; status: 'VALID' | 'WARNING' | 'ERROR'; message: string }>
    };

    // Pre-cache existing employee IDs for fast lookup
    const allEmps = db.prepare('SELECT employee_id FROM employees').all() as { employee_id: string }[];
    const empSet = new Set(allEmps.map(e => e.employee_id));

    // Execute bulk insert inside an atomic transaction
    runInTransaction((txDb) => {
      const insertStmt = txDb.prepare(`
        INSERT OR REPLACE INTO attendance (
          id, employee_id, payroll_month, days_json, overtime_amount, bonus_amount, remarks,
          present_days, half_days, paid_leaves, weekly_offs, public_holidays, lop_days, days_payable
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNum = i + 1;

        const validation = validateAttendanceImportRow(
          row,
          rowNum,
          calendarDays,
          month,
          (id) => empSet.has(id)
        );

        if (validation.status === 'ERROR') {
          report.errors += 1;
          report.details.push({ row: rowNum, status: 'ERROR', message: validation.message });
          continue; // Do NOT insert invalid cell/row
        }

        const { employee_id, daysMap, overtime_amount, bonus_amount, remarks } = validation.sanitizedRow!;
        const window = this.getWindow(employee_id, month);
        const summary = calculateAttendanceSummary(daysMap, calendarDays, window.fromDay, window.toDay);

        insertStmt.run(
          `att_${employee_id}_${month}`,
          employee_id,
          month,
          JSON.stringify(daysMap),
          overtime_amount,
          bonus_amount,
          remarks,
          summary.present_days,
          summary.half_days,
          summary.paid_leaves,
          summary.weekly_offs,
          summary.public_holidays,
          summary.lop_days,
          summary.days_payable
        );

        if (validation.status === 'WARNING') {
          report.warnings += 1;
          report.details.push({ row: rowNum, status: 'WARNING', message: validation.message });
        } else {
          report.valid += 1;
          report.details.push({ row: rowNum, status: 'VALID', message: `Processed attendance for ${employee_id}` });
        }
      }
    });

    return report;
  }
};
