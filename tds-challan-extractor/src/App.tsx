/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Navbar } from './components/Navbar';
import { ChallanExtractor } from './components/ChallanExtractor';
import { SapUploader } from './components/SapUploader';
import { ReconciliationView } from './components/ReconciliationView';
import { FolderSelectorModal } from './components/FolderSelectorModal';
import { ConfirmModal } from './components/ConfirmModal';
import { TdsChallan, SapPaymentRecord, SelectedFolderInfo } from './types/tds';
import { SAMPLE_CHALLANS, SAMPLE_SAP_PAYMENTS } from './data/sampleData';
import { performReconciliation } from './utils/reconciliationEngine';
import {
  FileText,
  FileSpreadsheet,
  GitCompare,
  FolderCheck,
  CheckCircle2,
  Info,
  ShieldCheck,
} from 'lucide-react';

export default function App() {
  // Pre-load with sample ITNS 281 Challan (matching user prompt: MELC05986B, ICICI Bank, BSR 6390009, Challan 32094, ₹51,36,878)
  const [challans, setChallans] = useState<TdsChallan[]>(SAMPLE_CHALLANS);
  const [sapRecords, setSapRecords] = useState<SapPaymentRecord[]>(SAMPLE_SAP_PAYMENTS);

  // Output folder state
  const [selectedFolder, setSelectedFolder] = useState<SelectedFolderInfo | null>({
    name: 'TDS_Challan_Extracts_2025-26',
    pathDescription: 'Designated Folder: TDS_Challan_Extracts_2025-26 (Browser Downloads)',
    isWritable: true,
  });

  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'challans' | 'sap' | 'reconciliation'>('challans');

  const { stats } = performReconciliation(challans, sapRecords);
  const hasGaps = stats.amountGapCount > 0 || stats.missingInChallanCount > 0;

  const handleLoadFullDemo = () => {
    setChallans(SAMPLE_CHALLANS);
    setSapRecords(SAMPLE_SAP_PAYMENTS);
    setActiveTab('reconciliation');
  };

  const handleResetAllConfirmed = () => {
    setChallans([]);
    setSapRecords([]);
    setActiveTab('challans');
    setIsResetConfirmOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-900 antialiased selection:bg-blue-600 selection:text-white">
      {/* Navigation Bar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        challansCount={challans.length}
        sapCount={sapRecords.length}
        hasGaps={hasGaps}
        selectedFolder={selectedFolder}
        onOpenFolderModal={() => setIsFolderModalOpen(true)}
        onLoadFullDemo={handleLoadFullDemo}
        onResetAll={() => setIsResetConfirmOpen(true)}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        {/* Step Progress Tracker */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Step 1 */}
            <button
              onClick={() => setActiveTab('challans')}
              className={`p-3 rounded-xl border text-left transition-all flex items-start space-x-3 ${
                activeTab === 'challans'
                  ? 'bg-blue-50/80 border-blue-500 shadow-xs'
                  : 'bg-slate-50/50 hover:bg-slate-50 border-slate-200'
              }`}
            >
              <div
                className={`p-2 rounded-lg ${
                  activeTab === 'challans'
                    ? 'bg-blue-600 text-white'
                    : challans.length > 0
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-slate-200 text-slate-500'
                }`}
              >
                <FileText className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Step 1
                  </span>
                  {challans.length > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold font-mono">
                      {challans.length} Extracted
                    </span>
                  )}
                </div>
                <h4 className="text-sm font-semibold text-slate-900 mt-0.5 truncate">
                  Extract TDS Challans
                </h4>
                <p className="text-xs text-slate-500 truncate">
                  Form ITNS 281 &amp; Select Output Folder
                </p>
              </div>
            </button>

            {/* Step 2 */}
            <button
              onClick={() => setActiveTab('sap')}
              className={`p-3 rounded-xl border text-left transition-all flex items-start space-x-3 ${
                activeTab === 'sap'
                  ? 'bg-emerald-50/80 border-emerald-500 shadow-xs'
                  : 'bg-slate-50/50 hover:bg-slate-50 border-slate-200'
              }`}
            >
              <div
                className={`p-2 rounded-lg ${
                  activeTab === 'sap'
                    ? 'bg-emerald-600 text-white'
                    : sapRecords.length > 0
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-slate-200 text-slate-500'
                }`}
              >
                <FileSpreadsheet className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Step 2
                  </span>
                  {sapRecords.length > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold font-mono">
                      {sapRecords.length} Records
                    </span>
                  )}
                </div>
                <h4 className="text-sm font-semibold text-slate-900 mt-0.5 truncate">
                  Upload SAP Payment File
                </h4>
                <p className="text-xs text-slate-500 truncate">
                  FBL1N / J1INCHLN Payment Details
                </p>
              </div>
            </button>

            {/* Step 3 */}
            <button
              onClick={() => setActiveTab('reconciliation')}
              className={`p-3 rounded-xl border text-left transition-all flex items-start space-x-3 ${
                activeTab === 'reconciliation'
                  ? 'bg-indigo-50/80 border-indigo-500 shadow-xs'
                  : 'bg-slate-50/50 hover:bg-slate-50 border-slate-200'
              }`}
            >
              <div
                className={`p-2 rounded-lg ${
                  activeTab === 'reconciliation'
                    ? 'bg-indigo-600 text-white'
                    : hasGaps
                    ? 'bg-red-100 text-red-700'
                    : stats.matchedCount > 0
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-slate-200 text-slate-500'
                }`}
              >
                <GitCompare className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Step 3
                  </span>
                  {hasGaps && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-800 font-bold">
                      Gaps Highlighted
                    </span>
                  )}
                </div>
                <h4 className="text-sm font-semibold text-slate-900 mt-0.5 truncate">
                  Reconciliation &amp; Gaps
                </h4>
                <p className="text-xs text-slate-500 truncate">
                  Export Audit File &amp; Gap Analysis
                </p>
              </div>
            </button>
          </div>
        </div>

        {/* Tab 1: TDS Challan Extractor */}
        {activeTab === 'challans' && (
          <ChallanExtractor
            challans={challans}
            setChallans={setChallans}
            selectedFolder={selectedFolder}
            onOpenFolderModal={() => setIsFolderModalOpen(true)}
            onNavigateToSap={() => setActiveTab('sap')}
          />
        )}

        {/* Tab 2: SAP Payment File Uploader */}
        {activeTab === 'sap' && (
          <SapUploader
            sapRecords={sapRecords}
            setSapRecords={setSapRecords}
            onNavigateToRecon={() => setActiveTab('reconciliation')}
          />
        )}

        {/* Tab 3: Reconciliation Engine & Gap Highlighting */}
        {activeTab === 'reconciliation' && (
          <ReconciliationView
            challans={challans}
            sapRecords={sapRecords}
            selectedFolder={selectedFolder}
            onOpenFolderModal={() => setIsFolderModalOpen(true)}
            onNavigateToChallans={() => setActiveTab('challans')}
            onNavigateToSap={() => setActiveTab('sap')}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 text-xs text-slate-500 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>
              TDS Challan Extractor &amp; SAP Reconciliation Engine • Indian Income Tax ITNS 281 &amp; SAP ERP
            </span>
          </div>
          <div className="flex items-center space-x-4 text-[11px] text-slate-400">
            <span>Direct Folder Save (HTML5 Directory Access)</span>
            <span>•</span>
            <span>Sec. 194C / 194J / 192 / 194I</span>
            <span>•</span>
            <span>Excel 2026 Compatible</span>
          </div>
        </div>
      </footer>

      {/* Directory Selector Modal */}
      <FolderSelectorModal
        isOpen={isFolderModalOpen}
        onClose={() => setIsFolderModalOpen(false)}
        selectedFolder={selectedFolder}
        onSelectFolder={(folder) => setSelectedFolder(folder)}
      />

      {/* Reset Confirmation Modal */}
      <ConfirmModal
        isOpen={isResetConfirmOpen}
        title="Reset All Data?"
        message="Are you sure you want to delete all extracted TDS Challans and SAP payment records? All current tables and reconciliation stats will be cleared. This action cannot be undone."
        confirmLabel="Yes, Reset All Data"
        confirmVariant="danger"
        onConfirm={handleResetAllConfirmed}
        onCancel={() => setIsResetConfirmOpen(false)}
      />
    </div>
  );
}
