import {
  TdsChallan,
  SapPaymentRecord,
  ReconciliationItem,
  ReconciliationSummaryStats,
} from '../types/tds';

/**
 * Normalize challan string (removes leading zeroes, whitespace)
 */
function normalizeKey(str: string | undefined): string {
  if (!str) return '';
  return str.trim().toLowerCase().replace(/^0+/, '');
}

/**
 * Run reconciliation between extracted TDS Challans and SAP Payment records.
 * Prioritizes:
 * 1. Exact Challan Number + Amount Match
 * 2. Exact Amount Match (even if challan number differs or is not yet entered in SAP)
 * 3. Challan Number Match with Amount Gap (variance)
 * 4. Close Amount / Rounding Match (within ₹1 tolerance)
 * Any records matching in amounts are merged into a SINGLE line item with status 'MATCHED' (Reconciled).
 */
export function performReconciliation(
  challans: TdsChallan[],
  sapRecords: SapPaymentRecord[]
): {
  items: ReconciliationItem[];
  stats: ReconciliationSummaryStats;
} {
  const items: ReconciliationItem[] = [];
  const usedSapIds = new Set<string>();
  const usedChallanIds = new Set<string>();

  // -------------------------------------------------------------
  // Pass 1: Exact Challan Number AND Exact Amount Match (± ₹1)
  // -------------------------------------------------------------
  for (const ch of challans) {
    if (usedChallanIds.has(ch.id)) continue;
    const chNo = normalizeKey(ch.challanNumber);
    const bsr = normalizeKey(ch.bsrCode);
    const chTotal = ch.total || ch.tax || 0;

    if (!chNo || chNo === '0' || chNo === '00000') continue;

    const matchedSap = sapRecords.find((s) => {
      if (usedSapIds.has(s.id)) return false;
      const sChNo = normalizeKey(s.challanNumber);
      const sBsr = normalizeKey(s.bsrCode);
      const sTotal = s.totalAmount || s.taxAmount || 0;
      const challanMatches = sChNo === chNo && (sBsr === bsr || !sBsr || !bsr);
      const amountMatches = Math.abs(chTotal - sTotal) <= 1.0;
      return challanMatches && amountMatches;
    });

    if (matchedSap) {
      usedSapIds.add(matchedSap.id);
      usedChallanIds.add(ch.id);

      const challanTotal = ch.total || ch.tax || 0;
      const sapTotal = matchedSap.totalAmount || matchedSap.taxAmount || 0;
      const gap = Math.round((challanTotal - sapTotal) * 100) / 100;
      const taxGap = Math.round(((ch.tax || 0) - (matchedSap.taxAmount || 0)) * 100) / 100;

      items.push({
        id: `recon-exact-${ch.id}-${matchedSap.id}`,
        challanNumber: ch.challanNumber,
        bsrCode: ch.bsrCode || matchedSap.bsrCode,
        status: 'MATCHED',
        challan: ch,
        challanDate: ch.dateOfPayment,
        challanTax: ch.tax,
        challanTotal,
        sapRecord: matchedSap,
        sapDocumentNo: matchedSap.documentNumber,
        sapDate: matchedSap.paymentDate,
        sapTax: matchedSap.taxAmount,
        sapTotal,
        gapAmount: Math.abs(gap) <= 1.0 ? 0 : gap,
        gapPercentage: 0,
        taxGap: Math.abs(taxGap) <= 1.0 ? 0 : taxGap,
        remarks: `Reconciled: Challan No (${ch.challanNumber}) & Amount (₹${challanTotal.toLocaleString('en-IN')}) match SAP ERP booking.`,
        actionRequired: 'Reconciled. Verified for Form 26Q / 24Q filing.',
      });
    }
  }

  // -------------------------------------------------------------
  // Pass 2: Exact AMOUNT Match (Even if Challan No in SAP is blank/different)
  // When amounts match, merge into a SINGLE line item and show as Reconciled.
  // -------------------------------------------------------------
  for (const ch of challans) {
    if (usedChallanIds.has(ch.id)) continue;
    const chTotal = ch.total || ch.tax || 0;
    if (chTotal <= 0) continue;

    // Look for SAP record with matching totalAmount or taxAmount
    let matchedSap = sapRecords.find((s) => {
      if (usedSapIds.has(s.id)) return false;
      const sTotal = s.totalAmount || s.taxAmount || 0;
      const sTax = s.taxAmount || s.totalAmount || 0;
      return (
        Math.abs(chTotal - sTotal) <= 1.0 ||
        Math.abs((ch.tax || 0) - sTax) <= 1.0 ||
        Math.abs(chTotal - sTax) <= 1.0
      );
    });

    if (matchedSap) {
      usedSapIds.add(matchedSap.id);
      usedChallanIds.add(ch.id);

      const challanTotal = ch.total || ch.tax || 0;
      const sapTotal = matchedSap.totalAmount || matchedSap.taxAmount || 0;
      const gap = Math.round((challanTotal - sapTotal) * 100) / 100;
      const taxGap = Math.round(((ch.tax || 0) - (matchedSap.taxAmount || 0)) * 100) / 100;

      const hasDiffChallanNo =
        matchedSap.challanNumber &&
        matchedSap.challanNumber !== 'UNSPECIFIED' &&
        normalizeKey(matchedSap.challanNumber) !== normalizeKey(ch.challanNumber);

      const remarks = hasDiffChallanNo
        ? `Reconciled by Amount: Exact match of ₹${challanTotal.toLocaleString('en-IN')}. SAP Ref/Doc: ${matchedSap.documentNumber} (Challan in SAP: ${matchedSap.challanNumber}).`
        : `Reconciled by Amount: Exact match of ₹${challanTotal.toLocaleString('en-IN')} with SAP payment doc ${matchedSap.documentNumber}.`;

      items.push({
        id: `recon-amt-match-${ch.id}-${matchedSap.id}`,
        challanNumber: ch.challanNumber || matchedSap.challanNumber,
        bsrCode: ch.bsrCode || matchedSap.bsrCode,
        status: 'MATCHED',
        challan: ch,
        challanDate: ch.dateOfPayment,
        challanTax: ch.tax,
        challanTotal,
        sapRecord: matchedSap,
        sapDocumentNo: matchedSap.documentNumber,
        sapDate: matchedSap.paymentDate,
        sapTax: matchedSap.taxAmount,
        sapTotal,
        gapAmount: Math.abs(gap) <= 1.0 ? 0 : gap,
        gapPercentage: 0,
        taxGap: Math.abs(taxGap) <= 1.0 ? 0 : taxGap,
        remarks,
        actionRequired: 'Reconciled. Verified for statutory tax audit.',
      });
    }
  }

  // -------------------------------------------------------------
  // Pass 3: Challan Number Match with Amount Gap (Variance)
  // -------------------------------------------------------------
  for (const ch of challans) {
    if (usedChallanIds.has(ch.id)) continue;
    const chNo = normalizeKey(ch.challanNumber);
    if (!chNo || chNo === '0' || chNo === '00000') continue;

    const matchedSap = sapRecords.find((s) => {
      if (usedSapIds.has(s.id)) return false;
      const sChNo = normalizeKey(s.challanNumber);
      return sChNo === chNo;
    });

    if (matchedSap) {
      usedSapIds.add(matchedSap.id);
      usedChallanIds.add(ch.id);

      const challanTotal = ch.total || ch.tax || 0;
      const sapTotal = matchedSap.totalAmount || matchedSap.taxAmount || 0;
      const gap = Math.round((challanTotal - sapTotal) * 100) / 100;
      const taxGap = Math.round(((ch.tax || 0) - (matchedSap.taxAmount || 0)) * 100) / 100;

      let status: ReconciliationItem['status'] = 'AMOUNT_GAP';
      let remarks = '';
      let actionRequired = '';

      if (Math.abs(gap) <= 1.0) {
        status = 'MATCHED';
        remarks = 'Reconciled: Challan and SAP records match to the rupee.';
        actionRequired = 'Reconciled and verified.';
      } else {
        if (gap > 0) {
          remarks = `Excess Challan deposit of ₹${Math.abs(gap).toLocaleString('en-IN')} over SAP booking.`;
          actionRequired = 'Investigate excess deposit or post additional TDS liability adjustment in SAP.';
        } else {
          remarks = `Shortfall in Challan deposit of ₹${Math.abs(gap).toLocaleString('en-IN')} compared to SAP.`;
          actionRequired = 'Critical: Generate supplementary challan to avoid 201(1A) interest & notice.';
        }
      }

      items.push({
        id: `recon-gap-${ch.id}-${matchedSap.id}`,
        challanNumber: ch.challanNumber,
        bsrCode: ch.bsrCode || matchedSap.bsrCode,
        status,
        challan: ch,
        challanDate: ch.dateOfPayment,
        challanTax: ch.tax,
        challanTotal,
        sapRecord: matchedSap,
        sapDocumentNo: matchedSap.documentNumber,
        sapDate: matchedSap.paymentDate,
        sapTax: matchedSap.taxAmount,
        sapTotal,
        gapAmount: gap,
        gapPercentage: sapTotal > 0 ? (gap / sapTotal) * 100 : 0,
        taxGap,
        remarks,
        actionRequired,
      });
    }
  }

  // -------------------------------------------------------------
  // Pass 4: Fallback Single-Record Pair Check
  // If exactly 1 remaining challan and 1 remaining SAP record, match them
  // -------------------------------------------------------------
  const remainingChallans = challans.filter((c) => !usedChallanIds.has(c.id));
  const remainingSaps = sapRecords.filter((s) => !usedSapIds.has(s.id));

  if (remainingChallans.length === 1 && remainingSaps.length === 1) {
    const ch = remainingChallans[0];
    const s = remainingSaps[0];
    const challanTotal = ch.total || ch.tax || 0;
    const sapTotal = s.totalAmount || s.taxAmount || 0;
    const gap = Math.round((challanTotal - sapTotal) * 100) / 100;
    const isAmountMatch = Math.abs(gap) <= 1.0;

    usedChallanIds.add(ch.id);
    usedSapIds.add(s.id);

    items.push({
      id: `recon-pair-${ch.id}-${s.id}`,
      challanNumber: ch.challanNumber || s.challanNumber,
      bsrCode: ch.bsrCode || s.bsrCode,
      status: isAmountMatch ? 'MATCHED' : 'AMOUNT_GAP',
      challan: ch,
      challanDate: ch.dateOfPayment,
      challanTax: ch.tax,
      challanTotal,
      sapRecord: s,
      sapDocumentNo: s.documentNumber,
      sapDate: s.paymentDate,
      sapTax: s.taxAmount,
      sapTotal,
      gapAmount: isAmountMatch ? 0 : gap,
      gapPercentage: sapTotal > 0 ? (gap / sapTotal) * 100 : 0,
      taxGap: Math.round(((ch.tax || 0) - (s.taxAmount || 0)) * 100) / 100,
      remarks: isAmountMatch
        ? `Reconciled: Matched payment of ₹${challanTotal.toLocaleString('en-IN')} with SAP voucher ${s.documentNumber}.`
        : `Amount variance of ₹${Math.abs(gap).toLocaleString('en-IN')} between Challan and SAP.`,
      actionRequired: isAmountMatch
        ? 'Reconciled. Verified for statutory compliance.'
        : 'Investigate difference between booked amount and Challan receipt.',
    });
  }

  // -------------------------------------------------------------
  // Pass 5: Truly Unmatched Challans (Missing in SAP)
  // -------------------------------------------------------------
  for (const ch of challans) {
    if (!usedChallanIds.has(ch.id)) {
      items.push({
        id: `recon-unmatched-ch-${ch.id}`,
        challanNumber: ch.challanNumber,
        bsrCode: ch.bsrCode,
        status: 'MISSING_IN_SAP',
        challan: ch,
        challanDate: ch.dateOfPayment,
        challanTax: ch.tax,
        challanTotal: ch.total,
        gapAmount: ch.total,
        gapPercentage: 100,
        taxGap: ch.tax,
        remarks: 'Challan receipt exists, but no corresponding payment entry found in SAP ERP.',
        actionRequired: 'Post accounting voucher in SAP (T-code FB01/FB60/J1INCHLN) to clear TDS liability.',
      });
    }
  }

  // -------------------------------------------------------------
  // Pass 6: Truly Unmatched SAP Payments (Missing in Challan)
  // -------------------------------------------------------------
  for (const sap of sapRecords) {
    if (!usedSapIds.has(sap.id)) {
      items.push({
        id: `recon-unmatched-sap-${sap.id}`,
        challanNumber: sap.challanNumber || 'NOT DEPOSITED',
        bsrCode: sap.bsrCode || '-',
        status: 'MISSING_IN_CHALLAN',
        sapRecord: sap,
        sapDocumentNo: sap.documentNumber,
        sapDate: sap.paymentDate,
        sapTax: sap.taxAmount,
        sapTotal: sap.totalAmount,
        gapAmount: -sap.totalAmount,
        gapPercentage: -100,
        taxGap: -sap.taxAmount,
        remarks: `Payment of ₹${sap.totalAmount.toLocaleString('en-IN')} booked in SAP, but no ITNS 281 Challan receipt uploaded.`,
        actionRequired: 'Urgent: Verify whether payment was debited from bank or deposit pending with Tax Department.',
      });
    }
  }

  // Sort: prioritize gaps and missing records first, then matched/reconciled
  const priorityOrder: Record<ReconciliationItem['status'], number> = {
    MISSING_IN_CHALLAN: 1,
    AMOUNT_GAP: 2,
    BREAKUP_GAP: 3,
    MISSING_IN_SAP: 4,
    MATCHED: 5,
  };

  items.sort((a, b) => priorityOrder[a.status] - priorityOrder[b.status]);

  // Compute Summary Statistics
  const totalChallanAmount = challans.reduce((sum, c) => sum + (c.total || 0), 0);
  const totalSapAmount = sapRecords.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
  const matchedItems = items.filter((i) => i.status === 'MATCHED');
  const amountGapItems = items.filter((i) => i.status === 'AMOUNT_GAP');
  const breakupGapItems = items.filter((i) => i.status === 'BREAKUP_GAP');
  const missingInChallanItems = items.filter((i) => i.status === 'MISSING_IN_CHALLAN');
  const missingInSapItems = items.filter((i) => i.status === 'MISSING_IN_SAP');

  const stats: ReconciliationSummaryStats = {
    totalChallansCount: challans.length,
    totalChallanAmount,
    totalSapRecordsCount: sapRecords.length,
    totalSapAmount,
    matchedCount: matchedItems.length,
    matchedAmount: matchedItems.reduce((sum, i) => sum + (i.challanTotal || i.sapTotal || 0), 0),
    amountGapCount: amountGapItems.length,
    breakupGapCount: breakupGapItems.length,
    missingInChallanCount: missingInChallanItems.length,
    missingInChallanAmount: missingInChallanItems.reduce((sum, i) => sum + (i.sapTotal || 0), 0),
    missingInSapCount: missingInSapItems.length,
    missingInSapAmount: missingInSapItems.reduce((sum, i) => sum + (i.challanTotal || 0), 0),
    netGapAmount: totalChallanAmount - totalSapAmount,
    matchPercentage: items.length > 0 ? (matchedItems.length / items.length) * 100 : 0,
  };

  return { items, stats };
}
