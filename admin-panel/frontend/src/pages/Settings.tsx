import { useState, type FormEvent, useEffect } from 'react';
import { Lock, User, AlertCircle, Eye, EyeOff, Save, Package, Loader2, Shield, TrendingUp, Info, ChevronRight } from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { usePrices } from '../hooks/usePrices';

const MODULE_META: Record<string, { label: string; desc: string; color: string; bg: string; dot: string }> = {
  sales:     { label: 'Sales',        desc: 'POS, invoices, returns',     color: 'text-blue-600',    bg: 'bg-blue-50',    dot: 'bg-blue-500' },
  inventory: { label: 'Inventory',    desc: 'Products, stock, suppliers', color: 'text-emerald-600', bg: 'bg-emerald-50', dot: 'bg-emerald-500' },
  accounts:  { label: 'Accounts',     desc: 'Ledger, vouchers, reports',  color: 'text-purple-600',  bg: 'bg-purple-50',  dot: 'bg-purple-500' },
  hr:        { label: 'HR & Payroll', desc: 'Staff, attendance, salary',  color: 'text-orange-600',  bg: 'bg-orange-50',  dot: 'bg-orange-500' },
};

function SectionHeader({ icon: Icon, title, desc, iconBg = 'bg-emerald-100', iconColor = 'text-emerald-600' }: {
  icon: any; title: string; desc?: string; iconBg?: string; iconColor?: string;
}) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className={`w-8 h-8 ${iconBg} rounded-xl flex items-center justify-center flex-shrink-0`}>
        <Icon size={15} className={iconColor} />
      </div>
      <div>
        <h3 className="font-bold text-slate-800 text-sm">{title}</h3>
        {desc && <p className="text-xs text-slate-400 mt-0.5">{desc}</p>}
      </div>
    </div>
  );
}

