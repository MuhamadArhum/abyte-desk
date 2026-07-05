import { useState } from 'react';
import { X, Check, Loader2, ChevronDown, ChevronRight } from 'lucide-react';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';
import { usePrices } from '../hooks/usePrices';

interface SubModule { key: string; label: string; }
interface ModuleDef  { key: string; label: string; color: string; check: string; text: string; price: number; subModules: SubModule[]; }

const MODULE_META = [
  {
    key: 'sales', label: 'Sales',
    color: 'border-blue-200 bg-blue-50', check: 'bg-blue-600', text: 'text-blue-700',
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
    key: 'inventory', label: 'Inventory',
    color: 'border-emerald-200 bg-emerald-50', check: 'bg-emerald-600', text: 'text-emerald-700',
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
    key: 'accounts', label: 'Accounts',
    color: 'border-purple-200 bg-purple-50', check: 'bg-purple-600', text: 'text-purple-700',
    subModules: [
      { key: 'accounts.chart',    label: 'Chart of Accounts' },
      { key: 'accounts.journal',  label: 'Journal Entries' },
      { key: 'accounts.vouchers', label: 'Payment Vouchers' },
      { key: 'accounts.bank',     label: 'Bank Accounts' },
      { key: 'accounts.reports',  label: 'Financial Reports' },
    ],
  },
  {
    key: 'hr', label: 'HR & Payroll',
    color: 'border-orange-200 bg-orange-50', check: 'bg-orange-600', text: 'text-orange-700',
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

// Convert old format ["sales", "inventory"] to sub-module keys
function normalizeModules(modules: string[]): string[] {
  const result: string[] = [];
  modules.forEach(m => {
    if (!m.includes('.')) {
      const mod = MODULE_META.find(x => x.key === m);
      if (mod) result.push(...mod.subModules.map(s => s.key));
    } else {
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

  const ALL_MODULES: ModuleDef[] = MODULE_META.map(m => ({
    ...m,
    price: prices[m.key as keyof typeof prices] || 0,
  }));

  const [selectedSubs, setSelectedSubs] = useState<string[]>(() => normalizeModules(currentModules));
  const [expandedMods, setExpandedMods] = useState<string[]>(() => {
    const normalized = normalizeModules(currentModules);
    return MODULE_META.filter(m => normalized.some(k => k.startsWith(m.key + '.'))).map(m => m.key);
  });
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState(false);

  // --- helpers ---
  const subKeysOf = (parentKey: string) =>
    ALL_MODULES.find(m => m.key === parentKey)?.subModules.map(s => s.key) ?? [];

  const parentStatus = (parentKey: string): 'all' | 'some' | 'none' => {
    const subs = subKeysOf(parentKey);
    const count = subs.filter(k => selectedSubs.includes(k)).length;
    if (count === 0) return 'none';
    if (count === subs.length) return 'all';
    return 'some';
  };

  const activeParents = () => ALL_MODULES.filter(m => parentStatus(m.key) !== 'none');
  const monthly = activeParents().reduce((s, m) => s + m.price, 0);

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

  const handleSave = async () => {
    if (selectedSubs.length === 0) { setError('At least one module feature is required.'); return; }
    setSaving(true); setError('');
    try {
      await api.put(`/tenants/${tenantId}`, { modules: selectedSubs });
      toast('success', `Modules updated for ${clientName}`);
      setSuccess(true);
      setTimeout(onClose, 800);
    } catch (e: any) {
      setError(e.response?.data?.message || 'Failed to update modules.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <div>
            <h3 className="font-bold text-slate-800">Manage Modules</h3>
            <p className="text-xs text-slate-500 mt-0.5">{clientName}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 transition">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-2 overflow-y-auto flex-1">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-3">{error}</div>
          )}

          {ALL_MODULES.map(mod => {
            const status   = parentStatus(mod.key);
            const expanded = expandedMods.includes(mod.key);
            const isActive = status !== 'none';

            return (
              <div key={mod.key} className={`border-2 rounded-2xl overflow-hidden transition-all ${
                isActive ? mod.color : 'border-slate-100'
              }`}>
                {/* Parent row */}
                <div className={`flex items-center gap-3 px-4 py-3.5 cursor-pointer ${
                  isActive ? '' : 'hover:bg-slate-50'
                }`}>
                  {/* Checkbox */}
                  <button
                    type="button"
                    onClick={() => toggleParent(mod.key)}
                    className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                      status === 'all'
                        ? mod.check + ' border-transparent'
                        : status === 'some'
                        ? 'border-current bg-white'
                        : 'border-slate-300 bg-white'
                    } ${isActive ? mod.text : ''}`}
                  >
                    {status === 'all' && <Check size={11} strokeWidth={3} className="text-white" />}
                    {status === 'some' && <span className="w-2 h-0.5 rounded bg-current" />}
                  </button>

                  <div className="flex-1 min-w-0" onClick={() => toggleParent(mod.key)}>
                    <div className="flex items-center gap-2">
                      <p className={`font-semibold text-sm ${isActive ? mod.text : 'text-slate-700'}`}>{mod.label}</p>
                      {status === 'some' && (
                        <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">
                          {selectedSubs.filter(k => k.startsWith(mod.key + '.')).length}/{mod.subModules.length}
                        </span>
                      )}
                    </div>
                    <p className={`text-xs mt-0.5 ${isActive ? mod.text + ' opacity-70' : 'text-slate-400'}`}>
                      Rs. {mod.price.toLocaleString()}/mo
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => toggleExpand(mod.key)}
                    className={`p-1 transition ${isActive ? mod.text + ' opacity-70' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </button>
                </div>

                {/* Sub-modules */}
                {expanded && (
                  <div className="border-t border-slate-100 bg-white/60 px-5 py-2 space-y-1">
                    {mod.subModules.map(sub => {
                      const subActive = selectedSubs.includes(sub.key);
                      return (
                        <label key={sub.key} className="flex items-center gap-3 py-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            className={`w-3.5 h-3.5 flex-shrink-0 rounded accent-current ${mod.text}`}
                            checked={subActive}
                            onChange={() => toggleSub(sub.key)}
                          />
                          <span className={`text-sm ${subActive ? 'text-slate-700' : 'text-slate-400'}`}>
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

          {/* Total */}
          <div className="flex justify-between items-center pt-3 border-t border-slate-100 mt-2">
            <span className="text-sm text-slate-500">Monthly Total</span>
            <span className="text-lg font-bold text-slate-800">Rs. {monthly.toLocaleString()}</span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 pb-6 flex-shrink-0">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 text-sm border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || success}
            className="flex-1 px-4 py-3 text-sm bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl transition disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {success ? (
              <><Check size={16} /> Saved!</>
            ) : saving ? (
              <><Loader2 size={16} className="animate-spin" /> Saving...</>
            ) : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
