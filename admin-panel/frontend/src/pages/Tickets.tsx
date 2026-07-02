import { useEffect, useState, useCallback } from 'react';
import { LifeBuoy, Plus, X, Pencil, Trash2, RefreshCw, AlertCircle } from 'lucide-react';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';

interface Ticket {
  ticket_id: number;
  tenant_id: number;
  tenant_name: string;
  subject: string;
  message: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

interface Tenant { tenant_id: number; tenant_name: string; company_name: string; }

const STATUS_TABS = ['all', 'open', 'in_progress', 'resolved', 'closed'] as const;

function priorityBadge(p: string) {
  if (p === 'urgent') return 'bg-red-50 text-red-700 border border-red-200';
  if (p === 'high')   return 'bg-amber-50 text-amber-700 border border-amber-200';
  if (p === 'medium') return 'bg-slate-100 text-slate-600 border border-slate-200';
  return 'bg-slate-50 text-slate-400 border border-slate-200';
}

function statusBadge(s: string) {
  if (s === 'open')        return 'bg-red-50 text-red-700 border border-red-200';
  if (s === 'in_progress') return 'bg-amber-50 text-amber-700 border border-amber-200';
  if (s === 'resolved')    return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
  return 'bg-slate-100 text-slate-500 border border-slate-200';
}

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 1)   return 'just now';
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