export default function Settings() {
  const { admin, updateProfile } = useAuth();
  const { toast } = useToast();
  const { prices, loading: pricesLoading, reload: reloadPrices } = usePrices();

  const [name, setName]         = useState(admin?.name || '');
  const [email, setEmail]       = useState(admin?.email || '');
  const [profileSaving, setProfileSaving] = useState(false);

  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [showCf, setShowCf]     = useState(false);
  const [pwSaving, setPwSaving] = useState(false);

  const [editPrices, setEditPrices] = useState({ sales: 0, inventory: 0, accounts: 0, hr: 0 });
  const [priceSaving, setPriceSaving] = useState(false);

  useEffect(() => { setName(admin?.name || ''); setEmail(admin?.email || ''); }, [admin]);
  useEffect(() => { setEditPrices({ ...prices }); }, [prices]);

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
    } finally { setProfileSaving(false); }
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
    } finally { setPwSaving(false); }
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
    } finally { setPriceSaving(false); }
  };

  const inputCls = 'w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-400 transition bg-white';
  const totalPrice = Object.values(editPrices).reduce((a, b) => a + b, 0);

  return (
    <div className="p-6 max-w-3xl space-y-5">

      {/* Header */}
      <div className="relative bg-white border border-slate-100 rounded-2xl px-6 py-5 shadow-sm overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-50/60 via-transparent to-transparent pointer-events-none" />
        <div className="absolute -top-8 -left-8 w-32 h-32 bg-emerald-400/6 rounded-full blur-3xl pointer-events-none" />
        <div className="relative flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-xl font-black shadow-lg shadow-emerald-200 flex-shrink-0 select-none">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-slate-800">{admin?.name || 'Super Admin'}</h2>
            <p className="text-slate-400 text-sm mt-0.5 truncate">{admin?.email}</p>
          </div>
          <div className="hidden sm:flex flex-col items-end gap-1.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 text-white text-xs font-bold rounded-full shadow-md shadow-emerald-200">
              <Shield size={11} /> Super Admin
            </span>
            <p className="text-[11px] text-slate-400">Full system access</p>
          </div>
        </div>

        {/* Quick stats bar */}
        <div className="relative mt-4 pt-4 border-t border-slate-100 grid grid-cols-3 gap-4">
          {[
            { label: 'Role', value: 'Super Admin', color: 'text-emerald-600' },
            { label: 'Access', value: 'All modules', color: 'text-slate-700' },
            { label: 'Status', value: 'Active', color: 'text-emerald-600' },
          ].map(s => (
            <div key={s.label} className="text-center">
              <p className={`text-sm font-bold ${s.color}`}>{s.value}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Profile + Password side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

        {/* Profile Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <SectionHeader icon={User} title="Edit Profile" desc="Update your name and email" />
          <form onSubmit={handleProfile} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Full Name</label>
              <input value={name} onChange={e => setName(e.target.value)} className={inputCls} placeholder="Your name" required />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Email Address</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={inputCls} placeholder="admin@email.com" required />
            </div>
            <button
              type="submit"
              disabled={profileSaving}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl disabled:opacity-50 transition shadow-sm shadow-emerald-100 mt-1"
            >
              {profileSaving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              {profileSaving ? 'Saving...' : 'Save Profile'}
            </button>
          </form>
        </div>

        {/* Password Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <SectionHeader icon={Lock} title="Change Password" desc="Use a strong password" iconBg="bg-slate-100" iconColor="text-slate-500" />
          <form onSubmit={handlePassword} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">New Password</label>
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
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Confirm Password</label>
              <div className="relative">
                <input
                  type={showCf ? 'text' : 'password'}
                  placeholder="Repeat password"
                  className={`${inputCls} pr-10 ${confirm && confirm !== password ? 'border-red-300 focus:ring-red-400/40 focus:border-red-400' : ''}`}
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  required
                />
                <button type="button" onClick={() => setShowCf(!showCf)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showCf ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {confirm && confirm !== password && (
                <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle size={11} /> Passwords do not match</p>
              )}
            </div>
            <button
              type="submit"
              disabled={pwSaving}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold rounded-xl disabled:opacity-50 transition mt-1"
            >
              {pwSaving ? <Loader2 size={15} className="animate-spin" /> : <Lock size={15} />}
              {pwSaving ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        </div>
      </div>

      {/* Module Pricing */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-1">
          <SectionHeader icon={Package} title="Module Pricing" desc="Monthly rates charged per module" />
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl mb-5">
            <TrendingUp size={13} className="text-emerald-500" />
            <span className="text-xs text-slate-500 font-medium">affects revenue calculations</span>
          </div>
        </div>

        {pricesLoading ? (
          <div className="space-y-3 animate-pulse">
            {[...Array(4)].map((_, i) => <div key={i} className="h-16 bg-slate-100 rounded-xl" />)}
          </div>
        ) : (
          <form onSubmit={handlePrices} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {Object.entries(MODULE_META).map(([key, meta]) => (
                <div key={key} className={`flex items-center gap-3 p-4 ${meta.bg} rounded-xl border border-transparent hover:border-slate-200 transition-all group`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`w-2 h-2 rounded-full ${meta.dot} flex-shrink-0`} />
                      <p className={`text-sm font-bold ${meta.color}`}>{meta.label}</p>
                    </div>
                    <p className="text-xs text-slate-400 pl-4">{meta.desc}</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0 bg-white rounded-lg border border-slate-200 px-2.5 py-1.5 shadow-sm">
                    <span className="text-xs text-slate-400 font-medium">Rs.</span>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={editPrices[key as keyof typeof editPrices]}
                      onChange={e => setEditPrices(p => ({ ...p, [key]: Number(e.target.value) }))}
                      className="w-20 text-sm text-slate-700 font-bold text-right focus:outline-none bg-transparent"
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Total preview */}
            <div className="relative flex items-center justify-between px-5 py-4 bg-gradient-to-r from-slate-800 to-slate-900 rounded-xl overflow-hidden">
              <div className="absolute -top-4 -right-4 w-20 h-20 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
              <div className="relative">
                <p className="text-sm font-semibold text-white">All 4 modules</p>
                <p className="text-xs text-slate-400 mt-0.5">Maximum per client / month</p>
              </div>
              <div className="relative text-right">
                <p className="text-xl font-black text-emerald-400">Rs. {totalPrice.toLocaleString()}</p>
                <p className="text-xs text-emerald-500/70">/month</p>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={priceSaving}
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl disabled:opacity-50 transition shadow-sm shadow-emerald-100"
              >
                {priceSaving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                {priceSaving ? 'Saving...' : 'Save Prices'}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Quick Links */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <SectionHeader icon={ChevronRight} title="Quick Navigation" desc="Jump to other sections" iconBg="bg-slate-100" iconColor="text-slate-500" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Clients',   href: '/clients',  color: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
            { label: 'Revenue',   href: '/revenue',  color: 'bg-blue-50 text-blue-700 border-blue-100' },
            { label: 'Tickets',   href: '/tickets',  color: 'bg-purple-50 text-purple-700 border-purple-100' },
            { label: 'Audit Log', href: '/audit',    color: 'bg-slate-50 text-slate-700 border-slate-200' },
          ].map(l => (
            <a key={l.label} href={l.href} className={`flex items-center justify-between px-4 py-3 rounded-xl border text-sm font-semibold ${l.color} hover:shadow-sm transition-all`}>
              {l.label} <ChevronRight size={14} className="opacity-50" />
            </a>
          ))}
        </div>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500">
        <Info size={14} className="flex-shrink-0 mt-0.5 text-slate-400" />
        <span>Pricing changes affect revenue calculations and new client billing. Existing client contracts are not automatically updated.</span>
      </div>

    </div>
  );
}
