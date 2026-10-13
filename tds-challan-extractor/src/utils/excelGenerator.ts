import * as XLSX from 'xlsx';
import { TdsChallan, SapPaymentRecord, ReconciliationItem, ReconciliationSummaryStats } from '../types/tds';

/**
 * Format currency in Indian numbering format (e.g. ₹ 51,36,878)
 */
export function formatINR(val: number | undefined | null): string {
  if (val === undefined || val === null || isNaN(val)) return '₹0';
  return '₹' + Number(val).toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

/**
 * Generate Excel workbook for TDS Challan Summary in the EXACT format requested:
 * Columns: Challan number | BSR | Date of payment | Tax | Surcharge | Cess | Interest | Penalty | Total
 */
export function generateChallanSummaryWorkbook(challans: TdsChallan[]): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  // 1. Exact Summary Sheet as per user requirement image
  const headers = [
    'Challan number',
    'BSR',
    'Date of payment',
    'Tax',
    'Surcharge',
    'Cess',
    'Interest',
    'Penalty',
    'Total',
  ];

  const rows = challans.map((ch) => [
    ch.challanNumber || '',
    ch.bsrCode || '',
    ch.dateOfPayment || '',
    ch.tax ?? 0,
    ch.surcharge ?? 0,
    ch.cess ?? 0,
    ch.interest ?? 0,
    ch.penalty ?? 0,
    ch.total ?? 0,
  ]);

  // Append Total Row at the bottom
  const totalTax = challans.reduce((sum, c) => sum + (c.tax || 0), 0);
  const totalSurcharge = challans.reduce((sum, c) => sum + (c.surcharge || 0), 0);
  const totalCess = challans.reduce((sum, c) => sum + (c.cess || 0), 0);
  const totalInterest = challans.reduce((sum, c) => sum + (c.interest || 0), 0);
  const totalPenalty = challans.reduce((sum, c) => sum + (c.penalty || 0), 0);
  const grandTotal = challans.reduce((sum, c) => sum + (c.total || 0), 0);

  rows.push([
    'TOTAL',
    '',
    '',
    totalTax,
    totalSurcharge,
    totalCess,
    totalInterest,
    totalPenalty,
    grandTotal,
  ]);

  const summarySheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);

  // Set column widths
  summarySheet['!cols'] = [
    { wch: 16 }, // Challan number
    { wch: 14 }, // BSR
    { wch: 18 }, // Date of payment
    { wch: 16 }, // Tax
    { wch: 14 }, // Surcharge
    { wch: 12 }, // Cess
    { wch: 14 }, // Interest
    { wch: 14 }, // Penalty
    { wch: 18 }, // Total
  ];

  XLSX.utils.book_append_sheet(wb, summarySheet, 'TDS Challan Summary');

  // 2. Extended Audit Details Sheet (TAN, Deductor, CIN, Bank Ref)
  const auditHeaders = [
    'Challan No',
    'BSR Code',
    'Payment Date',
    'Total (₹)',
    'TAN',
    'Deductor Name',
    'AY',
    'FY',
    'Section / Nature',
    'Major Head',
    'Minor Head',
    'CIN',
    'Bank Name',
    'Bank Ref No',
    'Source File',
  ];

  const auditRows = challans.map((ch) => [
    ch.challanNumber || '',
    ch.bsrCode || '',
    ch.dateOfPayment || '',
    ch.total || 0,
    ch.tan || '',
    ch.companyName || '',
    ch.assessmentYear || '',
    ch.financialYear || '',
    ch.natureOfPayment || '',
    ch.majorHead || '',
    ch.minorHead || '',
    ch.cin || '',
    ch.bankName || '',
    ch.bankRefNumber || '',
    ch.sourceFileName || '',
  ]);

  const auditSheet = XLSX.utils.aoa_to_sheet([auditHeaders, ...auditRows]);
  auditSheet['!cols'] = [
    { wch: 14 },
    { wch: 12 },
    { wch: 14 },
    { wch: 16 },
    { wch: 14 },
    { wch: 28 },
    { wch: 10 },
    { wch: 10 },
    { wch: 16 },
    { wch: 22 },
    { wch: 28 },
    { wch: 24 },
    { wch: 18 },
    { wch: 16 },
    { wch: 24 },
  ];

  XLSX.utils.book_append_sheet(wb, auditSheet, 'Deductor & Bank Details');

  return wb;
}

