import React, { useState, useRef } from 'react';
import {
  Upload,
  FileSpreadsheet,
  Download,
  Plus,
  Trash2,
  CheckCircle,
  AlertCircle,
  Search,
  Sparkles,
  Info,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { SapPaymentRecord } from '../types/tds';
import { parseSapExcelFile, formatINR } from '../utils/excelGenerator';
import { SAMPLE_SAP_PAYMENTS } from '../data/sampleData';
import { ConfirmModal } from './ConfirmModal';

interface Props {
  sapRecords: SapPaymentRecord[];
  setSapRecords: React.Dispatch<React.SetStateAction<SapPaymentRecord[]>>;
  onNavigateToRecon: () => void;
}

export const SapUploader: React.FC<Props> = ({
  sapRecords,
  setSapRecords,
  onNavigateToRecon,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 5000);
  };

  const handleFileUpload = async (files: FileList | File[]) => {
    const file = files[0];
    if (!file) return;

    setIsParsing(true);
    try {
      const records = await parseSapExcelFile(file);
      setSapRecords(records);
      showToast(`Successfully imported ${records.length} SAP payment records from "${file.name}"!`);
    } catch (err: any) {
      console.error('Failed to parse SAP file:', err);
      showToast(err.message || 'Failed to read SAP Excel file. Check format.', 'error');
    } finally {
      setIsParsing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      handleFileUpload(e.dataTransfer.files);
    }
  };

  const handleLoadSampleSap = () => {
    setSapRecords(SAMPLE_SAP_PAYMENTS);
    showToast(`Loaded ${SAMPLE_SAP_PAYMENTS.length} realistic SAP payment records.`);
  };

  const handleClearAll = () => {
    setIsClearModalOpen(true);
  };

  const handleConfirmClear = () => {
    setSapRecords([]);
    setIsClearModalOpen(false);
    showToast('Cleared all SAP records.');
  };

  const handleAddManualRow = () => {
    const newRecord: SapPaymentRecord = {
      id: `sap-manual-${Date.now()}`,
      documentNumber: `19000${Math.floor(10000 + Math.random() * 90000)}`,
      challanNumber: '32094',
      bsrCode: '6390009',
      paymentDate: new Date().toLocaleDateString('en-GB'),
      taxAmount: 0,
      surcharge: 0,
      cess: 0,
      interest: 0,
      penalty: 0,
      totalAmount: 0,
      vendorName: 'Direct TDS Deposit',
      sectionCode: '194C',
    };
    setSapRecords((prev) => [newRecord, ...prev]);
    showToast('Added manual SAP payment row.');
  };

  const handleCellChange = (id: string, field: keyof SapPaymentRecord, value: any) => {
    setSapRecords((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const updated = { ...r, [field]: value };
        if (field === 'taxAmount' || field === 'totalAmount') {
          const num = parseFloat(String(value).replace(/[^0-9.-]/g, '')) || 0;
          (updated as any)[field] = num;
          if (field === 'taxAmount' && (!r.totalAmount || r.totalAmount === r.taxAmount)) {
            updated.totalAmount = num;
          }
        }
        return updated;
      })
    );
  };

  const handleDeleteRow = (id: string) => {
    setSapRecords((prev) => prev.filter((r) => r.id !== id));
  };

  const handleDownloadTemplate = () => {
    const headers = [
      'Document Number',
      'Challan Number',
      'BSR Code',
      'Payment Date',
      'Tax Amount',
      'Surcharge',
      'Cess',
      'Interest',
      'Total Amount',
      'Vendor Name',
      'Section Code',
      'Clearing Doc',
    ];

    const sampleRow = [
      '1900045210',
      '32094',
      '6390009',
      '04/12/2025',
      5136878,
      0,
      0,
      0,
      5136878,
      'ICICI TDS Electronic Clearing',
      '194C',
      '5100098120',
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, sampleRow]);
    ws['!cols'] = [
      { wch: 18 },
      { wch: 16 },
      { wch: 14 },
      { wch: 16 },
      { wch: 14 },
      { wch: 12 },
      { wch: 10 },
      { wch: 10 },
      { wch: 16 },
      { wch: 28 },
      { wch: 14 },
      { wch: 16 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'SAP_Payment_Template');
    XLSX.writeFile(wb, 'SAP_TDS_Payment_Template.xlsx');
    showToast('Downloaded SAP TDS Payment Template (.xlsx).');
  };

  const filteredRecords = sapRecords.filter((r) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      r.documentNumber.toLowerCase().includes(term) ||
      r.challanNumber.toLowerCase().includes(term) ||
      r.bsrCode.toLowerCase().includes(term) ||
      (r.vendorName && r.vendorName.toLowerCase().includes(term)) ||
      (r.sectionCode && r.sectionCode.toLowerCase().includes(term))
    );
  });

  const totalSapSum = sapRecords.reduce((sum, r) => sum + (r.totalAmount || 0), 0);

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
            {toastMessage.type === 'success' ? (
              <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            )}
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

      {/* Upload Zone & Demo Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Upload Box */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`lg:col-span-2 border-2 border-dashed rounded-2xl p-7 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[190px] relative ${
            isDragging
              ? 'border-emerald-500 bg-emerald-50/70 shadow-inner'
              : 'border-slate-300 hover:border-emerald-500 bg-white hover:bg-slate-50/80 shadow-sm'
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
            accept=".xlsx,.xls,.csv"
            className="hidden"
          />

          <div className="p-3.5 bg-emerald-50 text-emerald-600 rounded-2xl mb-3 shadow-sm border border-emerald-100">
            <FileSpreadsheet className="w-7 h-7" />
          </div>
          <h3 className="text-base font-semibold text-slate-800">
            Upload SAP Payment Excel / CSV File
          </h3>
          <p className="text-xs text-slate-500 max-w-md mt-1">
            Accepts standard SAP ERP reports (FBL1N, FBL3N, J1INCHLN, F110). Auto-maps Challan No, BSR, and Payment amounts.
          </p>

          <div className="flex items-center space-x-3 mt-3 text-[11px] text-slate-400">
            <span>• Microsoft Excel (.xlsx / .xls)</span>
            <span>• Comma Separated (.csv)</span>
            <span>• Intelligent Column Auto-Detection</span>
          </div>

          {isParsing && (
            <div className="absolute inset-0 bg-white/90 backdrop-blur-xs flex flex-col items-center justify-center p-4 z-10">
              <div className="w-7 h-7 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mb-2"></div>
              <p className="text-xs font-semibold text-slate-800">Parsing SAP Spreadsheet...</p>
            </div>
          )}
        </div>

        {/* Demo & Template Box */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center space-x-2 text-emerald-700">
              <Sparkles className="w-4 h-4" />
              <h4 className="text-xs font-bold uppercase tracking-wider">Quick Actions &amp; Template</h4>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Load realistic SAP payment lines or download the standard reconciliation template.
            </p>
          </div>

          <div className="space-y-2">
            <button
              onClick={handleLoadSampleSap}
              className="w-full text-left p-3 bg-gradient-to-r from-emerald-50 to-teal-50 hover:from-emerald-100 hover:to-teal-100 border border-emerald-200 rounded-xl transition-colors group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-900 group-hover:text-emerald-800">
                  Load Realistic SAP Records (5)
                </span>
                <span className="text-[10px] px-1.5 py-0.5 bg-emerald-200/80 text-emerald-900 rounded font-mono font-medium">
                  SAP ERP
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Contains match with ₹51,36,878, gap of ₹5,000, &amp; uncredited records.
              </p>
            </button>

            <button
              onClick={handleDownloadTemplate}
              className="w-full text-left p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors flex items-center justify-between"
            >
              <div>
                <span className="text-xs font-semibold text-slate-800 block">
                  Download SAP Template (.xlsx)
                </span>
                <span className="text-[11px] text-slate-500">
                  Blank spreadsheet with standard headers
                </span>
              </div>
              <Download className="w-4 h-4 text-slate-400" />
            </button>
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>SAP Entries: <strong className="text-slate-800">{sapRecords.length}</strong></span>
            <span>Total: <strong className="text-slate-800">{formatINR(totalSapSum)}</strong></span>
          </div>
        </div>
      </div>

      {/* SAP Payment Records Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        {/* Table Toolbar */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="font-bold text-slate-900 text-base">
                SAP Payment Ledger Records
              </h3>
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md text-xs font-semibold">
                {sapRecords.length} {sapRecords.length === 1 ? 'Record' : 'Records'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              These payment details will be reconciled against the extracted TDS Challan receipts to highlight financial gaps.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search doc, challan, vendor..."
                className="pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 w-52"
              />
            </div>

            <button
              onClick={handleAddManualRow}
              className="px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors flex items-center space-x-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add SAP Entry</span>
            </button>

            {sapRecords.length > 0 && (
              <button
                onClick={handleClearAll}
                className="px-2.5 py-1.5 text-xs font-medium text-red-600 hover:text-red-700 bg-white hover:bg-red-50 border border-slate-300 hover:border-red-200 rounded-lg transition-colors"
                title="Clear all SAP records"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          {sapRecords.length === 0 ? (
            <div className="p-12 text-center">
              <FileSpreadsheet className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h4 className="text-sm font-semibold text-slate-700">No SAP Payment Records Uploaded</h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                Upload your SAP payment report or click &quot;Load Realistic SAP Records&quot; to test.
              </p>
              <button
                onClick={handleLoadSampleSap}
                className="mt-4 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
              >
                Load Sample SAP Records
              </button>
            </div>
          ) : (
            <table className="w-full text-left text-xs text-slate-700 border-collapse">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-300 text-slate-800 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="p-3 border-r border-slate-200 min-w-[130px]">SAP Doc No</th>
                  <th className="p-3 border-r border-slate-200 min-w-[120px]">Challan No</th>
                  <th className="p-3 border-r border-slate-200 min-w-[110px]">BSR Code</th>
                  <th className="p-3 border-r border-slate-200 min-w-[120px]">Payment Date</th>
                  <th className="p-3 border-r border-slate-200 min-w-[130px] text-right">Tax Amount</th>
                  <th className="p-3 border-r border-slate-200 min-w-[130px] text-right bg-emerald-50/60 font-bold">
                    Total Amount (₹)
                  </th>
                  <th className="p-3 border-r border-slate-200 min-w-[180px]">Vendor / Payee</th>
                  <th className="p-3 border-r border-slate-200 min-w-[90px]">Section</th>
                  <th className="p-3 text-center min-w-[60px]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white font-mono">
                {filteredRecords.map((r) => (
                  <tr key={r.id} className="hover:bg-emerald-50/40 transition-colors">
                    {/* SAP Doc No */}
                    <td className="p-2 border-r border-slate-200">
                      <input
                        type="text"
                        value={r.documentNumber}
                        onChange={(e) => handleCellChange(r.id, 'documentNumber', e.target.value)}
                        className="w-full bg-transparent px-2 py-1 rounded hover:bg-white focus:bg-white focus:ring-1 focus:ring-emerald-500 font-semibold text-slate-900"
                      />
                    </td>

                    {/* Challan No */}
                    <td className="p-2 border-r border-slate-200">
                      <input
                        type="text"
                        value={r.challanNumber}
                        onChange={(e) => handleCellChange(r.id, 'challanNumber', e.target.value)}
                        className="w-full bg-transparent px-2 py-1 rounded hover:bg-white focus:bg-white focus:ring-1 focus:ring-emerald-500 text-slate-800"
                      />
                    </td>

                    {/* BSR Code */}
                    <td className="p-2 border-r border-slate-200">
                      <input
                        type="text"
                        value={r.bsrCode}
                        onChange={(e) => handleCellChange(r.id, 'bsrCode', e.target.value)}
                        className="w-full bg-transparent px-2 py-1 rounded hover:bg-white focus:bg-white focus:ring-1 focus:ring-emerald-500 text-slate-800"
                      />
                    </td>

                    {/* Payment Date */}
                    <td className="p-2 border-r border-slate-200">
                      <input
                        type="text"
                        value={r.paymentDate}
                        onChange={(e) => handleCellChange(r.id, 'paymentDate', e.target.value)}
                        className="w-full bg-transparent px-2 py-1 rounded hover:bg-white focus:bg-white focus:ring-1 focus:ring-emerald-500 text-slate-800"
                      />
                    </td>

                    {/* Tax Amount */}
                    <td className="p-2 border-r border-slate-200 text-right">
                      <input
                        type="number"
                        value={r.taxAmount}
                        onChange={(e) => handleCellChange(r.id, 'taxAmount', e.target.value)}
                        className="w-full bg-transparent px-2 py-1 rounded hover:bg-white focus:bg-white focus:ring-1 focus:ring-emerald-500 text-right text-slate-800"
                      />
                    </td>

                    {/* Total Amount */}
                    <td className="p-2 border-r border-slate-200 text-right bg-emerald-50/40 font-bold text-slate-950">
                      <input
                        type="number"
                        value={r.totalAmount}
                        onChange={(e) => handleCellChange(r.id, 'totalAmount', e.target.value)}
                        className="w-full bg-transparent px-2 py-1 rounded hover:bg-white focus:bg-white focus:ring-1 focus:ring-emerald-500 text-right text-slate-950 font-bold"
                      />
                    </td>

                    {/* Vendor */}
                    <td className="p-2 border-r border-slate-200 font-sans text-slate-700 truncate max-w-[180px]">
                      <input
                        type="text"
                        value={r.vendorName || ''}
                        onChange={(e) => handleCellChange(r.id, 'vendorName', e.target.value)}
                        className="w-full bg-transparent px-2 py-1 rounded hover:bg-white focus:bg-white focus:ring-1 focus:ring-emerald-500"
                      />
                    </td>

                    {/* Section */}
                    <td className="p-2 border-r border-slate-200 text-slate-700">
                      <input
                        type="text"
                        value={r.sectionCode || ''}
                        onChange={(e) => handleCellChange(r.id, 'sectionCode', e.target.value)}
                        className="w-full bg-transparent px-2 py-1 rounded hover:bg-white focus:bg-white focus:ring-1 focus:ring-emerald-500"
                      />
                    </td>

                    {/* Actions */}
                    <td className="p-2 text-center font-sans">
                      <button
                        onClick={() => handleDeleteRow(r.id)}
                        title="Delete SAP record"
                        className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              {/* Totals */}
              <tfoot>
                <tr className="bg-slate-100 border-t-2 border-slate-300 font-bold font-mono text-slate-900 text-xs">
                  <td className="p-3 border-r border-slate-200 font-sans" colSpan={4}>
                    TOTAL SAP BOOKINGS ({sapRecords.length} Records)
                  </td>
                  <td className="p-3 border-r border-slate-200 text-right">
                    {sapRecords.reduce((s, r) => s + (r.taxAmount || 0), 0).toLocaleString('en-IN')}
                  </td>
                  <td className="p-3 border-r border-slate-200 text-right bg-emerald-100 text-emerald-950 font-bold">
                    {totalSapSum.toLocaleString('en-IN')}
                  </td>
                  <td colSpan={3}></td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>

        {/* Footer Next Step */}
        {sapRecords.length > 0 && (
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <span className="text-slate-500">
              Ready to reconcile SAP payments with actual deposited TDS Challans.
            </span>
            <button
              onClick={onNavigateToRecon}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow-sm transition-colors flex items-center space-x-1.5"
            >
              <span>Run Reconciliation &amp; Highlight Gaps</span>
              <span>→</span>
            </button>
          </div>
        )}
      </div>

      {/* Clear SAP Records Confirmation Modal */}
      <ConfirmModal
        isOpen={isClearModalOpen}
        title="Clear All SAP Payment Records?"
        message="Are you sure you want to clear all imported SAP payment rows? You can upload a new report or reload samples anytime."
        confirmLabel="Yes, Clear All"
        confirmVariant="danger"
        onConfirm={handleConfirmClear}
        onCancel={() => setIsClearModalOpen(false)}
      />
    </div>
  );
};
