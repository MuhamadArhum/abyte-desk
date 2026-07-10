import { useState, useEffect } from 'react';
import { useSettings } from '../../context/SettingsContext';
import { CreditCard, Plus, Download } from 'lucide-react';
import Pagination from '../../components/Pagination';
import api from '../../utils/api';
import { localToday } from '../../utils/dateUtils';
import { useToast } from '../../components/Toast';
import { SkeletonTable } from '../../components/Skeleton';

interface AdvancePaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const AdvancePaymentModal = ({ isOpen, onClose, onSuccess }: AdvancePaymentModalProps) => {
  const { currencySymbol: currency } = useSettings();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    staff_id: '',
    amount: '',
    payment_date: localToday(),
    payment_method: 'cash',
    reason: ''
  });

  useEffect(() => {
    if (isOpen) {
      api.get('/staff', { params: { is_active: 1, limit: 200 } })
        .then(r => setStaffList(r.data.data || []))
        .catch(() => {});
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.staff_id || !formData.amount || !formData.payment_date) {
      toast.error('Please fill all required fields');
      return;
    }

    setLoading(true);
    try {
      await api.post('/staff/advance-payments', formData);
      toast.success('Advance payment recorded');
      onSuccess();
      onClose();
      setFormData({ staff_id: '', amount: '', payment_date: localToday(), payment_method: 'cash', reason: '' });
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to record payment');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-9 h-9 bg-orange-100 rounded-xl flex items-center justify-center">
            <CreditCard size={18} className="text-orange-600" />
          </div>
          <h2 className="text-base font-semibold text-gray-800">Record Advance Payment</h2>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Staff Member *</label>
              <select value={formData.staff_id} onChange={(e) => setFormData({ ...formData, staff_id: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition text-sm" required>
                <option value="">Select Staff</option>
                {staffList.map(s => (
                  <option key={s.staff_id} value={s.staff_id}>
                    {s.employee_id ? `[${s.employee_id}] ` : ''}{s.full_name} {s.department ? `- ${s.department}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Amount *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">{currency}</span>
                <input type="number" step="0.01" min="0.01" value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="w-full pl-8 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition text-sm" required />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Payment Date *</label>
              <input type="date" value={formData.payment_date}
                onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition text-sm" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Payment Method</label>
              <select value={formData.payment_method} onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition text-sm">
                <option value="cash">Cash</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="cheque">Cheque</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Reason</label>
              <textarea value={formData.reason} onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition text-sm" rows={3} />
            </div>
          </div>
          <div className="flex gap-3 mt-6">
            <button type="button" onClick={onClose}
              className="flex-1 px-6 py-2.5 border border-gray-200 rounded-xl hover:bg-gray-50 transition text-gray-600 font-medium text-sm">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 px-6 py-2.5 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl hover:from-orange-600 hover:to-orange-700 shadow-md shadow-orange-200 transition-all duration-200 font-medium text-sm disabled:opacity-50">
              {loading ? 'Recording...' : 'Record Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const AdvancePayments = () => {
  const { currencySymbol: currency } = useSettings();
  const toast = useToast();
  const [advances, setAdvances] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [showModal, setShowModal] = useState(false);
  const [staffFilter, setStaffFilter] = useState('');
  const [staffList, setStaffList] = useState<any[]>([]);

  useEffect(() => {
    api.get('/staff', { params: { limit: 200 } }).then(r => setStaffList(r.data.data || [])).catch(() => {});
  }, []);

  useEffect(() => { fetchAdvances(); }, [pagination.page, staffFilter]);

  const fetchAdvances = async () => {
    setLoading(true);
    try {
      const params: any = { page: pagination.page, limit: pagination.limit };
      if (staffFilter) params.staff_id = staffFilter;
      const res = await api.get('/staff/advance-payments', { params });
      setAdvances(res.data.data || []);
      if (res.data.pagination) setPagination(res.data.pagination);
    } catch (err) {
      toast.error('Failed to load advance payments');
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = () => {
    if (advances.length === 0) return;
    const headers = ['Date', 'Employee', 'Department', 'Amount', 'Method', 'Reason'];
    const rows = advances.map(a => [
      new Date(a.payment_date).toLocaleDateString(),
      `"${a.full_name}"`,
      a.department || '',
      Number(a.amount).toFixed(0),
      (a.payment_method || '').replace('_', ' '),
      `"${(a.reason || '').replace(/"/g, '""')}"`
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `advance_payments_${localToday()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const totalAdvances = advances.reduce((sum, a) => sum + Number(a.amount || 0), 0);

  return (
    <div className="p-4 sm:p-6">
      {/* Gradient Page Header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-orange-50 via-white to-white border-b border-gray-100 px-4 sm:px-8 py-4 sm:py-6 -mx-4 sm:-mx-6 -mt-4 sm:-mt-6 mb-6 sm:mb-8">
        <div className="absolute inset-0 opacity-5 bg-[url('data:image/svg+xml,%3Csvg width=%2260%22 height=%2260%22 viewBox=%220 0 60 60%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cg fill=%22none%22 fill-rule=%22evenodd%22%3E%3Cg fill=%22%23000%22 fill-opacity=%221%22%3E%3Cpath d=%22M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z%22/%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E')]" />
        <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-200">
              <CreditCard size={22} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Advance Payments</h1>
              <p className="text-sm text-gray-500 mt-0.5">Manage staff advance payments</p>
            </div>
          </div>
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white px-5 py-2.5 rounded-xl hover:from-orange-600 hover:to-orange-700 shadow-md shadow-orange-200 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 font-medium text-sm">
            <Plus size={16} /> <span className="hidden sm:inline">Record </span>Advance
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200">
          <p className="text-gray-500 text-sm font-medium">Total Advances</p>
          <p className="text-3xl font-bold text-gray-800 mt-2">{pagination.total}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200">
          <p className="text-gray-500 text-sm font-medium">Total Amount (Filtered)</p>
          <p className="text-3xl font-bold text-orange-600 mt-2">{currency}{totalAdvances.toLocaleString()}</p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-100 shadow-sm px-5 py-4 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <select value={staffFilter} onChange={(e) => { setStaffFilter(e.target.value); setPagination(p => ({ ...p, page: 1 })); }}
            className="px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition text-sm min-w-[200px]">
            <option value="">All Staff</option>
            {staffList.map(s => <option key={s.staff_id} value={s.staff_id}>{s.employee_id ? `[${s.employee_id}] ` : ''}{s.full_name}</option>)}
          </select>
          {advances.length > 0 && (
            <button onClick={exportCSV}
              className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 px-3 py-2 rounded-lg transition ml-auto">
              <Download size={15} /> Export CSV
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <SkeletonTable rows={5} cols={5} />
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead className="bg-gradient-to-r from-gray-50 to-white">
              <tr className="border-b border-gray-100">
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Date</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Employee</th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
                <th className="text-center px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Method</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Reason</th>
              </tr>
            </thead>
            <tbody>
              {advances.length > 0 ? (
                advances.map((adv: any) => (
                  <tr key={adv.advance_id} className="border-b border-gray-50 hover:bg-orange-50/20 transition-colors">
                    <td className="px-6 py-4 text-gray-500 text-sm">{new Date(adv.payment_date).toLocaleDateString()}</td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-gray-800">{adv.full_name}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{adv.employee_id || ''} {adv.department ? `- ${adv.department}` : ''}</div>
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-orange-600">{currency}{Number(adv.amount).toLocaleString()}</td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-700 capitalize">
                        <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                        {(adv.payment_method || '').replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-500 text-sm">{adv.reason || '-'}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                    <CreditCard size={32} className="mx-auto mb-3 opacity-30" />
                    <p className="font-medium">No advance payments found</p>
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

      <AdvancePaymentModal isOpen={showModal} onClose={() => setShowModal(false)} onSuccess={fetchAdvances} />
    </div>
  );
};

export default AdvancePayments;
