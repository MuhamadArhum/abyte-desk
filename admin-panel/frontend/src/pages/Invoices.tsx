import { useEffect, useState, useCallback } from 'react';
import { FileText, Plus, X, Printer, CheckCircle, Send, Trash2, RefreshCw, Zap, CreditCard, Eye, Mail } from 'lucide-react';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';

interface Invoice {
  invoice_id: number;
  invoice_number: string;
  tenant_id: number;
  tenant_name: string;
  amount: number;
  period_month: string;
  status: 'draft' | 'sent' | 'paid';
  notes: string | null;
  created_at: string;
  paid_at: string | null;
  payment_method: string | null;
  payment_reference: string | null;
  payment_note: string | null;
  payment_date: string | null;
}

interface InvoiceStats {
  total: number;
  paid_count: number;
  sent_count: number;
  draft_count: number;
  paid_revenue: number;
  pending_amount: number;
}

interface Tenant {
  tenant_id: number;
  tenant_name: string;
  company_name: string;
  monthly_price?: number;
}

const STATUS_TABS = ['all', 'draft', 'sent', 'paid'] as const;

function statusBadge(status: string) {
  if (status === 'paid')   return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
  if (status === 'sent')   return 'bg-amber-50 text-amber-700 border border-amber-200';
  return 'bg-slate-100 text-slate-500 border border-slate-200';
}

