import { useState } from 'react';
import { X, Check, ChevronRight, ChevronLeft, Building2, Package, GitBranch, User, FileText, Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';
import { usePrices } from '../hooks/usePrices';
import { useNavigate } from 'react-router-dom';

// ─── Module Meta ────────────────────────────────────────────────────────────
const MODULE_META = [
  {
    key: 'sales', label: 'Sales', icon: '🛒',
    color: 'bg-blue-50', check: 'bg-blue-600', text: 'text-blue-700', border: 'border-blue-200',
    subModules: [
      { key: 'sales.pos', label: 'Point of Sale & Orders' },
      { key: 'sales.orders', label: 'Done Orders' },
      { key: 'sales.register', label: 'Cash Register' },
      { key: 'sales.deliveries', label: 'Deliveries' },
      { key: 'sales.returns', label: 'Sales Returns' },
      { key: 'sales.quotations', label: 'Quotations' },
      { key: 'sales.credit', label: 'Credit Sales' },
      { key: 'sales.pricerules', label: 'Price Rules' },
      { key: 'sales.targets', label: 'Sales Targets' },
      { key: 'sales.reports', label: 'Reports & Analytics' },
      { key: 'sales.customers', label: 'Customers' },
      { key: 'restaurant.tables', label: 'Table Management' },
    ],
  },
  {
    key: 'inventory', label: 'Inventory', icon: '📦',
    color: 'bg-emerald-50', check: 'bg-emerald-600', text: 'text-emerald-700', border: 'border-emerald-200',
    subModules: [
      { key: 'inventory.products', label: 'Products & Opening Stock' },
      { key: 'inventory.categories', label: 'Categories' },
      { key: 'inventory.bundles', label: 'Deals & Bundles' },
      { key: 'inventory.purchases', label: 'Purchase Orders & Vouchers' },
      { key: 'inventory.suppliers', label: 'Suppliers' },
      { key: 'inventory.adjustments', label: 'Stock Adjustments & Issuance' },
      { key: 'inventory.reports', label: 'Inventory Reports' },
    ],
  },
  {
    key: 'accounts', label: 'Accounts', icon: '📊',
    color: 'bg-purple-50', check: 'bg-purple-600', text: 'text-purple-700', border: 'border-purple-200',
    subModules: [
      { key: 'accounts.chart', label: 'Chart of Accounts' },
      { key: 'accounts.journal', label: 'Journal Voucher' },
      { key: 'accounts.payment-vouchers', label: 'Payment & Receipt Vouchers' },
      { key: 'accounts.ledger', label: 'Ledger, Trial Balance & Reports' },
      { key: 'accounts.bank', label: 'Bank Accounts' },
      { key: 'accounts.analytics', label: 'Analytics & Reports' },
    ],
  },
  {
    key: 'hr', label: 'HR & Payroll', icon: '👥',
    color: 'bg-orange-50', check: 'bg-orange-600', text: 'text-orange-700', border: 'border-orange-200',
    subModules: [
      { key: 'hr.staff', label: 'Staff Management' },
      { key: 'hr.attendance', label: 'Attendance & Biometric' },
      { key: 'hr.payroll', label: 'Payroll & Salary' },
      { key: 'hr.salary-components', label: 'Salary Components' },
      { key: 'hr.leaves', label: 'Leave Management' },
      { key: 'hr.loans', label: 'Loans' },
      { key: 'hr.reports', label: 'Reports & Employee Ledger' },
    ],
  },
];

const defaultSelected = MODULE_META.find(m => m.key === 'sales')!.subModules.map(s => s.key);

// ─── Step indicator ─────────────────────────────────────────────────────────
const STEPS = [
  { label: 'Company', icon: Building2 },
  { label: 'Modules', icon: Package },
  { label: 'Branch', icon: GitBranch },
  { label: 'Admin', icon: User },
  { label: 'Review', icon: FileText },
];

interface Props { onClose: () => void; onCreated?: () => void; }

export default function OnboardingWizard({ onClose, onCreated }: Props) {
  const { toast } = useToast();
  const { prices } = usePrices();
  const navigate = useNavigate();

  const [step, setStep]     = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');
  const [createdTenantId, setCreatedTenantId] = useState<number | null>(null);

  // Step 1 — Company Info
  const [company, setCompany] = useState({
    tenant_code: '', tenant_name: '', company_name: '',
    address: '', phone: '',
  });

  // Step 2 — Modules
  const [selectedSubs, setSelectedSubs] = useState<string[]>(defaultSelected);

  // Step 3 — Branch (optional)
  const [addBranch, setAddBranch] = useState(true);
  const [branch, setBranch] = useState({
    store_name: '', store_code: 'MAIN', address: '', phone: '',
  });

  // Step 4 — Admin User
  const [admin, setAdmin] = useState({
    admin_name: '', admin_email: '', admin_password: '',
  });
  const [showPw, setShowPw] = useState(false);

  // Module helpers
  const MODULES = MODULE_META.map(m => ({ ...m, price: prices[m.key as keyof typeof prices] || 0 }));

  const subKeysOf = (pk: string) => MODULES.find(m => m.key === pk)?.subModules.map(s => s.key) ?? [];
  const parentStatus = (pk: string): 'all' | 'some' | 'none' => {
    const subs = subKeysOf(pk); const count = subs.filter(k => selectedSubs.includes(k)).length;
    if (count === 0) return 'none'; if (count === subs.length) return 'all'; return 'some';
  };
  const toggleParent = (pk: string) => {
    const subs = subKeysOf(pk);
    parentStatus(pk) === 'all'
      ? setSelectedSubs(prev => prev.filter(k => !subs.includes(k)))
      : setSelectedSubs(prev => [...new Set([...prev, ...subs])]);
  };
  const toggleSub = (k: string) =>
    setSelectedSubs(prev => prev.includes(k) ? prev.filter(x => x !== k) : [...prev, k]);

  const activeParents = () => MODULES.filter(m => parentStatus(m.key) !== 'none');
  const totalPrice = activeParents().reduce((s, m) => s + m.price, 0);

  // Validation per step
  const validateStep = (): string => {
    if (step === 0) {
      if (!company.tenant_code.trim()) return 'Company code is required';
      if (!/^[a-z0-9_]+$/.test(company.tenant_code)) return 'Code must be lowercase letters, numbers, underscores only';
      if (!company.tenant_name.trim()) return 'Business name is required';
      // email is on step 3
    }
    if (step === 1 && selectedSubs.length === 0) return 'Select at least one module feature';
    if (step === 2 && addBranch) {
      if (!branch.store_name.trim()) return 'Branch name is required';
      if (!branch.store_code.trim()) return 'Branch code is required';
    }
    if (step === 3) {
      if (!admin.admin_email.trim()) return 'Admin email is required';
      if (!admin.admin_password.trim()) return 'Password is required';
      if (admin.admin_password.length < 8) return 'Password must be at least 8 characters';
    }
    return '';
  };

  const goNext = () => {
    const err = validateStep();
    if (err) { setError(err); return; }
    setError('');
    setStep(s => s + 1);
  };

  const goBack = () => { setError(''); setStep(s => s - 1); };

  const handleCreate = async () => {
    setLoading(true); setError('');
    try {
      // Create tenant
      const res = await api.post('/tenants', {
        tenant_code:    company.tenant_code,
        tenant_name:    company.tenant_name,
        company_name:   company.company_name || company.tenant_name,
        admin_name:     admin.admin_name || company.tenant_name,
        admin_email:    admin.admin_email,
        admin_password: admin.admin_password,
        modules:        selectedSubs,
      });
      const newId = res.data?.tenant_id || res.data?.id;
      setCreatedTenantId(newId || null);

      // Create first branch if provided
      if (addBranch && branch.store_name && newId) {
        await api.post(`/tenants/${newId}/branches`, {
          store_name: branch.store_name,
          store_code: branch.store_code || 'MAIN',
          address:    branch.address,
          phone:      branch.phone,
          monthly_charge: 0,
          is_active: 1,
        });
      }

      toast('success', `Client "${company.company_name || company.tenant_name}" created successfully!`);
      setStep(5); // success screen
      onCreated?.();
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
        : undefined;
      setError(msg || 'Failed to create client. Please check all fields.');
    } finally {
      setLoading(false);
    }
  };

  const inputCls = 'w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition';

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl border border-slate-200 max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <div>
            <h3 className="text-base font-bold text-slate-800">New Client Onboarding</h3>
            <p className="text-xs text-slate-400 mt-0.5">Step {Math.min(step + 1, 5)} of 5 — {STEPS[Math.min(step, 4)]?.label}</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 transition">
            <X size={18} />
          </button>
        </div>

        {/* Step indicators */}
        {step < 5 && (
          <div className="px-6 pt-4 pb-2 flex-shrink-0">
            <div className="flex items-center gap-1">
              {STEPS.map((s, i) => {
                const done = i < step;
                const active = i === step;
                const Icon = s.icon;
                return (
                  <div key={i} className="flex items-center flex-1">
                    <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all ${
                      done ? 'bg-emerald-50 text-emerald-700' :
                      active ? 'bg-slate-800 text-white' :
                      'text-slate-400'
                    }`}>
                      {done ? <Check size={13} strokeWidth={3} /> : <Icon size={13} />}
                      <span className="text-xs font-semibold hidden sm:inline">{s.label}</span>
                    </div>
                    {i < 4 && <div className={`flex-1 h-0.5 mx-1 rounded ${i < step ? 'bg-emerald-400' : 'bg-slate-100'}`} />}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Content */}
        <div className="overflow-y-auto flex-1 px-6 py-4">
          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 text-sm mb-4">
              <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          {/* ── Step 0: Company Info ── */}
          {step === 0 && (
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Business Details</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Company Code *</label>
                    <input className={inputCls} placeholder="ahmed_shop"
                      value={company.tenant_code}
                      onChange={e => setCompany(c => ({ ...c, tenant_code: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') }))} />
                    <p className="text-xs text-slate-400 mt-1">Lowercase, no spaces (used as login ID)</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Business Name *</label>
                    <input className={inputCls} placeholder="Ahmed General Store"
                      value={company.tenant_name}
                      onChange={e => setCompany(c => ({ ...c, tenant_name: e.target.value }))} />
                  </div>
                </div>
                <div className="mt-3">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Company Display Name</label>
                  <input className={inputCls} placeholder="Ahmed General Store Pvt Ltd"
                    value={company.company_name}
                    onChange={e => setCompany(c => ({ ...c, company_name: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                    <input className={inputCls} placeholder="+92 300 1234567"
                      value={company.phone}
                      onChange={e => setCompany(c => ({ ...c, phone: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
                    <input className={inputCls} placeholder="123 Main Street, City"
                      value={company.address}
                      onChange={e => setCompany(c => ({ ...c, address: e.target.value }))} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Step 1: Modules ── */}
          {step === 1 && (
            <div className="space-y-4">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Select Modules & Features *</p>
              {MODULES.map(mod => {
                const status = parentStatus(mod.key);
                const isActive = status !== 'none';
                const selCount = selectedSubs.filter(k => k.startsWith(mod.key + '.')).length;
                return (
                  <div key={mod.key} className={`rounded-2xl border-2 overflow-hidden ${isActive ? mod.border : 'border-slate-100'}`}>
                    <div className={`flex items-center gap-3 px-4 py-3 cursor-pointer select-none ${isActive ? mod.color : 'bg-slate-50 hover:bg-slate-100'}`}
                      onClick={() => toggleParent(mod.key)}>
                      <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                        status === 'all' ? `${mod.check} border-transparent` :
                        status === 'some' ? `border-current bg-white ${mod.text}` : 'border-slate-300 bg-white'
                      }`}>
                        {status === 'all' && <Check size={11} strokeWidth={3} className="text-white" />}
                        {status === 'some' && <span className="w-2 h-0.5 rounded bg-current" />}
                      </div>
                      <span className="text-lg">{mod.icon}</span>
                      <div className="flex-1">
                        <span className={`text-sm font-bold ${isActive ? mod.text : 'text-slate-600'}`}>{mod.label}</span>
                        <span className={`text-xs ml-2 ${isActive ? mod.text + ' opacity-70' : 'text-slate-400'}`}>
                          Rs. {mod.price.toLocaleString()}/mo
                        </span>
                      </div>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${isActive ? `${mod.color} ${mod.text} border ${mod.border}` : 'bg-slate-100 text-slate-400'}`}>
                        {selCount}/{mod.subModules.length}
                      </span>
                    </div>
                    <div className="px-4 py-3 grid grid-cols-2 gap-2 bg-white">
                      {mod.subModules.map(sub => {
                        const active = selectedSubs.includes(sub.key);
                        return (
                          <label key={sub.key}
                            onClick={e => { e.stopPropagation(); toggleSub(sub.key); }}
                            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border cursor-pointer transition-all select-none ${active ? `${mod.border} ${mod.color}` : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50'}`}>
                            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${active ? `${mod.check} border-transparent` : 'border-slate-300 bg-white'}`}>
                              {active && <Check size={9} strokeWidth={3} className="text-white" />}
                            </div>
                            <span className={`text-xs font-medium leading-tight ${active ? mod.text : 'text-slate-500'}`}>{sub.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              <div className="bg-slate-800 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <span className="text-sm text-slate-400">Monthly Total</span>
                  <p className="text-xs text-slate-500 mt-0.5">{activeParents().map(m => m.label).join(' + ') || 'None selected'}</p>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-bold text-emerald-400">Rs. {totalPrice.toLocaleString()}</span>
                  <span className="text-slate-500 text-xs ml-1">/mo</span>
                </div>
              </div>
            </div>
          )}

          {/* ── Step 2: Branch ── */}
          {step === 2 && (
            <div className="space-y-4">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">First Branch / Store</p>
              <label className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl cursor-pointer">
                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${addBranch ? 'bg-emerald-600 border-transparent' : 'border-slate-300 bg-white'}`}
                  onClick={() => setAddBranch(v => !v)}>
                  {addBranch && <Check size={11} strokeWidth={3} className="text-white" />}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">Add first branch now</p>
                  <p className="text-xs text-slate-500">You can also add branches later from the client page</p>
                </div>
              </label>

              {addBranch && (
                <div className="space-y-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Branch Name *</label>
                      <input className={inputCls} placeholder="Main Branch"
                        value={branch.store_name}
                        onChange={e => setBranch(b => ({ ...b, store_name: e.target.value }))} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Branch Code *</label>
                      <input className={inputCls} placeholder="MAIN"
                        value={branch.store_code}
                        onChange={e => setBranch(b => ({ ...b, store_code: e.target.value.toUpperCase().replace(/\s/g, '') }))} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                      <input className={inputCls} placeholder="+92 300 1234567"
                        value={branch.phone}
                        onChange={e => setBranch(b => ({ ...b, phone: e.target.value }))} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
                      <input className={inputCls} placeholder="Branch address"
                        value={branch.address}
                        onChange={e => setBranch(b => ({ ...b, address: e.target.value }))} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Step 3: Admin User ── */}
          {step === 3 && (
            <div className="space-y-4">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Admin Account Credentials</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Admin Name</label>
                  <input className={inputCls} placeholder="Ahmed Khan"
                    value={admin.admin_name}
                    onChange={e => setAdmin(a => ({ ...a, admin_name: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Admin Email *</label>
                  <input type="email" className={inputCls} placeholder="admin@business.com"
                    value={admin.admin_email}
                    onChange={e => setAdmin(a => ({ ...a, admin_email: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Password * (min 8 chars)</label>
                <div className="relative">
                  <input type={showPw ? 'text' : 'password'} className={`${inputCls} pr-10`}
                    placeholder="Min 8 characters"
                    value={admin.admin_password}
                    onChange={e => setAdmin(a => ({ ...a, admin_password: e.target.value }))} />
                  <button type="button" onClick={() => setShowPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <p className="text-xs font-semibold text-blue-700 mb-1">Login Credentials</p>
                <p className="text-xs text-blue-600">Company Code: <span className="font-mono font-bold">{company.tenant_code}</span></p>
                <p className="text-xs text-blue-600 mt-0.5">Email: <span className="font-mono">{admin.admin_email || '(enter above)'}</span></p>
              </div>
            </div>
          )}

          {/* ── Step 4: Review ── */}
          {step === 4 && (
            <div className="space-y-4">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Review & Confirm</p>

              <div className="bg-slate-50 rounded-xl border border-slate-200 divide-y divide-slate-100">
                <div className="px-4 py-3">
                  <p className="text-xs font-semibold text-slate-500 mb-2">Company</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                    <span className="text-slate-400">Code</span><span className="font-mono font-medium text-slate-700">{company.tenant_code}</span>
                    <span className="text-slate-400">Name</span><span className="font-medium text-slate-700">{company.tenant_name}</span>
                    {company.company_name && <><span className="text-slate-400">Display</span><span className="text-slate-700">{company.company_name}</span></>}
                    {company.phone && <><span className="text-slate-400">Phone</span><span className="text-slate-700">{company.phone}</span></>}
                  </div>
                </div>

                <div className="px-4 py-3">
                  <p className="text-xs font-semibold text-slate-500 mb-2">Modules ({activeParents().length})</p>
                  <div className="flex flex-wrap gap-1.5">
                    {activeParents().map(m => (
                      <span key={m.key} className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${m.color} ${m.text} border ${m.border}`}>
                        {m.icon} {m.label} · Rs. {m.price.toLocaleString()}/mo
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-slate-500 mt-2">Monthly: <span className="font-bold text-emerald-600">Rs. {totalPrice.toLocaleString()}</span></p>
                </div>

                <div className="px-4 py-3">
                  <p className="text-xs font-semibold text-slate-500 mb-2">Branch</p>
                  {addBranch && branch.store_name ? (
                    <p className="text-sm text-slate-700">{branch.store_name} <span className="font-mono text-slate-400">({branch.store_code})</span></p>
                  ) : (
                    <p className="text-sm text-slate-400 italic">No branch — to be added later</p>
                  )}
                </div>

                <div className="px-4 py-3">
                  <p className="text-xs font-semibold text-slate-500 mb-2">Admin Account</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                    {admin.admin_name && <><span className="text-slate-400">Name</span><span className="text-slate-700">{admin.admin_name}</span></>}
                    <span className="text-slate-400">Email</span><span className="font-mono text-slate-700">{admin.admin_email}</span>
                    <span className="text-slate-400">Password</span><span className="text-slate-700">{'•'.repeat(Math.min(admin.admin_password.length, 12))}</span>
                  </div>
                </div>
              </div>

              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-emerald-800">Ready to create</p>
                  <p className="text-xs text-emerald-600 mt-0.5">Database will be provisioned automatically</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-black text-emerald-700">Rs. {totalPrice.toLocaleString()}</p>
                  <p className="text-xs text-emerald-600">/month</p>
                </div>
              </div>
            </div>
          )}

          {/* ── Step 5: Success ── */}
          {step === 5 && (
            <div className="py-8 flex flex-col items-center text-center gap-4">
              <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center">
                <Check size={40} className="text-emerald-600" strokeWidth={2.5} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-800">Client Created!</h3>
                <p className="text-slate-500 text-sm mt-1">
                  <span className="font-semibold">{company.company_name || company.tenant_name}</span> has been onboarded successfully.
                </p>
              </div>
              <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 w-full text-left space-y-2">
                <div className="flex justify-between text-sm"><span className="text-slate-400">Company Code</span><span className="font-mono font-bold text-slate-700">{company.tenant_code}</span></div>
                <div className="flex justify-between text-sm"><span className="text-slate-400">Admin Email</span><span className="font-mono text-slate-700">{admin.admin_email}</span></div>
                <div className="flex justify-between text-sm"><span className="text-slate-400">Monthly Price</span><span className="font-bold text-emerald-600">Rs. {totalPrice.toLocaleString()}</span></div>
                <div className="flex justify-between text-sm"><span className="text-slate-400">Modules</span><span className="text-slate-700">{activeParents().map(m => m.label).join(', ')}</span></div>
              </div>
              <div className="flex gap-3 w-full">
                {createdTenantId && (
                  <button onClick={() => { onClose(); navigate(`/clients/${createdTenantId}`); }}
                    className="flex-1 bg-emerald-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-emerald-700 transition">
                    View Client →
                  </button>
                )}
                <button onClick={onClose}
                  className="flex-1 border border-slate-200 text-slate-600 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-50 transition">
                  Close
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer buttons */}
        {step < 5 && (
          <div className="px-6 pb-5 pt-3 border-t border-slate-100 flex gap-3 flex-shrink-0">
            {step > 0 ? (
              <button onClick={goBack} disabled={loading}
                className="flex items-center gap-1.5 px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50 transition disabled:opacity-50">
                <ChevronLeft size={15} /> Back
              </button>
            ) : (
              <button onClick={onClose}
                className="flex items-center gap-1.5 px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50 transition">
                Cancel
              </button>
            )}
            <div className="flex-1" />
            {step < 4 ? (
              <button onClick={goNext}
                className="flex items-center gap-1.5 px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 transition">
                {step === 2 && !addBranch ? 'Skip & Continue' : 'Continue'} <ChevronRight size={15} />
              </button>
            ) : (
              <button onClick={handleCreate} disabled={loading}
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 transition">
                {loading ? <><Loader2 size={15} className="animate-spin" /> Creating...</> : <><Check size={15} /> Create Client</>}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
