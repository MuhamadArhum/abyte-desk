import { useEffect, useState } from 'react';
import { Plus, RefreshCw, CheckCircle, XCircle, Key, Search, Users, Eye, Package, Calendar, Database, RotateCcw, Mail, X, Send, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import AddClientModal from '../components/AddClientModal';
import ResetPasswordModal from '../components/ResetPasswordModal';
import EditModulesModal from '../components/EditModulesModal';
import { useToast } from '../context/ToastContext';
import { usePrices } from '../hooks/usePrices';

interface Tenant {
  tenant_id: number; tenant_code: string; tenant_name: string;
  admin_email: string; is_active: number; modules_enabled: string | string[];
  company_name: string; db_name: string;
  subscription_ends_at: string | null;
  subscription_status: 'trial' | 'active' | 'expired' | 'suspended' | null;
  db_size_mb: number;
}

interface ResetTarget  { id: number; name: string; }
interface ModuleTarget { id: number; name: string; modules: string[]; }
interface EmailTarget  { id: number; name: string; email: string; }

const avatarGradients = [
  'from-emerald-500 to-teal-600',
  'from-blue-500 to-indigo-600',
  'from-purple-500 to-violet-600',
  'from-orange-500 to-rose-500',
  'from-cyan-500 to-blue-600',
  'from-amber-500 to-orange-600',
];

const moduleStyles: Record<string, { bg: string; text: string; label: string }> = {
  sales:     { bg: 'bg-blue-50',   text: 'text-blue-600',   label: 'Sales' },
  inventory: { bg: 'bg-emerald-50',text: 'text-emerald-600',label: 'Inventory' },
  accounts:  { bg: 'bg-purple-50', text: 'text-purple-600', label: 'Accounts' },
  hr:        { bg: 'bg-orange-50', text: 'text-orange-600', label: 'HR' },
};

function subStatusBadge(status: string | null) {
  if (status === 'active')    return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
  if (status === 'trial')     return 'bg-amber-50 text-amber-700 border border-amber-200';
  if (status === 'expired')   return 'bg-red-50 text-red-600 border border-red-200';
  if (status === 'suspended') return 'bg-slate-100 text-slate-500 border border-slate-200';
  return 'bg-slate-50 text-slate-400 border border-slate-200';
}

function daysRemaining(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / 86400000);
}