function formatPeriod(p: string) {
  if (!p) return p;
  const [y, m] = p.split('-');
  const date = new Date(Number(y), Number(m) - 1, 1);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

// ─── Payment Modal ────────────────────────────────────────────────────────────
function PaymentModal({ inv, onClose, onDone }: { inv: Invoice; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    payment_method: 'cash' as 'cash' | 'bank' | 'online' | 'other',
    payment_reference: '',
    payment_note: '',
    payment_date: new Date().toISOString().split('T')[0],
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put(`/invoices/${inv.invoice_id}/payment`, {
        payment_method:    form.payment_method,
        payment_reference: form.payment_reference || undefined,
        payment_note:      form.payment_note || undefined,
        payment_date:      form.payment_date || undefined,
      });
      toast('success', 'Payment recorded');
      onDone();
      onClose();
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'response' in err ? (err as { response?: { data?: { message?: string } } }).response?.data?.message : undefined;
      toast('error', msg || 'Failed to record payment');
    } finally {
      setSaving(false);
    }
  };

  const methods = [
    { value: 'cash',   label: 'Cash' },
    { value: 'bank',   label: 'Bank Transfer' },
    { value: 'online', label: 'Online' },
    { value: 'other',  label: 'Other' },
  ] as const;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
              <CreditCard size={15} className="text-emerald-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">Record Payment</h2>
              <p className="text-xs text-slate-400">{inv.invoice_number} · Rs. {Number(inv.amount).toLocaleString()}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
            <X size={16} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-2">Payment Method *</label>
            <div className="grid grid-cols-4 gap-2">
              {methods.map(m => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, payment_method: m.value }))}
                  className={`py-2 text-xs font-bold rounded-xl border-2 transition-all ${
                    form.payment_method === m.value
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                      : 'border-slate-200 text-slate-500 hover:border-slate-300'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Payment Date *</label>
            <input
              type="date"
              value={form.payment_date}
              onChange={e => setForm(f => ({ ...f, payment_date: e.target.value }))}
              required
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Reference / Transaction ID</label>
            <input
              type="text"
              value={form.payment_reference}
              onChange={e => setForm(f => ({ ...f, payment_reference: e.target.value }))}
              placeholder="e.g. TXN-20260701"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Note</label>
            <textarea
              value={form.payment_note}
              onChange={e => setForm(f => ({ ...f, payment_note: e.target.value }))}
              rows={2}
              placeholder="Optional payment note..."
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
            />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 text-sm font-semibold text-slate-500 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Record Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Payment Detail Modal ─────────────────────────────────────────────────────
function PaymentDetailModal({ inv, onClose }: { inv: Invoice; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
              <CheckCircle size={15} className="text-emerald-600" />
            </div>
            <h2 className="text-base font-bold text-slate-800">Payment Details</h2>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
            <X size={16} />
          </button>
        </div>
        <div className="p-6 space-y-3">
          {[
            { label: 'Invoice',   value: inv.invoice_number },
            { label: 'Client',    value: inv.tenant_name },
            { label: 'Amount',    value: `Rs. ${Number(inv.amount).toLocaleString()}` },
            { label: 'Method',    value: inv.payment_method?.replace('_', ' ') ?? '—' },
            { label: 'Date',      value: inv.payment_date ? new Date(inv.payment_date).toLocaleDateString('en-US', { day: '2-digit', month: 'long', year: 'numeric' }) : '—' },
            { label: 'Reference', value: inv.payment_reference || '—' },
            { label: 'Note',      value: inv.payment_note || '—' },
          ].map(row => (
            <div key={row.label} className="flex justify-between text-sm">
              <span className="text-slate-400 font-medium">{row.label}</span>
              <span className="text-slate-700 font-semibold capitalize">{row.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Generate Invoice Modal ───────────────────────────────────────────────────
function GenerateInvoiceModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { toast } = useToast();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [form, setForm] = useState({ tenant_id: '', amount: '', period_month: '', notes: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/tenants').then(r => setTenants(r.data.data || []));
  }, []);

  const handleTenantChange = (id: string) => {
    const t = tenants.find(t => String(t.tenant_id) === id);
    setForm(f => ({ ...f, tenant_id: id, amount: t?.monthly_price ? String(t.monthly_price) : f.amount }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.tenant_id || !form.amount || !form.period_month) {
      toast('error', 'Client, amount, and period are required');
      return;
    }
    setSaving(true);
    try {
      await api.post('/invoices', {
        tenant_id:    Number(form.tenant_id),
        amount:       Number(form.amount),
        period_month: form.period_month,
        notes:        form.notes || undefined,
      });
      toast('success', 'Invoice generated');
      onCreated();
      onClose();
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'response' in err ? (err as { response?: { data?: { message?: string } } }).response?.data?.message : undefined;
      toast('error', msg || 'Failed to create invoice');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
              <FileText size={15} className="text-emerald-600" />
            </div>
            <h2 className="text-base font-bold text-slate-800">Generate Invoice</h2>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
            <X size={16} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Client *</label>
            <select
              value={form.tenant_id}
              onChange={e => handleTenantChange(e.target.value)}
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Period (YYYY-MM) *</label>
              <input
                type="month"
                value={form.period_month}
                onChange={e => setForm(f => ({ ...f, period_month: e.target.value }))}
                required
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Amount (Rs.) *</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                required
                placeholder="0.00"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Notes</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={2}
              placeholder="Optional notes..."
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
            />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 text-sm font-semibold text-slate-500 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60"
            >
              {saving ? 'Generating…' : 'Generate'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Email Invoice Modal ──────────────────────────────────────────────────────
interface AdminUser { admin_id: number; name: string; email: string; }

function EmailInvoiceModal({ inv, onClose }: { inv: Invoice; onClose: () => void }) {
  const { toast } = useToast();
  const [admins, setAdmins]       = useState<AdminUser[]>([]);
  const [selected, setSelected]   = useState<string[]>([]);
  const [loading, setLoading]     = useState(true);
  const [sending, setSending]     = useState(false);

  useEffect(() => {
    api.get('/auth/admins')
      .then(r => { setAdmins(r.data.data || []); })
      .catch(() => toast('error', 'Failed to load admin list'))
      .finally(() => setLoading(false));
  }, []);

  const toggle = (email: string) =>
    setSelected(prev => prev.includes(email) ? prev.filter(e => e !== email) : [...prev, email]);

  const handleSend = async () => {
    if (selected.length === 0) { toast('error', 'Select at least one recipient'); return; }
    setSending(true);
    try {
      await api.post(`/invoices/${inv.invoice_id}/send-email`, { to: selected });
      toast('success', `Invoice emailed to ${selected.length} recipient(s)`);
      onClose();
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
        : undefined;
      toast('error', msg || 'Failed to send email');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <Mail size={15} className="text-blue-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">Email Invoice</h2>
              <p className="text-xs text-slate-400">{inv.invoice_number} · {inv.tenant_name} · Rs. {Number(inv.amount).toLocaleString()}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
            <X size={16} />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Select Recipients</p>
            {loading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-10 bg-slate-100 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : admins.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">No active admins found</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {admins.map(a => {
                  const checked = selected.includes(a.email);
                  return (
                    <label
                      key={a.admin_id}
                      onClick={() => toggle(a.email)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border cursor-pointer transition-all select-none ${
                        checked ? 'border-blue-200 bg-blue-50' : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                        checked ? 'bg-blue-600 border-transparent' : 'border-slate-300 bg-white'
                      }`}>
                        {checked && (
                          <svg viewBox="0 0 10 8" fill="none" className="w-2.5 h-2.5">
                            <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className={`text-sm font-semibold truncate ${checked ? 'text-blue-700' : 'text-slate-700'}`}>{a.name}</p>
                        <p className={`text-xs truncate ${checked ? 'text-blue-500' : 'text-slate-400'}`}>{a.email}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
          {selected.length > 0 && (
            <p className="text-xs text-blue-600 font-medium">{selected.length} recipient(s) selected</p>
          )}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 text-sm font-semibold text-slate-500 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            <button
              onClick={handleSend}
              disabled={sending || selected.length === 0}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60"
            >
              <Mail size={13} />
              {sending ? 'Sending…' : 'Send Email'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Print Invoice ────────────────────────────────────────────────────────────
function printInvoice(inv: Invoice) {
  const html = `
    <!DOCTYPE html><html><head>
    <title>${inv.invoice_number}</title>
    <style>
      body { font-family: sans-serif; font-size: 14px; color: #1e293b; padding: 40px; }
      .flex { display: flex; justify-content: space-between; margin-bottom: 32px; }
      h1 { color: #059669; font-size: 24px; margin: 0; }
      .label { font-size: 10px; font-weight: bold; text-transform: uppercase; color: #94a3b8; margin-bottom: 4px; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 32px; }
      th { text-align: left; padding: 8px 0; border-bottom: 2px solid #e2e8f0; font-size: 11px; text-transform: uppercase; color: #94a3b8; }
      th.right, td.right { text-align: right; }
      td { padding: 12px 0; }
      tfoot td { border-top: 2px solid #e2e8f0; font-weight: bold; font-size: 16px; }
      tfoot td.right { color: #059669; }
      .footer { text-align: center; font-size: 11px; color: #94a3b8; margin-top: 48px; }
    </style></head><body>
    <div class="flex">
      <div><h1>AByte ERP</h1><p style="color:#94a3b8;font-size:11px;margin:4px 0 0">Admin Console</p></div>
      <div style="text-align:right"><p style="font-size:20px;font-weight:bold;margin:0">${inv.invoice_number}</p><p style="color:#94a3b8;font-size:11px;margin:4px 0 0">Status: ${inv.status.toUpperCase()}</p></div>
    </div>
    <div class="flex">
      <div><p class="label">Bill To</p><p style="font-weight:bold;margin:0">${inv.tenant_name}</p></div>
      <div style="text-align:right">
        <p class="label">Invoice Date</p>
        <p style="margin:0 0 8px">${new Date(inv.created_at).toLocaleDateString('en-US', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
        <p class="label">Billing Period</p>
        <p style="margin:0">${formatPeriod(inv.period_month)}</p>
      </div>
    </div>
    <table>
      <thead><tr><th>Description</th><th class="right">Amount</th></tr></thead>
      <tbody><tr><td>ERP Subscription — ${formatPeriod(inv.period_month)}</td><td class="right">Rs. ${Number(inv.amount).toLocaleString()}</td></tr></tbody>
      <tfoot><tr><td>Total</td><td class="right">Rs. ${Number(inv.amount).toLocaleString()}</td></tr></tfoot>
    </table>
    ${inv.notes ? `<p style="font-size:12px;color:#64748b;border-top:1px solid #e2e8f0;padding-top:16px">Notes: ${inv.notes}</p>` : ''}
    <p class="footer">Thank you for your business — AByte ERP</p>
    </body></html>
  `;
  const w = window.open('', '_blank', 'width=800,height=600');
  if (w) {
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); w.close(); }, 300);
  }
}

