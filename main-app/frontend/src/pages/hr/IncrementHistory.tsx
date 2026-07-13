import { useState, useEffect } from 'react';
import { useSettings } from '../../context/SettingsContext';
import { TrendingUp, Filter, Download } from 'lucide-react';
import Pagination from '../../components/Pagination';
import api from '../../utils/api';
import { localToday } from '../../utils/dateUtils';
import { useToast } from '../../components/Toast';
import SalaryIncrementModal from '../../components/SalaryIncrementModal';
import { SkeletonTable } from '../../components/Skeleton';

const IncrementHistory = () => {
  const { currencySymbol: currency } = useSettings();
  const toast = useToast();
  const [increments, setIncrements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [staffFilter, setStaffFilter] = useState('');
  const [staffList, setStaffList] = useState<any[]>([]);
  const [showIncrementModal, setShowIncrementModal] = useState(false);

  useEffect(() => {
    api.get('/staff', { params: { limit: 200 } }).then(r => setStaffList(r.data.data || [])).catch(() => {});
  }, []);

  useEffect(() => { fetchIncrements(); }, [pagination.page, staffFilter]);

  const fetchIncrements = async () => {
    setLoading(true);
    try {
      const params: any = { page: pagination.page, limit: pagination.limit };
      if (staffFilter) params.staff_id = staffFilter;
      const res = await api.get('/staff/increments', { params });
      setIncrements(res.data.data || []);
      if (res.data.pagination) setPagination(res.data.pagination);
    } catch {
      toast.error('Failed to load increments');
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = () => {
    if (increments.length === 0) return;
    const headers = ['Date', 'Employee', 'Department', 'Old Salary', 'New Salary', 'Change', 'Change %', 'Reason', 'Approved By'];
    const rows = increments.map(i => [
      new Date(i.effective_date).toLocaleDateString(),
      `"${i.full_name}"`,
      i.department || '',
      Number(i.old_salary).toFixed(0),
      Number(i.new_salary).toFixed(0),
      Number(i.increment_amount).toFixed(0),
      `${Number(i.increment_percentage).toFixed(1)}%`,
      `"${(i.reason || '').replace(/"/g, '""')}"`,
      i.approved_by_name || ''
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `increment_history_${localToday()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4 sm:p-6">
      {/* Gradient Page Header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-teal-50 via-white to-white border-b border-gray-100 px-4 sm:px-8 py-4 sm:py-6 -mx-4 sm:-mx-6 -mt-4 sm:-mt-6 mb-6 sm:mb-8">
        <div className="absolute inset-0 opacity-5 bg-[url('data:image/svg+xml,%3Csvg width=%2260%22 height=%2260%22 viewBox=%220 0 60 60%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cg fill=%22none%22 fill-rule=%22evenodd%22%3E%3Cg fill=%22%23000%22 fill-opacity=%221%22%3E%3Cpath d=%22M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z%22/%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E')]" />
        <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-teal-500 to-teal-600 rounded-2xl flex items-center justify-center shadow-lg shadow-teal-200">
              <TrendingUp size={22} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Increment History</h1>
              <p className="text-sm text-gray-500 mt-0.5">Track salary increments</p>
            </div>
          </div>
          <div className="flex gap-3">
            {increments.length > 0 && (
              <button onClick={exportCSV}
                className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800 bg-white/80 border border-gray-200 px-4 py-2.5 rounded-xl hover:bg-gray-50 transition font-medium">
                <Download size={15} /> Export CSV
              </button>
            )}
            <button onClick={() => setShowIncrementModal(true)}
              className="flex items-center gap-2 bg-gradient-to-r from-teal-500 to-teal-600 text-white px-5 py-2.5 rounded-xl hover:from-teal-600 hover:to-teal-700 shadow-md shadow-teal-200 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 font-medium text-sm">
              <TrendingUp size={16} /> New Increment
            </button>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200">
          <p className="text-gray-500 text-sm font-medium">Total Increments</p>
          <p className="text-3xl font-bold text-gray-800 mt-2">{pagination.total}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200">
          <p className="text-gray-500 text-sm font-medium">Avg Increase</p>
          <p className="text-3xl font-bold text-teal-600 mt-2">
            {increments.length > 0
              ? `${(increments.reduce((s, i) => s + Number(i.increment_percentage || 0), 0) / increments.length).toFixed(1)}%`
              : '0%'}
          </p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200">
          <p className="text-gray-500 text-sm font-medium">Total Salary Added</p>
          <p className="text-3xl font-bold text-teal-600 mt-2">
            ${increments.reduce((s, i) => s + Math.max(0, Number(i.increment_amount || 0)), 0).toLocaleString()}
          </p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-100 shadow-sm px-5 py-4 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <Filter size={18} className="text-teal-500 flex-shrink-0" />
          <span className="text-sm font-medium text-gray-600">Filter by Staff:</span>
          <select value={staffFilter} onChange={(e) => { setStaffFilter(e.target.value); setPagination(p => ({ ...p, page: 1 })); }}
            className="px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent transition text-sm min-w-[220px]">
            <option value="">All Staff</option>
            {staffList.map(s => <option key={s.staff_id} value={s.staff_id}>{s.employee_id ? `[${s.employee_id}] ` : ''}{s.full_name}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <SkeletonTable rows={5} cols={8} />
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead className="bg-gradient-to-r from-gray-50 to-white">
              <tr className="border-b border-gray-100">
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Date</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Employee</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Department</th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Old Salary</th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">New Salary</th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Change</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Reason</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Approved By</th>
              </tr>
            </thead>
            <tbody>
              {increments.length > 0 ? (
                increments.map((inc: any) => {
                  const isIncrease = Number(inc.increment_amount) >= 0;
                  return (
                    <tr key={inc.increment_id} className="border-b border-gray-50 hover:bg-teal-50/20 transition-colors">
                      <td className="px-6 py-4 text-gray-500 text-sm">{new Date(inc.effective_date).toLocaleDateString()}</td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-gray-800">{inc.full_name}</div>
                        {inc.employee_id && <div className="text-xs text-gray-400 mt-0.5">{inc.employee_id}</div>}
                      </td>
                      <td className="px-6 py-4 text-gray-500 text-sm">{inc.department || '-'}</td>
                      <td className="px-6 py-4 text-right text-gray-500 text-sm">{currency}{Number(inc.old_salary).toLocaleString()}</td>
                      <td className="px-6 py-4 text-right font-bold text-gray-800">{currency}{Number(inc.new_salary).toLocaleString()}</td>
                      <td className="px-6 py-4 text-right">
                        <span className={`font-semibold ${isIncrease ? 'text-teal-600' : 'text-red-500'}`}>
                          {isIncrease ? '+' : ''}{Number(inc.increment_amount).toLocaleString()}
                        </span>
                        <span className={`block text-xs mt-0.5 ${isIncrease ? 'text-teal-500' : 'text-red-400'}`}>
                          ({Number(inc.increment_percentage).toFixed(1)}%)
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 max-w-[200px] truncate">{inc.reason || '-'}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{inc.approved_by_name || '-'}</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-400">
                    <TrendingUp size={32} className="mx-auto mb-3 opacity-30" />
                    <p className="font-medium">No increment records found</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>

          <Pagination
            currentPage={pagination.page}
            totalPages={pagination.totalPages}
            onPageChange={(page) => setPagination(p => ({ ...p, page }))}
            totalItems={pagination.total}
            itemsPerPage={pagination.limit}
            onItemsPerPageChange={(limit) => setPagination(p => ({ ...p, limit, page: 1 }))}
          />
        </div>
      )}

      <SalaryIncrementModal isOpen={showIncrementModal} onClose={() => setShowIncrementModal(false)} onSuccess={fetchIncrements} />
    </div>
  );
};

export default IncrementHistory;
