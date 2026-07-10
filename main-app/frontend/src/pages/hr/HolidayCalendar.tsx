import { useState, useEffect } from 'react';
import { Calendar, Plus, Edit, Trash2, Filter } from 'lucide-react';
import api from '../../utils/api';
import { useToast } from '../../components/Toast';
import { useConfirm } from '../../components/ConfirmDialog';
import { SkeletonTable } from '../../components/Skeleton';

const HolidayModal = ({ isOpen, onClose, onSuccess, holiday }: any) => {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    holiday_date: '',
    holiday_name: '',
    description: ''
  });

  useEffect(() => {
    if (holiday) {
      setFormData({
        holiday_date: holiday.holiday_date.split('T')[0],
        holiday_name: holiday.holiday_name,
        description: holiday.description || ''
      });
    } else {
      setFormData({ holiday_date: '', holiday_name: '', description: '' });
    }
  }, [holiday]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.holiday_date || !formData.holiday_name) {
      toast.error('Please fill all required fields');
      return;
    }

    setLoading(true);
    try {
      if (holiday) {
        await api.put(`/staff/holidays/${holiday.holiday_id}`, formData);
        toast.success('Holiday updated');
      } else {
        await api.post('/staff/holidays', formData);
        toast.success('Holiday created');
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Operation failed');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-9 h-9 bg-rose-100 rounded-xl flex items-center justify-center">
            <Calendar size={18} className="text-rose-600" />
          </div>
          <h2 className="text-base font-semibold text-gray-800">{holiday ? 'Edit Holiday' : 'Add Holiday'}</h2>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Holiday Date *</label>
              <input type="date" value={formData.holiday_date}
                onChange={(e) => setFormData({ ...formData, holiday_date: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-transparent transition text-sm" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Holiday Name *</label>
              <input type="text" value={formData.holiday_name}
                onChange={(e) => setFormData({ ...formData, holiday_name: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-transparent transition text-sm"
                placeholder="e.g., New Year's Day" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
              <textarea value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-transparent transition text-sm" rows={3} />
            </div>
          </div>
          <div className="flex gap-3 mt-6">
            <button type="button" onClick={onClose}
              className="flex-1 px-6 py-2.5 border border-gray-200 rounded-xl hover:bg-gray-50 transition text-gray-600 font-medium text-sm">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 px-6 py-2.5 bg-gradient-to-r from-rose-500 to-rose-600 text-white rounded-xl hover:from-rose-600 hover:to-rose-700 shadow-md shadow-rose-200 transition-all duration-200 font-medium text-sm disabled:opacity-50">
              {loading ? 'Saving...' : holiday ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const HolidayCalendar = () => {
  const toast = useToast();
  const confirm = useConfirm();
  const [holidays, setHolidays] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedHoliday, setSelectedHoliday] = useState<any>(null);
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear().toString());

  useEffect(() => { fetchHolidays(); }, [yearFilter]);

  const fetchHolidays = async () => {
    setLoading(true);
    try {
      const params = yearFilter ? { year: yearFilter } : {};
      const res = await api.get('/staff/holidays', { params });
      setHolidays(res.data.data || []);
    } catch (err) {
      toast.error('Failed to load holidays');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (holiday: any) => {
    const ok = await confirm({ title: 'Delete Holiday', message: `Delete holiday "${holiday.holiday_name}"?`, type: 'danger' });
    if (!ok) return;
    try {
      await api.delete(`/staff/holidays/${holiday.holiday_id}`);
      toast.success('Holiday deleted');
      fetchHolidays();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete');
    }
  };

  const handleEdit = (holiday: any) => {
    setSelectedHoliday(holiday);
    setShowModal(true);
  };

  const handleAdd = () => {
    setSelectedHoliday(null);
    setShowModal(true);
  };

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 1 + i);

  return (
    <div className="p-4 sm:p-6">
      {/* Gradient Page Header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-rose-50 via-white to-white border-b border-gray-100 px-4 sm:px-8 py-4 sm:py-6 -mx-4 sm:-mx-6 -mt-4 sm:-mt-6 mb-6 sm:mb-8">
        <div className="absolute inset-0 opacity-5 bg-[url('data:image/svg+xml,%3Csvg width=%2260%22 height=%2260%22 viewBox=%220 0 60 60%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cg fill=%22none%22 fill-rule=%22evenodd%22%3E%3Cg fill=%22%23000%22 fill-opacity=%221%22%3E%3Cpath d=%22M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z%22/%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E')]" />
        <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-rose-500 to-rose-600 rounded-2xl flex items-center justify-center shadow-lg shadow-rose-200">
              <Calendar size={22} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Holiday Calendar</h1>
              <p className="text-sm text-gray-500 mt-0.5">Manage company holidays</p>
            </div>
          </div>
          <button onClick={handleAdd}
            className="flex items-center gap-2 bg-gradient-to-r from-rose-500 to-rose-600 text-white px-5 py-2.5 rounded-xl hover:from-rose-600 hover:to-rose-700 shadow-md shadow-rose-200 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 font-medium text-sm">
            <Plus size={16} /> Add Holiday
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 mb-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-rose-50 rounded-2xl flex items-center justify-center">
            <Calendar size={20} className="text-rose-500" />
          </div>
          <div>
            <p className="text-gray-500 text-sm font-medium">Total Holidays {yearFilter && `in ${yearFilter}`}</p>
            <p className="text-3xl font-bold text-rose-600 mt-1">{holidays.length}</p>
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-100 shadow-sm px-5 py-4 mb-6">
        <div className="flex items-center gap-4">
          <Filter size={18} className="text-rose-500 flex-shrink-0" />
          <span className="text-sm font-medium text-gray-600">Year:</span>
          <select value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-transparent transition text-sm">
            <option value="">All Years</option>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <SkeletonTable rows={5} cols={4} />
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full min-w-[500px]">
            <thead className="bg-gradient-to-r from-gray-50 to-white">
              <tr className="border-b border-gray-100">
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Date</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Holiday Name</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Description</th>
                <th className="text-center px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {holidays.length > 0 ? (
                holidays.map((h: any) => (
                  <tr key={h.holiday_id} className="border-b border-gray-50 hover:bg-rose-50/20 transition-colors">
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-700">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                        {new Date(h.holiday_date).toLocaleDateString()}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-semibold text-gray-800">{h.holiday_name}</td>
                    <td className="px-6 py-4 text-gray-500 text-sm">{h.description || '-'}</td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => handleEdit(h)}
                          className="p-2 text-teal-600 hover:bg-teal-50 rounded-lg transition" title="Edit">
                          <Edit size={15} />
                        </button>
                        <button onClick={() => handleDelete(h)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition" title="Delete">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-400">
                    <Calendar size={32} className="mx-auto mb-3 opacity-30" />
                    <p className="font-medium">No holidays found</p>
                    <p className="text-sm mt-1">Add holidays using the button above</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
        </div>
      )}

      <HolidayModal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setSelectedHoliday(null); }}
        onSuccess={fetchHolidays}
        holiday={selectedHoliday}
      />
    </div>
  );
};

export default HolidayCalendar;
