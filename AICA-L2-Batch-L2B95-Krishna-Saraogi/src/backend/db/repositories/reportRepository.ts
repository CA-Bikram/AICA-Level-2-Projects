/**
 * OneHR Payroll Manager - Report & Dashboard Repository
 * Handles aggregated KPIs, chart datasets, and JSON backup/restore.
 */

import { getDb, runInTransaction } from '../database';

export const reportRepository = {
  getDashboardStats() {
    const db = getDb();
    const totalEmps = (db.prepare('SELECT COUNT(*) as c FROM employees').get() as any)?.c || 0;
    const activeEmps = (db.prepare("SELECT COUNT(*) as c FROM employees WHERE employment_status = 'ACTIVE'").get() as any)?.c || 0;
    const latestRun = db.prepare('SELECT * FROM payroll_runs ORDER BY payroll_month DESC LIMIT 1').get() as any;

    const latestMonth = latestRun ? latestRun.payroll_month : new Date().toISOString().slice(0, 7);

    // Summary aggregates for latest run
    const payAgg = db.prepare(`
      SELECT 
        SUM(gross_earned) as total_gross,
        SUM(total_deductions) as total_deductions,
        SUM(take_home_pay) as total_take_home,
        SUM(employer_pf) as total_employer_pf,
        SUM(employer_esic) as total_employer_esic,
        SUM(gratuity) as total_gratuity,
        SUM(tds) as total_tds,
        SUM(company_cost) as total_company_cost
      FROM payroll
      WHERE payroll_month = ?
    `).get(latestMonth) as any;

    // Department breakdown
    const deptBreakdown = db.prepare(`
      SELECT department, COUNT(*) as count, SUM(gross_earned) as total_gross
      FROM payroll
      WHERE payroll_month = ?
      GROUP BY department
    `).all(latestMonth) as any[];

    return {
      totalEmployees: totalEmps,
      activeEmployees: activeEmps,
      latestPayrollMonth: latestMonth,
      latestRun: latestRun || null,
      aggregates: payAgg || {
        total_gross: 0,
        total_deductions: 0,
        total_take_home: 0,
        total_employer_pf: 0,
        total_employer_esic: 0,
        total_gratuity: 0,
        total_tds: 0,
        total_company_cost: 0
      },
      departmentDistribution: deptBreakdown || []
    };
  },

  exportAllToJson() {
    const db = getDb();
    const companies = db.prepare('SELECT * FROM companies').all();
    const settings = db.prepare('SELECT * FROM settings').all();
    const employees = db.prepare('SELECT * FROM employees').all();
    const attendance = db.prepare('SELECT * FROM attendance').all();
    const payroll = db.prepare('SELECT * FROM payroll').all();
    const payroll_runs = db.prepare('SELECT * FROM payroll_runs').all();
    const pt_slabs = db.prepare('SELECT * FROM pt_slabs').all();
    const tax_slabs = db.prepare('SELECT * FROM tax_slabs').all();

    return {
      app: 'OneHR Payroll Manager',
      version: '1.0.0',
      exported_at: new Date().toISOString(),
      data: {
        companies,
        settings,
        employees,
        attendance,
        payroll,
        payroll_runs,
        pt_slabs,
        tax_slabs
      }
    };
  },

  importAllFromJson(data: any) {
    if (!data) {
      throw new Error('Invalid backup file structure: missing data');
    }

    return runInTransaction((txDb) => {
      if (Array.isArray(data.companies) && data.companies.length > 0) {
        txDb.prepare('DELETE FROM companies').run();
        const insert = txDb.prepare(`
          INSERT INTO companies (id, name, legal_name, address, city, state, pincode, pan, gstin, tan, pf_code, esic_code, email, phone, logo_url)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const c of data.companies) {
          insert.run(c.id, c.name, c.legal_name, c.address, c.city, c.state, c.pincode, c.pan, c.gstin, c.tan, c.pf_code, c.esic_code, c.email, c.phone, c.logo_url);
        }
      }

      if (Array.isArray(data.settings) && data.settings.length > 0) {
        txDb.prepare('DELETE FROM settings').run();
        const insert = txDb.prepare(`
          INSERT INTO settings (id, simple_basic_pct, simple_da_pct, simple_hra_pct, simple_special_pct, pf_employee_pct, pf_employer_pct, pf_wage_ceiling, pf_eps_pct, pf_eps_ceiling, pf_applicability_rule, esic_enabled, esic_employee_pct, esic_employer_pct, esic_salary_ceiling, gratuity_days, gratuity_divisor, tax_year, standard_deduction, nil_tax_threshold, cess_pct, wage_rule_50_pct_enabled)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const s of data.settings) {
          insert.run(s.id, s.simple_basic_pct, s.simple_da_pct, s.simple_hra_pct, s.simple_special_pct, s.pf_employee_pct, s.pf_employer_pct, s.pf_wage_ceiling, s.pf_eps_pct, s.pf_eps_ceiling, s.pf_applicability_rule, s.esic_enabled, s.esic_employee_pct, s.esic_employer_pct, s.esic_salary_ceiling, s.gratuity_days, s.gratuity_divisor, s.tax_year, s.standard_deduction, s.nil_tax_threshold, s.cess_pct, s.wage_rule_50_pct_enabled);
        }
      }

      if (Array.isArray(data.employees)) {
        txDb.prepare('DELETE FROM employees').run();
        const insert = txDb.prepare(`
          INSERT INTO employees (id, employee_id, name, pan, date_of_joining, date_of_leaving, department, designation, location, employment_status, bank_name, account_number, ifsc, uan, esic_number, monthly_gross_salary, salary_structure_type, basic, da, hra, conveyance, medical, special_allowance, pf_applicable, esic_applicable, professional_tax_applicable, income_tax_applicable, tax_regime, state, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const e of data.employees) {
          insert.run(e.id, e.employee_id, e.name, e.pan, e.date_of_joining, e.date_of_leaving, e.department, e.designation, e.location, e.employment_status, e.bank_name, e.account_number, e.ifsc, e.uan, e.esic_number, e.monthly_gross_salary, e.salary_structure_type, e.basic, e.da, e.hra, e.conveyance, e.medical, e.special_allowance, e.pf_applicable, e.esic_applicable, e.professional_tax_applicable, e.income_tax_applicable, e.tax_regime, e.state, e.created_at, e.updated_at);
        }
      }

      if (Array.isArray(data.attendance)) {
        txDb.prepare('DELETE FROM attendance').run();
        const insert = txDb.prepare(`
          INSERT INTO attendance (id, employee_id, payroll_month, days_json, overtime_amount, bonus_amount, remarks, present_days, half_days, paid_leaves, weekly_offs, public_holidays, lop_days, days_payable)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const a of data.attendance) {
          insert.run(a.id, a.employee_id, a.payroll_month, a.days_json, a.overtime_amount, a.bonus_amount, a.remarks, a.present_days, a.half_days, a.paid_leaves, a.weekly_offs, a.public_holidays, a.lop_days, a.days_payable);
        }
      }

      if (Array.isArray(data.payroll_runs)) {
        txDb.prepare('DELETE FROM payroll_runs').run();
        const insert = txDb.prepare(`
          INSERT INTO payroll_runs (id, payroll_month, status, calendar_days, working_days, total_employees, processed_employees, total_gross_payroll, total_deductions, total_take_home, total_employer_pf, total_employer_esic, total_gratuity, total_tds, total_company_cost, locked_at, locked_by, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const r of data.payroll_runs) {
          insert.run(r.id, r.payroll_month, r.status, r.calendar_days, r.working_days, r.total_employees, r.processed_employees, r.total_gross_payroll, r.total_deductions, r.total_take_home, r.total_employer_pf, r.total_employer_esic, r.total_gratuity, r.total_tds, r.total_company_cost, r.locked_at, r.locked_by, r.created_at, r.updated_at);
        }
      }

      if (Array.isArray(data.payroll)) {
        txDb.prepare('DELETE FROM payroll').run();
        const insert = txDb.prepare(`
          INSERT INTO payroll (id, employee_id, payroll_month, employee_name, department, designation, pan, bank_name, account_number, ifsc, uan, esic_number, calendar_days, days_payable, present_days, lop_days, fixed_basic, fixed_da, fixed_hra, fixed_conveyance, fixed_medical, fixed_special, fixed_gross, earned_basic, earned_da, earned_hra, earned_conveyance, earned_medical, earned_special, overtime_amount, bonus_amount, gross_earned, wage_rule_excess, wage_rule_applied, eligible_pf_wages, eligible_esic_wages, employee_pf, employee_esic, professional_tax, tds, total_deductions, take_home_pay, employer_pf, employer_eps, employer_epf, employer_esic, gratuity, company_cost, tds_details_json, created_at, employer_edli, employer_pf_admin)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const p of data.payroll) {
          insert.run(p.id, p.employee_id, p.payroll_month, p.employee_name, p.department, p.designation, p.pan, p.bank_name, p.account_number, p.ifsc, p.uan, p.esic_number, p.calendar_days, p.days_payable, p.present_days, p.lop_days, p.fixed_basic, p.fixed_da, p.fixed_hra, p.fixed_conveyance, p.fixed_medical, p.fixed_special, p.fixed_gross, p.earned_basic, p.earned_da, p.earned_hra, p.earned_conveyance, p.earned_medical, p.earned_special, p.overtime_amount, p.bonus_amount, p.gross_earned, p.wage_rule_excess, p.wage_rule_applied, p.eligible_pf_wages, p.eligible_esic_wages, p.employee_pf, p.employee_esic, p.professional_tax, p.tds, p.total_deductions, p.take_home_pay, p.employer_pf, p.employer_eps, p.employer_epf, p.employer_esic, p.gratuity, p.company_cost, p.tds_details_json, p.created_at, p.employer_edli || 0, p.employer_pf_admin || 0);
        }
      }

      if (Array.isArray(data.pt_slabs)) {
        txDb.prepare('DELETE FROM pt_slabs').run();
        const insert = txDb.prepare(`
          INSERT INTO pt_slabs (id, state, salary_from, salary_to, monthly_pt, effective_from, effective_to)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        for (const pt of data.pt_slabs) {
          insert.run(pt.id, pt.state, pt.salary_from, pt.salary_to, pt.monthly_pt, pt.effective_from, pt.effective_to);
        }
      }

      if (Array.isArray(data.tax_slabs)) {
        txDb.prepare('DELETE FROM tax_slabs').run();
        const insert = txDb.prepare(`
          INSERT INTO tax_slabs (id, tax_year, regime, from_amount, to_amount, rate_percentage)
          VALUES (?, ?, ?, ?, ?, ?)
        `);
        for (const t of data.tax_slabs) {
          insert.run(t.id, t.tax_year, t.regime, t.from_amount, t.to_amount, t.rate_percentage);
        }
      }

      return { success: true, message: 'Database restored successfully from backup' };
    });
  }
};
