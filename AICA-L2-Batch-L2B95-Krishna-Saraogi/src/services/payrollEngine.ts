/**
 * OneHR Payroll Manager - Calculation Engine
 * 
 * Fully deterministic, standalone unit-testable service.
 * Implements all statutory Indian payroll rules:
 * - Simple & Detailed salary split
 * - Calendar days & pro-rata, including mid-month joiners and leavers
 * - 50% Wage Rule
 * - PF (Employee 12%, Employer 12%, EPS 8.33% cap ₹1,250, EPF balance)
 * - ESIC (0.75% / 3.25%, ceiling ₹21,000, contribution-period continuity, rounded up)
 * - Dynamic Professional Tax from State Slabs
 * - Income Tax / TDS (new and old regime, year-to-date basis, marginal relief, surcharge, 4% Cess)
 * - Gratuity (Wages × 15 / 26 / 12)
 * - Take Home & CTC
 */

import {
  AttendanceCode,
  Employee,
  PayrollRecord,
  PayrollSettings,
  PTSlab,
  SalaryBreakdown,
  TDSCalculationDetail,
  TDSSlab
} from '../types/payroll';
import { getDaysInPayrollMonth } from '../utils/indianNumber';

/**
 * Tax year label used for slab lookup. Under the Income-tax Act, 2025 (effective 1 April 2026)
 * the "previous year / assessment year" pair is replaced by a single "tax year".
 */
export const CURRENT_TAX_YEAR = 'Tax Year 2026-27';

/** Old-regime parameters (not configurable in Settings; change here if the law changes) */
export const OLD_REGIME_STANDARD_DEDUCTION = 50000;
export const OLD_REGIME_REBATE_LIMIT = 500000;
/** Old regime: employee PF qualifies for deduction up to this limit (section 80C of the 1961 Act) */
export const SECTION_80C_LIMIT = 150000;
/** Professional tax deduction is capped at ₹2,500 a year (Article 276 of the Constitution) */
export const PT_ANNUAL_CAP = 2500;

/** EDLI and EPF administrative charges (employer cost, on PF wages) */
export const DEFAULT_EDLI_PCT = 0.5;
export const DEFAULT_PF_ADMIN_PCT = 0.5;

/**
 * Default Statutory Settings for Tax Year 2026-27
 */
export const DEFAULT_SETTINGS: PayrollSettings = {
  simple_basic_pct: 45,
  simple_da_pct: 5,
  simple_hra_pct: 20,
  simple_special_pct: 30,

  pf_employee_pct: 12,
  pf_employer_pct: 12,
  pf_wage_ceiling: 15000,
  pf_eps_pct: 8.33,
  pf_eps_ceiling: 1250,
  pf_applicability_rule: 'ALL',

  esic_enabled: true,
  esic_employee_pct: 0.75,
  esic_employer_pct: 3.25,
  esic_salary_ceiling: 21000,

  gratuity_days: 15,
  gratuity_divisor: 26,

  tax_year: CURRENT_TAX_YEAR,
  standard_deduction: 75000,
  nil_tax_threshold: 1200000,
  cess_pct: 4,

  wage_rule_50_pct_enabled: true,
};

/**
 * Default tax slabs for Tax Year 2026-27 (rates unchanged by the Finance Act, 2026).
 * NEW regime: 0-4L nil, 4-8L 5%, 8-12L 10%, 12-16L 15%, 16-20L 20%, 20-24L 25%, above 24L 30%
 * OLD regime (individual below 60): 0-2.5L nil, 2.5-5L 5%, 5-10L 20%, above 10L 30%
 */
export const DEFAULT_TAX_SLABS: TDSSlab[] = [
  { tax_year: CURRENT_TAX_YEAR, regime: 'NEW', from_amount: 0, to_amount: 400000, rate_percentage: 0 },
  { tax_year: CURRENT_TAX_YEAR, regime: 'NEW', from_amount: 400000, to_amount: 800000, rate_percentage: 5 },
  { tax_year: CURRENT_TAX_YEAR, regime: 'NEW', from_amount: 800000, to_amount: 1200000, rate_percentage: 10 },
  { tax_year: CURRENT_TAX_YEAR, regime: 'NEW', from_amount: 1200000, to_amount: 1600000, rate_percentage: 15 },
  { tax_year: CURRENT_TAX_YEAR, regime: 'NEW', from_amount: 1600000, to_amount: 2000000, rate_percentage: 20 },
  { tax_year: CURRENT_TAX_YEAR, regime: 'NEW', from_amount: 2000000, to_amount: 2400000, rate_percentage: 25 },
  { tax_year: CURRENT_TAX_YEAR, regime: 'NEW', from_amount: 2400000, to_amount: 999999999, rate_percentage: 30 },

  { tax_year: CURRENT_TAX_YEAR, regime: 'OLD', from_amount: 0, to_amount: 250000, rate_percentage: 0 },
  { tax_year: CURRENT_TAX_YEAR, regime: 'OLD', from_amount: 250000, to_amount: 500000, rate_percentage: 5 },
  { tax_year: CURRENT_TAX_YEAR, regime: 'OLD', from_amount: 500000, to_amount: 1000000, rate_percentage: 20 },
  { tax_year: CURRENT_TAX_YEAR, regime: 'OLD', from_amount: 1000000, to_amount: 999999999, rate_percentage: 30 },
];

/**
 * Default Professional Tax Slabs by State (monthly).
 * Notes:
 * - Maharashtra and Karnataka charge ₹300 in February so the annual total is ₹2,500 (see PT_FEBRUARY_AMOUNT).
 * - Maharashtra slabs below are for male employees; women earning up to ₹25,000 are exempt
 *   (the employee master has no gender field, so set "PT applicable = No" for them).
 * - Tamil Nadu is intentionally not pre-loaded: it is levied half-yearly on six-monthly income
 *   and rates differ by local body, so it cannot be expressed as a monthly state slab.
 */
