import React, { useState } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  HelpCircle,
  Download,
  Folder,
  FileSpreadsheet,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  ShieldAlert,
  Search,
  Check,
  XCircle,
} from 'lucide-react';
import {
  TdsChallan,
  SapPaymentRecord,
  ReconciliationItem,
  ReconciliationStatus,
  SelectedFolderInfo,
} from '../types/tds';
import { performReconciliation } from '../utils/reconciliationEngine';
import {
  generateReconciliationWorkbook,
  saveWorkbookToFile,
  formatINR,
} from '../utils/excelGenerator';

interface Props {
  challans: TdsChallan[];
  sapRecords: SapPaymentRecord[];
  selectedFolder: SelectedFolderInfo | null;
  onOpenFolderModal: () => void;
  onNavigateToChallans: () => void;
  onNavigateToSap: () => void;
}

export const ReconciliationView: React.FC<Props> = ({
  challans,
  sapRecords,
  selectedFolder,
  onOpenFolderModal,
  onNavigateToChallans,
  onNavigateToSap,
}) => {
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 5000);
  };

  const { items, stats } = performReconciliation(challans, sapRecords);

  const handleExportReconciliation = async () => {
    if (items.length === 0) {
      showToast('No records available for reconciliation.', 'error');
      return;
    }

    if (!selectedFolder) {
      onOpenFolderModal();
      return;
    }

    try {
      const wb = generateReconciliationWorkbook(items, stats, challans, sapRecords);
      const fileName = `TDS_SAP_Reconciliation_${new Date().toISOString().substring(0, 10)}.xlsx`;
      const result = await saveWorkbookToFile(wb, fileName, selectedFolder?.handle);

      if (result.success) {
        showToast(result.message);
      } else {
        showToast(result.message, 'error');
      }
    } catch (err: any) {
      showToast(`Export failed: ${err.message}`, 'error');
    }
  };

  const filteredItems = items.filter((item) => {
    if (selectedStatusFilter !== 'ALL' && item.status !== selectedStatusFilter) {
      return false;
    }
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      item.challanNumber.toLowerCase().includes(term) ||
      item.bsrCode.toLowerCase().includes(term) ||
      (item.sapDocumentNo && item.sapDocumentNo.toLowerCase().includes(term)) ||
      (item.remarks && item.remarks.toLowerCase().includes(term)) ||
      (item.sapRecord?.vendorName && item.sapRecord.vendorName.toLowerCase().includes(term))
    );
  });

  const getStatusBadge = (status: ReconciliationStatus) => {
    switch (status) {
      case 'MATCHED':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" />
            Reconciled
          </span>
        );
      case 'AMOUNT_GAP':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-200">
            <AlertOctagon className="w-3.5 h-3.5 mr-1 text-red-600" />
            Amount Gap
          </span>
        );
      case 'BREAKUP_GAP':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
            <AlertTriangle className="w-3.5 h-3.5 mr-1 text-amber-600" />
            Breakup Gap
          </span>
        );
      case 'MISSING_IN_CHALLAN':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-200">
            <ShieldAlert className="w-3.5 h-3.5 mr-1 text-purple-600" />
            Missing Challan
          </span>
        );
      case 'MISSING_IN_SAP':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
            <HelpCircle className="w-3.5 h-3.5 mr-1 text-blue-600" />
            Missing in SAP
          </span>
        );
    }
  };

  const hasCriticalGaps =
    stats.amountGapCount > 0 || stats.missingInChallanCount > 0 || stats.missingInSapCount > 0;

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between text-sm shadow-md animate-in slide-in-from-top duration-200 ${
            toastMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}
        >
          <div className="flex items-center space-x-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <span className="font-medium">{toastMessage.text}</span>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="text-slate-400 hover:text-slate-700 ml-4 font-bold text-xs"
          >
            ✕
          </button>
        </div>
      )}

      {/* Top Banner with Action Button */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white rounded-2xl p-6 shadow-lg border border-slate-700/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs uppercase tracking-wider font-semibold text-emerald-400">
              Automated Statutory Reconciliation
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
              Form ITNS 281 vs SAP ERP
            </span>
          </div>
          <h2 className="text-xl font-bold text-white mt-1">
            Financial Gap Analysis &amp; Reconciliation Engine
          </h2>
          <p className="text-xs text-slate-300 mt-1 max-w-xl">
            Cross-verifies tax deposits with SAP accounting books. Highlights gaps in payment file and actual challan receipts.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <button
            onClick={onOpenFolderModal}
            className="px-4 py-2.5 bg-slate-700/80 hover:bg-slate-700 text-white text-xs font-semibold rounded-xl border border-slate-600 transition-colors flex items-center space-x-1.5"
            title="Configure folder for reconciliation export"
          >
            <Folder className="w-4 h-4 text-blue-400" />
            <span>Folder: {selectedFolder ? selectedFolder.name : 'Select'}</span>
          </button>

          <button
            onClick={handleExportReconciliation}
            disabled={items.length === 0}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-400 text-white text-xs font-semibold rounded-xl transition-all shadow-md shadow-emerald-950/40 flex items-center space-x-2"
          >
            <Download className="w-4 h-4" />
            <span>Export Reconciliation File (.xlsx)</span>
          </button>
        </div>
      </div>

      {/* KPI Metrics Dashboard Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Deposited in Challan */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Actual Challan Deposited
            </span>
            <span className="px-2 py-0.5 text-[10px] font-bold bg-blue-50 text-blue-700 rounded-md">
              {stats.totalChallansCount} Receipts
            </span>
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2 font-mono">
            {formatINR(stats.totalChallanAmount)}
          </p>
          <div className="flex items-center space-x-1.5 mt-2 text-xs text-slate-500">
            <span>Credited to Income Tax Dept</span>
          </div>
        </div>

        {/* Card 2: Total SAP Booked */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              SAP Payment Booked
            </span>
            <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-50 text-emerald-700 rounded-md">
              {stats.totalSapRecordsCount} Lines
            </span>
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2 font-mono">
            {formatINR(stats.totalSapAmount)}
          </p>
          <div className="flex items-center space-x-1.5 mt-2 text-xs text-slate-500">
            <span>Withholding tax entries in ERP</span>
          </div>
        </div>

        {/* Card 3: Net Reconciled Gap */}
        <div
          className={`border rounded-2xl p-5 shadow-xs ${
            Math.abs(stats.netGapAmount) < 1
              ? 'bg-emerald-50/50 border-emerald-200'
              : stats.netGapAmount < 0
              ? 'bg-red-50/60 border-red-200'
              : 'bg-amber-50/60 border-amber-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">
              Net Financial Gap
            </span>
            {stats.netGapAmount < 0 ? (
              <span className="flex items-center text-red-700 text-xs font-bold">
                <TrendingDown className="w-3.5 h-3.5 mr-0.5" /> Deficit
              </span>
            ) : stats.netGapAmount > 0 ? (
              <span className="flex items-center text-amber-700 text-xs font-bold">
                <TrendingUp className="w-3.5 h-3.5 mr-0.5" /> Surplus
              </span>
            ) : (
              <span className="text-emerald-700 text-xs font-bold">✓ Balanced</span>
            )}
          </div>
          <p
            className={`text-2xl font-black mt-2 font-mono ${
              Math.abs(stats.netGapAmount) < 1
                ? 'text-emerald-700'
                : stats.netGapAmount < 0
                ? 'text-red-700'
                : 'text-amber-700'
            }`}
          >
            {stats.netGapAmount < 0 ? '-' : stats.netGapAmount > 0 ? '+' : ''}
            {formatINR(Math.abs(stats.netGapAmount))}
          </p>
          <p className="text-xs text-slate-500 mt-2">
            {Math.abs(stats.netGapAmount) < 1
              ? 'Zero variance between Challans & SAP'
              : stats.netGapAmount < 0
              ? 'Challan deposits fall short of SAP bookings'
              : 'Excess deposit unallocated in SAP'}
          </p>
        </div>

        {/* Card 4: Match Rate & Gaps */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Reconciliation Health
            </span>
            <span
              className={`px-2 py-0.5 text-[10px] font-bold rounded-md ${
                stats.matchPercentage >= 90
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-amber-100 text-amber-800'
              }`}
            >
              {stats.matchPercentage.toFixed(0)}% Reconciled
            </span>
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2 font-mono">
            {stats.matchedCount} / {items.length}
          </p>
          <div className="flex items-center space-x-2 mt-2 text-xs">
            {stats.amountGapCount > 0 && (
              <span className="text-red-600 font-semibold">{stats.amountGapCount} Gap</span>
            )}
            {stats.missingInChallanCount > 0 && (
              <span className="text-purple-600 font-semibold">
                {stats.missingInChallanCount} Missing Receipt
              </span>
            )}
            {stats.amountGapCount === 0 && stats.missingInChallanCount === 0 && (
              <span className="text-emerald-600 font-semibold">All Records Verified</span>
            )}
          </div>
        </div>
      </div>

      {/* Compliance Risk Notice (if discrepancies exist) */}
      {hasCriticalGaps && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start space-x-3 text-xs text-amber-900 shadow-xs">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="font-bold text-amber-950 text-sm">
              Compliance Risk Identified: Discrepancies Require Statutory Action
            </h4>
            <p className="text-amber-800 leading-relaxed">
              Found {stats.amountGapCount} amount mismatch(es) and {stats.missingInChallanCount} payment(s) without valid ITNS 281 Challan receipts. Under Section 201(1A) of the Income Tax Act, uncredited TDS deposits attract mandatory interest at 1.5% per month. Review the highlighted gaps below and export the reconciliation report.
            </p>
          </div>
        </div>
      )}

      {/* Reconciliation Table Card */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        {/* Table Filter Controls */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 uppercase mr-1">Filter:</span>
            {[
              { id: 'ALL', label: `All (${items.length})` },
              { id: 'MATCHED', label: `Reconciled (${stats.matchedCount})` },
              { id: 'AMOUNT_GAP', label: `Amount Gap (${stats.amountGapCount})` },
              { id: 'MISSING_IN_CHALLAN', label: `Missing Challan (${stats.missingInChallanCount})` },
              { id: 'MISSING_IN_SAP', label: `Missing in SAP (${stats.missingInSapCount})` },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setSelectedStatusFilter(f.id)}
                className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-all ${
                  selectedStatusFilter === f.id
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="flex items-center space-x-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search challan, BSR, SAP doc..."
                className="pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 w-56"
              />
            </div>

            <button
              onClick={handleExportReconciliation}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors flex items-center space-x-1"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export</span>
            </button>
          </div>
        </div>

        {/* Detailed Table */}
        <div className="overflow-x-auto">
          {filteredItems.length === 0 ? (
            <div className="p-12 text-center">
              <FileSpreadsheet className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h4 className="text-sm font-semibold text-slate-700">No Reconciliation Items Found</h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                Ensure you have uploaded both TDS Challans and SAP Payment records.
              </p>
            </div>
          ) : (
            <table className="w-full text-left text-xs text-slate-700 border-collapse">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-300 text-slate-800 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="p-3 border-r border-slate-200 min-w-[140px]">Reconciliation Status</th>
                  <th className="p-3 border-r border-slate-200 min-w-[110px]">Challan No</th>
                  <th className="p-3 border-r border-slate-200 min-w-[100px]">BSR Code</th>
                  <th className="p-3 border-r border-slate-200 min-w-[130px] text-right">Challan Total (₹)</th>
                  <th className="p-3 border-r border-slate-200 min-w-[130px] text-right">SAP Total (₹)</th>
                  <th className="p-3 border-r border-slate-200 min-w-[130px] text-right font-bold bg-slate-200/60">
                    Gap / Variance (₹)
                  </th>
                  <th className="p-3 border-r border-slate-200 min-w-[110px]">Challan Date</th>
                  <th className="p-3 border-r border-slate-200 min-w-[110px]">SAP Date</th>
                  <th className="p-3 border-r border-slate-200 min-w-[120px]">SAP Doc No</th>
                  <th className="p-3 border-r border-slate-200 min-w-[220px]">Variance Root-Cause Remarks</th>
                  <th className="p-3 min-w-[200px]">Prescribed Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white font-mono">
                {filteredItems.map((item) => {
                  const isGap = Math.abs(item.gapAmount) > 0.01;
                  const isDeficit = item.gapAmount < 0;
                  const isSurplus = item.gapAmount > 0;

                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-slate-50 transition-colors ${
                        item.status === 'AMOUNT_GAP'
                          ? 'bg-red-50/30'
                          : item.status === 'MISSING_IN_CHALLAN'
                          ? 'bg-purple-50/30'
                          : item.status === 'MISSING_IN_SAP'
                          ? 'bg-blue-50/20'
                          : ''
                      }`}
                    >
                      {/* Status */}
                      <td className="p-3 border-r border-slate-200 font-sans">
                        {getStatusBadge(item.status)}
                      </td>

                      {/* Challan No */}
                      <td className="p-3 border-r border-slate-200 font-bold text-slate-900">
                        {item.challanNumber || '-'}
                      </td>

                      {/* BSR Code */}
                      <td className="p-3 border-r border-slate-200 text-slate-700">
                        {item.bsrCode || '-'}
                      </td>

                      {/* Challan Total */}
                      <td className="p-3 border-r border-slate-200 text-right text-slate-900">
                        {item.challanTotal !== undefined
                          ? item.challanTotal.toLocaleString('en-IN')
                          : '-'}
                      </td>

                      {/* SAP Total */}
                      <td className="p-3 border-r border-slate-200 text-right text-slate-900">
                        {item.sapTotal !== undefined
                          ? item.sapTotal.toLocaleString('en-IN')
                          : '-'}
                      </td>

                      {/* Gap Amount */}
                      <td
                        className={`p-3 border-r border-slate-200 text-right font-black ${
                          !isGap
                            ? 'text-emerald-700 bg-emerald-50/30'
                            : isDeficit
                            ? 'text-red-700 bg-red-100/50'
                            : 'text-amber-700 bg-amber-100/50'
                        }`}
                      >
                        {!isGap ? (
                          '₹0'
                        ) : (
                          <span>
                            {isDeficit ? '-' : '+'}
                            {formatINR(Math.abs(item.gapAmount))}
                          </span>
                        )}
                      </td>

                      {/* Challan Date */}
                      <td className="p-3 border-r border-slate-200 text-slate-700">
                        {item.challanDate || '-'}
                      </td>

                      {/* SAP Date */}
                      <td className="p-3 border-r border-slate-200 text-slate-700">
                        {item.sapDate || '-'}
                      </td>

                      {/* SAP Doc No */}
                      <td className="p-3 border-r border-slate-200 text-slate-800">
                        {item.sapDocumentNo || '-'}
                      </td>

                      {/* Remarks */}
                      <td className="p-3 border-r border-slate-200 font-sans text-slate-700 text-xs">
                        {item.remarks}
                      </td>

                      {/* Action */}
                      <td className="p-3 font-sans text-slate-800 text-xs">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${
                            item.status === 'MATCHED'
                              ? 'bg-emerald-50 text-emerald-800'
                              : item.status === 'AMOUNT_GAP'
                              ? 'bg-red-50 text-red-800 border border-red-200'
                              : item.status === 'MISSING_IN_CHALLAN'
                              ? 'bg-purple-50 text-purple-800 border border-purple-200 font-semibold'
                              : 'bg-blue-50 text-blue-800'
                          }`}
                        >
                          {item.actionRequired}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {/* Grand Total Row */}
              <tfoot>
                <tr className="bg-slate-100 border-t-2 border-slate-300 font-bold font-mono text-slate-900 text-xs">
                  <td className="p-3 border-r border-slate-200 font-sans" colSpan={3}>
                    RECONCILIATION TOTALS ({items.length} Entries)
                  </td>
                  <td className="p-3 border-r border-slate-200 text-right">
                    {stats.totalChallanAmount.toLocaleString('en-IN')}
                  </td>
                  <td className="p-3 border-r border-slate-200 text-right">
                    {stats.totalSapAmount.toLocaleString('en-IN')}
                  </td>
                  <td
                    className={`p-3 border-r border-slate-200 text-right font-black ${
                      Math.abs(stats.netGapAmount) < 1
                        ? 'text-emerald-700 bg-emerald-100'
                        : stats.netGapAmount < 0
                        ? 'text-red-700 bg-red-200/80'
                        : 'text-amber-700 bg-amber-200/80'
                    }`}
                  >
                    {stats.netGapAmount < 0 ? '-' : stats.netGapAmount > 0 ? '+' : ''}
                    {formatINR(Math.abs(stats.netGapAmount))}
                  </td>
                  <td colSpan={5}></td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>

        {/* Footer actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="text-slate-500">
            Selected Output Folder:{' '}
            <strong className="text-slate-800 font-mono">
              {selectedFolder ? selectedFolder.name : 'Browser Downloads (Default)'}
            </strong>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={handleExportReconciliation}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow-sm transition-colors flex items-center space-x-1.5"
            >
              <Download className="w-4 h-4" />
              <span>Save Reconciliation File (.xlsx)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
