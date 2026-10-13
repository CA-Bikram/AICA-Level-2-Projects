/**
 * OneHR Payroll Manager - Executive Dashboard View
 * Premium financial charts, KPIs, and distribution analytics
 */

import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import {
  Users,
  Wallet,
  TrendingUp,
  Receipt,
  Building2,
  CalendarCheck,
  ShieldAlert,
  ArrowUpRight,
  ArrowRight
} from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  LineChart,
  Line
} from 'recharts';
import { Company, PayrollRecord, PayrollRun } from '../types/payroll';
import { formatIndianCurrency, formatPayrollMonth } from '../utils/indianNumber';
import { NavModule } from '../components/layout/Sidebar';

interface Props {
  currentMonth: string;
  run: PayrollRun | null;
  records: PayrollRecord[];
  company: Company | null;
  attendanceList: any[];
  onNavigate: (module: NavModule) => void;
}

const COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ec4899', '#06b6d4'];
const DEDUCTION_COLORS = ['#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444'];

export const DashboardView: React.FC<Props> = ({
  currentMonth,
  run,
  records,
  attendanceList,
  onNavigate
}) => {
  // Aggregate KPIs
  const totalEmployees = records.length;
  const totalGross = records.reduce((acc, r) => acc + r.gross_earned, 0);
  const totalDeductions = records.reduce((acc, r) => acc + r.total_deductions, 0);
  const totalTakeHome = records.reduce((acc, r) => acc + r.take_home_pay, 0);
  const totalEmployerPF = records.reduce((acc, r) => acc + r.employer_pf, 0);
  const totalEmployerESIC = records.reduce((acc, r) => acc + r.employer_esic, 0);
  const totalGratuity = records.reduce((acc, r) => acc + r.gratuity, 0);
  const totalTDS = records.reduce((acc, r) => acc + r.tds, 0);
  const totalCompanyCost = records.reduce((acc, r) => acc + r.company_cost, 0);

  // Salary Component Distribution
  const componentSum = {
    Basic: records.reduce((acc, r) => acc + r.earned_basic, 0),
    DA: records.reduce((acc, r) => acc + r.earned_da, 0),
    HRA: records.reduce((acc, r) => acc + r.earned_hra, 0),
    Conveyance: records.reduce((acc, r) => acc + r.earned_conveyance, 0),
    Medical: records.reduce((acc, r) => acc + r.earned_medical, 0),
    'Special Allowance': records.reduce((acc, r) => acc + r.earned_special, 0),
  };

  const salaryPieData = Object.entries(componentSum)
    .filter(([_, val]) => val > 0)
    .map(([name, value]) => ({ name, value }));

  // Statutory Deductions breakdown
  const deductionBarData = [
    {
      name: 'Statutory Deductions',
      PF: records.reduce((acc, r) => acc + r.employee_pf, 0),
      ESIC: records.reduce((acc, r) => acc + r.employee_esic, 0),
      'Prof Tax (PT)': records.reduce((acc, r) => acc + r.professional_tax, 0),
      'TDS / IT': records.reduce((acc, r) => acc + r.tds, 0),
    }
  ];

  // Department payroll breakdown
  const deptMap: Record<string, { gross: number; count: number; takeHome: number }> = {};
  records.forEach(r => {
    const dept = r.department || 'General';
    if (!deptMap[dept]) {
      deptMap[dept] = { gross: 0, count: 0, takeHome: 0 };
    }
    deptMap[dept].gross += r.gross_earned;
    deptMap[dept].takeHome += r.take_home_pay;
    deptMap[dept].count += 1;
  });

  const deptChartData = Object.entries(deptMap).map(([dept, data]) => ({
    department: dept,
    'Gross Payroll': data.gross,
    'Take Home': data.takeHome,
    headcount: data.count
  }));

  // Trend: actual processed payroll for each month of FY 2026-27 up to the selected month
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  useEffect(() => {
    api.getPayrollRuns().then(setRuns).catch(() => setRuns([]));
  }, [currentMonth, run?.status, run?.updated_at]);

  const [cy, cm] = currentMonth.split('-').map(v => parseInt(v, 10));
  const fyStart = `${cm >= 4 ? cy : cy - 1}-04`;
  const shortMonth = (m: string) => {
    const [y, mo] = m.split('-').map(v => parseInt(v, 10));
    return `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][mo - 1]}-${String(y).slice(2)}`;
  };
  const monthlyTrendData = runs
    .filter(r => r.payroll_month >= fyStart && r.payroll_month <= currentMonth)
    .sort((a, b) => a.payroll_month.localeCompare(b.payroll_month))
    .map(r => ({
      month: shortMonth(r.payroll_month),
      'Company Cost (CTC)': r.total_company_cost,
      'Gross Payroll': r.total_gross_payroll,
      'Take Home': r.total_take_home
    }));
  const lakh = (v: number) => `₹${(v / 100000).toFixed(v >= 1000000 ? 0 : 1)}L`;

  // Attendance: employee-days for the month, from marked attendance only
  const sumDays = (f: (a: any) => number) => attendanceList.reduce((acc, a) => acc + (f(a) || 0), 0);
  const attendanceBreakdown = [
    { name: 'Present / On duty', value: sumDays(a => a.present_days), color: '#10b981' },
    { name: 'Weekly offs', value: sumDays(a => a.weekly_offs), color: '#3b82f6' },
    { name: 'Public holidays', value: sumDays(a => a.public_holidays), color: '#8b5cf6' },
    { name: 'Paid leave', value: sumDays(a => a.paid_leaves), color: '#f59e0b' },
    { name: 'Half days', value: sumDays(a => a.half_days), color: '#06b6d4' },
    { name: 'Loss of pay / absent', value: sumDays(a => a.lop_days), color: '#ef4444' }
  ];
  const attendanceTotal = attendanceBreakdown.reduce((acc, d) => acc + d.value, 0);
  const attendancePieData = attendanceBreakdown.filter(d => d.value > 0);

  return (
    <div className="space-y-6">
      
      {/* Top Banner / Headline */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white p-6 rounded-2xl shadow-xl shadow-slate-900/10 border border-slate-800">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-semibold mb-2 border border-emerald-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            Tax Year 2026-27 Statutory Payroll Cycle
          </div>
          <h2 className="text-2xl font-black tracking-tight">
            Payroll Overview • {formatPayrollMonth(currentMonth)}
          </h2>
          <p className="text-xs text-slate-300 mt-1 max-w-xl">
            Deterministic calculations with 50% Wage Rule, EPF & EPS capped at ₹1,250, ESIC ₹21,000 threshold, State PT slabs, and TDS under the New Tax Regime (Nil ≤ ₹12,00,000).
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate('processing')}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold rounded-xl text-xs transition shadow-md shadow-emerald-500/20 cursor-pointer"
          >
            <span>Process Payroll</span>
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => onNavigate('results')}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl text-xs transition border border-slate-700 cursor-pointer"
          >
            <span>View Master Register</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Gross Payroll */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-xs hover:shadow-md transition">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold mb-2">
            <span>GROSS PAYROLL</span>
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            {formatIndianCurrency(totalGross)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
            <span>Staff Count: <strong className="text-slate-800">{totalEmployees} Employees</strong></span>
            <span className="text-emerald-600 font-semibold flex items-center">
              Active <ArrowUpRight className="w-3 h-3 ml-0.5" />
            </span>
          </div>
        </div>

        {/* Net Take Home */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-xs hover:shadow-md transition">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold mb-2">
            <span>NET TAKE HOME DISBURSEMENT</span>
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-blue-700 tracking-tight">
            {formatIndianCurrency(totalTakeHome)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
            <span>Statutory Deductions:</span>
            <span className="text-rose-600 font-semibold">{formatIndianCurrency(totalDeductions)}</span>
          </div>
        </div>

        {/* Total Deductions (PF, ESIC, PT, TDS) */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-xs hover:shadow-md transition">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold mb-2">
            <span>STATUTORY REMITTANCES</span>
            <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-600 tracking-tight">
            {formatIndianCurrency(totalDeductions)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
            <span>TDS Withheld:</span>
            <span className="text-slate-800 font-semibold">{formatIndianCurrency(totalTDS)}</span>
          </div>
        </div>

        {/* Total Company Cost (CTC) */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-xs hover:shadow-md transition">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold mb-2">
            <span>TOTAL COMPANY COST (CTC)</span>
            <div className="p-2 rounded-lg bg-purple-50 text-purple-600">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-purple-700 tracking-tight">
            {formatIndianCurrency(totalCompanyCost)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
            <span>Employer Contributions:</span>
            <span className="text-purple-600 font-semibold">
              {formatIndianCurrency(totalEmployerPF + totalEmployerESIC + totalGratuity)}
            </span>
          </div>
        </div>

      </div>

      {/* Main Charts Row 1: Salary Component Doughnut & Statutory Deductions Bar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Doughnut Chart: Salary Components */}
        <div className="bg-white p-6 rounded-xl border border-slate-200/90 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Salary Component Distribution</h3>
              <p className="text-xs text-slate-500">Gross salary composition across all active employees</p>
            </div>
            <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-md">
              {formatIndianCurrency(totalGross)} Total
            </span>
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={salaryPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={85}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {salaryPieData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(val: any) => [formatIndianCurrency(Number(val)), 'Amount']}
                  contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                />
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  iconType="circle"
                  formatter={(value) => <span className="text-xs text-slate-700 font-medium">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Deductions Breakdown Bar Chart */}
        <div className="bg-white p-6 rounded-xl border border-slate-200/90 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Statutory Deductions Breakdown</h3>
              <p className="text-xs text-slate-500">Employee recoveries for EPF, ESIC, PT, and Income Tax TDS</p>
            </div>
            <span className="text-xs font-bold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-md border border-rose-200">
              {formatIndianCurrency(totalDeductions)}
            </span>
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={deductionBarData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v) => `₹${v / 1000}k`} tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(val: any) => [formatIndianCurrency(Number(val)), 'Amount']}
                  contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                />
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  iconType="circle"
                  formatter={(value) => <span className="text-xs text-slate-700 font-medium">{value}</span>}
                />
                <Bar dataKey="PF" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="ESIC" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Prof Tax (PT)" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="TDS / IT" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* Main Charts Row 2: Monthly Trend Line Chart & Department Payroll */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Monthly Trend (Gross vs Take Home vs CTC) */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200/90 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Monthly Payroll Expenditure Trend</h3>
              <p className="text-xs text-slate-500">Processed payroll by month, April 2026 to {formatPayrollMonth(currentMonth)}</p>
            </div>
            <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
              FY 2026-27
            </span>
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyTrendData} margin={{ top: 15, right: 30, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={lakh} tick={{ fontSize: 11 }} domain={[0, 'auto']} />
                <Tooltip
                  formatter={(val: any, name: any) => [formatIndianCurrency(Number(val)), name]}
                  contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                />
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  iconType="circle"
                  formatter={(value) => <span className="text-xs text-slate-700 font-medium">{value}</span>}
                />
                <Line type="monotone" dataKey="Company Cost (CTC)" stroke="#8b5cf6" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="Gross Payroll" stroke="#10b981" strokeWidth={2.5} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="Take Home" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Attendance Distribution Chart */}
        <div className="bg-white p-6 rounded-xl border border-slate-200/90 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Attendance Summary</h3>
              <p className="text-xs text-slate-500">Employee-days by attendance type, {formatPayrollMonth(currentMonth)}</p>
            </div>
            <button
              onClick={() => onNavigate('attendance')}
              className="text-xs text-emerald-600 hover:text-emerald-700 font-semibold flex items-center"
            >
              Grid <ArrowRight className="w-3 h-3 ml-0.5" />
            </button>
          </div>

          {attendanceTotal === 0 ? (
            <div className="h-64 flex items-center justify-center text-xs text-slate-500 text-center px-6">
              Attendance has not been marked or uploaded for {formatPayrollMonth(currentMonth)}.
            </div>
          ) : (
            <div className="flex flex-col">
              <div className="relative" style={{ height: 150 }}>
                <ResponsiveContainer width="100%" height={150}>
                  <PieChart>
                    <Pie data={attendancePieData} cx="50%" cy="50%" innerRadius={40} outerRadius={60} paddingAngle={2} dataKey="value" stroke="#ffffff" strokeWidth={2}>
                      {attendancePieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val: any, name: any) => [`${val} days (${((Number(val) / attendanceTotal) * 100).toFixed(1)}%)`, name]}
                      contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                      itemStyle={{ color: '#fff' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <div className="text-base font-bold text-slate-900 leading-none">{attendanceTotal}</div>
                  <div className="text-[9px] text-slate-500">employee-days</div>
                </div>
              </div>
              <table className="w-full text-[11px] mt-1">
                <tbody>
                  {attendanceBreakdown.map(d => (
                    <tr key={d.name} className="border-t border-slate-100 first:border-0">
                      <td className="py-1 text-slate-700">
                        <span className="inline-block w-2 h-2 rounded-full mr-2" style={{ backgroundColor: d.color }}></span>
                        {d.name}
                      </td>
                      <td className="py-1 text-right font-semibold text-slate-900">{d.value}</td>
                      <td className="py-1 text-right text-slate-500 w-12">{((d.value / attendanceTotal) * 100).toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>

      {/* Department Payroll Breakdown Table & Chart */}
      <div className="bg-white p-6 rounded-xl border border-slate-200/90 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Departmental Cost Breakdown</h3>
            <p className="text-xs text-slate-500">Cost allocation across functional divisions</p>
          </div>
          <button
            onClick={() => onNavigate('results')}
            className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
          >
            <span>Full Register</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
          
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={deptChartData} layout="vertical" margin={{ top: 10, right: 30, left: 30, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" tickFormatter={(v) => `₹${v / 1000}k`} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="department" tick={{ fontSize: 11 }} width={90} />
                <Tooltip
                  formatter={(val: any) => [formatIndianCurrency(Number(val)), 'Amount']}
                  contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                />
                <Bar dataKey="Gross Payroll" fill="#10b981" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Department table */}
          <div className="border border-slate-200 rounded-lg overflow-hidden text-xs">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Department</th>
                  <th className="py-2.5 px-3 text-center">Staff</th>
                  <th className="py-2.5 px-3 text-right">Gross Payroll</th>
                  <th className="py-2.5 px-3 text-right">Take Home</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {deptChartData.map(d => (
                  <tr key={d.department} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-semibold text-slate-800">{d.department}</td>
                    <td className="py-2.5 px-3 text-center text-slate-600">{d.headcount}</td>
                    <td className="py-2.5 px-3 text-right font-medium text-slate-900">{formatIndianCurrency(d['Gross Payroll'])}</td>
                    <td className="py-2.5 px-3 text-right font-medium text-emerald-700">{formatIndianCurrency(d['Take Home'])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </div>
      </div>

    </div>
  );
};