export const DEFAULT_PT_SLABS: PTSlab[] = [
  // Maharashtra
  { state: 'Maharashtra', salary_from: 0, salary_to: 7500, monthly_pt: 0, effective_from: '2020-04-01', effective_to: '2099-03-31' },
  { state: 'Maharashtra', salary_from: 7501, salary_to: 10000, monthly_pt: 175, effective_from: '2020-04-01', effective_to: '2099-03-31' },
  { state: 'Maharashtra', salary_from: 10001, salary_to: 999999999, monthly_pt: 200, effective_from: '2020-04-01', effective_to: '2099-03-31' },

  // Karnataka (threshold ₹25,000)
  { state: 'Karnataka', salary_from: 0, salary_to: 24999, monthly_pt: 0, effective_from: '2023-04-01', effective_to: '2099-03-31' },
  { state: 'Karnataka', salary_from: 25000, salary_to: 999999999, monthly_pt: 200, effective_from: '2023-04-01', effective_to: '2099-03-31' },

  // Telangana
  { state: 'Telangana', salary_from: 0, salary_to: 15000, monthly_pt: 0, effective_from: '2020-04-01', effective_to: '2099-03-31' },
  { state: 'Telangana', salary_from: 15001, salary_to: 20000, monthly_pt: 150, effective_from: '2020-04-01', effective_to: '2099-03-31' },
  { state: 'Telangana', salary_from: 20001, salary_to: 999999999, monthly_pt: 200, effective_from: '2020-04-01', effective_to: '2099-03-31' },

  // West Bengal
  { state: 'West Bengal', salary_from: 0, salary_to: 10000, monthly_pt: 0, effective_from: '2020-04-01', effective_to: '2099-03-31' },
  { state: 'West Bengal', salary_from: 10001, salary_to: 15000, monthly_pt: 110, effective_from: '2020-04-01', effective_to: '2099-03-31' },
  { state: 'West Bengal', salary_from: 15001, salary_to: 25000, monthly_pt: 130, effective_from: '2020-04-01', effective_to: '2099-03-31' },
  { state: 'West Bengal', salary_from: 25001, salary_to: 40000, monthly_pt: 150, effective_from: '2020-04-01', effective_to: '2099-03-31' },
  { state: 'West Bengal', salary_from: 40001, salary_to: 999999999, monthly_pt: 200, effective_from: '2020-04-01', effective_to: '2099-03-31' },

  // Gujarat
  { state: 'Gujarat', salary_from: 0, salary_to: 12000, monthly_pt: 0, effective_from: '2020-04-01', effective_to: '2099-03-31' },
  { state: 'Gujarat', salary_from: 12001, salary_to: 999999999, monthly_pt: 200, effective_from: '2020-04-01', effective_to: '2099-03-31' },

  // Delhi (No PT in Delhi)
  { state: 'Delhi', salary_from: 0, salary_to: 999999999, monthly_pt: 0, effective_from: '2020-04-01', effective_to: '2099-03-31' },
];

/** States where the top monthly slab (₹200) becomes this amount in February */
export const PT_FEBRUARY_AMOUNT: Record<string, number> = {
  maharashtra: 300,
  karnataka: 300,
};

/**
 * 1. SIMPLE SALARY SPLIT
 * 
 * Default:
 * Basic = 45%
 * DA = 5%
 * HRA = 20%
 * Special Allowance = balance (30%)
 * Conveyance = 0, Medical = 0
 * Enforces: Basic + DA >= 50% of salary
 * Any rounding difference goes to Special Allowance so sum reconciles exactly to gross.
 */
export function calculateSimpleSalarySplit(
  monthlyGross: number,
  settings: PayrollSettings = DEFAULT_SETTINGS
): SalaryBreakdown {
  if (monthlyGross <= 0) {
    return { basic: 0, da: 0, hra: 0, conveyance: 0, medical: 0, special_allowance: 0, gross: 0 };
  }

  let basicPct = settings.simple_basic_pct ?? 45;
  let daPct = settings.simple_da_pct ?? 5;
  let hraPct = settings.simple_hra_pct ?? 20;

  // Enforce Basic + DA >= 50%
  if (basicPct + daPct < 50) {
    const diff = 50 - (basicPct + daPct);
    basicPct += diff;
  }

  const basic = Math.round((monthlyGross * basicPct) / 100);
  const da = Math.round((monthlyGross * daPct) / 100);
  const hra = Math.round((monthlyGross * hraPct) / 100);
  const conveyance = 0;
  const medical = 0;

  // Remainder strictly goes to Special Allowance
  const specialAllowance = Math.round(monthlyGross - (basic + da + hra + conveyance + medical));

  return {
    basic,
    da,
    hra,
    conveyance,
    medical,
    special_allowance: Math.max(0, specialAllowance),
    gross: monthlyGross
  };
}

/**
 * 2. DETAILED SALARY BREAKDOWN
 * Uses user-entered components and ensures exact sum.
 */
export function getDetailedSalaryBreakdown(employee: Partial<Employee>): SalaryBreakdown {
  const basic = Math.round(employee.basic || 0);
  const da = Math.round(employee.da || 0);
  const hra = Math.round(employee.hra || 0);
  const conveyance = Math.round(employee.conveyance || 0);
  const medical = Math.round(employee.medical || 0);
  const special = Math.round(employee.special_allowance || 0);
  const sum = basic + da + hra + conveyance + medical + special;
  const gross = employee.monthly_gross_salary ? Math.round(employee.monthly_gross_salary) : sum;

  return {
    basic,
    da,
    hra,
    conveyance,
    medical,
    special_allowance: special,
    gross
  };
}