function formatDbSize(mb: number): string {
  if (!mb || mb === 0) return '< 0.1 MB';
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb.toFixed(1)} MB`;
}

function SkeletonRow() {
  return (
    <tr className="animate-pulse border-b border-slate-100">
      {[30, 140, 160, 120, 90, 90, 90, 80].map((w, i) => (
        <td key={i} className="px-4 py-4">
          <div className="h-4 bg-slate-100 rounded" style={{ width: w }} />
        </td>
      ))}
    </tr>
  );
}

export default function Clients() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { prices } = usePrices();
  const [clients, setClients]     = useState<Tenant[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [resetTarget, setResetTarget]   = useState<ResetTarget | null>(null);
  const [moduleTarget, setModuleTarget] = useState<ModuleTarget | null>(null);
  const [emailTarget, setEmailTarget]   = useState<EmailTarget | null>(null);
  const [emailForm, setEmailForm]       = useState({ to: '', invoiceNo: '', amount: '', period: '', notes: '' });
  const [emailSending, setEmailSending] = useState(false);
  const [search, setSearch]       = useState('');
  const [toggling, setToggling]   = useState<number | null>(null);
  const [renewing, setRenewing]   = useState<number | null>(null);

  // Bulk selection
  const [selected, setSelected]   = useState<Set<number>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get('/tenants');
      setClients(r.data.data || []);
    } catch {
      toast('error', 'Failed to load clients');
      setClients([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const renewSubscription = async (id: number, name: string) => {
    setRenewing(id);
    try {
      const r = await api.post(`/tenants/${id}/renew`, { months: 1 });
      toast('success', `${name} renewed until ${r.data.ends_at}`);
      await load();
    } catch {
      toast('error', 'Failed to renew subscription');
    }
    setRenewing(null);
  };

  const toggleStatus = async (id: number, current: number) => {
    setToggling(id);
    try {
      await api.put(`/tenants/${id}`, { is_active: current ? 0 : 1 });
      toast('success', current ? 'Client deactivated' : 'Client activated');
      await load();
    } catch {
      toast('error', 'Failed to update client status');
    }
    setToggling(null);
  };

  const getModules = (modules: string | string[]): string[] => {
    if (!modules) return [];
    if (Array.isArray(modules)) return modules;
    try { return JSON.parse(modules); } catch { return []; }
  };

  // Return unique parent module keys from a (possibly sub-module) array
  const getParentKeys = (modules: string[]): string[] =>
    [...new Set(modules.map(m => m.split('.')[0]))].filter(k => k in moduleStyles);

  // Sub-module count per parent (undefined = old format / full access)
  const getSubCount = (modules: string[], parentKey: string): number | null => {
    const hasSubs = modules.some(m => m.includes('.'));
    if (!hasSubs) return null; // old format — show no count
    return modules.filter(m => m.startsWith(parentKey + '.')).length;
  };

  const getMonthly = (modules: string[]) => {
    const parents = getParentKeys(modules);
    return parents.reduce((sum, k) => sum + (prices[k as keyof typeof prices] ?? 0), 0);
  };

  const filtered = clients.filter(c => {
    const q = search.toLowerCase();
    return (
      (c.company_name || c.tenant_name).toLowerCase().includes(q) ||
      c.admin_email.toLowerCase().includes(q) ||
      c.tenant_code.toLowerCase().includes(q)
    );
  });

  // Bulk selection helpers
  const allSelected = filtered.length > 0 && filtered.every(c => selected.has(c.tenant_id));
  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map(c => c.tenant_id)));
    }
  };
  const toggleOne = (id: number) => {
    const next = new Set(selected);
    if (next.has(id)) { next.delete(id); } else { next.add(id); }
    setSelected(next);
  };

  const bulkAction = async (action: 'activate' | 'deactivate') => {
    if (selected.size === 0) return;
    setBulkLoading(true);
    try {
      await api.post('/tenants/bulk', { ids: [...selected], action });
      toast('success', `${selected.size} client(s) ${action}d`);
      setSelected(new Set());
      load();
    } catch {
      toast('error', 'Bulk action failed');
    } finally {
      setBulkLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="relative bg-white border border-slate-100 rounded-2xl px-6 py-4 shadow-sm overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-50/60 via-transparent to-transparent pointer-events-none" />
        <div className="absolute -top-6 -left-6 w-28 h-28 bg-emerald-400/8 rounded-full blur-3xl pointer-events-none" />
        <div className="relative flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Clients</h2>
            <p className="text-slate-400 text-sm mt-0.5">
              {loading ? '...' : (
                <><span className="font-semibold text-emerald-600">{clients.length}</span> total client{clients.length !== 1 ? 's' : ''} registered</>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={load}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-2 text-sm border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold rounded-xl shadow-md shadow-emerald-200 transition"
            >
              <Plus size={16} />
              <span className="hidden sm:inline">Add Client</span>
            </button>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, email, or code..."
          className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white text-slate-700 placeholder-slate-400 shadow-sm"
        />
      </div>

      {/* Bulk Action Bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 bg-slate-800 text-white rounded-2xl px-5 py-3 shadow-lg">
          <span className="text-sm font-semibold">{selected.size} client{selected.size !== 1 ? 's' : ''} selected</span>
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={() => bulkAction('activate')}
              disabled={bulkLoading}
              className="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl transition disabled:opacity-60"
            >
              Activate
            </button>
            <button
              onClick={() => bulkAction('deactivate')}
              disabled={bulkLoading}
              className="px-4 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-bold rounded-xl transition disabled:opacity-60"
            >
              Deactivate
            </button>
            <button
              onClick={() => setSelected(new Set())}
              className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-xs font-semibold rounded-xl transition"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="px-4 py-3.5 w-10">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="w-4 h-4 rounded border-slate-300 accent-emerald-500"
                  />
                </th>
                {['Client', 'Email', 'Modules', 'Monthly', 'DB Size', 'Subscription', 'Status', 'Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)
                : filtered.map((c, idx) => {
                    const mods    = getModules(c.modules_enabled);
                    const monthly = getMonthly(mods);
                    const isToggling = toggling === c.tenant_id;
                    const days = daysRemaining(c.subscription_ends_at);
                    const isSelected = selected.has(c.tenant_id);

                    return (
                      <tr
                        key={c.tenant_id}
                        className={`border-b border-slate-50 hover:bg-slate-50/60 transition-colors ${isSelected ? 'bg-emerald-50/30' : ''}`}
                      >
                        {/* Checkbox */}
                        <td className="px-4 py-4" onClick={e => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleOne(c.tenant_id)}
                            className="w-4 h-4 rounded border-slate-300 accent-emerald-500"
                          />
                        </td>

                        {/* Client */}
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 bg-gradient-to-br ${avatarGradients[idx % avatarGradients.length]} rounded-xl flex items-center justify-center text-sm font-bold text-white flex-shrink-0 shadow-sm`}>
                              {(c.company_name || c.tenant_name).charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-semibold text-slate-800 leading-tight">
                                {c.company_name || c.tenant_name}
                              </p>
                              <p className="text-slate-400 text-xs mt-0.5 font-mono">{c.tenant_code}</p>
                            </div>
                          </div>
                        </td>

                        {/* Email */}
                        <td className="px-4 py-4 text-slate-600 text-xs">{c.admin_email}</td>

                        {/* Modules */}
                        <td className="px-4 py-4">
                          <div className="flex flex-wrap gap-1">
                            {mods.length === 0
                              ? <span className="text-slate-300 text-xs">—</span>
                              : getParentKeys(mods).map((parentKey: string) => {
                                  const style = moduleStyles[parentKey] || { bg: 'bg-slate-50', text: 'text-slate-500', label: parentKey };
                                  const count = getSubCount(mods, parentKey);
                                  return (
                                    <span key={parentKey} className={`px-2 py-0.5 rounded-lg text-xs font-medium ${style.bg} ${style.text} flex items-center gap-1`}>
                                      {style.label}
                                      {count !== null && count > 0 && (
                                        <span className="opacity-60 font-normal">·{count}</span>
                                      )}
                                    </span>
                                  );
                                })
                            }
                          </div>
                        </td>

                        {/* Monthly */}
                        <td className="px-4 py-4">
                          <span className="font-semibold text-slate-700 text-xs">Rs. {monthly.toLocaleString()}</span>
                          <span className="text-slate-400 text-xs">/mo</span>
                        </td>

                        {/* DB Size */}
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-1.5">
                            <Database size={12} className="text-slate-400 flex-shrink-0" />
                            <span className={`text-xs font-semibold ${
                              c.db_size_mb >= 512 ? 'text-red-500' :
                              c.db_size_mb >= 100 ? 'text-amber-600' :
                              'text-slate-600'
                            }`}>
                              {formatDbSize(c.db_size_mb)}
                            </span>
                          </div>
                        </td>

                        {/* Subscription */}
                        <td className="px-4 py-4">
                          <div className="space-y-1">
                            <span className={`inline-flex px-2 py-0.5 rounded-lg text-[11px] font-bold capitalize ${subStatusBadge(c.subscription_status)}`}>
                              {c.subscription_status || 'trial'}
                            </span>
                            {days !== null && (
                              <div className="flex items-center gap-1">
                                <Calendar size={10} className={days < 0 ? 'text-red-400' : days <= 7 ? 'text-amber-500' : 'text-slate-400'} />
                                <span className={`text-[10px] font-medium ${days < 0 ? 'text-red-500' : days <= 7 ? 'text-amber-600' : 'text-slate-400'}`}>
                                  {days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? 'expires today' : `${days}d left`}
                                </span>
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Status */}
                        <td className="px-4 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                            c.is_active
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-slate-100 text-slate-500'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${c.is_active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                            {c.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => navigate(`/clients/${c.tenant_id}`)}
                              title="View Details"
                              className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition"
                            >
                              <Eye size={15} />
                            </button>
                            <button
                              onClick={() => setModuleTarget({ id: c.tenant_id, name: c.company_name || c.tenant_name, modules: mods })}
                              title="Manage Modules"
                              className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition"
                            >
                              <Package size={15} />
                            </button>
                            <button
                              onClick={() => renewSubscription(c.tenant_id, c.company_name || c.tenant_name)}
                              disabled={renewing === c.tenant_id}
                              title="Renew Subscription (+1 month)"
                              className="p-2 rounded-xl hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition disabled:opacity-40"
                            >
                              {renewing === c.tenant_id
                                ? <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin block" />
                                : <RotateCcw size={15} />
                              }
                            </button>
                            <button
                              onClick={() => toggleStatus(c.tenant_id, c.is_active)}
                              disabled={isToggling}
                              title={c.is_active ? 'Deactivate' : 'Activate'}
                              className={`p-2 rounded-xl transition ${
                                c.is_active
                                  ? 'hover:bg-red-50 text-slate-400 hover:text-red-500'
                                  : 'hover:bg-emerald-50 text-slate-400 hover:text-emerald-600'
                              } disabled:opacity-40`}
                            >
                              {isToggling
                                ? <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin block" />
                                : c.is_active ? <XCircle size={15} /> : <CheckCircle size={15} />
                              }
                            </button>
                            <button
                              onClick={() => setResetTarget({ id: c.tenant_id, name: c.company_name || c.tenant_name })}
                              title="Reset Password"
                              className="p-2 rounded-xl hover:bg-amber-50 text-slate-400 hover:text-amber-600 transition"
                            >
                              <Key size={15} />
                            </button>
                            <button
                              onClick={() => { setEmailTarget({ id: c.tenant_id, name: c.company_name || c.tenant_name, email: c.admin_email }); setEmailForm({ to: c.admin_email, invoiceNo: '', amount: '', period: '', notes: '' }); }}
                              title="Send Invoice Email"
                              className="p-2 rounded-xl hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition"
                            >
                              <Mail size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
              }

              {/* Empty state */}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={9}>
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
                        <Users size={28} className="text-gray-300" />
                      </div>
                      <p className="text-gray-700 font-semibold">
                        {search ? 'No clients match your search' : 'No clients found'}
                      </p>
                      <p className="text-gray-400 text-sm mt-1">
                        {search ? 'Try a different name, email, or code' : 'Add your first client to get started'}
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <AddClientModal onClose={() => { setShowModal(false); load(); }} />
      )}

      {resetTarget && (
        <ResetPasswordModal
          tenantId={resetTarget.id}
          clientName={resetTarget.name}
          onClose={() => setResetTarget(null)}
        />
      )}

      {moduleTarget && (
        <EditModulesModal
          tenantId={moduleTarget.id}
          clientName={moduleTarget.name}
          currentModules={moduleTarget.modules}
          onClose={() => { setModuleTarget(null); load(); }}
        />
      )}

      {emailTarget && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-slate-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-800">Send Invoice Email</h3>
                <p className="text-xs text-slate-500 mt-0.5">{emailTarget.name}</p>
              </div>
              <button onClick={() => setEmailTarget(null)} className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 transition">
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">To (Email)</label>
                <input
                  type="email"
                  value={emailForm.to}
                  onChange={e => setEmailForm(f => ({ ...f, to: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="client@example.com"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Invoice No</label>
                  <input
                    type="text"
                    value={emailForm.invoiceNo}
                    onChange={e => setEmailForm(f => ({ ...f, invoiceNo: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="INV-001"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Amount (Rs.)</label>
                  <input
                    type="number"
                    value={emailForm.amount}
                    onChange={e => setEmailForm(f => ({ ...f, amount: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Period</label>
                <input
                  type="text"
                  value={emailForm.period}
                  onChange={e => setEmailForm(f => ({ ...f, period: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="July 2026"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Notes (optional)</label>
                <textarea
                  value={emailForm.notes}
                  onChange={e => setEmailForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  placeholder="Any additional message..."
                />
              </div>
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button onClick={() => setEmailTarget(null)} className="flex-1 border border-slate-200 text-slate-600 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-50 transition">
                Cancel
              </button>
              <button
                disabled={emailSending || !emailForm.to}
                onClick={async () => {
                  setEmailSending(true);
                  try {
                    await api.post(`/tenants/${emailTarget.id}/send-invoice-email`, emailForm);
                    toast('success', 'Invoice email sent successfully');
                    setEmailTarget(null);
                  } catch (err: any) {
                    toast('error', err.response?.data?.message || 'Failed to send email');
                  } finally {
                    setEmailSending(false);
                  }
                }}
                className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition flex items-center justify-center gap-2"
              >
                {emailSending ? <><Loader2 size={15} className="animate-spin" /> Sending...</> : <><Send size={15} /> Send Email</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
