/**
 * OneHR Payroll Manager - Income tax worksheet lines for the payslip (screen and PDF)
 */

import { TaxWorksheet } from '../services/api';

export interface WorksheetLine {
  label: string;
  amount: number | null; // null = text-only value
  text?: string;
  sign?: '-' | '';
  bold?: boolean;
}

export function buildWorksheetLines(sheet: TaxWorksheet, tdsThisMonth: number): WorksheetLine[] {
  const d = sheet.details;
  const isOld = d.regime === 'OLD';
  const months = d.months_remaining ?? 12;

  return [
    { label: 'Gross Salary', amount: sheet.gross_salary, bold: true },
    { label: isOld ? 'Professional Tax' : 'Professional Tax (not deductible in new regime)', amount: d.annual_pt ?? 0, sign: '-' },
    { label: 'Standard Deduction', amount: d.standard_deduction ?? 0, sign: '-' },
    { label: isOld ? 'Deduction for Employee Provident Fund' : 'Deduction for Employee PF (not available in new regime)', amount: d.chapter_via ?? 0, sign: '-' },
    { label: 'Taxable Income', amount: d.taxable_income, bold: true },
    { label: 'Tax on Taxable Income', amount: d.slab_tax ?? 0 },
    { label: 'Tax Rebate / Marginal Relief', amount: d.rebate ?? 0, sign: '-' },
    { label: 'Surcharge', amount: d.surcharge ?? 0 },
    { label: 'Health & Education Cess', amount: d.cess_amount ?? 0 },
    { label: 'Net Tax for the Year', amount: d.annual_tax_with_cess, bold: true },
    { label: 'Tax Deducted Till Date', amount: d.ytd_tds ?? sheet.tax_deducted_till_date, sign: '-' },
    { label: 'Tax to be Deducted', amount: d.balance_tax ?? 0 },
    { label: 'Months Remaining (including this month)', amount: null, text: String(months) },
    { label: 'Tax Deduction for this Month', amount: tdsThisMonth, bold: true }
  ];
}

export function worksheetPeriod(sheet: TaxWorksheet): string {
  const fmt = (iso: string) => {
    const [y, m, dd] = iso.split('-');
    const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${dd}-${names[parseInt(m, 10) - 1]}-${y}`;
  };
  return `${fmt(sheet.period_from)} to ${fmt(sheet.period_to)}`;
}
