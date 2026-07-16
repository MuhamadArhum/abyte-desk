import { useState } from 'react';
import { useSettings } from '../../context/SettingsContext';
import { BarChart3, Download, Users, DollarSign, TrendingUp, Printer, Calendar, FileText, Clock, CreditCard, Wallet } from 'lucide-react';
import DateRangeFilter from '../../components/DateRangeFilter';
import { printReport, buildTable } from '../../utils/reportPrinter';
import api from '../../utils/api';
import { useToast } from '../../components/Toast';
import { localToday, localMonthStr } from '../../utils/dateUtils';
import ReportPasswordGate from '../../components/ReportPasswordGate';

interface AttendanceReportRow {
  staff_id: number;
  full_name: string;
  department: string;
  days_present: number;
  days_absent: number;
  days_half_day: number;
  days_leave: number;
  leave_balance: number;
  attendance_percentage: number;
}

interface SalaryReportRow {
  department: string;
  staff_count: number;
  paid_count: number;
  total_base: number;
  total_deductions: number;
  total_bonuses: number;
  total_net_paid: number;
  total_expected: number;
  pending_amount: number;
}

const exportToCSV = (data: any[], filename: string, columns: { key: string; label: string }[]) => {
  const header = columns.map(c => c.label).join(',');
  const rows = data.map(row =>
    columns.map(c => {
      const val = row[c.key];
      if (val === null || val === undefined) return '';
      const str = String(val);
      return str.includes(',') || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
    }).join(',')
  );
  const csv = [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
};

const StaffReports = () => {
  const { currencySymbol: currency } = useSettings();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<'attendance' | 'salary' | 'leave' | 'overtime' | 'loans' | 'advances'>('attendance');

  // Attendance report state
  const [attendanceMonth, setAttendanceMonth] = useState(localMonthStr());
  const [attendanceData, setAttendanceData] = useState<AttendanceReportRow[]>([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);

  // Salary report state
  const [salaryFromDate, setSalaryFromDate] = useState(localToday());
  const [salaryToDate, setSalaryToDate] = useState(localToday());
  const [salaryData, setSalaryData] = useState<SalaryReportRow[]>([]);
  const [salaryLoading, setSalaryLoading] = useState(false);

  // Leave report state
  const [leaveFrom, setLeaveFrom] = useState(localToday());
  const [leaveTo, setLeaveTo] = useState(localToday());
  const [leaveData, setLeaveData] = useState<any[]>([]);
  const [leaveSummary, setLeaveSummary] = useState<any>(null);
  const [leaveLoading, setLeaveLoading] = useState(false);

  // Overtime report state
  const [otFrom, setOtFrom] = useState(localToday());
  const [otTo, setOtTo] = useState(localToday());
  const [otData, setOtData] = useState<any[]>([]);
  const [otSummary, setOtSummary] = useState<any>(null);
  const [otLoading, setOtLoading] = useState(false);

  // Loan summary state
  const [loanData, setLoanData] = useState<any[]>([]);
  const [loanSummary, setLoanSummary] = useState<any>(null);
  const [loanLoading, setLoanLoading] = useState(false);
  const [loanStatusFilter, setLoanStatusFilter] = useState('');

  // Advance summary state
  const [advFrom, setAdvFrom] = useState(localToday());
  const [advTo, setAdvTo] = useState(localToday());
  const [advData, setAdvData] = useState<any[]>([]);
  const [advSummary, setAdvSummary] = useState<any>(null);
  const [advLoading, setAdvLoading] = useState(false);

  const fetchAttendanceReport = async () => {
    if (!attendanceMonth) { toast.error('Select a month'); return; }
    setAttendanceLoading(true);
    try {
      const res = await api.get('/staff/reports/attendance-monthly', { params: { month: attendanceMonth } });
      setAttendanceData(res.data.data || []);
      if ((res.data.data || []).length === 0) toast.info('No data found for selected month');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to load attendance report');
    } finally {
      setAttendanceLoading(false);
    }
  };

  const fetchSalaryReport = async () => {
    if (!salaryFromDate || !salaryToDate) { toast.error('Select date range'); return; }
    if (salaryFromDate > salaryToDate) { toast.error('From date must be before to date'); return; }
    setSalaryLoading(true);
    try {
      const res = await api.get('/staff/reports/salary-summary', { params: { from_date: salaryFromDate, to_date: salaryToDate } });
      const depts = res.data.by_department || res.data.data || [];
      setSalaryData(depts.map((d: any) => ({
        ...d,
        staff_count: Number(d.total_staff || d.staff_count || 0),
        paid_count: Number(d.staff_paid || d.paid_count || 0),
      })));
      if (depts.length === 0) toast.info('No salary data for selected period');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to load salary report');
    } finally {
      setSalaryLoading(false);
    }
  };

  const fetchLeaveReport = async () => {
    if (!leaveFrom || !leaveTo) { toast.error('Select date range'); return; }
    setLeaveLoading(true);
    try {
      const res = await api.get('/staff/reports/leave-report', { params: { from_date: leaveFrom, to_date: leaveTo } });
      setLeaveData(res.data.data || []);
      setLeaveSummary(res.data.summary || null);
      if ((res.data.data || []).length === 0) toast.info('No leave data for selected period');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to load leave report');
    } finally {
      setLeaveLoading(false);
    }
  };

  const fetchOvertimeReport = async () => {
    if (!otFrom || !otTo) { toast.error('Select date range'); return; }
    setOtLoading(true);
    try {
      const res = await api.get('/staff/reports/overtime', { params: { from_date: otFrom, to_date: otTo } });
      setOtData(res.data.data || []);
      setOtSummary(res.data.summary || null);
      if ((res.data.data || []).length === 0) toast.info('No overtime data for selected period');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to load overtime report');
    } finally {
      setOtLoading(false);
    }
  };

  const fetchLoanSummary = async () => {
    setLoanLoading(true);
    try {
      const res = await api.get('/staff/reports/loan-summary', { params: loanStatusFilter ? { status: loanStatusFilter } : {} });
      setLoanData(res.data.data || []);
      setLoanSummary(res.data.summary || null);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to load loan summary');
    } finally {
      setLoanLoading(false);
    }
  };

  const fetchAdvanceSummary = async () => {
    if (!advFrom || !advTo) { toast.error('Select date range'); return; }
    setAdvLoading(true);
    try {
      const res = await api.get('/staff/reports/advance-summary', { params: { from_date: advFrom, to_date: advTo } });
      setAdvData(res.data.data || []);
      setAdvSummary(res.data.summary || null);
      if ((res.data.data || []).length === 0) toast.info('No advance data for selected period');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to load advance summary');
    } finally {
      setAdvLoading(false);
    }
  };

  const attendancePctColor = (pct: number) => {
    if (pct >= 90) return 'text-emerald-600 bg-emerald-50';
    if (pct >= 70) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  // Totals for salary
  const salaryTotals = salaryData.reduce(
    (acc, r) => ({
      staff_count: acc.staff_count + r.staff_count,
      paid_count: acc.paid_count + r.paid_count,
      total_base: acc.total_base + Number(r.total_base),
      total_deductions: acc.total_deductions + Number(r.total_deductions),
      total_bonuses: acc.total_bonuses + Number(r.total_bonuses),
      total_net_paid: acc.total_net_paid + Number(r.total_net_paid),
      total_expected: acc.total_expected + Number(r.total_expected),
      pending_amount: acc.pending_amount + Number(r.pending_amount),
    }),
    { staff_count: 0, paid_count: 0, total_base: 0, total_deductions: 0, total_bonuses: 0, total_net_paid: 0, total_expected: 0, pending_amount: 0 }
  );

  const handlePrint = () => {
    if (activeTab === 'attendance' && attendanceData.length > 0) {
      const rows = attendanceData.map(r => [r.full_name, r.department, String(r.days_present), String(r.days_absent), String(r.days_half_day), String(r.days_leave), `${r.attendance_percentage}%`]);
      const content = buildTable(['Name', 'Department', 'Present', 'Absent', 'Half Day', 'Leave', 'Attendance %'], rows, { alignRight: [2, 3, 4, 5, 6] });
      printReport({ title: 'Staff Attendance Report', dateRange: `Month: ${attendanceMonth}`, content });
    } else if (activeTab === 'salary' && salaryData.length > 0) {
      const rows = salaryData.map(r => [r.department, String(r.staff_count), String(r.paid_count), Number(r.total_base).toFixed(0), Number(r.total_deductions).toFixed(0), Number(r.total_bonuses).toFixed(0), Number(r.total_net_paid).toFixed(0), Number(r.pending_amount).toFixed(0)]);
      const content = buildTable(['Department', 'Staff', 'Paid', 'Base Salary', 'Deductions', 'Bonuses', 'Net Paid', 'Pending'], rows, { alignRight: [1, 2, 3, 4, 5, 6, 7] });
      printReport({ title: 'Staff Salary Summary', dateRange: `${salaryFromDate} to ${salaryToDate}`, content, orientation: 'landscape' });
    }
  };

  return (
    <div className="p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6 sm:mb-8">
        <div className="flex items-center gap-3">
          <BarChart3 className="text-emerald-600" size={20} />
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-gray-900">Staff Reports</h1>
            <p className="text-gray-600 text-sm mt-1">Attendance & salary analytics</p>
          </div>
        </div>
        <button
          onClick={handlePrint}
          disabled={(activeTab === 'attendance' && attendanceData.length === 0) || (activeTab === 'salary' && salaryData.length === 0)}
          className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Printer size={18} />
          Print
        </button>
      </div>

      {/* Tab Bar */}
      <div className="flex flex-wrap gap-2 mb-6">
        {[
          { key: 'attendance', label: 'Attendance', icon: <Users size={16} /> },
          { key: 'salary', label: 'Salary', icon: <DollarSign size={16} /> },
          { key: 'leave', label: 'Leave', icon: <Calendar size={16} /> },
          { key: 'overtime', label: 'Overtime', icon: <Clock size={16} /> },
          { key: 'loans', label: 'Loans', icon: <CreditCard size={16} /> },
          { key: 'advances', label: 'Advances', icon: <Wallet size={16} /> },
        ].map(tab => (
          <button key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition ${
              activeTab === tab.key ? 'bg-emerald-600 text-white shadow-lg' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}>
            {tab.icon}{tab.label}
          </button>
        ))}
      </div>

      {/* Attendance Tab */}
      {activeTab === 'attendance' && (
        <div className="space-y-6">
          {/* Filters */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Month</label>
              <input
                type="month"
                value={attendanceMonth}
                onChange={e => setAttendanceMonth(e.target.value)}
                className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>
            <button
              onClick={fetchAttendanceReport}
              disabled={attendanceLoading}
              className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition disabled:opacity-50"
            >
              {attendanceLoading ? 'Loading...' : 'Generate'}
            </button>
            {attendanceData.length > 0 && (
              <button
                onClick={() => exportToCSV(attendanceData, `attendance-report-${attendanceMonth}`, [
                  { key: 'full_name', label: 'Name' },
                  { key: 'department', label: 'Department' },
                  { key: 'days_present', label: 'Present' },
                  { key: 'days_absent', label: 'Absent' },
                  { key: 'days_half_day', label: 'Half Day' },
                  { key: 'days_leave', label: 'Leave' },
                  { key: 'leave_balance', label: 'Leave Balance' },
                  { key: 'attendance_percentage', label: 'Attendance %' },
                ])}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
              >
                <Download size={16} />
                Export CSV
              </button>
            )}
          </div>

          {/* Summary Cards */}
          {attendanceData.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <p className="text-sm text-gray-500">Total Staff</p>
                <p className="text-2xl font-bold text-gray-800">{attendanceData.length}</p>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <p className="text-sm text-gray-500">Avg Attendance</p>
                <p className="text-2xl font-bold text-emerald-600">
                  {(attendanceData.reduce((s, r) => s + Number(r.attendance_percentage), 0) / attendanceData.length).toFixed(1)}%
                </p>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <p className="text-sm text-gray-500">Total Leave Days</p>
                <p className="text-2xl font-bold text-amber-600">
                  {attendanceData.reduce((s, r) => s + Number(r.days_leave), 0)}
                </p>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <p className="text-sm text-gray-500">Perfect Attendance</p>
                <p className="text-2xl font-bold text-emerald-600">
                  {attendanceData.filter(r => Number(r.attendance_percentage) === 100).length}
                </p>
              </div>
            </div>
          )}

          {/* Table */}
          {attendanceData.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
              <table className="w-full min-w-[600px]">
                <thead className="bg-gray-50">
                  <tr className="border-b">
                    <th className="text-left p-4 font-semibold text-gray-700 whitespace-nowrap">Name</th>
                    <th className="text-left p-4 font-semibold text-gray-700">Department</th>
                    <th className="text-center p-4 font-semibold text-gray-700">Present</th>
                    <th className="text-center p-4 font-semibold text-gray-700">Absent</th>
                    <th className="text-center p-4 font-semibold text-gray-700">Half Day</th>
                    <th className="text-center p-4 font-semibold text-gray-700">Leave</th>
                    <th className="text-center p-4 font-semibold text-gray-700">Leave Bal.</th>
                    <th className="text-center p-4 font-semibold text-gray-700">Attendance %</th>
                  </tr>
                </thead>
                <tbody>
                  {attendanceData.map(row => (
                    <tr key={row.staff_id} className="border-b hover:bg-gray-50 transition">
                      <td className="p-4 font-medium text-gray-800">{row.full_name}</td>
                      <td className="p-4 text-gray-600">{row.department || '-'}</td>
                      <td className="p-4 text-center text-emerald-600 font-medium">{row.days_present}</td>
                      <td className="p-4 text-center text-red-600 font-medium">{row.days_absent}</td>
                      <td className="p-4 text-center text-amber-600 font-medium">{row.days_half_day}</td>
                      <td className="p-4 text-center text-emerald-600 font-medium">{row.days_leave}</td>
                      <td className="p-4 text-center">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          Number(row.leave_balance) > 5 ? 'bg-emerald-100 text-emerald-700' :
                          Number(row.leave_balance) > 0 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {row.leave_balance}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <span className={`px-3 py-1 rounded-full text-sm font-semibold ${attendancePctColor(Number(row.attendance_percentage))}`}>
                          {Number(row.attendance_percentage).toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          )}

          {attendanceData.length === 0 && !attendanceLoading && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center text-gray-500">
              <Calendar size={48} className="mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium">Select a month and click Generate</p>
              <p className="text-sm mt-1">Attendance report will appear here</p>
            </div>
          )}
        </div>
      )}

      {/* Salary Tab */}
      {activeTab === 'salary' && (
        <div className="space-y-6">
          {/* Filters */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex flex-wrap gap-4 items-center">
            <DateRangeFilter standalone={false} dateFrom={salaryFromDate} dateTo={salaryToDate} onFromChange={setSalaryFromDate} onToChange={setSalaryToDate} onApply={fetchSalaryReport} applyLabel={salaryLoading ? 'Loading...' : 'Generate'} />
            {salaryData.length > 0 && (
              <button
                onClick={() => exportToCSV(salaryData, `salary-report-${salaryFromDate}-to-${salaryToDate}`, [
                  { key: 'department', label: 'Department' },
                  { key: 'staff_count', label: 'Staff Count' },
                  { key: 'paid_count', label: 'Paid Count' },
                  { key: 'total_base', label: 'Total Base' },
                  { key: 'total_deductions', label: 'Deductions' },
                  { key: 'total_bonuses', label: 'Bonuses' },
                  { key: 'total_net_paid', label: 'Net Paid' },
                  { key: 'total_expected', label: 'Expected' },
                  { key: 'pending_amount', label: 'Pending' },
                ])}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
              >
                <Download size={16} />
                Export CSV
              </button>
            )}
          </div>

          {/* Summary Cards */}
          {salaryData.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <p className="text-sm text-gray-500">Total Staff</p>
                <p className="text-2xl font-bold text-gray-800">{salaryTotals.staff_count}</p>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <p className="text-sm text-gray-500">Total Net Paid</p>
                <p className="text-2xl font-bold text-emerald-600">{currency}{salaryTotals.total_net_paid.toFixed(0)}</p>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <p className="text-sm text-gray-500">Total Deductions</p>
                <p className="text-2xl font-bold text-red-600">{currency}{salaryTotals.total_deductions.toFixed(0)}</p>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <p className="text-sm text-gray-500">Pending Amount</p>
                <p className="text-2xl font-bold text-amber-600">{currency}{salaryTotals.pending_amount.toFixed(0)}</p>
              </div>
            </div>
          )}

          {/* Table */}
          {salaryData.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
              <table className="w-full min-w-[700px]">
                <thead className="bg-gray-50">
                  <tr className="border-b">
                    <th className="text-left p-4 font-semibold text-gray-700 whitespace-nowrap">Department</th>
                    <th className="text-center p-4 font-semibold text-gray-700">Staff</th>
                    <th className="text-center p-4 font-semibold text-gray-700">Paid</th>
                    <th className="text-right p-4 font-semibold text-gray-700">Base</th>
                    <th className="text-right p-4 font-semibold text-gray-700">Deductions</th>
                    <th className="text-right p-4 font-semibold text-gray-700">Bonuses</th>
                    <th className="text-right p-4 font-semibold text-gray-700">Net Paid</th>
                    <th className="text-right p-4 font-semibold text-gray-700">Expected</th>
                    <th className="text-right p-4 font-semibold text-gray-700">Pending</th>
                  </tr>
                </thead>
                <tbody>
                  {salaryData.map((row, i) => (
                    <tr key={i} className="border-b hover:bg-gray-50 transition">
                      <td className="p-4 font-medium text-gray-800">{row.department || 'Unassigned'}</td>
                      <td className="p-4 text-center">{row.staff_count}</td>
                      <td className="p-4 text-center">{row.paid_count}</td>
                      <td className="p-4 text-right">{currency}{Number(row.total_base).toFixed(0)}</td>
                      <td className="p-4 text-right text-red-600">{currency}{Number(row.total_deductions).toFixed(0)}</td>
                      <td className="p-4 text-right text-emerald-600">{currency}{Number(row.total_bonuses).toFixed(0)}</td>
                      <td className="p-4 text-right font-medium text-emerald-600">{currency}{Number(row.total_net_paid).toFixed(0)}</td>
                      <td className="p-4 text-right">{currency}{Number(row.total_expected).toFixed(0)}</td>
                      <td className="p-4 text-right">
                        <span className={`font-medium ${Number(row.pending_amount) > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                          ${Number(row.pending_amount).toFixed(0)}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {/* Totals row */}
                  <tr className="bg-gray-50 font-semibold">
                    <td className="p-4 text-gray-800">Total</td>
                    <td className="p-4 text-center">{salaryTotals.staff_count}</td>
                    <td className="p-4 text-center">{salaryTotals.paid_count}</td>
                    <td className="p-4 text-right">{currency}{salaryTotals.total_base.toFixed(0)}</td>
                    <td className="p-4 text-right text-red-600">{currency}{salaryTotals.total_deductions.toFixed(0)}</td>
                    <td className="p-4 text-right text-emerald-600">{currency}{salaryTotals.total_bonuses.toFixed(0)}</td>
                    <td className="p-4 text-right text-emerald-600">{currency}{salaryTotals.total_net_paid.toFixed(0)}</td>
                    <td className="p-4 text-right">{currency}{salaryTotals.total_expected.toFixed(0)}</td>
                    <td className="p-4 text-right text-amber-600">{currency}{salaryTotals.pending_amount.toFixed(0)}</td>
                  </tr>
                </tbody>
              </table>
              </div>
            </div>
          )}

          {salaryData.length === 0 && !salaryLoading && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center text-gray-500">
              <TrendingUp size={48} className="mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium">Select a date range and click Generate</p>
              <p className="text-sm mt-1">Salary summary will appear here</p>
            </div>
          )}
        </div>
      )}

      {/* Leave Report Tab */}
      {activeTab === 'leave' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
              <input type="date" value={leaveFrom} onChange={e => setLeaveFrom(e.target.value)}
                className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
              <input type="date" value={leaveTo} onChange={e => setLeaveTo(e.target.value)}
                className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500" />
            </div>
            <button onClick={fetchLeaveReport} disabled={leaveLoading}
              className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition disabled:opacity-50">
              {leaveLoading ? 'Loading...' : 'Generate'}
            </button>
            {leaveData.length > 0 && (
              <button onClick={() => exportToCSV(leaveData, `leave-report-${leaveFrom}`, [
                { key: 'employee_id', label: 'Emp ID' }, { key: 'full_name', label: 'Name' }, { key: 'department', label: 'Department' },
                { key: 'total_requests', label: 'Requests' }, { key: 'approved_days', label: 'Approved Days' },
                { key: 'pending_days', label: 'Pending' }, { key: 'annual_taken', label: 'Annual' },
                { key: 'sick_taken', label: 'Sick' }, { key: 'casual_taken', label: 'Casual' }, { key: 'leave_balance', label: 'Balance' },
              ])} className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition text-sm">
                <Download size={16} /> Export
              </button>
            )}
          </div>
          {leaveSummary && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Employees', value: leaveSummary.total_staff, color: 'text-gray-800' },
                { label: 'Total Requests', value: leaveSummary.total_requests, color: 'text-blue-600' },
                { label: 'Approved Days', value: leaveSummary.total_approved_days, color: 'text-emerald-600' },
                { label: 'Pending Days', value: leaveSummary.total_pending, color: 'text-yellow-600' },
              ].map(c => (
                <div key={c.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
                  <p className="text-xs text-gray-500">{c.label}</p>
                  <p className={`text-2xl font-bold mt-1 ${c.color}`}>{c.value}</p>
                </div>
              ))}
            </div>
          )}
          {leaveData.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px]">
                  <thead className="bg-gray-50 border-b">
                    <tr>{['Emp ID','Name','Department','Requests','Approved Days','Pending','Annual','Sick','Casual','Balance'].map(h => (
                      <th key={h} className="p-4 text-left text-sm font-semibold text-gray-700">{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {leaveData.map((r: any) => (
                      <tr key={r.staff_id} className="border-b hover:bg-gray-50">
                        <td className="p-4 text-sm font-mono text-gray-500">{r.employee_id || '-'}</td>
                        <td className="p-4 font-medium text-gray-800">{r.full_name}</td>
                        <td className="p-4 text-sm text-gray-600">{r.department || '-'}</td>
                        <td className="p-4 text-center text-gray-700">{r.total_requests}</td>
                        <td className="p-4 text-center font-semibold text-emerald-600">{r.approved_days}</td>
                        <td className="p-4 text-center text-yellow-600">{r.pending_days}</td>
                        <td className="p-4 text-center text-gray-600">{r.annual_taken}</td>
                        <td className="p-4 text-center text-gray-600">{r.sick_taken}</td>
                        <td className="p-4 text-center text-gray-600">{r.casual_taken}</td>
                        <td className="p-4 text-center font-semibold text-blue-600">{r.leave_balance}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {leaveData.length === 0 && !leaveLoading && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center text-gray-500">
              <FileText size={48} className="mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium">Select a date range and click Generate</p>
            </div>
          )}
        </div>
      )}

      {/* Overtime Tab */}
      {activeTab === 'overtime' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
              <input type="date" value={otFrom} onChange={e => setOtFrom(e.target.value)}
                className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
              <input type="date" value={otTo} onChange={e => setOtTo(e.target.value)}
                className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500" />
            </div>
            <button onClick={fetchOvertimeReport} disabled={otLoading}
              className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition disabled:opacity-50">
              {otLoading ? 'Loading...' : 'Generate'}
            </button>
            {otData.length > 0 && (
              <button onClick={() => exportToCSV(otData, `overtime-report-${otFrom}`, [
                { key: 'employee_id', label: 'Emp ID' }, { key: 'full_name', label: 'Name' }, { key: 'department', label: 'Department' },
                { key: 'ot_days', label: 'OT Days' }, { key: 'ot_hours', label: 'OT Hours' }, { key: 'ot_amount', label: 'OT Amount' },
              ])} className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition text-sm">
                <Download size={16} /> Export
              </button>
            )}
          </div>
          {otSummary && (
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Staff with OT', value: otSummary.total_staff, color: 'text-gray-800' },
                { label: 'Total OT Hours', value: `${otSummary.total_ot_hours}h`, color: 'text-orange-600' },
                { label: 'Total OT Amount', value: `${currency}${Number(otSummary.total_ot_amount).toFixed(0)}`, color: 'text-emerald-600' },
              ].map(c => (
                <div key={c.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
                  <p className="text-xs text-gray-500">{c.label}</p>
                  <p className={`text-2xl font-bold mt-1 ${c.color}`}>{c.value}</p>
                </div>
              ))}
            </div>
          )}
          {otData.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px]">
                  <thead className="bg-gray-50 border-b">
                    <tr>{['Emp ID','Name','Department','Position','OT Days','OT Hours','OT Amount (1.5x)'].map(h => (
                      <th key={h} className="p-4 text-left text-sm font-semibold text-gray-700">{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {otData.map((r: any) => (
                      <tr key={r.staff_id} className="border-b hover:bg-gray-50">
                        <td className="p-4 text-sm font-mono text-gray-500">{r.employee_id || '-'}</td>
                        <td className="p-4 font-medium text-gray-800">{r.full_name}</td>
                        <td className="p-4 text-sm text-gray-600">{r.department || '-'}</td>
                        <td className="p-4 text-sm text-gray-600">{r.position || '-'}</td>
                        <td className="p-4 text-center text-gray-700">{r.ot_days}</td>
                        <td className="p-4 text-center font-semibold text-orange-600">{r.ot_hours}h</td>
                        <td className="p-4 text-right font-semibold text-emerald-600">{currency}{Number(r.ot_amount).toFixed(0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {otData.length === 0 && !otLoading && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center text-gray-500">
              <Clock size={48} className="mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium">Select a date range and click Generate</p>
            </div>
          )}
        </div>
      )}

      {/* Loan Summary Tab */}
      {activeTab === 'loans' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status Filter</label>
              <select value={loanStatusFilter} onChange={e => setLoanStatusFilter(e.target.value)}
                className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500">
                <option value="">All</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <button onClick={fetchLoanSummary} disabled={loanLoading}
              className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition disabled:opacity-50">
              {loanLoading ? 'Loading...' : 'Generate'}
            </button>
            {loanData.length > 0 && (
              <button onClick={() => exportToCSV(loanData, 'loan-summary', [
                { key: 'employee_id', label: 'Emp ID' }, { key: 'full_name', label: 'Name' }, { key: 'department', label: 'Department' },
                { key: 'loan_amount', label: 'Loan Amount' }, { key: 'amount_repaid', label: 'Repaid' },
                { key: 'remaining_balance', label: 'Remaining' }, { key: 'status', label: 'Status' }, { key: 'loan_date', label: 'Date' },
              ])} className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition text-sm">
                <Download size={16} /> Export
              </button>
            )}
          </div>
          {loanSummary && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {[
                { label: 'Total Loans', value: loanSummary.total_loans, color: 'text-gray-800' },
                { label: 'Active', value: loanSummary.active_count, color: 'text-blue-600' },
                { label: 'Disbursed', value: `${currency}${Number(loanSummary.total_disbursed).toFixed(0)}`, color: 'text-gray-700' },
                { label: 'Repaid', value: `${currency}${Number(loanSummary.total_repaid).toFixed(0)}`, color: 'text-emerald-600' },
                { label: 'Outstanding', value: `${currency}${Number(loanSummary.total_outstanding).toFixed(0)}`, color: 'text-red-600' },
              ].map(c => (
                <div key={c.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
                  <p className="text-xs text-gray-500">{c.label}</p>
                  <p className={`text-xl font-bold mt-1 ${c.color}`}>{c.value}</p>
                </div>
              ))}
            </div>
          )}
          {loanData.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px]">
                  <thead className="bg-gray-50 border-b">
                    <tr>{['Emp ID','Name','Department','Loan Amount','Repaid','Remaining','Status','Date','Purpose'].map(h => (
                      <th key={h} className="p-4 text-left text-sm font-semibold text-gray-700">{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {loanData.map((r: any) => (
                      <tr key={r.loan_id} className="border-b hover:bg-gray-50">
                        <td className="p-4 text-sm font-mono text-gray-500">{r.employee_id || '-'}</td>
                        <td className="p-4 font-medium text-gray-800">{r.full_name}</td>
                        <td className="p-4 text-sm text-gray-600">{r.department || '-'}</td>
                        <td className="p-4 text-right font-medium">{currency}{Number(r.loan_amount).toFixed(0)}</td>
                        <td className="p-4 text-right text-emerald-600">{currency}{Number(r.amount_repaid).toFixed(0)}</td>
                        <td className="p-4 text-right font-semibold text-red-600">{currency}{Number(r.remaining_balance).toFixed(0)}</td>
                        <td className="p-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${r.status === 'active' ? 'bg-blue-100 text-blue-700' : r.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                            {r.status}
                          </span>
                        </td>
                        <td className="p-4 text-sm text-gray-600">{r.loan_date}</td>
                        <td className="p-4 text-sm text-gray-600">{r.purpose || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {loanData.length === 0 && !loanLoading && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center text-gray-500">
              <CreditCard size={48} className="mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium">Click Generate to view loan summary</p>
            </div>
          )}
        </div>
      )}

      {/* Advance Summary Tab */}
      {activeTab === 'advances' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
              <input type="date" value={advFrom} onChange={e => setAdvFrom(e.target.value)}
                className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
              <input type="date" value={advTo} onChange={e => setAdvTo(e.target.value)}
                className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500" />
            </div>
            <button onClick={fetchAdvanceSummary} disabled={advLoading}
              className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition disabled:opacity-50">
              {advLoading ? 'Loading...' : 'Generate'}
            </button>
            {advData.length > 0 && (
              <button onClick={() => exportToCSV(advData, `advance-summary-${advFrom}`, [
                { key: 'employee_id', label: 'Emp ID' }, { key: 'full_name', label: 'Name' }, { key: 'department', label: 'Department' },
                { key: 'total_count', label: 'Count' }, { key: 'total_amount', label: 'Total' },
                { key: 'pending_amount', label: 'Pending' }, { key: 'deducted_amount', label: 'Deducted' },
              ])} className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition text-sm">
                <Download size={16} /> Export
              </button>
            )}
          </div>
          {advSummary && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Employees', value: advSummary.total_employees, color: 'text-gray-800' },
                { label: 'Total Advanced', value: `${currency}${Number(advSummary.total_advanced).toFixed(0)}`, color: 'text-blue-600' },
                { label: 'Pending Recovery', value: `${currency}${Number(advSummary.total_pending).toFixed(0)}`, color: 'text-yellow-600' },
                { label: 'Deducted', value: `${currency}${Number(advSummary.total_deducted).toFixed(0)}`, color: 'text-emerald-600' },
              ].map(c => (
                <div key={c.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
                  <p className="text-xs text-gray-500">{c.label}</p>
                  <p className={`text-2xl font-bold mt-1 ${c.color}`}>{c.value}</p>
                </div>
              ))}
            </div>
          )}
          {advData.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px]">
                  <thead className="bg-gray-50 border-b">
                    <tr>{['Emp ID','Name','Department','Count','Total Amount','Pending','Deducted','Last Date'].map(h => (
                      <th key={h} className="p-4 text-left text-sm font-semibold text-gray-700">{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {advData.map((r: any) => (
                      <tr key={r.staff_id} className="border-b hover:bg-gray-50">
                        <td className="p-4 text-sm font-mono text-gray-500">{r.employee_id || '-'}</td>
                        <td className="p-4 font-medium text-gray-800">{r.full_name}</td>
                        <td className="p-4 text-sm text-gray-600">{r.department || '-'}</td>
                        <td className="p-4 text-center text-gray-700">{r.total_count}</td>
                        <td className="p-4 text-right font-medium text-blue-600">{currency}{Number(r.total_amount).toFixed(0)}</td>
                        <td className="p-4 text-right text-yellow-600">{currency}{Number(r.pending_amount).toFixed(0)}</td>
                        <td className="p-4 text-right text-emerald-600">{currency}{Number(r.deducted_amount).toFixed(0)}</td>
                        <td className="p-4 text-sm text-gray-600">{r.last_advance_date || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {advData.length === 0 && !advLoading && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center text-gray-500">
              <Wallet size={48} className="mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium">Select a date range and click Generate</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const StaffReportsWithGate = () => <ReportPasswordGate><StaffReports /></ReportPasswordGate>;
export default StaffReportsWithGate;
