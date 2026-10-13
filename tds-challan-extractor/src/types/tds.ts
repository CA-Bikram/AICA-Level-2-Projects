/**
 * Type definitions for TDS Challan Extraction and SAP Reconciliation
 */

export interface TdsChallan {
  id: string;
  challanNumber: string; // e.g. "32094"
  bsrCode: string; // e.g. "6390009"
  dateOfPayment: string; // e.g. "04/12/2025" or "04-Dec-2025"
  tax: number; // e.g. 5136878
  surcharge: number; // e.g. 0
  cess: number; // e.g. 0
  interest: number; // e.g. 0
  penalty: number; // e.g. 0
  fee234E: number; // e.g. 0
  total: number; // e.g. 5136878
  // Additional audit metadata
  tan?: string; // e.g. "MELC05986B"
  companyName?: string; // e.g. "XYZ INDIA PRIVATE LIMITED"
  assessmentYear?: string; // e.g. "2026-27"
  financialYear?: string; // e.g. "2025-26"
  majorHead?: string; // e.g. "Corporation Tax (0020)"
  minorHead?: string; // e.g. "TDS/TCS Payable by Taxpayer (200)"
  natureOfPayment?: string; // e.g. "94C"
  cin?: string; // e.g. "25120400315977ICIC"
  bankName?: string; // e.g. "ICICI Bank"
  bankRefNumber?: string; // e.g. "2054735633"
  sourceFileName?: string;
  extractedAt?: string;
  extractionMethod?: 'ai' | 'regex' | 'manual' | 'sample';
}

export interface SapPaymentRecord {
  id: string;
  documentNumber: string; // SAP Accounting Document No / Ref Key (e.g., "1900045210")
  challanNumber: string; // Challan No in SAP
  bsrCode: string; // BSR code in SAP
  paymentDate: string; // SAP posting or clearing date
  taxAmount: number; // TDS tax amount in SAP
  surcharge: number;
  cess: number;
  interest: number;
  penalty: number;
  totalAmount: number; // Total paid in SAP
  vendorCode?: string;
  vendorName?: string;
  sectionCode?: string; // e.g. "194C", "194J"
  glAccount?: string;
  clearingDoc?: string;
  companyCode?: string;
}

export type ReconciliationStatus =
  | 'MATCHED'
  | 'AMOUNT_GAP'
  | 'BREAKUP_GAP'
  | 'MISSING_IN_CHALLAN'
  | 'MISSING_IN_SAP';

export interface ReconciliationItem {
  id: string;
  challanNumber: string;
  bsrCode: string;
  status: ReconciliationStatus;
  
  // Challan details (if available)
  challan?: TdsChallan;
  challanDate?: string;
  challanTax?: number;
  challanTotal?: number;
  
  // SAP details (if available)
  sapRecord?: SapPaymentRecord;
  sapDocumentNo?: string;
  sapDate?: string;
  sapTax?: number;
  sapTotal?: number;
  
  // Financial Gaps
  gapAmount: number; // challanTotal - sapTotal (positive: challan > sap, negative: sap > challan)
  gapPercentage: number;
  taxGap: number;
  
  // Audit Remarks
  remarks: string;
  actionRequired: string;
}

export interface ReconciliationSummaryStats {
  totalChallansCount: number;
  totalChallanAmount: number;
  totalSapRecordsCount: number;
  totalSapAmount: number;
  matchedCount: number;
  matchedAmount: number;
  amountGapCount: number;
  breakupGapCount: number;
  missingInChallanCount: number;
  missingInChallanAmount: number;
  missingInSapCount: number;
  missingInSapAmount: number;
  netGapAmount: number; // totalChallanAmount - totalSapAmount
  matchPercentage: number;
}

export interface SelectedFolderInfo {
  name: string;
  handle?: any; // FileSystemDirectoryHandle
  pathDescription: string;
  isWritable: boolean;
}