/**
 * 3. ATTENDANCE SUMMARY CALCULATION
 * Computes payable days from individual daily codes:
 * P (1.0), A (0.0), HD (0.5), WO (1.0), PH (1.0), CL (1.0), SL (1.0), EL (1.0), LOP (0.0), OD (1.0)
 *
 * fromDay / toDay restrict the count to the employee's service window in the month
 * (mid-month joiners and leavers). Days outside the window are neither paid nor counted as LOP.
 */
export function calculateAttendanceSummary(
  daysMap: Record<number, AttendanceCode>,
  daysInMonth: number,
  fromDay: number = 1,
  toDay: number = daysInMonth
) {
  let presentDays = 0;
  let halfDays = 0;
  let paidLeaves = 0;
  let weeklyOffs = 0;
  let publicHolidays = 0;
  let lopDays = 0;

  const start = Math.max(1, fromDay);
  const end = Math.min(daysInMonth, toDay);

  for (let day = start; day <= end; day++) {
    const code = daysMap[day] || 'P'; // default Present if not specified
    switch (code) {
      case 'P':
        presentDays += 1;
        break;
      case 'HD':
        halfDays += 1;
        break;
      case 'WO':
        weeklyOffs += 1;
        break;
      case 'PH':
        publicHolidays += 1;
        break;
      case 'CL':
      case 'SL':
      case 'EL':
        paidLeaves += 1;
        break;
      case 'OD':
        presentDays += 1;
        break;
      case 'A':
      case 'LOP':
        lopDays += 1;
        break;
      default:
        presentDays += 1;
    }
  }

  // Days payable formula
  const daysPayable = Number((presentDays + (halfDays * 0.5) + paidLeaves + weeklyOffs + publicHolidays).toFixed(2));

  return {
    present_days: presentDays,
    half_days: halfDays,
    paid_leaves: paidLeaves,
    weekly_offs: weeklyOffs,
    public_holidays: publicHolidays,
    lop_days: lopDays,
    days_payable: Math.min(daysInMonth, Math.max(0, daysPayable))
  };
}

/**
 * Service window of an employee within a payroll month, from date of joining / leaving.
 * Returns days = 0 when the employee was not in service at any time in the month.
 * Dates are expected as YYYY-MM-DD; an unreadable date is ignored (treated as in service).
 */
export function getEmploymentWindow(
  employee: Pick<Employee, 'date_of_joining' | 'date_of_leaving'>,
  payrollMonth: string
): { fromDay: number; toDay: number; days: number; calendarDays: number } {
  const calendarDays = getDaysInPayrollMonth(payrollMonth);
  const iso = /^\d{4}-\d{2}-\d{2}/;
  const monthStart = `${payrollMonth}-01`;
  const monthEnd = `${payrollMonth}-${String(calendarDays).padStart(2, '0')}`;

  const doj = employee.date_of_joining && iso.test(employee.date_of_joining) ? employee.date_of_joining.slice(0, 10) : '';
  const dol = employee.date_of_leaving && iso.test(employee.date_of_leaving) ? employee.date_of_leaving.slice(0, 10) : '';

  if ((doj && doj > monthEnd) || (dol && dol < monthStart)) {
    return { fromDay: 0, toDay: 0, days: 0, calendarDays };
  }

  const fromDay = doj && doj > monthStart ? parseInt(doj.slice(8, 10), 10) : 1;
  const toDay = dol && dol < monthEnd ? parseInt(dol.slice(8, 10), 10) : calendarDays;
  const days = Math.max(0, toDay - fromDay + 1);

  return { fromDay, toDay, days, calendarDays };
}

/**
 * Position of a payroll month within the April-March tax year.
 * index: April = 1 ... March = 12. startYear: calendar year in which the tax year begins.
 */
export function getTaxYearPosition(payrollMonth: string): { index: number; startYear: number } {
  const [y, m] = payrollMonth.split('-').map(v => parseInt(v, 10));
  const index = ((m - 4 + 12) % 12) + 1;
  const startYear = m >= 4 ? y : y - 1;
  return { index, startYear };
}

/** Same position helper for a YYYY-MM-DD date; returns null if the date is unreadable */
function taxYearPositionOfDate(date?: string): { index: number; startYear: number } | null {
  if (!date || !/^\d{4}-\d{2}/.test(date)) return null;
  return getTaxYearPosition(date.slice(0, 7));
}

/** Rounds a statutory contribution up to the next rupee (ESIC rule), guarding float noise */
function roundUpRupee(amount: number): number {
  return Math.ceil(amount - 1e-9);
}

/**
 * Valid Attendance Codes accepted in the system
 */
export const VALID_ATTENDANCE_CODES: AttendanceCode[] = [
  'P', 'A', 'HD', 'WO', 'PH', 'CL', 'SL', 'EL', 'LOP', 'OD'
];

export interface AttendanceRowValidationResult {
  status: 'VALID' | 'WARNING' | 'ERROR';
  issues: string[];
  warnings: string[];
  message: string;
  sanitizedRow?: {
    employee_id: string;
    employee_name: string;
    daysMap: Record<number, AttendanceCode>;
    overtime_amount: number;
    bonus_amount: number;
    remarks: string;
  };
}

/**
 * Validates a single Excel row for bulk attendance import.
 * Rules:
 * 1. Missing or unregistered Employee ID -> ERROR
 * 2. Blank Employee Name -> ERROR (even when valid Employee ID exists)
 * 3. Invalid attendance code -> ERROR ("Invalid attendance code 'XYZ' on Day X.")
 * 4. Missing numeric field (OT/Bonus) -> 0 + WARNING
 * 5. Invalid numeric field (OT/Bonus) -> 0 + WARNING
 * 6. Valid attendance codes remain unchanged
 */
