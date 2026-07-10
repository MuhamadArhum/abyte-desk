import { useState, useEffect, useMemo } from 'react';
import {
  BookOpen, Plus, Edit, Trash2, Search, X, Lock,
  ChevronDown, ChevronRight, Building2, CreditCard,
  Landmark, TrendingUp, TrendingDown, Loader2
} from 'lucide-react';
import api from '../../utils/api';
import { useToast } from '../../components/Toast';
import { useConfirm } from '../../components/ConfirmDialog';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Account {
  account_id: number;
  account_code: string;
  account_name: string;
  account_type: string;
  parent_account_id: number | null;
  level: number;
  is_system: number;
  is_active: boolean;
  current_balance: number;
  opening_balance: number;
  description: string | null;
  group_name: string;
  children?: Account[];
}

// ─── Config ───────────────────────────────────────────────────────────────────
const TYPE_CONFIG: Record<string, { label: string; Icon: any; color: string; bg: string; border: string; badge: string; btnClass: string }> = {
  asset:     { label: 'Assets',          Icon: Building2,   color: 'text-emerald-700', bg: 'bg-emerald-50',  border: 'border-emerald-300', badge: 'bg-emerald-100 text-emerald-700', btnClass: 'bg-emerald-600 hover:bg-emerald-700' },
  liability: { label: 'Liabilities',     Icon: CreditCard,  color: 'text-red-700',     bg: 'bg-red-50',      border: 'border-red-300',     badge: 'bg-red-100 text-red-700',         btnClass: 'bg-red-600 hover:bg-red-700' },
  equity:    { label: 'Equity',          Icon: Landmark,    color: 'text-gray-700',    bg: 'bg-gray-50',     border: 'border-gray-300',    badge: 'bg-gray-100 text-gray-700',       btnClass: 'bg-gray-600 hover:bg-gray-700' },
  revenue:   { label: 'Revenue/Income',  Icon: TrendingUp,  color: 'text-emerald-700', bg: 'bg-emerald-50',  border: 'border-emerald-300', badge: 'bg-emerald-100 text-emerald-700', btnClass: 'bg-emerald-600 hover:bg-emerald-700' },
  expense:   { label: 'Expenses',        Icon: TrendingDown,color: 'text-gray-700',    bg: 'bg-gray-50',     border: 'border-gray-300',    badge: 'bg-gray-100 text-gray-700',       btnClass: 'bg-gray-600 hover:bg-gray-700' },
};

const INDENT = [0, 0, 20, 40, 60]; // px indent per level

// ─── Tree builder ─────────────────────────────────────────────────────────────
function buildTree(flat: Account[]): Account[] {
  const map = new Map<number, Account>();
  flat.forEach(a => map.set(a.account_id, { ...a, children: [] }));
  const roots: Account[] = [];
  flat.forEach(a => {
    if (!a.parent_account_id) {
      roots.push(map.get(a.account_id)!);
    } else {
      map.get(a.parent_account_id)?.children?.push(map.get(a.account_id)!);
    }
  });
  return roots;
}

function flattenTree(nodes: Account[], result: Account[] = []): Account[] {
  nodes.forEach(n => { result.push(n); if (n.children?.length) flattenTree(n.children, result); });
  return result;
}

