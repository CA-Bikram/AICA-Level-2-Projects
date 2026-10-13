import React, { useState, useRef } from 'react';
import {
  Upload,
  FileText,
  Folder,
  Download,
  Plus,
  Trash2,
  CheckCircle,
  AlertCircle,
  Eye,
  RefreshCw,
  Sparkles,
  Layers,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { TdsChallan, SelectedFolderInfo } from '../types/tds';
import { extractChallanFromFile, cleanNumber } from '../utils/challanParser';
import {
  generateChallanSummaryWorkbook,
  saveWorkbookToFile,
  formatINR,
} from '../utils/excelGenerator';
import { SAMPLE_CHALLANS } from '../data/sampleData';
import { ConfirmModal } from './ConfirmModal';

interface Props {
  challans: TdsChallan[];
  setChallans: React.Dispatch<React.SetStateAction<TdsChallan[]>>;
  selectedFolder: SelectedFolderInfo | null;
  onOpenFolderModal: () => void;
  onNavigateToSap: () => void;
}

export const ChallanExtractor: React.FC<Props> = ({
  challans,
  setChallans,
  selectedFolder,
  onOpenFolderModal,
  onNavigateToSap,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showExtendedFields, setShowExtendedFields] = useState(false);
  const [previewChallan, setPreviewChallan] = useState<TdsChallan | null>(null);
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 5000);
  };

  const handleFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    setIsProcessing(true);
    const newExtracted: TdsChallan[] = [];

    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];
      setProcessingStatus(`Parsing file ${i + 1} of ${fileArray.length}: ${file.name}...`);
      try {
        const extracted = await extractChallanFromFile(file);
        newExtracted.push(extracted);
      } catch (err: any) {
        console.error(`Failed to parse ${file.name}:`, err);
        showToast(`Failed to parse ${file.name}: ${err.message}`, 'error');
      }
    }

    if (newExtracted.length > 0) {
      setChallans((prev) => [...prev, ...newExtracted]);
      const last = newExtracted[0];
      const amountStr = last.total ? ` — Amount: ₹${last.total.toLocaleString('en-IN')}` : '';
      showToast(
        `Successfully extracted ${newExtracted.length} TDS Challan receipt${
          newExtracted.length > 1 ? 's' : ''
        }! (Challan: ${last.challanNumber || '-'}, BSR: ${last.bsrCode || '-'}${amountStr})`
      );
    }

    setIsProcessing(false);
    setProcessingStatus('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleLoadSampleExact = () => {
    // Exact receipt from the user's uploaded image
    const sample = SAMPLE_CHALLANS[0]; // MELC05986B, Challan 32094, BSR 6390009, Tax 5136878
    setChallans((prev) => {
      // Avoid duplicate id
      const filtered = prev.filter((c) => c.challanNumber !== sample.challanNumber);
      return [sample, ...filtered];
    });
    showToast(`Loaded sample ITNS 281 Challan receipt (Challan No: 32094, ₹51,36,878)!`);
  };

  const handleLoadAllSamples = () => {
    setChallans(SAMPLE_CHALLANS);
    showToast(`Loaded 4 realistic TDS Challan receipts across sections 94C, 94J, 94I & 192.`);
  };

  const handleClearAll = () => {
    setIsClearModalOpen(true);
  };

  const handleConfirmClear = () => {
    setChallans([]);
    setIsClearModalOpen(false);
    showToast('Cleared all challans.');
  };

  const handleAddManualRow = () => {
    const newCh: TdsChallan = {
      id: `manual-${Date.now()}`,
      challanNumber: '00000',
      bsrCode: '0000000',
      dateOfPayment: new Date().toLocaleDateString('en-GB'),
      tax: 0,
      surcharge: 0,
      cess: 0,
      interest: 0,
      penalty: 0,
      fee234E: 0,
      total: 0,
      sourceFileName: 'Manual Entry',
      extractedAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
      extractionMethod: 'manual',
    };
    setChallans((prev) => [newCh, ...prev]);
    showToast('Added new manual challan row. You can edit cells directly.');
  };

  const handleCellChange = (id: string, field: keyof TdsChallan, value: any) => {
    setChallans((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        const updated = { ...c, [field]: value };

        // If numeric component changed, auto recalculate total
        if (
          field === 'tax' ||
          field === 'surcharge' ||
          field === 'cess' ||
          field === 'interest' ||
          field === 'penalty' ||
          field === 'fee234E'
        ) {
          const numVal = cleanNumber(value);
          (updated as any)[field] = numVal;
          updated.total =
            (field === 'tax' ? numVal : c.tax || 0) +
            (field === 'surcharge' ? numVal : c.surcharge || 0) +
            (field === 'cess' ? numVal : c.cess || 0) +
            (field === 'interest' ? numVal : c.interest || 0) +
            (field === 'penalty' ? numVal : c.penalty || 0) +
            (field === 'fee234E' ? numVal : c.fee234E || 0);
        }
        return updated;
      })
    );
  };

  const handleDeleteRow = (id: string) => {
    setChallans((prev) => prev.filter((c) => c.id !== id));
  };

  const handleExportSummaryExcel = async () => {
    if (challans.length === 0) {
      showToast('No challans extracted yet to export.', 'error');
      return;
    }

    // If no folder selected yet, open folder selector modal
    if (!selectedFolder) {
      onOpenFolderModal();
      return;
    }

    try {
      const wb = generateChallanSummaryWorkbook(challans);
      const fileName = `TDS_Challan_Summary_${new Date().toISOString().substring(0, 10)}.xlsx`;
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

  const filteredChallans = challans.filter((c) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      c.challanNumber.toLowerCase().includes(term) ||
      c.bsrCode.toLowerCase().includes(term) ||
      (c.tan && c.tan.toLowerCase().includes(term)) ||
      (c.companyName && c.companyName.toLowerCase().includes(term)) ||
      (c.natureOfPayment && c.natureOfPayment.toLowerCase().includes(term)) ||
      (c.cin && c.cin.toLowerCase().includes(term))
    );
  });

  const totalDeposited = challans.reduce((sum, c) => sum + (c.total || 0), 0);
  const totalTaxOnly = challans.reduce((sum, c) => sum + (c.tax || 0), 0);

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

      {/* Top Banner: Output Folder Status */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white rounded-2xl p-5 shadow-lg border border-slate-700/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="p-3 bg-blue-500/20 text-blue-400 rounded-xl border border-blue-500/30">
            <Folder className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs uppercase tracking-wider font-semibold text-blue-400">
                Summary Output Directory
              </span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                  selectedFolder
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                }`}
              >
                {selectedFolder ? 'Folder Configured' : 'Folder Not Selected'}
              </span>
            </div>
            <p className="text-sm font-semibold text-slate-100 font-mono mt-0.5">
              {selectedFolder ? selectedFolder.pathDescription : 'Click button to select folder for Excel files'}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2.5 w-full md:w-auto">
          <button
            onClick={onOpenFolderModal}
            className="flex-1 md:flex-none px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold rounded-xl border border-slate-600 transition-colors flex items-center justify-center space-x-1.5 shadow-sm"
          >
            <Folder className="w-4 h-4 text-blue-400" />
            <span>{selectedFolder ? 'Change Folder' : 'Select Folder'}</span>
          </button>
          <button
            onClick={handleExportSummaryExcel}
            disabled={challans.length === 0}
            className="flex-1 md:flex-none px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-400 text-white text-xs font-semibold rounded-xl transition-all flex items-center justify-center space-x-1.5 shadow-md shadow-blue-900/30"
          >
            <Download className="w-4 h-4" />
            <span>Save Summary Excel</span>
          </button>
        </div>
      </div>

      {/* Upload Zone & Quick Sample Triggers */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Upload Box (Span 2) */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`lg:col-span-2 border-2 border-dashed rounded-2xl p-7 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[190px] relative overflow-hidden ${
            isDragging
              ? 'border-blue-500 bg-blue-50/70 shadow-inner'
              : 'border-slate-300 hover:border-blue-400 bg-white hover:bg-slate-50/80 shadow-sm'
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => e.target.files && handleFiles(e.target.files)}
            multiple
            accept=".pdf,image/png,image/jpeg,image/webp,.txt"
            className="hidden"
          />

          <div className="p-3.5 bg-blue-50 text-blue-600 rounded-2xl mb-3 shadow-sm border border-blue-100">
            <Upload className="w-7 h-7" />
          </div>
          <h3 className="text-base font-semibold text-slate-800">
            Upload TDS Challan Receipts (Form ITNS 281)
          </h3>
          <p className="text-xs text-slate-500 max-w-md mt-1">
            Drag & drop PDF receipts, scanned challans, or PNG/JPG screenshots. Supports batch upload.
          </p>

          <div className="flex items-center space-x-3 mt-3 text-[11px] text-slate-400">
            <span className="flex items-center space-x-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              <span>ITNS 281 PDFs</span>
            </span>
            <span>•</span>
            <span className="flex items-center space-x-1">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
              <span>OCR Scans / Images</span>
            </span>
            <span>•</span>
            <span className="flex items-center space-x-1">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
              <span>Gemini AI Extraction</span>
            </span>
          </div>

          {isProcessing && (
            <div className="absolute inset-0 bg-white/90 backdrop-blur-xs flex flex-col items-center justify-center p-4 z-10">
              <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mb-2" />
              <p className="text-xs font-semibold text-slate-800">{processingStatus}</p>
              <p className="text-[11px] text-slate-500 mt-1">
                Extracting Challan No, BSR, Dates, and Tax Breakup (A to F)...
              </p>
            </div>
          )}
        </div>

        {/* Quick Demo Controls (Span 1) */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center space-x-2 text-indigo-700">
              <Sparkles className="w-4 h-4" />
              <h4 className="text-xs font-bold uppercase tracking-wider">Quick Sample Data</h4>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Instantly load test receipts to inspect the extractor table and reconciliation engine.
            </p>
          </div>

          <div className="space-y-2">
            <button
              onClick={handleLoadSampleExact}
              className="w-full text-left p-3 bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 border border-blue-200 rounded-xl transition-colors group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-900 group-hover:text-blue-800">
                  Sample Receipt (₹51,36,878)
                </span>
                <span className="text-[10px] px-1.5 py-0.5 bg-blue-200/80 text-blue-900 rounded font-mono font-medium">
                  ITNS 281
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5 font-mono">
                Challan: 32094 | BSR: 6390009 | 94C
              </p>
            </button>

            <button
              onClick={handleLoadAllSamples}
              className="w-full text-left p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-900 group-hover:text-slate-800">
                  Load Multi-Challan Batch (4)
                </span>
                <span className="text-[10px] px-1.5 py-0.5 bg-slate-200 text-slate-700 rounded font-medium">
                  Bulk Demo
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Includes exact matches, amount gap, & missing challans
              </p>
            </button>
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Total Challans: <strong className="text-slate-800">{challans.length}</strong></span>
            <span>Total: <strong className="text-slate-800">{formatINR(totalDeposited)}</strong></span>
          </div>
        </div>
      </div>

      {/* Challan Summary Table Card */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        {/* Table Toolbar */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="font-bold text-slate-900 text-base">
                Extracted TDS Challan Summary Table
              </h3>
              <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-md text-xs font-semibold">
                {challans.length} {challans.length === 1 ? 'Challan' : 'Challans'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Exact schema matching the required format: Challan number | BSR | Date of payment | Tax | Surcharge | Cess | Interest | Penalty | Total
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search challan, BSR..."
              className="px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 w-44"
            />

            <button
              onClick={() => setShowExtendedFields(!showExtendedFields)}
              className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors flex items-center space-x-1"
            >
              <span>{showExtendedFields ? 'Hide' : 'Show'} Deductor Info</span>
              {showExtendedFields ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            <button
              onClick={handleAddManualRow}
              className="px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors flex items-center space-x-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Row</span>
            </button>

            {challans.length > 0 && (
              <button
                onClick={handleClearAll}
                className="px-2.5 py-1.5 text-xs font-medium text-red-600 hover:text-red-700 bg-white hover:bg-red-50 border border-slate-300 hover:border-red-200 rounded-lg transition-colors"
                title="Clear all rows"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto">
          {challans.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h4 className="text-sm font-semibold text-slate-700">No TDS Challans Extracted Yet</h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                Upload your ITNS 281 Challan receipts or click &quot;Sample Receipt&quot; to test the extractor.
              </p>
              <button
                onClick={handleLoadSampleExact}
                className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
              >
                Load Sample Challan Receipt
              </button>
            </div>
          ) : (
            <table className="w-full text-left text-xs text-slate-700 border-collapse">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-300 text-slate-800 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="p-3 border-r border-slate-200 min-w-[130px]">Challan number</th>
                  <th className="p-3 border-r border-slate-200 min-w-[110px]">BSR</th>
                  <th className="p-3 border-r border-slate-200 min-w-[130px]">Date of payment</th>
                  <th className="p-3 border-r border-slate-200 min-w-[120px] text-right">Tax</th>
                  <th className="p-3 border-r border-slate-200 min-w-[100px] text-right">Surcharge</th>
                  <th className="p-3 border-r border-slate-200 min-w-[90px] text-right">Cess</th>
                  <th className="p-3 border-r border-slate-200 min-w-[100px] text-right">Interest</th>
                  <th className="p-3 border-r border-slate-200 min-w-[100px] text-right">Penalty</th>
                  <th className="p-3 border-r border-slate-200 min-w-[130px] text-right bg-slate-200/70 font-bold">
                    Total
                  </th>
                  {showExtendedFields && (
                    <>
                      <th className="p-3 border-r border-slate-200 min-w-[110px]">TAN</th>
                      <th className="p-3 border-r border-slate-200 min-w-[180px]">Company Name</th>
                      <th className="p-3 border-r border-slate-200 min-w-[80px]">Nature</th>
                      <th className="p-3 border-r border-slate-200 min-w-[180px]">CIN</th>
                    </>
                  )}
                  <th className="p-3 text-center min-w-[70px]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white font-mono">
                {filteredChallans.map((ch) => (
                  <tr key={ch.id} className="hover:bg-blue-50/40 transition-colors">
                    {/* Challan number */}
                    <td className="p-2 border-r border-slate-200">
                      <input
                        type="text"
                        value={ch.challanNumber}
                        onChange={(e) => handleCellChange(ch.id, 'challanNumber', e.target.value)}
                        className="w-full bg-transparent px-2 py-1 rounded hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 font-semibold text-slate-900"
                      />
                    </td>

                    {/* BSR */}
                    <td className="p-2 border-r border-slate-200">
                      <input
                        type="text"
                        value={ch.bsrCode}
                        onChange={(e) => handleCellChange(ch.id, 'bsrCode', e.target.value)}
                        className="w-full bg-transparent px-2 py-1 rounded hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 text-slate-800"
                      />
                    </td>

                    {/* Date of payment */}
                    <td className="p-2 border-r border-slate-200">
                      <input
                        type="text"
                        value={ch.dateOfPayment}
                        onChange={(e) => handleCellChange(ch.id, 'dateOfPayment', e.target.value)}
                        className="w-full bg-transparent px-2 py-1 rounded hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 text-slate-800"
                      />
                    </td>

                    {/* Tax */}
                    <td className="p-2 border-r border-slate-200 text-right">
                      <input
                        type="number"
                        value={ch.tax}
                        onChange={(e) => handleCellChange(ch.id, 'tax', e.target.value)}
                        className="w-full bg-transparent px-2 py-1 rounded hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 text-right text-slate-900 font-medium"
                      />
                    </td>

                    {/* Surcharge */}
                    <td className="p-2 border-r border-slate-200 text-right">
                      <input
                        type="number"
                        value={ch.surcharge}
                        onChange={(e) => handleCellChange(ch.id, 'surcharge', e.target.value)}
                        className="w-full bg-transparent px-2 py-1 rounded hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 text-right text-slate-600"
                      />
                    </td>

                    {/* Cess */}
                    <td className="p-2 border-r border-slate-200 text-right">
                      <input
                        type="number"
                        value={ch.cess}
                        onChange={(e) => handleCellChange(ch.id, 'cess', e.target.value)}
                        className="w-full bg-transparent px-2 py-1 rounded hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 text-right text-slate-600"
                      />
                    </td>

                    {/* Interest */}
                    <td className="p-2 border-r border-slate-200 text-right">
                      <input
                        type="number"
                        value={ch.interest}
                        onChange={(e) => handleCellChange(ch.id, 'interest', e.target.value)}
                        className="w-full bg-transparent px-2 py-1 rounded hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 text-right text-slate-600"
                      />
                    </td>

                    {/* Penalty */}
                    <td className="p-2 border-r border-slate-200 text-right">
                      <input
                        type="number"
                        value={ch.penalty}
                        onChange={(e) => handleCellChange(ch.id, 'penalty', e.target.value)}
                        className="w-full bg-transparent px-2 py-1 rounded hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 text-right text-slate-600"
                      />
                    </td>

                    {/* Total */}
                    <td className="p-2 border-r border-slate-200 text-right bg-slate-50/70 font-bold text-slate-950">
                      {ch.total?.toLocaleString('en-IN') || 0}
                    </td>

                    {/* Extended Info */}
                    {showExtendedFields && (
                      <>
                        <td className="p-2 border-r border-slate-200 text-slate-700">
                          {ch.tan || '-'}
                        </td>
                        <td className="p-2 border-r border-slate-200 font-sans text-slate-700 truncate max-w-[180px]">
                          {ch.companyName || '-'}
                        </td>
                        <td className="p-2 border-r border-slate-200 text-slate-700">
                          {ch.natureOfPayment || '-'}
                        </td>
                        <td className="p-2 border-r border-slate-200 text-slate-600 truncate max-w-[180px]">
                          {ch.cin || '-'}
                        </td>
                      </>
                    )}

                    {/* Actions */}
                    <td className="p-2 text-center">
                      <div className="flex items-center justify-center space-x-1 font-sans">
                        <button
                          onClick={() => setPreviewChallan(ch)}
                          title="View receipt summary"
                          className="p-1 text-slate-400 hover:text-blue-600 rounded transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteRow(ch.id)}
                          title="Delete row"
                          className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              {/* Table Footer: Totals */}
              <tfoot>
                <tr className="bg-slate-100/90 border-t-2 border-slate-300 font-bold font-mono text-slate-900 text-xs">
                  <td className="p-3 border-r border-slate-200 font-sans" colSpan={3}>
                    TOTAL ({challans.length} Challans)
                  </td>
                  <td className="p-3 border-r border-slate-200 text-right">
                    {totalTaxOnly.toLocaleString('en-IN')}
                  </td>
                  <td className="p-3 border-r border-slate-200 text-right">
                    {challans.reduce((s, c) => s + (c.surcharge || 0), 0).toLocaleString('en-IN')}
                  </td>
                  <td className="p-3 border-r border-slate-200 text-right">
                    {challans.reduce((s, c) => s + (c.cess || 0), 0).toLocaleString('en-IN')}
                  </td>
                  <td className="p-3 border-r border-slate-200 text-right">
                    {challans.reduce((s, c) => s + (c.interest || 0), 0).toLocaleString('en-IN')}
                  </td>
                  <td className="p-3 border-r border-slate-200 text-right">
                    {challans.reduce((s, c) => s + (c.penalty || 0), 0).toLocaleString('en-IN')}
                  </td>
                  <td className="p-3 border-r border-slate-200 text-right bg-blue-100/70 text-blue-950 font-bold">
                    {totalDeposited.toLocaleString('en-IN')}
                  </td>
                  {showExtendedFields && <td colSpan={4} className="border-r border-slate-200"></td>}
                  <td></td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>

        {/* Footer info & Next step button */}
        {challans.length > 0 && (
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="text-slate-500">
              Files will be saved in format: <span className="font-semibold text-slate-700">Challan number | BSR | Date of payment | Tax | Surcharge | Cess | Interest | Penalty | Total</span>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={handleExportSummaryExcel}
                className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-semibold rounded-lg shadow-xs transition-colors flex items-center space-x-1.5"
              >
                <Download className="w-3.5 h-3.5 text-blue-600" />
                <span>Save Excel Summary</span>
              </button>
              <button
                onClick={onNavigateToSap}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-lg shadow-sm transition-colors flex items-center space-x-1.5"
              >
                <span>Proceed to SAP Upload</span>
                <span>→</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Challan Receipt Details Modal */}
      {previewChallan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 px-6 py-4 text-white flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest">
                  INCOME TAX DEPARTMENT • ITNS 281
                </span>
                <h3 className="font-bold text-base text-white">Challan Receipt Details</h3>
              </div>
              <button
                onClick={() => setPreviewChallan(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs font-mono text-slate-800 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-sans">TAN</span>
                  <span className="font-bold text-slate-900">{previewChallan.tan || 'MELC05986B'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-sans">Assessment Year</span>
                  <span className="font-bold text-slate-900">{previewChallan.assessmentYear || '2026-27'}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-400 block text-[10px] uppercase font-sans">Name of Deductor</span>
                  <span className="font-bold text-slate-900 font-sans">{previewChallan.companyName || 'XYZ INDIA PRIVATE LIMITED'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-sans">Nature of Payment</span>
                  <span className="font-bold text-blue-700">{previewChallan.natureOfPayment || '94C'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-sans">Date of Deposit</span>
                  <span className="font-bold text-slate-900">{previewChallan.dateOfPayment}</span>
                </div>
              </div>

              {/* Bank & OLTAS Details */}
              <div className="border border-slate-200 rounded-xl p-3 space-y-2 bg-white">
                <h5 className="font-bold text-[11px] text-slate-700 uppercase font-sans tracking-wide">
                  Bank &amp; Deposit Identification
                </h5>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>BSR Code: <strong className="text-slate-900">{previewChallan.bsrCode}</strong></div>
                  <div>Challan No: <strong className="text-slate-900">{previewChallan.challanNumber}</strong></div>
                  <div>Bank Name: <span>{previewChallan.bankName || 'ICICI Bank'}</span></div>
                  <div>CIN: <span className="text-[10px] text-slate-600">{previewChallan.cin || '25120400315977ICIC'}</span></div>
                </div>
              </div>

              {/* Tax Breakup */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-100 px-3 py-1.5 font-bold text-[11px] text-slate-700 font-sans">
                  Tax Breakup Details (Amount In ₹)
                </div>
                <div className="p-3 space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span>A. Tax:</span>
                    <strong>{formatINR(previewChallan.tax)}</strong>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>B. Surcharge:</span>
                    <span>{formatINR(previewChallan.surcharge)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>C. Cess:</span>
                    <span>{formatINR(previewChallan.cess)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>D. Interest:</span>
                    <span>{formatINR(previewChallan.interest)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>E. Penalty:</span>
                    <span>{formatINR(previewChallan.penalty)}</span>
                  </div>
                  <div className="pt-2 border-t border-slate-200 flex justify-between font-bold text-sm text-slate-900 bg-slate-50 -mx-3 -mb-3 p-3">
                    <span>Total (A+B+C+D+E):</span>
                    <span className="text-blue-700">{formatINR(previewChallan.total)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setPreviewChallan(null)}
                className="px-4 py-1.5 bg-slate-800 text-white rounded-lg text-xs font-semibold hover:bg-slate-900"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear Challans Confirmation Modal */}
      <ConfirmModal
        isOpen={isClearModalOpen}
        title="Clear All Extracted Challans?"
        message="Are you sure you want to clear all extracted TDS Challan records from the summary table? This action cannot be undone."
        confirmLabel="Yes, Clear All"
        confirmVariant="danger"
        onConfirm={handleConfirmClear}
        onCancel={() => setIsClearModalOpen(false)}
      />
    </div>
  );
};
