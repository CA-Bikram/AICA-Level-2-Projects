/**
 * OneHR Payroll Manager - Excel reports (payroll register workbook and bank transfer advice)
 *
 * Built with ExcelJS so the files open formatted: titled, bordered, frozen headers,
 * Indian digit grouping, live SUM totals and print-ready page setup.
 */

import ExcelJS from 'exceljs';
import { Company, PayrollRecord, PayrollRun } from '../types/payroll';
import { formatPayrollMonth } from './indianNumber';

const FONT = 'Arial';
const NAVY = 'FF1F2937';
const LIGHT = 'FFF1F5F9';
const TOTAL_FILL = 'FFE2E8F0';
const BORDER_COLOR = 'FFCBD5E1';
// Indian digit grouping (12,34,56,789) with zero shown as a dash
const INR = '[>=10000000]##\\,##\\,##\\,##0;[>=100000]##\\,##\\,##0;##,##0;-';
const DAYS = '0.0;-0.0;-';

type ColType = 'text' | 'money' | 'days' | 'int';
interface Col {
  header: string;
  width: number;
  type?: ColType;
  total?: boolean; // add a SUM in the totals row
}

const thin = { style: 'thin' as const, color: { argb: BORDER_COLOR } };
const BORDER = { top: thin, left: thin, bottom: thin, right: thin };

function colLetter(n: number): string {
  let s = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/**
 * Writes a titled table: company name, report title, optional note, header row, data rows
 * and (when any column asks for it) a totals row of SUM formulas.
 */
function writeTable(
  ws: ExcelJS.Worksheet,
  companyName: string,
  title: string,
  note: string,
  cols: Col[],
  rows: Array<Array<string | number | null>>,
  opts: { freezeCols?: number; landscape?: boolean } = {}
) {
  const lastCol = colLetter(cols.length);

  ws.mergeCells(`A1:${lastCol}1`);
  ws.getCell('A1').value = companyName;
  ws.getCell('A1').font = { name: FONT, size: 14, bold: true };
  ws.mergeCells(`A2:${lastCol}2`);
  ws.getCell('A2').value = title;
  ws.getCell('A2').font = { name: FONT, size: 11, bold: true, color: { argb: 'FF065F46' } };
  ws.mergeCells(`A3:${lastCol}3`);
  ws.getCell('A3').value = note;
  ws.getCell('A3').font = { name: FONT, size: 9, italic: true, color: { argb: 'FF64748B' } };

  const headerRowNo = 5;
  const header = ws.getRow(headerRowNo);
  cols.forEach((c, i) => {
    const cell = header.getCell(i + 1);
    cell.value = c.header;
    cell.font = { name: FONT, size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
    cell.alignment = { horizontal: c.type && c.type !== 'text' ? 'right' : 'left', vertical: 'middle', wrapText: true };
    cell.border = BORDER;
    ws.getColumn(i + 1).width = c.width;
  });
  header.height = 32;

  const firstData = headerRowNo + 1;
  rows.forEach((r, ri) => {
    const row = ws.getRow(firstData + ri);
    cols.forEach((c, i) => {
      const cell = row.getCell(i + 1);
      const v = r[i];
      cell.value = v === undefined ? null : v;
      cell.font = { name: FONT, size: 10 };
      cell.border = BORDER;
      if (c.type === 'money') {
        cell.numFmt = INR;
        cell.alignment = { horizontal: 'right', indent: 1 };
      } else if (c.type === 'days') {
        cell.numFmt = DAYS;
        cell.alignment = { horizontal: 'right', indent: 1 };
      } else if (c.type === 'int') {
        cell.numFmt = '0';
        cell.alignment = { horizontal: 'right', indent: 1 };
      } else {
        cell.numFmt = '@'; // keep IDs, PAN and account numbers as text (no lost leading zeros)
        cell.alignment = { horizontal: 'left', indent: 1 };
      }
      if (ri % 2 === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      }
    });
  });

  const lastData = firstData + rows.length - 1;
  if (cols.some(c => c.total) && rows.length > 0) {
    const totalRow = ws.getRow(lastData + 1);
    cols.forEach((c, i) => {
      const cell = totalRow.getCell(i + 1);
      const L = colLetter(i + 1);
      if (i === 0) {
        cell.value = 'TOTAL';
      } else if (i === 1) {
        cell.value = `${rows.length} employees`;
      } else if (c.total) {
        const result = rows.reduce((a, r) => a + (Number(r[i]) || 0), 0);
        cell.value = { formula: `SUM(${L}${firstData}:${L}${lastData})`, result };
        cell.numFmt = c.type === 'days' ? DAYS : INR;
        cell.alignment = { horizontal: 'right', indent: 1 };
      }
      cell.font = { name: FONT, size: 10, bold: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TOTAL_FILL } };
      cell.border = { ...BORDER, top: { style: 'medium', color: { argb: NAVY } } };
    });
  }

  ws.views = [{ state: 'frozen', xSplit: opts.freezeCols ?? 2, ySplit: headerRowNo, showGridLines: false }];
  ws.autoFilter = { from: { row: headerRowNo, column: 1 }, to: { row: headerRowNo, column: cols.length } };
  ws.pageSetup = {
    orientation: opts.landscape === false ? 'portrait' : 'landscape',
    paperSize: 9, // A4
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    printTitlesRow: `${headerRowNo}:${headerRowNo}`,
    margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 }
  };
  ws.headerFooter.oddFooter = '&L&8OneHR Payroll Manager&R&8Page &P of &N';
}

