/**
 * OneHR Payroll Manager - Automated Calculation & Statutory Engine Verification Suite
 * Tests deterministic statutory formulas for Indian Payroll:
 * 1. Simple Salary Split (Basic 45%, DA 5%, HRA 20%, Special 30%, Basic+DA >= 50%)
 * 2. Detailed Salary reconciliation
 * 3. Pro-rata calculations (Fixed components prorated, OT & Bonus not prorated)
 * 4. Attendance calculation (P, A, HD, WO, PH, CL, SL, EL, LOP, OD)
 * 5. 50% Wage Rule adjustment
 * 6. Statutory PF, Employer PF, EPS (8.33% capped at ₹1250), EPF balance
 * 7. ESIC (0.75% / 3.25%, ceiling ₹21,000)
 * 8. Professional Tax by state (Maharashtra, Karnataka, etc.)
 * 9. Income Tax / TDS with standard deduction ₹75,000, nil threshold ₹12,00,000, slabs, 4% cess
 * 10. Gratuity (Wages × 15 / 26 / 12)
 * 11. Take Home & Company Cost
 * 12. Verification of Employee A (₹12,000), Employee B (₹35,000), Employee C (₹1,50,000)
 */

import {
  calculateAttendanceSummary,
  calculatePayrollForEmployee,
  calculateProfessionalTax,
  calculateSimpleSalarySplit,
  calculateTDS,
  DEFAULT_PT_SLABS,
  DEFAULT_SETTINGS,
  DEFAULT_TAX_SLABS,
  getDetailedSalaryBreakdown,
  getEmploymentWindow,
  validateAttendanceImportRow,
  VALID_ATTENDANCE_CODES
} from '../services/payrollEngine';
import { AttendanceCode, Employee } from '../types/payroll';

export interface TestResult {
  suiteName: string;
  testName: string;
  passed: boolean;
  message: string;
  expected?: any;
  actual?: any;
}

