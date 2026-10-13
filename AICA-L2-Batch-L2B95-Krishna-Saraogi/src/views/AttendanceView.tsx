/**
 * OneHR Payroll Manager - Monthly Attendance Grid View
 * Interactive 1..31 day cell-level editing, auto calculations & Excel import
 */

import React, { useState } from 'react';
import {
  CalendarCheck,
  Upload,
  Save,
  CheckCircle2,
  Calendar,
  Layers,
  Sparkles,
  Info,
  Clock,
  Award
} from 'lucide-react';
import { AttendanceCode } from '../types/payroll';
import {
  calculateAttendanceSummary
} from '../services/payrollEngine';
import {
  formatIndianCurrency,
  getDaysInPayrollMonth,
  formatPayrollMonth
} from '../utils/indianNumber';
import { ImportModal } from '../components/modals/ImportModal';
import { api } from '../services/api';

interface AttendanceRow {
  employee_id: string;
  employee_name: string;
  department: string;
  designation: string;
  payroll_month: string;
  days_map: Record<number, AttendanceCode>;
  overtime_amount: number;
  bonus_amount: number;
  remarks?: string;
  present_days: number;
  half_days: number;
  paid_leaves: number;
  weekly_offs: number;
  public_holidays: number;
  lop_days: number;
  days_payable: number;
  has_record?: boolean;  // false until attendance is marked or uploaded
  from_day?: number;     // service window within the month (joiners / leavers)
  to_day?: number;
}

interface Props {
  currentMonth: string;
  attendanceList: AttendanceRow[];
  onRefresh: () => void;
}

const ATTENDANCE_CODES: Array<{ code: AttendanceCode; label: string; bg: string; text: string }> = [
  { code: 'P', label: 'Present (1.0)', bg: 'bg-emerald-100', text: 'text-emerald-800' },
  { code: 'A', label: 'Absent (0.0)', bg: 'bg-rose-100', text: 'text-rose-800' },
  { code: 'HD', label: 'Half Day (0.5)', bg: 'bg-amber-100', text: 'text-amber-800' },
  { code: 'WO', label: 'Weekly Off (1.0)', bg: 'bg-blue-100', text: 'text-blue-800' },
  { code: 'PH', label: 'Public Holiday (1.0)', bg: 'bg-purple-100', text: 'text-purple-800' },
  { code: 'CL', label: 'Casual Leave (1.0)', bg: 'bg-teal-100', text: 'text-teal-800' },
  { code: 'SL', label: 'Sick Leave (1.0)', bg: 'bg-indigo-100', text: 'text-indigo-800' },
  { code: 'EL', label: 'Earned Leave (1.0)', bg: 'bg-cyan-100', text: 'text-cyan-800' },
  { code: 'LOP', label: 'Loss of Pay (0.0)', bg: 'bg-red-200', text: 'text-red-900' },
  { code: 'OD', label: 'On Duty (1.0)', bg: 'bg-emerald-200', text: 'text-emerald-950' },
];

