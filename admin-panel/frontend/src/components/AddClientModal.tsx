import { useState, type FormEvent } from 'react';
import { X, AlertCircle, Eye, EyeOff, UserPlus, ChevronDown, ChevronRight } from 'lucide-react';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';
import { usePrices } from '../hooks/usePrices';

interface SubModule { key: string; label: string; }
interface ModuleDef  { key: string; label: string; icon: string; price: number; subModules: SubModule[]; }

const MODULE_META = [
  {
    key: 'sales', label: 'Sales', icon: '🛒',
    subModules: [
      { key: 'sales.pos',         label: 'Point of Sale' },
      { key: 'sales.orders',      label: 'Orders / Done Orders' },
      { key: 'sales.returns',     label: 'Sales Returns' },
      { key: 'sales.credit',      label: 'Credit Sales' },
      { key: 'sales.quotations',  label: 'Quotations' },
      { key: 'sales.deliveries',  label: 'Deliveries' },
      { key: 'sales.price-rules', label: 'Price Rules' },
      { key: 'sales.targets',     label: 'Sales Targets' },
      { key: 'sales.loyalty',     label: 'Loyalty & Coupons' },
    ],
  },
  {
    key: 'inventory', label: 'Inventory', icon: '📦',
    subModules: [
      { key: 'inventory.products',          label: 'Products & Variants' },
      { key: 'inventory.purchase-orders',   label: 'Purchase Orders' },
      { key: 'inventory.suppliers',         label: 'Suppliers' },
      { key: 'inventory.stock-adjustments', label: 'Stock Adjustments' },
      { key: 'inventory.stock-transfers',   label: 'Stock Transfers' },
      { key: 'inventory.recipes',           label: 'Recipes / Manufacturing' },
      { key: 'inventory.issuance',          label: 'Stock Issuance' },
    ],
  },
  {
    key: 'accounts', label: 'Accounts', icon: '📊',
    subModules: [
      { key: 'accounts.chart',    label: 'Chart of Accounts' },
      { key: 'accounts.journal',  label: 'Journal Entries' },
      { key: 'accounts.vouchers', label: 'Payment Vouchers' },
      { key: 'accounts.bank',     label: 'Bank Accounts' },
      { key: 'accounts.reports',  label: 'Financial Reports' },
    ],
  },
  {
    key: 'hr', label: 'HR & Payroll', icon: '👥',
    subModules: [
      { key: 'hr.staff',      label: 'Staff Management' },
      { key: 'hr.attendance', label: 'Attendance' },
      { key: 'hr.payroll',    label: 'Payroll' },
      { key: 'hr.leaves',     label: 'Leave Management' },
      { key: 'hr.loans',      label: 'Loans' },
      { key: 'hr.biometric',  label: 'Biometric Integration' },
    ],
  },
];

// Default: sales module with all sub-modules
const defaultSelected = MODULE_META.find(m => m.key === 'sales')!.subModules.map(s => s.key);

interface Props { onClose: () => void; }

