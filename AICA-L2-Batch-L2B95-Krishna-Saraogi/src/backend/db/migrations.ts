/**
 * OneHR Payroll Manager - Schema Migrations & Data Initialization
 * 
 * Manages database schema versioning with schema_migrations table.
 * Applies incremental migrations atomically within transactions.
 */

import { Database as DatabaseType } from 'better-sqlite3';
import {
  DEFAULT_PT_SLABS,
  DEFAULT_SETTINGS,
  DEFAULT_TAX_SLABS,
  CURRENT_TAX_YEAR
} from '../../services/payrollEngine';

export interface Migration {
  version: number;
  description: string;
  up: (db: DatabaseType) => void;
}

export const migrations: Migration[] = [
  {
    version: 1,
    description: 'Initial schema: companies, settings, slabs, employees, attendance, payroll',
    up: (db: DatabaseType) => {
      // 1. Companies
      db.exec(`
        CREATE TABLE IF NOT EXISTS companies (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          legal_name TEXT,
          address TEXT,
          city TEXT,
          state TEXT,
          pincode TEXT,
          pan TEXT,
          gstin TEXT,
          tan TEXT,
          pf_code TEXT,
          esic_code TEXT,
          email TEXT,
          phone TEXT,
          logo_url TEXT
        );
      `);

      // 2. Settings
      db.exec(`
        CREATE TABLE IF NOT EXISTS settings (
          id TEXT PRIMARY KEY,
          simple_basic_pct REAL,
          simple_da_pct REAL,
          simple_hra_pct REAL,
          simple_special_pct REAL,
          pf_employee_pct REAL,
          pf_employer_pct REAL,
          pf_wage_ceiling REAL,
          pf_eps_pct REAL,
          pf_eps_ceiling REAL,
          pf_applicability_rule TEXT,
          esic_enabled INTEGER,
          esic_employee_pct REAL,
          esic_employer_pct REAL,
          esic_salary_ceiling REAL,
          gratuity_days REAL,
          gratuity_divisor REAL,
          tax_year TEXT,
          standard_deduction REAL,
          nil_tax_threshold REAL,
          cess_pct REAL,
          wage_rule_50_pct_enabled INTEGER
        );
      `);

      // 3. PT Slabs
      db.exec(`
        CREATE TABLE IF NOT EXISTS pt_slabs (
          id TEXT PRIMARY KEY,
          state TEXT NOT NULL,
          salary_from REAL NOT NULL,
          salary_to REAL NOT NULL,
          monthly_pt REAL NOT NULL,
          effective_from TEXT,
          effective_to TEXT
        );
      `);

      // 4. Tax Slabs
      db.exec(`
        CREATE TABLE IF NOT EXISTS tax_slabs (
          id TEXT PRIMARY KEY,
          tax_year TEXT NOT NULL,
          regime TEXT NOT NULL,
          from_amount REAL NOT NULL,
          to_amount REAL NOT NULL,
          rate_percentage REAL NOT NULL
        );
      `);

      // 5. Employees
      db.exec(`
        CREATE TABLE IF NOT EXISTS employees (
          id TEXT PRIMARY KEY,
          employee_id TEXT UNIQUE NOT NULL,
          name TEXT NOT NULL,
          pan TEXT NOT NULL,
          date_of_joining TEXT NOT NULL,
          date_of_leaving TEXT,
          department TEXT NOT NULL,
          designation TEXT NOT NULL,
          location TEXT NOT NULL,
          employment_status TEXT NOT NULL,
          bank_name TEXT NOT NULL,
          account_number TEXT NOT NULL,
          ifsc TEXT NOT NULL,
          uan TEXT,
          esic_number TEXT,
          monthly_gross_salary REAL NOT NULL,
          salary_structure_type TEXT NOT NULL,
          basic REAL,
          da REAL,
          hra REAL,
          conveyance REAL,
          medical REAL,
          special_allowance REAL,
          pf_applicable INTEGER NOT NULL,
          esic_applicable INTEGER NOT NULL,
          professional_tax_applicable INTEGER NOT NULL,
          income_tax_applicable INTEGER NOT NULL,
          tax_regime TEXT NOT NULL,
          state TEXT NOT NULL,
          created_at TEXT,
          updated_at TEXT
        );
      `);

      // 6. Attendance (UNIQUE on employee_id, payroll_month)
      db.exec(`
        CREATE TABLE IF NOT EXISTS attendance (
          id TEXT PRIMARY KEY,
          employee_id TEXT NOT NULL,
          payroll_month TEXT NOT NULL,
          days_json TEXT NOT NULL,
          overtime_amount REAL DEFAULT 0,
          bonus_amount REAL DEFAULT 0,
          remarks TEXT,
          present_days REAL,
          half_days REAL,
          paid_leaves REAL,
          weekly_offs REAL,
          public_holidays REAL,
          lop_days REAL,
          days_payable REAL,
          UNIQUE(employee_id, payroll_month)
        );
      `);

      // 7. Payroll Runs (UNIQUE on payroll_month)
      db.exec(`
        CREATE TABLE IF NOT EXISTS payroll_runs (
          id TEXT PRIMARY KEY,
          payroll_month TEXT UNIQUE NOT NULL,
          status TEXT NOT NULL,
          calendar_days INTEGER,
          working_days INTEGER,
          total_employees INTEGER,
          processed_employees INTEGER,
          total_gross_payroll REAL,
          total_deductions REAL,
          total_take_home REAL,
          total_employer_pf REAL,
          total_employer_esic REAL,
          total_gratuity REAL,
          total_tds REAL,
          total_company_cost REAL,
          locked_at TEXT,
          locked_by TEXT,
          created_at TEXT,
          updated_at TEXT
        );
      `);

      // 8. Individual Payroll Records (UNIQUE on employee_id, payroll_month)
      db.exec(`
        CREATE TABLE IF NOT EXISTS payroll (
          id TEXT PRIMARY KEY,
          employee_id TEXT NOT NULL,
          payroll_month TEXT NOT NULL,
          employee_name TEXT,
          department TEXT,
          designation TEXT,
          pan TEXT,
          bank_name TEXT,
          account_number TEXT,
          ifsc TEXT,
          uan TEXT,
          esic_number TEXT,
          calendar_days INTEGER,
          days_payable REAL,
          present_days REAL,
          lop_days REAL,
          fixed_basic REAL,
          fixed_da REAL,
          fixed_hra REAL,
          fixed_conveyance REAL,
          fixed_medical REAL,
          fixed_special REAL,
          fixed_gross REAL,
          earned_basic REAL,
          earned_da REAL,
          earned_hra REAL,
          earned_conveyance REAL,
          earned_medical REAL,
          earned_special REAL,
          overtime_amount REAL,
          bonus_amount REAL,
          gross_earned REAL,
          wage_rule_excess REAL,
          wage_rule_applied INTEGER,
          eligible_pf_wages REAL,
          eligible_esic_wages REAL,
          employee_pf REAL,
          employee_esic REAL,
          professional_tax REAL,
          tds REAL,
          total_deductions REAL,
          take_home_pay REAL,
          employer_pf REAL,
          employer_eps REAL,
          employer_epf REAL,
          employer_esic REAL,
          gratuity REAL,
          company_cost REAL,
          tds_details_json TEXT,
          created_at TEXT,
          UNIQUE(employee_id, payroll_month)
        );
      `);

      // Performance indices for fast queries
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_payroll_emp_month ON payroll(employee_id, payroll_month);
        CREATE INDEX IF NOT EXISTS idx_payroll_month ON payroll(payroll_month);
        CREATE INDEX IF NOT EXISTS idx_attendance_emp_month ON attendance(employee_id, payroll_month);
        CREATE INDEX IF NOT EXISTS idx_attendance_month ON attendance(payroll_month);
        CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(employment_status);
      `);
    }
  },
  {
    version: 2,
    description: 'Tax Year 2026-27 rules: EDLI/admin charge columns, old-regime slabs, PT slab corrections',
    up: (db: DatabaseType) => {
      db.exec(`
        ALTER TABLE payroll ADD COLUMN employer_edli REAL DEFAULT 0;
        ALTER TABLE payroll ADD COLUMN employer_pf_admin REAL DEFAULT 0;
      `);

      // Existing databases only (a fresh database is seeded with current defaults afterwards)
      const slabCount = (db.prepare('SELECT COUNT(*) as c FROM tax_slabs').get() as { c: number }).c;
      if (slabCount === 0) return;

      db.prepare("UPDATE settings SET tax_year = ? WHERE tax_year = 'FY 2025-26'").run(CURRENT_TAX_YEAR);
      db.prepare("UPDATE tax_slabs SET tax_year = ? WHERE tax_year = 'FY 2025-26'").run(CURRENT_TAX_YEAR);

      const oldCount = (db.prepare("SELECT COUNT(*) as c FROM tax_slabs WHERE regime = 'OLD'").get() as { c: number }).c;
      if (oldCount === 0) {
        const insertTax = db.prepare(
          'INSERT INTO tax_slabs (id, tax_year, regime, from_amount, to_amount, rate_percentage) VALUES (?, ?, ?, ?, ?, ?)'
        );
        DEFAULT_TAX_SLABS.filter(s => s.regime === 'OLD').forEach((slab, idx) => {
          insertTax.run(`slab_old_${idx + 1}`, slab.tax_year, slab.regime, slab.from_amount, slab.to_amount, slab.rate_percentage);
        });
      }

      // Karnataka: exemption threshold is ₹25,000 (only rows still at the old default are touched)
      db.prepare("UPDATE pt_slabs SET salary_to = 24999, effective_from = '2023-04-01' WHERE state = 'Karnataka' AND salary_from = 0 AND salary_to = 14999").run();
      db.prepare("UPDATE pt_slabs SET salary_from = 25000, effective_from = '2023-04-01' WHERE state = 'Karnataka' AND salary_from = 15000").run();

      // Tamil Nadu: the pre-loaded monthly slabs were wrong (TN PT is half-yearly and local-body specific).
      // Remove them only if they are still exactly the old defaults.
      const tn = db.prepare("SELECT salary_from, monthly_pt FROM pt_slabs WHERE state = 'Tamil Nadu' ORDER BY salary_from").all() as Array<{ salary_from: number; monthly_pt: number }>;
      const oldTn = [[0, 0], [21001, 100], [30001, 235], [45001, 208]];
      const isOldDefault = tn.length === oldTn.length && tn.every((r, i) => r.salary_from === oldTn[i][0] && r.monthly_pt === oldTn[i][1]);
      if (isOldDefault) {
        db.prepare("DELETE FROM pt_slabs WHERE state = 'Tamil Nadu'").run();
      }
    }
  },
  {
    version: 3,
    description: 'Users, roles and audit trail',
    up: (db: DatabaseType) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS users (
          username TEXT PRIMARY KEY,
          display_name TEXT NOT NULL,
          role TEXT NOT NULL,
          password_hash TEXT NOT NULL,
          salt TEXT NOT NULL,
          active INTEGER NOT NULL DEFAULT 1,
          created_at TEXT
        );
        CREATE TABLE IF NOT EXISTS audit_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          at TEXT NOT NULL,
          username TEXT NOT NULL,
          role TEXT,
          action TEXT NOT NULL,
          detail TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_audit_at ON audit_log(at);
      `);
    }
  }
];

