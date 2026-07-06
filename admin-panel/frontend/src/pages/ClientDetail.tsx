import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Users, ShoppingCart, Database, Clock,
  User, Globe, Package, Building2, Plus, Pencil, Trash2, X,
  Eye, EyeOff, UserPlus, Shield, Calendar, LifeBuoy, AlertTriangle,
} from 'lucide-react';
import api from '../api/axios';
import EditModulesModal from '../components/EditModulesModal';
import ResetPasswordModal from '../components/ResetPasswordModal';
import { useToast } from '../context/ToastContext';
import { usePrices } from '../hooks/usePrices';

interface TenantDetail {
  tenant_id: number; tenant_code: string; tenant_name: string;
  admin_email: string; is_active: number; db_name: string;
  company_name: string; modules_enabled: string[]; created_at: string;
  subscription_ends_at: string | null;
  subscription_status: 'trial' | 'active' | 'expired' | 'suspended' | null;
}
interface Ticket {
  ticket_id: number; subject: string; message: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  admin_notes: string | null; created_at: string;
}
interface UserRow {
  user_id: number; username: string; name: string; email: string;
  role_name: string; branch_id: number | null; branch_name: string | null; created_at: string;
}
interface LoginRow { user_name: string; ip_address: string; created_at: string; }
interface DetailData {
  tenant: TenantDetail;
  users: UserRow[];
  sales_count: number;
  total_revenue: number;
  db_size_mb: number;
  recent_logins: LoginRow[];
  monthly_price: number;
}
interface Branch {
  store_id: number;
  store_name: string;
  store_code: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  is_active: number;
  monthly_charge: number;
  manager_name: string | null;
  total_staff: number;
  today_sales: number;
  month_revenue: number;
}
interface BranchForm {
  store_name: string; store_code: string; address: string;
  phone: string; email: string; monthly_charge: number; is_active: number;
}
interface UserForm {
  username: string; name: string; email: string;
  password: string; role_name: string; branch_id: string;
}

