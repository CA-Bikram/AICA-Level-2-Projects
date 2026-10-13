/**
 * Excel / CSV Import Modal with Independent Row Validation
 */

import React, { useState } from 'react';
import { X, Upload, FileSpreadsheet, AlertTriangle, CheckCircle2, XCircle, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { api } from '../../services/api';

interface Props {
  type: 'EMPLOYEE' | 'ATTENDANCE';
  payrollMonth?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const ImportModal: React.FC<Props> = ({ type, payrollMonth = new Date().toISOString().slice(0, 7), onClose, onSuccess }) => {
  const [empMode, setEmpMode] = useState<'SIMPLE' | 'DETAILED'>('SIMPLE');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<{
    total: number;
    valid: number;
    warnings: number;
    errors: number;
    details: Array<{ row: number; status: 'VALID' | 'WARNING' | 'ERROR'; message: string }>;
  } | null>(null);
  const [parsedRows, setParsedRows] = useState<any[]>([]);

  // Generate and download sample template
  const downloadSampleTemplate = async () => {
    const wb = XLSX.utils.book_new();

    if (type === 'EMPLOYEE') {
      let data: any[] = [];
      if (empMode === 'SIMPLE') {
        data = [
          ['Employee ID', 'Name', 'PAN', 'Date of Joining', 'Monthly Gross Salary', 'Department', 'Designation', 'State', 'Bank Name', 'Account Number', 'IFSC', 'UAN', 'ESIC Number'],
          ['EMP101', 'Arjun Kapoor', 'ABCDE1111A', '2024-05-01', 25000, 'Marketing', 'Executive', 'Maharashtra', 'HDFC Bank', '1234567890', 'HDFC0001234', '100111222333', '31001112223334445'],
          ['EMP102', 'Sunita Rao', 'ABCDE2222B', '2024-06-15', 45000, 'Operations', 'Lead', 'Karnataka', 'ICICI Bank', '9876543210', 'ICIC0005678', '100444555666', ''],
          ['EMP103', 'Rohan Mehta', 'ABCDE3333C', '2023-01-10', 120000, 'Engineering', 'Manager', 'Maharashtra', 'Axis Bank', '1122334455', 'UTIB0001234', '100777888999', '']
        ];
      } else {
        data = [
          ['Employee ID', 'Name', 'PAN', 'Date of Joining', 'Basic', 'DA', 'HRA', 'Conveyance', 'Medical', 'Special Allowance', 'Department', 'Designation', 'State', 'Bank Name', 'Account Number', 'IFSC', 'UAN', 'ESIC Number'],
          ['EMP101', 'Arjun Kapoor', 'ABCDE1111A', '2024-05-01', 11250, 1250, 5000, 1600, 1250, 4650, 'Marketing', 'Executive', 'Maharashtra', 'HDFC Bank', '1234567890', 'HDFC0001234', '100111222333', '31001112223334445'],
          ['EMP102', 'Sunita Rao', 'ABCDE2222B', '2024-06-15', 20250, 2250, 9000, 2000, 1500, 10000, 'Operations', 'Lead', 'Karnataka', 'ICICI Bank', '9876543210', 'ICIC0005678', '100444555666', '']
        ];
      }
      const ws = XLSX.utils.aoa_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, `Template_${empMode}`);
      XLSX.writeFile(wb, `Employee_Import_Template_${empMode}.xlsx`);
    } else {
      // Attendance template for this month: one row per employee in service, weekends as WO.
      // Days before joining / after leaving are left blank.
      const [yy, mm] = payrollMonth.split('-').map(v => parseInt(v, 10));
      const days = new Date(yy, mm, 0).getDate();
      const header: any[] = ['Employee ID', 'Employee Name'];
      for (let d = 1; d <= days; d++) header.push(`Day ${d}`);
      header.push('OT Amount', 'Bonus', 'Remarks');

      const list = await api.getAttendance(payrollMonth).catch(() => []);
      const rows: any[][] = list.map((emp: any) => {
        const row: any[] = [emp.employee_id, emp.employee_name];
        for (let d = 1; d <= days; d++) {
          if (d < (emp.from_day ?? 1) || d > (emp.to_day ?? days)) {
            row.push('');
          } else {
            const dow = new Date(yy, mm - 1, d).getDay();
            row.push(dow === 0 || dow === 6 ? 'WO' : 'P');
          }
        }
        row.push(0, 0, '');
        return row;
      });

      const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
      XLSX.utils.book_append_sheet(wb, ws, 'Attendance');
      XLSX.writeFile(wb, `Attendance_Import_Template_${payrollMonth}.xlsx`);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    setLoading(true);
    setReport(null);

    try {
      const buffer = await uploadedFile.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const firstSheetName = wb.SheetNames[0];
      const sheet = wb.Sheets[firstSheetName];
      const rows: any[] = XLSX.utils.sheet_to_json(sheet);

      setParsedRows(rows);

      // Perform validation via backend API
      if (type === 'EMPLOYEE') {
        const res = await api.bulkImportEmployees(rows, empMode);
        setReport(res);
      } else {
        const res = await api.bulkImportAttendance(payrollMonth, rows);
        setReport(res);
      }
    } catch (err: any) {
      alert(`Error parsing Excel: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">
                {type === 'EMPLOYEE' ? 'Import Employees from Excel' : `Import Attendance for ${payrollMonth}`}
              </h3>
              <p className="text-xs text-slate-300">
                Independent row validation with error isolation
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          
          {/* Mode Selector for Employee */}
          {type === 'EMPLOYEE' && (
            <div className="flex items-center gap-4 p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <span className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Import Format:</span>
              <label className="flex items-center gap-2 text-sm text-slate-800 cursor-pointer">
                <input
                  type="radio"
                  name="import_mode"
                  checked={empMode === 'SIMPLE'}
                  onChange={() => setEmpMode('SIMPLE')}
                  className="text-emerald-600 focus:ring-emerald-500"
                />
                <span className="font-medium">Simple (Gross Salary only)</span>
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-800 cursor-pointer">
                <input
                  type="radio"
                  name="import_mode"
                  checked={empMode === 'DETAILED'}
                  onChange={() => setEmpMode('DETAILED')}
                  className="text-emerald-600 focus:ring-emerald-500"
                />
                <span className="font-medium">Detailed (Basic, DA, HRA, Allowances)</span>
              </label>
            </div>
          )}

          {/* Template Download Button */}
          <div className="flex justify-between items-center bg-blue-50/70 border border-blue-200 rounded-lg p-3 text-xs text-blue-900">
            <div>
              <span className="font-semibold">Need a ready-to-use spreadsheet template?</span>
              <p className="text-blue-700">{type === 'ATTENDANCE' ? 'Download an Excel file listing every employee in service this month.' : 'Download formatted Excel file with sample columns and data.'}</p>
            </div>
            <button
              onClick={downloadSampleTemplate}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 transition"
            >
              <Download className="w-3.5 h-3.5" />
              Download Template
            </button>
          </div>

          {/* Dropzone */}
          <label className="border-2 border-dashed border-slate-300 hover:border-emerald-500 bg-slate-50 hover:bg-emerald-50/30 rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition text-center">
            <Upload className="w-8 h-8 text-slate-400 mb-2" />
            <span className="text-sm font-semibold text-slate-800">
              {file ? file.name : 'Click to select Excel (.xlsx, .xls, .csv) file'}
            </span>
            <span className="text-xs text-slate-500 mt-1">
              Supports XLSX, XLS, and CSV spreadsheets
            </span>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleFileUpload}
            />
          </label>

          {loading && (
            <div className="text-center py-4 text-sm text-slate-600 animate-pulse">
              Parsing and validating spreadsheet rows...
            </div>
          )}

          {/* Validation Report */}
          {report && (
            <div className="space-y-4">
              <h4 className="font-semibold text-slate-900 text-sm">Row Validation Summary</h4>
              
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="p-3 bg-slate-100 rounded-lg border border-slate-200">
                  <div className="text-xs text-slate-500 font-medium">Total Rows</div>
                  <div className="text-lg font-bold text-slate-900">{report.total}</div>
                </div>
                <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                  <div className="text-xs text-emerald-700 font-medium">Valid Rows</div>
                  <div className="text-lg font-bold text-emerald-700">{report.valid}</div>
                </div>
                <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                  <div className="text-xs text-amber-700 font-medium">Warnings</div>
                  <div className="text-lg font-bold text-amber-700">{report.warnings}</div>
                </div>
                <div className="p-3 bg-rose-50 rounded-lg border border-rose-200">
                  <div className="text-xs text-rose-700 font-medium">Error Rows</div>
                  <div className="text-lg font-bold text-rose-700">{report.errors}</div>
                </div>
              </div>

              {/* Detailed row statuses */}
              <div className="border border-slate-200 rounded-lg max-h-48 overflow-y-auto divide-y divide-slate-100 text-xs">
                {report.details.map((d, idx) => (
                  <div key={idx} className="p-2.5 flex items-start gap-2">
                    {d.status === 'VALID' && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />}
                    {d.status === 'WARNING' && <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />}
                    {d.status === 'ERROR' && <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />}
                    <div>
                      <span className="font-semibold text-slate-800">Row {d.row}:</span>{' '}
                      <span className={d.status === 'ERROR' ? 'text-rose-700 font-medium' : d.status === 'WARNING' ? 'text-amber-800' : 'text-slate-600'}>
                        {d.message}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

            </div>
          )}

        </div>

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex justify-between items-center">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-100 transition"
          >
            Cancel
          </button>

          {report && (
            <button
              onClick={() => {
                onSuccess();
                onClose();
              }}
              className="px-5 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition"
            >
              Done (Imported {report.valid + report.warnings} Records)
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
