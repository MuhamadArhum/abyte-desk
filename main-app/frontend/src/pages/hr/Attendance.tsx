import { useState, useEffect } from 'react';
import { Plus, Calendar, TrendingUp, Users, CheckCircle, XCircle, Edit, Trash2, Download } from 'lucide-react';
import DateRangeFilter from '../../components/DateRangeFilter';
import Pagination from '../../components/Pagination';
import api from '../../utils/api';
import { useToast } from '../../components/Toast';
import { useConfirm } from '../../components/ConfirmDialog';
import { useAuth } from '../../context/AuthContext';
import MarkAttendanceModal from '../../components/MarkAttendanceModal';
import EditAttendanceModal from '../../components/EditAttendanceModal';
import { localToday } from '../../utils/dateUtils';
import { SkeletonTable } from '../../components/Skeleton';

const calculateHours = (check_in: string | null, check_out: string | null) => {
  if (!check_in || !check_out) return null;
  const [inH, inM] = check_in.split(':').map(Number);
  const [outH, outM] = check_out.split(':').map(Number);
  const hours = (outH * 60 + outM - inH * 60 - inM) / 60;
  return { hours: Math.round(hours * 100) / 100, isOvertime: hours > 8 };
};

const exportToCSV = (data: any[], filename: string, columns: { key: string; header: string }[]) => {
  const headers = columns.map(c => c.header).join(',');
  const rows = data.map(row =>
    columns.map(c => {
      const val = row[c.key]?.toString() || '';
      return val.includes(',') ? `"${val}"` : val;
    }).join(',')
  );
  const csv = [headers, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}_${localToday()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
};

const Attendance = () => {
  const toast = useToast();
  const confirm = useConfirm();
  const { user } = useAuth();
  const userRole = user?.role_name || user?.role;
  const isAdmin = userRole === 'Admin';
  const isAdminOrManager = userRole === 'Admin' || userRole === 'Manager';

  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [showMarkModal, setShowMarkModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<any>(null);

  const [filters, setFilters] = useState({
    staff_id: '',
    start_date: localToday(),
    end_date: localToday(),
    status: 'all'
  });
  const [staff, setStaff] = useState<any[]>([]);
  const [summary, setSummary] = useState({ present: 0, absent: 0, halfDay: 0, leave: 0, total: 0 });

  useEffect(() => { fetchStaff(); }, []);
  useEffect(() => { fetchAttendance(); }, [pagination.page, filters]);

  const fetchStaff = async () => {
    try {
      const res = await api.get('/staff', { params: { is_active: 1, limit: 100 } });
      setStaff(res.data.data || []);
    } catch (error) {
      console.error('Error fetching staff:', error);
    }
  };

  const fetchAttendance = async () => {
    setLoading(true);
    try {
      const params: any = { page: pagination.page, limit: pagination.limit };
      if (filters.staff_id) params.staff_id = filters.staff_id;
      if (filters.start_date) params.start_date = filters.start_date;
      if (filters.end_date) params.end_date = filters.end_date;
      if (filters.status !== 'all') params.status = filters.status;

      const res = await api.get('/staff/attendance', { params });
      setAttendance(res.data.data || []);
      if (res.data.pagination) setPagination(res.data.pagination);
      if (res.data.summary) setSummary(res.data.summary);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (name: string, value: string) => {
    setFilters(prev => ({ ...prev, [name]: value }));
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handleDelete = async (record: any) => {
    const ok = await confirm({ title: 'Delete Attendance', message: `Delete attendance for ${record.full_name} on ${new Date(record.attendance_date).toLocaleDateString()}?`, type: 'danger' });
    if (!ok) return;
    try {
      await api.delete(`/staff/attendance/${record.attendance_id}`);
      toast.success('Attendance record deleted');
      fetchAttendance();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete');
    }
  };

  const handleExportCSV = () => {
    const exportData = attendance.map((r: any) => {
      const hrs = calculateHours(r.check_in, r.check_out);
      return { ...r, hours: hrs ? hrs.hours.toFixed(1) : '' };
    });
    exportToCSV(exportData, 'attendance', [
      { key: 'full_name', header: 'Staff Name' },
      { key: 'position', header: 'Position' },
      { key: 'attendance_date', header: 'Date' },
      { key: 'check_in', header: 'Check In' },
      { key: 'check_out', header: 'Check Out' },
      { key: 'hours', header: 'Hours' },
      { key: 'status', header: 'Status' },
      { key: 'notes', header: 'Notes' }
    ]);
    toast.info('CSV exported');
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, { bg: string; text: string; dot: string; label: string }> = {
      present:  { bg: 'bg-emerald-100',  text: 'text-emerald-700',  dot: 'bg-emerald-500',  label: 'Present'  },
      absent:   { bg: 'bg-red-100',    text: 'text-red-700',    dot: 'bg-red-500',    label: 'Absent'   },
      half_day: { bg: 'bg-amber-100',  text: 'text-amber-700',  dot: 'bg-amber-500',  label: 'Half Day' },
      leave:    { bg: 'bg-blue-100',   text: 'text-blue-700',   dot: 'bg-blue-500',   label: 'On Leave' },
      holiday:  { bg: 'bg-emerald-100',text: 'text-emerald-700',dot: 'bg-emerald-500',label: 'Holiday'  },
    };
    const style = map[status] || { bg: 'bg-gray-100', text: 'text-gray-700', dot: 'bg-gray-400', label: status };
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${style.bg} ${style.text}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
        {style.label}
      </span>
    );
  };

  return (
    <div className="p-4 sm:p-6">
      {/* Gradient Header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-indigo-50 via-white to-white border-b border-gray-100 px-4 sm:px-8 py-4 sm:py-6 -mx-4 sm:-mx-6 -mt-4 sm:-mt-6 mb-6 sm:mb-8">
        <div className="absolute inset-0 opacity-5 bg-[url('data:image/svg+xml,%3Csvg width=%2260%22 height=%2260%22 viewBox=%220 0 60 60%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cg fill=%22none%22 fill-rule=%22evenodd%22%3E%3Cg fill=%22%23000%22 fill-opacity=%221%22%3E%3Cpath d=%22M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')]" />
        <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200">
              <Calendar size={22} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Attendance</h1>
              <p className="text-sm text-gray-500 mt-0.5">Track staff attendance records</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-2 bg-white border border-gray-200 text-gray-600 px-4 py-2.5 rounded-xl hover:bg-gray-50 hover:border-gray-300 shadow-sm hover:shadow hover:-translate-y-0.5 transition-all duration-200 font-medium text-sm"
            >
              <Download size={16} />
              <span className="hidden sm:inline">Export CSV</span>
            </button>
            <button
              onClick={() => setShowMarkModal(true)}
              className="flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-indigo-600 text-white px-5 py-2.5 rounded-xl hover:from-indigo-600 hover:to-indigo-700 shadow-md shadow-indigo-200 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 font-medium text-sm"
            >
              <Plus size={18} />
              <span className="hidden sm:inline">Mark Attendance</span>
              <span className="sm:hidden">Mark</span>
            </button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 sm:gap-6 mb-6 sm:mb-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <Users className="text-gray-600" size={20} />
            <p className="text-gray-600 text-sm">Total Records</p>
          </div>
          <p className="text-3xl font-bold text-gray-800">{summary.total}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="text-emerald-600" size={20} />
            <p className="text-gray-600 text-sm">Present</p>
          </div>
          <p className="text-3xl font-bold text-emerald-600">{summary.present}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <XCircle className="text-red-600" size={20} />
            <p className="text-gray-600 text-sm">Absent</p>
          </div>
          <p className="text-3xl font-bold text-red-600">{summary.absent}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="text-yellow-600" size={20} />
            <p className="text-gray-600 text-sm">Half Day</p>
          </div>
          <p className="text-3xl font-bold text-yellow-600">{summary.halfDay}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="text-emerald-600" size={20} />
            <p className="text-gray-600 text-sm">On Leave</p>
          </div>
          <p className="text-3xl font-bold text-emerald-600">{summary.leave}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-100 shadow-sm px-5 py-4 mb-6">
        <div className="flex items-center gap-3 flex-wrap">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Staff Member</label>
            <select value={filters.staff_id} onChange={(e) => handleFilterChange('staff_id', e.target.value)} className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none transition">
              <option value="">All Staff</option>
              {staff.map(member => (<option key={member.staff_id} value={member.staff_id}>{member.full_name}</option>))}
            </select>
          </div>
          <DateRangeFilter
            standalone={false}
            dateFrom={filters.start_date}
            dateTo={filters.end_date}
            onFromChange={(d) => handleFilterChange('start_date', d)}
            onToChange={(d) => handleFilterChange('end_date', d)}
          />
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
            <select value={filters.status} onChange={(e) => handleFilterChange('status', e.target.value)} className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none transition">
              <option value="all">All Status</option>
              <option value="present">Present</option>
              <option value="absent">Absent</option>
              <option value="half_day">Half Day</option>
              <option value="leave">On Leave</option>
              <option value="holiday">Holiday</option>
            </select>
          </div>
          <button onClick={() => { setPagination(prev => ({ ...prev, page: 1 })); fetchAttendance(); }} className="flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:from-indigo-600 hover:to-indigo-700 shadow-sm hover:shadow hover:-translate-y-0.5 transition-all duration-200 mt-4">
            Apply
          </button>
        </div>
      </div>

      {/* Attendance Table */}
      {loading ? (
        <SkeletonTable rows={6} cols={6} />
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead className="bg-gray-50">
              <tr className="border-b border-gray-100">
                <th className="text-left p-4 font-semibold text-gray-700 whitespace-nowrap">Staff Member</th>
                <th className="text-left p-4 font-semibold text-gray-700">Position</th>
                <th className="text-center p-4 font-semibold text-gray-700">Date</th>
                <th className="text-center p-4 font-semibold text-gray-700">Check In</th>
                <th className="text-center p-4 font-semibold text-gray-700">Check Out</th>
                <th className="text-center p-4 font-semibold text-gray-700">Hours</th>
                <th className="text-center p-4 font-semibold text-gray-700">Status</th>
                <th className="text-left p-4 font-semibold text-gray-700">Notes</th>
                {isAdminOrManager && <th className="text-center p-4 font-semibold text-gray-700">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {attendance.length > 0 ? (
                attendance.map((record: any) => {
                  const hrs = calculateHours(record.check_in, record.check_out);
                  return (
                    <tr key={record.attendance_id} className="border-b border-gray-50 hover:bg-indigo-50/20 transition-colors">
                      <td className="p-4 font-semibold text-gray-800">{record.full_name}</td>
                      <td className="p-4 text-gray-600">{record.position || '-'}</td>
                      <td className="p-4 text-center">{new Date(record.attendance_date).toLocaleDateString()}</td>
                      <td className="p-4 text-center font-mono text-sm">{record.check_in || '-'}</td>
                      <td className="p-4 text-center font-mono text-sm">{record.check_out || '-'}</td>
                      <td className="p-4 text-center font-mono text-sm">
                        {hrs ? (
                          <span className={hrs.isOvertime ? 'text-orange-600 font-bold' : ''}>
                            {hrs.hours.toFixed(1)}h
                            {hrs.isOvertime && <span className="text-xs ml-1">(OT)</span>}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="p-4 text-center">
                        {getStatusBadge(record.status)}
                      </td>
                      <td className="p-4 text-sm text-gray-600 max-w-[150px] truncate">{record.notes || '-'}</td>
                      {isAdminOrManager && (
                        <td className="p-4 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => { setSelectedRecord(record); setShowEditModal(true); }}
                              className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                              title="Edit"
                            >
                              <Edit size={16} />
                            </button>
                            {isAdmin && (
                              <button
                                onClick={() => handleDelete(record)}
                                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                title="Delete"
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={isAdminOrManager ? 9 : 8} className="p-8 text-center text-gray-500">
                    No attendance records found. Mark attendance to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          </div>
          <Pagination
            currentPage={pagination.page}
            totalPages={pagination.totalPages}
            onPageChange={(page) => setPagination({ ...pagination, page })}
            totalItems={pagination.total}
            itemsPerPage={pagination.limit}
            onItemsPerPageChange={(limit) => setPagination(p => ({ ...p, limit, page: 1 }))}
          />
        </div>
      )}

      {/* Modals */}
      <MarkAttendanceModal isOpen={showMarkModal} onClose={() => setShowMarkModal(false)} onSuccess={fetchAttendance} />
      <EditAttendanceModal isOpen={showEditModal} onClose={() => { setShowEditModal(false); setSelectedRecord(null); }} onSuccess={fetchAttendance} record={selectedRecord} />
    </div>
  );
};

export default Attendance;
