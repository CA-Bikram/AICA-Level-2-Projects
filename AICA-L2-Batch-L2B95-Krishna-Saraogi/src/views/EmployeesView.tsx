/**
 * OneHR Payroll Manager - Employee Master View
 */

import React, { useState } from 'react';
import {
  Users,
  UserPlus,
  Search,
  Filter,
  Download,
  Upload,
  Edit2,
  Trash2,
  ShieldCheck,
  Building,
  CheckCircle2,
  XCircle,
  Eye,
  FileSpreadsheet
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Employee, EmploymentStatus } from '../types/payroll';
import { formatIndianCurrency, formatIndianDate } from '../utils/indianNumber';
import { EmployeeModal } from '../components/modals/EmployeeModal';
import { ImportModal } from '../components/modals/ImportModal';
import { api } from '../services/api';

interface Props {
  employees: Employee[];
  onRefresh: () => void;
}

export const EmployeesView: React.FC<Props> = ({ employees, onRefresh }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  
  // Modals state
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Departments list for filter dropdown
  const departments = Array.from(new Set(employees.map(e => e.department).filter(Boolean)));

  // Filtered employees
  const filteredEmployees = employees.filter(emp => {
    const matchesSearch =
      emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.employee_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (emp.pan && emp.pan.toLowerCase().includes(searchTerm.toLowerCase())) ||
      emp.designation.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesDept = departmentFilter === 'ALL' || emp.department === departmentFilter;
    const matchesStatus = statusFilter === 'ALL' || emp.employment_status === statusFilter;

    return matchesSearch && matchesDept && matchesStatus;
  });

  // Deactivate or toggle status
  const handleToggleStatus = async (emp: Employee) => {
    const newStatus: EmploymentStatus = emp.employment_status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    if (confirm(`Are you sure you want to change status of ${emp.name} to ${newStatus}?`)) {
      try {
        await api.updateEmployee(emp.id, { ...emp, employment_status: newStatus });
        onRefresh();
      } catch (err: any) {
        alert(err.message);
      }
    }
  };

  // Delete employee
  const handleDelete = async (emp: Employee) => {
    if (confirm(`Permanently delete employee ${emp.name} (${emp.employee_id})?`)) {
      try {
        await api.deleteEmployee(emp.id);
        onRefresh();
      } catch (err: any) {
        alert(err.message);
      }
    }
  };

  // Export to Excel
  const handleExportExcel = () => {
    const data = filteredEmployees.map(e => ({
      'Employee ID': e.employee_id,
      'Full Name': e.name,
      'PAN': e.pan,
      'Date of Joining': e.date_of_joining,
      'Department': e.department,
      'Designation': e.designation,
      'Location': e.location,
      'State': e.state,
      'Monthly Gross Salary': e.monthly_gross_salary,
      'Salary Structure': e.salary_structure_type,
      'Basic': e.basic || 0,
      'DA': e.da || 0,
      'HRA': e.hra || 0,
      'Conveyance': e.conveyance || 0,
      'Medical': e.medical || 0,
      'Special Allowance': e.special_allowance || 0,
      'Status': e.employment_status,
      'Bank Name': e.bank_name,
      'Account Number': e.account_number,
      'IFSC': e.ifsc,
      'UAN': e.uan,
      'ESIC Number': e.esic_number,
      'PF Applicable': e.pf_applicable ? 'YES' : 'NO',
      'ESIC Applicable': e.esic_applicable ? 'YES' : 'NO',
      'PT Applicable': e.professional_tax_applicable ? 'YES' : 'NO',
      'Tax Regime': e.tax_regime
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Employees');
    XLSX.writeFile(wb, `Employee_Master_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="space-y-6">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200/90 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900">Employee Master</h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
              {employees.length} Total Staff
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage profiles, statutory applicability (PF, ESIC, PT, TDS), and Simple / Detailed salary structures
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold border border-slate-200 transition"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import Excel</span>
          </button>

          <button
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold border border-slate-200 transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Excel</span>
          </button>

          <button
            onClick={() => {
              setSelectedEmployee(null);
              setIsModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add Employee</span>
          </button>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
        
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by name, Emp ID, PAN, designation..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-medium">Department:</span>
            <select
              value={departmentFilter}
              onChange={e => setDepartmentFilter(e.target.value)}
              className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-medium focus:outline-hidden"
            >
              <option value="ALL">All Departments</option>
              {departments.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-medium">Status:</span>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-medium focus:outline-hidden"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
              <option value="ON_LEAVE">ON_LEAVE</option>
              <option value="TERMINATED">TERMINATED</option>
            </select>
          </div>
        </div>

      </div>

      {/* Master Employees Table */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Employee ID</th>
                <th className="py-3 px-4">Name & PAN</th>
                <th className="py-3 px-4">Department & Role</th>
                <th className="py-3 px-4">State & Location</th>
                <th className="py-3 px-4 text-right">Monthly Gross</th>
                <th className="py-3 px-4 text-center">Structure</th>
                <th className="py-3 px-4 text-center">Statutory Coverage</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm font-semibold text-slate-700">No employees match current filters</p>
                    <p className="text-xs text-slate-400 mt-1">Try adjusting your search terms or add a new employee.</p>
                  </td>
                </tr>
              ) : (
                filteredEmployees.map(emp => (
                  <tr key={emp.id} className="hover:bg-slate-50/80 transition">
                    
                    {/* Employee ID */}
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                      {emp.employee_id}
                    </td>

                    {/* Name & PAN */}
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900 text-sm">{emp.name}</div>
                      <div className="text-[11px] text-slate-500 font-mono">PAN: {emp.pan || 'N/A'}</div>
                    </td>

                    {/* Department & Role */}
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-slate-800">{emp.department}</div>
                      <div className="text-[11px] text-slate-500">{emp.designation}</div>
                    </td>

                    {/* State & Location */}
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-slate-800">{emp.state}</div>
                      <div className="text-[11px] text-slate-500">{emp.location}</div>
                    </td>

                    {/* Monthly Gross */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="font-bold text-slate-900 text-sm">
                        {formatIndianCurrency(emp.monthly_gross_salary)}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        DOJ: {formatIndianDate(emp.date_of_joining)}
                      </div>
                    </td>

                    {/* Structure (Simple vs Detailed) */}
                    <td className="py-3.5 px-4 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${emp.salary_structure_type === 'DETAILED' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'bg-slate-100 text-slate-700'}`}>
                        {emp.salary_structure_type}
                      </span>
                    </td>

                    {/* Statutory Coverage Badges */}
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1 text-[10px] font-bold">
                        <span className={`px-1.5 py-0.5 rounded ${emp.pf_applicable ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-slate-100 text-slate-400'}`}>
                          PF
                        </span>
                        <span className={`px-1.5 py-0.5 rounded ${emp.esic_applicable ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-slate-100 text-slate-400'}`}>
                          ESIC
                        </span>
                        <span className={`px-1.5 py-0.5 rounded ${emp.professional_tax_applicable ? 'bg-purple-50 text-purple-700 border border-purple-200' : 'bg-slate-100 text-slate-400'}`}>
                          PT
                        </span>
                        <span className={`px-1.5 py-0.5 rounded ${emp.income_tax_applicable ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-400'}`}>
                          TDS
                        </span>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${emp.employment_status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'}`}>
                        {emp.employment_status}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => {
                            setSelectedEmployee(emp);
                            setIsModalOpen(true);
                          }}
                          title="Edit Employee"
                          className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleToggleStatus(emp)}
                          title={emp.employment_status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                          className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-md transition"
                        >
                          {emp.employment_status === 'ACTIVE' ? (
                            <XCircle className="w-3.5 h-3.5" />
                          ) : (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          )}
                        </button>
                        <button
                          onClick={() => handleDelete(emp)}
                          title="Delete Employee"
                          className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-md transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>

                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <EmployeeModal
          employee={selectedEmployee}
          onClose={() => setIsModalOpen(false)}
          onSuccess={onRefresh}
        />
      )}

      {/* Import Modal */}
      {isImportModalOpen && (
        <ImportModal
          type="EMPLOYEE"
          onClose={() => setIsImportModalOpen(false)}
          onSuccess={onRefresh}
        />
      )}

    </div>
  );
};