export function validateAttendanceImportRow(
  row: any,
  rowIndex: number,
  calendarDays: number,
  payrollMonth: string,
  existingEmployeeIds?: Set<string> | ((id: string) => boolean)
): AttendanceRowValidationResult {
  const issues: string[] = [];
  const warnings: string[] = [];

  // 1. Employee ID check
  const rawEmpId = row.employee_id ?? row['Employee ID'] ?? row.EmpId;
  const empId = rawEmpId !== undefined && rawEmpId !== null ? rawEmpId.toString().trim() : '';
  if (!empId) {
    issues.push('Missing Employee ID');
  } else if (existingEmployeeIds) {
    const exists = typeof existingEmployeeIds === 'function'
      ? existingEmployeeIds(empId)
      : existingEmployeeIds.has(empId);
    if (!exists) {
      issues.push(`Employee ID ${empId} not found in Employee Master`);
    }
  }

  // 2. Blank Employee Name check - MUST ALWAYS BE ERROR, even when valid Employee ID exists!
  const rawName = row.name ?? row['Employee Name'] ?? row.Name ?? row['employee_name'];
  const empName = rawName !== undefined && rawName !== null ? rawName.toString().trim() : '';
  if (!empName) {
    issues.push('Blank Employee Name');
  }

  // 3. Day codes check Day 1 .. Day calendarDays
  const daysMap: Record<number, AttendanceCode> = {};
  for (let d = 1; d <= calendarDays; d++) {
    const rawVal = row[`Day ${d}`] ?? row[`day_${d}`] ?? row[d] ?? row[`d${d}`];
    const dayVal = (rawVal !== undefined && rawVal !== null) ? rawVal.toString().trim().toUpperCase() : '';
    if (!dayVal) {
      // If empty/missing code: weekend WO else P
      const [y, m] = payrollMonth.split('-');
      const dObj = new Date(parseInt(y, 10), parseInt(m, 10) - 1, d);
      daysMap[d] = (dObj.getDay() === 0 || dObj.getDay() === 6) ? 'WO' : 'P';
    } else if (VALID_ATTENDANCE_CODES.includes(dayVal as AttendanceCode)) {
      daysMap[d] = dayVal as AttendanceCode;
    } else {
      // Invalid attendance code must NOT be converted to Present.
      const originalCode = rawVal !== undefined && rawVal !== null ? rawVal.toString().trim() : dayVal;
      issues.push(`Invalid attendance code '${originalCode}' on Day ${d}.`);
    }
  }

  // 4. Overtime numeric check
  // Missing numeric field = 0 + WARNING
  // Invalid numeric field = 0 + WARNING
  let ot = 0;
  const rawOt = row.ot_amount ?? row['OT Amount'] ?? row.Overtime ?? row['ot'];
  if (rawOt === undefined || rawOt === null || (typeof rawOt === 'string' && rawOt.trim() === '')) {
    warnings.push('Missing Overtime value; defaulted to 0');
    ot = 0;
  } else {
    const parsedOt = Number(rawOt);
    if (isNaN(parsedOt)) {
      warnings.push('Invalid Overtime number; defaulted to 0');
      ot = 0;
    } else {
      ot = parsedOt;
    }
  }

  // 5. Bonus numeric check
  // Missing numeric field = 0 + WARNING
  // Invalid numeric field = 0 + WARNING
  let bonus = 0;
  const rawBonus = row.bonus ?? row.Bonus ?? row['Bonus Amount'];
  if (rawBonus === undefined || rawBonus === null || (typeof rawBonus === 'string' && rawBonus.trim() === '')) {
    warnings.push('Missing Bonus value; defaulted to 0');
    bonus = 0;
  } else {
    const parsedBonus = Number(rawBonus);
    if (isNaN(parsedBonus)) {
      warnings.push('Invalid Bonus number; defaulted to 0');
      bonus = 0;
    } else {
      bonus = parsedBonus;
    }
  }

  const remarks = (row.remarks || row.Remarks || '')?.toString().trim();

  if (issues.length > 0) {
    return {
      status: 'ERROR',
      issues,
      warnings,
      message: issues.join('; ')
    };
  }

  if (warnings.length > 0) {
    return {
      status: 'WARNING',
      issues: [],
      warnings,
      message: warnings.join('; '),
      sanitizedRow: {
        employee_id: empId,
        employee_name: empName,
        daysMap,
        overtime_amount: ot,
        bonus_amount: bonus,
        remarks
      }
    };
  }

  return {
    status: 'VALID',
    issues: [],
    warnings: [],
    message: `Processed attendance for ${empId}`,
    sanitizedRow: {
      employee_id: empId,
      employee_name: empName,
      daysMap,
      overtime_amount: ot,
      bonus_amount: bonus,
      remarks
    }
  };
}

/**
 * 4. PROFESSIONAL TAX LOOKUP
 * Dynamic lookup based on State, Gross, slabs and (optionally) the payroll month.
 * When the month is given, slab effective dates are honoured and the February
 * top-slab amount (₹300 in Maharashtra / Karnataka) is applied.
 */
export function calculateProfessionalTax(
  state: string,
  grossSalary: number,
  ptSlabs: PTSlab[] = DEFAULT_PT_SLABS,
  payrollMonth?: string
): number {
  if (!state || grossSalary <= 0) return 0;

  const stateKey = state.trim().toLowerCase();
  const monthStart = payrollMonth ? `${payrollMonth}-01` : '';

  const stateSlabs = ptSlabs.filter(s => {
    if (s.state.trim().toLowerCase() !== stateKey) return false;
    if (!monthStart) return true;
    if (s.effective_from && s.effective_from > monthStart) return false;
    if (s.effective_to && s.effective_to < monthStart) return false;
    return true;
  });

  if (stateSlabs.length === 0) {
    // If state has no configured PT, default to 0
    return 0;
  }

  for (const slab of stateSlabs) {
    if (grossSalary >= slab.salary_from && grossSalary <= slab.salary_to) {
      const febAmount = PT_FEBRUARY_AMOUNT[stateKey];
      if (payrollMonth && payrollMonth.endsWith('-02') && febAmount && slab.monthly_pt === 200) {
        return febAmount;
      }
      return slab.monthly_pt;
    }
  }

  return 0;
}

