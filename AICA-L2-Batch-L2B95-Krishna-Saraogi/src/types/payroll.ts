/**
 * OneHR Payroll Manager - Data Types & Interfaces
 */

export type SalaryStructureType = 'SIMPLE' | 'DETAILED';

export type EmploymentStatus = 'ACTIVE' | 'INACTIVE' | 'ON_LEAVE' | 'TERMINATED';

export type TaxRegime = 'NEW' | 'OLD';

export type AttendanceCode =
  | 'P'   // Present (1.0)
  | 'A'   // Absent (0.0)
  | 'HD'  // Half Day (0.5)
  | 'WO'  // Weekly Off (1.0)
  | 'PH'  // Public Holiday (1.0)
  | 'CL'  // Casual Leave (1.0)
  | 'SL'  // Sick Leave (1.0)
  | 'EL'  // Earned Leave (1.0)
  | 'LOP' // Loss of Pay (0.0)
  | 'OD'; // On Duty (1.0)

export type PayrollRunStatus =
  | 'DRAFT'
  | 'VALIDATION_PENDING'
  | 'READY'
  | 'PROCESSED'
  | 'REVIEWED'
  | 'LOCKED';

export interface Company {
  id: string;
  name: string;
  legal_name: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  pan: string;
  gstin: string;
  tan: string;
  pf_code: string;
  esic_code: string;
  email: string;
  phone: string;
  logo_url?: string;
}

export interface Employee {
  id: string;
  employee_id: string;
  name: string;
  pan: string;
  date_of_joining: string;
  date_of_leaving?: string;
  department: string;
  designation: string;
  location: string;
  employment_status: EmploymentStatus;
  bank_name: string;
  account_number: string;
  ifsc: string;
  uan: string;
  esic_number: string;
  monthly_gross_salary: number;
  salary_structure_type: SalaryStructureType;
  // Detailed components (if DETAILED)
  basic?: number;
  da?: number;
  hra?: number;
  conveyance?: number;
  medical?: number;
  special_allowance?: number;
  // Statutory applicability
  pf_applicable: boolean;
  esic_applicable: boolean;
  professional_tax_applicable: boolean;
  income_tax_applicable: boolean;
  tax_regime: TaxRegime;
  state: string;
  created_at?: string;
  updated_at?: string;
}

export interface AttendanceRecord {
  id?: string;
  employee_id: string;
  payroll_month: string; // YYYY-MM e.g. "2025-04"
  days_map: Record<number, AttendanceCode>; // day 1..31 -> code
  overtime_amount: number;
  bonus_amount: number;
  remarks?: string;
  // Calculated summary
  present_days: number;
  half_days: number;
  paid_leaves: number;
  weekly_offs: number;
  public_holidays: number;
  lop_days: number;
  days_payable: number;
}

export interface TDSSlab {
  id?: string;
  tax_year: string;
  regime: TaxRegime;
  from_amount: number;
  to_amount: number; // 0 or Infinity for highest bracket
  rate_percentage: number;
}

export interface PTSlab {
  id?: string;
  state: string;
  salary_from: number;
  salary_to: number;
  monthly_pt: number;
  effective_from: string;
  effective_to: string;
}

export interface PayrollSettings {
  id?: string;
  // Salary split defaults (Simple)
  simple_basic_pct: number;       // default 45
  simple_da_pct: number;          // default 5
  simple_hra_pct: number;         // default 20
  simple_special_pct: number;     // default 30
  // PF
  pf_employee_pct: number;        // default 12
  pf_employer_pct: number;        // default 12
  pf_wage_ceiling: number;        // default 15000
  pf_eps_pct: number;             // default 8.33
  pf_eps_ceiling: number;         // default 1250
  pf_applicability_rule: 'ALL' | 'BELOW_THRESHOLD'; // default ALL
  // ESIC
  esic_enabled: boolean;          // default true
  esic_employee_pct: number;      // default 0.75
  esic_employer_pct: number;      // default 3.25
  esic_salary_ceiling: number;    // default 21000
  // Gratuity
  gratuity_days: number;          // default 15
  gratuity_divisor: number;       // default 26
  // Income Tax Defaults
  tax_year: string;               // default "Tax Year 2026-27"
  standard_deduction: number;     // default 75000
  nil_tax_threshold: number;      // default 1200000
  cess_pct: number;               // default 4
  // 50% Wage Rule
  wage_rule_50_pct_enabled: boolean; // default true
  // Optional overrides (engine defaults: 0.5% each)
  pf_edli_pct?: number;
  pf_admin_pct?: number;
}

