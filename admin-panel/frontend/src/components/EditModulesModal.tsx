import { useState } from 'react';
import { X, Check, Loader2 } from 'lucide-react';
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
      { key: 'sales.customers',    label: 'Customers' },
      { key: 'restaurant.tables',  label: 'Table Management' },
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

const ALL_SUB_KEYS = MODULE_META.flatMap(m => m.subModules.map(s => s.key));

function normalizeModules(modules: string[]): string[] {
  const result: string[] = [];
  modules.forEach(m => {
    if (!m.includes('.')) {
      const mod = MODULE_META.find(x => x.key === m);
      if (mod) result.push(...mod.subModules.map(s => s.key));
    } else if (ALL_SUB_KEYS.includes(m)) {
      result.push(m);
    }
  });
  return [...new Set(result)];
}

interface Props {
  tenantId:       number;
  clientName:     string;
  currentModules: string[];
  onClose:        () => void;
}

export default function EditModulesModal({ tenantId, clientName, currentModules, onClose }: Props) {
  const { toast } = useToast();
  const { prices } = usePrices();

  const MODULES: ModuleDef[] = MODULE_META.map(m => ({
    ...m,
    price: prices[m.key as keyof typeof prices] || 0,
  }));

  const [selectedSubs, setSelectedSubs] = useState<string[]>(() => normalizeModules(currentModules));
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState(false);

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

  const handleSave = async () => {
    if (selectedSubs.length === 0) { setError('At least one module feature is required.'); return; }
    setSaving(true); setError('');
    try {
      await api.put(`/tenants/${tenantId}`, { modules: selectedSubs });
      toast('success', `Modules updated for ${clientName}`);
      setSuccess(true);
      setTimeout(onClose, 800);
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
        : undefined;
      setError(msg || 'Failed to update modules.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl border border-slate-200 max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <div>
            <h3 className="text-base font-bold text-slate-800">Manage Modules</h3>
            <p className="text-xs text-slate-500 mt-0.5">{clientName}</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 transition">
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          <div className="p-6 space-y-5">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{error}</div>
            )}

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
            <button onClick={onClose}
              className="flex-1 border border-slate-200 text-slate-600 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-50 transition">
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving || success}
              className="flex-1 bg-emerald-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 transition flex items-center justify-center gap-2">
              {success ? <><Check size={16} /> Saved!</>
                : saving ? <><Loader2 size={16} className="animate-spin" /> Saving...</>
                : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