export function runAllTests(): { passed: boolean; total: number; passedCount: number; failedCount: number; results: TestResult[] } {
  const results: TestResult[] = [];

  function assert(suiteName: string, testName: string, condition: boolean, message: string, expected?: any, actual?: any) {
    results.push({
      suiteName,
      testName,
      passed: condition,
      message: condition ? `PASS: ${message}` : `FAIL: ${message}`,
      expected,
      actual
    });
  }

  // 1. Simple Salary Split
  {
    const split12k = calculateSimpleSalarySplit(12000, DEFAULT_SETTINGS);
    const sum12k = split12k.basic + split12k.da + split12k.hra + split12k.special_allowance;
    assert('Salary Split', '12k Gross reconciles exactly', sum12k === 12000, `Sum = ${sum12k}, Gross = 12000`, 12000, sum12k);
    assert('Salary Split', '12k Basic+DA >= 50%', (split12k.basic + split12k.da) >= 6000, `Basic+DA = ${split12k.basic + split12k.da}`, 6000, split12k.basic + split12k.da);
    assert('Salary Split', '12k Basic is 45%', split12k.basic === 5400, `Basic = ${split12k.basic}`, 5400, split12k.basic);
    assert('Salary Split', '12k DA is 5%', split12k.da === 600, `DA = ${split12k.da}`, 600, split12k.da);
    assert('Salary Split', '12k HRA is 20%', split12k.hra === 2400, `HRA = ${split12k.hra}`, 2400, split12k.hra);
    assert('Salary Split', '12k Special is 30%', split12k.special_allowance === 3600, `Special = ${split12k.special_allowance}`, 3600, split12k.special_allowance);

    const split150k = calculateSimpleSalarySplit(150000, DEFAULT_SETTINGS);
    const sum150k = split150k.basic + split150k.da + split150k.hra + split150k.special_allowance;
    assert('Salary Split', '150k Gross reconciles exactly', sum150k === 150000, `Sum = ${sum150k}, Gross = 150000`, 150000, sum150k);
  }

  // 2. Detailed Salary Breakdown
  {
    const empDetailed: Partial<Employee> = {
      monthly_gross_salary: 35000,
      basic: 15000,
      da: 2500,
      hra: 7000,
      conveyance: 1600,
      medical: 1250,
      special_allowance: 7650
    };
    const detailed = getDetailedSalaryBreakdown(empDetailed);
    const sum = detailed.basic + detailed.da + detailed.hra + detailed.conveyance + detailed.medical + detailed.special_allowance;
    assert('Detailed Salary', 'Sum equals gross', sum === 35000, `Sum = ${sum}`, 35000, sum);
  }

  // 3. Attendance Calculation
  {
    const daysMap: Record<number, AttendanceCode> = {
      1: 'P', 2: 'P', 3: 'P', 4: 'P', 5: 'P',
      6: 'WO', 7: 'WO',
      8: 'P', 9: 'P', 10: 'HD', 11: 'P', 12: 'P',
      13: 'WO', 14: 'WO',
      15: 'PH', 16: 'CL', 17: 'P', 18: 'P', 19: 'P',
      20: 'WO', 21: 'WO',
      22: 'A', 23: 'LOP', 24: 'OD', 25: 'P', 26: 'P',
      27: 'WO', 28: 'WO',
      29: 'P', 30: 'P'
    };
    const att = calculateAttendanceSummary(daysMap, 30);
    // Present: 1,2,3,4,5, 8,9, 11,12, 17,18,19, 24(OD=present), 25,26, 29,30 = 17 days
    // HD: day 10 = 1 (0.5 day)
    // Paid leave: day 16 (CL) = 1
    // WO: 6,7, 13,14, 20,21, 27,28 = 8 days
    // PH: day 15 = 1 day
    // LOP: 22(A), 23(LOP) = 2 days
    // Days payable = 17 + 0.5 + 1 + 8 + 1 = 27.5 days
    assert('Attendance', 'Calculates Days Payable accurately', att.days_payable === 27.5, `Payable = ${att.days_payable}`, 27.5, att.days_payable);
    assert('Attendance', 'Calculates LOP correctly', att.lop_days === 2, `LOP = ${att.lop_days}`, 2, att.lop_days);
  }

  // 4. Pro-rata Logic
  {
    const emp12k: Employee = {
      id: '1',
      employee_id: 'TEST12K',
      name: 'Test Pro Rata',
      pan: 'ABCDE1234F',
      date_of_joining: '2025-01-01',
      department: 'Operations',
      designation: 'Staff',
      location: 'Mumbai',
      employment_status: 'ACTIVE',
      bank_name: 'HDFC',
      account_number: '1234567890',
      ifsc: 'HDFC0001234',
      uan: '100123456789',
      esic_number: '31001234567890123',
      monthly_gross_salary: 12000,
      salary_structure_type: 'SIMPLE',
      pf_applicable: true,
      esic_applicable: true,
      professional_tax_applicable: true,
      income_tax_applicable: true,
      tax_regime: 'NEW',
      state: 'Maharashtra'
    };

    // 15 days out of 30 days in April
    // OT = 1000, Bonus = 500 (OT & Bonus must not be prorated)
    const recHalf = calculatePayrollForEmployee(emp12k, '2025-04', 15, 1000, 500);
    // Earned fixed = 12000 * 15 / 30 = 6000
    // Gross earned = 6000 + 1000 + 500 = 7500
    assert('Pro Rata', 'Fixed components prorated to 50%', (recHalf.earned_basic + recHalf.earned_da + recHalf.earned_hra + recHalf.earned_special) === 6000, `Earned Fixed = ${recHalf.earned_basic + recHalf.earned_da + recHalf.earned_hra + recHalf.earned_special}`, 6000, recHalf.earned_basic + recHalf.earned_da + recHalf.earned_hra + recHalf.earned_special);
    assert('Pro Rata', 'OT and Bonus added without proration', recHalf.gross_earned === 7500, `Gross = ${recHalf.gross_earned}`, 7500, recHalf.gross_earned);
  }

  // 5. 50% Wage Rule Check
  {
    // Employee with non-wage components exceeding 50%
    // e.g. Gross 50000: Basic 15000 (30%), DA 0, Special 35000 (70%)
    const empHeavySpecial: Employee = {
      id: '2',
      employee_id: 'WAGE50',
      name: 'Test 50% Rule',
      pan: 'ABCDE1234G',
      date_of_joining: '2025-01-01',
      department: 'Tech',
      designation: 'Engineer',
      location: 'Mumbai',
      employment_status: 'ACTIVE',
      bank_name: 'ICICI',
      account_number: '1234567890',
      ifsc: 'ICIC0001234',
      uan: '100123456789',
      esic_number: '',
      monthly_gross_salary: 50000,
      salary_structure_type: 'DETAILED',
      basic: 15000,
      da: 0,
      hra: 10000,
      conveyance: 5000,
      medical: 5000,
      special_allowance: 15000, // Non-wage = 35,000 > 50% of 50,000 (25,000)
      pf_applicable: true,
      esic_applicable: false,
      professional_tax_applicable: true,
      income_tax_applicable: true,
      tax_regime: 'NEW',
      state: 'Maharashtra'
    };

    const rec = calculatePayrollForEmployee(empHeavySpecial, '2025-04', 30);
    // Non-wage = 35000. 50% of 50000 = 25000. Excess = 10000.
    assert('50% Wage Rule', 'Detects excess non-wage components', rec.wage_rule_applied === true, `Wage rule applied: ${rec.wage_rule_applied}`, true, rec.wage_rule_applied);
    assert('50% Wage Rule', 'Calculates excess exactly', rec.wage_rule_excess === 10000, `Excess = ${rec.wage_rule_excess}`, 10000, rec.wage_rule_excess);
  }

  // 6. Professional Tax
  {
    // Maharashtra: 0-7500: 0, 7501-10000: 175, >10000: 200
    assert('Professional Tax', 'MH < 7500 is 0', calculateProfessionalTax('Maharashtra', 7000, DEFAULT_PT_SLABS) === 0, 'PT for 7000', 0, calculateProfessionalTax('Maharashtra', 7000, DEFAULT_PT_SLABS));
    assert('Professional Tax', 'MH 7501-10000 is 175', calculateProfessionalTax('Maharashtra', 9000, DEFAULT_PT_SLABS) === 175, 'PT for 9000', 175, calculateProfessionalTax('Maharashtra', 9000, DEFAULT_PT_SLABS));
    assert('Professional Tax', 'MH > 10000 is 200', calculateProfessionalTax('Maharashtra', 35000, DEFAULT_PT_SLABS) === 200, 'PT for 35000', 200, calculateProfessionalTax('Maharashtra', 35000, DEFAULT_PT_SLABS));
    // Karnataka: < 25000: 0, >= 25000: 200
    assert('Professional Tax', 'KA < 25000 is 0', calculateProfessionalTax('Karnataka', 12000, DEFAULT_PT_SLABS) === 0, 'PT for 12000 in KA', 0, calculateProfessionalTax('Karnataka', 12000, DEFAULT_PT_SLABS));
    assert('Professional Tax', 'KA >= 25000 is 200', calculateProfessionalTax('Karnataka', 35000, DEFAULT_PT_SLABS) === 200, 'PT for 35000 in KA', 200, calculateProfessionalTax('Karnataka', 35000, DEFAULT_PT_SLABS));
    // Delhi: 0
    assert('Professional Tax', 'Delhi is 0', calculateProfessionalTax('Delhi', 150000, DEFAULT_PT_SLABS) === 0, 'PT for Delhi', 0, calculateProfessionalTax('Delhi', 150000, DEFAULT_PT_SLABS));
  }

  // 7. Income Tax / TDS
  {
    // Taxable salary = 35,000, PT = 200
    // Annualized = 4,20,000 - 75,000 = 3,45,000 <= 12,00,000 -> Nil TDS (PT is not deductible in the new regime)
    const tds35k = calculateTDS(35000, 200, DEFAULT_SETTINGS, DEFAULT_TAX_SLABS, 'NEW');
    assert('TDS', '35k monthly income is Nil TDS', tds35k.monthly_tds === 0, `Monthly TDS = ${tds35k.monthly_tds}`, 0, tds35k.monthly_tds);
    assert('TDS', '35k is below nil threshold', tds35k.is_below_threshold === true, 'Below threshold', true, tds35k.is_below_threshold);

    // Taxable salary = 1,50,000, PT = 200
    // Annualized = 18,00,000
    // Less std deduction 75,000 = 17,25,000 (PT is not deductible in the new regime)
    // Slabs:
    // 0-4L: 0
    // 4L-8L: 4,00,000 * 5% = 20,000
    // 8L-12L: 4,00,000 * 10% = 40,000
    // 12L-16L: 4,00,000 * 15% = 60,000
    // 16L-17.25L: 1,25,000 * 20% = 25,000
    // Tax before cess = 20000 + 40000 + 60000 + 25000 = 1,45,000
    // Cess 4% = 5,800
    // Annual Tax = 1,50,800
    // Monthly TDS = round(150800 / 12) = 12,567
    const tds150k = calculateTDS(150000, 200, DEFAULT_SETTINGS, DEFAULT_TAX_SLABS, 'NEW');
    assert('TDS', '150k taxable income is 17,25,000', tds150k.taxable_income === 1725000, `Taxable income = ${tds150k.taxable_income}`, 1725000, tds150k.taxable_income);
    assert('TDS', '150k tax before cess is 145000', tds150k.tax_before_cess === 145000, `Tax before cess = ${tds150k.tax_before_cess}`, 145000, tds150k.tax_before_cess);
    assert('TDS', '150k cess is 5,800', tds150k.cess_amount === 5800, `Cess = ${tds150k.cess_amount}`, 5800, tds150k.cess_amount);
    assert('TDS', '150k annual tax including cess is 1,50,800', tds150k.annual_tax_with_cess === 150800, `Annual tax = ${tds150k.annual_tax_with_cess}`, 150800, tds150k.annual_tax_with_cess);
    assert('TDS', '150k monthly TDS is exactly 12,567', tds150k.monthly_tds === 12567, `Monthly TDS = ${tds150k.monthly_tds}`, 12567, tds150k.monthly_tds);
  }

  // 8. Specific Verification of Required Demo Employees:
  // Employee A: ₹12,000
  // Employee B: ₹35,000
  // Employee C: ₹1,50,000
  {
    // Employee A: ₹12,000, Simple, MH, 30 days, OT 500, Bonus 0
    const empA: Employee = {
      id: 'DEMO-A',
      employee_id: 'EMP001',
      name: 'Rajesh Sharma',
      pan: 'ABCPS1234A',
      date_of_joining: '2024-04-01',
      department: 'Operations',
      designation: 'Field Executive',
      location: 'Mumbai',
      employment_status: 'ACTIVE',
      bank_name: 'State Bank of India',
      account_number: '20192837461',
      ifsc: 'SBIN0001234',
      uan: '100928374651',
      esic_number: '31002938475618293',
      monthly_gross_salary: 12000,
      salary_structure_type: 'SIMPLE',
      pf_applicable: true,
      esic_applicable: true,
      professional_tax_applicable: true,
      income_tax_applicable: true,
      tax_regime: 'NEW',
      state: 'Maharashtra'
    };

    const recA = calculatePayrollForEmployee(empA, '2025-04', 30, 500, 0);

    // Verify Employee A:
    // Fixed: Basic = 5400, DA = 600, HRA = 2400, Special = 3600
    // Gross earned = 12000 + 500 OT = 12,500
    // PF Wages = Basic + DA = 6000 <= 15000 ceiling.
    // Employee PF = 6000 * 12% = 720
    // Employer PF = 6000 * 12% = 720
    // Employer EPS = min(6000 * 8.33%, 1250) = 500
    // Employer EPF = 720 - 500 = 220
    // ESIC: Gross 12000 <= 21000 -> ESIC is applicable!
    // Gross earned = 12,500. Employee ESIC = 12500 * 0.75% = 94.
    // Employer ESIC = 12500 * 3.25% = 406.25, rounded up to 407.
    // PT for MH with 12,500 gross = 200.
    // TDS = 0 (well below 12L).
    // Total Deductions = 720 + 94 + 200 = 1014.
    // Take Home = 12500 - 1014 = 11486.
    // Gratuity = 6000 * 15 / 26 / 12 = 288.
    // EDLI = 6000 * 0.5% = 30; PF admin charges = 6000 * 0.5% = 30.
    // Company Cost = 12500 + 720 + 30 + 30 + 407 + 288 = 13975.

    assert('Employee A (12k)', 'Gross earned is 12,500 with OT', recA.gross_earned === 12500, `Gross = ${recA.gross_earned}`, 12500, recA.gross_earned);
    assert('Employee A (12k)', 'Employee PF is 720', recA.employee_pf === 720, `PF = ${recA.employee_pf}`, 720, recA.employee_pf);
    assert('Employee A (12k)', 'Employer EPS is 500', recA.employer_eps === 500, `EPS = ${recA.employer_eps}`, 500, recA.employer_eps);
    assert('Employee A (12k)', 'Employer EPF is 220', recA.employer_epf === 220, `EPF = ${recA.employer_epf}`, 220, recA.employer_epf);
    assert('Employee A (12k)', 'Employee ESIC is 94', recA.employee_esic === 94, `ESIC = ${recA.employee_esic}`, 94, recA.employee_esic);
    assert('Employee A (12k)', 'Employer ESIC is 407 (rounded up)', recA.employer_esic === 407, `Employer ESIC = ${recA.employer_esic}`, 407, recA.employer_esic);
    assert('Employee A (12k)', 'PT is 200', recA.professional_tax === 200, `PT = ${recA.professional_tax}`, 200, recA.professional_tax);
    assert('Employee A (12k)', 'TDS is 0', recA.tds === 0, `TDS = ${recA.tds}`, 0, recA.tds);
    assert('Employee A (12k)', 'Take Home is 11,486', recA.take_home_pay === 11486, `Take Home = ${recA.take_home_pay}`, 11486, recA.take_home_pay);
    assert('Employee A (12k)', 'Gratuity is 288', recA.gratuity === 288, `Gratuity = ${recA.gratuity}`, 288, recA.gratuity);
    assert('Employee A (12k)', 'Company Cost is 13,975', recA.company_cost === 13975, `Company Cost = ${recA.company_cost}`, 13975, recA.company_cost);
  }

  // Employee B: ₹35,000, Detailed, Karnataka, 28/30 days (2 LOP), OT 1500, Bonus 2000
  {
    const empB: Employee = {
      id: 'DEMO-B',
      employee_id: 'EMP002',
      name: 'Priya Nair',
      pan: 'ABCDE5678B',
      date_of_joining: '2023-08-15',
      department: 'Human Resources',
      designation: 'HR Specialist',
      location: 'Bengaluru',
      employment_status: 'ACTIVE',
      bank_name: 'ICICI Bank',
      account_number: '10928374652',
      ifsc: 'ICIC0005678',
      uan: '100827364512',
      esic_number: '',
      monthly_gross_salary: 35000,
      salary_structure_type: 'DETAILED',
      basic: 16000,
      da: 2000,
      hra: 7000,
      conveyance: 1600,
      medical: 1250,
      special_allowance: 7150,
      pf_applicable: true,
      esic_applicable: false, // > 21,000
      professional_tax_applicable: true,
      income_tax_applicable: true,
      tax_regime: 'NEW',
      state: 'Karnataka'
    };

    const recB = calculatePayrollForEmployee(empB, '2025-04', 28, 1500, 2000);
    // 28 / 30 days = 0.93333
    // Fixed components prorated:
    // Basic: 16000 * 28/30 = 14933
    // DA: 2000 * 28/30 = 1867
    // Earned Wages (Basic+DA) = 14933 + 1867 = 16800.
    // Non-wage = (7000 + 1600 + 1250 + 7150) * 28/30 = 17000 * 28/30 = 15867
    // Total Earned Fixed = 16800 + 15867 = 32667.
    // Non-wage is not > 50% of total (15867 < 16333.5).
    // Gross earned = 32667 + 1500 OT + 2000 Bonus = 36,167.
    // Eligible PF Wages: capped at 15,000 ceiling.
    // Employee PF = 15000 * 12% = 1800.
    // Employer PF = 15000 * 12% = 1800.
    // Employer EPS = min(15000 * 8.33%, 1250) = 1250 (cap hit!).
    // Employer EPF = 1800 - 1250 = 550.
    // ESIC: Not applicable (gross 35k > 21k ceiling).
    // PT for Karnataka with gross > 15000 = 200.
    // TDS = 0 (annualized ~ 4.3L <= 12L threshold).
    // Total Deductions = 1800 + 200 = 2000.
    // Take Home = 36167 - 2000 = 34,167.

    assert('Employee B (35k)', 'Gross earned is ~36,167', Math.abs(recB.gross_earned - 36167) <= 5, `Gross = ${recB.gross_earned}`, 36167, recB.gross_earned);
    assert('Employee B (35k)', 'PF Wages capped at 15,000 ceiling', recB.eligible_pf_wages === 15000, `PF Wages = ${recB.eligible_pf_wages}`, 15000, recB.eligible_pf_wages);
    assert('Employee B (35k)', 'Employee PF is 1,800', recB.employee_pf === 1800, `PF = ${recB.employee_pf}`, 1800, recB.employee_pf);
    assert('Employee B (35k)', 'Employer EPS hits 1,250 cap', recB.employer_eps === 1250, `EPS = ${recB.employer_eps}`, 1250, recB.employer_eps);
    assert('Employee B (35k)', 'Employer EPF is 550', recB.employer_epf === 550, `EPF = ${recB.employer_epf}`, 550, recB.employer_epf);
    assert('Employee B (35k)', 'ESIC is 0 (above ceiling)', recB.employee_esic === 0, `ESIC = ${recB.employee_esic}`, 0, recB.employee_esic);
    assert('Employee B (35k)', 'PT is 200 for Karnataka', recB.professional_tax === 200, `PT = ${recB.professional_tax}`, 200, recB.professional_tax);
    assert('Employee B (35k)', 'TDS is 0', recB.tds === 0, `TDS = ${recB.tds}`, 0, recB.tds);
    assert('Employee B (35k)', 'Take Home is ~34,167', Math.abs(recB.take_home_pay - 34167) <= 5, `Take Home = ${recB.take_home_pay}`, 34167, recB.take_home_pay);
  }

  // Employee C: ₹1,50,000, Detailed, Maharashtra, 30 days, OT 0, Bonus 10000
  {
    const empC: Employee = {
      id: 'DEMO-C',
      employee_id: 'EMP003',
      name: 'Vikramaditya Verma',
      pan: 'ABCDE9012C',
      date_of_joining: '2021-01-10',
      department: 'Engineering',
      designation: 'VP of Engineering',
      location: 'Pune',
      employment_status: 'ACTIVE',
      bank_name: 'Axis Bank',
      account_number: '91827364501',
      ifsc: 'UTIB0001234',
      uan: '100716253412',
      esic_number: '',
      monthly_gross_salary: 150000,
      salary_structure_type: 'DETAILED',
      basic: 67500,
      da: 7500,
      hra: 30000,
      conveyance: 5000,
      medical: 5000,
      special_allowance: 35000,
      pf_applicable: true,
      esic_applicable: false,
      professional_tax_applicable: true,
      income_tax_applicable: true,
      tax_regime: 'NEW',
      state: 'Maharashtra'
    };

    const recC = calculatePayrollForEmployee(empC, '2025-04', 30, 0, 10000);
    // Gross earned = 150,000 + 10,000 bonus = 160,000.
    // PF wages capped at 15000 ceiling.
    // Employee PF = 1800, Employer PF = 1800 (EPS 1250, EPF 550).
    // ESIC = 0.
    // PT = 200.
    // TDS calculation:
    // Monthly Taxable = 160,000.
    // Annualized = 19,20,000.
    // Less std ded 75,000 = 18,45,000 (PT not deductible in the new regime).
    // Slabs:
    // 0-4L: 0
    // 4L-8L: 20000
    // 8L-12L: 40000
    // 12L-16L: 60000
    // 16L-18.45L: 2,45,000 * 20% = 49,000
    // Total before cess = 1,69,000
    // Cess 4% = 6,760
    // Annual tax = 1,75,760
    // Monthly TDS = round(175760 / 12) = 14,647 (month x 12 basis, no year-to-date context).

    assert('Employee C (150k)', 'Gross earned is 1,60,000 with bonus', recC.gross_earned === 160000, `Gross = ${recC.gross_earned}`, 160000, recC.gross_earned);
    assert('Employee C (150k)', 'PF is 1,800', recC.employee_pf === 1800, `PF = ${recC.employee_pf}`, 1800, recC.employee_pf);
    assert('Employee C (150k)', 'PT is 200', recC.professional_tax === 200, `PT = ${recC.professional_tax}`, 200, recC.professional_tax);
    assert('Employee C (150k)', 'Monthly TDS is 14,647 on month x 12 basis', recC.tds === 14647, `TDS = ${recC.tds}`, 14647, recC.tds);
    assert('Employee C (150k)', 'Take Home = Gross - Deductions', recC.take_home_pay === (recC.gross_earned - recC.total_deductions), `Take Home = ${recC.take_home_pay}`, recC.gross_earned - recC.total_deductions, recC.take_home_pay);
    assert('Employee C (150k)', 'Company Cost includes Employer PF, EDLI, admin charges, ESIC and Gratuity', recC.company_cost === (recC.gross_earned + recC.employer_pf + 75 + 75 + recC.employer_esic + recC.gratuity), `Company Cost = ${recC.company_cost}`, recC.gross_earned + recC.employer_pf + 150 + recC.employer_esic + recC.gratuity, recC.company_cost);

    // Also verify Employee C without bonus (pure ₹1,50,000 monthly gross)
    const recCExact = calculatePayrollForEmployee(empC, '2025-04', 30, 0, 0);
    assert('Employee C (150k Exact)', 'Gross earned is 1,50,000', recCExact.gross_earned === 150000, `Gross = ${recCExact.gross_earned}`, 150000, recCExact.gross_earned);
    assert('Employee C (150k Exact)', 'Taxable income is 17,25,000', recCExact.tds_details.taxable_income === 1725000, `Taxable = ${recCExact.tds_details.taxable_income}`, 1725000, recCExact.tds_details.taxable_income);
    assert('Employee C (150k Exact)', 'Tax before cess is 1,45,000', recCExact.tds_details.tax_before_cess === 145000, `Tax before cess = ${recCExact.tds_details.tax_before_cess}`, 145000, recCExact.tds_details.tax_before_cess);
    assert('Employee C (150k Exact)', 'Cess is 5,800', recCExact.tds_details.cess_amount === 5800, `Cess = ${recCExact.tds_details.cess_amount}`, 5800, recCExact.tds_details.cess_amount);
    assert('Employee C (150k Exact)', 'Annual tax including cess is 1,50,800', recCExact.tds_details.annual_tax_with_cess === 150800, `Annual tax = ${recCExact.tds_details.annual_tax_with_cess}`, 150800, recCExact.tds_details.annual_tax_with_cess);
    assert('Employee C (150k Exact)', 'Monthly TDS is exactly 12,567', recCExact.tds === 12567, `TDS = ${recCExact.tds}`, 12567, recCExact.tds);
    assert('Employee C (150k Exact)', 'Take Home = 150000 - 1800(PF) - 200(PT) - 12567(TDS) = 1,35,433', recCExact.take_home_pay === 135433, `Take Home = ${recCExact.take_home_pay}`, 135433, recCExact.take_home_pay);
  }

  // 9. Attendance Excel Validation Rules
  {
    // A. Blank employee name = ERROR (Even when a valid Employee ID exists)
    const rowBlankName = {
      'Employee ID': 'EMP001',
      'Employee Name': '',
      'Day 1': 'P', 'Day 2': 'P', 'Day 3': 'P',
      'OT Amount': 0, 'Bonus': 0
    };
    const resA = validateAttendanceImportRow(rowBlankName, 1, 30, '2025-04', (id) => id === 'EMP001');
    assert(
      'Attendance Excel Validation',
      'A. Blank employee name results in ERROR even with valid Employee ID',
      resA.status === 'ERROR' && resA.issues.some(msg => msg.toLowerCase().includes('employee name')),
      `Status = ${resA.status}, Issues = ${resA.message}`,
      'ERROR',
      resA.status
    );

    const rowWhitespaceName = {
      employee_id: 'EMP001',
      name: '   ',
      'Day 1': 'P'
    };
    const resA2 = validateAttendanceImportRow(rowWhitespaceName, 2, 30, '2025-04', (id) => id === 'EMP001');
    assert(
      'Attendance Excel Validation',
      'A2. Whitespace employee name results in ERROR',
      resA2.status === 'ERROR',
      `Status = ${resA2.status}`,
      'ERROR',
      resA2.status
    );

    // B. Invalid attendance code = ERROR (Show: "Invalid attendance code 'INVALID_XYZ' on Day X.")
    const rowInvalidCode = {
      'Employee ID': 'EMP001',
      'Employee Name': 'Rajesh Sharma',
      'Day 1': 'P',
      'Day 2': 'INVALID_XYZ',
      'Day 3': 'P',
      'OT Amount': 0,
      'Bonus': 0
    };
    const resB = validateAttendanceImportRow(rowInvalidCode, 3, 30, '2025-04', (id) => id === 'EMP001');
    assert(
      'Attendance Excel Validation',
      'B. Invalid attendance code results in ERROR',
      resB.status === 'ERROR',
      `Status = ${resB.status}`,
      'ERROR',
      resB.status
    );
    assert(
      'Attendance Excel Validation',
      'B. Error message matches expected format',
      resB.issues.includes("Invalid attendance code 'INVALID_XYZ' on Day 2."),
      `Issues = ${resB.issues.join('; ')}`,
      "Invalid attendance code 'INVALID_XYZ' on Day 2.",
      resB.issues[0]
    );

    // C. Missing numeric field = 0 + WARNING
    const rowMissingNumeric = {
      'Employee ID': 'EMP001',
      'Employee Name': 'Rajesh Sharma',
      'Day 1': 'P', 'Day 2': 'P', 'Day 3': 'P'
      // OT Amount and Bonus omitted
    };
    const resC = validateAttendanceImportRow(rowMissingNumeric, 4, 30, '2025-04', (id) => id === 'EMP001');
    assert(
      'Attendance Excel Validation',
      'C. Missing numeric field results in WARNING',
      resC.status === 'WARNING',
      `Status = ${resC.status}`,
      'WARNING',
      resC.status
    );
    assert(
      'Attendance Excel Validation',
      'C. Missing numeric fields default to 0',
      resC.sanitizedRow?.overtime_amount === 0 && resC.sanitizedRow?.bonus_amount === 0,
      `OT = ${resC.sanitizedRow?.overtime_amount}, Bonus = ${resC.sanitizedRow?.bonus_amount}`,
      '0 & 0',
      `${resC.sanitizedRow?.overtime_amount} & ${resC.sanitizedRow?.bonus_amount}`
    );
    assert(
      'Attendance Excel Validation',
      'C. Warning messages emitted for missing numeric fields',
      resC.warnings.some(w => w.includes('Overtime')) && resC.warnings.some(w => w.includes('Bonus')),
      `Warnings = ${resC.warnings.join('; ')}`,
      true,
      true
    );

    // D. Invalid numeric field = 0 + WARNING
    const rowInvalidNumeric = {
      'Employee ID': 'EMP001',
      'Employee Name': 'Rajesh Sharma',
      'Day 1': 'P',
      'OT Amount': 'INVALID_OT',
      'Bonus': 'INVALID_BONUS'
    };
    const resD = validateAttendanceImportRow(rowInvalidNumeric, 5, 30, '2025-04', (id) => id === 'EMP001');
    assert(
      'Attendance Excel Validation',
      'D. Invalid numeric field results in WARNING',
      resD.status === 'WARNING',
      `Status = ${resD.status}`,
      'WARNING',
      resD.status
    );
    assert(
      'Attendance Excel Validation',
      'D. Invalid numeric fields default to 0',
      resD.sanitizedRow?.overtime_amount === 0 && resD.sanitizedRow?.bonus_amount === 0,
      `OT = ${resD.sanitizedRow?.overtime_amount}, Bonus = ${resD.sanitizedRow?.bonus_amount}`,
      '0 & 0',
      `${resD.sanitizedRow?.overtime_amount} & ${resD.sanitizedRow?.bonus_amount}`
    );
    assert(
      'Attendance Excel Validation',
      'D. Warning messages emitted for invalid numbers',
      resD.warnings.some(w => w.includes('Invalid Overtime number')) && resD.warnings.some(w => w.includes('Invalid Bonus number')),
      `Warnings = ${resD.warnings.join('; ')}`,
      true,
      true
    );

    // E. Valid attendance codes remain unchanged
    const validCodes: AttendanceCode[] = ['P', 'A', 'HD', 'WO', 'PH', 'CL', 'SL', 'EL', 'LOP', 'OD'];
    const rowAllValid: any = {
      'Employee ID': 'EMP001',
      'Employee Name': 'Rajesh Sharma',
      'OT Amount': 750,
      'Bonus': 1500
    };
    for (let d = 1; d <= 30; d++) {
      rowAllValid[`Day ${d}`] = d <= validCodes.length ? validCodes[d - 1] : 'P';
    }
    const resE = validateAttendanceImportRow(rowAllValid, 6, 30, '2025-04', (id) => id === 'EMP001');
    assert(
      'Attendance Excel Validation',
      'E. All valid attendance codes accepted as VALID',
      resE.status === 'VALID' && resE.issues.length === 0 && resE.warnings.length === 0,
      `Status = ${resE.status}`,
      'VALID',
      resE.status
    );
    const daysPreserved = validCodes.every((code, idx) => resE.sanitizedRow?.daysMap[idx + 1] === code);
    assert(
      'Attendance Excel Validation',
      'E. Valid attendance codes preserved unchanged in sanitized map',
      daysPreserved,
      `Days preserved = ${daysPreserved}`,
      true,
      daysPreserved
    );
    assert(
      'Attendance Excel Validation',
      'E. Valid numeric fields preserved accurately',
      resE.sanitizedRow?.overtime_amount === 750 && resE.sanitizedRow?.bonus_amount === 1500,
      `OT = ${resE.sanitizedRow?.overtime_amount}, Bonus = ${resE.sanitizedRow?.bonus_amount}`,
      '750 & 1500',
      `${resE.sanitizedRow?.overtime_amount} & ${resE.sanitizedRow?.bonus_amount}`
    );
  }

  // 10. Statutory corrections: marginal relief, regimes, surcharge, YTD basis, joiners/leavers, ESIC, PT, PF
  {
    const baseEmp: Employee = {
      id: 'emp_t1',
      employee_id: 'T001',
      name: 'Test Employee',
      pan: 'AAAPT0001A',
      date_of_joining: '2020-01-01',
      department: 'Finance',
      designation: 'Executive',
      location: 'Kolkata',
      employment_status: 'ACTIVE',
      bank_name: 'Test Bank',
      account_number: '000000000001',
      ifsc: 'TEST0000001',
      uan: '',
      esic_number: '',
      monthly_gross_salary: 30000,
      salary_structure_type: 'SIMPLE',
      pf_applicable: true,
      esic_applicable: false,
      professional_tax_applicable: false,
      income_tax_applicable: true,
      tax_regime: 'NEW',
      state: 'West Bengal'
    };
    const eq = (suite: string, name: string, actual: any, expected: any) =>
      assert(suite, name, actual === expected, `${name}: got ${actual}`, expected, actual);

    // Marginal relief (new regime). Salary 12,85,000 -> taxable 12,10,000.
    // Slab tax = 20,000 + 40,000 + 1,500 = 61,500, but tax cannot exceed income above 12,00,000 = 10,000.
    // Cess 400 -> annual tax 10,400 -> monthly 867.
    const mr = calculateTDS(0, 0, DEFAULT_SETTINGS, DEFAULT_TAX_SLABS, 'NEW', { annualSalary: 1285000 });
    eq('Marginal Relief', 'Taxable income 12,10,000', mr.taxable_income, 1210000);
    eq('Marginal Relief', 'Tax limited to 10,000', mr.tax_before_cess, 10000);
    eq('Marginal Relief', 'Relief given is 51,500', mr.marginal_relief, 51500);
    eq('Marginal Relief', 'Annual tax with cess 10,400', mr.annual_tax_with_cess, 10400);
    eq('Marginal Relief', 'Monthly TDS 867', mr.monthly_tds, 867);

    const atLimit = calculateTDS(0, 0, DEFAULT_SETTINGS, DEFAULT_TAX_SLABS, 'NEW', { annualSalary: 1275000 });
    eq('Marginal Relief', 'Taxable exactly 12,00,000 is nil', atLimit.annual_tax_with_cess, 0);

    // Beyond the relief zone: taxable 13,00,000 -> slab tax 75,000 < excess 1,00,000 -> no relief. Cess 3,000.
    const beyond = calculateTDS(0, 0, DEFAULT_SETTINGS, DEFAULT_TAX_SLABS, 'NEW', { annualSalary: 1375000 });
    eq('Marginal Relief', 'No relief at taxable 13,00,000', beyond.marginal_relief, 0);
    eq('Marginal Relief', 'Annual tax 78,000 at taxable 13,00,000', beyond.annual_tax_with_cess, 78000);

    // PT is not deductible in the new regime
    const newPt = calculateTDS(150000, 200, DEFAULT_SETTINGS, DEFAULT_TAX_SLABS, 'NEW');
    eq('Regime Rules', 'New regime: PT deduction is 0', newPt.annual_pt, 0);

    // Old regime: 1,00,000 a month, PT 200. 12,00,000 - 50,000 - 2,400 = 11,47,600.
    // Tax = 12,500 + 1,00,000 + 1,47,600 * 30% = 1,56,780. Cess 6,271. Total 1,63,051. Monthly 13,588.
    const old = calculateTDS(100000, 200, DEFAULT_SETTINGS, DEFAULT_TAX_SLABS, 'OLD');
    eq('Regime Rules', 'Old regime: standard deduction 50,000', old.standard_deduction, 50000);
    eq('Regime Rules', 'Old regime: PT deduction 2,400', old.annual_pt, 2400);
    eq('Regime Rules', 'Old regime: taxable 11,47,600', old.taxable_income, 1147600);
    eq('Regime Rules', 'Old regime: tax before cess 1,56,780', old.tax_before_cess, 156780);
    eq('Regime Rules', 'Old regime: annual tax 1,63,051', old.annual_tax_with_cess, 163051);
    eq('Regime Rules', 'Old regime: monthly TDS 13,588', old.monthly_tds, 13588);

    // Old regime rebate: 45,000 a month -> taxable 4,90,000 <= 5,00,000 -> nil
    const oldRebate = calculateTDS(45000, 0, DEFAULT_SETTINGS, DEFAULT_TAX_SLABS, 'OLD');
    eq('Regime Rules', 'Old regime: nil tax up to 5,00,000', oldRebate.monthly_tds, 0);

    // Surcharge. Taxable 60,00,000: tax 13,80,000; surcharge 10% = 1,38,000; cess 60,720; total 15,78,720.
    const sc = calculateTDS(0, 0, DEFAULT_SETTINGS, DEFAULT_TAX_SLABS, 'NEW', { annualSalary: 6075000 });
    eq('Surcharge', 'Tax + surcharge at 60L is 15,18,000', sc.tax_before_cess, 1518000);
    eq('Surcharge', 'Surcharge at 60L is 1,38,000', sc.surcharge, 138000);
    eq('Surcharge', 'Annual tax at 60L is 15,78,720', sc.annual_tax_with_cess, 1578720);
    // Marginal relief on surcharge. Taxable 51,00,000: tax 11,10,000; tax at 50L 10,80,000;
    // tax + surcharge capped at 10,80,000 + 1,00,000 = 11,80,000 -> surcharge 70,000 (not 1,11,000).
    const scMr = calculateTDS(0, 0, DEFAULT_SETTINGS, DEFAULT_TAX_SLABS, 'NEW', { annualSalary: 5175000 });
    eq('Surcharge', 'Surcharge at 51L limited to 70,000', scMr.surcharge, 70000);

    // Year-to-date basis: a one-off bonus is taxed once, not multiplied by 12.
    // April, 1,50,000 a month + 10,000 bonus: annual = 1,60,000 + 11 * 1,50,000 = 18,10,000.
    // Taxable 17,35,000 -> tax 1,47,000 -> cess 5,880 -> 1,52,880 -> / 12 = 12,740.
    const highEmp: Employee = { ...baseEmp, employee_id: 'T002', monthly_gross_salary: 150000 };
    const apr = calculatePayrollForEmployee(highEmp, '2026-04', 30, 0, 10000, DEFAULT_SETTINGS, DEFAULT_PT_SLABS, DEFAULT_TAX_SLABS, undefined, undefined,
      { ytdGross: 0, ytdTds: 0, ytdMonthsProcessed: 0 });
    eq('YTD TDS', 'April with bonus: annual salary 18,10,000', apr.tds_details.annualized_salary, 1810000);
    eq('YTD TDS', 'April with bonus: TDS 12,740', apr.tds, 12740);
    // May, no bonus: annual still 18,10,000; balance (1,52,880 - 12,740) / 11 = 12,740.
    const may = calculatePayrollForEmployee(highEmp, '2026-05', 31, 0, 0, DEFAULT_SETTINGS, DEFAULT_PT_SLABS, DEFAULT_TAX_SLABS, undefined, undefined,
      { ytdGross: 160000, ytdTds: 12740, ytdMonthsProcessed: 1 });
    eq('YTD TDS', 'May: months remaining 11', may.tds_details.months_remaining, 11);
    eq('YTD TDS', 'May: TDS 12,740 after true-up', may.tds, 12740);
    // Leaver in June: only April-June salary is projected (3 x 1,50,000 = 4,50,000) -> nil tax.
    const leaver: Employee = { ...highEmp, date_of_leaving: '2026-06-30' };
    const lv = calculatePayrollForEmployee(leaver, '2026-04', 30, 0, 0, DEFAULT_SETTINGS, DEFAULT_PT_SLABS, DEFAULT_TAX_SLABS, undefined, undefined,
      { ytdGross: 0, ytdTds: 0, ytdMonthsProcessed: 0 });
    eq('YTD TDS', 'Leaver: annual salary limited to service months', lv.tds_details.annualized_salary, 450000);
    eq('YTD TDS', 'Leaver: TDS nil', lv.tds, 0);

    // Old regime with year-to-date context: employee PF is allowed as a deduction (up to 1,50,000).
    // 1,50,000 a month, PF 1,800 a month -> 21,600 a year. Taxable = 18,00,000 - 50,000 - 21,600 = 17,28,400.
    // Tax = 12,500 + 1,00,000 + 7,28,400 * 30% = 3,31,020. Cess 13,241. Total 3,44,261. Monthly 28,688.
    const oldEmp: Employee = { ...highEmp, employee_id: 'T003', tax_regime: 'OLD' };
    const oldRec = calculatePayrollForEmployee(oldEmp, '2026-04', 30, 0, 0, DEFAULT_SETTINGS, DEFAULT_PT_SLABS, DEFAULT_TAX_SLABS, undefined, undefined,
      { ytdGross: 0, ytdTds: 0, ytdPF: 0, ytdMonthsProcessed: 0 });
    eq('Regime Rules', 'Old regime: employee PF deduction 21,600', oldRec.tds_details.chapter_via, 21600);
    eq('Regime Rules', 'Old regime: taxable 17,28,400 after PF deduction', oldRec.tds_details.taxable_income, 1728400);
    eq('Regime Rules', 'Old regime: annual tax 3,44,261', oldRec.tds_details.annual_tax_with_cess, 344261);
    eq('Regime Rules', 'Old regime: monthly TDS 28,688', oldRec.tds, 28688);
    eq('Regime Rules', 'New regime: no PF deduction', apr.tds_details.chapter_via, 0);
    eq('Regime Rules', 'Slab tax shown even when rebate makes tax nil', calculateTDS(0, 0, DEFAULT_SETTINGS, DEFAULT_TAX_SLABS, 'NEW', { annualSalary: 1275000 }).slab_tax, 60000);

    // Joiners and leavers
    const joiner: Employee = { ...baseEmp, date_of_joining: '2026-04-16' };
    const j = calculatePayrollForEmployee(joiner, '2026-04', 30);
    eq('Joiner / Leaver', 'Joined on 16th: 15 payable days', j.days_payable, 15);
    eq('Joiner / Leaver', 'Joined on 16th: gross 15,000 of 30,000', j.gross_earned, 15000);
    eq('Joiner / Leaver', 'Joined on 16th: no LOP shown', j.lop_days, 0);
    const left: Employee = { ...baseEmp, date_of_leaving: '2026-04-10' };
    eq('Joiner / Leaver', 'Left on 10th: 10 payable days', calculatePayrollForEmployee(left, '2026-04', 30).days_payable, 10);
    eq('Joiner / Leaver', 'Joining next month: not in service', getEmploymentWindow({ date_of_joining: '2026-05-01' }, '2026-04').days, 0);
    eq('Joiner / Leaver', 'Left last month: not in service', getEmploymentWindow({ date_of_joining: '2020-01-01', date_of_leaving: '2026-03-31' }, '2026-04').days, 0);
    eq('Joiner / Leaver', 'Attendance counted only inside service window', calculateAttendanceSummary({ 17: 'LOP' } as any, 30, 16, 30).days_payable, 14);

    // ESIC: coverage continues to the end of the contribution period after crossing the ceiling
    const esicEmp: Employee = { ...baseEmp, monthly_gross_salary: 22000, esic_applicable: true };
    eq('ESIC', 'Above ceiling, not previously covered: nil', calculatePayrollForEmployee(esicEmp, '2026-06', 30).employee_esic, 0);
    const cont = calculatePayrollForEmployee(esicEmp, '2026-06', 30, 0, 0, DEFAULT_SETTINGS, DEFAULT_PT_SLABS, DEFAULT_TAX_SLABS, undefined, undefined, { esicCoveredInPeriod: true });
    eq('ESIC', 'Above ceiling, covered earlier in period: employee 165', cont.employee_esic, 165);
    eq('ESIC', 'Above ceiling, covered earlier in period: employer 715', cont.employer_esic, 715);

    // Professional tax
    eq('Professional Tax', 'KA 20,000 is nil (threshold 25,000)', calculateProfessionalTax('Karnataka', 20000, DEFAULT_PT_SLABS), 0);
    eq('Professional Tax', 'KA 25,000 is 200', calculateProfessionalTax('Karnataka', 25000, DEFAULT_PT_SLABS), 200);
    eq('Professional Tax', 'KA February is 300', calculateProfessionalTax('Karnataka', 30000, DEFAULT_PT_SLABS, '2027-02'), 300);
    eq('Professional Tax', 'MH February is 300', calculateProfessionalTax('Maharashtra', 30000, DEFAULT_PT_SLABS, '2027-02'), 300);
    eq('Professional Tax', 'MH February lower slab stays 175', calculateProfessionalTax('Maharashtra', 9000, DEFAULT_PT_SLABS, '2027-02'), 175);
    eq('Professional Tax', 'WB February unchanged at 200', calculateProfessionalTax('West Bengal', 50000, DEFAULT_PT_SLABS, '2027-02'), 200);

    // PF
    const pfRec = calculatePayrollForEmployee(baseEmp, '2026-04', 30);
    eq('PF', 'EDLI 0.5% of PF wages (15,000) is 75', pfRec.employer_edli, 75);
    eq('PF', 'Admin charges 0.5% of PF wages is 75', pfRec.employer_pf_admin, 75);
    const below = calculatePayrollForEmployee(highEmp, '2026-04', 30, 0, 0, { ...DEFAULT_SETTINGS, pf_applicability_rule: 'BELOW_THRESHOLD' });
    eq('PF', 'BELOW_THRESHOLD rule: no PF when Basic + DA exceeds ceiling', below.employee_pf, 0);
    const belowLow = calculatePayrollForEmployee({ ...baseEmp, monthly_gross_salary: 20000 }, '2026-04', 30, 0, 0, { ...DEFAULT_SETTINGS, pf_applicability_rule: 'BELOW_THRESHOLD' });
    eq('PF', 'BELOW_THRESHOLD rule: PF applies when Basic + DA within ceiling', belowLow.employee_pf, 1200);
  }

  const passedCount = results.filter(r => r.passed).length;
  const failedCount = results.filter(r => !r.passed).length;

  return {
    passed: failedCount === 0,
    total: results.length,
    passedCount,
    failedCount,
    results
  };
}

// If run directly from command line
if (typeof process !== 'undefined' && process.argv && process.argv[1]?.includes('payrollEngine.test')) {
  console.log('Running OneHR Payroll Manager Statutory Engine Tests...');
  const res = runAllTests();
  console.log(`\n======================================================`);
  console.log(`Test Execution Summary: ${res.passedCount}/${res.total} Passed (${res.failedCount} Failed)`);
  console.log(`======================================================`);
  for (const r of res.results) {
    console.log(`${r.passed ? '✓' : '✗'} [${r.suiteName}] ${r.testName}: ${r.message}`);
  }
  if (!res.passed) {
    process.exit(1);
  } else {
    console.log('\nAll statutory payroll calculation tests passed successfully!\n');
  }
}