// ─── Ticket Modal ─────────────────────────────────────────────────────────────
function TicketModal({
  ticket, tenants, onClose, onSaved,
}: {
  ticket: Ticket | null;
  tenants: Tenant[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const isEdit = !!ticket;

  const [form, setForm] = useState({
    tenant_id:   ticket ? String(ticket.tenant_id) : '',
    subject:     ticket?.subject || '',
    message:     ticket?.message || '',
    priority:    ticket?.priority || 'medium',
    status:      ticket?.status || 'open',
    admin_notes: ticket?.admin_notes || '',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.tenant_id || !form.subject || !form.message) {
      toast('error', 'Client, subject, and message are required');
      return;
    }
    setSaving(true);
    try {
      if (isEdit) {
        await api.put(`/tickets/${ticket!.ticket_id}`, {
          status:      form.status,
          priority:    form.priority,
          admin_notes: form.admin_notes || null,
        });
        toast('success', 'Ticket updated');
      } else {
        await api.post('/tickets', {
          tenant_id: Number(form.tenant_id),
          subject:   form.subject,
          message:   form.message,
          priority:  form.priority,
        });
        toast('success', 'Ticket created');
      }
      onSaved();
      onClose();
    } catch (err: any) {
      toast('error', err?.response?.data?.message || 'Failed to save ticket');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
              <LifeBuoy size={15} className="text-emerald-600" />
            </div>
            <h2 className="text-base font-bold text-slate-800">{isEdit ? 'Edit Ticket' : 'New Ticket'}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {!isEdit && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Client *</label>
              <select
                value={form.tenant_id}
                onChange={e => setForm(f => ({ ...f, tenant_id: e.target.value }))}
                required
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">Select client...</option>
                {tenants.map(t => (
                  <option key={t.tenant_id} value={t.tenant_id}>
                    {t.company_name || t.tenant_name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {!isEdit && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Subject *</label>
              <input
                value={form.subject}
                onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                required
                placeholder="Brief description of the issue"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          )}

          {!isEdit && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Message *</label>
              <textarea
                value={form.message}
                onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                required
                rows={3}
                placeholder="Detailed description..."
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Priority</label>
              <select
                value={form.priority}
                onChange={e => setForm(f => ({ ...f, priority: e.target.value as 'low' | 'medium' | 'high' | 'urgent' }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            {isEdit && (
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Status</label>
                <select
                  value={form.status}
                  onChange={e => setForm(f => ({ ...f, status: e.target.value as 'open' | 'in_progress' | 'resolved' | 'closed' }))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
            )}
          </div>

          {isEdit && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Admin Notes</label>
              <textarea
                value={form.admin_notes}
                onChange={e => setForm(f => ({ ...f, admin_notes: e.target.value }))}
                rows={2}
                placeholder="Internal notes..."
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
              />
            </div>
          )}

          {isEdit && ticket && (
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
              <p className="text-xs font-bold text-slate-500 uppercase mb-1">Original Message</p>
              <p className="text-xs text-slate-600">{ticket.message}</p>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 text-sm font-semibold text-slate-500 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60"
            >
              {saving ? 'Saving…' : isEdit ? 'Update Ticket' : 'Create Ticket'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Tickets() {
  const { toast } = useToast();
  const [tickets, setTickets]     = useState<Ticket[]>([]);
  const [tenants, setTenants]     = useState<Tenant[]>([]);
  const [loading, setLoading]     = useState(true);
  const [activeTab, setActiveTab] = useState<typeof STATUS_TABS[number]>('all');
  const [modalTicket, setModalTicket] = useState<Ticket | null | undefined>(undefined); // undefined = closed
  const [deleting, setDeleting]   = useState<number | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    const params = activeTab !== 'all' ? { status: activeTab } : {};
    api.get('/tickets', { params })
      .then(r => setTickets(r.data.data || []))
      .finally(() => setLoading(false));
  }, [activeTab]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    api.get('/tenants').then(r => setTenants(r.data.data || []));
  }, []);

  const deleteTicket = async (id: number) => {
    if (!confirm('Delete this ticket?')) return;
    setDeleting(id);
    try {
      await api.delete(`/tickets/${id}`);
      toast('success', 'Ticket deleted');
      load();
    } catch {
      toast('error', 'Failed to delete');
    } finally {
      setDeleting(null);
    }
  };

  const openCount       = tickets.filter(t => t.status === 'open').length;
  const inProgressCount = tickets.filter(t => t.status === 'in_progress').length;
  const resolvedCount   = tickets.filter(t => t.status === 'resolved').length;

  return (
    <div className="p-6 max-w-7xl space-y-5">
      {/* Header */}
      <div className="relative bg-white border border-slate-100 rounded-2xl px-6 py-4 shadow-sm overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-50/60 via-transparent to-transparent pointer-events-none" />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-emerald-100 rounded-xl flex items-center justify-center shadow-sm">
              <LifeBuoy size={18} className="text-emerald-600" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-800">Support Tickets</h1>
              <p className="text-xs text-slate-400 font-medium">Track and manage client issues</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={load} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={() => setModalTicket(null)}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm shadow-emerald-200"
            >
              <Plus size={15} />
              New Ticket
            </button>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      {!loading && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl border border-red-100 p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 bg-red-50 rounded-lg flex items-center justify-center">
                <AlertCircle size={12} className="text-red-500" />
              </div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Open</span>
            </div>
            <p className="text-2xl font-black text-slate-800">{openCount}</p>
          </div>
          <div className="bg-white rounded-2xl border border-amber-100 p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 bg-amber-50 rounded-lg flex items-center justify-center">
                <RefreshCw size={12} className="text-amber-500" />
              </div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">In Progress</span>
            </div>
            <p className="text-2xl font-black text-slate-800">{inProgressCount}</p>
          </div>
          <div className="bg-white rounded-2xl border border-emerald-100 p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 bg-emerald-50 rounded-lg flex items-center justify-center">
                <LifeBuoy size={12} className="text-emerald-600" />
              </div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Resolved</span>
            </div>
            <p className="text-2xl font-black text-slate-800">{resolvedCount}</p>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-1 bg-white border border-slate-200 rounded-2xl p-1 w-fit shadow-sm">
        {STATUS_TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold capitalize transition-all ${
              activeTab === tab
                ? 'bg-emerald-500 text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            {tab.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60">
                <th className="text-left px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">Ticket</th>
                <th className="text-left px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">Client</th>
                <th className="text-left px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">Subject</th>
                <th className="text-left px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">Priority</th>
                <th className="text-left px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">Status</th>
                <th className="text-left px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">Created</th>
                <th className="text-right px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {[60, 120, 180, 70, 80, 80, 80].map((w, j) => (
                      <td key={j} className="px-5 py-4">
                        <div className="h-4 bg-slate-100 rounded" style={{ width: w }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : tickets.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-400">
                    <LifeBuoy size={32} className="mx-auto mb-2 text-slate-200" />
                    <p className="text-sm font-medium">No tickets found</p>
                  </td>
                </tr>
              ) : (
                tickets.map(tk => (
                  <tr key={tk.ticket_id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-5 py-3.5">
                      <span className="font-mono text-xs text-slate-400">#{tk.ticket_id}</span>
                    </td>
                    <td className="px-5 py-3.5 font-medium text-slate-700 text-xs">{tk.tenant_name}</td>
                    <td className="px-5 py-3.5 max-w-[220px]">
                      <p className="font-semibold text-slate-800 text-xs truncate">{tk.subject}</p>
                      {tk.admin_notes && (
                        <p className="text-slate-400 text-[11px] truncate mt-0.5">Note: {tk.admin_notes}</p>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex px-2 py-0.5 rounded-lg text-[11px] font-bold capitalize ${priorityBadge(tk.priority)}`}>
                        {tk.priority}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex px-2 py-0.5 rounded-lg text-[11px] font-bold capitalize ${statusBadge(tk.status)}`}>
                        {tk.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-slate-400 text-xs">{timeAgo(tk.created_at)}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setModalTicket(tk)}
                          className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => deleteTicket(tk.ticket_id)}
                          disabled={deleting === tk.ticket_id}
                          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalTicket !== undefined && (
        <TicketModal
          ticket={modalTicket}
          tenants={tenants}
          onClose={() => setModalTicket(undefined)}
          onSaved={load}
        />
      )}
    </div>
  );
}