export default function Invoices() {
  const { toast } = useToast();
  const [invoices, setInvoices]         = useState<Invoice[]>([]);
  const [stats, setStats]               = useState<InvoiceStats | null>(null);
  const [loading, setLoading]           = useState(true);
  const [showModal, setShowModal]       = useState(false);
  const [activeTab, setActiveTab]       = useState<typeof STATUS_TABS[number]>('all');
  const [updating, setUpdating]         = useState<number | null>(null);
  const [autoGenLoading, setAutoGenLoading] = useState(false);
  const [paymentInv, setPaymentInv]     = useState<Invoice | null>(null);
  const [detailInv, setDetailInv]       = useState<Invoice | null>(null);
  const [emailInv, setEmailInv]         = useState<Invoice | null>(null);

  const loadStats = useCallback(() => {
    api.get('/invoices/stats').then(r => setStats(r.data)).catch(() => {});
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    const params = activeTab !== 'all' ? { status: activeTab } : {};
    api.get('/invoices', { params })
      .then(r => setInvoices(r.data.data || []))
      .catch(() => { setInvoices([]); })
      .finally(() => setLoading(false));
    loadStats();
  }, [activeTab, loadStats]);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (id: number, status: string) => {
    setUpdating(id);
    try {
      await api.put(`/invoices/${id}/status`, { status });
      toast('success', `Marked as ${status}`);
      load();
    } catch {
      toast('error', 'Failed to update status');
    } finally {
      setUpdating(null);
    }
  };

  const deleteInvoice = async (id: number) => {
    if (!confirm('Delete this draft invoice?')) return;
    try {
      await api.delete(`/invoices/${id}`);
      toast('success', 'Invoice deleted');
      load();
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'response' in err ? (err as { response?: { data?: { message?: string } } }).response?.data?.message : undefined;
      toast('error', msg || 'Failed to delete');
    }
  };

  const handleAutoGenerate = async () => {
    setAutoGenLoading(true);
    try {
      const r = await api.post('/invoices/auto-generate');
      toast('success', r.data.message || 'Invoices generated');
      load();
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'response' in err ? (err as { response?: { data?: { message?: string } } }).response?.data?.message : undefined;
      toast('error', msg || 'Auto-generate failed');
    } finally {
      setAutoGenLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl space-y-5">
      {/* Header */}
      <div className="relative bg-white border border-slate-100 rounded-2xl px-6 py-4 shadow-sm overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-50/60 via-transparent to-transparent pointer-events-none" />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-emerald-100 rounded-xl flex items-center justify-center shadow-sm">
              <FileText size={18} className="text-emerald-600" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-800">Invoices</h1>
              <p className="text-xs text-slate-400 font-medium">Generate and track client invoices</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={load} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={handleAutoGenerate}
              disabled={autoGenLoading}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm shadow-indigo-200 disabled:opacity-60"
            >
              <Zap size={14} />
              {autoGenLoading ? 'Generating…' : 'Auto-Generate'}
            </button>
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm shadow-emerald-200"
            >
              <Plus size={15} />
              Generate Invoice
            </button>
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total Invoices', value: stats.total,                                     color: 'text-slate-700',   bg: 'bg-white' },
            { label: 'Paid Revenue',   value: `Rs. ${Number(stats.paid_revenue).toLocaleString()}`, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-100' },
            { label: 'Pending',        value: `Rs. ${Number(stats.pending_amount).toLocaleString()}`, color: 'text-amber-600',   bg: 'bg-amber-50 border-amber-100' },
            { label: 'Unpaid Count',   value: `${stats.sent_count + stats.draft_count} invoices`, color: 'text-rose-500',    bg: 'bg-white' },
          ].map(s => (
            <div key={s.label} className={`${s.bg} rounded-2xl border border-slate-100 px-4 py-3.5 shadow-sm`}>
              <p className={`text-lg font-black ${s.color}`}>{s.value}</p>
              <p className="text-xs text-slate-400 font-medium mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Status Tabs */}
      <div className="flex gap-1 bg-white border border-slate-200 rounded-2xl p-1 w-fit shadow-sm">
        {STATUS_TABS.map(tab => (
          <button
            key={tab}
            onClick={() => { setActiveTab(tab); setLoading(true); }}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold capitalize transition-all ${
              activeTab === tab
                ? 'bg-emerald-500 text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60">
                <th className="text-left px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">Invoice #</th>
                <th className="text-left px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">Client</th>
                <th className="text-left px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">Period</th>
                <th className="text-left px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">Amount</th>
                <th className="text-left px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">Status</th>
                <th className="text-left px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">Date</th>
                <th className="text-right px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                [...Array(6)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {[90, 130, 100, 80, 70, 80, 100].map((w, j) => (
                      <td key={j} className="px-5 py-4">
                        <div className="h-4 bg-slate-100 rounded" style={{ width: w }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-400">
                    <FileText size={32} className="mx-auto mb-2 text-slate-200" />
                    <p className="text-sm font-medium">No invoices yet</p>
                  </td>
                </tr>
              ) : (
                invoices.map(inv => (
                  <tr key={inv.invoice_id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-5 py-3.5">
                      <span className="font-mono font-bold text-slate-700 text-xs">{inv.invoice_number}</span>
                    </td>
                    <td className="px-5 py-3.5 font-medium text-slate-700">{inv.tenant_name}</td>
                    <td className="px-5 py-3.5 text-slate-500">{formatPeriod(inv.period_month)}</td>
                    <td className="px-5 py-3.5 font-bold text-slate-800">Rs. {Number(inv.amount).toLocaleString()}</td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex px-2 py-0.5 rounded-lg text-[11px] font-bold uppercase ${statusBadge(inv.status)}`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-slate-400 text-xs">
                      {new Date(inv.created_at).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1.5">
                        {inv.status === 'paid' && inv.payment_method && (
                          <button
                            onClick={() => setDetailInv(inv)}
                            title="Payment details"
                            className="p-1.5 text-emerald-500 hover:bg-emerald-50 rounded-lg transition-colors"
                          >
                            <Eye size={13} />
                          </button>
                        )}
                        {inv.status === 'draft' && (
                          <button
                            onClick={() => updateStatus(inv.invoice_id, 'sent')}
                            disabled={updating === inv.invoice_id}
                            title="Mark as Sent"
                            className="p-1.5 text-amber-500 hover:bg-amber-50 rounded-lg transition-colors"
                          >
                            <Send size={13} />
                          </button>
                        )}
                        {inv.status === 'sent' && (
                          <button
                            onClick={() => setPaymentInv(inv)}
                            disabled={updating === inv.invoice_id}
                            title="Record Payment"
                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                          >
                            <CreditCard size={13} />
                          </button>
                        )}
                        <button
                          onClick={() => printInvoice(inv)}
                          title="Print"
                          className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                          <Printer size={13} />
                        </button>
                        <button
                          onClick={() => setEmailInv(inv)}
                          title="Email Invoice"
                          className="p-1.5 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Mail size={13} />
                        </button>
                        {inv.status === 'draft' && (
                          <button
                            onClick={() => deleteInvoice(inv.invoice_id)}
                            title="Delete draft"
                            className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <GenerateInvoiceModal onClose={() => setShowModal(false)} onCreated={load} />
      )}
      {paymentInv && (
        <PaymentModal inv={paymentInv} onClose={() => setPaymentInv(null)} onDone={load} />
      )}
      {detailInv && (
        <PaymentDetailModal inv={detailInv} onClose={() => setDetailInv(null)} />
      )}
      {emailInv && (
        <EmailInvoiceModal inv={emailInv} onClose={() => setEmailInv(null)} />
      )}
    </div>
  );
}