/**
 * Generate comprehensive Reconciliation Excel Workbook
 */
export function generateReconciliationWorkbook(
  items: ReconciliationItem[],
  stats: ReconciliationSummaryStats,
  challans: TdsChallan[],
  sapRecords: SapPaymentRecord[]
): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Executive KPI Summary
  const summaryAoa = [
    ['TDS CHALLAN & SAP PAYMENT RECONCILIATION REPORT'],
    ['Generated Date:', new Date().toLocaleString('en-IN')],
    ['Assessment Status:', 'Statutory Tax Compliance Audit'],
    [],
    ['METRIC', 'VALUE', 'DESCRIPTION'],
    ['Total TDS Challan Records', stats.totalChallansCount, 'Challans deposited via ITNS 281'],
    ['Total Challan Deposited (₹)', stats.totalChallanAmount, 'Actual tax amount credited to government'],
    ['Total SAP Payment Records', stats.totalSapRecordsCount, 'Payment lines booked in SAP ERP'],
    ['Total SAP Booked (₹)', stats.totalSapAmount, 'Tax payable booked in SAP accounts'],
    ['Net Gap / Discrepancy (₹)', stats.netGapAmount, 'Challan Total minus SAP Total'],
    ['Match Rate (%)', `${stats.matchPercentage.toFixed(1)}%`, 'Percentage of records cleanly reconciled'],
    [],
    ['BREAKDOWN BY STATUS', 'COUNT', 'REMARKS'],
    ['1. Reconciled', stats.matchedCount, 'Challan and SAP records match to the rupee'],
    ['2. Amount Discrepancy (Gap)', stats.amountGapCount, 'Variance between SAP entry and Challan receipt'],
    ['3. Component / Breakup Gap', stats.breakupGapCount, 'Tax, Surcharge, or Cess component mismatch'],
    ['4. Missing in Challan (CRITICAL)', stats.missingInChallanCount, 'Paid in SAP but receipt missing or uncredited'],
    ['5. Missing in SAP', stats.missingInSapCount, 'Challan deposited but not booked in SAP ERP'],
  ];

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryAoa);
  summarySheet['!cols'] = [{ wch: 32 }, { wch: 22 }, { wch: 45 }];
  XLSX.utils.book_append_sheet(wb, summarySheet, 'Executive Summary');

  // Sheet 2: Detailed Reconciliation
  const reconHeaders = [
    'Status',
    'Challan No',
    'BSR Code',
    'Challan Total (₹)',
    'SAP Total (₹)',
    'Variance / Gap (₹)',
    'Challan Date',
    'SAP Date',
    'Challan Tax (₹)',
    'SAP Tax (₹)',
    'SAP Doc No',
    'Vendor / Remarks',
    'Action Required',
  ];

  const reconRows = items.map((item) => [
    item.status === 'MATCHED' ? 'RECONCILED' : item.status,
    item.challanNumber || '',
    item.bsrCode || '',
    item.challanTotal ?? '',
    item.sapTotal ?? '',
    item.gapAmount,
    item.challanDate || '',
    item.sapDate || '',
    item.challanTax ?? '',
    item.sapTax ?? '',
    item.sapDocumentNo || '',
    item.remarks || '',
    item.actionRequired || '',
  ]);

  const reconSheet = XLSX.utils.aoa_to_sheet([reconHeaders, ...reconRows]);
  reconSheet['!cols'] = [
    { wch: 20 }, // Status
    { wch: 14 }, // Challan No
    { wch: 12 }, // BSR Code
    { wch: 18 }, // Challan Total
    { wch: 18 }, // SAP Total
    { wch: 18 }, // Gap
    { wch: 14 }, // Challan Date
    { wch: 14 }, // SAP Date
    { wch: 16 }, // Challan Tax
    { wch: 16 }, // SAP Tax
    { wch: 16 }, // SAP Doc No
    { wch: 30 }, // Remarks
    { wch: 35 }, // Action Required
  ];
  XLSX.utils.book_append_sheet(wb, reconSheet, 'Reconciliation Gaps');

  // Sheet 3: Challan Summary (User exact format)
  const challanHeaders = [
    'Challan number',
    'BSR',
    'Date of payment',
    'Tax',
    'Surcharge',
    'Cess',
    'Interest',
    'Penalty',
    'Total',
  ];
  const challanRows = challans.map((ch) => [
    ch.challanNumber || '',
    ch.bsrCode || '',
    ch.dateOfPayment || '',
    ch.tax ?? 0,
    ch.surcharge ?? 0,
    ch.cess ?? 0,
    ch.interest ?? 0,
    ch.penalty ?? 0,
    ch.total ?? 0,
  ]);
  const challanSheet = XLSX.utils.aoa_to_sheet([challanHeaders, ...challanRows]);
  challanSheet['!cols'] = [
    { wch: 16 },
    { wch: 14 },
    { wch: 18 },
    { wch: 16 },
    { wch: 14 },
    { wch: 12 },
    { wch: 14 },
    { wch: 14 },
    { wch: 18 },
  ];
  XLSX.utils.book_append_sheet(wb, challanSheet, 'TDS Challan Records');

  // Sheet 4: SAP Records
  const sapHeaders = [
    'SAP Document No',
    'Challan No',
    'BSR Code',
    'Posting Date',
    'Total Amount (₹)',
    'Tax Amount (₹)',
    'Surcharge (₹)',
    'Cess (₹)',
    'Interest (₹)',
    'Vendor / Payee',
    'Section Code',
    'Clearing Doc',
  ];
  const sapRows = sapRecords.map((r) => [
    r.documentNumber || '',
    r.challanNumber || '',
    r.bsrCode || '',
    r.paymentDate || '',
    r.totalAmount || 0,
    r.taxAmount || 0,
    r.surcharge || 0,
    r.cess || 0,
    r.interest || 0,
    r.vendorName || r.vendorCode || '',
    r.sectionCode || '',
    r.clearingDoc || '',
  ]);
  const sapSheet = XLSX.utils.aoa_to_sheet([sapHeaders, ...sapRows]);
  sapSheet['!cols'] = [
    { wch: 18 },
    { wch: 14 },
    { wch: 12 },
    { wch: 14 },
    { wch: 18 },
    { wch: 16 },
    { wch: 14 },
    { wch: 12 },
    { wch: 12 },
    { wch: 25 },
    { wch: 14 },
    { wch: 16 },
  ];
  XLSX.utils.book_append_sheet(wb, sapSheet, 'SAP Payment Records');

  return wb;
}

