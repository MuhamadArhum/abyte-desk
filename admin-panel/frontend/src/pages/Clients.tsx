import { useEffect, useState } from 'react';
import { Plus, RefreshCw, CheckCircle, XCircle, Key, Search, AlertCircle, Eye, Package } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import AddClientModal from '../components/AddClientModal';
import ResetPasswordModal from '../components/ResetPasswordModal';
import EditModulesModal from '../components/EditModulesModal';
import { useToast } from '../context/ToastContext';

interface Tenant {
  tenant_id: number; tenant_code: string; tenant_name: string;
  admin_email: string; is_active: number; modules_enabled: string | string[];
  company_name: string; db_name: string;
}

interface ResetTarget  { id: number; name: string; }
interface ModuleTarget { id: number; name: string; modules: string[]; }

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

function SkeletonRow() {
  return (
    <tr className="animate-pulse border-b border-slate-100">
      {[140, 160, 120, 90, 70, 80].map((w, i) => (
        <td key={i} className="px-5 py-4">
          <div className={`h-4 bg-slate-100 rounded`} style={{ width: w }} />
        </td>
      ))}
    </tr>
  );
}

export default function Clients() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [clients, setClients]     = useState<Tenant[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [resetTarget, setResetTarget]   = useState<ResetTarget | null>(null);
  const [moduleTarget, setModuleTarget] = useState<ModuleTarget | null>(null);
  const [search, setSearch]       = useState('');
  const [toggling, setToggling]   = useState<number | null>(null);

  const load = () => {
    setLoading(true);
    api.get('/tenants').then(r => setClients(r.data.data)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

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

  const getMonthly = (modules: string[]) =>
    modules.reduce((sum, m) => sum + (['accounts', 'hr'].includes(m) ? 2999 : 2250), 0);

  const filtered = clients.filter(c => {
    const q = search.toLowerCase();
    return (
      (c.company_name || c.tenant_name).toLowerCase().includes(q) ||
      c.admin_email.toLowerCase().includes(q) ||
      c.tenant_code.toLowerCase().includes(q)
    );
  });

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

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                {['Client', 'Email', 'Modules', 'Monthly', 'Status', 'Actions'].map(h => (
                  <th key={h} className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)
                : filtered.map((c, idx) => {
                    const mods = getModules(c.modules_enabled);
                    const monthly = getMonthly(mods);
                    const isToggling = toggling === c.tenant_id;

                    return (
                      <tr key={c.tenant_id} className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors">
                        {/* Client */}
                        <td className="px-5 py-4">
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
                        <td className="px-5 py-4 text-slate-600">{c.admin_email}</td>

                        {/* Modules */}
                        <td className="px-5 py-4">
                          <div className="flex flex-wrap gap-1">
                            {mods.length === 0
                              ? <span className="text-slate-300 text-xs">—</span>
                              : mods.map((m: string) => {
                                  const style = moduleStyles[m] || { bg: 'bg-slate-50', text: 'text-slate-500', label: m };
                                  return (
                                    <span key={m} className={`px-2 py-0.5 rounded-lg text-xs font-medium ${style.bg} ${style.text}`}>
                                      {style.label}
                                    </span>
                                  );
                                })
                            }
                          </div>
                        </td>

                        {/* Monthly */}
                        <td className="px-5 py-4">
                          <span className="font-semibold text-slate-700">Rs. {monthly.toLocaleString()}</span>
                          <span className="text-slate-400 text-xs">/mo</span>
                        </td>

                        {/* Status */}
                        <td className="px-5 py-4">
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
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => navigate(`/clients/${c.tenant_id}`)}
                              title="View Details"
                              className="p-2 rounded-xl hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition"
                            >
                              <Eye size={17} />
                            </button>
                            <button
                              onClick={() => setModuleTarget({ id: c.tenant_id, name: c.company_name || c.tenant_name, modules: mods })}
                              title="Manage Modules"
                              className="p-2 rounded-xl hover:bg-purple-50 text-slate-400 hover:text-purple-600 transition"
                            >
                              <Package size={17} />
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
                                : c.is_active ? <XCircle size={17} /> : <CheckCircle size={17} />
                              }
                            </button>
                            <button
                              onClick={() => setResetTarget({ id: c.tenant_id, name: c.company_name || c.tenant_name })}
                              title="Reset Password"
                              className="p-2 rounded-xl hover:bg-amber-50 text-slate-400 hover:text-amber-600 transition"
                            >
                              <Key size={17} />
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
                  <td colSpan={6} className="px-5 py-14 text-center">
                    <AlertCircle size={32} className="text-slate-200 mx-auto mb-3" />
                    <p className="text-slate-400 font-medium">
                      {search ? 'No clients match your search' : 'No clients yet'}
                    </p>
                    {!search && (
                      <p className="text-slate-300 text-xs mt-1">Click "Add Client" to get started</p>
                    )}
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
    </div>
  );
}
