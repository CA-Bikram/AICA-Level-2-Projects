/**
 * OneHR Payroll Manager - Settings Repository
 * Data Access Layer for statutory configurations, tax slabs, PT slabs, and company profile.
 */

import { getDb, runInTransaction } from '../database';
import {
  DEFAULT_PT_SLABS,
  DEFAULT_SETTINGS,
  DEFAULT_TAX_SLABS
} from '../../../services/payrollEngine';
import { Company, PayrollSettings, PTSlab, TDSSlab } from '../../../types/payroll';

export const settingsRepository = {
  // Company Information
  getCompany(): Company {
    const db = getDb();
    const row = db.prepare('SELECT * FROM companies LIMIT 1').get() as any;
    if (!row) {
      return {
        id: 'comp_default',
        name: 'Demo Industries Private Limited',
        legal_name: 'Demo Industries Private Limited',
        address: 'Unit 402, 4th Floor, Prestige Tech Park, Marathahalli-Sarjapur Ring Road',
        city: 'Bengaluru',
        state: 'Karnataka',
        pincode: '560103',
        pan: 'AABCC1234D',
        gstin: '29AABCC1234D1Z5',
        tan: 'BLRC12345E',
        pf_code: 'KN/BNG/0098765/000',
        esic_code: '51000987650001001',
        email: 'payroll@demo.example',
        phone: '+91 80 4123 4567',
        logo_url: ''
      };
    }
    return row as Company;
  },

  updateCompany(comp: Partial<Company>): Company {
    const db = getDb();
    db.prepare(`
      UPDATE companies SET
        name = COALESCE(?, name),
        legal_name = COALESCE(?, legal_name),
        address = COALESCE(?, address),
        city = COALESCE(?, city),
        state = COALESCE(?, state),
        pincode = COALESCE(?, pincode),
        pan = COALESCE(?, pan),
        gstin = COALESCE(?, gstin),
        tan = COALESCE(?, tan),
        pf_code = COALESCE(?, pf_code),
        esic_code = COALESCE(?, esic_code),
        email = COALESCE(?, email),
        phone = COALESCE(?, phone),
        logo_url = COALESCE(?, logo_url)
      WHERE id = 'comp_default'
    `).run(
      comp.name ?? null,
      comp.legal_name ?? null,
      comp.address ?? null,
      comp.city ?? null,
      comp.state ?? null,
      comp.pincode ?? null,
      comp.pan ?? null,
      comp.gstin ?? null,
      comp.tan ?? null,
      comp.pf_code ?? null,
      comp.esic_code ?? null,
      comp.email ?? null,
      comp.phone ?? null,
      comp.logo_url ?? null
    );

    return this.getCompany();
  },

  // Statutory Settings
  getSettings(): PayrollSettings {
    const db = getDb();
    const row = db.prepare('SELECT * FROM settings LIMIT 1').get() as any;
    if (!row) {
      return DEFAULT_SETTINGS;
    }
    return {
      ...row,
      esic_enabled: Boolean(row.esic_enabled),
      wage_rule_50_pct_enabled: Boolean(row.wage_rule_50_pct_enabled)
    };
  },

  updateSettings(settings: Partial<PayrollSettings>): PayrollSettings {
    const db = getDb();
    db.prepare(`
      UPDATE settings SET
        simple_basic_pct = COALESCE(?, simple_basic_pct),
        simple_da_pct = COALESCE(?, simple_da_pct),
        simple_hra_pct = COALESCE(?, simple_hra_pct),
        simple_special_pct = COALESCE(?, simple_special_pct),
        pf_employee_pct = COALESCE(?, pf_employee_pct),
        pf_employer_pct = COALESCE(?, pf_employer_pct),
        pf_wage_ceiling = COALESCE(?, pf_wage_ceiling),
        pf_eps_pct = COALESCE(?, pf_eps_pct),
        pf_eps_ceiling = COALESCE(?, pf_eps_ceiling),
        pf_applicability_rule = COALESCE(?, pf_applicability_rule),
        esic_enabled = COALESCE(?, esic_enabled),
        esic_employee_pct = COALESCE(?, esic_employee_pct),
        esic_employer_pct = COALESCE(?, esic_employer_pct),
        esic_salary_ceiling = COALESCE(?, esic_salary_ceiling),
        gratuity_days = COALESCE(?, gratuity_days),
        gratuity_divisor = COALESCE(?, gratuity_divisor),
        tax_year = COALESCE(?, tax_year),
        standard_deduction = COALESCE(?, standard_deduction),
        nil_tax_threshold = COALESCE(?, nil_tax_threshold),
        cess_pct = COALESCE(?, cess_pct),
        wage_rule_50_pct_enabled = COALESCE(?, wage_rule_50_pct_enabled)
      WHERE id = 'settings_default'
    `).run(
      settings.simple_basic_pct ?? null,
      settings.simple_da_pct ?? null,
      settings.simple_hra_pct ?? null,
      settings.simple_special_pct ?? null,
      settings.pf_employee_pct ?? null,
      settings.pf_employer_pct ?? null,
      settings.pf_wage_ceiling ?? null,
      settings.pf_eps_pct ?? null,
      settings.pf_eps_ceiling ?? null,
      settings.pf_applicability_rule ?? null,
      settings.esic_enabled !== undefined ? (settings.esic_enabled ? 1 : 0) : null,
      settings.esic_employee_pct ?? null,
      settings.esic_employer_pct ?? null,
      settings.esic_salary_ceiling ?? null,
      settings.gratuity_days ?? null,
      settings.gratuity_divisor ?? null,
      settings.tax_year ?? null,
      settings.standard_deduction ?? null,
      settings.nil_tax_threshold ?? null,
      settings.cess_pct ?? null,
      settings.wage_rule_50_pct_enabled !== undefined ? (settings.wage_rule_50_pct_enabled ? 1 : 0) : null
    );

    return this.getSettings();
  },

  resetSettings(): PayrollSettings {
    const db = getDb();
    db.prepare(`
      UPDATE settings SET
        simple_basic_pct = ?, simple_da_pct = ?, simple_hra_pct = ?, simple_special_pct = ?,
        pf_employee_pct = ?, pf_employer_pct = ?, pf_wage_ceiling = ?, pf_eps_pct = ?, pf_eps_ceiling = ?,
        pf_applicability_rule = ?, esic_enabled = ?, esic_employee_pct = ?, esic_employer_pct = ?,
        esic_salary_ceiling = ?, gratuity_days = ?, gratuity_divisor = ?, tax_year = ?,
        standard_deduction = ?, nil_tax_threshold = ?, cess_pct = ?, wage_rule_50_pct_enabled = ?
      WHERE id = 'settings_default'
    `).run(
      DEFAULT_SETTINGS.simple_basic_pct,
      DEFAULT_SETTINGS.simple_da_pct,
      DEFAULT_SETTINGS.simple_hra_pct,
      DEFAULT_SETTINGS.simple_special_pct,
      DEFAULT_SETTINGS.pf_employee_pct,
      DEFAULT_SETTINGS.pf_employer_pct,
      DEFAULT_SETTINGS.pf_wage_ceiling,
      DEFAULT_SETTINGS.pf_eps_pct,
      DEFAULT_SETTINGS.pf_eps_ceiling,
      DEFAULT_SETTINGS.pf_applicability_rule,
      DEFAULT_SETTINGS.esic_enabled ? 1 : 0,
      DEFAULT_SETTINGS.esic_employee_pct,
      DEFAULT_SETTINGS.esic_employer_pct,
      DEFAULT_SETTINGS.esic_salary_ceiling,
      DEFAULT_SETTINGS.gratuity_days,
      DEFAULT_SETTINGS.gratuity_divisor,
      DEFAULT_SETTINGS.tax_year,
      DEFAULT_SETTINGS.standard_deduction,
      DEFAULT_SETTINGS.nil_tax_threshold,
      DEFAULT_SETTINGS.cess_pct,
      DEFAULT_SETTINGS.wage_rule_50_pct_enabled ? 1 : 0
    );

    return this.getSettings();
  },

  // Professional Tax Slabs
  getPTSlabs(): PTSlab[] {
    const db = getDb();
    return db.prepare('SELECT * FROM pt_slabs ORDER BY state ASC, salary_from ASC').all() as unknown as PTSlab[];
  },

  updatePTSlabs(slabs: PTSlab[]): PTSlab[] {
    return runInTransaction((txDb) => {
      txDb.prepare('DELETE FROM pt_slabs').run();
      const insert = txDb.prepare(`
        INSERT INTO pt_slabs (id, state, salary_from, salary_to, monthly_pt, effective_from, effective_to)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      for (let i = 0; i < slabs.length; i++) {
        const s = slabs[i];
        insert.run(
          s.id || `pt_${i + 1}`,
          s.state,
          s.salary_from,
          s.salary_to,
          s.monthly_pt,
          s.effective_from || null,
          s.effective_to || null
        );
      }
      return this.getPTSlabs();
    });
  },

  // Tax Slabs
  getTaxSlabs(): TDSSlab[] {
    const db = getDb();
    return db.prepare('SELECT * FROM tax_slabs ORDER BY from_amount ASC').all() as unknown as TDSSlab[];
  },

  updateTaxSlabs(slabs: TDSSlab[]): TDSSlab[] {
    return runInTransaction((txDb) => {
      txDb.prepare('DELETE FROM tax_slabs').run();
      const insert = txDb.prepare(`
        INSERT INTO tax_slabs (id, tax_year, regime, from_amount, to_amount, rate_percentage)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      for (let i = 0; i < slabs.length; i++) {
        const s = slabs[i];
        insert.run(
          s.id || `slab_${i + 1}`,
          s.tax_year || DEFAULT_SETTINGS.tax_year,
          s.regime || 'NEW',
          s.from_amount,
          s.to_amount,
          s.rate_percentage
        );
      }
      return this.getTaxSlabs();
    });
  }
};