async function download(wb: ExcelJS.Workbook, fileName: string) {
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

const generatedNote = () => `Generated on ${new Date().toLocaleDateString('en-IN')} | Amounts in Indian rupees`;

/**
 * Payroll workbook: register, statutory deductions, summary and attendance
 */
export async function exportPayrollWorkbook(
  month: string,
  records: PayrollRecord[],
  run: PayrollRun | null,
  company: Company | null,
  attendanceList?: any[]
) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'OneHR Payroll Manager';
  wb.created = new Date();
  const companyName = company?.legal_name || company?.name || 'Company name not set';
  const monthLabel = formatPayrollMonth(month);
  const charges = (r: PayrollRecord) => (r.employer_edli || 0) + (r.employer_pf_admin || 0);

  // 1. Payroll register
  writeTable(
    wb.addWorksheet('Payroll Register'),
    companyName,
    `Payroll Register - ${monthLabel}`,
    `${generatedNote()} | Status: ${run?.status || 'PROCESSED'}`,
    [
      { header: 'Emp ID', width: 10 },
      { header: 'Employee Name', width: 22 },
      { header: 'Department', width: 14 },
      { header: 'Designation', width: 22 },
      { header: 'PAN', width: 13 },
      { header: 'UAN', width: 15 },
      { header: 'Calendar Days', width: 10, type: 'days' },
      { header: 'Payable Days', width: 10, type: 'days' },
      { header: 'Fixed Gross', width: 13, type: 'money', total: true },
      { header: 'Basic', width: 12, type: 'money', total: true },
      { header: 'DA', width: 11, type: 'money', total: true },
      { header: 'HRA', width: 12, type: 'money', total: true },
      { header: 'Conveyance', width: 12, type: 'money', total: true },
      { header: 'Medical', width: 11, type: 'money', total: true },
      { header: 'Special Allowance', width: 13, type: 'money', total: true },
      { header: 'Overtime', width: 11, type: 'money', total: true },
      { header: 'Bonus', width: 12, type: 'money', total: true },
      { header: 'Gross Earned', width: 14, type: 'money', total: true },
      { header: 'Employee PF', width: 12, type: 'money', total: true },
      { header: 'Employee ESIC', width: 12, type: 'money', total: true },
      { header: 'Professional Tax', width: 12, type: 'money', total: true },
      { header: 'TDS', width: 12, type: 'money', total: true },
      { header: 'Total Deductions', width: 13, type: 'money', total: true },
      { header: 'Net Pay', width: 14, type: 'money', total: true },
      { header: 'Employer PF', width: 12, type: 'money', total: true },
      { header: 'of which EPS', width: 11, type: 'money', total: true },
      { header: 'EDLI + PF Admin', width: 12, type: 'money', total: true },
      { header: 'Employer ESIC', width: 12, type: 'money', total: true },
      { header: 'Gratuity Provision', width: 12, type: 'money', total: true },
      { header: 'Company Cost', width: 14, type: 'money', total: true }
    ],
    records.map(r => [
      r.employee_id, r.employee_name, r.department, r.designation, r.pan || '', r.uan || '',
      r.calendar_days, r.days_payable, r.fixed_gross,
      r.earned_basic, r.earned_da, r.earned_hra, r.earned_conveyance, r.earned_medical, r.earned_special,
      r.overtime_amount, r.bonus_amount, r.gross_earned,
      r.employee_pf, r.employee_esic, r.professional_tax, r.tds, r.total_deductions, r.take_home_pay,
      r.employer_pf, r.employer_eps, charges(r), r.employer_esic, r.gratuity, r.company_cost
    ])
  );

  // 2. Statutory deductions
  writeTable(
    wb.addWorksheet('Statutory Deductions'),
    companyName,
    `Statutory Deductions - ${monthLabel}`,
    generatedNote(),
    [
      { header: 'Emp ID', width: 10 },
      { header: 'Employee Name', width: 24 },
      { header: 'PAN', width: 13 },
      { header: 'UAN', width: 15 },
      { header: 'ESIC Number', width: 16 },
      { header: 'Gross Earned', width: 14, type: 'money', total: true },
      { header: 'PF Wages', width: 13, type: 'money', total: true },
      { header: 'Employee PF', width: 13, type: 'money', total: true },
      { header: 'Employer PF', width: 13, type: 'money', total: true },
      { header: 'ESIC Wages', width: 13, type: 'money', total: true },
      { header: 'Employee ESIC', width: 13, type: 'money', total: true },
      { header: 'Employer ESIC', width: 13, type: 'money', total: true },
      { header: 'Professional Tax', width: 13, type: 'money', total: true },
      { header: 'TDS', width: 13, type: 'money', total: true }
    ],
    records.map(r => [
      r.employee_id, r.employee_name, r.pan || '', r.uan || '', r.esic_number || '',
      r.gross_earned, r.eligible_pf_wages, r.employee_pf, r.employer_pf,
      r.eligible_esic_wages, r.employee_esic, r.employer_esic, r.professional_tax, r.tds
    ])
  );

  // 3. Summary (totals link to the register so the workbook stays consistent)
  const ws = wb.addWorksheet('Payroll Summary');
  const n = records.length;
  const first = 6;
  const last = first + n - 1;
  const reg = (col: string, value: number) =>
    n > 0 ? { formula: `SUM('Payroll Register'!${col}${first}:${col}${last})`, result: value } : 0;
  const sum = (f: (r: PayrollRecord) => number) => records.reduce((a, r) => a + (f(r) || 0), 0);

  ws.mergeCells('A1:C1');
  ws.getCell('A1').value = companyName;
  ws.getCell('A1').font = { name: FONT, size: 14, bold: true };
  ws.mergeCells('A2:C2');
  ws.getCell('A2').value = `Payroll Summary - ${monthLabel}`;
  ws.getCell('A2').font = { name: FONT, size: 11, bold: true, color: { argb: 'FF065F46' } };
  ws.mergeCells('A3:C3');
  ws.getCell('A3').value = generatedNote();
  ws.getCell('A3').font = { name: FONT, size: 9, italic: true, color: { argb: 'FF64748B' } };

  const lines: Array<[string, any, string, boolean?]> = [
    ['Payroll month', monthLabel, ''],
    ['Run status', run?.status || 'PROCESSED', run?.locked_by ? `Locked by ${run.locked_by}` : ''],
    ['Employees paid', n, ''],
    ['Gross earned', reg('R', sum(r => r.gross_earned)), 'Earned fixed pay + overtime + bonus', true],
    ['Employee PF', reg('S', sum(r => r.employee_pf)), 'Payable to EPFO'],
    ['Employee ESIC', reg('T', sum(r => r.employee_esic)), 'Payable to ESIC'],
    ['Professional tax', reg('U', sum(r => r.professional_tax)), 'Payable to the State'],
    ['TDS', reg('V', sum(r => r.tds)), 'Payable to the Income-tax Department'],
    ['Total deductions', reg('W', sum(r => r.total_deductions)), '', true],
    ['Net pay', reg('X', sum(r => r.take_home_pay)), 'Bank transfer to employees', true],
    ['Employer PF', reg('Y', sum(r => r.employer_pf)), 'Includes EPS share'],
    ['EDLI + PF admin charges', reg('AA', sum(charges)), '0.5% + 0.5% of PF wages'],
    ['Employer ESIC', reg('AB', sum(r => r.employer_esic)), ''],
    ['Gratuity provision', reg('AC', sum(r => r.gratuity)), 'Accrual, not a payment'],
    ['Company cost', reg('AD', sum(r => r.company_cost)), 'Gross + employer contributions + gratuity', true]
  ];
  ['Item', 'Amount', 'Note'].forEach((h, i) => {
    const c = ws.getCell(5, i + 1);
    c.value = h;
    c.font = { name: FONT, size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
    c.alignment = { horizontal: i === 1 ? 'right' : 'left', vertical: 'middle' };
    c.border = BORDER;
  });
  lines.forEach(([label, value, note, bold], i) => {
    const row = ws.getRow(6 + i);
    [label, value, note].forEach((v, ci) => {
      const c = row.getCell(ci + 1);
      c.value = v;
      c.font = { name: FONT, size: 10, bold: Boolean(bold) && ci < 2 };
      c.border = BORDER;
      if (bold) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT } };
      if (ci === 1) {
        c.alignment = { horizontal: 'right' };
        if (typeof v !== 'string') c.numFmt = i === 2 ? '0' : INR;
      }
    });
  });
  ws.getColumn(1).width = 30;
  ws.getColumn(2).width = 20;
  ws.getColumn(3).width = 46;
  ws.views = [{ showGridLines: false }];
  ws.pageSetup = { orientation: 'portrait', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 };

  // 4. Attendance
  const attendance = (attendanceList || []).filter(a => a.has_record !== false);
  if (attendance.length > 0) {
    writeTable(
      wb.addWorksheet('Attendance Summary'),
      companyName,
      `Attendance Summary - ${monthLabel}`,
      generatedNote(),
      [
        { header: 'Emp ID', width: 10 },
        { header: 'Employee Name', width: 24 },
        { header: 'Department', width: 16 },
        { header: 'Present / On Duty', width: 11, type: 'days', total: true },
        { header: 'Half Days', width: 10, type: 'days', total: true },
        { header: 'Paid Leave', width: 10, type: 'days', total: true },
        { header: 'Weekly Offs', width: 10, type: 'days', total: true },
        { header: 'Public Holidays', width: 10, type: 'days', total: true },
        { header: 'LOP / Absent', width: 10, type: 'days', total: true },
        { header: 'Days Payable', width: 10, type: 'days', total: true },
        { header: 'Overtime', width: 12, type: 'money', total: true },
        { header: 'Bonus', width: 12, type: 'money', total: true },
        { header: 'Remarks', width: 36 }
      ],
      attendance.map(a => [
        a.employee_id, a.employee_name, a.department,
        a.present_days, a.half_days, a.paid_leaves, a.weekly_offs, a.public_holidays, a.lop_days,
        a.days_payable, a.overtime_amount, a.bonus_amount, a.remarks || ''
      ])
    );
  }

  await download(wb, `Payroll_Register_${month}.xlsx`);
}