export interface SalaryBreakdown {
  basic: number;
  da: number;
  hra: number;
  conveyance: number;
  medical: number;
  special_allowance: number;
  gross: number;
}

export interface TDSCalculationDetail {
  monthly_taxable_salary: number;
  annualized_salary: number;
  standard_deduction: number;
  annual_pt: number;
  taxable_income: number;
  nil_tax_threshold: number;
  is_below_threshold: boolean;
  slab_breakdown: Array<{
    slab_label: string;
    rate_percentage: number;
    taxable_in_slab: number;
    tax_amount: number;
  }>;
  tax_before_cess: number;
  cess_amount: number;
  annual_tax_with_cess: number;
  monthly_tds: number;
  // Added with the year-to-date TDS basis (absent on records processed before the upgrade)
  regime?: TaxRegime;
  slab_tax?: number;            // tax on taxable income before rebate / relief
  rebate?: number;              // rebate or marginal relief given
  chapter_via?: number;         // deduction allowed for employee PF (old regime)
  annual_employee_pf?: number;  // employee PF estimated for the year
  marginal_relief?: number;
  surcharge?: number;
  ytd_gross?: number;
  ytd_tds?: number;
  projected_future_salary?: number;
  months_remaining?: number;
  balance_tax?: number;
  basis?: 'YTD_PROJECTION' | 'MONTH_X_12';
}

export interface PayrollRecord {
  id?: string;
  employee_id: string;
  employee_name: string;
  department: string;
  designation: string;
  pan: string;
  bank_name: string;
  account_number: string;
  ifsc: string;
  uan: string;
  esic_number: string;
  payroll_month: string; // YYYY-MM
  // Days
  calendar_days: number;
  days_payable: number;
  present_days: number;
  lop_days: number;
  // Fixed vs Earned Earnings
  fixed_basic: number;
  fixed_da: number;
  fixed_hra: number;
  fixed_conveyance: number;
  fixed_medical: number;
  fixed_special: number;
  fixed_gross: number;

  earned_basic: number;
  earned_da: number;
  earned_hra: number;
  earned_conveyance: number;
  earned_medical: number;
  earned_special: number;
  overtime_amount: number;
  bonus_amount: number;
  gross_earned: number;

  // Wage rule adjustment
  wage_rule_excess: number;
  wage_rule_applied: boolean;
  eligible_pf_wages: number;
  eligible_esic_wages: number;

  // Deductions
  employee_pf: number;
  employee_esic: number;
  professional_tax: number;
  tds: number;
  total_deductions: number;

  // Take Home
  take_home_pay: number;

  // Employer Contributions
  employer_pf: number;
  employer_eps: number;
  employer_epf: number;
  employer_edli?: number;      // EDLI contribution (A/c 21)
  employer_pf_admin?: number;  // EPF administrative charges (A/c 2)
  employer_esic: number;
  gratuity: number;
  company_cost: number; // gross_earned + employer_pf + EDLI + PF admin + employer_esic + gratuity

  // TDS details for full explanation modal
  tds_details: TDSCalculationDetail;
  created_at?: string;
}

export interface PayrollRun {
  id?: string;
  payroll_month: string; // YYYY-MM
  status: PayrollRunStatus;
  calendar_days: number;
  working_days: number;
  total_employees: number;
  processed_employees: number;
  total_gross_payroll: number;
  total_deductions: number;
  total_take_home: number;
  total_employer_pf: number;
  total_employer_esic: number;
  total_gratuity: number;
  total_tds: number;
  total_company_cost: number;
  locked_at?: string;
  locked_by?: string;
  created_at?: string;
  updated_at?: string;
}