export default function AddClientModal({ onClose }: Props) {
  const { toast } = useToast();
  const { prices } = usePrices();

  const MODULES: ModuleDef[] = MODULE_META.map(m => ({
    ...m,
    price: prices[m.key as keyof typeof prices] || 0,
  }));

  const [form, setForm] = useState({
    tenant_code: '', tenant_name: '', company_name: '',
    admin_name: '', admin_email: '', admin_password: '',
  });
  const [selectedSubs, setSelectedSubs]     = useState<string[]>(defaultSelected);
  const [expandedMods, setExpandedMods]     = useState<string[]>(['sales']);
  const [showPw, setShowPw]                 = useState(false);
  const [loading, setLoading]               = useState(false);
  const [error, setError]                   = useState('');

  // --- helpers ---
  const subKeysOf = (parentKey: string) =>
    MODULES.find(m => m.key === parentKey)?.subModules.map(s => s.key) ?? [];

  const parentStatus = (parentKey: string): 'all' | 'some' | 'none' => {
    const subs = subKeysOf(parentKey);
    const count = subs.filter(k => selectedSubs.includes(k)).length;
    if (count === 0) return 'none';
    if (count === subs.length) return 'all';
    return 'some';
  };

  const activeParents = () =>
    MODULES.filter(m => parentStatus(m.key) !== 'none');

  const totalPrice = activeParents().reduce((sum, m) => sum + m.price, 0);

  const toggleParent = (parentKey: string) => {
    const subs = subKeysOf(parentKey);
    const status = parentStatus(parentKey);
    if (status === 'none') {
      setSelectedSubs(prev => [...prev, ...subs]);
      setExpandedMods(prev => prev.includes(parentKey) ? prev : [...prev, parentKey]);
    } else {
      setSelectedSubs(prev => prev.filter(k => !subs.includes(k)));
    }
  };

  const toggleSub = (subKey: string) => {
    setSelectedSubs(prev =>
      prev.includes(subKey) ? prev.filter(k => k !== subKey) : [...prev, subKey]
    );
  };

  const toggleExpand = (parentKey: string) => {
    setExpandedMods(prev =>
      prev.includes(parentKey) ? prev.filter(k => k !== parentKey) : [...prev, parentKey]
    );
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (selectedSubs.length === 0) { setError('Select at least one module feature'); return; }
    setError('');
    setLoading(true);
    try {
      await api.post('/tenants', { ...form, modules: selectedSubs });
      toast('success', `Client "${form.company_name || form.tenant_name}" created successfully`);
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create client');
    } finally {
      setLoading(false);
    }
  };

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));
  const inputCls = 'w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition';

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center">
              <UserPlus size={17} className="text-emerald-600" />
            </div>
            <h3 className="text-base font-bold text-slate-800">Add New Client</h3>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 transition">
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1">
          <div className="p-5 space-y-4">
            {error && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 text-sm">
                <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
                {error}
              </div>
            )}

            {/* Business Info */}
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Business Info</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Company Code *</label>
                  <input
                    className={inputCls}
                    placeholder="ahmed_shop"
                    value={form.tenant_code}
                    onChange={e => set('tenant_code', e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    required
                  />
                  <p className="text-xs text-slate-400 mt-1">Lowercase, no spaces</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Business Name *</label>
                  <input
                    className={inputCls}
                    placeholder="Ahmed General Store"
                    value={form.tenant_name}
                    onChange={e => set('tenant_name', e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="mt-3">
                <label className="block text-sm font-medium text-slate-700 mb-1">Company Name (Display)</label>
                <input
                  className={inputCls}
                  placeholder="Ahmed General Store Pvt Ltd"
                  value={form.company_name}
                  onChange={e => set('company_name', e.target.value)}
                />
              </div>
            </div>

            {/* Admin Info */}
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Admin Account</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Admin Name</label>
                  <input
                    className={inputCls}
                    placeholder="Ahmed Khan"
                    value={form.admin_name}
                    onChange={e => set('admin_name', e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Admin Email *</label>
                  <input
                    type="email"
                    className={inputCls}
                    placeholder="admin@ahmed.com"
                    value={form.admin_email}
                    onChange={e => set('admin_email', e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="mt-3">
                <label className="block text-sm font-medium text-slate-700 mb-1">Admin Password *</label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    className={`${inputCls} pr-10`}
                    placeholder="Min 6 characters"
                    value={form.admin_password}
                    onChange={e => set('admin_password', e.target.value)}
                    required
                    minLength={6}
                  />
                  <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            </div>

            {/* Modules */}
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Select Modules & Features *</p>
              <div className="space-y-2">
                {MODULES.map(mod => {
                  const status   = parentStatus(mod.key);
                  const expanded = expandedMods.includes(mod.key);
                  const isActive = status !== 'none';

                  return (
                    <div key={mod.key} className={`border-2 rounded-2xl overflow-hidden transition-all ${
                      isActive ? 'border-emerald-400' : 'border-slate-200'
                    }`}>
                      {/* Parent row */}
                      <div className={`flex items-center gap-3 px-4 py-3 ${isActive ? 'bg-emerald-50' : 'bg-white hover:bg-slate-50'}`}>
                        {/* Checkbox (indeterminate via visual) */}
                        <button
                          type="button"
                          onClick={() => toggleParent(mod.key)}
                          className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                            status === 'all'
                              ? 'border-emerald-500 bg-emerald-500'
                              : status === 'some'
                              ? 'border-emerald-500 bg-white'
                              : 'border-slate-300 bg-white'
                          }`}
                        >
                          {status === 'all' && (
                            <svg viewBox="0 0 12 10" className="w-3 h-3" fill="none">
                              <path d="M1 5l3.5 3.5L11 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                          {status === 'some' && (
                            <span className="w-2 h-0.5 bg-emerald-500 rounded" />
                          )}
                        </button>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-base">{mod.icon}</span>
                            <span className={`text-sm font-semibold ${isActive ? 'text-emerald-800' : 'text-slate-700'}`}>
                              {mod.label}
                            </span>
                            {status === 'some' && (
                              <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">
                                {selectedSubs.filter(k => k.startsWith(mod.key + '.')).length}/{mod.subModules.length}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-400 mt-0.5">Rs. {mod.price.toLocaleString()}/mo</div>
                        </div>

                        <button
                          type="button"
                          onClick={() => toggleExpand(mod.key)}
                          className="p-1 text-slate-400 hover:text-slate-600 transition"
                        >
                          {expanded
                            ? <ChevronDown size={16} />
                            : <ChevronRight size={16} />
                          }
                        </button>
                      </div>

                      {/* Sub-modules */}
                      {expanded && (
                        <div className="border-t border-slate-100 bg-slate-50 px-4 py-2 space-y-1">
                          {mod.subModules.map(sub => {
                            const subActive = selectedSubs.includes(sub.key);
                            return (
                              <label key={sub.key} className="flex items-center gap-3 py-1.5 cursor-pointer group">
                                <input
                                  type="checkbox"
                                  className="accent-emerald-600 w-3.5 h-3.5 flex-shrink-0"
                                  checked={subActive}
                                  onChange={() => toggleSub(sub.key)}
                                />
                                <span className={`text-sm transition-colors ${subActive ? 'text-slate-700' : 'text-slate-400'}`}>
                                  {sub.label}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Total */}
            <div className="bg-slate-800 rounded-2xl p-4 flex items-center justify-between">
              <span className="text-sm text-slate-400">Monthly Total</span>
              <div className="text-right">
                <span className="text-xl font-bold text-emerald-400">
                  Rs. {totalPrice.toLocaleString()}
                </span>
                <span className="text-slate-500 text-xs ml-1">/mo</span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-5 pb-5 flex gap-3 flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-slate-200 text-slate-600 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-emerald-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 transition shadow-sm shadow-emerald-200"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating...
                </span>
              ) : 'Create Client'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