// ─── Branch Modal ────────────────────────────────────────────────────────────
function BranchModal({ branch, tenantId, onClose, onSave }: {
  branch: Branch | null; tenantId: number; onClose: () => void; onSave: () => void;
}) {
  const [form, setForm] = useState<BranchForm>({
    store_name:     branch?.store_name || '',
    store_code:     branch?.store_code || '',
    address:        branch?.address || '',
    phone:          branch?.phone || '',
    email:          branch?.email || '',
    monthly_charge: branch?.monthly_charge ?? 0,
    is_active:      branch?.is_active ?? 1,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.store_name.trim() || !form.store_code.trim()) {
      setError('Branch name and code are required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (branch) {
        await api.put(`/tenants/${tenantId}/branches/${branch.store_id}`, form);
      } else {
        await api.post(`/tenants/${tenantId}/branches`, form);
      }
      onSave();
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
        : undefined;
      setError(msg || 'Failed to save branch');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
            <Building2 size={18} className="text-emerald-600" />
            {branch ? 'Edit Branch' : 'Add New Branch'}
          </h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
            <X size={18} className="text-slate-500" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm border border-red-200">{error}</div>}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Branch Name *</label>
              <input type="text" value={form.store_name}
                onChange={e => setForm({ ...form, store_name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                placeholder="Main Branch" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Branch Code *</label>
              <input type="text" value={form.store_code}
                onChange={e => setForm({ ...form, store_code: e.target.value.toUpperCase() })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none font-mono"
                placeholder="MAIN" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Address</label>
            <input type="text" value={form.address}
              onChange={e => setForm({ ...form, address: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
              placeholder="123 Main Street" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Phone</label>
              <input type="text" value={form.phone}
                onChange={e => setForm({ ...form, phone: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                placeholder="+92 300 1234567" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Monthly Charge (Rs.)</label>
              <input type="number" min="0" value={form.monthly_charge}
                onChange={e => setForm({ ...form, monthly_charge: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                placeholder="0" />
            </div>
          </div>
          {branch && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
              <select value={form.is_active} onChange={e => setForm({ ...form, is_active: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none">
                <option value={1}>Active</option>
                <option value={0}>Inactive</option>
              </select>
            </div>
          )}
          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <button type="button" onClick={onClose}
              className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700 disabled:bg-slate-300 transition-colors font-medium">
              {saving ? 'Saving...' : branch ? 'Update Branch' : 'Create Branch'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── User Modal ──────────────────────────────────────────────────────────────
function UserModal({ user, tenantId, branches, onClose, onSave }: {
  user: UserRow | null; tenantId: number; branches: Branch[];
  onClose: () => void; onSave: () => void;
}) {
  const [form, setForm] = useState<UserForm>({
    username:  user?.username || '',
    name:      user?.name || '',
    email:     user?.email || '',
    password:  '',
    role_name: user?.role_name || 'Cashier',
    branch_id: user?.branch_id ? String(user.branch_id) : '',
  });
  const [showPass, setShowPass] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');

  const isAdmin = form.role_name === 'Admin';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) {
      setError('Name and email are required');
      return;
    }
    if (!user && (!form.username.trim() || !form.password.trim())) {
      setError('Username and password are required for new users');
      return;
    }
    if (!user && form.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = {
        ...form,
        branch_id: isAdmin ? null : (form.branch_id ? Number(form.branch_id) : null),
        password: form.password || undefined,
      };
      if (user) {
        await api.put(`/tenants/${tenantId}/users/${user.user_id}`, payload);
      } else {
        await api.post(`/tenants/${tenantId}/users`, payload);
      }
      onSave();
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
        : undefined;
      setError(msg || 'Failed to save user');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
            <UserPlus size={18} className="text-emerald-600" />
            {user ? 'Edit User' : 'Add New User'}
          </h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
            <X size={18} className="text-slate-500" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm border border-red-200">{error}</div>}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Full Name *</label>
              <input type="text" value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                placeholder="Muhammad Ahmed" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Username {!user && '*'}
              </label>
              <input type="text" value={form.username}
                onChange={e => setForm({ ...form, username: e.target.value })}
                disabled={!!user}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none disabled:bg-slate-50 disabled:text-slate-400"
                placeholder="ahmed123" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Email *</label>
            <input type="email" value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
              placeholder="ahmed@example.com" />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Password {!user ? '*' : '(leave blank to keep current)'}
            </label>
            <div className="relative">
              <input type={showPass ? 'text' : 'password'} value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                className="w-full px-3 py-2 pr-10 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                placeholder={user ? 'New password (optional)' : 'Min 8 characters'} />
              <button type="button" onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Role *</label>
              <select value={form.role_name}
                onChange={e => setForm({ ...form, role_name: e.target.value, branch_id: e.target.value === 'Admin' ? '' : form.branch_id })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none">
                <option value="Admin">Admin</option>
                <option value="Manager">Manager</option>
                <option value="Cashier">Cashier</option>
                <option value="Accountant">Accountant</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Branch {isAdmin ? '(Admin sees all)' : ''}
              </label>
              <select value={form.branch_id}
                onChange={e => setForm({ ...form, branch_id: e.target.value })}
                disabled={isAdmin}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none disabled:bg-slate-50 disabled:text-slate-400">
                <option value="">— No Branch —</option>
                {branches.map(b => (
                  <option key={b.store_id} value={b.store_id}>{b.store_name}</option>
                ))}
              </select>
            </div>
          </div>

          {!isAdmin && !form.branch_id && (
            <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
              Non-admin users without a branch assigned will not be able to access the system properly.
            </p>
          )}

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <button type="button" onClick={onClose}
              className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700 disabled:bg-slate-300 transition-colors font-medium">
              {saving ? 'Saving...' : user ? 'Update User' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const MODULE_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  sales:     { bg: 'bg-blue-50',    text: 'text-blue-600',    label: 'Sales' },
  inventory: { bg: 'bg-emerald-50', text: 'text-emerald-600', label: 'Inventory' },
  accounts:  { bg: 'bg-purple-50',  text: 'text-purple-600',  label: 'Accounts' },
  hr:        { bg: 'bg-orange-50',  text: 'text-orange-600',  label: 'HR' },
};

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000), h = Math.floor(diff / 3600000), days = Math.floor(diff / 86400000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  if (days === 1) return 'Yesterday';
  return `${days}d ago`;
}

const ROLE_COLORS: Record<string, string> = {
  Admin:       'bg-red-50 text-red-600',
  Manager:     'bg-blue-50 text-blue-600',
  Cashier:     'bg-slate-100 text-slate-600',
  Accountant:  'bg-purple-50 text-purple-600',
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { prices } = usePrices();
  const [data, setData]                   = useState<DetailData | null>(null);
  const [loading, setLoading]             = useState(true);
  const [showModules, setShowModules]     = useState(false);
  const [showReset, setShowReset]         = useState(false);
  const [branches, setBranches]           = useState<Branch[]>([]);
  const [users, setUsers]                 = useState<UserRow[]>([]);
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [editBranch, setEditBranch]       = useState<Branch | null>(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [editUser, setEditUser]           = useState<UserRow | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<number | null>(null);

  // Subscription form
  const [subForm, setSubForm] = useState({ ends_at: '', status: '' });
  const [savingSub, setSavingSub] = useState(false);

  // Tickets
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [showTicketForm, setShowTicketForm] = useState(false);
  const [ticketForm, setTicketForm] = useState({ subject: '', message: '', priority: 'medium' });
  const [savingTicket, setSavingTicket] = useState(false);

  const loadBranches = () =>
    api.get(`/tenants/${id}/branches`)
      .then(r => setBranches(r.data.data || []))
      .catch(() => setBranches([]));

  const loadUsers = () =>
    api.get(`/tenants/${id}/users`)
      .then(r => setUsers(r.data.data || []))
      .catch(() => setUsers([]));

  const loadTickets = () =>
    api.get(`/tickets/tenant/${id}`)
      .then(r => setTickets(r.data.data || []))
      .catch(() => setTickets([]));

  const load = () => {
    setLoading(true);
    api.get(`/tenants/${id}/details`)
      .then(r => {
        setData(r.data);
        const t = r.data.tenant;
        setSubForm({
          ends_at: t.subscription_ends_at ? t.subscription_ends_at.split('T')[0] : '',
          status:  t.subscription_status || 'trial',
        });
      })
      .catch(() => { setData(null); })
      .finally(() => setLoading(false));
    loadBranches();
    loadUsers();
    loadTickets();
  };

  const handleDeleteBranch = async (branch: Branch) => {
    if (!window.confirm(`Delete branch "${branch.store_name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/tenants/${id}/branches/${branch.store_id}`);
      loadBranches();
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
        : undefined;
      toast('error', msg || 'Failed to delete branch');
    }
  };

  const handleDeleteUser = async (user: UserRow) => {
    if (!window.confirm(`Delete user "${user.name}"? This cannot be undone.`)) return;
    setDeletingUserId(user.user_id);
    try {
      await api.delete(`/tenants/${id}/users/${user.user_id}`);
      loadUsers();
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
        : undefined;
      toast('error', msg || 'Failed to delete user');
    } finally {
      setDeletingUserId(null);
    }
  };

  const saveSubscription = async () => {
    setSavingSub(true);
    try {
      await api.put(`/tenants/${id}`, {
        subscription_ends_at: subForm.ends_at || null,
        subscription_status:  subForm.status || 'trial',
      });
      toast('success', 'Subscription updated');
      load();
    } catch {
      toast('error', 'Failed to update subscription');
    } finally {
      setSavingSub(false);
    }
  };

  const createTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketForm.subject || !ticketForm.message) return;
    setSavingTicket(true);
    try {
      await api.post('/tickets', {
        tenant_id: Number(id),
        subject:   ticketForm.subject,
        message:   ticketForm.message,
        priority:  ticketForm.priority,
      });
      toast('success', 'Ticket created');
      setShowTicketForm(false);
      setTicketForm({ subject: '', message: '', priority: 'medium' });
      loadTickets();
    } catch {
      toast('error', 'Failed to create ticket');
    } finally {
      setSavingTicket(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  if (loading) return (
    <div className="p-6 max-w-6xl animate-pulse space-y-4">
      <div className="h-8 w-48 bg-slate-100 rounded-xl" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <div key={i} className="h-28 bg-slate-100 rounded-2xl" />)}
      </div>
      <div className="h-64 bg-slate-100 rounded-2xl" />
    </div>
  );

  if (!data) return (
    <div className="p-6 flex flex-col items-center justify-center min-h-[40vh] gap-3">
      <p className="text-slate-500 font-medium">Failed to load client data</p>
      <button onClick={load}
        className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition">
        Retry
      </button>
    </div>
  );

  const { tenant, sales_count, total_revenue, db_size_mb, recent_logins, monthly_price } = data;
  const mods = Array.isArray(tenant.modules_enabled) ? tenant.modules_enabled : [];

  const stats = [
    { label: 'Users',       value: users.length,                          icon: Users,       color: 'text-slate-600',  bg: 'bg-slate-100' },
    { label: 'Total Sales', value: sales_count.toLocaleString(),          icon: ShoppingCart,color: 'text-emerald-600',bg: 'bg-emerald-50' },
    { label: 'Revenue',     value: `Rs. ${total_revenue.toLocaleString()}`,icon: Package,    color: 'text-emerald-600',bg: 'bg-emerald-50' },
    { label: 'DB Size',     value: `${db_size_mb} MB`,                    icon: Database,    color: 'text-slate-600',  bg: 'bg-slate-100' },
  ];

  return (
    <div className="p-6 max-w-6xl space-y-5">

      {/* Back + Header */}
      <div className="relative bg-white border border-slate-100 rounded-2xl px-5 py-4 shadow-sm overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-50/60 via-transparent to-transparent pointer-events-none" />
        <div className="absolute -top-6 -left-6 w-28 h-28 bg-emerald-400/8 rounded-full blur-3xl pointer-events-none" />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/clients')}
              className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 transition flex-shrink-0">
              <ArrowLeft size={18} />
            </button>
            <div className="w-12 h-12 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-md shadow-emerald-200 flex-shrink-0">
              {(tenant.company_name || tenant.tenant_name).charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold text-slate-800">
                  {tenant.company_name || tenant.tenant_name}
                </h2>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                  tenant.is_active ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-slate-100 text-slate-500'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${tenant.is_active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                  {tenant.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <p className="text-slate-400 text-sm font-mono mt-0.5">{tenant.tenant_code} · {tenant.admin_email}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={() => setShowModules(true)}
              className="px-3 py-2 text-sm border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition font-medium">
              Manage Modules
            </button>
            <button onClick={() => setShowReset(true)}
              className="px-3 py-2 text-sm border border-amber-200 rounded-xl text-amber-600 hover:bg-amber-50 transition font-medium">
              Reset Password
            </button>
          </div>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon, color, bg }, i) => (
          i === 2 ? (
            <div key={label} className="relative bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-5 overflow-hidden shadow-lg shadow-emerald-200 group hover:-translate-y-0.5 transition-transform duration-200">
              <div className="absolute -bottom-4 -right-4 w-20 h-20 bg-white/10 rounded-full blur-2xl pointer-events-none" />
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                <Icon size={18} className="text-white" />
              </div>
              <p className="text-xl font-bold text-white">{value}</p>
              <p className="text-purple-100 text-sm">{label}</p>
            </div>
          ) : (
            <div key={label} className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-md transition-shadow duration-200 group">
              <div className={`w-10 h-10 ${bg} rounded-xl flex items-center justify-center mb-3 group-hover:scale-105 transition-transform`}>
                <Icon size={18} className={color} />
              </div>
              <p className="text-xl font-bold text-slate-800">{value}</p>
              <p className="text-slate-500 text-sm">{label}</p>
            </div>
          )
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Modules + Info */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 bg-purple-100 rounded-lg flex items-center justify-center">
                <Package size={13} className="text-purple-600" />
              </div>
              <h3 className="text-sm font-bold text-slate-700">Active Modules</h3>
            </div>
            <div className="space-y-2">
              {mods.length === 0 ? (
                <p className="text-slate-400 text-sm">No modules enabled</p>
              ) : mods.map(m => {
                const s = MODULE_STYLES[m] || { bg: 'bg-slate-50', text: 'text-slate-600', label: m };
                const price = prices[m as keyof typeof prices] ?? (['accounts', 'hr'].includes(m) ? 2999 : 2250);
                return (
                  <div key={m} className={`flex items-center justify-between px-3 py-2 rounded-xl ${s.bg}`}>
                    <span className={`text-sm font-medium ${s.text}`}>{s.label}</span>
                    <span className={`text-xs font-semibold ${s.text}`}>Rs. {price.toLocaleString()}</span>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100 flex justify-between items-center">
              <span className="text-sm text-slate-500">Monthly Total</span>
              <span className="text-sm font-bold text-slate-800">Rs. {monthly_price.toLocaleString()}</span>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 bg-slate-100 rounded-lg flex items-center justify-center">
                <Building2 size={13} className="text-slate-500" />
              </div>
              <h3 className="text-sm font-bold text-slate-700">Client Info</h3>
            </div>
            <div className="space-y-2.5 text-sm">
              {[
                { label: 'Database', value: tenant.db_name },
                { label: 'Created',  value: new Date(tenant.created_at).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' }) },
                { label: 'Branches', value: `${branches.length} branch${branches.length !== 1 ? 'es' : ''}` },
                { label: 'Annual',   value: `Rs. ${(monthly_price * 12).toLocaleString()}` },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between">
                  <span className="text-slate-400">{label}</span>
                  <span className="text-slate-700 font-medium font-mono text-xs">{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Subscription */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 bg-amber-100 rounded-lg flex items-center justify-center">
                <Calendar size={13} className="text-amber-600" />
              </div>
              <h3 className="text-sm font-bold text-slate-700">Subscription</h3>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Status</label>
                <select
                  value={subForm.status}
                  onChange={e => setSubForm(f => ({ ...f, status: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="trial">Trial</option>
                  <option value="active">Active</option>
                  <option value="expired">Expired</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Ends At</label>
                <input
                  type="date"
                  value={subForm.ends_at}
                  onChange={e => setSubForm(f => ({ ...f, ends_at: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              {subForm.ends_at && (() => {
                const days = Math.ceil((new Date(subForm.ends_at).getTime() - Date.now()) / 86400000);
                return (
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium ${
                    days < 0 ? 'bg-red-50 text-red-600' : days <= 7 ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'
                  }`}>
                    <AlertTriangle size={12} />
                    {days < 0 ? `Expired ${Math.abs(days)}d ago` : days === 0 ? 'Expires today' : `Expires in ${days} days`}
                  </div>
                );
              })()}
              <button
                onClick={saveSubscription}
                disabled={savingSub}
                className="w-full px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl transition disabled:opacity-60"
              >
                {savingSub ? 'Saving…' : 'Save Subscription'}
              </button>
            </div>
          </div>
        </div>

        {/* Recent Logins */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
            <div className="w-7 h-7 bg-slate-100 rounded-lg flex items-center justify-center">
              <Clock size={14} className="text-slate-500" />
            </div>
            <h3 className="text-sm font-bold text-slate-700">Recent Logins</h3>
          </div>
          {recent_logins.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-sm">No login records</div>
          ) : (
            <div className="divide-y divide-slate-50">
              {recent_logins.map((l, i) => (
                <div key={i} className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50/60 transition-colors">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-xs font-bold text-white shadow-sm ${
                    i === 0 ? 'bg-gradient-to-br from-emerald-500 to-teal-600' : 'bg-gradient-to-br from-slate-400 to-slate-500'
                  }`}>
                    {(l.user_name || 'U').charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-700">{l.user_name || 'Unknown'}</p>
                    <p className="text-xs text-slate-400 flex items-center gap-1">
                      <Globe size={10} /> {l.ip_address || '—'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-medium text-slate-500">{timeAgo(l.created_at)}</p>
                    <p className="text-xs text-slate-400">
                      {new Date(l.created_at).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Branches Management */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-emerald-100 rounded-lg flex items-center justify-center">
              <Building2 size={14} className="text-emerald-600" />
            </div>
            <h3 className="text-sm font-bold text-slate-700">Branches / Stores <span className="text-slate-400 font-normal">({branches.length})</span></h3>
          </div>
          <button
            onClick={() => { setEditBranch(null); setShowBranchModal(true); }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 text-white text-xs font-semibold rounded-xl hover:bg-emerald-600 transition shadow-sm shadow-emerald-200">
            <Plus size={13} />
            Add Branch
          </button>
        </div>
        {branches.length === 0 ? (
          <div className="py-10 text-center text-slate-400 text-sm">No branches found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  {['Branch', 'Code', 'Address', 'Monthly Charge', 'Staff', "Today's Sales", 'Month Revenue', 'Status', ''].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {branches.map(b => (
                  <tr key={b.store_id} className="border-b border-slate-50 hover:bg-slate-50/60">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${b.is_active ? 'bg-emerald-50' : 'bg-slate-100'}`}>
                          <Building2 size={13} className={b.is_active ? 'text-emerald-600' : 'text-slate-400'} />
                        </div>
                        <div>
                          <span className="font-medium text-slate-800">{b.store_name}</span>
                          {b.manager_name && <p className="text-xs text-slate-400">{b.manager_name}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{b.store_code}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs max-w-[150px] truncate">{b.address || '—'}</td>
                    <td className="px-4 py-3 font-medium text-slate-700">Rs. {Number(b.monthly_charge).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <span className="text-slate-600">{b.total_staff}</span>
                      <span className="text-xs text-slate-400 ml-1">staff</span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{b.today_sales}</td>
                    <td className="px-4 py-3 font-medium text-emerald-700">Rs. {Number(b.month_revenue).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-lg text-xs font-medium ${b.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                        {b.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => { setEditBranch(b); setShowBranchModal(true); }}
                          className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="Edit Branch">
                          <Pencil size={13} />
                        </button>
                        <button onClick={() => handleDeleteBranch(b)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete Branch">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Users Management */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-emerald-100 rounded-lg flex items-center justify-center">
              <Users size={14} className="text-emerald-600" />
            </div>
            <h3 className="text-sm font-bold text-slate-700">Users <span className="text-slate-400 font-normal">({users.length})</span></h3>
          </div>
          <button
            onClick={() => { setEditUser(null); setShowUserModal(true); }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 text-white text-xs font-semibold rounded-xl hover:bg-emerald-600 transition shadow-sm shadow-emerald-200">
            <UserPlus size={13} />
            Add User
          </button>
        </div>
        {users.length === 0 ? (
          <div className="py-10 text-center text-slate-400 text-sm">No users found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  {['User', 'Email', 'Role', 'Branch', 'Joined', ''].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.user_id} className="border-b border-slate-50 hover:bg-slate-50/60">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          u.role_name === 'Admin' ? 'bg-red-50' : 'bg-slate-100'
                        }`}>
                          {u.role_name === 'Admin'
                            ? <Shield size={12} className="text-red-500" />
                            : <User size={12} className="text-slate-500" />
                          }
                        </div>
                        <div>
                          <p className="font-medium text-slate-800 text-sm">{u.name || u.username}</p>
                          <p className="text-slate-400 text-xs">{u.username}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-lg text-xs font-medium ${ROLE_COLORS[u.role_name] || 'bg-slate-100 text-slate-600'}`}>
                        {u.role_name}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {u.branch_name ? (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg">
                          <Building2 size={10} /> {u.branch_name}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">
                          {u.role_name === 'Admin' ? 'All branches' : '— Not assigned —'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs">
                      {new Date(u.created_at).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => { setEditUser(u); setShowUserModal(true); }}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit User">
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => handleDeleteUser(u)}
                          disabled={deletingUserId === u.user_id}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40" title="Delete User">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Support Tickets */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-emerald-100 rounded-lg flex items-center justify-center">
              <LifeBuoy size={14} className="text-emerald-600" />
            </div>
            <h3 className="text-sm font-bold text-slate-700">Support Tickets <span className="text-slate-400 font-normal">({tickets.length})</span></h3>
          </div>
          <button
            onClick={() => setShowTicketForm(f => !f)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 text-white text-xs font-semibold rounded-xl hover:bg-emerald-600 transition shadow-sm shadow-emerald-200"
          >
            <Plus size={13} />
            New Ticket
          </button>
        </div>

        {showTicketForm && (
          <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50">
            <form onSubmit={createTicket} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <input
                    value={ticketForm.subject}
                    onChange={e => setTicketForm(f => ({ ...f, subject: e.target.value }))}
                    required
                    placeholder="Subject *"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                  />
                </div>
                <div className="col-span-2">
                  <textarea
                    value={ticketForm.message}
                    onChange={e => setTicketForm(f => ({ ...f, message: e.target.value }))}
                    required
                    placeholder="Message *"
                    rows={2}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white resize-none"
                  />
                </div>
                <select
                  value={ticketForm.priority}
                  onChange={e => setTicketForm(f => ({ ...f, priority: e.target.value }))}
                  className="px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
                <div className="flex gap-2">
                  <button type="submit" disabled={savingTicket} className="flex-1 px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl transition disabled:opacity-60">
                    {savingTicket ? 'Saving…' : 'Create'}
                  </button>
                  <button type="button" onClick={() => setShowTicketForm(false)} className="px-3 py-2 text-xs text-slate-500 border border-slate-200 rounded-xl hover:bg-slate-100 transition">
                    Cancel
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}

        {tickets.length === 0 ? (
          <div className="py-10 text-center text-slate-400 text-sm">No support tickets</div>
        ) : (
          <div className="divide-y divide-slate-50">
            {tickets.map(tk => (
              <div key={tk.ticket_id} className="flex items-start gap-4 px-5 py-3.5 hover:bg-slate-50/60">
                <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                  tk.status === 'open' ? 'bg-red-500' :
                  tk.status === 'in_progress' ? 'bg-amber-500' :
                  tk.status === 'resolved' ? 'bg-emerald-500' : 'bg-slate-300'
                }`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-slate-800">{tk.subject}</p>
                    <span className={`text-[11px] px-1.5 py-0.5 rounded font-bold uppercase ${
                      tk.priority === 'urgent' ? 'bg-red-50 text-red-600' :
                      tk.priority === 'high' ? 'bg-amber-50 text-amber-600' :
                      'bg-slate-50 text-slate-500'
                    }`}>{tk.priority}</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5 truncate">{tk.message}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <span className={`text-[11px] px-2 py-0.5 rounded-lg font-bold capitalize ${
                    tk.status === 'open' ? 'bg-red-50 text-red-700' :
                    tk.status === 'in_progress' ? 'bg-amber-50 text-amber-700' :
                    tk.status === 'resolved' ? 'bg-emerald-50 text-emerald-700' :
                    'bg-slate-100 text-slate-500'
                  }`}>{tk.status.replace('_', ' ')}</span>
                  <p className="text-[10px] text-slate-300 mt-1">{timeAgo(tk.created_at)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {showBranchModal && (
        <BranchModal
          branch={editBranch}
          tenantId={Number(id)}
          onClose={() => { setShowBranchModal(false); setEditBranch(null); }}
          onSave={() => { setShowBranchModal(false); setEditBranch(null); loadBranches(); }}
        />
      )}

      {showUserModal && (
        <UserModal
          user={editUser}
          tenantId={Number(id)}
          branches={branches}
          onClose={() => { setShowUserModal(false); setEditUser(null); }}
          onSave={() => { setShowUserModal(false); setEditUser(null); loadUsers(); }}
        />
      )}

      {showModules && (
        <EditModulesModal
          tenantId={tenant.tenant_id}
          clientName={tenant.company_name || tenant.tenant_name}
          currentModules={mods}
          onClose={() => { setShowModules(false); load(); }}
        />
      )}

      {showReset && (
        <ResetPasswordModal
          tenantId={tenant.tenant_id}
          clientName={tenant.company_name || tenant.tenant_name}
          onClose={() => setShowReset(false)}
        />
      )}
    </div>
  );
}
