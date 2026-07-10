import { useState, useEffect } from 'react';
import { useSettings } from '../../context/SettingsContext';
import { LogOut, Plus, Check, Filter } from 'lucide-react';
import Pagination from '../../components/Pagination';
import api from '../../utils/api';
import { useToast } from '../../components/Toast';
import { localToday } from '../../utils/dateUtils';
import ModalWrapper from '../../components/ModalWrapper';

const EXIT_TYPES = [
  { value: 'resignation',   label: 'Resignation' },
  { value: 'termination',   label: 'Termination' },
  { value: 'retirement',    label: 'Retirement' },
  { value: 'contract_end',  label: 'Contract End' },
];

const ExitModal = ({ staffList, onClose, onSuccess }: any) => {
  const toast = useToast();
  const { currencySymbol: currency } = useSettings();
  const [form, setForm] = useState({
    staff_id: '', exit_type: 'resignation', notice_date: localToday(),
    last_working_date: '', reason: '', final_settlement: '', settlement_notes: '',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.staff_id || !form.exit_type || !form.notice_date) { toast.error('Fill required fields'); return; }
    setLoading(true);
    try {
      await api.post('/staff/exit-requests', form);
      toast.success('Exit request created');
      onSuccess(); onClose();
    } catch (err: any) { toast.error(err.response?.data?.message || 'Failed to create'); }
    finally { setLoading(false); }
  };

  return (
    <ModalWrapper onClose={onClose} maxWidth="max-w-lg">
      <div className="bg-gradient-to-r from-rose-500 to-rose-600 p-6 rounded-t-2xl">
        <h2 className="text-base font-semibold text-white">New Exit Request</h2>
        <p className="text-rose-100 text-xs mt-0.5">Record a resignation, termination or retirement</p>
      </div>
      <div className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Staff Member *</label>
              <select value={form.staff_id} onChange={e => setForm({ ...form, staff_id: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-rose-500/20 focus:border-rose-400 bg-gray-50/50 outline-none transition" required>
                <option value="">Select Staff</option>
                {staffList.map((s: any) => <option key={s.staff_id} value={s.staff_id}>{s.full_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Exit Type *</label>
              <select value={form.exit_type} onChange={e => setForm({ ...form, exit_type: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-rose-500/20 focus:border-rose-400 bg-gray-50/50 outline-none transition">
                {EXIT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Notice Date *</label>
              <input type="date" value={form.notice_date} onChange={e => setForm({ ...form, notice_date: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-rose-500/20 focus:border-rose-400 bg-gray-50/50 outline-none transition" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Last Working Date</label>
              <input type="date" value={form.last_working_date} onChange={e => setForm({ ...form, last_working_date: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-rose-500/20 focus:border-rose-400 bg-gray-50/50 outline-none transition" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Reason</label>
            <textarea value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-rose-500/20 focus:border-rose-400 bg-gray-50/50 outline-none transition resize-none" rows={2} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Final Settlement ({currency})</label>
              <input type="number" min={0} step="0.01" value={form.final_settlement} onChange={e => setForm({ ...form, final_settlement: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-rose-500/20 focus:border-rose-400 bg-gray-50/50 outline-none transition" placeholder="0.00" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Settlement Notes</label>
              <input value={form.settlement_notes} onChange={e => setForm({ ...form, settlement_notes: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-rose-500/20 focus:border-rose-400 bg-gray-50/50 outline-none transition" />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50 transition">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 px-4 py-2.5 bg-gradient-to-r from-rose-500 to-rose-600 text-white rounded-xl text-sm font-semibold hover:from-rose-600 hover:to-rose-700 disabled:opacity-50 transition">
              {loading ? 'Saving...' : 'Create Exit Request'}
            </button>
          </div>
        </form>
      </div>
    </ModalWrapper>
  );
};

const ReviewExitModal = ({ exitReq, onClose, onSuccess }: any) => {
  const toast = useToast();
  const { currencySymbol: currency } = useSettings();
  const [form, setForm] = useState({ status: 'approved', review_notes: '', final_settlement: exitReq.final_settlement || '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await api.put(`/staff/exit-requests/${exitReq.exit_id}/review`, form);
      toast.success(`Exit request ${form.status}`);
      onSuccess(); onClose();
    } catch (err: any) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setLoading(false); }
  };

  return (
    <ModalWrapper onClose={onClose} maxWidth="max-w-md">
      <div className="bg-gradient-to-r from-rose-500 to-rose-600 p-6 rounded-t-2xl">
        <h2 className="text-base font-semibold text-white">Review Exit Request</h2>
        <p className="text-rose-100 text-xs mt-0.5">{exitReq.full_name} — {EXIT_TYPES.find(t => t.value === exitReq.exit_type)?.label}</p>
      </div>
      <div className="p-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Decision</label>
            <div className="flex gap-2">
              {['approved','rejected','completed'].map(s => (
                <button key={s} type="button" onClick={() => setForm({ ...form, status: s })}
                  className={`flex-1 py-2 rounded-xl text-xs font-semibold capitalize border-2 transition ${
                    form.status === s
                      ? s === 'approved' || s === 'completed' ? 'bg-emerald-600 text-white border-green-600' : 'bg-red-600 text-white border-red-600'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}>{s}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Final Settlement ({currency})</label>
            <input type="number" min={0} value={form.final_settlement} onChange={e => setForm({ ...form, final_settlement: e.target.value })}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-rose-500/20 focus:border-rose-400 bg-gray-50/50 outline-none transition" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Review Notes</label>
            <textarea value={form.review_notes} onChange={e => setForm({ ...form, review_notes: e.target.value })}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-rose-500/20 focus:border-rose-400 bg-gray-50/50 outline-none transition resize-none" rows={2} />
          </div>
          {(form.status === 'approved' || form.status === 'completed') && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-xs text-red-700">
              ⚠ This will immediately <b>deactivate</b> the employee — they will be removed from the salary sheet and all active payrolls.
            </div>
          )}
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50 transition">Cancel</button>
          <button onClick={handleSubmit} disabled={loading} className="flex-1 px-4 py-2.5 bg-gradient-to-r from-rose-500 to-rose-600 text-white rounded-xl text-sm font-semibold hover:from-rose-600 hover:to-rose-700 disabled:opacity-50 transition">
            {loading ? 'Saving...' : 'Confirm'}
          </button>
        </div>
      </div>
    </ModalWrapper>
  );
};

const ExitManagement = () => {
  const { currencySymbol: currency } = useSettings();
  const toast = useToast();
  const [exits, setExits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [statusFilter, setStatusFilter] = useState('all');
  const [staffList, setStaffList] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [reviewExit, setReviewExit] = useState<any>(null);

  useEffect(() => { api.get('/staff', { params: { limit: 500 } }).then(r => setStaffList(r.data.data || [])); }, []);
  useEffect(() => { fetchExits(); }, [pagination.page, statusFilter]);

  const fetchExits = async () => {
    setLoading(true);
    try {
      const params: any = { page: pagination.page, limit: pagination.limit };
      if (statusFilter !== 'all') params.status = statusFilter;
      const res = await api.get('/staff/exit-requests', { params });
      setExits(res.data.data || []);
      if (res.data.pagination) setPagination(res.data.pagination);
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { bg: string; text: string; dot: string }> = {
      pending:   { bg: 'bg-yellow-100', text: 'text-yellow-700', dot: 'bg-yellow-500' },
      approved:  { bg: 'bg-emerald-100',  text: 'text-emerald-700',  dot: 'bg-emerald-500' },
      rejected:  { bg: 'bg-red-100',    text: 'text-red-700',    dot: 'bg-red-500' },
      completed: { bg: 'bg-gray-100',   text: 'text-gray-700',   dot: 'bg-gray-400' },
    };
    const s = map[status] || { bg: 'bg-gray-100', text: 'text-gray-700', dot: 'bg-gray-400' };
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${s.bg} ${s.text}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
        {status}
      </span>
    );
  };

  return (
    <div className="p-4 sm:p-6">
      {/* Gradient page header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-rose-50 via-white to-white border-b border-gray-100 px-4 sm:px-8 py-4 sm:py-6 -mx-4 sm:-mx-6 -mt-4 sm:-mt-6 mb-6 sm:mb-8">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=%2260%22 height=%2260%22 viewBox=%220 0 60 60%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cg fill=%22none%22 fill-rule=%22evenodd%22%3E%3Cg fill=%22%23f43f5e%22 fill-opacity=%221%22%3E%3Cpath d=%22M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-5" />
        <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-rose-500 to-rose-600 rounded-2xl flex items-center justify-center shadow-lg shadow-rose-200">
              <LogOut size={22} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Exit Management</h1>
              <p className="text-sm text-gray-500 mt-0.5">Manage resignations, terminations & settlements</p>
            </div>
          </div>
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-gradient-to-r from-rose-500 to-rose-600 text-white px-5 py-2.5 rounded-xl hover:from-rose-600 hover:to-rose-700 shadow-md shadow-rose-200 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 font-medium text-sm">
            <Plus size={16} /> <span className="hidden sm:inline">New </span>Exit Request
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
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPagination(p => ({ ...p, page: 1 })); }}
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-rose-500/20 focus:border-rose-400 outline-none transition">
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[700px]">
          <thead className="bg-gray-50/80 border-b border-gray-100">
            <tr>
              <th className="text-left p-4 font-semibold text-gray-700 whitespace-nowrap">Staff</th>
              <th className="text-center p-4 font-semibold text-gray-700">Exit Type</th>
              <th className="text-center p-4 font-semibold text-gray-700">Notice Date</th>
              <th className="text-center p-4 font-semibold text-gray-700">Last Day</th>
              <th className="text-right p-4 font-semibold text-gray-700">Settlement</th>
              <th className="text-center p-4 font-semibold text-gray-700">Status</th>
              <th className="text-center p-4 font-semibold text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="p-8 text-center text-gray-400">Loading...</td></tr>
            ) : exits.length > 0 ? exits.map((e: any, i: number) => (
              <tr key={e.exit_id}
                className="border-b border-gray-50 hover:bg-rose-50/30 transition-colors group animate-fadeIn"
                style={{ animationDelay: `${i * 40}ms`, animationFillMode: 'both' }}>
                <td className="p-4">
                  <div className="font-semibold text-gray-800">{e.full_name}</div>
                  <div className="text-xs text-gray-500">{e.position || ''} {e.department ? `— ${e.department}` : ''}</div>
                </td>
                <td className="p-4 text-center">
                  <span className="inline-flex items-center gap-1.5 bg-rose-50 text-rose-700 text-xs px-2.5 py-1 rounded-full font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                    {EXIT_TYPES.find(t => t.value === e.exit_type)?.label || e.exit_type}
                  </span>
                </td>
                <td className="p-4 text-center text-gray-600">{new Date(e.notice_date).toLocaleDateString()}</td>
                <td className="p-4 text-center text-gray-600">{e.last_working_date ? new Date(e.last_working_date).toLocaleDateString() : '—'}</td>
                <td className="p-4 text-right font-medium">{currency}{Number(e.final_settlement || 0).toLocaleString()}</td>
                <td className="p-4 text-center">{statusBadge(e.status)}</td>
                <td className="p-4 text-center">
                  {e.status === 'pending' && (
                    <button onClick={() => setReviewExit(e)}
                      className="flex items-center gap-1 text-xs px-3 py-1.5 bg-rose-50 text-rose-700 rounded-lg hover:bg-rose-100 transition mx-auto font-medium">
                      <Check size={12} /> Review
                    </button>
                  )}
                  {e.status !== 'pending' && (
                    <span className="text-xs text-gray-400">{e.reviewed_by_name || '—'}</span>
                  )}
                </td>
              </tr>
            )) : (
              <tr><td colSpan={7} className="p-8 text-center text-gray-400">No exit requests found</td></tr>
            )}
          </tbody>
        </table>
        </div>
        <Pagination currentPage={pagination.page} totalPages={pagination.totalPages}
          onPageChange={p => setPagination(prev => ({ ...prev, page: p }))}
          totalItems={pagination.total} itemsPerPage={pagination.limit}
          onItemsPerPageChange={l => setPagination(p => ({ ...p, limit: l, page: 1 }))} />
      </div>

      {showModal && <ExitModal staffList={staffList} onClose={() => setShowModal(false)} onSuccess={fetchExits} />}
      {reviewExit && <ReviewExitModal exitReq={reviewExit} onClose={() => setReviewExit(null)} onSuccess={fetchExits} />}
    </div>
  );
};

export default ExitManagement;
