import { useState, useEffect } from 'react';
import { Star, Plus, Pencil, Trash2, Filter } from 'lucide-react';
import Pagination from '../../components/Pagination';
import api from '../../utils/api';
import { useToast } from '../../components/Toast';
import { useConfirm } from '../../components/ConfirmDialog';
import { localToday } from '../../utils/dateUtils';
import { SkeletonTable } from '../../components/Skeleton';
import ModalWrapper from '../../components/ModalWrapper';

const RATINGS = [
  { value: 'excellent',        label: 'Excellent',          color: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  { value: 'good',             label: 'Good',               color: 'bg-emerald-100 text-emerald-700',     dot: 'bg-emerald-500' },
  { value: 'satisfactory',     label: 'Satisfactory',       color: 'bg-blue-100 text-blue-700',       dot: 'bg-blue-500' },
  { value: 'needs_improvement',label: 'Needs Improvement',  color: 'bg-yellow-100 text-yellow-700',   dot: 'bg-yellow-500' },
  { value: 'poor',             label: 'Poor',               color: 'bg-red-100 text-red-700',         dot: 'bg-red-500' },
];

const AppraisalModal = ({ appraisal, staffList, onClose, onSuccess }: any) => {
  const toast = useToast();
  const [form, setForm] = useState({
    staff_id:        appraisal?.staff_id || '',
    appraisal_date:  appraisal?.appraisal_date?.slice(0, 10) || localToday(),
    period_from:     appraisal?.period_from?.slice(0, 10) || '',
    period_to:       appraisal?.period_to?.slice(0, 10) || '',
    rating:          appraisal?.rating || 'good',
    goals_achieved:  appraisal?.goals_achieved || '',
    strengths:       appraisal?.strengths || '',
    improvements:    appraisal?.improvements || '',
    overall_comments: appraisal?.overall_comments || '',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.staff_id || !form.rating) { toast.error('Staff and rating required'); return; }
    setLoading(true);
    try {
      if (appraisal) {
        await api.put(`/staff/appraisals/${appraisal.appraisal_id}`, form);
        toast.success('Appraisal updated');
      } else {
        await api.post('/staff/appraisals', form);
        toast.success('Appraisal created');
      }
      onSuccess(); onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save');
    } finally { setLoading(false); }
  };

  return (
    <ModalWrapper onClose={onClose} maxWidth="max-w-2xl">
      <div className="bg-gradient-to-r from-amber-500 to-amber-600 p-6 rounded-t-2xl">
        <h2 className="text-base font-semibold text-white">{appraisal ? 'Edit Appraisal' : 'New Performance Appraisal'}</h2>
        <p className="text-amber-100 text-xs mt-0.5">{appraisal ? 'Update appraisal details' : 'Record an employee performance review'}</p>
      </div>
      <div className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Staff Member *</label>
              <select value={form.staff_id} onChange={e => setForm({ ...form, staff_id: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 bg-gray-50/50 outline-none transition" disabled={!!appraisal} required>
                <option value="">Select Staff</option>
                {staffList.map((s: any) => <option key={s.staff_id} value={s.staff_id}>{s.full_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Appraisal Date *</label>
              <input type="date" value={form.appraisal_date} onChange={e => setForm({ ...form, appraisal_date: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 bg-gray-50/50 outline-none transition" required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Period From</label>
              <input type="date" value={form.period_from} onChange={e => setForm({ ...form, period_from: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 bg-gray-50/50 outline-none transition" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Period To</label>
              <input type="date" value={form.period_to} onChange={e => setForm({ ...form, period_to: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 bg-gray-50/50 outline-none transition" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Overall Rating *</label>
            <div className="flex flex-wrap gap-2">
              {RATINGS.map(r => (
                <button key={r.value} type="button"
                  onClick={() => setForm({ ...form, rating: r.value })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border-2 transition ${form.rating === r.value ? r.color + ' border-current' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                  {r.label}
                </button>
              ))}
            </div>
          </div>
          {[
            { key: 'goals_achieved',  label: 'Goals Achieved' },
            { key: 'strengths',       label: 'Strengths' },
            { key: 'improvements',    label: 'Areas for Improvement' },
            { key: 'overall_comments',label: 'Overall Comments' },
          ].map(({ key, label }) => (
            <div key={key}>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
              <textarea value={(form as any)[key]} onChange={e => setForm({ ...form, [key]: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 bg-gray-50/50 outline-none transition resize-none" rows={2} />
            </div>
          ))}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50 transition">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-xl text-sm font-semibold hover:from-amber-600 hover:to-amber-700 disabled:opacity-50 transition">
              {loading ? 'Saving...' : appraisal ? 'Update' : 'Save Appraisal'}
            </button>
          </div>
        </form>
      </div>
    </ModalWrapper>
  );
};

const Appraisals = () => {
  const toast = useToast();
  const confirm = useConfirm();
  const [appraisals, setAppraisals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [staffList, setStaffList] = useState<any[]>([]);
  const [staffFilter, setStaffFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editAppraisal, setEditAppraisal] = useState<any>(null);

  useEffect(() => { api.get('/staff', { params: { limit: 500 } }).then(r => setStaffList(r.data.data || [])); }, []);
  useEffect(() => { fetchAppraisals(); }, [pagination.page, staffFilter]);

  const fetchAppraisals = async () => {
    setLoading(true);
    try {
      const params: any = { page: pagination.page, limit: pagination.limit };
      if (staffFilter) params.staff_id = staffFilter;
      const res = await api.get('/staff/appraisals', { params });
      setAppraisals(res.data.data || []);
      if (res.data.pagination) setPagination(res.data.pagination);
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  };

  const handleDelete = async (id: number) => {
    const ok = await confirm({ title: 'Delete Appraisal', message: 'Delete this appraisal?', type: 'danger' });
    if (!ok) return;
    try { await api.delete(`/staff/appraisals/${id}`); toast.success('Deleted'); fetchAppraisals(); }
    catch (err: any) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const ratingBadge = (rating: string) => {
    const r = RATINGS.find(x => x.value === rating);
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${r?.color || 'bg-gray-100 text-gray-600'}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${r?.dot || 'bg-gray-400'}`} />
        {r?.label || rating}
      </span>
    );
  };

  return (
    <div className="p-8">
      {/* Gradient page header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-amber-50 via-white to-white border-b border-gray-100 px-8 py-6 -mx-8 -mt-8 mb-8">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=%2260%22 height=%2260%22 viewBox=%220 0 60 60%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cg fill=%22none%22 fill-rule=%22evenodd%22%3E%3Cg fill=%22%23f59e0b%22 fill-opacity=%221%22%3E%3Cpath d=%22M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-5" />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-200">
              <Star size={22} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Performance Appraisals</h1>
              <p className="text-sm text-gray-500 mt-0.5">Track employee performance reviews</p>
            </div>
          </div>
          <button onClick={() => { setEditAppraisal(null); setShowModal(true); }}
            className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 text-white px-5 py-2.5 rounded-xl hover:from-amber-600 hover:to-amber-700 shadow-md shadow-amber-200 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 font-medium text-sm">
            <Plus size={16} /> New Appraisal
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-100 shadow-sm px-5 py-4 mb-6">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-gray-400">
            <Filter size={16} />
            <span className="text-sm font-medium text-gray-600">Filter</span>
          </div>
          <select value={staffFilter} onChange={e => { setStaffFilter(e.target.value); setPagination(p => ({ ...p, page: 1 })); }}
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 outline-none transition min-w-[200px]">
            <option value="">All Staff</option>
            {staffList.map(s => <option key={s.staff_id} value={s.staff_id}>{s.full_name}</option>)}
          </select>
        </div>
      </div>

      {loading ? <SkeletonTable rows={5} cols={7} /> : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50/80 border-b border-gray-100">
              <tr>
                <th className="text-left p-4 font-semibold text-gray-700">Staff</th>
                <th className="text-center p-4 font-semibold text-gray-700">Date</th>
                <th className="text-center p-4 font-semibold text-gray-700">Period</th>
                <th className="text-center p-4 font-semibold text-gray-700">Rating</th>
                <th className="text-left p-4 font-semibold text-gray-700">Comments</th>
                <th className="text-left p-4 font-semibold text-gray-700">Appraised By</th>
                <th className="text-center p-4 font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {appraisals.length === 0 && (
                <tr><td colSpan={7} className="p-8 text-center text-gray-400">No appraisals found</td></tr>
              )}
              {appraisals.map((a, i) => (
                <tr
                  key={a.appraisal_id}
                  className="border-b border-gray-50 hover:bg-amber-50/30 transition-colors group animate-fadeIn"
                  style={{ animationDelay: `${i * 40}ms`, animationFillMode: 'both' }}
                >
                  <td className="p-4">
                    <div className="font-semibold text-gray-800">{a.full_name}</div>
                    <div className="text-xs text-gray-500">{a.department || ''}</div>
                  </td>
                  <td className="p-4 text-center text-gray-600">{new Date(a.appraisal_date).toLocaleDateString()}</td>
                  <td className="p-4 text-center text-xs text-gray-500">
                    {a.period_from ? `${new Date(a.period_from).toLocaleDateString()} – ${new Date(a.period_to).toLocaleDateString()}` : '—'}
                  </td>
                  <td className="p-4 text-center">{ratingBadge(a.rating)}</td>
                  <td className="p-4 text-gray-600 max-w-xs truncate">{a.overall_comments || '—'}</td>
                  <td className="p-4 text-gray-600 text-sm">{a.appraised_by_name || '—'}</td>
                  <td className="p-4 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => { setEditAppraisal(a); setShowModal(true); }}
                        className="p-2 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all"><Pencil size={14} /></button>
                      <button onClick={() => handleDelete(a.appraisal_id)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination currentPage={pagination.page} totalPages={pagination.totalPages}
            onPageChange={p => setPagination(prev => ({ ...prev, page: p }))}
            totalItems={pagination.total} itemsPerPage={pagination.limit}
            onItemsPerPageChange={l => setPagination(p => ({ ...p, limit: l, page: 1 }))} />
        </div>
      )}

      {showModal && <AppraisalModal appraisal={editAppraisal} staffList={staffList} onClose={() => setShowModal(false)} onSuccess={fetchAppraisals} />}
    </div>
  );
};

export default Appraisals;