/**
 * Extra inputs for a year-to-date TDS computation. When omitted, calculateTDS
 * falls back to a simple "this month x 12" estimate (used for quick what-if checks).
 */
export interface TDSContext {
  /** Estimated salary for the whole tax year (actuals to date + this month + projection) */
  annualSalary?: number;
  /** Salary already paid in earlier months of this tax year */
  ytdGross?: number;
  /** TDS already deducted in earlier months of this tax year */
  ytdTds?: number;
  /** Projected salary for the months after this one */
  projectedFutureSalary?: number;
  /** Months left in the tax year including this one (over which the balance tax is spread) */
  monthsRemaining?: number;
  /** Estimated professional tax for the whole tax year (deductible in the old regime only) */
  annualPT?: number;
  /** Estimated employee PF for the whole tax year (deductible in the old regime only, up to ₹1,50,000) */
  annualEmployeePF?: number;
}

function slabTaxOn(income: number, slabs: TDSSlab[]) {
  const breakdown: TDSCalculationDetail['slab_breakdown'] = [];
  let tax = 0;
  for (const slab of slabs) {
    if (income > slab.from_amount) {
      const taxableInSlab = Math.min(income, slab.to_amount) - slab.from_amount;
      const slabTax = (taxableInSlab * slab.rate_percentage) / 100;
      tax += slabTax;
      const toStr = slab.to_amount >= 999999999 ? 'Above' : `to ₹${slab.to_amount.toLocaleString('en-IN')}`;
      const fromStr = `₹${slab.from_amount.toLocaleString('en-IN')}`;
      breakdown.push({
        slab_label: `${fromStr} ${toStr} (${slab.rate_percentage}%)`,
        rate_percentage: slab.rate_percentage,
        taxable_in_slab: taxableInSlab,
        tax_amount: slabTax
      });
    }
  }
  return { tax, breakdown };
}

/** Surcharge bands: [income above, rate %]. The new regime caps surcharge at 25%. */
function surchargeBands(regime: 'NEW' | 'OLD'): Array<[number, number]> {
  return [
    [5000000, 10],
    [10000000, 15],
    [20000000, 25],
    [50000000, regime === 'OLD' ? 37 : 25]
  ];
}

/**
 * 5. INCOME TAX / TDS ON SALARY
 * (section 392 of the Income-tax Act, 2025; earlier section 192 of the 1961 Act)
 *
 * Step 1: Estimated annual salary = actual salary to date + this month + projected remaining months
 *         (or this month x 12 when no year-to-date context is supplied)
 * Step 2: Less standard deduction (new regime: per Settings; old regime: ₹50,000)
 *         Less professional tax - OLD regime only (not deductible in the new regime)
 * Step 3: Slab tax for the employee's regime
 * Step 4: Rebate - new regime: nil tax up to the threshold (₹12,00,000), with marginal relief
 *         just above it (tax cannot exceed the income above the threshold);
 *         old regime: nil tax up to ₹5,00,000 (no marginal relief)
 * Step 5: Surcharge above ₹50 lakh, with marginal relief
 * Step 6: Health & education cess 4%
 * Step 7: Monthly TDS = (annual tax - TDS already deducted) / months remaining in the year
 *
 * Not covered: Chapter VI-A deductions, HRA/LTA exemptions, previous-employer income (Form 12B)
 * and other income declared by the employee. Old-regime results are therefore conservative.
 */
