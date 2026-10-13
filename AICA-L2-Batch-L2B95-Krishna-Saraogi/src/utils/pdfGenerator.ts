/**
 * OneHR Payroll Manager - Local PDF Salary Slip Generator
 * Generates high-fidelity payslip PDFs locally using jsPDF
 */

import { jsPDF } from 'jspdf';
import { Company, Employee, PayrollRecord } from '../types/payroll';
import {
  formatIndianCurrency,
  formatIndianDate,
  formatPayrollMonth,
  numberToIndianWords
} from './indianNumber';
import { TaxWorksheet } from '../services/api';
import { buildWorksheetLines, worksheetPeriod } from './taxWorksheet';

export function generateSalarySlipPDF(
  record: PayrollRecord,
  company: Company | null,
  employeeMaster?: Employee | null,
  worksheet?: TaxWorksheet | null
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = 210;
  const margin = 14;
  const contentWidth = pageWidth - (margin * 2);
  let y = 14;

  // The PDF's built-in fonts have no rupee sign (it prints as stray, mis-spaced characters),
  // so every amount on the payslip is a plain Indian-grouped number and headings say "Rs."
  const amt = (n: number) => Math.round(n || 0).toLocaleString('en-IN');
  const fit = (text: string, maxWidth: number): string => {
    let t = text || '';
    while (t.length > 3 && doc.getTextWidth(t) > maxWidth) t = t.slice(0, -1);
    return t.length < (text || '').length ? `${t.slice(0, -1)}...` : t;
  };

  // Company header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  const companyLines = doc.splitTextToSize(company?.legal_name || 'DEMO INDUSTRIES PRIVATE LIMITED', contentWidth - 12);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  const addrText = [company?.address, company?.city, company?.state].filter(Boolean).join(', ') + (company?.pincode ? ` - ${company.pincode}` : '');
  const addrLines = doc.splitTextToSize(addrText, contentWidth - 12);
  const statutoryParts = [
    company?.pan ? `PAN: ${company.pan}` : '',
    company?.tan ? `TAN: ${company.tan}` : '',
    company?.pf_code ? `PF: ${company.pf_code}` : '',
    company?.esic_code ? `ESIC: ${company.esic_code}` : ''
  ].filter(Boolean).join('   |   ');
  const statLines = doc.splitTextToSize(statutoryParts, contentWidth - 12);
  const headerH = 8 + companyLines.length * 6 + addrLines.length * 4.2 + statLines.length * 4.2 + 2;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, y, contentWidth, headerH, 2, 2, 'FD');

  let hy = y + 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text(companyLines, margin + 6, hy);
  hy += companyLines.length * 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(addrLines, margin + 6, hy);
  hy += addrLines.length * 4.2;
  doc.text(statLines, margin + 6, hy);
  y += headerH + 4;

  // Title banner
  doc.setFillColor(15, 23, 42);
  doc.roundedRect(margin, y, contentWidth, 8, 1, 1, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text(`PAYSLIP FOR THE MONTH OF ${formatPayrollMonth(record.payroll_month).toUpperCase()}`, pageWidth / 2, y + 5.5, { align: 'center' });
  y += 12;

  // Employee details: two columns, values trimmed to the column width
  const halfW = (contentWidth / 2) - 2;
  const labelW = 30;
  const fields: Array<[string, string, string, string]> = [
    ['Employee Name', record.employee_name, 'Employee ID', record.employee_id],
    ['Designation', record.designation, 'Department', record.department],
    ['PAN', record.pan || 'N/A', 'Date of Joining', formatIndianDate(employeeMaster?.date_of_joining)],
    ['Bank Name', record.bank_name, 'Account Number', record.account_number],
    ['UAN', record.uan || 'N/A', 'ESIC Number', record.esic_number || 'N/A'],
    ['Tax Regime', record.tds_details?.regime === 'OLD' ? 'Old' : 'New', 'Location', employeeMaster?.location || '-']
  ];
  const infoH = fields.length * 5.6 + 4;
  doc.setDrawColor(226, 232, 240);
  doc.rect(margin, y, contentWidth, infoH);
  doc.setFontSize(8.5);
  fields.forEach((f, i) => {
    const fy = y + 6 + i * 5.6;
    [[f[0], f[1], margin + 4], [f[2], f[3], margin + halfW + 8]].forEach(([label, value, x]) => {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 116, 139);
      doc.text(String(label), Number(x), fy);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(15, 23, 42);
      doc.text(`: ${fit(String(value || '-'), halfW - labelW - 8)}`, Number(x) + labelW, fy);
    });
  });
  y += infoH + 3;

  // Attendance strip: four equal cells
  doc.setFillColor(241, 245, 249);
  doc.rect(margin, y, contentWidth, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);
  const strip = [
    `Calendar Days: ${record.calendar_days}`,
    `Payable Days: ${record.days_payable}`,
    `Present Days: ${record.present_days}`,
    `Loss of Pay Days: ${record.lop_days}`
  ];
  strip.forEach((t, i) => doc.text(t, margin + 4 + i * (contentWidth / 4), y + 5.4));
  y += 12;

  // Earnings and deductions
  const dedX = margin + halfW + 4;
  const rateX = margin + halfW - 30;
  const rowH = 5.6;

  doc.setFillColor(15, 23, 42);
  doc.rect(margin, y, halfW, 7, 'F');
  doc.rect(dedX, y, halfW, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  doc.text('EARNINGS', margin + 3, y + 4.8);
  doc.text('RATE (Rs.)', rateX, y + 4.8, { align: 'right' });
  doc.text('EARNED (Rs.)', margin + halfW - 3, y + 4.8, { align: 'right' });
  doc.text('DEDUCTIONS', dedX + 3, y + 4.8);
  doc.text('AMOUNT (Rs.)', dedX + halfW - 3, y + 4.8, { align: 'right' });
  y += 7;

  const earnings = [
    { label: 'Basic Salary', rate: record.fixed_basic, val: record.earned_basic, always: true },
    { label: 'Dearness Allowance', rate: record.fixed_da, val: record.earned_da },
    { label: 'House Rent Allowance', rate: record.fixed_hra, val: record.earned_hra },
    { label: 'Conveyance Allowance', rate: record.fixed_conveyance, val: record.earned_conveyance },
    { label: 'Medical Allowance', rate: record.fixed_medical, val: record.earned_medical },
    { label: 'Special Allowance', rate: record.fixed_special, val: record.earned_special },
    { label: 'Overtime', rate: 0, val: record.overtime_amount },
    { label: 'Incentive / Bonus', rate: 0, val: record.bonus_amount }
  ].filter(e => e.always || e.val > 0 || e.rate > 0);

  const deductions = [
    { label: 'Provident Fund', val: record.employee_pf },
    { label: 'Employee State Insurance', val: record.employee_esic },
    { label: 'Professional Tax', val: record.professional_tax },
    { label: 'Income Tax (TDS)', val: record.tds }
  ];

  const bodyRows = Math.max(earnings.length, deductions.length);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);
  doc.setDrawColor(226, 232, 240);
  for (let i = 0; i < bodyRows; i++) {
    const ry = y + 4 + i * rowH;
    const e = earnings[i];
    const d = deductions[i];
    if (e) {
      doc.text(e.label, margin + 3, ry);
      doc.text(e.rate > 0 ? amt(e.rate) : '-', rateX, ry, { align: 'right' });
      doc.text(amt(e.val), margin + halfW - 3, ry, { align: 'right' });
    }
    if (d) {
      doc.text(d.label, dedX + 3, ry);
      doc.text(amt(d.val), dedX + halfW - 3, ry, { align: 'right' });
    }
    doc.line(margin, ry + 1.6, margin + halfW, ry + 1.6);
    doc.line(dedX, ry + 1.6, dedX + halfW, ry + 1.6);
  }
  y += bodyRows * rowH + 2;

  doc.setFillColor(241, 245, 249);
  doc.rect(margin, y, halfW, 7, 'F');
  doc.rect(dedX, y, halfW, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('Gross Earnings', margin + 3, y + 4.8);
  doc.text(amt(record.fixed_gross), rateX, y + 4.8, { align: 'right' });
  doc.text(amt(record.gross_earned), margin + halfW - 3, y + 4.8, { align: 'right' });
  doc.text('Total Deductions', dedX + 3, y + 4.8);
  doc.text(amt(record.total_deductions), dedX + halfW - 3, y + 4.8, { align: 'right' });
  y += 11;

  // Net pay
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8.5);
  const wordLines = doc.splitTextToSize(numberToIndianWords(record.take_home_pay), contentWidth - 60);
  const netH = 10 + wordLines.length * 4;
  doc.setFillColor(236, 253, 245);
  doc.setDrawColor(16, 185, 129);
  doc.roundedRect(margin, y, contentWidth, netH, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(6, 95, 70);
  doc.text('NET PAY', margin + 5, y + 6.5);
  doc.setFontSize(13);
  doc.text(`Rs. ${amt(record.take_home_pay)}`, margin + contentWidth - 5, y + 7.5, { align: 'right' });
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8.5);
  doc.setTextColor(4, 120, 87);
  doc.text(wordLines, margin + 5, y + 11.5);
  y += netH + 4;

  // Employer contributions: label / value grid, no free-running text
  const pfCharges = (record.employer_edli || 0) + (record.employer_pf_admin || 0);
  const contrib: Array<[string, string]> = [
    ['Employer PF', amt(record.employer_pf)],
    ['of which EPS', amt(record.employer_eps)],
    ['EDLI + PF admin', amt(pfCharges)],
    ['Employer ESIC', amt(record.employer_esic)],
    ['Gratuity provision', amt(record.gratuity)],
    ['Company cost', amt(record.company_cost)]
  ];
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.rect(margin, y, contentWidth, 22, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text('EMPLOYER CONTRIBUTIONS AND PROVISIONS (Rs.)', margin + 4, y + 5);
  const cellW = contentWidth / 3;
  contrib.forEach(([label, value], i) => {
    const cx = margin + 4 + (i % 3) * cellW;
    const cyy = y + 11 + Math.floor(i / 3) * 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text(label, cx, cyy);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(value, cx + cellW - 10, cyy, { align: 'right' });
  });
  y += 28;

  // Footer
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text('This is a system generated payslip from OneHR Payroll Manager and does not require a physical signature.', margin, y);
  doc.text(`Generated on: ${new Date().toLocaleString('en-IN')}${worksheet ? '   |   Income tax worksheet on the next page' : ''}`, margin, y + 4);

  // Page 2: Income tax worksheet
  if (worksheet) {
    const num = amt;
    doc.addPage();
    let wy = 16;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text(company?.legal_name || 'DEMO INDUSTRIES PRIVATE LIMITED', margin, wy);
    wy += 6;
    doc.setFontSize(9.5);
    doc.text(`Income Tax Worksheet for the Period ${worksheetPeriod(worksheet)}`, margin, wy);
    wy += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text(`${record.employee_name} (${record.employee_id})  |  Pay month: ${formatPayrollMonth(record.payroll_month)}  |  ${worksheet.details.regime === 'OLD' ? 'Old Regime' : 'New Regime'}`, margin, wy);
    wy += 6;

    const colGross = margin + 110;
    const colExempt = margin + 145;
    const colRight = margin + contentWidth - 2;
    const rowH = 5.2;

    const headerRow = (cells: Array<[string, number, 'left' | 'right']>) => {
      doc.setFillColor(241, 245, 249);
      doc.rect(margin, wy, contentWidth, rowH + 1, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(51, 65, 85);
      cells.forEach(([t, x, al]) => doc.text(t, x, wy + 4.2, { align: al }));
      wy += rowH + 1;
    };
    const bodyRow = (cells: Array<[string, number, 'left' | 'right']>, bold = false) => {
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.setFontSize(8);
      doc.setTextColor(30, 41, 59);
      cells.forEach(([t, x, al]) => doc.text(t, x, wy + 3.8, { align: al }));
      doc.setDrawColor(226, 232, 240);
      doc.line(margin, wy + rowH, margin + contentWidth, wy + rowH);
      wy += rowH;
    };

    headerRow([['Description', margin + 2, 'left'], ['Gross', colGross, 'right'], ['Exempt', colExempt, 'right'], ['Taxable', colRight, 'right']]);
    worksheet.components.forEach(c =>
      bodyRow([[c.label, margin + 2, 'left'], [num(c.gross), colGross, 'right'], [num(c.exempt), colExempt, 'right'], [num(c.taxable), colRight, 'right']])
    );
    bodyRow([['Gross Salary', margin + 2, 'left'], [num(worksheet.gross_salary), colGross, 'right'], ['0', colExempt, 'right'], [num(worksheet.gross_salary), colRight, 'right']], true);
    wy += 4;

    headerRow([['Tax Computation', margin + 2, 'left'], ['Amount', colRight, 'right']]);
    buildWorksheetLines(worksheet, record.tds).forEach(l =>
      bodyRow([[`${l.sign === '-' ? 'Less: ' : ''}${l.label}`, margin + 2, 'left'], [l.amount === null ? (l.text || '') : num(l.amount), colRight, 'right']], Boolean(l.bold))
    );
    wy += 4;

    headerRow([['Employee Provident Fund', margin + 2, 'left'], ['Amount', colRight, 'right']]);
    bodyRow([['Contribution estimated for the year', margin + 2, 'left'], [num(worksheet.details.annual_employee_pf ?? 0), colRight, 'right']]);
    bodyRow([[`Deduction allowed ${worksheet.details.regime === 'OLD' ? '(limit 1,50,000)' : '(nil in new regime)'}`, margin + 2, 'left'], [num(worksheet.details.chapter_via ?? 0), colRight, 'right']]);
    wy += 4;

    headerRow([['Tax Deducted During the Year', margin + 2, 'left']]);
    const perRow = 6;
    const cellW = contentWidth / perRow;
    const items = [...worksheet.monthly_tds.map(m => [formatPayrollMonth(m.month), num(m.tds)]), ['Total', num(worksheet.monthly_tds.reduce((a, m) => a + m.tds, 0))]];
    items.forEach((it, i) => {
      const cx = margin + (i % perRow) * cellW + 2;
      const cy = wy + Math.floor(i / perRow) * 10;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(it[0], cx, cy + 4);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      doc.text(it[1], cx, cy + 8.5);
    });
    wy += Math.ceil(items.length / perRow) * 10 + 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text('Annual salary = actual salary for months processed so far plus fixed salary projected for the remaining months. Amounts in rupees.', margin, wy);
  }

  // Save PDF
  doc.save(`Payslip_${record.employee_id}_${record.payroll_month}.pdf`);
}
