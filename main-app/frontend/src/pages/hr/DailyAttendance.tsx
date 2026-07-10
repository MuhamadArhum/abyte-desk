import { useState, useEffect } from 'react';
import { Calendar, Clock, CheckCircle, XCircle, AlertCircle, MinusCircle, Download, UserCheck } from 'lucide-react';
import api from '../../utils/api';
import { useToast } from '../../components/Toast';
import { useConfirm } from '../../components/ConfirmDialog';
import { localToday } from '../../utils/dateUtils';
import ReportPasswordGate from '../../components/ReportPasswordGate';

const DailyAttendance = () => {
  const toast = useToast();
  const confirm = useConfirm();
  const [date, setDate] = useState(localToday());
  const [data, setData] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({ total: 0, present: 0, absent: 0, half_day: 0, leave: 0, holiday: 0, unmarked: 0 });
  const [loading, setLoading] = useState(false);
  const [markingId, setMarkingId] = useState<number | null>(null);

  useEffect(() => { fetchDaily(); }, [date]);

  const fetchDaily = async () => {
    setLoading(true);
    try {
      const res = await api.get('/staff/reports/daily-attendance', { params: { date } });
      setData(res.data.data || []);
      setSummary(res.data.summary || {});
    } catch (err: any) {
      toast.error('Failed to load attendance');
    } finally {
      setLoading(false);
    }
  };

  const quickMark = async (staffId: number, status: string, attendanceId: number | null) => {
    setMarkingId(staffId);
    try {
      if (attendanceId) {
        await api.put(`/staff/attendance/${attendanceId}`, {
          status,
          check_in: status === 'present' ? '09:00' : null,
          check_out: null
        });
      } else {
        await api.post('/staff/attendance', {
          staff_id: staffId,
          attendance_date: date,
          status,
          check_in: status === 'present' ? '09:00' : null,
          check_out: null
        });
      }
      toast.success(`Marked as ${status.replace('_', ' ')}`);
      fetchDaily();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to mark');
    } finally {
      setMarkingId(null);
    }
  };

  const markAllPresent = async () => {
    const unmarked = data.filter(r => !r.status);
    if (unmarked.length === 0) { toast.info('No unmarked staff'); return; }
    const ok = await confirm({ title: 'Mark All Present', message: `Mark ${unmarked.length} staff as present?`, type: 'warning' });
    if (!ok) return;

    try {
      await api.post('/staff/attendance/bulk', {
        records: unmarked.map(r => ({
          staff_id: r.staff_id,
          attendance_date: date,
          status: 'present',
          check_in: '09:00'
        }))
      });
      toast.success(`${unmarked.length} staff marked present`);
      fetchDaily();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to bulk mark');
    }
  };

  const exportCSV = () => {
    if (data.length === 0) return;
    const headers = ['Emp ID', 'Name', 'Department', 'Check In', 'Check Out', 'Hours', 'Status'];
    const rows = data.map(r => {
      const hours = calculateHours(r.check_in, r.check_out);
      return [
        r.employee_id || '',
        `"${r.full_name}"`,
        r.department || '',
        r.check_in || '',
        r.check_out || '',
        hours ? hours.toFixed(1) : '',
        r.status || 'unmarked'
      ];
    });
    const csv = [`Daily Attendance - ${date}`, '', headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `daily_attendance_${date}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const getStatusBadge = (status: string | null) => {
    if (!status) return <span className="px-2 py-1 bg-gray-100 text-gray-500 rounded-full text-xs font-medium">Unmarked</span>;
    const map: Record<string, { bg: string; icon: any }> = {
      present: { bg: 'bg-emerald-100 text-emerald-700', icon: <CheckCircle size={14} className="inline mr-1" /> },
      absent: { bg: 'bg-red-100 text-red-700', icon: <XCircle size={14} className="inline mr-1" /> },
      half_day: { bg: 'bg-yellow-100 text-yellow-700', icon: <AlertCircle size={14} className="inline mr-1" /> },
      leave: { bg: 'bg-emerald-100 text-emerald-700', icon: <MinusCircle size={14} className="inline mr-1" /> },
      holiday: { bg: 'bg-emerald-100 text-emerald-700', icon: <CheckCircle size={14} className="inline mr-1" /> },
    };
    const s = map[status] || { bg: 'bg-gray-100 text-gray-700', icon: null };
    return <span className={`px-2 py-1 rounded-full text-xs font-medium ${s.bg}`}>{s.icon}{status.replace('_', ' ')}</span>;
  };

  const calculateHours = (checkIn: string, checkOut: string) => {
    if (!checkIn || !checkOut) return null;
    const [inH, inM] = checkIn.split(':').map(Number);
    const [outH, outM] = checkOut.split(':').map(Number);
    const hours = ((outH * 60 + outM) - (inH * 60 + inM)) / 60;
    return hours > 0 ? hours : null;
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <Calendar className="text-emerald-600" size={20} />
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-gray-900">Daily Attendance</h1>
            <p className="text-gray-600 text-sm mt-1">All employees attendance for a specific day</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={exportCSV} className="flex items-center gap-2 bg-gray-100 text-gray-700 px-4 py-2.5 rounded-xl hover:bg-gray-200 transition border border-gray-200">
            <Download size={18} /> <span className="hidden sm:inline">Export</span>
          </button>
          {summary.unmarked > 0 && (
            <button onClick={markAllPresent} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-xl hover:bg-emerald-700 transition shadow">
              <UserCheck size={18} /> <span className="hidden sm:inline">Mark All Present ({summary.unmarked})</span><span className="sm:hidden">Mark All ({summary.unmarked})</span>
            </button>
          )}
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-8">
        {[
          { label: 'Total', value: summary.total, color: 'text-gray-800' },
          { label: 'Present', value: summary.present, color: 'text-emerald-600' },
          { label: 'Absent', value: summary.absent, color: 'text-red-600' },
          { label: 'Half Day', value: summary.half_day, color: 'text-yellow-600' },
          { label: 'Leave', value: summary.leave, color: 'text-emerald-600' },
          { label: 'Holiday', value: summary.holiday, color: 'text-emerald-600' },
          { label: 'Unmarked', value: summary.unmarked, color: 'text-gray-500' },
        ].map(card => (
          <div key={card.label} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 text-center">
            <p className="text-gray-600 text-xs">{card.label}</p>
            <p className={`text-2xl font-bold mt-1 ${card.color}`}>{card.value || 0}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[700px]">
          <thead className="bg-gray-50">
            <tr className="border-b">
              <th className="text-left p-4 font-semibold text-gray-700">Emp. ID</th>
              <th className="text-left p-4 font-semibold text-gray-700">Name</th>
              <th className="text-left p-4 font-semibold text-gray-700">Department</th>
              <th className="text-center p-4 font-semibold text-gray-700">Check In</th>
              <th className="text-center p-4 font-semibold text-gray-700">Check Out</th>
              <th className="text-center p-4 font-semibold text-gray-700">Hours</th>
              <th className="text-center p-4 font-semibold text-gray-700">Status</th>
              <th className="text-center p-4 font-semibold text-gray-700">Quick Mark</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="p-8 text-center text-gray-500">Loading...</td></tr>
            ) : data.length > 0 ? (
              data.map((row: any) => {
                const hours = calculateHours(row.check_in, row.check_out);
                const isMarking = markingId === row.staff_id;
                return (
                  <tr key={row.staff_id} className={`border-b hover:bg-gray-50 transition ${!row.status ? 'bg-yellow-50/50' : ''}`}>
                    <td className="p-4 font-mono text-sm text-gray-600">{row.employee_id || '-'}</td>
                    <td className="p-4 font-semibold text-gray-800">{row.full_name}</td>
                    <td className="p-4 text-gray-600">{row.department || '-'}</td>
                    <td className="p-4 text-center">
                      {row.check_in ? (
                        <span className="flex items-center justify-center gap-1 text-gray-700">
                          <Clock size={14} className="text-gray-400" />{row.check_in}
                        </span>
                      ) : '-'}
                    </td>
                    <td className="p-4 text-center">
                      {row.check_out ? (
                        <span className="flex items-center justify-center gap-1 text-gray-700">
                          <Clock size={14} className="text-gray-400" />{row.check_out}
                        </span>
                      ) : '-'}
                    </td>
                    <td className="p-4 text-center">
                      {hours ? (
                        <span className={`font-medium ${hours > 8 ? 'text-orange-600' : 'text-gray-700'}`}>
                          {hours.toFixed(1)}h {hours > 8 && <span className="text-xs font-bold">(OT)</span>}
                        </span>
                      ) : '-'}
                    </td>
                    <td className="p-4 text-center">{getStatusBadge(row.status)}</td>
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {[
                          { status: 'present', label: 'P', active: 'bg-emerald-500 text-white', idle: 'bg-emerald-100 text-emerald-700 hover:bg-green-200' },
                          { status: 'absent', label: 'A', active: 'bg-red-500 text-white', idle: 'bg-red-100 text-red-700 hover:bg-red-200' },
                          { status: 'leave', label: 'L', active: 'bg-emerald-500 text-white', idle: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' },
                          { status: 'half_day', label: 'H', active: 'bg-yellow-500 text-white', idle: 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200' },
                        ].map(btn => (
                          <button key={btn.status}
                            onClick={() => quickMark(row.staff_id, btn.status, row.attendance_id ?? null)}
                            disabled={isMarking}
                            title={btn.status.replace('_', ' ')}
                            className={`px-2 py-1 rounded text-xs font-medium transition disabled:opacity-50 ${row.status === btn.status ? btn.active : btn.idle}`}>
                            {btn.label}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr><td colSpan={8} className="p-8 text-center text-gray-500">No staff found</td></tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
};

const DailyAttendanceWithGate = () => <ReportPasswordGate><DailyAttendance /></ReportPasswordGate>;
export default DailyAttendanceWithGate;