/**
 * Save Excel workbook to a chosen directory handle OR trigger browser download
 */
export async function saveWorkbookToFile(
  wb: XLSX.WorkBook,
  fileName: string,
  directoryHandle?: any
): Promise<{ success: boolean; savedToDirectory: boolean; message: string }> {
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  // Try direct write to selected directory handle if available
  if (directoryHandle && typeof directoryHandle.getFileHandle === 'function') {
    try {
      const fileHandle = await directoryHandle.getFileHandle(fileName, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(blob);
      await writable.close();
      return {
        success: true,
        savedToDirectory: true,
        message: `File "${fileName}" saved directly to folder "${directoryHandle.name}".`,
      };
    } catch (err: any) {
      console.warn('Direct directory write failed, falling back to download:', err);
    }
  }

  // Fallback to standard browser download
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    return {
      success: true,
      savedToDirectory: false,
      message: `File "${fileName}" downloaded to your browser's designated folder.`,
    };
  } catch (err: any) {
    return {
      success: false,
      savedToDirectory: false,
      message: `Failed to save file: ${err.message}`,
    };
  }
}

/**
 * Parse uploaded SAP Excel/CSV file into normalized SAP payment records
 */
export async function parseSapExcelFile(file: File): Promise<SapPaymentRecord[]> {
  const arrayBuffer = await file.arrayBuffer();
  const wb = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
  const firstSheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[firstSheetName];
  const rawRows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  if (!rawRows || rawRows.length === 0) {
    throw new Error('Uploaded SAP file contains no data rows.');
  }

  const normalizedRecords: SapPaymentRecord[] = [];

  rawRows.forEach((row, index) => {
    // Helper to find column matching any alias
    const getVal = (aliases: string[]): any => {
      for (const key of Object.keys(row)) {
        const cleanedKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
        for (const alias of aliases) {
          const cleanedAlias = alias.toLowerCase().replace(/[^a-z0-9]/g, '');
          if (cleanedKey === cleanedAlias || cleanedKey.includes(cleanedAlias)) {
            return row[key];
          }
        }
      }
      return undefined;
    };

    const cleanNum = (v: any) => {
      if (typeof v === 'number') return v;
      if (!v) return 0;
      const parsed = parseFloat(String(v).replace(/[^0-9.-]/g, ''));
      return isNaN(parsed) ? 0 : parsed;
    };

    const challanNo = String(
      getVal(['challan no', 'challan number', 'challan', 'itns no', 'reference', 'assignment', 'zuonr', 'ref']) || ''
    ).trim();

    const bsrCode = String(
      getVal(['bsr code', 'bsr', 'branch code', 'bank key', 'bank_key', 'bsr_code']) || ''
    ).trim();

    let paymentDate = getVal(['payment date', 'posting date', 'clearing date', 'date', 'budat', 'bldat']);
    if (paymentDate instanceof Date) {
      paymentDate = paymentDate.toLocaleDateString('en-GB');
    } else {
      paymentDate = String(paymentDate || '').trim();
    }

    const docNo = String(
      getVal(['document number', 'accounting doc', 'doc no', 'document', 'belnr', 'voucher']) ||
        `SAP-${1900000000 + index}`
    ).trim();

    const taxAmount = cleanNum(getVal(['tax', 'tax amount', 'tds amount', 'tds', 'wht amount', 'wt_qsshh']));
    const surcharge = cleanNum(getVal(['surcharge', 'sc']));
    const cess = cleanNum(getVal(['cess', 'education cess', 'he cess']));
    const interest = cleanNum(getVal(['interest', 'int']));
    const penalty = cleanNum(getVal(['penalty']));
    let totalAmount = cleanNum(getVal(['total amount', 'total', 'amount', 'paid amount', 'dmbtr', 'wrbtr']));

    // If total wasn't provided or is 0, compute from tax
    if (!totalAmount && taxAmount) {
      totalAmount = taxAmount + surcharge + cess + interest + penalty;
    }

    const vendorName = String(getVal(['vendor name', 'vendor', 'name', 'payee', 'lifnr']) || '').trim();
    const sectionCode = String(getVal(['section', 'nature', 'tax code', 'wt_withcd', 'section code']) || '').trim();

    // Only add if there is at least a challan number or an amount
    if (challanNo || totalAmount > 0 || docNo) {
      normalizedRecords.push({
        id: `sap-row-${index + 1}-${Date.now()}`,
        documentNumber: docNo,
        challanNumber: challanNo || 'UNSPECIFIED',
        bsrCode: bsrCode || 'UNSPECIFIED',
        paymentDate: paymentDate || new Date().toLocaleDateString('en-GB'),
        taxAmount: taxAmount || totalAmount,
        surcharge,
        cess,
        interest,
        penalty,
        totalAmount: totalAmount || taxAmount,
        vendorName: vendorName || 'Tax Deductee / Vendor',
        sectionCode: sectionCode || 'TDS',
        clearingDoc: String(getVal(['clearing doc', 'augbl']) || ''),
      });
    }
  });

  return normalizedRecords;
}
