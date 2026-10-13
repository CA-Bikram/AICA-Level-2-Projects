import React, { useState } from 'react';
import {
  FileText,
  FileSpreadsheet,
  GitCompare,
  Folder,
  Sparkles,
  RotateCcw,
  CheckCircle,
  Download,
  Github,
  FolderArchive,
  ExternalLink,
  Copy,
  Check,
  X,
  RefreshCw,
} from 'lucide-react';
import { SelectedFolderInfo } from '../types/tds';

interface Props {
  activeTab: 'challans' | 'sap' | 'reconciliation';
  setActiveTab: (tab: 'challans' | 'sap' | 'reconciliation') => void;
  challansCount: number;
  sapCount: number;
  hasGaps: boolean;
  selectedFolder: SelectedFolderInfo | null;
  onOpenFolderModal: () => void;
  onLoadFullDemo: () => void;
  onResetAll: () => void;
}

export const Navbar: React.FC<Props> = ({
  activeTab,
  setActiveTab,
  challansCount,
  sapCount,
  hasGaps,
  selectedFolder,
  onOpenFolderModal,
  onLoadFullDemo,
  onResetAll,
}) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showZipModal, setShowZipModal] = useState(false);

  // Direct download URL matching the user's shared app URL
  const directDownloadUrl = `${window.location.origin}/api/download-zip`;

  const handleProgrammaticDownload = async () => {
    setIsDownloading(true);
    try {
      const response = await fetch('/api/download-zip');
      if (!response.ok) throw new Error('Download failed');
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const tempLink = document.createElement('a');
      tempLink.style.display = 'none';
      tempLink.href = blobUrl;
      tempLink.download = 'tds-challan-extractor.zip';
      document.body.appendChild(tempLink);
      tempLink.click();
      window.URL.revokeObjectURL(blobUrl);
      tempLink.remove();
    } catch (err) {
      console.warn('Blob download error:', err);
      // Fallback: window.open
      window.open('/api/download-zip', '_blank');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(directDownloadUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 3000);
  };
  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-40 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Title */}
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-md shadow-blue-500/20 text-white">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="font-bold text-base sm:text-lg tracking-tight text-white">
                  TDS Challan Extractor
                </h1>
                <span className="hidden sm:inline-block text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  ITNS 281 &amp; SAP
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                Receipts Extraction • Custom Folder Save • Financial Gap Reconciliation
              </p>
            </div>
          </div>

          {/* Workflow Tabs */}
          <div className="hidden md:flex items-center space-x-1 bg-slate-800/80 p-1 rounded-xl border border-slate-700/60">
            <button
              onClick={() => setActiveTab('challans')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center space-x-2 ${
                activeTab === 'challans'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>1. TDS Challans</span>
              {challansCount > 0 && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    activeTab === 'challans' ? 'bg-blue-800 text-white' : 'bg-slate-700 text-slate-300'
                  }`}
                >
                  {challansCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('sap')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center space-x-2 ${
                activeTab === 'sap'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>2. SAP Payments</span>
              {sapCount > 0 && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    activeTab === 'sap' ? 'bg-emerald-800 text-white' : 'bg-slate-700 text-slate-300'
                  }`}
                >
                  {sapCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('reconciliation')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center space-x-2 ${
                activeTab === 'reconciliation'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <GitCompare className="w-3.5 h-3.5" />
              <span>3. Reconciliation</span>
              {hasGaps && (
                <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" title="Gaps detected"></span>
              )}
            </button>
          </div>

          {/* Right Header Utilities */}
          <div className="flex items-center space-x-2.5">
            {/* Folder Picker Indicator */}
            <button
              onClick={onOpenFolderModal}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors flex items-center space-x-1.5 ${
                selectedFolder
                  ? 'bg-emerald-950/40 text-emerald-300 border-emerald-600/40 hover:bg-emerald-900/50'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
              title="Select folder for saving Excel files"
            >
              <Folder className="w-3.5 h-3.5 text-blue-400" />
              <span className="max-w-[120px] truncate hidden sm:inline">
                {selectedFolder ? selectedFolder.name : 'Select Folder'}
              </span>
            </button>

            {/* Quick Demo */}
            <button
              onClick={onLoadFullDemo}
              className="px-3 py-1.5 bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 hover:text-white text-xs font-semibold rounded-lg border border-blue-500/40 transition-colors flex items-center space-x-1.5"
              title="Load full demonstration data"
            >
              <Sparkles className="w-3.5 h-3.5 text-blue-400" />
              <span className="hidden sm:inline">Load Demo</span>
            </button>

            {/* Shareable HTML Tool for Offline/Colleagues */}
            <a
              href="/tds-challan-reconciliation-standalone.html"
              download="TDS_Challan_SAP_Reconciliation_Offline_Tool.html"
              className="px-2.5 py-1.5 text-xs font-semibold text-emerald-300 hover:text-white bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-800/60 hover:border-emerald-700 rounded-lg transition-colors flex items-center space-x-1.5 shadow-xs"
              title="Download standalone single-file HTML to email or share with others"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Shareable HTML</span>
            </a>

            {/* Project ZIP for GitHub Upload */}
            <div className="flex items-center space-x-1">
              <button
                onClick={handleProgrammaticDownload}
                disabled={isDownloading}
                className="px-2.5 py-1.5 text-xs font-semibold text-purple-300 hover:text-white bg-purple-950/40 hover:bg-purple-900/60 border border-purple-800/60 hover:border-purple-700 rounded-lg transition-colors flex items-center space-x-1.5 shadow-xs"
                title="Download clean project folder (.zip) to upload to GitHub"
              >
                {isDownloading ? (
                  <RefreshCw className="w-3.5 h-3.5 text-purple-400 animate-spin" />
                ) : (
                  <Github className="w-3.5 h-3.5 text-purple-400" />
                )}
                <span className="hidden sm:inline">
                  {isDownloading ? 'Downloading...' : 'GitHub Zip'}
                </span>
              </button>
              <button
                onClick={() => setShowZipModal(true)}
                className="p-1.5 text-purple-400 hover:text-white hover:bg-purple-900/40 rounded-lg transition-colors"
                title="Open GitHub Zip links & upload instructions"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Reset All Data */}
            {(challansCount > 0 || sapCount > 0) && (
              <button
                onClick={onResetAll}
                className="px-2.5 py-1.5 text-xs font-semibold text-rose-300 hover:text-white bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/60 hover:border-rose-700 rounded-lg transition-colors flex items-center space-x-1.5 shadow-xs"
                title="Reset all extracted challans and SAP records"
              >
                <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
                <span className="hidden sm:inline">Reset All Data</span>
                <span className="sm:hidden">Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Mobile Nav Tabs */}
        <div className="flex md:hidden items-center justify-around py-2 border-t border-slate-800 text-xs">
          <button
            onClick={() => setActiveTab('challans')}
            className={`py-1 px-2.5 rounded font-semibold ${
              activeTab === 'challans' ? 'bg-blue-600 text-white' : 'text-slate-400'
            }`}
          >
            Challans ({challansCount})
          </button>
          <button
            onClick={() => setActiveTab('sap')}
            className={`py-1 px-2.5 rounded font-semibold ${
              activeTab === 'sap' ? 'bg-emerald-600 text-white' : 'text-slate-400'
            }`}
          >
            SAP ({sapCount})
          </button>
          <button
            onClick={() => setActiveTab('reconciliation')}
            className={`py-1 px-2.5 rounded font-semibold ${
              activeTab === 'reconciliation' ? 'bg-indigo-600 text-white' : 'text-slate-400'
            }`}
          >
            Reconciliation
          </button>
        </div>
      </div>

      {/* GitHub Zip Download & Upload Instructions Modal */}
      {showZipModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs text-slate-900">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 relative animate-in zoom-in-95 duration-150">
            <button
              onClick={() => setShowZipModal(false)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-3 mb-4">
              <div className="p-3 bg-purple-100 text-purple-700 rounded-xl">
                <Github className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Download Project for GitHub Upload
                </h3>
                <p className="text-xs text-slate-500">
                  Clean package without node_modules • Ready for your GitHub Fork
                </p>
              </div>
            </div>

            {/* Direct One-Click Download */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 mb-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-800">
                  📦 tds-challan-extractor.zip (~67 KB)
                </span>
                <span className="text-[11px] text-emerald-600 font-semibold flex items-center space-x-1">
                  <Check className="w-3.5 h-3.5" />
                  <span>Ready</span>
                </span>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  onClick={handleProgrammaticDownload}
                  disabled={isDownloading}
                  className="flex-1 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center space-x-2"
                >
                  {isDownloading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  <span>{isDownloading ? 'Downloading...' : 'Click to Download ZIP'}</span>
                </button>

                <a
                  href="/api/download-zip"
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center space-x-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open in New Tab</span>
                </a>
              </div>

              {/* Direct Link Copy */}
              <div className="pt-2 border-t border-slate-200 flex items-center justify-between gap-2">
                <span className="text-[11px] text-slate-500 font-mono truncate max-w-[280px]">
                  {directDownloadUrl}
                </span>
                <button
                  onClick={handleCopyLink}
                  className="px-2.5 py-1 text-[11px] font-semibold text-purple-700 hover:bg-purple-50 border border-purple-200 rounded-lg transition-colors flex items-center space-x-1 flex-shrink-0"
                >
                  {copiedLink ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedLink ? 'Copied!' : 'Copy Link'}</span>
                </button>
              </div>
            </div>

            {/* Quick 3-Step Reminder */}
            <div className="space-y-2 text-xs text-slate-600">
              <h4 className="font-bold text-slate-800 uppercase text-[10px] tracking-wider">
                Next steps on GitHub:
              </h4>
              <ol className="list-decimal list-inside space-y-1 text-[11px] pl-1">
                <li>Extract <code className="bg-slate-100 px-1 py-0.5 rounded">tds-challan-extractor.zip</code> to a folder.</li>
                <li>Go to your GitHub Fork &rarr; Click <strong>Add file</strong> &rarr; <strong>Upload files</strong>.</li>
                <li>Drag and drop the unzipped folder into GitHub and click <strong>Commit changes</strong>.</li>
              </ol>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
