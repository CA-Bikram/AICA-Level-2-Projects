import React, { useState } from 'react';
import { Folder, FolderCheck, CheckCircle2, HardDrive, Info, AlertTriangle, X } from 'lucide-react';
import { SelectedFolderInfo } from '../types/tds';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  selectedFolder: SelectedFolderInfo | null;
  onSelectFolder: (folder: SelectedFolderInfo) => void;
}

export const FolderSelectorModal: React.FC<Props> = ({
  isOpen,
  onClose,
  selectedFolder,
  onSelectFolder,
}) => {
  const [customPath, setCustomPath] = useState(
    selectedFolder?.name || 'TDS_Reconciliation_Reports'
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPicking, setIsPicking] = useState(false);

  if (!isOpen) return null;

  const hasFileSystemAccess = typeof window !== 'undefined' && 'showDirectoryPicker' in window;

  const handlePickDirectoryNative = async () => {
    setIsPicking(true);
    setErrorMsg(null);
    try {
      if (!hasFileSystemAccess) {
        throw new Error('File System Access API is not supported in this browser version.');
      }

      // Open native OS directory picker dialog
      const dirHandle = await (window as any).showDirectoryPicker({
        mode: 'readwrite',
      });

      // Verify readwrite permission
      const options = { mode: 'readwrite' };
      if ((await dirHandle.queryPermission(options)) !== 'granted') {
        const status = await dirHandle.requestPermission(options);
        if (status !== 'granted') {
          throw new Error('Write permission was not granted for the selected folder.');
        }
      }

      const folderInfo: SelectedFolderInfo = {
        name: dirHandle.name,
        handle: dirHandle,
        pathDescription: `Local Directory: ${dirHandle.name}`,
        isWritable: true,
      };

      onSelectFolder(folderInfo);
      onClose();
    } catch (err: any) {
      if (err.name === 'AbortError') {
        // User cancelled picker
        return;
      }
      console.warn('Native folder selection fallback:', err);
      setErrorMsg(
        err.message || 'Could not access local folder. You can configure a designated folder name below.'
      );
    } finally {
      setIsPicking(false);
    }
  };

  const handleSaveCustomPath = () => {
    const trimmed = customPath.trim();
    if (!trimmed) {
      setErrorMsg('Please enter a valid folder name or destination path.');
      return;
    }

    const folderInfo: SelectedFolderInfo = {
      name: trimmed,
      handle: null,
      pathDescription: `Designated Folder: ${trimmed} (Browser Downloads)`,
      isWritable: true,
    };

    onSelectFolder(folderInfo);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-slate-900 px-6 py-5 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-blue-600/30 text-blue-400 rounded-xl border border-blue-500/30">
              <Folder className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-semibold text-lg text-white">Select Output Folder</h3>
              <p className="text-xs text-slate-300">
                Choose where the TDS Challan Summary and Reconciliation files will be saved
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {selectedFolder && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <FolderCheck className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                <div>
                  <p className="text-xs font-medium text-emerald-800 uppercase tracking-wider">
                    Currently Selected Output Folder
                  </p>
                  <p className="text-sm font-semibold text-emerald-950 font-mono">
                    {selectedFolder.name}
                  </p>
                </div>
              </div>
              <span className="text-xs px-2.5 py-1 bg-emerald-200/60 text-emerald-800 rounded-full font-medium">
                {selectedFolder.handle ? 'Native Direct Write' : 'Designated Path'}
              </span>
            </div>
          )}

          {/* Option 1: Native Folder Picker */}
          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 hover:bg-slate-50 transition-colors">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <HardDrive className="w-4 h-4 text-blue-600" />
                  <h4 className="text-sm font-semibold text-slate-900">
                    Browse Computer Folder (Direct Save)
                  </h4>
                </div>
                <p className="text-xs text-slate-500">
                  Directly writes generated Excel files into your chosen local directory on your PC/Mac.
                </p>
              </div>
              <button
                type="button"
                onClick={handlePickDirectoryNative}
                disabled={isPicking}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-all flex items-center space-x-1.5 flex-shrink-0 disabled:opacity-50"
              >
                <Folder className="w-4 h-4" />
                <span>{isPicking ? 'Selecting...' : 'Browse Folder'}</span>
              </button>
            </div>
          </div>

          {/* Option 2: Folder Name / Path Input */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider block">
              Or Specify Folder Name / Audit Directory
            </label>
            <div className="flex space-x-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={customPath}
                  onChange={(e) => setCustomPath(e.target.value)}
                  placeholder="e.g. TDS_Challans_FY2025-26"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <button
                type="button"
                onClick={handleSaveCustomPath}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-lg transition-colors flex-shrink-0"
              >
                Set Folder
              </button>
            </div>
            <p className="text-xs text-slate-400">
              When exporting, Excel files will be titled for this folder and saved via automatic browser download.
            </p>
          </div>

          {errorMsg && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start space-x-2.5 text-xs text-amber-800">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Notice: </span>
                {errorMsg}
              </div>
            </div>
          )}

          {/* Quick presets */}
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Quick Folder Presets:
            </span>
            <div className="flex flex-wrap gap-2 mt-1.5">
              {[
                'TDS_Summary_Q3_2025',
                'TDS_Challans_FY25-26',
                'SAP_TDS_Reconciliation',
                'Tax_Audit_2026',
              ].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setCustomPath(preset)}
                  className="text-xs px-2.5 py-1 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-600 rounded-md border border-slate-200 transition-colors"
                >
                  📁 {preset}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSaveCustomPath}
            className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors flex items-center space-x-1.5"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Confirm Output Folder</span>
          </button>
        </div>
      </div>
    </div>
  );
};
