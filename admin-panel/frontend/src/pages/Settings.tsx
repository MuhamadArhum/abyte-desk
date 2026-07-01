import { useState, type FormEvent, useEffect } from 'react';
import { Lock, User, AlertCircle, Eye, EyeOff, Save, Package, Loader2 } from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { usePrices } from '../hooks/usePrices';

const MODULE_META: Record<string, { label: string; desc: string; color: string }> = {
  sales:     { label: 'Sales',       desc: 'POS, invoices, returns',      color: 'text-blue-600' },
  inventory: { label: 'Inventory',   desc: 'Products, stock, suppliers',  color: 'text-emerald-600' },
  accounts:  { label: 'Accounts',    desc: 'Ledger, vouchers, reports',   color: 'text-purple-600' },
  hr:        { label: 'HR & Payroll',desc: 'Staff, attendance, salary',   color: 'text-orange-600' },
};

export default function Settings() {
  const { admin, updateProfile } = useAuth();
  const { toast } = useToast();
  const { prices, loading: pricesLoading, reload: reloadPrices } = usePrices();

  // Profile state
  const [name, setName]         = useState(admin?.name || '');
  const [email, setEmail]       = useState(admin?.email || '');
  const [profileSaving, setProfileSaving] = useState(false);

  // Password state
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [showCf, setShowCf]     = useState(false);
  const [pwSaving, setPwSaving] = useState(false);

  // Pricing state
  const [editPrices, setEditPrices] = useState({ sales: 0, inventory: 0, accounts: 0, hr: 0 });
  const [priceSaving, setPriceSaving] = useState(false);

  useEffect(() => {
    setName(admin?.name || '');
    setEmail(admin?.email || '');
  }, [admin]);

  useEffect(() => {
    setEditPrices({ ...prices });
  }, [prices]);

  const initials = admin?.name
    ? admin.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : admin?.email?.[0]?.toUpperCase() ?? 'A';

  const handleProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setProfileSaving(true);
    try {
      await updateProfile({ name: name.trim(), email: email.trim() });
      toast('success', 'Profile updated successfully');
    } catch (err: any) {
      toast('error', err.response?.data?.message || 'Failed to update profile');
    } finally {
      setProfileSaving(false);
    }
  };

  const handlePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { toast('error', 'Passwords do not match'); return; }
    if (password.length < 6)  { toast('error', 'Password must be at least 6 characters'); return; }
    setPwSaving(true);
    try {
      await api.post('/auth/change-password', { new_password: password });
      toast('success', 'Password changed successfully');
      setPassword(''); setConfirm('');
    } catch (err: any) {
      toast('error', err.response?.data?.message || 'Failed to update password');
    } finally {
      setPwSaving(false);
    }
  };

  const handlePrices = async (e: FormEvent) => {
    e.preventDefault();
    for (const [mod, val] of Object.entries(editPrices)) {
      if (!val || val < 0) { toast('error', `Invalid price for ${mod}`); return; }
    }
    setPriceSaving(true);
    try {
      await api.put('/settings/prices', { prices: editPrices });
      toast('success', 'Module prices updated');
      reloadPrices();
    } catch (err: any) {
      toast('error', err.response?.data?.message || 'Failed to update prices');
    } finally {
      setPriceSaving(false);
    }
  };

  const inputCls = 'w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition bg-slate-50/50';

  return (
    <div className="p-6 max-w-2xl space-y-5">
      {/* Header */}
      <div className="relative bg-white border border-slate-100 rounded-2xl px-6 py-4 shadow-sm overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-slate-50/80 via-transparent to-transparent pointer-events-none" />
        <div className="absolute -top-6 -left-6 w-28 h-28 bg-slate-400/6 rounded-full blur-3xl pointer-events-none" />
        <div className="relative flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-lg font-bold shadow-md shadow-emerald-200 flex-shrink-0">
            {initials}
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">Settings</h2>
            <p className="text-slate-400 text-sm mt-0.5">{admin?.email}</p>
          </div>
          <div className="ml-auto hidden sm:flex flex-col items-end gap-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500 text-white text-xs font-bold rounded-full shadow-md shadow-emerald-200">
              <User size={11} /> Super Admin
            </span>
            <p className="text-[11px] text-slate-400">Full system access</p>
          </div>
        </div>
      </div>

      {/* Profile Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 bg-emerald-100 rounded-lg flex items-center justify-center">
            <User size={14} className="text-emerald-600" />
          </div>
          <h3 className="font-bold text-slate-700 text-sm">Edit Profile</h3>
        </div>

        <form onSubmit={handleProfile} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Full Name</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                className={inputCls}
                placeholder="Your name"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className={inputCls}
                placeholder="admin@email.com"
                required
              />
            </div>
          </div>
          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={profileSaving}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl disabled:opacity-50 transition shadow-sm shadow-emerald-100"
            >
              {profileSaving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              {profileSaving ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </form>
      </div>

      {/* Change Password */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 bg-slate-100 rounded-lg flex items-center justify-center">
            <Lock size={14} className="text-slate-500" />
          </div>
          <h3 className="font-bold text-slate-700 text-sm">Change Password</h3>
        </div>

        <form onSubmit={handlePassword} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">New Password</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  placeholder="Min 6 characters"
                  className={`${inputCls} pr-10`}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Confirm Password</label>
              <div className="relative">
                <input
                  type={showCf ? 'text' : 'password'}
                  placeholder="Repeat password"
                  className={`${inputCls} pr-10 ${confirm && confirm !== password ? 'border-red-300 focus:ring-red-400' : ''}`}
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  required
                />
                <button type="button" onClick={() => setShowCf(!showCf)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showCf ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {confirm && confirm !== password && (
                <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
              )}
            </div>
          </div>
          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={pwSaving}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold rounded-xl disabled:opacity-50 transition"
            >
              {pwSaving ? <Loader2 size={15} className="animate-spin" /> : <Lock size={15} />}
              {pwSaving ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </form>
      </div>

      {/* Pricing Config */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-emerald-100 rounded-lg flex items-center justify-center">
              <Package size={14} className="text-emerald-600" />
            </div>
            <h3 className="font-bold text-slate-700 text-sm">Module Pricing</h3>
          </div>
          <span className="text-xs text-slate-400 font-medium">Monthly rates (Rs.)</span>
        </div>
        <p className="text-xs text-slate-400 mb-4 ml-9">Changes apply to new client additions and revenue calculations</p>

        {pricesLoading ? (
          <div className="space-y-3 animate-pulse">
            {[...Array(4)].map((_, i) => <div key={i} className="h-14 bg-slate-100 rounded-xl" />)}
          </div>
        ) : (
          <form onSubmit={handlePrices} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(MODULE_META).map(([key, meta]) => (
                <div key={key} className="flex items-center gap-3 p-3 bg-slate-50 hover:bg-white rounded-xl border border-slate-100 hover:border-slate-200 transition-all group">
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold ${meta.color}`}>{meta.label}</p>
                    <p className="text-xs text-slate-400 truncate">{meta.desc}</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <span className="text-xs text-slate-400 font-medium">Rs.</span>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={editPrices[key as keyof typeof editPrices]}
                      onChange={e => setEditPrices(p => ({ ...p, [key]: Number(e.target.value) }))}
                      className="w-20 border border-slate-200 rounded-lg px-2 py-1.5 text-sm text-slate-700 font-semibold text-right focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition bg-white"
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Monthly total preview */}
            <div className="relative flex items-center justify-between px-4 py-3 bg-gradient-to-r from-slate-800 to-slate-900 rounded-xl overflow-hidden">
              <div className="absolute -top-4 -right-4 w-20 h-20 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
              <div className="relative">
                <span className="text-sm text-slate-400 font-medium">All modules combined</span>
                <p className="text-xs text-slate-600 mt-0.5">Maximum monthly per client</p>
              </div>
              <span className="relative text-lg font-black text-emerald-400">
                Rs. {Object.values(editPrices).reduce((a, b) => a + b, 0).toLocaleString()}
                <span className="text-xs font-medium text-emerald-500/70 ml-1">/mo</span>
              </span>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={priceSaving}
                className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl disabled:opacity-50 transition shadow-sm shadow-emerald-100"
              >
                {priceSaving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                {priceSaving ? 'Saving...' : 'Save Prices'}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600">
        <AlertCircle size={15} className="flex-shrink-0 mt-0.5 text-slate-400" />
        <span>
          Pricing changes affect revenue calculations and new client billing.
          Existing client contracts are not automatically updated.
        </span>
      </div>
    </div>
  );
}
