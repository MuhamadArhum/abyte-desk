import { useState, type FormEvent } from 'react';
import { X, AlertCircle, Eye, EyeOff, UserPlus, Check } from 'lucide-react';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';
import { usePrices } from '../hooks/usePrices';

interface SubModule { key: string; label: string; }
interface ModuleDef  { key: string; label: string; icon: string; color: string; check: string; text: string; border: string; price: number; subModules: SubModule[]; }

const MODULE_META = [
  {
    key: 'sales', label: 'Sales', icon: '🛒',
    color: 'bg-blue-50', check: 'bg-blue-600', text: 'text-blue-700', border: 'border-blue-200',
    subModules: [
      { key: 'sales.pos',        label: 'Point of Sale & Orders' },
      { key: 'sales.orders',     label: 'Done Orders' },
      { key: 'sales.register',   label: 'Cash Register' },
      { key: 'sales.deliveries', label: 'Deliveries' },
      { key: 'sales.returns',    label: 'Sales Returns' },
      { key: 'sales.quotations', label: 'Quotations' },
      { key: 'sales.credit',     label: 'Credit Sales' },
      { key: 'sales.pricerules', label: 'Price Rules' },
      { key: 'sales.targets',    label: 'Sales Targets' },
      { key: 'sales.reports',    label: 'Reports & Analytics' },
      { key: 'sales.customers',  label: 'Customers' },
    ],
  },
  {
    key: 'inventory', label: 'Inventory', icon: '📦',
    color: 'bg-emerald-50', check: 'bg-emerald-600', text: 'text-emerald-700', border: 'border-emerald-200',
    subModules: [
      { key: 'inventory.products',    label: 'Products & Opening Stock' },
      { key: 'inventory.categories',  label: 'Categories' },
      { key: 'inventory.bundles',     label: 'Deals & Bundles' },
      { key: 'inventory.purchases',   label: 'Purchase Orders & Vouchers' },
      { key: 'inventory.suppliers',   label: 'Suppliers' },
      { key: 'inventory.adjustments', label: 'Stock Adjustments & Issuance' },
      { key: 'inventory.reports',     label: 'Inventory Reports' },
    ],
  },
  {
    key: 'accounts', label: 'Accounts', icon: '📊',
    color: 'bg-purple-50', check: 'bg-purple-600', text: 'text-purple-700', border: 'border-purple-200',
    subModules: [
      { key: 'accounts.chart',            label: 'Chart of Accounts' },
      { key: 'accounts.journal',          label: 'Journal Voucher' },
      { key: 'accounts.payment-vouchers', label: 'Payment & Receipt Vouchers' },
      { key: 'accounts.ledger',           label: 'Ledger, Trial Balance & Reports' },
      { key: 'accounts.bank',             label: 'Bank Accounts' },
      { key: 'accounts.analytics',        label: 'Analytics & Reports' },
    ],
  },
  {
    key: 'hr', label: 'HR & Payroll', icon: '👥',
    color: 'bg-orange-50', check: 'bg-orange-600', text: 'text-orange-700', border: 'border-orange-200',
    subModules: [
      { key: 'hr.staff',             label: 'Staff Management' },
      { key: 'hr.attendance',        label: 'Attendance & Biometric' },
      { key: 'hr.payroll',           label: 'Payroll & Salary' },
      { key: 'hr.salary-components', label: 'Salary Components' },
      { key: 'hr.leaves',            label: 'Leave Management' },
      { key: 'hr.loans',             label: 'Loans' },
      { key: 'hr.reports',           label: 'Reports & Employee Ledger' },
    ],
  },
];

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
  const [selectedSubs, setSelectedSubs] = useState<string[]>(defaultSelected);
  const [showPw, setShowPw]             = useState(false);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState('');

  const subKeysOf = (parentKey: string) =>
    MODULES.find(m => m.key === parentKey)?.subModules.map(s => s.key) ?? [];

  const parentStatus = (parentKey: string): 'all' | 'some' | 'none' => {
    const subs = subKeysOf(parentKey);
    const count = subs.filter(k => selectedSubs.includes(k)).length;
    if (count === 0) return 'none';
    if (count === subs.length) return 'all';
    return 'some';
  };

  const toggleParent = (parentKey: string) => {
    const subs = subKeysOf(parentKey);
    const status = parentStatus(parentKey);
    if (status === 'all') {
      setSelectedSubs(prev => prev.filter(k => !subs.includes(k)));
    } else {
      setSelectedSubs(prev => [...new Set([...prev, ...subs])]);
    }
  };

  const toggleSub = (subKey: string) => {
    setSelectedSubs(prev =>
      prev.includes(subKey) ? prev.filter(k => k !== subKey) : [...prev, subKey]
    );
  };

  const activeParents = () => MODULES.filter(m => parentStatus(m.key) !== 'none');
  const totalPrice = activeParents().reduce((sum, m) => sum + m.price, 0);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (selectedSubs.length === 0) { setError('Select at least one feature'); return; }
    setError('');
    setLoading(true);
    try {
      await api.post('/tenants', { ...form, modules: selectedSubs });
      toast('success', `Client "${form.company_name || form.tenant_name}" created successfully`);
      onClose();
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
        : undefined;
      setError(msg || 'Failed to create client');
    } finally {
      setLoading(false);
    }
  };

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));
  const inputCls = 'w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition';

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl border border-slate-200 max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
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

        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1">
          <div className="p-6 space-y-5">
            {error && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 text-sm">
                <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
                {error}
              </div>
            )}

            {/* Business Info */}
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Business Info</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Company Code *</label>
                  <input className={inputCls} placeholder="ahmed_shop" value={form.tenant_code}
                    onChange={e => set('tenant_code', e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} required />
                  <p className="text-xs text-slate-400 mt-1">Lowercase, no spaces</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Business Name *</label>
                  <input className={inputCls} placeholder="Ahmed General Store" value={form.tenant_name}
                    onChange={e => set('tenant_name', e.target.value)} required />
                </div>
              </div>
              <div className="mt-3">
                <label className="block text-sm font-medium text-slate-700 mb-1">Company Name (Display)</label>
                <input className={inputCls} placeholder="Ahmed General Store Pvt Ltd" value={form.company_name}
                  onChange={e => set('company_name', e.target.value)} />
              </div>
            </div>

            {/* Admin Info */}
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Admin Account</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Admin Name</label>
                  <input className={inputCls} placeholder="Ahmed Khan" value={form.admin_name}
                    onChange={e => set('admin_name', e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Admin Email *</label>
                  <input type="email" className={inputCls} placeholder="admin@ahmed.com" value={form.admin_email}
                    onChange={e => set('admin_email', e.target.value)} required />
                </div>
              </div>
              <div className="mt-3">
                <label className="block text-sm font-medium text-slate-700 mb-1">Admin Password *</label>
                <div className="relative">
                  <input type={showPw ? 'text' : 'password'} className={`${inputCls} pr-10`}
                    placeholder="Min 8 characters" value={form.admin_password}
                    onChange={e => set('admin_password', e.target.value)} required minLength={8} />
                  <button type="button" onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            </div>

            {/* Modules */}
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Select Modules & Features *</p>
              <div className="space-y-4">
                {MODULES.map(mod => {
                  const status   = parentStatus(mod.key);
                  const isActive = status !== 'none';
                  const selCount = selectedSubs.filter(k => k.startsWith(mod.key + '.')).length;

                  return (
                    <div key={mod.key} className={`rounded-2xl border-2 overflow-hidden ${isActive ? mod.border : 'border-slate-100'}`}>

                      {/* Module header */}
                      <div
                        className={`flex items-center gap-3 px-4 py-3 cursor-pointer select-none ${isActive ? mod.color : 'bg-slate-50 hover:bg-slate-100'}`}
                        onClick={() => toggleParent(mod.key)}
                      >
                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                          status === 'all'  ? `${mod.check} border-transparent`
                          : status === 'some' ? `border-current bg-white ${mod.text}`
                          : 'border-slate-300 bg-white'
                        }`}>
                          {status === 'all'  && <Check size={11} strokeWidth={3} className="text-white" />}
                          {status === 'some' && <span className="w-2 h-0.5 rounded bg-current" />}
                        </div>
                        <span className="text-lg">{mod.icon}</span>
                        <div className="flex-1">
                          <span className={`text-sm font-bold ${isActive ? mod.text : 'text-slate-600'}`}>{mod.label}</span>
                          <span className={`text-xs ml-2 ${isActive ? mod.text + ' opacity-70' : 'text-slate-400'}`}>
                            Rs. {mod.price.toLocaleString()}/mo
                          </span>
                        </div>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          isActive ? `${mod.color} ${mod.text} border ${mod.border}` : 'bg-slate-100 text-slate-400'
                        }`}>
                          {selCount}/{mod.subModules.length} selected
                        </span>
                      </div>

                      {/* Sub-modules grid */}
                      <div className="px-4 py-3 grid grid-cols-2 gap-2 bg-white">
                        {mod.subModules.map(sub => {
                          const active = selectedSubs.includes(sub.key);
                          return (
                            <label
                              key={sub.key}
                              onClick={e => { e.stopPropagation(); toggleSub(sub.key); }}
                              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border cursor-pointer transition-all select-none ${
                                active
                                  ? `${mod.border} ${mod.color}`
                                  : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50'
                              }`}
                            >
                              <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                                active ? `${mod.check} border-transparent` : 'border-slate-300 bg-white'
                              }`}>
                                {active && <Check size={9} strokeWidth={3} className="text-white" />}
                              </div>
                              <span className={`text-xs font-medium leading-tight ${active ? mod.text : 'text-slate-500'}`}>
                                {sub.label}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Total */}
            <div className="bg-slate-800 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <span className="text-sm text-slate-400">Monthly Total</span>
                <p className="text-xs text-slate-500 mt-0.5">
                  {activeParents().map(m => m.label).join(' + ') || 'No modules selected'}
                </p>
              </div>
              <div className="text-right">
                <span className="text-2xl font-bold text-emerald-400">Rs. {totalPrice.toLocaleString()}</span>
                <span className="text-slate-500 text-xs ml-1">/mo</span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 pb-6 flex gap-3 flex-shrink-0">
            <button type="button" onClick={onClose}
              className="flex-1 border border-slate-200 text-slate-600 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-50 transition">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 bg-emerald-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 transition">
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