export function calculateTDS(
  monthlyTaxableSalary: number,
  monthlyPT: number,
  settings: PayrollSettings = DEFAULT_SETTINGS,
  taxSlabs: TDSSlab[] = DEFAULT_TAX_SLABS,
  regime: 'NEW' | 'OLD' = 'NEW',
  ctx: TDSContext = {}
): TDSCalculationDetail {
  const isNew = regime === 'NEW';
  const stdDeduction = isNew ? (settings.standard_deduction ?? 75000) : OLD_REGIME_STANDARD_DEDUCTION;
  const nilThreshold = isNew ? (settings.nil_tax_threshold ?? 1200000) : OLD_REGIME_REBATE_LIMIT;
  const cessPct = settings.cess_pct ?? 4;

  // Step 1: Estimated annual salary
  const annualizedSalary = Math.round(ctx.annualSalary ?? monthlyTaxableSalary * 12);
  const monthsRemaining = Math.min(12, Math.max(1, Math.round(ctx.monthsRemaining ?? 12)));
  const ytdTds = Math.max(0, ctx.ytdTds ?? 0);

  // Step 2: Deductions
  const annualPT = isNew ? 0 : Math.min(PT_ANNUAL_CAP, Math.round(ctx.annualPT ?? monthlyPT * 12));
  const annualEmployeePF = Math.round(ctx.annualEmployeePF ?? 0);
  const chapterVIA = isNew ? 0 : Math.min(SECTION_80C_LIMIT, annualEmployeePF);
  const taxableIncome = Math.max(0, annualizedSalary - stdDeduction - annualPT - chapterVIA);

  // Step 3: Slab tax (slabs for this regime; configured tax year first, built-in defaults otherwise)
  const forRegime = taxSlabs.filter(s => s.regime === regime);
  const forYear = forRegime.filter(s => s.tax_year === settings.tax_year);
  const slabsToUse = (forYear.length > 0 ? forYear : forRegime.length > 0 ? forRegime : DEFAULT_TAX_SLABS.filter(s => s.regime === regime))
    .slice()
    .sort((a, b) => a.from_amount - b.from_amount);

  const isBelowThreshold = taxableIncome <= nilThreshold;
  let slabBreakdown: TDSCalculationDetail['slab_breakdown'] = [];
  let taxAfterRebate = 0;
  let marginalRelief = 0;
  // Tax on taxable income before rebate (shown on the tax worksheet even when the rebate wipes it out)
  const slabTax = slabTaxOn(taxableIncome, slabsToUse).tax;

  if (!isBelowThreshold) {
    const computed = slabTaxOn(taxableIncome, slabsToUse);
    slabBreakdown = computed.breakdown;
    taxAfterRebate = computed.tax;

    // Step 4: Marginal relief just above the rebate threshold (new regime only)
    if (isNew) {
      const excessIncome = taxableIncome - nilThreshold;
      if (taxAfterRebate > excessIncome) {
        marginalRelief = taxAfterRebate - excessIncome;
        taxAfterRebate = excessIncome;
      }
    }
  }

  // Step 5: Surcharge with marginal relief
  let surcharge = 0;
  const bands = surchargeBands(regime);
  for (let i = bands.length - 1; i >= 0; i--) {
    const [limit, rate] = bands[i];
    if (taxableIncome > limit) {
      const prevRate = i > 0 ? bands[i - 1][1] : 0;
      const taxAtLimit = slabTaxOn(limit, slabsToUse).tax;
      const withSurcharge = taxAfterRebate * (1 + rate / 100);
      const cap = taxAtLimit * (1 + prevRate / 100) + (taxableIncome - limit);
      surcharge = Math.max(0, Math.min(withSurcharge, cap) - taxAfterRebate);
      break;
    }
  }

  // Step 6: Cess
  const taxBeforeCess = taxAfterRebate + surcharge;
  const cessAmount = Math.round((taxBeforeCess * cessPct) / 100);
  const annualTaxWithCess = Math.round(taxBeforeCess + cessAmount);

  // Step 7: Spread the balance over the remaining months
  const balanceTax = Math.max(0, annualTaxWithCess - ytdTds);
  const monthlyTDS = Math.round(balanceTax / monthsRemaining);

  return {
    monthly_taxable_salary: monthlyTaxableSalary,
    annualized_salary: annualizedSalary,
    standard_deduction: stdDeduction,
    annual_pt: annualPT,
    taxable_income: taxableIncome,
    nil_tax_threshold: nilThreshold,
    is_below_threshold: isBelowThreshold,
    slab_breakdown: slabBreakdown,
    tax_before_cess: Math.round(taxBeforeCess),
    cess_amount: cessAmount,
    annual_tax_with_cess: annualTaxWithCess,
    monthly_tds: monthlyTDS,

    regime,
    slab_tax: Math.round(slabTax),
    rebate: Math.round(isBelowThreshold ? slabTax : marginalRelief),
    chapter_via: chapterVIA,
    annual_employee_pf: annualEmployeePF,
    marginal_relief: Math.round(marginalRelief),
    surcharge: Math.round(surcharge),
    ytd_gross: Math.round(ctx.ytdGross ?? 0),
    ytd_tds: Math.round(ytdTds),
    projected_future_salary: Math.round(ctx.projectedFutureSalary ?? 0),
    months_remaining: monthsRemaining,
    balance_tax: Math.round(balanceTax),
    basis: ctx.annualSalary !== undefined ? 'YTD_PROJECTION' : 'MONTH_X_12'
  };
}

/**
 * Year-to-date and contribution-period facts the engine cannot know from one month alone.
 * Supplied by the payroll repository from earlier processed months.
 */
export interface PayrollContext {
  /** Gross salary of earlier processed months in this tax year */
  ytdGross?: number;
  /** TDS deducted in earlier processed months in this tax year */
  ytdTds?: number;
  /** Professional tax deducted in earlier processed months in this tax year */
  ytdPT?: number;
  /** Employee PF deducted in earlier processed months in this tax year */
  ytdPF?: number;
  /** Number of earlier months in this tax year that have a processed payroll record */
  ytdMonthsProcessed?: number;
  /** True if ESIC was deducted in an earlier month of the same contribution period (Apr-Sep / Oct-Mar) */
  esicCoveredInPeriod?: boolean;
}

/**
 * 6. MASTER PAYROLL CALCULATION FOR AN EMPLOYEE
 * 
 * Takes Employee details, Attendance (days payable, OT, Bonus), Settings, Slabs.
 * Returns complete PayrollRecord.
 */
