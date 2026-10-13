/**
 * OneHR Payroll Manager - Demo data
 *
 * Loads a small set of entirely fictional employees for FY 2026-27, with attendance marked
 * and payroll processed and locked for April to August 2026. September 2026 is left open so
 * that the month-end cycle (new joiners, attendance upload, processing, review, lock) can be
 * demonstrated live. Runs only when SEED_DEMO=true and the employee master is empty.
 * Each employee is chosen to exercise one statutory rule.
 */

import { getDb } from './db/database';
import { employeeRepository } from './db/repositories/employeeRepository';
import { attendanceRepository } from './db/repositories/attendanceRepository';
import { payrollRepository } from './db/repositories/payrollRepository';
import { writeAudit } from './auth';
import { getEmploymentWindow } from '../services/payrollEngine';
import { Employee } from '../types/payroll';

const base = {
  employment_status: 'ACTIVE' as const,
  bank_name: 'Demo Bank',
  salary_structure_type: 'SIMPLE' as const,
  pf_applicable: true,
  esic_applicable: false,
  professional_tax_applicable: true,
  income_tax_applicable: true,
  tax_regime: 'NEW' as const
};

const DEMO_EMPLOYEES: Array<Partial<Employee>> = [
  // ESIC and PF on low wages
  { ...base, employee_id: 'D001', name: 'Asha Demo', department: 'Operations', designation: 'Office Assistant', location: 'Kolkata', state: 'West Bengal', date_of_joining: '2022-06-01', monthly_gross_salary: 12000, esic_applicable: true },
  // ESIC covered; below the Karnataka PT threshold of ₹25,000
  { ...base, employee_id: 'D002', name: 'Bharat Demo', department: 'Operations', designation: 'Data Entry Operator', location: 'Bengaluru', state: 'Karnataka', date_of_joining: '2023-01-15', monthly_gross_salary: 20500, esic_applicable: true },
  // Standard mid-level employee, February PT of ₹300 in Maharashtra
  { ...base, employee_id: 'D003', name: 'Charu Demo', department: 'Sales', designation: 'Sales Executive', location: 'Mumbai', state: 'Maharashtra', date_of_joining: '2021-09-01', monthly_gross_salary: 35000 },
  // Detailed structure where allowances exceed 50% - the wage rule adds the excess to PF wages
  { ...base, employee_id: 'D004', name: 'Dev Demo', department: 'Finance', designation: 'Senior Accountant', location: 'Kolkata', state: 'West Bengal', date_of_joining: '2020-04-01', monthly_gross_salary: 60000, salary_structure_type: 'DETAILED', basic: 21000, da: 3000, hra: 15000, conveyance: 3000, medical: 3000, special_allowance: 15000 },
  // Taxable income just above ₹12 lakh - marginal relief applies
  { ...base, employee_id: 'D005', name: 'Esha Demo', department: 'Finance', designation: 'Finance Manager', location: 'Kolkata', state: 'West Bengal', date_of_joining: '2019-07-01', monthly_gross_salary: 106500 },
  // Old tax regime
  { ...base, employee_id: 'D006', name: 'Farhan Demo', department: 'Engineering', designation: 'Engineering Manager', location: 'Pune', state: 'Maharashtra', date_of_joining: '2018-11-01', monthly_gross_salary: 150000, tax_regime: 'OLD' },
  // Joined mid-month (11 May 2026)
  { ...base, employee_id: 'D007', name: 'Gauri Demo', department: 'HR', designation: 'HR Executive', location: 'Kolkata', state: 'West Bengal', date_of_joining: '2026-05-11', monthly_gross_salary: 45000 },
  // Left mid-month (20 August 2026)
  { ...base, employee_id: 'D008', name: 'Harsh Demo', department: 'Sales', designation: 'Area Sales Manager', location: 'Hyderabad', state: 'Telangana', date_of_joining: '2021-02-01', date_of_leaving: '2026-08-20', employment_status: 'INACTIVE', monthly_gross_salary: 55000 },
  // Income above ₹50 lakh - surcharge
  { ...base, employee_id: 'D009', name: 'Indira Demo', department: 'Management', designation: 'Managing Director', location: 'Bengaluru', state: 'Karnataka', date_of_joining: '2015-04-01', monthly_gross_salary: 500000 }
];