/**
 * Bank transfer advice for net salary
 */
export async function exportBankAdviceExcel(month: string, records: PayrollRecord[], company: Company | null) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'OneHR Payroll Manager';
  const companyName = company?.legal_name || company?.name || 'Company name not set';

  writeTable(
    wb.addWorksheet('Bank Advice'),
    companyName,
    `Bank Transfer Advice - Salary for ${formatPayrollMonth(month)}`,
    `${generatedNote()} | Please credit the accounts below by NEFT / bank transfer`,
    [
      { header: 'Sl No', width: 7, type: 'int' },
      { header: 'Employee ID', width: 12 },
      { header: 'Beneficiary Name', width: 28 },
      { header: 'Bank Name', width: 22 },
      { header: 'Account Number', width: 20 },
      { header: 'IFSC Code', width: 14 },
      { header: 'Amount (INR)', width: 16, type: 'money', total: true },
      { header: 'Payment Reference', width: 24 }
    ],
    records
      .filter(r => r.take_home_pay > 0)
      .map((r, i) => [
        i + 1, r.employee_id, r.employee_name, r.bank_name, r.account_number, r.ifsc,
        r.take_home_pay, `SALARY-${month}-${r.employee_id}`
      ]),
    { freezeCols: 0, landscape: false }
  );

  // Totals row label sits in the name column for the bank advice
  const ws = wb.getWorksheet('Bank Advice')!;
  const totalRowNo = ws.rowCount;
  ws.getCell(totalRowNo, 1).value = null;
  ws.getCell(totalRowNo, 2).value = 'TOTAL';
  ws.getCell(totalRowNo, 3).value = `${records.filter(r => r.take_home_pay > 0).length} beneficiaries`;

  const sig = totalRowNo + 4;
  ws.getCell(sig, 2).value = 'Prepared by';
  ws.getCell(sig, 5).value = 'Checked by';
  ws.getCell(sig, 7).value = 'Authorised signatory';
  [2, 5, 7].forEach(c => {
    ws.getCell(sig, c).font = { name: FONT, size: 10, bold: true };
    ws.getCell(sig, c).border = { top: thin };
  });

  await download(wb, `Bank_Transfer_Advice_${month}.xlsx`);
}
