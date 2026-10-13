/**
 * OneHR Payroll Manager - Employee Repository
 * Data Access Layer for Employees using native SQLite parameterized queries.
 */

import { Database as DatabaseType } from 'better-sqlite3';
import { getDb, runInTransaction } from '../database';
import { Employee } from '../../../types/payroll';
import { calculateSimpleSalarySplit } from '../../../services/payrollEngine';

export const employeeRepository = {
  getAll(status?: string): Employee[] {
    const db = getDb();
    if (status) {
      return db.prepare('SELECT * FROM employees WHERE employment_status = ? ORDER BY name ASC').all(status) as unknown as Employee[];
    }
    return db.prepare('SELECT * FROM employees ORDER BY name ASC').all() as unknown as Employee[];
  },

  getById(id: string): Employee | null {
    const db = getDb();
    const row = db.prepare('SELECT * FROM employees WHERE id = ?').get(id);
    return (row as unknown as Employee) || null;
  },

  getByEmployeeId(employeeId: string): Employee | null {
    const db = getDb();
    const row = db.prepare('SELECT * FROM employees WHERE employee_id = ?').get(employeeId);
    return (row as unknown as Employee) || null;
  },

  create(emp: Partial<Employee>): Employee {
    const db = getDb();
    const id = emp.id || `emp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    const stmt = db.prepare(`
      INSERT INTO employees (
        id, employee_id, name, pan, date_of_joining, date_of_leaving,
        department, designation, location, employment_status,
        bank_name, account_number, ifsc, uan, esic_number,
        monthly_gross_salary, salary_structure_type, basic, da, hra,
        conveyance, medical, special_allowance,
        pf_applicable, esic_applicable, professional_tax_applicable, income_tax_applicable,
        tax_regime, state, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?
      )
    `);

    stmt.run(
      id,
      emp.employee_id,
      emp.name,
      emp.pan,
      emp.date_of_joining,
      emp.date_of_leaving || null,
      emp.department,
      emp.designation,
      emp.location || 'Default',
      emp.employment_status || 'ACTIVE',
      emp.bank_name,
      emp.account_number,
      emp.ifsc,
      emp.uan || null,
      emp.esic_number || null,
      emp.monthly_gross_salary,
      emp.salary_structure_type || 'SIMPLE',
      emp.basic || 0,
      emp.da || 0,
      emp.hra || 0,
      emp.conveyance || 0,
      emp.medical || 0,
      emp.special_allowance || 0,
      emp.pf_applicable ? 1 : 0,
      emp.esic_applicable ? 1 : 0,
      emp.professional_tax_applicable ? 1 : 0,
      emp.income_tax_applicable ? 1 : 0,
      emp.tax_regime || 'NEW',
      emp.state || 'Maharashtra',
      now,
      now
    );

    return this.getById(id)!;
  },

  update(id: string, emp: Partial<Employee>): Employee {
    const db = getDb();
    const now = new Date().toISOString();

    const stmt = db.prepare(`
      UPDATE employees SET
        name = COALESCE(?, name),
        pan = COALESCE(?, pan),
        date_of_joining = COALESCE(?, date_of_joining),
        date_of_leaving = ?,
        department = COALESCE(?, department),
        designation = COALESCE(?, designation),
        location = COALESCE(?, location),
        employment_status = COALESCE(?, employment_status),
        bank_name = COALESCE(?, bank_name),
        account_number = COALESCE(?, account_number),
        ifsc = COALESCE(?, ifsc),
        uan = ?,
        esic_number = ?,
        monthly_gross_salary = COALESCE(?, monthly_gross_salary),
        salary_structure_type = COALESCE(?, salary_structure_type),
        basic = COALESCE(?, basic),
        da = COALESCE(?, da),
        hra = COALESCE(?, hra),
        conveyance = COALESCE(?, conveyance),
        medical = COALESCE(?, medical),
        special_allowance = COALESCE(?, special_allowance),
        pf_applicable = COALESCE(?, pf_applicable),
        esic_applicable = COALESCE(?, esic_applicable),
        professional_tax_applicable = COALESCE(?, professional_tax_applicable),
        income_tax_applicable = COALESCE(?, income_tax_applicable),
        tax_regime = COALESCE(?, tax_regime),
        state = COALESCE(?, state),
        updated_at = ?
      WHERE id = ?
    `);

    stmt.run(
      emp.name ?? null,
      emp.pan ?? null,
      emp.date_of_joining ?? null,
      emp.date_of_leaving ?? null,
      emp.department ?? null,
      emp.designation ?? null,
      emp.location ?? null,
      emp.employment_status ?? null,
      emp.bank_name ?? null,
      emp.account_number ?? null,
      emp.ifsc ?? null,
      emp.uan ?? null,
      emp.esic_number ?? null,
      emp.monthly_gross_salary ?? null,
      emp.salary_structure_type ?? null,
      emp.basic ?? null,
      emp.da ?? null,
      emp.hra ?? null,
      emp.conveyance ?? null,
      emp.medical ?? null,
      emp.special_allowance ?? null,
      emp.pf_applicable !== undefined ? (emp.pf_applicable ? 1 : 0) : null,
      emp.esic_applicable !== undefined ? (emp.esic_applicable ? 1 : 0) : null,
      emp.professional_tax_applicable !== undefined ? (emp.professional_tax_applicable ? 1 : 0) : null,
      emp.income_tax_applicable !== undefined ? (emp.income_tax_applicable ? 1 : 0) : null,
      emp.tax_regime ?? null,
      emp.state ?? null,
      now,
      id
    );

    return this.getById(id)!;
  },

  delete(id: string): boolean {
    const db = getDb();
    const info = db.prepare('DELETE FROM employees WHERE id = ?').run(id);
    return info.changes > 0;
  },

  bulkImport(rows: any[], mode: 'SIMPLE' | 'DETAILED' = 'SIMPLE') {
    const db = getDb();
    const report = {
      total: rows.length,
      valid: 0,
      warnings: 0,
      errors: 0,
      details: [] as Array<{ row: number; status: 'VALID' | 'WARNING' | 'ERROR'; message: string; data?: any }>
    };

    const maxEmp = db.prepare('SELECT employee_id FROM employees ORDER BY employee_id DESC LIMIT 1').get() as any;
    let nextNum = 100;
    if (maxEmp && maxEmp.employee_id) {
      const match = maxEmp.employee_id.match(/\d+/);
      if (match) nextNum = parseInt(match[0], 10) + 1;
    }

    return runInTransaction((txDb) => {
      const insertStmt = txDb.prepare(`
        INSERT OR REPLACE INTO employees (
          id, employee_id, name, pan, date_of_joining, department, designation,
          location, employment_status, bank_name, account_number, ifsc, uan,
          esic_number, monthly_gross_salary, salary_structure_type, basic, da,
          hra, conveyance, medical, special_allowance, pf_applicable, esic_applicable,
          professional_tax_applicable, income_tax_applicable, tax_regime, state,
          created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          datetime('now'), datetime('now')
        )
      `);

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNum = i + 1;
        const issues: string[] = [];
        const warnings: string[] = [];

        // Validate Employee Name
        const name = (row.name || row.Name || row['Employee Name'])?.toString().trim();
        if (!name) {
          issues.push('Missing employee name');
        }

        // Validate Salary
        let gross = Number(row.monthly_gross_salary || row['Monthly Gross Salary'] || row.Gross || row.gross);
        if (isNaN(gross) || gross <= 0) {
          if (mode === 'DETAILED') {
            const basic = Number(row.basic || row.Basic || 0);
            const da = Number(row.da || row.DA || 0);
            const hra = Number(row.hra || row.HRA || 0);
            const sp = Number(row.special_allowance || row['Special Allowance'] || 0);
            gross = basic + da + hra + sp;
          }
        }

        if (isNaN(gross) || gross === 0) {
          issues.push('Zero or missing gross salary');
        } else if (gross < 0) {
          issues.push('Negative salary is not allowed');
        }

        const pan = (row.pan || row.PAN || 'ABCDE1234F')?.toString().trim().toUpperCase();

        // Date of joining is stored as YYYY-MM-DD. Accepts that format, DD-MM-YYYY / DD/MM/YYYY,
        // or a real Excel date cell (which arrives as a serial number).
        const rawDoj = row.date_of_joining ?? row['Date of Joining'] ?? row.DOJ ?? row.doj;
        let doj = '';
        if (rawDoj === undefined || rawDoj === null || rawDoj.toString().trim() === '') {
          doj = new Date().toISOString().split('T')[0];
          warnings.push('Date of joining was missing; defaulted to today');
        } else if (typeof rawDoj === 'number' && rawDoj > 20000 && rawDoj < 80000) {
          doj = new Date(Math.round((rawDoj - 25569) * 86400 * 1000)).toISOString().split('T')[0];
        } else {
          const text = rawDoj.toString().trim();
          const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
          const dmy = text.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})$/);
          if (iso) {
            doj = `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;
          } else if (dmy) {
            doj = `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
          } else {
            issues.push('Invalid Date of Joining (use YYYY-MM-DD or DD-MM-YYYY)');
          }
          if (doj && isNaN(new Date(doj).getTime())) {
            issues.push('Invalid Date of Joining (use YYYY-MM-DD or DD-MM-YYYY)');
          }
        }

        if (issues.length > 0) {
          report.errors += 1;
          report.details.push({
            row: rowNum,
            status: 'ERROR',
            message: issues.join('; '),
            data: row
          });
          continue;
        }

        let empId = (row.employee_id || row['Employee ID'] || row.EmpId)?.toString().trim();
        if (!empId) {
          empId = `EMP${String(nextNum++).padStart(3, '0')}`;
          warnings.push(`Auto-generated Employee ID: ${empId}`);
        }

        const existing = txDb.prepare('SELECT id FROM employees WHERE employee_id = ?').get(empId) as any;
        const empUuid = existing?.id || `emp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

        const department = (row.department || row.Department || 'General')?.toString().trim();
        const designation = (row.designation || row.Designation || 'Associate')?.toString().trim();
        const location = (row.location || row.Location || 'Headquarters')?.toString().trim();
        const state = (row.state || row.State || 'Maharashtra')?.toString().trim();
        const bankName = (row.bank_name || row['Bank Name'] || 'HDFC Bank')?.toString().trim();
        const accountNumber = (row.account_number || row['Account Number'] || '1234567890')?.toString().trim();
        const ifsc = (row.ifsc || row.IFSC || 'HDFC0001234')?.toString().trim().toUpperCase();
        const uan = (row.uan || row.UAN || '')?.toString().trim();
        const esicNum = (row.esic_number || row['ESIC Number'] || '')?.toString().trim();

        let basic = 0;
        let da = 0;
        let hra = 0;
        let conveyance = 0;
        let medical = 0;
        let specialAllowance = 0;

        if (mode === 'DETAILED') {
          basic = Number(row.basic || row.Basic || 0);
          da = Number(row.da || row.DA || 0);
          hra = Number(row.hra || row.HRA || 0);
          conveyance = Number(row.conveyance || row.Conveyance || 0);
          medical = Number(row.medical || row.Medical || 0);
          specialAllowance = Number(row.special_allowance || row['Special Allowance'] || 0);

          if (basic + da + hra + conveyance + medical + specialAllowance !== gross) {
            warnings.push('Detailed salary components do not equal gross; reconciled to Special Allowance');
            specialAllowance = gross - (basic + da + hra + conveyance + medical);
          }
        } else {
          const split = calculateSimpleSalarySplit(gross);
          basic = split.basic;
          da = split.da;
          hra = split.hra;
          specialAllowance = split.special_allowance;
        }

        const taxRegime = (row.tax_regime || row['Tax Regime'] || 'NEW').toString().trim().toUpperCase() === 'OLD' ? 'OLD' : 'NEW';

        const pfApp = row.pf_applicable !== undefined ? Boolean(row.pf_applicable) : true;
        const esicApp = row.esic_applicable !== undefined ? Boolean(row.esic_applicable) : (gross <= 21000);
        const ptApp = row.professional_tax_applicable !== undefined ? Boolean(row.professional_tax_applicable) : true;
        const itApp = row.income_tax_applicable !== undefined ? Boolean(row.income_tax_applicable) : true;

        insertStmt.run(
          empUuid, empId, name, pan, doj, department, designation, location,
          'ACTIVE', bankName, accountNumber, ifsc, uan, esicNum,
          gross, mode, basic, da, hra, conveyance, medical, specialAllowance,
          pfApp ? 1 : 0, esicApp ? 1 : 0, ptApp ? 1 : 0, itApp ? 1 : 0,
          taxRegime, state
        );

        if (warnings.length > 0) {
          report.warnings += 1;
          report.details.push({
            row: rowNum,
            status: 'WARNING',
            message: warnings.join('; ')
          });
        } else {
          report.valid += 1;
          report.details.push({
            row: rowNum,
            status: 'VALID',
            message: 'Imported successfully'
          });
        }
      }

      return report;
    });
  }
};