/** Months completed in the demo: attendance marked, payroll processed and locked */
const COMPLETED_MONTHS = ['2026-04', '2026-05', '2026-06', '2026-07', '2026-08'];

/** Public holidays marked PH for everyone (weekends are WO) */
const HOLIDAYS: Record<string, number[]> = {
  '2026-04': [3, 14],
  '2026-05': [1],
  '2026-08': [28]
};

/** Leave, loss of pay, overtime and bonus events by month and employee */
const EVENTS: Record<string, Record<string, { days?: Record<number, string>; ot?: number; bonus?: number; remarks?: string }>> = {
  '2026-04': {
    D002: { days: { 21: 'CL' }, remarks: 'Casual leave' },
    D005: { days: { 9: 'SL', 10: 'SL' }, remarks: 'Sick leave' }
  },
  '2026-05': {
    D001: { ot: 600, remarks: 'Overtime' },
    D004: { days: { 19: 'HD' }, remarks: 'Half day' },
    D008: { days: { 6: 'EL', 7: 'EL', 8: 'EL' }, remarks: 'Earned leave' }
  },
  '2026-06': {
    D003: { bonus: 15000, remarks: 'Quarterly sales incentive' },
    D006: { days: { 16: 'CL' }, remarks: 'Casual leave' },
    D007: { days: { 24: 'SL' }, remarks: 'Sick leave' }
  },
  '2026-07': {
    D001: { days: { 14: 'LOP', 15: 'LOP' }, ot: 800, remarks: 'Two days LOP; overtime' },
    D009: { days: { 20: 'OD', 21: 'OD', 22: 'OD' }, remarks: 'On duty - outstation' }
  },
  '2026-08': {
    D002: { days: { 11: 'LOP' }, ot: 900, remarks: 'One day LOP; overtime' },
    D005: { days: { 17: 'EL', 18: 'EL' }, remarks: 'Earned leave' }
  }
};

function buildDaysMap(month: string, events: Record<number, string> = {}): Record<number, string> {
  const [y, m] = month.split('-').map(v => parseInt(v, 10));
  const days = new Date(y, m, 0).getDate();
  const holidays = HOLIDAYS[month] || [];
  const map: Record<number, string> = {};
  for (let d = 1; d <= days; d++) {
    const dow = new Date(y, m - 1, d).getDay();
    map[d] = dow === 0 || dow === 6 ? 'WO' : holidays.includes(d) ? 'PH' : 'P';
  }
  return { ...map, ...events };
}

export function seedDemoDataIfEmpty(): void {
  if (process.env.SEED_DEMO !== 'true') return;

  const db = getDb();
  const count = (db.prepare('SELECT COUNT(*) as c FROM employees').get() as { c: number }).c;
  if (count > 0) return;

  DEMO_EMPLOYEES.forEach((emp, idx) => {
    const n = String(idx + 1).padStart(4, '0');
    employeeRepository.create({
      ...emp,
      pan: `AAAPD${n}Z`,
      account_number: `00000000${n}`,
      ifsc: 'DEMO0000001',
      uan: emp.pf_applicable ? `10000000${n}` : '',
      esic_number: emp.esic_applicable ? `31000000${n}` : ''
    });
  });

  for (const month of COMPLETED_MONTHS) {
    // Attendance for every employee in service during the month
    for (const emp of DEMO_EMPLOYEES) {
      if (getEmploymentWindow(emp as Employee, month).days === 0) continue;
      const ev = EVENTS[month]?.[emp.employee_id as string] || {};
      attendanceRepository.saveRecord(emp.employee_id as string, month, buildDaysMap(month, ev.days) as any, ev.ot || 0, ev.bonus || 0, ev.remarks || '');
    }
    payrollRepository.processPayroll(month);
    payrollRepository.lockPayroll(month, 'checker');
  }

  writeAudit({ username: 'system', role: '-' }, 'DEMO_SEED', `${DEMO_EMPLOYEES.length} fictional employees; April-August 2026 processed and locked`);
  console.log('Demo data loaded: fictional employees; April-August 2026 attendance and payroll completed.');
}