// ─── Create / Edit Modal ──────────────────────────────────────────────────────
const AccountModal = ({
  mode, account, parentAccount, allAccounts, onClose, onSuccess
}: {
  mode: 'create' | 'edit';
  account?: Account | null;
  parentAccount?: Account | null;
  allAccounts: Account[];
  onClose: () => void;
  onSuccess: () => void;
}) => {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [codeLoading, setCodeLoading] = useState(false);
  const [form, setForm] = useState({
    account_code: '',
    account_name: '',
    parent_account_id: '',
    opening_balance: '0',
    description: '',
    is_active: true,
  });

  // Determine parent for create mode
  const selectedParent = useMemo(() => {
    if (mode === 'create') {
      const pid = parseInt(form.parent_account_id);
      return allAccounts.find(a => a.account_id === pid) || parentAccount || null;
    }
    return null;
  }, [form.parent_account_id, allAccounts, parentAccount, mode]);

  const inheritedType = mode === 'create' ? selectedParent?.account_type || '' : account?.account_type || '';
  const inheritedLevel = mode === 'create' ? (selectedParent ? selectedParent.level + 1 : null) : account?.level;

  // Auto-fetch next code when parent changes
  const fetchNextCode = async (parentId: string) => {
    if (!parentId) return;
    setCodeLoading(true);
    try {
      const res = await api.get('/accounting/accounts/next-code', { params: { parent_id: parentId } });
      setForm(f => ({ ...f, account_code: res.data.next_code }));
    } catch {
      // silently ignore — user can type manually
    } finally {
      setCodeLoading(false);
    }
  };

  useEffect(() => {
    if (mode === 'create') {
      const pid = parentAccount ? String(parentAccount.account_id) : '';
      setForm({
        account_code: '',
        account_name: '',
        parent_account_id: pid,
        opening_balance: '0',
        description: '',
        is_active: true,
      });
      if (pid) fetchNextCode(pid);
    } else if (account) {
      setForm({
        account_code: account.account_code,
        account_name: account.account_name,
        parent_account_id: String(account.parent_account_id || ''),
        opening_balance: '0',
        description: account.description || '',
        is_active: account.is_active,
      });
    }
  }, [mode, account, parentAccount]);

  // Selectable parents: exclude system accounts of level=1 only when adding level>2,
  // and exclude self + descendants
  const validParents = useMemo(() => {
    if (mode !== 'create') return [];
    return allAccounts.filter(a => a.level < 4 && a.account_id !== account?.account_id);
  }, [allAccounts, mode, account]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'create' && !form.parent_account_id) {
      toast.error('Parent account is required');
      return;
    }
    setLoading(true);
    try {
      if (mode === 'create') {
        await api.post('/accounting/accounts', {
          account_code: form.account_code,
          account_name: form.account_name,
          parent_account_id: parseInt(form.parent_account_id),
          opening_balance: parseFloat(form.opening_balance) || 0,
          description: form.description || null,
        });
        toast.success('Account created successfully');
      } else if (account) {
        await api.put(`/accounting/accounts/${account.account_id}`, {
          account_name: form.account_name,
          is_active: form.is_active,
          description: form.description || null,
        });
        toast.success('Account updated successfully');
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Operation failed');
    } finally {
      setLoading(false);
    }
  };

  const cfg = inheritedType ? TYPE_CONFIG[inheritedType] : null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        {/* Header */}
        <div className={`flex items-center justify-between p-5 border-b rounded-t-2xl ${cfg ? cfg.bg : 'bg-gray-50'}`}>
          <div>
            <h2 className="text-base font-semibold text-gray-800">
              {mode === 'create' ? 'Add Sub-Account' : 'Edit Account'}
            </h2>
            {cfg && (
              <span className={`text-xs font-medium mt-0.5 inline-block ${cfg.color}`}>
                {cfg.Icon && <cfg.Icon size={11} className="inline mr-1" />}
                {cfg.label}
                {inheritedLevel && ` · Level ${inheritedLevel}`}
              </span>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-black/10 rounded-lg">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Parent selector (create only, no pre-selected parent) */}
          {mode === 'create' && !parentAccount && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Parent Account <span className="text-red-500">*</span>
              </label>
              <select
                value={form.parent_account_id}
                onChange={e => {
                  setForm({ ...form, parent_account_id: e.target.value, account_code: '' });
                  if (e.target.value) fetchNextCode(e.target.value);
                }}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                required
              >
                <option value="">— Select Parent Account —</option>
                {validParents.map(a => (
                  <option key={a.account_id} value={a.account_id}>
                    {'— '.repeat(a.level - 1)}{a.account_code} · {a.account_name} {a.level === 1 ? '(Root)' : `(L${a.level})`}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Pre-selected parent (read-only) */}
          {mode === 'create' && parentAccount && (
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${cfg?.bg || 'bg-gray-50'} border ${cfg?.border || 'border-gray-200'}`}>
              <span className="text-gray-500">Under:</span>
              <span className={`font-semibold ${cfg?.color || 'text-gray-700'}`}>
                [{parentAccount.account_code}] {parentAccount.account_name}
              </span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Account Code <span className="text-red-500">*</span>
                {codeLoading && <Loader2 size={11} className="inline ml-1 animate-spin text-emerald-500" />}
                {!codeLoading && mode === 'create' && form.account_code && (
                  <span className="ml-1 text-xs text-emerald-500 font-normal">auto</span>
                )}
              </label>
              <input
                type="text"
                value={form.account_code}
                onChange={e => setForm({ ...form, account_code: e.target.value })}
                disabled={mode === 'edit'}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm disabled:bg-gray-50 disabled:text-gray-500"
                placeholder={codeLoading ? 'Generating...' : 'e.g. 1101'}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Account Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.account_name}
                onChange={e => setForm({ ...form, account_name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                placeholder="e.g. Cash in Hand"
                required
              />
            </div>
          </div>

          {mode === 'create' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Opening Balance</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.opening_balance}
                onChange={e => setForm({ ...form, opening_balance: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
              />
            </div>
          )}

          {mode === 'edit' && (
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="is_active"
                checked={form.is_active}
                onChange={e => setForm({ ...form, is_active: e.target.checked })}
                className="w-4 h-4 text-emerald-600 rounded border-gray-300"
              />
              <label htmlFor="is_active" className="text-sm font-medium text-gray-700">Active Account</label>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm resize-none"
              placeholder="Optional description..."
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-700 hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className={`flex-1 px-4 py-2.5 rounded-xl text-sm text-white font-medium disabled:opacity-50 flex items-center justify-center gap-2 ${cfg ? cfg.btnClass : 'bg-emerald-600 hover:bg-emerald-700'}`}
            >
              {loading && <Loader2 size={15} className="animate-spin" />}
              {mode === 'create' ? 'Create Account' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Account Row ──────────────────────────────────────────────────────────────
const AccountRow = ({
  account, expanded, onToggle, onAddChild, onEdit, onDelete
}: {
  account: Account;
  expanded: boolean;
  onToggle: () => void;
  onAddChild: (a: Account) => void;
  onEdit: (a: Account) => void;
  onDelete: (a: Account) => void;
}) => {
  const cfg = TYPE_CONFIG[account.account_type];
  const hasChildren = (account.children?.length ?? 0) > 0;
  const indentPx = INDENT[account.level] ?? 60;
  const isL1 = account.level === 1;

  return (
    <tr className={`border-b transition-colors ${isL1 ? `${cfg.bg} font-semibold` : 'hover:bg-gray-50/70'}`}>
      {/* Name cell with indentation */}
      <td className="p-0">
        <div className="flex items-center gap-1 py-2.5 pr-3" style={{ paddingLeft: `${12 + indentPx}px` }}>
          {/* Expand/collapse */}
          {hasChildren ? (
            <button onClick={onToggle} className="p-0.5 hover:bg-black/10 rounded text-gray-500">
              {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
          ) : (
            <span className="w-5" />
          )}

          {/* Type icon for L1 */}
          {isL1 && cfg && <cfg.Icon size={15} className={`mr-1 ${cfg.color}`} />}

          {/* Level indent line for L3+ */}
          {account.level >= 3 && (
            <span className="text-gray-300 mr-1 text-xs">└</span>
          )}

          <div>
            <span className={`text-sm ${isL1 ? cfg.color : 'text-gray-800'}`}>
              <span className="font-mono text-xs text-gray-400 mr-2">{account.account_code}</span>
              {account.account_name}
            </span>
            {!account.is_active && (
              <span className="ml-2 px-1.5 py-0.5 bg-gray-100 text-gray-400 text-xs rounded">Inactive</span>
            )}
          </div>
        </div>
      </td>

      {/* Level badge */}
      <td className="px-3 py-2.5 text-center">
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${isL1 ? cfg.badge : 'bg-gray-100 text-gray-600'}`}>
          {isL1 ? cfg.label : `Level ${account.level}`}
        </span>
      </td>

      {/* Balance */}
      <td className="px-3 py-2.5 text-right font-mono text-sm text-gray-700">
        {Number(account.current_balance).toLocaleString('en-PK', { minimumFractionDigits: 2 })}
      </td>

      {/* Actions */}
      <td className="px-3 py-2.5 text-center">
        <div className="flex items-center justify-center gap-1">
          {/* Add child (not for level 4) */}
          {account.level < 4 && (
            <button
              onClick={() => onAddChild(account)}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium ${cfg.badge} hover:opacity-80 transition`}
              title="Add sub-account"
            >
              <Plus size={12} /> Add
            </button>
          )}

          {/* Edit (not for system) */}
          {!isL1 && (
            <button onClick={() => onEdit(account)}
              className="p-1.5 text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
              title="Edit">
              <Edit size={14} />
            </button>
          )}

          {/* Delete (not for system) */}
          {!isL1 && (
            <button onClick={() => onDelete(account)}
              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
              title="Delete">
              <Trash2 size={14} />
            </button>
          )}

          {/* Lock for system accounts */}
          {isL1 && (
            <span className="p-1.5 text-gray-300" title="System account — cannot be deleted">
              <Lock size={14} />
            </span>
          )}
        </div>
      </td>
    </tr>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
const ChartOfAccounts = () => {
  const toast = useToast();
  const confirm = useConfirm();
  const [allAccounts, setAllAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  // Modal state
  const [modal, setModal] = useState<{
    open: boolean;
    mode: 'create' | 'edit';
    account?: Account | null;
    parentAccount?: Account | null;
  }>({ open: false, mode: 'create' });

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const params: any = { tree: '1' };
      if (typeFilter) params.type = typeFilter;
      if (search) params.search = search;
      const res = await api.get('/accounting/accounts', { params });
      const flat: Account[] = res.data.data || [];
      setAllAccounts(flat);
      // Auto-expand Level 1 accounts
      const l1ids = flat.filter(a => a.level === 1).map(a => a.account_id);
      setExpanded(prev => {
        const next = new Set(prev);
        l1ids.forEach(id => next.add(id));
        return next;
      });
    } catch {
      toast.error('Failed to load accounts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAccounts(); }, [typeFilter, search]);

  const toggle = (id: number) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleDelete = async (account: Account) => {
    const ok = await confirm({ title: 'Delete Account', message: `Delete "${account.account_name}"? This cannot be undone.`, type: 'danger' });
    if (!ok) return;
    try {
      await api.delete(`/accounting/accounts/${account.account_id}`);
      toast.success('Account deleted');
      fetchAccounts();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Delete failed');
    }
  };

  // Build tree and flatten respecting expand state
  const displayRows = useMemo(() => {
    const tree = buildTree(allAccounts);

    function visibleNodes(nodes: Account[]): Account[] {
      const result: Account[] = [];
      nodes.forEach(n => {
        result.push(n);
        if (expanded.has(n.account_id) && n.children?.length) {
          result.push(...visibleNodes(n.children));
        }
      });
      return result;
    }

    // If searching, show all flattened
    if (search || typeFilter) return flattenTree(tree);
    return visibleNodes(tree);
  }, [allAccounts, expanded, search, typeFilter]);

  // Summary counts
  const summary = useMemo(() => {
    const counts: Record<string, number> = {};
    allAccounts.forEach(a => { counts[a.account_type] = (counts[a.account_type] || 0) + 1; });
    return counts;
  }, [allAccounts]);

  return (
    <div className="p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-100 rounded-xl"><BookOpen className="text-emerald-600" size={20} /></div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Chart of Accounts</h1>
            <p className="text-sm text-gray-500">4-level hierarchical account structure</p>
          </div>
        </div>
        <button
          onClick={() => setModal({ open: true, mode: 'create', account: null, parentAccount: null })}
          className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-xl hover:bg-emerald-700 transition text-sm font-medium shadow-sm"
        >
          <Plus size={16} /> Add Account
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5">
        {Object.entries(TYPE_CONFIG).map(([type, cfg]) => (
          <button
            key={type}
            onClick={() => setTypeFilter(typeFilter === type ? '' : type)}
            className={`p-3 rounded-xl border-2 text-left transition-all ${typeFilter === type ? `${cfg.bg} ${cfg.border}` : 'bg-white border-gray-100 hover:border-gray-200'}`}
          >
            <div className="flex items-center gap-2 mb-1">
              <cfg.Icon size={14} className={cfg.color} />
              <span className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
            </div>
            <p className="text-lg font-bold text-gray-800">{summary[type] || 0}</p>
            <p className="text-xs text-gray-400">accounts</p>
          </button>
        ))}
      </div>

      {/* Search + filter bar */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 mb-4 flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by code or name..."
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
          />
        </div>
        {(search || typeFilter) && (
          <button onClick={() => { setSearch(''); setTypeFilter(''); }}
            className="flex items-center gap-1 px-3 py-2 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50">
            <X size={14} /> Clear
          </button>
        )}
        <p className="text-sm text-gray-400 whitespace-nowrap">{allAccounts.length} accounts</p>
      </div>

      {/* Level legend */}
      <div className="flex items-center gap-4 mb-3 px-1">
        <span className="text-xs text-gray-400 font-medium">LEVELS:</span>
        {[1, 2, 3, 4].map(l => (
          <span key={l} className="text-xs text-gray-500 flex items-center gap-1">
            <span className={`w-4 h-4 rounded text-white flex items-center justify-center text-[10px] font-bold ${l === 1 ? 'bg-emerald-600' : l === 2 ? 'bg-gray-500' : l === 3 ? 'bg-gray-400' : 'bg-gray-300'}`}>{l}</span>
            {l === 1 ? 'System (Fixed)' : l === 2 ? 'Group' : l === 3 ? 'Sub-Group' : 'Detail'}
          </span>
        ))}
      </div>

      {/* Tree Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[600px]">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Account</th>
              <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Type / Level</th>
              <th className="text-right px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Balance</th>
              <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="py-16 text-center text-gray-400">
                <Loader2 size={28} className="animate-spin mx-auto mb-2 text-emerald-500" />
                <p className="text-sm">Loading accounts...</p>
              </td></tr>
            ) : displayRows.length === 0 ? (
              <tr><td colSpan={4} className="py-16 text-center text-gray-400">
                <BookOpen size={32} className="mx-auto mb-2 text-gray-300" />
                <p className="text-sm">No accounts found</p>
              </td></tr>
            ) : (
              displayRows.map(acc => (
                <AccountRow
                  key={acc.account_id}
                  account={acc}
                  expanded={expanded.has(acc.account_id)}
                  onToggle={() => toggle(acc.account_id)}
                  onAddChild={a => setModal({ open: true, mode: 'create', account: null, parentAccount: a })}
                  onEdit={a => setModal({ open: true, mode: 'edit', account: a, parentAccount: null })}
                  onDelete={handleDelete}
                />
              ))
            )}
          </tbody>
        </table>
        </div>
      </div>

      {/* Modal */}
      {modal.open && (
        <AccountModal
          mode={modal.mode}
          account={modal.account}
          parentAccount={modal.parentAccount}
          allAccounts={allAccounts}
          onClose={() => setModal({ open: false, mode: 'create' })}
          onSuccess={fetchAccounts}
        />
      )}
    </div>
  );
};

export default ChartOfAccounts;