export function calculatePayrollForEmployee(
  employee: Employee,
  payrollMonth: string,
  daysPayable: number,
  overtimeAmount: number = 0,
  bonusAmount: number = 0,
  settings: PayrollSettings = DEFAULT_SETTINGS,
  ptSlabs: PTSlab[] = DEFAULT_PT_SLABS,
  taxSlabs: TDSSlab[] = DEFAULT_TAX_SLABS,
  presentDaysCount?: number,
  lopDaysCount?: number,
  ctx?: PayrollContext
): PayrollRecord {
  const calendarDays = getDaysInPayrollMonth(payrollMonth);

  // Joiners and leavers: pay only for days within the service window
  const window = getEmploymentWindow(employee, payrollMonth);
  const payableDays = Math.min(window.days, calendarDays, Math.max(0, daysPayable));

  // Determine fixed components
  let fixed: SalaryBreakdown;
  if (employee.salary_structure_type === 'DETAILED') {
    fixed = getDetailedSalaryBreakdown(employee);
  } else {
    fixed = calculateSimpleSalarySplit(employee.monthly_gross_salary, settings);
  }

  // Pro-rata factor
  const proRataRatio = calendarDays > 0 ? payableDays / calendarDays : 1;

  // Prorated fixed components
  const earnedBasic = Math.round(fixed.basic * proRataRatio);
  const earnedDa = Math.round(fixed.da * proRataRatio);
  const earnedHra = Math.round(fixed.hra * proRataRatio);
  const earnedConveyance = Math.round(fixed.conveyance * proRataRatio);
  const earnedMedical = Math.round(fixed.medical * proRataRatio);
  const earnedSpecial = Math.round(fixed.special_allowance * proRataRatio);

  // Total Gross Earned = Earned fixed + Overtime + Bonus (OT and Bonus not prorated)
  const earnedFixedTotal = earnedBasic + earnedDa + earnedHra + earnedConveyance + earnedMedical + earnedSpecial;
  const grossEarned = Math.round(earnedFixedTotal + overtimeAmount + bonusAmount);

  // 50% Wage Rule Check:
  // Wages = Basic + DA
  // If non-wage components exceed 50% of total pay:
  // Excess = Non-Wage Components - 50% of Total Pay
  // Add the excess to PF/ESIC/gratuity wage base.
  const wageComponents = earnedBasic + earnedDa;
  const nonWageComponents = earnedHra + earnedConveyance + earnedMedical + earnedSpecial;
  const totalPayForWageRule = earnedFixedTotal;
  const halfTotalPay = totalPayForWageRule * 0.5;

  let wageRuleExcess = 0;
  let wageRuleApplied = false;

  if (settings.wage_rule_50_pct_enabled && nonWageComponents > halfTotalPay) {
    wageRuleExcess = Math.round(nonWageComponents - halfTotalPay);
    wageRuleApplied = true;
  }

  // Base wages for PF / Gratuity
  const adjustedWageBase = wageComponents + wageRuleExcess;

  // Statutory PF calculation
  let employeePF = 0;
  let employerPF = 0;
  let employerEPS = 0;
  let employerEPF = 0;
  let employerEDLI = 0;
  let employerPFAdmin = 0;
  let eligiblePFWages = 0;

  // "BELOW_THRESHOLD": PF only for employees whose fixed Basic + DA is within the wage ceiling
  // (those above it are treated as excluded employees). "ALL": PF for everyone flagged applicable.
  const pfExcludedByRule =
    settings.pf_applicability_rule === 'BELOW_THRESHOLD' &&
    fixed.basic + fixed.da > settings.pf_wage_ceiling;

  if (employee.pf_applicable && !pfExcludedByRule) {
    eligiblePFWages = Math.min(adjustedWageBase, settings.pf_wage_ceiling);
    // Employee PF = 12% of eligible wages
    employeePF = Math.round((eligiblePFWages * settings.pf_employee_pct) / 100);
    // Employer PF = 12% of eligible wages
    employerPF = Math.round((eligiblePFWages * settings.pf_employer_pct) / 100);
    // Employer EPS = 8.33% with ceiling of ₹1,250
    const rawEPS = (eligiblePFWages * settings.pf_eps_pct) / 100;
    employerEPS = Math.round(Math.min(rawEPS, settings.pf_eps_ceiling));
    // Employer EPF = Balance
    employerEPF = employerPF - employerEPS;
    // EDLI (A/c 21) and administrative charges (A/c 2) on PF wages.
    // The ₹500 monthly minimum for admin charges applies per establishment, not per employee.
    employerEDLI = Math.round((eligiblePFWages * (settings.pf_edli_pct ?? DEFAULT_EDLI_PCT)) / 100);
    employerPFAdmin = Math.round((eligiblePFWages * (settings.pf_admin_pct ?? DEFAULT_PF_ADMIN_PCT)) / 100);
  }

  // Statutory ESIC calculation
  let employeeESIC = 0;
  let employerESIC = 0;
  let eligibleESICWages = 0;

  if (settings.esic_enabled && employee.esic_applicable) {
    // Coverage: monthly gross within the ceiling (₹21,000), OR already covered earlier in the
    // same contribution period - coverage continues to the end of that period even if wages
    // have since crossed the ceiling. Contributions are rounded up to the next rupee.
    const withinCeiling = employee.monthly_gross_salary <= settings.esic_salary_ceiling;
    if (withinCeiling || ctx?.esicCoveredInPeriod) {
      eligibleESICWages = grossEarned;
      employeeESIC = roundUpRupee((grossEarned * settings.esic_employee_pct) / 100);
      employerESIC = roundUpRupee((grossEarned * settings.esic_employer_pct) / 100);
    }
  }

  // Statutory Professional Tax
  let professionalTax = 0;
  if (employee.professional_tax_applicable) {
    professionalTax = calculateProfessionalTax(employee.state, grossEarned, ptSlabs, payrollMonth);
  }

  // Statutory Income Tax / TDS
  let tds = 0;
  let tdsDetails: TDSCalculationDetail;
  const regime = employee.tax_regime || 'NEW';

  if (employee.income_tax_applicable) {
    let tdsCtx: TDSContext = {};

    if (ctx) {
      // Year-to-date basis: actuals so far + this month + fixed salary for the remaining months
      const pos = getTaxYearPosition(payrollMonth);
      const dojPos = taxYearPositionOfDate(employee.date_of_joining);
      const dolPos = taxYearPositionOfDate(employee.date_of_leaving);

      const firstServiceIdx = dojPos && dojPos.startYear === pos.startYear ? dojPos.index : 1;
      const lastServiceIdx = dolPos && dolPos.startYear === pos.startYear ? dolPos.index : 12;

      const monthsRemaining = Math.max(1, lastServiceIdx - pos.index + 1);
      const monthsElapsedInService = Math.max(0, pos.index - firstServiceIdx);
      const monthsProcessed = ctx.ytdMonthsProcessed ?? 0;
      // Earlier service months with no processed payroll in this system are estimated at fixed gross
      const unprocessedMonths = Math.max(0, monthsElapsedInService - monthsProcessed);

      const ytdGross = (ctx.ytdGross ?? 0) + unprocessedMonths * fixed.gross;
      const projectedFuture = fixed.gross * (monthsRemaining - 1);
      // Professional tax for the rest of the year, month by month (February can differ)
      let projectedPT = 0;
      if (employee.professional_tax_applicable) {
        const [py, pm] = payrollMonth.split('-').map(v => parseInt(v, 10));
        for (let k = 1; k < monthsRemaining; k++) {
          const d = new Date(py, pm - 1 + k, 1);
          const futureMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          projectedPT += calculateProfessionalTax(employee.state, fixed.gross, ptSlabs, futureMonth);
        }
        projectedPT += unprocessedMonths * calculateProfessionalTax(employee.state, fixed.gross, ptSlabs);
      }

      // Employee PF for the year: deducted so far + this month + a full month's PF for the months ahead
      let fullMonthPF = 0;
      if (employee.pf_applicable && !pfExcludedByRule) {
        const fixedWages = fixed.basic + fixed.da;
        const fixedOther = fixed.hra + fixed.conveyance + fixed.medical + fixed.special_allowance;
        const fixedTotal = fixedWages + fixedOther;
        const fixedExcess = settings.wage_rule_50_pct_enabled && fixedOther > fixedTotal * 0.5 ? Math.round(fixedOther - fixedTotal * 0.5) : 0;
        fullMonthPF = Math.round((Math.min(fixedWages + fixedExcess, settings.pf_wage_ceiling) * settings.pf_employee_pct) / 100);
      }

      tdsCtx = {
        annualEmployeePF: (ctx.ytdPF ?? 0) + employeePF + fullMonthPF * (unprocessedMonths + monthsRemaining - 1),
        annualSalary: ytdGross + grossEarned + projectedFuture,
        ytdGross,
        ytdTds: ctx.ytdTds ?? 0,
        projectedFutureSalary: projectedFuture,
        monthsRemaining,
        annualPT: (ctx.ytdPT ?? 0) + professionalTax + projectedPT
      };
    }

    tdsDetails = calculateTDS(grossEarned, professionalTax, settings, taxSlabs, regime, tdsCtx);
    tds = tdsDetails.monthly_tds;
  } else {
    tdsDetails = {
      monthly_taxable_salary: grossEarned,
      annualized_salary: grossEarned * 12,
      standard_deduction: settings.standard_deduction,
      annual_pt: 0,
      taxable_income: 0,
      nil_tax_threshold: settings.nil_tax_threshold,
      is_below_threshold: true,
      slab_breakdown: [],
      tax_before_cess: 0,
      cess_amount: 0,
      annual_tax_with_cess: 0,
      monthly_tds: 0,
      regime
    };
    tds = 0;
  }

  // TDS cannot exceed what is left of the month's pay after other deductions
  const otherDeductions = employeePF + employeeESIC + professionalTax;
  tds = Math.max(0, Math.min(tds, grossEarned - otherDeductions));
  tdsDetails.monthly_tds = tds;

  // Total Deductions
  const totalDeductions = otherDeductions + tds;

  // Take Home
  const takeHomePay = Math.round(grossEarned - totalDeductions);

  // Gratuity = Wages × 15 ÷ 26 ÷ 12 (Employer cost only)
  // Wages for Gratuity = Basic + DA + wage rule excess
  const gratuityWages = adjustedWageBase;
  const gratuity = Math.round(
    (gratuityWages * settings.gratuity_days) / settings.gratuity_divisor / 12
  );

  // Company Cost (CTC) = Gross Earned + Employer PF + EDLI + PF admin charges + Employer ESIC + Gratuity
  const companyCost = Math.round(
    grossEarned + employerPF + employerEDLI + employerPFAdmin + employerESIC + gratuity
  );

  const presentDays = presentDaysCount !== undefined ? Math.min(presentDaysCount, window.days) : payableDays;
  const lopDays = lopDaysCount !== undefined ? lopDaysCount : Math.max(0, window.days - payableDays);

  return {
    employee_id: employee.employee_id,
    employee_name: employee.name,
    department: employee.department,
    designation: employee.designation,
    pan: employee.pan,
    bank_name: employee.bank_name,
    account_number: employee.account_number,
    ifsc: employee.ifsc,
    uan: employee.uan,
    esic_number: employee.esic_number,
    payroll_month: payrollMonth,

    calendar_days: calendarDays,
    days_payable: payableDays,
    present_days: presentDays,
    lop_days: lopDays,

    fixed_basic: fixed.basic,
    fixed_da: fixed.da,
    fixed_hra: fixed.hra,
    fixed_conveyance: fixed.conveyance,
    fixed_medical: fixed.medical,
    fixed_special: fixed.special_allowance,
    fixed_gross: fixed.gross,

    earned_basic: earnedBasic,
    earned_da: earnedDa,
    earned_hra: earnedHra,
    earned_conveyance: earnedConveyance,
    earned_medical: earnedMedical,
    earned_special: earnedSpecial,
    overtime_amount: overtimeAmount,
    bonus_amount: bonusAmount,
    gross_earned: grossEarned,

    wage_rule_excess: wageRuleExcess,
    wage_rule_applied: wageRuleApplied,
    eligible_pf_wages: eligiblePFWages,
    eligible_esic_wages: eligibleESICWages,

    employee_pf: employeePF,
    employee_esic: employeeESIC,
    professional_tax: professionalTax,
    tds: tds,
    total_deductions: totalDeductions,

    take_home_pay: takeHomePay,

    employer_pf: employerPF,
    employer_eps: employerEPS,
    employer_epf: employerEPF,
    employer_edli: employerEDLI,
    employer_pf_admin: employerPFAdmin,
    employer_esic: employerESIC,
    gratuity: gratuity,
    company_cost: companyCost,

    tds_details: tdsDetails
  };
}
