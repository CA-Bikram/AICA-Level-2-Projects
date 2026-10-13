/**
 * OneHR Payroll Manager - Payroll Repository
 * Data Access Layer for Payroll runs and calculations with atomic transactions.
 */

import { getDb, runInTransaction } from '../database';
import {
  calculateAttendanceSummary,
  calculatePayrollForEmployee,
  getEmploymentWindow,
  getTaxYearPosition,
  PayrollContext,
  DEFAULT_PT_SLABS,
  DEFAULT_SETTINGS,
  DEFAULT_TAX_SLABS
} from '../../../services/payrollEngine';
import {
  Employee,
  PayrollRecord,
  PayrollRun,
  PayrollRunStatus,
  PayrollSettings,
  PTSlab,
  TDSSlab
} from '../../../types/payroll';
import { getDaysInPayrollMonth } from '../../../utils/indianNumber';

export const payrollRepository = {
  getRuns(): PayrollRun[] {
    const db = getDb();
    return db.prepare('SELECT * FROM payroll_runs ORDER BY payroll_month DESC').all() as unknown as PayrollRun[];
  },

  getRunByMonth(month: string): { run: PayrollRun | null; records: PayrollRecord[] } {
    const db = getDb();
    const run = db.prepare('SELECT * FROM payroll_runs WHERE payroll_month = ?').get(month) as unknown as PayrollRun | undefined;
    const rows = db.prepare('SELECT * FROM payroll WHERE payroll_month = ? ORDER BY employee_name ASC').all(month) as any[];
    // The TDS working is stored as JSON; hand it back as an object so the explanation screen can show it
    const records = rows.map(row => {
      let tdsDetails = null;
      try {
        tdsDetails = row.tds_details_json ? JSON.parse(row.tds_details_json) : null;
      } catch {
        tdsDetails = null;
      }
      return { ...row, wage_rule_applied: Boolean(row.wage_rule_applied), tds_details: tdsDetails };
    }) as unknown as PayrollRecord[];

    return {
      run: run || null,
      records: records || []
    };
  },

  getRecordByEmpAndMonth(empId: string, month: string): PayrollRecord | null {
    const db = getDb();
    const record = db.prepare('SELECT * FROM payroll WHERE employee_id = ? AND payroll_month = ?').get(empId, month) as unknown as PayrollRecord | undefined;
    return record || null;
  },

  /**
   * Processes or reprocesses payroll for a given month inside an atomic transaction.
   * If any employee calculation fails, the entire transaction is rolled back cleanly.
   */
  processPayroll(month: string): { success: boolean; message: string; count: number; summary: any } {
    const db = getDb();

    // Check if payroll run is locked
    const existingRun = db.prepare('SELECT * FROM payroll_runs WHERE payroll_month = ?').get(month) as PayrollRun | undefined;
    if (existingRun && existingRun.status === 'LOCKED') {
      throw new Error(`Payroll for ${month} is LOCKED. Unlock before reprocessing.`);
    }

    // Load active settings and slabs
    const rawSettings = db.prepare('SELECT * FROM settings LIMIT 1').get() as any;
    const settings: PayrollSettings = rawSettings ? {
      ...rawSettings,
      esic_enabled: Boolean(rawSettings.esic_enabled),
      wage_rule_50_pct_enabled: Boolean(rawSettings.wage_rule_50_pct_enabled)
    } : DEFAULT_SETTINGS;

    const ptSlabs = db.prepare('SELECT * FROM pt_slabs').all() as unknown as PTSlab[];
    const taxSlabs = db.prepare('SELECT * FROM tax_slabs').all() as unknown as TDSSlab[];

    // Everyone in service at any time in the month. An employee marked TERMINATED / INACTIVE is
    // still paid for a final part-month if the date of leaving falls in it; without a date of
    // leaving they are excluded.
    const allEmployees = db.prepare('SELECT * FROM employees ORDER BY employee_id ASC').all() as any[];
    const employees = allEmployees.filter(e => {
      const window = getEmploymentWindow(e, month);
      if (window.days === 0) return false;
      const separated = e.employment_status === 'TERMINATED' || e.employment_status === 'INACTIVE';
      return !separated || Boolean(e.date_of_leaving);
    });

    // Year-to-date figures from earlier processed months of the same tax year (April-March),
    // used to compute TDS on actuals plus projection instead of "this month x 12".
    const taxPos = getTaxYearPosition(month);
    const taxYearStart = `${taxPos.startYear}-04`;
    const ytdRows = db.prepare(`
      SELECT employee_id,
             COUNT(*) as months,
             COALESCE(SUM(gross_earned), 0) as gross,
             COALESCE(SUM(tds), 0) as tds,
             COALESCE(SUM(professional_tax), 0) as pt,
             COALESCE(SUM(employee_pf), 0) as pf
      FROM payroll
      WHERE payroll_month >= ? AND payroll_month < ?
      GROUP BY employee_id
    `).all(taxYearStart, month) as any[];
    const ytdMap = new Map<string, any>(ytdRows.map(r => [r.employee_id, r]));

    // ESIC contribution period (Apr-Sep / Oct-Mar): once covered, coverage runs to the period end
    const esicPeriodStart = taxPos.index <= 6 ? `${taxPos.startYear}-04` : `${taxPos.startYear}-10`;
    const esicRows = db.prepare(`
      SELECT DISTINCT employee_id FROM payroll
      WHERE payroll_month >= ? AND payroll_month < ? AND employee_esic > 0
    `).all(esicPeriodStart, month) as any[];
    const esicCovered = new Set<string>(esicRows.map(r => r.employee_id));
    const attendanceRecords = db.prepare('SELECT * FROM attendance WHERE payroll_month = ?').all(month) as any[];
    const attendanceMap = new Map<string, any>(attendanceRecords.map(a => [a.employee_id, a]));

    const calendarDays = getDaysInPayrollMonth(month);

    return runInTransaction((txDb) => {
      // 1. Clear existing payroll records for this month (Idempotent Overwrite rule)
      txDb.prepare('DELETE FROM payroll WHERE payroll_month = ?').run(month);

      let totalGross = 0;
      let totalDeductions = 0;
      let totalTakeHome = 0;
      let totalEmployerPF = 0;
      let totalEmployerESIC = 0;
      let totalGratuity = 0;
      let totalTDS = 0;
      let totalCompanyCost = 0;

      const insertPayrollStmt = txDb.prepare(`
        INSERT INTO payroll (
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

      for (const rawEmp of employees) {
        const emp: Employee = {
          ...rawEmp,
          pf_applicable: Boolean(rawEmp.pf_applicable),
          esic_applicable: Boolean(rawEmp.esic_applicable),
          professional_tax_applicable: Boolean(rawEmp.professional_tax_applicable),
          income_tax_applicable: Boolean(rawEmp.income_tax_applicable)
        };

        const att = attendanceMap.get(emp.employee_id);
        let daysPayable = calendarDays;
        let presentDays = calendarDays;
        let lopDays = 0;
        let ot = 0;
        let bonus = 0;

        const window = getEmploymentWindow(emp, month);

        if (att) {
          daysPayable = att.days_payable ?? calendarDays;
          presentDays = att.present_days ?? calendarDays;
          lopDays = att.lop_days ?? 0;
          ot = att.overtime_amount || 0;
          bonus = att.bonus_amount || 0;

          // Joiner / leaver: count attendance only inside the service window
          if (window.days < calendarDays) {
            let daysMap: Record<number, any> = {};
            try {
              daysMap = JSON.parse(att.days_json || '{}');
            } catch {
              daysMap = {};
            }
            const summary = calculateAttendanceSummary(daysMap, calendarDays, window.fromDay, window.toDay);
            daysPayable = summary.days_payable;
            presentDays = summary.present_days;
            lopDays = summary.lop_days;
          }
        } else if (window.days < calendarDays) {
          daysPayable = window.days;
          presentDays = window.days;
        }

        const ytd = ytdMap.get(emp.employee_id);
        const context: PayrollContext = {
          ytdGross: ytd?.gross || 0,
          ytdTds: ytd?.tds || 0,
          ytdPT: ytd?.pt || 0,
          ytdPF: ytd?.pf || 0,
          ytdMonthsProcessed: ytd?.months || 0,
          esicCoveredInPeriod: esicCovered.has(emp.employee_id)
        };

        const rec = calculatePayrollForEmployee(
          emp,
          month,
          daysPayable,
          ot,
          bonus,
          settings,
          ptSlabs.length > 0 ? ptSlabs : DEFAULT_PT_SLABS,
          taxSlabs.length > 0 ? taxSlabs : DEFAULT_TAX_SLABS,
          presentDays,
          lopDays,
          context
        );

        insertPayrollStmt.run(
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

        totalGross += rec.gross_earned;
        totalDeductions += rec.total_deductions;
        totalTakeHome += rec.take_home_pay;
        totalEmployerPF += rec.employer_pf;
        totalEmployerESIC += rec.employer_esic;
        totalGratuity += rec.gratuity;
        totalTDS += rec.tds;
        totalCompanyCost += rec.company_cost;
      }

      // 2. Insert or replace payroll_runs record
      const now = new Date().toISOString();
      txDb.prepare(`
        INSERT OR REPLACE INTO payroll_runs (
          id, payroll_month, status, calendar_days, working_days,
          total_employees, processed_employees, total_gross_payroll,
          total_deductions, total_take_home, total_employer_pf,
          total_employer_esic, total_gratuity, total_tds, total_company_cost,
          created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?
        )
      `).run(
        `run_${month.replace('-', '_')}`,
        month,
        'PROCESSED',
        calendarDays,
        calendarDays,
        employees.length,
        employees.length,
        Math.round(totalGross),
        Math.round(totalDeductions),
        Math.round(totalTakeHome),
        Math.round(totalEmployerPF),
        Math.round(totalEmployerESIC),
        Math.round(totalGratuity),
        Math.round(totalTDS),
        Math.round(totalCompanyCost),
        now,
        now
      );

      return {
        success: true,
        message: `Payroll processed successfully for ${month}`,
        count: employees.length,
        summary: {
          totalGross: Math.round(totalGross),
          totalDeductions: Math.round(totalDeductions),
          totalTakeHome: Math.round(totalTakeHome),
          totalCompanyCost: Math.round(totalCompanyCost)
        }
      };
    });
  },

  /**
   * Income tax worksheet for one employee as at a payroll month: salary for the tax year by
   * component (actuals to date + projection), the tax computation, and TDS deducted month by month.
   * The component split always adds up to the annual salary used in the TDS computation.
   */
  getTaxWorksheet(month: string, employeeId: string) {
    const db = getDb();
    const pos = getTaxYearPosition(month);
    const rows = db.prepare(`
      SELECT * FROM payroll
      WHERE employee_id = ? AND payroll_month >= ? AND payroll_month <= ?
      ORDER BY payroll_month ASC
    `).all(employeeId, `${pos.startYear}-04`, month) as any[];

    const current = rows.find(r => r.payroll_month === month);
    if (!current) return null;

    let details: any = {};
    try {
      details = JSON.parse(current.tds_details_json || '{}');
    } catch {
      details = {};
    }

    const futureMonths = Math.max(0, (details.months_remaining ?? 1) - 1);
    const sum = (f: (r: any) => number) => rows.reduce((a, r) => a + (f(r) || 0), 0);
    const line = (label: string, actual: number, fixedMonthly: number) => ({
      label,
      gross: Math.round(actual + fixedMonthly * futureMonths)
    });

    const components = [
      line('Basic', sum(r => r.earned_basic), current.fixed_basic),
      line('Dearness Allowance', sum(r => r.earned_da), current.fixed_da),
      line('House Rent Allowance', sum(r => r.earned_hra), current.fixed_hra),
      line('Conveyance Allowance', sum(r => r.earned_conveyance), current.fixed_conveyance),
      line('Medical Allowance', sum(r => r.earned_medical), current.fixed_medical),
      line('Special Allowance', sum(r => r.earned_special), current.fixed_special),
      line('Variable Payments (overtime, bonus)', sum(r => (r.overtime_amount || 0) + (r.bonus_amount || 0)), 0)
    ];

    // Anything not explained by the component lines (earlier months not processed in this
    // system are estimated at the fixed salary) is shown on its own line so the total ties.
    const annual = Math.round(details.annualized_salary ?? components.reduce((a, c) => a + c.gross, 0));
    const residual = annual - components.reduce((a, c) => a + c.gross, 0);
    if (Math.abs(residual) >= 1) {
      components.push({ label: 'Earlier months not processed here (estimate)', gross: residual });
    }

    return {
      employee_id: employeeId,
      month,
      period_from: `${pos.startYear}-04-01`,
      period_to: `${pos.startYear + 1}-03-31`,
      components: components.filter(c => c.gross !== 0).map(c => ({ ...c, exempt: 0, taxable: c.gross })),
      gross_salary: annual,
      monthly_tds: rows.map(r => ({ month: r.payroll_month, tds: r.tds || 0 })),
      tax_deducted_till_date: Math.round(sum(r => r.tds) - (current.tds || 0)),
      details
    };
  },

  lockPayroll(month: string, user: string = 'HR Admin'): boolean {
    const now = new Date().toISOString();
    return runInTransaction((txDb) => {
      const info = txDb.prepare(`
        UPDATE payroll_runs
        SET status = 'LOCKED', locked_at = ?, locked_by = ?, updated_at = ?
        WHERE payroll_month = ?
      `).run(now, user, now, month);
      return info.changes > 0;
    });
  },

  unlockPayroll(month: string): boolean {
    const now = new Date().toISOString();
    return runInTransaction((txDb) => {
      const info = txDb.prepare(`
        UPDATE payroll_runs
        SET status = 'PROCESSED', locked_at = NULL, locked_by = NULL, updated_at = ?
        WHERE payroll_month = ?
      `).run(now, month);
      return info.changes > 0;
    });
  },

  isLocked(month: string): boolean {
    const run = getDb().prepare('SELECT status FROM payroll_runs WHERE payroll_month = ?').get(month) as { status: string } | undefined;
    return run?.status === 'LOCKED';
  },

  /**
   * Moves a run between working statuses. Locking and unlocking have their own
   * functions (and audit entries), so this can neither lock a run nor change a locked one.
   */
  setPayrollStatus(month: string, status: PayrollRunStatus): boolean {
    if (status === 'LOCKED') {
      throw new Error('Use Lock Payroll to lock a run.');
    }
    if (this.isLocked(month)) {
      throw new Error(`Payroll for ${month} is LOCKED. Unlock it before changing its status.`);
    }
    const now = new Date().toISOString();
    return runInTransaction((txDb) => {
      const info = txDb.prepare(`
        UPDATE payroll_runs
        SET status = ?, updated_at = ?
        WHERE payroll_month = ?
      `).run(status, now, month);
      return info.changes > 0;
    });
  }
};