/**
 * Initializes the schema_migrations table and executes all unapplied migrations
 */
export function applyMigrations(db: DatabaseType): { applied: number; currentVersion: number } {
  // Ensure schema_migrations table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL,
      description TEXT NOT NULL
    );
  `);

  const appliedRows = db.prepare('SELECT version FROM schema_migrations ORDER BY version ASC').all() as { version: number }[];
  const appliedSet = new Set(appliedRows.map(r => r.version));

  let appliedCount = 0;
  for (const m of migrations) {
    if (!appliedSet.has(m.version)) {
      const applyTx = db.transaction(() => {
        m.up(db);
        db.prepare('INSERT INTO schema_migrations (version, applied_at, description) VALUES (?, ?, ?)')
          .run(m.version, new Date().toISOString(), m.description);
      });
      applyTx();
      appliedCount += 1;
      console.log(`Applied migration v${m.version}: ${m.description}`);
    }
  }

  // Seed demo data if database was fresh and empty
  seedInitialDataIfEmpty(db);

  const currentVersionRow = db.prepare('SELECT MAX(version) as v FROM schema_migrations').get() as { v: number | null };
  return {
    applied: appliedCount,
    currentVersion: currentVersionRow.v || 0
  };
}

/**
 * Seeds initial company, settings, and slabs if and only if companies table is empty
 */
function seedInitialDataIfEmpty(db: DatabaseType): void {
  const compCount = (db.prepare('SELECT COUNT(*) as c FROM companies').get() as { c: number }).c;
  if (compCount > 0) {
    return; // Already populated, do not overwrite
  }

  const seedTx = db.transaction(() => {
    // 1. Company Information
    db.prepare(`
      INSERT INTO companies (
        id, name, legal_name, address, city, state, pincode,
        pan, gstin, tan, pf_code, esic_code, email, phone, logo_url
      ) VALUES (
        'comp_default',
        'Demo Industries Private Limited',
        'Demo Industries Private Limited',
        'Unit 402, 4th Floor, Prestige Tech Park, Marathahalli-Sarjapur Ring Road',
        'Bengaluru',
        'Karnataka',
        '560103',
        'AABCC1234D',
        '29AABCC1234D1Z5',
        'BLRC12345E',
        'KN/BNG/0098765/000',
        '51000987650001001',
        'payroll@demo.example',
        '+91 80 4123 4567',
        ''
      )
    `).run();

    // 2. Settings
    db.prepare(`
      INSERT INTO settings (
        id, simple_basic_pct, simple_da_pct, simple_hra_pct, simple_special_pct,
        pf_employee_pct, pf_employer_pct, pf_wage_ceiling, pf_eps_pct, pf_eps_ceiling,
        pf_applicability_rule, esic_enabled, esic_employee_pct, esic_employer_pct,
        esic_salary_ceiling, gratuity_days, gratuity_divisor, tax_year,
        standard_deduction, nil_tax_threshold, cess_pct, wage_rule_50_pct_enabled
      ) VALUES (
        'settings_default', 45, 5, 20, 30,
        12, 12, 15000, 8.33, 1250,
        'ALL', 1, 0.75, 3.25,
        21000, 15, 26, '${CURRENT_TAX_YEAR}',
        75000, 1200000, 4, 1
      )
    `).run();

    // 3. Tax Slabs
    const insertTax = db.prepare(`
      INSERT INTO tax_slabs (id, tax_year, regime, from_amount, to_amount, rate_percentage)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    DEFAULT_TAX_SLABS.forEach((slab, idx) => {
      insertTax.run(`slab_${idx + 1}`, slab.tax_year, slab.regime, slab.from_amount, slab.to_amount, slab.rate_percentage);
    });

    // 4. PT Slabs
    const insertPT = db.prepare(`
      INSERT INTO pt_slabs (id, state, salary_from, salary_to, monthly_pt, effective_from, effective_to)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    DEFAULT_PT_SLABS.forEach((slab, idx) => {
      insertPT.run(`pt_${idx + 1}`, slab.state, slab.salary_from, slab.salary_to, slab.monthly_pt, slab.effective_from, slab.effective_to);
    });
  });

  seedTx();
}
