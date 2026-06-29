import { useState, useEffect } from 'react';
import { useSettings } from '../../context/SettingsContext';
import React from 'react';
import { DollarSign, Plus, Ban, Eye, Filter } from 'lucide-react';
import Pagination from '../../components/Pagination';
import api from '../../utils/api';
import { useToast } from '../../components/Toast';
import { useConfirm } from '../../components/ConfirmDialog';
import IssueLoanModal from '../../components/IssueLoanModal';
import LoanRepaymentModal from '../../components/LoanRepaymentModal';
import { SkeletonTable } from '../../components/Skeleton';

const LoanManagement = () => {
  const { currencySymbol: currency } = useSettings();
  const toast = useToast();
  const confirm = useConfirm();
  const [loans, setLoans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [statusFilter, setStatusFilter] = useState('all');
  const [staffFilter, setStaffFilter] = useState('');
  const [staffList, setStaffList] = useState<any[]>([]);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [showRepayModal, setShowRepayModal] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<any>(null);
  const [expandedLoan, setExpandedLoan] = useState<number | null>(null);
  const [repayments, setRepayments] = useState<Record<number, any[]>>({});

  useEffect(() => {
    api.get('/staff', { params: { limit: 200 } }).then(r => setStaffList(r.data.data || [])).catch(() => {});
  }, []);

  useEffect(() => { fetchLoans(); }, [pagination.page, statusFilter, staffFilter]);

  const fetchLoans = async () => {
    setLoading(true);
    try {
      const params: any = { page: pagination.page, limit: pagination.limit };
      if (statusFilter !== 'all') params.status = statusFilter;
      if (staffFilter) params.staff_id = staffFilter;
      const res = await api.get('/staff/loans', { params });
      setLoans(res.data.data || []);
      if (res.data.pagination) setPagination(res.data.pagination);
    } catch (err) {
      toast.error('Failed to load loans');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (loan: any) => {
    const ok = await confirm({ title: 'Cancel Loan', message: `Cancel loan of ${currency}${Number(loan.loan_amount).toLocaleString()} for ${loan.full_name}?`, type: 'danger' });
    if (!ok) return;
    try {
      await api.put(`/staff/loans/${loan.loan_id}/cancel`);
      toast.success('Loan cancelled');
      fetchLoans();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to cancel');
    }
  };

  const toggleRepayments = async (loanId: number) => {
    if (expandedLoan === loanId) { setExpandedLoan(null); return; }
    if (!repayments[loanId]) {
      try {
        const res = await api.get(`/staff/loans/${loanId}/repayments`);
        setRepayments(prev => ({ ...prev, [loanId]: res.data.data || [] }));
      } catch (err) { console.error(err); }
    }
    setExpandedLoan(loanId);
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { bg: string; text: string; dot: string }> = {
      active:    { bg: 'bg-blue-100',  text: 'text-blue-700',  dot: 'bg-blue-500'  },
      completed: { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500' },
      cancelled: { bg: 'bg-gray-100',  text: 'text-gray-600',  dot: 'bg-gray-400'  },
    };
    const style = map[status] || { bg: 'bg-gray-100', text: 'text-gray-700', dot: 'bg-gray-400' };
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${style.bg} ${style.text}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
        {status}
      </span>
    );
  };

  const activeTotals = loans.filter(l => l.status === 'active').reduce((acc, l) => ({
    total: acc.total + Number(l.loan_amount),
    remaining: acc.remaining + Number(l.remaining_balance),
    repaid: acc.repaid + Number(l.total_repaid || 0)
  }), { total: 0, remaining: 0, repaid: 0 });

  return (
    <div className="p-4 md:p-8">
      {/* Gradient Header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-purple-50 via-white to-white border-b border-gray-100 px-4 md:px-8 py-4 md:py-6 -mx-4 md:-mx-8 -mt-4 md:-mt-8 mb-6 md:mb-8">
        <div className="absolute inset-0 opacity-5 bg-[url('data:image/svg+xml,%3Csvg width=%2260%22 height=%2260%22 viewBox=%220 0 60 60%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cg fill=%22none%22 fill-rule=%22evenodd%22%3E%3Cg fill=%22%23000%22 fill-opacity=%221%22%3E%3Cpath d=%22M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')]" />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-200">
              <DollarSign size={22} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Loan Management</h1>
              <p className="text-sm text-gray-500 mt-0.5">Manage employee loans and repayments</p>
            </div>
          </div>
          <button
            onClick={() => setShowIssueModal(true)}
            className="flex items-center gap-2 bg-gradient-to-r from-purple-500 to-purple-600 text-white px-5 py-2.5 rounded-xl hover:from-purple-600 hover:to-purple-700 shadow-md shadow-purple-200 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 font-medium text-sm"
          >
            <Plus size={18} /> Issue Loan
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6 mb-6 md:mb-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <p className="text-gray-600 text-sm">Total Loans</p>
          <p className="text-3xl font-bold text-gray-800 mt-2">{pagination.total}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <p className="text-gray-600 text-sm">Active Total</p>
          <p className="text-3xl font-bold text-purple-600 mt-2">{currency}{activeTotals.total.toLocaleString()}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <p className="text-gray-600 text-sm">Total Repaid</p>
          <p className="text-3xl font-bold text-emerald-600 mt-2">{currency}{activeTotals.repaid.toLocaleString()}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <p className="text-gray-600 text-sm">Outstanding</p>
          <p className="text-3xl font-bold text-red-600 mt-2">{currency}{activeTotals.remaining.toLocaleString()}</p>
        </div>
      </div>

      {/* Filter */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-100 shadow-sm px-5 py-4 mb-6">
        <div className="flex items-center gap-3 flex-wrap">
          <Filter size={16} className="text-gray-400" />
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPagination(p => ({ ...p, page: 1 })); }}
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400 outline-none transition">
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <select value={staffFilter} onChange={(e) => { setStaffFilter(e.target.value); setPagination(p => ({ ...p, page: 1 })); }}
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400 outline-none transition min-w-[200px]">
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
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr className="border-b border-gray-100">
                <th className="text-left p-4 font-semibold text-gray-700">Staff</th>
                <th className="text-right p-4 font-semibold text-gray-700">Loan Amount</th>
                <th className="text-right p-4 font-semibold text-gray-700">Repaid</th>
                <th className="text-right p-4 font-semibold text-gray-700">Remaining</th>
                <th className="text-right p-4 font-semibold text-gray-700">Monthly Ded.</th>
                <th className="text-center p-4 font-semibold text-gray-700">Date</th>
                <th className="text-center p-4 font-semibold text-gray-700">Status</th>
                <th className="text-center p-4 font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loans.length > 0 ? (
                loans.map((loan: any) => (
                  <React.Fragment key={loan.loan_id}>
                    <tr className="border-b border-gray-50 hover:bg-purple-50/20 transition-colors">
                      <td className="p-4">
                        <div className="font-semibold text-gray-800">{loan.full_name}</div>
                        <div className="text-xs text-gray-500">{loan.employee_id || ''} {loan.department ? `- ${loan.department}` : ''}</div>
                      </td>
                      <td className="p-4 text-right font-medium">{currency}{Number(loan.loan_amount).toLocaleString()}</td>
                      <td className="p-4 text-right font-medium text-emerald-600">{currency}{Number(loan.total_repaid || 0).toLocaleString()}</td>
                      <td className="p-4 text-right font-bold text-red-600">{currency}{Number(loan.remaining_balance).toLocaleString()}</td>
                      <td className="p-4 text-right text-gray-600">{Number(loan.monthly_deduction) > 0 ? `${currency}${Number(loan.monthly_deduction).toLocaleString()}` : '-'}</td>
                      <td className="p-4 text-center text-gray-600">{new Date(loan.loan_date).toLocaleDateString()}</td>
                      <td className="p-4 text-center">{statusBadge(loan.status)}</td>
                      <td className="p-4">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => toggleRepayments(loan.loan_id)} className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-all" title="View Repayments">
                            <Eye size={16} />
                          </button>
                          {loan.status === 'active' && (
                            <>
                              <button onClick={() => { setSelectedLoan(loan); setShowRepayModal(true); }} className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-all" title="Record Repayment">
                                <DollarSign size={16} />
                              </button>
                              <button onClick={() => handleCancel(loan)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all" title="Cancel Loan">
                                <Ban size={16} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                    {expandedLoan === loan.loan_id && (
                      <tr key={`rep-${loan.loan_id}`}>
                        <td colSpan={8} className="p-0">
                          <div className="bg-gray-50 p-4 border-b-2 border-gray-200">
                            <h4 className="text-sm font-semibold text-gray-700 mb-3">Repayment History {loan.reason && <span className="font-normal text-gray-500 ml-2">Reason: {loan.reason}</span>}</h4>
                            {repayments[loan.loan_id]?.length > 0 ? (
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="text-gray-500">
                                    <th className="text-left py-2 px-3">Date</th>
                                    <th className="text-right py-2 px-3">Amount</th>
                                    <th className="text-left py-2 px-3">Method</th>
                                    <th className="text-left py-2 px-3">Notes</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {repayments[loan.loan_id].map((r: any) => (
                                    <tr key={r.repayment_id} className="border-t border-gray-200">
                                      <td className="py-2 px-3">{new Date(r.repayment_date).toLocaleDateString()}</td>
                                      <td className="py-2 px-3 text-right font-medium text-emerald-600">{currency}{Number(r.amount).toLocaleString()}</td>
                                      <td className="py-2 px-3 capitalize">{r.payment_method?.replace('_', ' ')}</td>
                                      <td className="py-2 px-3 text-gray-500">{r.notes || '-'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            ) : (
                              <p className="text-sm text-gray-500">No repayments yet</p>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              ) : (
                <tr><td colSpan={8} className="p-8 text-center text-gray-500">No loans found</td></tr>
              )}
            </tbody>
          </table>

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

      <IssueLoanModal isOpen={showIssueModal} onClose={() => setShowIssueModal(false)} onSuccess={fetchLoans} />
      {selectedLoan && <LoanRepaymentModal isOpen={showRepayModal} onClose={() => { setShowRepayModal(false); setSelectedLoan(null); }} onSuccess={() => { fetchLoans(); if (expandedLoan) { api.get(`/staff/loans/${expandedLoan}/repayments`).then(r => setRepayments(prev => ({ ...prev, [expandedLoan]: r.data.data || [] }))); } }} loan={selectedLoan} />}
    </div>
  );
};

export default LoanManagement;