export const AttendanceView: React.FC<Props> = ({ currentMonth, attendanceList, onRefresh }) => {
  const [gridData, setGridData] = useState<AttendanceRow[]>(attendanceList);
  const [selectedCell, setSelectedCell] = useState<{ empId: string; day: number } | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Sync state when props change
  React.useEffect(() => {
    setGridData(attendanceList);
    setHasChanges(false);
  }, [attendanceList]);

  const daysInMonth = getDaysInPayrollMonth(currentMonth);

  // Calculate calendar & working days
  const [yStr, mStr] = currentMonth.split('-');
  const year = parseInt(yStr, 10);
  const month = parseInt(mStr, 10);

  let weekendCount = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const dayOfWeek = new Date(year, month - 1, d).getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) weekendCount++;
  }
  const publicHolidaysCount = 1; // e.g. Dr Ambedkar Jayanti / Good Friday
  const workingDaysCount = daysInMonth - weekendCount - publicHolidaysCount;

  // Direct cell editing: cycle or change code
  const handleCellCodeChange = (empId: string, day: number, newCode: AttendanceCode) => {
    setGridData(prev =>
      prev.map(row => {
        if (row.employee_id !== empId) return row;
        const updatedDays = { ...row.days_map, [day]: newCode };
        const summary = calculateAttendanceSummary(updatedDays, daysInMonth, row.from_day ?? 1, row.to_day ?? daysInMonth);
        return {
          ...row,
          days_map: updatedDays,
          has_record: true,
          ...summary
        };
      })
    );
    setHasChanges(true);
    setSelectedCell(null);
  };

  // Cycle code on direct click
  const handleCellClick = (empId: string, day: number, currentCode: AttendanceCode) => {
    const cycle: AttendanceCode[] = ['P', 'WO', 'HD', 'A', 'LOP', 'CL', 'PH', 'OD'];
    const nextIdx = (cycle.indexOf(currentCode) + 1) % cycle.length;
    handleCellCodeChange(empId, day, cycle[nextIdx]);
  };

  // Update OT / Bonus
  const handleAmountChange = (empId: string, field: 'overtime_amount' | 'bonus_amount', val: number) => {
    setGridData(prev =>
      prev.map(row => {
        if (row.employee_id !== empId) return row;
        return { ...row, [field]: Math.max(0, val) };
      })
    );
    setHasChanges(true);
  };

  // Bulk actions
  const handleMarkAllPresent = () => {
    setGridData(prev =>
      prev.map(row => {
        const updatedDays: Record<number, AttendanceCode> = {};
        for (let d = 1; d <= daysInMonth; d++) {
          const dayOfWeek = new Date(year, month - 1, d).getDay();
          updatedDays[d] = (dayOfWeek === 0 || dayOfWeek === 6) ? 'WO' : 'P';
        }
        const summary = calculateAttendanceSummary(updatedDays, daysInMonth, row.from_day ?? 1, row.to_day ?? daysInMonth);
        return { ...row, days_map: updatedDays, has_record: true, ...summary };
      })
    );
    setHasChanges(true);
  };

  const handleMarkWeeklyOffs = () => {
    setGridData(prev =>
      prev.map(row => {
        const updatedDays = { ...row.days_map };
        for (let d = 1; d <= daysInMonth; d++) {
          const dayOfWeek = new Date(year, month - 1, d).getDay();
          if (dayOfWeek === 0 || dayOfWeek === 6) {
            updatedDays[d] = 'WO';
          }
        }
        const summary = calculateAttendanceSummary(updatedDays, daysInMonth, row.from_day ?? 1, row.to_day ?? daysInMonth);
        return { ...row, days_map: updatedDays, has_record: true, ...summary };
      })
    );
    setHasChanges(true);
  };

  const handleCopyPrevDay = (day: number) => {
    if (day <= 1) return;
    setGridData(prev =>
      prev.map(row => {
        const updatedDays = { ...row.days_map, [day]: row.days_map[day - 1] || 'P' };
        const summary = calculateAttendanceSummary(updatedDays, daysInMonth, row.from_day ?? 1, row.to_day ?? daysInMonth);
        return { ...row, days_map: updatedDays, has_record: true, ...summary };
      })
    );
    setHasChanges(true);
  };

  // Save all changes to SQLite backend
  const handleSaveChanges = async () => {
    setSaving(true);
    try {
      for (const row of gridData) {
        if (row.has_record === false) continue; // not marked yet - leave it pending
        await api.updateAttendance({
          employee_id: row.employee_id,
          payroll_month: currentMonth,
          days_map: row.days_map,
          overtime_amount: row.overtime_amount,
          bonus_amount: row.bonus_amount,
          remarks: row.remarks
        });
      }
      setHasChanges(false);
      onRefresh();
    } catch (err: any) {
      alert(`Save error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const getCodeStyle = (code: AttendanceCode) => {
    switch (code) {
      case 'P':
      case 'OD':
        return 'bg-emerald-100 text-emerald-900 border-emerald-300 font-bold';
      case 'WO':
        return 'bg-blue-100 text-blue-900 border-blue-200 font-bold';
      case 'PH':
        return 'bg-purple-100 text-purple-900 border-purple-200 font-bold';
      case 'HD':
        return 'bg-amber-100 text-amber-900 border-amber-300 font-bold';
      case 'A':
      case 'LOP':
        return 'bg-rose-100 text-rose-900 border-rose-300 font-bold';
      case 'CL':
      case 'SL':
      case 'EL':
        return 'bg-teal-100 text-teal-900 border-teal-200 font-bold';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200/90 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900">
              Monthly Attendance Grid • {formatPayrollMonth(currentMonth)}
            </h2>
            {hasChanges && (
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 animate-pulse">
                Unsaved Changes
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Click any cell to toggle code, or use quick bulk updates. Prorates fixed salary automatically.
          </p>
          {gridData.some(r => r.has_record === false) && (
            <p className="text-xs font-semibold text-amber-700 mt-1">
              Attendance pending for {gridData.filter(r => r.has_record === false).length} of {gridData.length} employees. Import the month's Excel file or mark the grid.
            </p>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold border border-slate-200 transition"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import Attendance Excel</span>
          </button>

          <button
            onClick={handleSaveChanges}
            disabled={saving || !hasChanges}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition ${
              hasChanges
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
            }`}
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving...' : 'Save Attendance'}</span>
          </button>
        </div>
      </div>

      {/* Month Metrics KPI Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-slate-500 font-medium">Calendar Days</span>
            <div className="text-lg font-black text-slate-900">{daysInMonth} Days</div>
          </div>
          <Calendar className="w-5 h-5 text-slate-400" />
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-slate-500 font-medium">Working Days</span>
            <div className="text-lg font-black text-emerald-700">{workingDaysCount} Days</div>
          </div>
          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-slate-500 font-medium">Weekly Offs</span>
            <div className="text-lg font-black text-blue-700">{weekendCount} Days</div>
          </div>
          <Layers className="w-5 h-5 text-blue-500" />
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-slate-500 font-medium">Public Holidays</span>
            <div className="text-lg font-black text-purple-700">{publicHolidaysCount} Day</div>
          </div>
          <Award className="w-5 h-5 text-purple-500" />
        </div>
      </div>

      {/* Legend & Quick Bulk Actions Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-xs space-y-3">
        
        {/* Attendance Codes Legend */}
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <span className="font-semibold text-slate-700 mr-1">Codes:</span>
          {ATTENDANCE_CODES.map(c => (
            <span
              key={c.code}
              className={`px-2 py-0.5 rounded-md font-semibold border ${getCodeStyle(c.code)}`}
              title={c.label}
            >
              {c.code}: {c.label.split(' ')[0]}
            </span>
          ))}
        </div>

        {/* Bulk Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs">
          <span className="font-semibold text-slate-700 mr-1">Quick Bulk Actions:</span>
          
          <button
            onClick={handleMarkAllPresent}
            className="px-2.5 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-md font-medium border border-emerald-200 transition"
          >
            Mark All Standard Present (with WOs)
          </button>

          <button
            onClick={handleMarkWeeklyOffs}
            className="px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-md font-medium border border-blue-200 transition"
          >
            Detect & Mark Weekend Offs
          </button>

          <div className="text-[11px] text-slate-400 italic ml-auto">
            Tip: Click cell to toggle code, or right click / hold for full code picker
          </div>
        </div>

      </div>

      {/* Monthly Interactive Attendance Grid */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="overflow-x-auto max-h-[600px]">
          <table className="w-full text-center text-xs border-collapse">
            
            {/* Header: Employee + Days 1..31 + Summary Columns */}
            <thead className="bg-slate-900 text-white font-semibold sticky top-0 z-10 select-none">
              <tr>
                <th className="py-3 px-3 text-left sticky left-0 bg-slate-900 z-20 w-44 min-w-44 border-r border-slate-800">
                  Employee
                </th>

                {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                  const dayOfWeek = new Date(year, month - 1, day).getDay();
                  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                  return (
                    <th
                      key={day}
                      className={`py-2 px-1 min-w-[32px] border-r border-slate-800/60 ${isWeekend ? 'bg-slate-800 text-amber-300' : ''}`}
                    >
                      <div>{day}</div>
                      <div className="text-[9px] font-normal opacity-70">
                        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'][dayOfWeek]}
                      </div>
                    </th>
                  );
                })}

                <th className="py-3 px-3 bg-emerald-950 text-emerald-300 min-w-[70px] border-r border-slate-800">
                  Payable
                </th>
                <th className="py-3 px-2 bg-slate-900 text-slate-200 min-w-[80px] border-r border-slate-800">
                  OT (₹)
                </th>
                <th className="py-3 px-2 bg-slate-900 text-slate-200 min-w-[80px]">
                  Bonus (₹)
                </th>
              </tr>
            </thead>

            {/* Grid Body */}
            <tbody className="divide-y divide-slate-100">
              {gridData.map(row => (
                <tr key={row.employee_id} className="hover:bg-slate-50/80 transition">
                  
                  {/* Sticky Employee Name & ID */}
                  <td className="py-2.5 px-3 text-left sticky left-0 bg-white hover:bg-slate-50 z-10 border-r border-slate-200">
                    <div className="font-bold text-slate-900 truncate max-w-[150px]">{row.employee_name}</div>
                    <div className="text-[10px] text-slate-500 font-mono">{row.employee_id} • {row.department}</div>
                  </td>

                  {/* Days 1..31 cells */}
                  {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                    // Outside the service window (before joining / after leaving): nothing to mark
                    if (day < (row.from_day ?? 1) || day > (row.to_day ?? daysInMonth)) {
                      return (
                        <td key={day} className="py-1 px-0.5 border-r border-slate-100" title={`Day ${day}: not in service`}>
                          <div className="w-7 h-7 mx-auto rounded flex items-center justify-center text-[11px] text-slate-300 bg-slate-50 border border-dashed border-slate-200">–</div>
                        </td>
                      );
                    }
                    const isPending = row.has_record === false && !row.days_map[day];
                    const code = row.days_map[day] || 'P';
                    const isSelected = selectedCell?.empId === row.employee_id && selectedCell?.day === day;

                    return (
                      <td
                        key={day}
                        onClick={() => handleCellClick(row.employee_id, day, code)}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setSelectedCell({ empId: row.employee_id, day });
                        }}
                        className="py-1 px-0.5 border-r border-slate-100 cursor-pointer relative"
                        title={`Day ${day}: ${code} (Click to toggle, right-click to choose)`}
                      >
                        <div
                          className={`w-7 h-7 mx-auto rounded flex items-center justify-center text-[11px] border transition-transform hover:scale-105 active:scale-95 ${isPending ? 'bg-white text-slate-300 border-slate-200' : getCodeStyle(code)}`}
                        >
                          {isPending ? '·' : code}
                        </div>

                        {/* Cell Code Picker Popup on Right Click / Selection */}
                        {isSelected && (
                          <div
                            className="absolute top-8 left-0 z-30 bg-white border border-slate-300 shadow-xl rounded-lg p-1.5 grid grid-cols-5 gap-1 w-44 animate-in fade-in"
                            onClick={e => e.stopPropagation()}
                          >
                            {ATTENDANCE_CODES.map(c => (
                              <button
                                key={c.code}
                                onClick={() => handleCellCodeChange(row.employee_id, day, c.code)}
                                className={`text-[10px] font-bold py-1 rounded border ${getCodeStyle(c.code)}`}
                              >
                                {c.code}
                              </button>
                            ))}
                          </div>
                        )}
                      </td>
                    );
                  })}

                  {/* Calculated Days Payable */}
                  <td className="py-2 px-2 border-r border-slate-200 bg-emerald-50/60 font-mono font-bold text-emerald-900 text-xs">
                    {row.has_record === false ? 'Pending' : `${row.days_payable} / ${daysInMonth}`}
                  </td>

                  {/* Overtime Amount Input */}
                  <td className="py-2 px-1 border-r border-slate-200">
                    <input
                      type="number"
                      min={0}
                      value={row.overtime_amount || ''}
                      onChange={e => handleAmountChange(row.employee_id, 'overtime_amount', Number(e.target.value))}
                      placeholder="0"
                      className="w-full text-right px-1.5 py-1 border border-slate-200 rounded text-xs font-semibold text-slate-800 focus:outline-emerald-500"
                    />
                  </td>

                  {/* Bonus Amount Input */}
                  <td className="py-2 px-1">
                    <input
                      type="number"
                      min={0}
                      value={row.bonus_amount || ''}
                      onChange={e => handleAmountChange(row.employee_id, 'bonus_amount', Number(e.target.value))}
                      placeholder="0"
                      className="w-full text-right px-1.5 py-1 border border-slate-200 rounded text-xs font-semibold text-slate-800 focus:outline-emerald-500"
                    />
                  </td>

                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Attendance Import Modal */}
      {isImportModalOpen && (
        <ImportModal
          type="ATTENDANCE"
          payrollMonth={currentMonth}
          onClose={() => setIsImportModalOpen(false)}
          onSuccess={onRefresh}
        />
      )}

    </div>
  );
};
