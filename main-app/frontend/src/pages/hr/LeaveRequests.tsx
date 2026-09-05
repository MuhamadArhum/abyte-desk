import { useState, useEffect } from 'react';
import { FileText, Plus, Check, X, Filter, MessageSquare } from 'lucide-react';
import Pagination from '../../components/Pagination';
import api from '../../utils/api';
import { useToast } from '../../components/Toast';
import { SkeletonTable } from '../../components/Skeleton';
import ModalWrapper from '../../components/ModalWrapper';

// ── Review Modal (replaces window.prompt) ────────────────────
const ReviewModal = ({ request, action, onClose, onSuccess }: {
  request: any; action: 'approved' | 'rejected'; onClose: () => void; onSuccess: () => void;
}) => {
  const toast = useToast();
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await api.put(`/staff/leave-requests/${request.request_id}/review`, { status: action, review_notes: notes });
      toast.success(`Leave request ${action}`);
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to review');
    } finally {
      setLoading(false);
    }
  };

  const isApprove = action === 'approved';

  return (
    <ModalWrapper open onClose={onClose} maxWidth="max-w-md">
      <div className={`px-6 py-4 rounded-t-2xl flex items-center gap-3 ${isApprove ? 'bg-gradient-to-r from-emerald-500 to-emerald-600' : 'bg-gradient-to-r from-red-500 to-red-600'}`}>
        <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">
          {isApprove ? <Check size={18} className="text-white" /> : <X size={18} className="text-white" />}
        </div>
        <div>
          <h2 className="text-base font-semibold text-white">
            {isApprove ? 'Approve' : 'Reject'} Leave Request
          </h2>
          <p className="text-xs text-white/80 mt-0.5">
            {request.full_name} — {request.days} day(s) {request.leave_type} leave
          </p>
        </div>
      </div>
      <div className="p-6">
        <div className="mb-5">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            <MessageSquare size={14} className="inline mr-1" />
            Review Notes <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <textarea
            autoFocus
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition resize-none"
            placeholder="Enter any remarks..."
          />
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50 transition">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={loading}
            className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition ${isApprove ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700' : 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700'}`}>
            {loading ? 'Saving...' : isApprove ? 'Approve' : 'Reject'}
          </button>
        </div>
      </div>
    </ModalWrapper>
  );
};

const LeaveRequestModal = ({ isOpen, onClose, onSuccess }: any) => {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    staff_id: '',
    leave_type: 'annual',
    from_date: '',
    to_date: '',
    reason: ''
  });

  useEffect(() => {
    if (isOpen) {
      api.get('/staff', { params: { is_active: 1, limit: 200 } })
        .then(r => setStaffList(r.data.data || []))
        .catch(() => { toast.error('Failed to load staff list'); });
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.staff_id || !formData.from_date || !formData.to_date) {
      toast.error('Please fill all required fields');
      return;
    }
    if (formData.from_date > formData.to_date) {
      toast.error('From date must be before to date');
      return;
    }

    setLoading(true);
    try {
      await api.post('/staff/leave-requests', formData);
      toast.success('Leave request submitted');
      onSuccess();
      onClose();
      setFormData({ staff_id: '', leave_type: 'annual', from_date: '', to_date: '', reason: '' });
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to submit');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
        <h2 className="text-base font-semibold text-gray-800 mb-6">New Leave Request</h2>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Staff Member *</label>
              <select value={formData.staff_id} onChange={(e) => setFormData({ ...formData, staff_id: e.target.value })}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition" required>
                <option value="">Select Staff</option>
                {staffList.map(s => (
                  <option key={s.staff_id} value={s.staff_id}>
                    {s.employee_id ? `[${s.employee_id}] ` : ''}{s.full_name} {s.department ? `- ${s.department}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Leave Type *</label>
              <select value={formData.leave_type} onChange={(e) => setFormData({ ...formData, leave_type: e.target.value })}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition">
                <option value="annual">Annual Leave</option>
                <option value="sick">Sick Leave</option>
                <option value="emergency">Emergency Leave</option>
                <option value="unpaid">Unpaid Leave</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">From Date *</label>
              <input type="date" value={formData.from_date}
                onChange={(e) => setFormData({ ...formData, from_date: e.target.value })}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">To Date *</label>
              <input type="date" value={formData.to_date}
                onChange={(e) => setFormData({ ...formData, to_date: e.target.value })}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Reason</label>
              <textarea value={formData.reason} onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition" rows={3} />
            </div>
          </div>
          <div className="flex gap-3 mt-6">
            <button type="button" onClick={onClose}
              className="flex-1 px-6 py-3 border border-gray-300 rounded-xl hover:bg-gray-50 transition text-sm font-medium">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 transition disabled:opacity-50 text-sm font-semibold">
              {loading ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const LeaveRequests = () => {
  const toast = useToast();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [showModal, setShowModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [staffFilter, setStaffFilter] = useState('');
  const [staffList, setStaffList] = useState<any[]>([]);
  const [reviewModal, setReviewModal] = useState<{ request: any; action: 'approved' | 'rejected' } | null>(null);

  useEffect(() => {
    api.get('/staff', { params: { limit: 200 } }).then(r => setStaffList(r.data.data || [])).catch(() => { toast.error('Failed to load staff list'); });
  }, []);

  useEffect(() => { fetchRequests(); }, [pagination.page, statusFilter, staffFilter]);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const params: any = { page: pagination.page, limit: pagination.limit };
      if (statusFilter !== 'all') params.status = statusFilter;
      if (staffFilter) params.staff_id = staffFilter;
      const res = await api.get('/staff/leave-requests', { params });
      setRequests(res.data.data || []);
      if (res.data.pagination) setPagination(res.data.pagination);
    } catch (err) {
      toast.error('Failed to load leave requests');
    } finally {
      setLoading(false);
    }
  };

  const handleReview = (request: any, action: 'approved' | 'rejected') => {
    setReviewModal({ request, action });
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { bg: string; text: string; dot: string }> = {
      pending:  { bg: 'bg-amber-100',  text: 'text-amber-700',  dot: 'bg-amber-500'  },
      approved: { bg: 'bg-emerald-100',  text: 'text-emerald-700',  dot: 'bg-emerald-500'  },
      rejected: { bg: 'bg-red-100',    text: 'text-red-700',    dot: 'bg-red-500'    },
    };
    const style = map[status] || { bg: 'bg-gray-100', text: 'text-gray-700', dot: 'bg-gray-400' };
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${style.bg} ${style.text}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
        {status}
      </span>
    );
  };

  const leaveTypeBadge = (type: string) => {
    const map: Record<string, string> = {
      annual: 'bg-emerald-100 text-emerald-700',
      sick: 'bg-orange-100 text-orange-700',
      emergency: 'bg-red-100 text-red-700',
      unpaid: 'bg-gray-100 text-gray-700',
      other: 'bg-emerald-100 text-emerald-700'
    };
    return <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${map[type] || 'bg-gray-100 text-gray-700'}`}>{type.replace('_', ' ')}</span>;
  };

  const pendingCount = requests.filter(r => r.status === 'pending').length;

  return (
    <div className="p-4 sm:p-6">
      {/* Gradient Header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-blue-50 via-white to-white border-b border-gray-100 px-4 sm:px-8 py-4 sm:py-6 -mx-4 sm:-mx-6 -mt-4 sm:-mt-6 mb-6 sm:mb-8">
        <div className="absolute inset-0 opacity-5 bg-[url('data:image/svg+xml,%3Csvg width=%2260%22 height=%2260%22 viewBox=%220 0 60 60%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cg fill=%22none%22 fill-rule=%22evenodd%22%3E%3Cg fill=%22%23000%22 fill-opacity=%221%22%3E%3Cpath d=%22M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')]" />
        <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200">
              <FileText size={22} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Leave Requests</h1>
              <p className="text-sm text-gray-500 mt-0.5">Manage employee leave applications</p>
            </div>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white px-5 py-2.5 rounded-xl hover:from-blue-600 hover:to-blue-700 shadow-md shadow-blue-200 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 font-medium text-sm"
          >
            <Plus size={18} /> New Request
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <p className="text-gray-600 text-sm">Total Requests</p>
          <p className="text-3xl font-bold text-gray-800 mt-2">{pagination.total}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-yellow-100 border-2">
          <p className="text-gray-600 text-sm">Pending Review</p>
          <p className="text-3xl font-bold text-yellow-600 mt-2">{pendingCount}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <p className="text-gray-600 text-sm">Approved</p>
          <p className="text-3xl font-bold text-emerald-600 mt-2">{requests.filter(r => r.status === 'approved').length}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <p className="text-gray-600 text-sm">Rejected</p>
          <p className="text-3xl font-bold text-red-600 mt-2">{requests.filter(r => r.status === 'rejected').length}</p>
        </div>
      </div>

      {/* Filter */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-100 shadow-sm px-5 py-4 mb-6">
        <div className="flex items-center gap-3 flex-wrap">
          <Filter size={16} className="text-gray-400" />
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPagination(p => ({ ...p, page: 1 })); }}
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition">
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
          <select value={staffFilter} onChange={(e) => { setStaffFilter(e.target.value); setPagination(p => ({ ...p, page: 1 })); }}
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition min-w-[200px]">
            <option value="">All Staff</option>
            {staffList.map(s => <option key={s.staff_id} value={s.staff_id}>{s.employee_id ? `[${s.employee_id}] ` : ''}{s.full_name}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <SkeletonTable rows={6} cols={7} />
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead className="bg-gray-50">
              <tr className="border-b border-gray-100">
                <th className="text-left p-4 font-semibold text-gray-700 whitespace-nowrap">Staff</th>
                <th className="text-center p-4 font-semibold text-gray-700">Type</th>
                <th className="text-center p-4 font-semibold text-gray-700">Period</th>
                <th className="text-center p-4 font-semibold text-gray-700">Days</th>
                <th className="text-left p-4 font-semibold text-gray-700">Reason</th>
                <th className="text-center p-4 font-semibold text-gray-700">Status</th>
                <th className="text-center p-4 font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.length > 0 ? (
                requests.map((req: any) => (
                  <tr key={req.request_id} className="border-b border-gray-50 hover:bg-blue-50/20 transition-colors">
                    <td className="p-4">
                      <div className="font-semibold text-gray-800">{req.full_name}</div>
                      <div className="text-xs text-gray-500">{req.employee_id || ''} {req.department ? `- ${req.department}` : ''}</div>
                    </td>
                    <td className="p-4 text-center">{leaveTypeBadge(req.leave_type)}</td>
                    <td className="p-4 text-center text-sm text-gray-600">
                      {new Date(req.from_date).toLocaleDateString()}<br/>to {new Date(req.to_date).toLocaleDateString()}
                    </td>
                    <td className="p-4 text-center font-semibold text-gray-800">{req.days}</td>
                    <td className="p-4 text-gray-600 max-w-xs truncate">{req.reason || '-'}</td>
                    <td className="p-4 text-center">{statusBadge(req.status)}</td>
                    <td className="p-4 text-center">
                      {req.status === 'pending' ? (
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => handleReview(req, 'approved')}
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-lg text-xs font-medium hover:from-emerald-600 hover:to-emerald-700 transition-all shadow-sm" title="Approve">
                            <Check size={13} /> Approve
                          </button>
                          <button onClick={() => handleReview(req, 'rejected')}
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg text-xs font-medium hover:from-red-600 hover:to-red-700 transition-all shadow-sm" title="Reject">
                            <X size={13} /> Reject
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-500">Reviewed by {req.reviewed_by_name || 'N/A'}</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={7} className="p-8 text-center text-gray-500">No leave requests found</td></tr>
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

      <LeaveRequestModal isOpen={showModal} onClose={() => setShowModal(false)} onSuccess={fetchRequests} />

      {reviewModal && (
        <ReviewModal
          request={reviewModal.request}
          action={reviewModal.action}
          onClose={() => setReviewModal(null)}
          onSuccess={fetchRequests}
        />
      )}
    </div>
  );
};

export default LeaveRequests;
