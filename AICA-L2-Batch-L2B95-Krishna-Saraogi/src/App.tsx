/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar, NavModule } from './components/layout/Sidebar';
import { Header, AVAILABLE_MONTHS } from './components/layout/Header';
import { DashboardView } from './views/DashboardView';
import { EmployeesView } from './views/EmployeesView';
import { AttendanceView } from './views/AttendanceView';
import { PayrollProcessingView } from './views/PayrollProcessingView';
import { PayrollResultsView } from './views/PayrollResultsView';
import { SalarySlipsView } from './views/SalarySlipsView';
import { ReportsView } from './views/ReportsView';
import { SettingsView } from './views/SettingsView';
import { LoginView } from './views/LoginView';
import { AuditView } from './views/AuditView';
import { AIReviewView } from './views/AIReviewView';
import { EngineTestModal } from './components/modals/EngineTestModal';
import {
  Company,
  Employee,
  PayrollRecord,
  PayrollRun,
  PayrollSettings,
  PTSlab,
  TDSSlab
} from './types/payroll';
import { DEFAULT_SETTINGS, DEFAULT_PT_SLABS, DEFAULT_TAX_SLABS } from './services/payrollEngine';
import { api, SessionUser, SESSION_EXPIRED_EVENT } from './services/api';

export default function App() {
  const [currentModule, setCurrentModule] = useState<NavModule>('dashboard');
  // FY 2026-27. Starts on April 2026 and moves to the working month once the runs are known.
  const [currentMonth, setCurrentMonth] = useState<string>(AVAILABLE_MONTHS[0]);
  const [monthChosen, setMonthChosen] = useState(false);

  // Signed-in user: undefined = still checking, null = signed out
  const [user, setUser] = useState<SessionUser | null | undefined>(undefined);

  useEffect(() => {
    api.me().then(res => setUser(res.user)).catch(() => setUser(null));
    const onExpired = () => setUser(null);
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, []);

  const handleLogout = async () => {
    await api.logout().catch(() => undefined);
    setUser(null);
    setMonthChosen(false);
    setCurrentModule('dashboard');
  };

  // Application Data States
  const [company, setCompany] = useState<Company | null>(null);
  const [settings, setSettings] = useState<PayrollSettings>(DEFAULT_SETTINGS);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendanceList, setAttendanceList] = useState<any[]>([]);
  const [payrollRun, setPayrollRun] = useState<PayrollRun | null>(null);
  const [payrollRecords, setPayrollRecords] = useState<PayrollRecord[]>([]);
  const [ptSlabs, setPtSlabs] = useState<PTSlab[]>(DEFAULT_PT_SLABS);
  const [taxSlabs, setTaxSlabs] = useState<TDSSlab[]>(DEFAULT_TAX_SLABS);

  // UI state
  const [loading, setLoading] = useState<boolean>(true);
  const [isTestModalOpen, setIsTestModalOpen] = useState<boolean>(false);
  const [slipSelectedEmpId, setSlipSelectedEmpId] = useState<string | undefined>(undefined);

  // Fetch all data for current month
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [
        companyData,
        settingsData,
        employeesData,
        attendanceData,
        payrollRunData,
        ptData,
        taxData
      ] = await Promise.all([
        api.getCompany().catch(() => null),
        api.getSettings().catch(() => DEFAULT_SETTINGS),
        api.getEmployees().catch(() => []),
        api.getAttendance(currentMonth).catch(() => []),
        api.getPayrollRun(currentMonth).catch(() => ({ run: null, records: [] })),
        api.getPTSlabs().catch(() => DEFAULT_PT_SLABS),
        api.getTaxSlabs().catch(() => DEFAULT_TAX_SLABS)
      ]);

      if (companyData) setCompany(companyData);
      if (settingsData) setSettings(settingsData);
      if (employeesData) setEmployees(employeesData);
      if (attendanceData) setAttendanceList(attendanceData);
      if (payrollRunData) {
        setPayrollRun(payrollRunData.run);
        setPayrollRecords(payrollRunData.records || []);
      }
      if (ptData && ptData.length > 0) setPtSlabs(ptData);
      if (taxData && taxData.length > 0) setTaxSlabs(taxData);
    } catch (err) {
      console.error('Failed to load application data:', err);
    } finally {
      setLoading(false);
    }
  }, [currentMonth]);

  useEffect(() => {
    if (user) loadData();
  }, [loadData, user]);

  // After sign-in, open on the working month: the first month of the year that is not yet locked
  useEffect(() => {
    if (!user || monthChosen) return;
    api.getPayrollRuns()
      .then(runs => {
        const locked = new Set(runs.filter(r => r.status === 'LOCKED').map(r => r.payroll_month));
        const working = AVAILABLE_MONTHS.find(m => !locked.has(m)) || AVAILABLE_MONTHS[AVAILABLE_MONTHS.length - 1];
        setCurrentMonth(working);
      })
      .catch(() => undefined)
      .finally(() => setMonthChosen(true));
  }, [user, monthChosen]);

  // Navigate to salary slips with a specific employee pre-selected
  const handleSelectEmployeeForSlip = (empId: string) => {
    setSlipSelectedEmpId(empId);
    setCurrentModule('salary-slips');
  };

  if (user === undefined) {
    return <div className="h-screen w-screen flex items-center justify-center bg-slate-900 text-slate-300 text-sm">Loading…</div>;
  }

  if (user === null) {
    return <LoginView onSignedIn={setUser} />;
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 font-sans text-slate-900 select-none">
      
      {/* Sidebar */}
      <Sidebar
        currentModule={currentModule}
        onSelectModule={setCurrentModule}
        staffCount={employees.length}
        payrollStatus={payrollRun?.status || 'READY'}
        showAudit={user.role !== 'MAKER'}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        
        {/* Top Header */}
        <Header
          currentMonth={currentMonth}
          onMonthChange={setCurrentMonth}
          company={company}
          currentRun={payrollRun}
          onRefresh={loadData}
          onOpenTestsModal={() => setIsTestModalOpen(true)}
          user={user}
          onLogout={handleLogout}
        />

        {/* Viewport content */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8 bg-slate-100/60">
          <div className="max-w-7xl mx-auto">
            
            {loading && (
              <div className="text-center py-6 text-xs text-slate-500 font-semibold animate-pulse">
                Loading payroll data...
              </div>
            )}

            {/* Dashboard View */}
            {currentModule === 'dashboard' && (
              <DashboardView
                currentMonth={currentMonth}
                run={payrollRun}
                records={payrollRecords}
                company={company}
                attendanceList={attendanceList}
                onNavigate={setCurrentModule}
              />
            )}

            {/* Employee Master View */}
            {currentModule === 'employees' && (
              <EmployeesView
                employees={employees}
                onRefresh={loadData}
              />
            )}

            {/* Monthly Attendance Grid View */}
            {currentModule === 'attendance' && (
              <AttendanceView
                currentMonth={currentMonth}
                attendanceList={attendanceList}
                onRefresh={loadData}
              />
            )}

            {/* Payroll Processing Workflow View */}
            {currentModule === 'processing' && (
              <PayrollProcessingView
                currentMonth={currentMonth}
                run={payrollRun}
                records={payrollRecords}
                attendanceList={attendanceList}
                onRefresh={loadData}
                onNavigate={setCurrentModule}
              />
            )}

            {/* Payroll Results View */}
            {currentModule === 'results' && (
              <PayrollResultsView
                currentMonth={currentMonth}
                run={payrollRun}
                records={payrollRecords}
                company={company}
                attendanceList={attendanceList}
                onNavigate={setCurrentModule}
                onSelectEmployeeForSlip={handleSelectEmployeeForSlip}
              />
            )}

            {/* Salary Slips View */}
            {currentModule === 'salary-slips' && (
              <SalarySlipsView
                currentMonth={currentMonth}
                records={payrollRecords}
                company={company}
                employees={employees}
                initialSelectedEmpId={slipSelectedEmpId}
              />
            )}

            {/* Reports & Excel Export View */}
            {currentModule === 'reports' && (
              <ReportsView
                currentMonth={currentMonth}
                run={payrollRun}
                records={payrollRecords}
                company={company}
                attendanceList={attendanceList}
              />
            )}

            {/* AI-assisted pre-lock review */}
            {currentModule === 'ai-review' && (
              <AIReviewView currentMonth={currentMonth} records={payrollRecords} />
            )}

            {/* Audit Trail (checker and admin) */}
            {currentModule === 'audit' && <AuditView />}

            {/* Settings & Configuration View */}
            {currentModule === 'settings' && (
              <SettingsView
                settings={settings}
                company={company}
                ptSlabs={ptSlabs}
                taxSlabs={taxSlabs}
                onRefresh={loadData}
                onOpenTestsModal={() => setIsTestModalOpen(true)}
              />
            )}

          </div>
        </main>
      </div>

      {/* Engine Verification Modal */}
      {isTestModalOpen && (
        <EngineTestModal onClose={() => setIsTestModalOpen(false)} />
      )}

    </div>
  );
}
