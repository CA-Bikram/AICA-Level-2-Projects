/**
 * OneHR Payroll Manager - Database Bridge (Native SQLite)
 * 
 * Provides backwards-compatible API for existing modules while delegating
 * to the robust native SQLite engine (better-sqlite3) in src/backend/db/.
 */

import { getDb as getNativeDb, closeDb, runInTransaction, backupDatabase, getDbHealth } from './db/database';
import { applyMigrations } from './db/migrations';
import { PayrollRecord } from '../types/payroll';

export { getNativeDb, closeDb, runInTransaction, backupDatabase, getDbHealth, applyMigrations };
export * from './db/repositories/employeeRepository';
export * from './db/repositories/attendanceRepository';
export * from './db/repositories/payrollRepository';
export * from './db/repositories/settingsRepository';
export * from './db/repositories/reportRepository';

/**
 * Backwards compatible getDb() returning the better-sqlite3 instance
 */
export async function getDb() {
  const db = getNativeDb();
  applyMigrations(db);
  return db;
}

/**
 * In native SQLite with WAL mode, disk writes and WAL commits are handled
 * automatically by the database engine. persistDb() is retained as a safe no-op.
 */
export function persistDb(): void {
  // No-op for native SQLite: writes are already committed to WAL/disk
}

/**
 * Query helper to run parameterized SELECT statements returning an array of typed objects
 */
export function queryAll<T = any>(db: any, sql: string, params: any[] = []): T[] {
  return db.prepare(sql).all(...params) as T[];
}

/**
 * Query helper to run parameterized SELECT statements returning a single typed object or null
 */
export function queryOne<T = any>(db: any, sql: string, params: any[] = []): T | null {
  const row = db.prepare(sql).get(...params);
  return (row as T) || null;
}

/**
 * Helper to insert or replace a single payroll record
 */
export function insertPayrollRecord(db: any, rec: PayrollRecord) {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO payroll (
      id, employee_id, payroll_month, employee_name, department, designation,
      pan, bank_name, account_number, ifsc, uan, esic_number,
      calendar_days, days_payable, present_days, lop_days,
      fixed_basic, fixed_da, fixed_hra, fixed_conveyance, fixed_medical, fixed_special, fixed_gross,
      earned_basic, earned_da, earned_hra, earned_conveyance, earned_medical, earned_special,
      overtime_amount, bonus_amount, gross_earned,
      wage_rule_excess, wage_rule_applied, eligible_pf_wages, eligible_esic_wages,
      employee_pf, employee_esic, professional_tax, tds, total_deductions,
      take_home_pay, employer_pf, employer_eps, employer_epf, employer_esic, gratuity,
      company_cost, tds_details_json, employer_edli, employer_pf_admin, created_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, datetime('now')
    )
  `);

  stmt.run(
    `pay_${rec.employee_id}_${rec.payroll_month}`,
    rec.employee_id,
    rec.payroll_month,
    rec.employee_name,
    rec.department,
    rec.designation,
    rec.pan,
    rec.bank_name,
    rec.account_number,
    rec.ifsc,
    rec.uan,
    rec.esic_number,
    rec.calendar_days,
    rec.days_payable,
    rec.present_days,
    rec.lop_days,
    rec.fixed_basic,
    rec.fixed_da,
    rec.fixed_hra,
    rec.fixed_conveyance,
    rec.fixed_medical,
    rec.fixed_special,
    rec.fixed_gross,
    rec.earned_basic,
    rec.earned_da,
    rec.earned_hra,
    rec.earned_conveyance,
    rec.earned_medical,
    rec.earned_special,
    rec.overtime_amount,
    rec.bonus_amount,
    rec.gross_earned,
    rec.wage_rule_excess,
    rec.wage_rule_applied ? 1 : 0,
    rec.eligible_pf_wages,
    rec.eligible_esic_wages,
    rec.employee_pf,
    rec.employee_esic,
    rec.professional_tax,
    rec.tds,
    rec.total_deductions,
    rec.take_home_pay,
    rec.employer_pf,
    rec.employer_eps,
    rec.employer_epf,
    rec.employer_esic,
    rec.gratuity,
    rec.company_cost,
    JSON.stringify(rec.tds_details),
    rec.employer_edli || 0,
    rec.employer_pf_admin || 0
  );
}
