import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, ArrowLeft, Eye, EyeOff, CheckCircle, AlertCircle, ShieldCheck } from 'lucide-react';
import api from '../api/axios';

const rules = [
  { label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
  { label: 'Contains uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'Contains a number', test: (p: string) => /\d/.test(p) },
];

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const strength = rules.filter(r => r.test(password)).length;
  const strengthColor = strength === 0 ? 'bg-slate-200' : strength === 1 ? 'bg-red-400' : strength === 2 ? 'bg-yellow-400' : 'bg-emerald-500';
  const strengthLabel = ['', 'Weak', 'Fair', 'Strong'][strength];

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    if (strength < 2) { setError('Please choose a stronger password.'); return; }
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, password });
      setDone(true);
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
        : undefined;
      setError(msg || 'Invalid or expired reset link. Please request a new one.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">

      {/* Left brand panel */}
      <div className="hidden lg:flex lg:w-[52%] relative flex-col justify-between p-12 overflow-hidden" style={{ background: 'linear-gradient(160deg, #0a1628 0%, #0f172a 45%, #111827 100%)' }}>
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: 'radial-gradient(circle, #10b981 1px, transparent 1px)',
          backgroundSize: '24px 24px'
        }} />
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-72 h-72 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center shadow-lg shadow-emerald-500/30 bg-white">
            <img src="/logo.png" alt="AByte" className="w-full h-full object-contain" />
          </div>
          <span className="text-white font-bold text-lg tracking-tight">AByte <span className="text-emerald-400">ERP</span></span>
        </div>

        <div className="relative">
          <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
            <ShieldCheck size={12} />
            Secure Reset
          </div>
          <h1 className="text-4xl font-extrabold text-white leading-tight mb-4">
            Create a new<br />
            <span className="text-emerald-400">secure password</span>
          </h1>
          <p className="text-slate-400 text-base leading-relaxed max-w-sm">
            Choose a strong password to protect your AByte Admin account. It must be at least 8 characters with a mix of letters and numbers.
          </p>

          <div className="mt-8 p-5 bg-white/[0.04] border border-white/[0.08] rounded-2xl space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Password Requirements</p>
            {rules.map(r => (
              <div key={r.label} className="flex items-center gap-3">
                <div className={`w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 transition-colors ${r.test(password) ? 'bg-emerald-500 border-emerald-500' : 'border-slate-600'}`}>
                  {r.test(password) && <CheckCircle size={10} className="text-white" />}
                </div>
                <span className={`text-xs transition-colors ${r.test(password) ? 'text-emerald-400' : 'text-slate-500'}`}>{r.label}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-slate-600 text-xs">© {new Date().getFullYear()} AByte Technologies. All rights reserved.</p>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex flex-col justify-center items-center bg-white px-6 py-12 relative">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(16,185,129,0.05),_transparent_60%)] pointer-events-none" />
        <div className="w-full max-w-sm relative z-10">

          <div className="flex lg:hidden items-center gap-2 justify-center mb-10">
            <div className="w-9 h-9 rounded-xl overflow-hidden flex items-center justify-center shadow-md bg-white">
              <img src="/logo.png" alt="AByte" className="w-full h-full object-contain" />
            </div>
            <span className="text-slate-800 font-bold text-lg">AByte ERP</span>
          </div>

          {!done ? (
            <>
              <Link to="/login" className="inline-flex items-center gap-2 text-xs text-slate-400 hover:text-emerald-600 transition mb-8">
                <ArrowLeft size={14} /> Back to Login
              </Link>

              <div className="mb-8">
                <h2 className="text-2xl font-bold text-slate-800">Set New Password</h2>
                <p className="text-slate-500 text-sm mt-1">Must be different from your previous password</p>
              </div>

              {!token && (
                <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 text-amber-700 rounded-2xl px-4 py-3 mb-5 text-sm">
                  <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                  Invalid reset link. Please request a new password reset.
                </div>
              )}

              {error && (
                <div className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-600 rounded-2xl px-4 py-3 mb-5 text-sm">
                  <AlertCircle size={16} className="mt-0.5 flex-shrink-0 text-red-500" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">New Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className="w-full border border-slate-200 bg-slate-50 hover:bg-white focus:bg-white rounded-2xl px-4 py-3 pr-12 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                      placeholder="Enter new password"
                      required
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition" tabIndex={-1}>
                      {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                  {password && (
                    <div className="mt-2 space-y-1.5">
                      <div className="flex gap-1">
                        {[1, 2, 3].map(i => (
                          <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i <= strength ? strengthColor : 'bg-slate-200'}`} />
                        ))}
                      </div>
                      {strengthLabel && <p className={`text-xs font-medium ${strength === 3 ? 'text-emerald-600' : strength === 2 ? 'text-yellow-600' : 'text-red-500'}`}>{strengthLabel} password</p>}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Confirm Password</label>
                  <div className="relative">
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      value={confirm}
                      onChange={e => setConfirm(e.target.value)}
                      className={`w-full border bg-slate-50 hover:bg-white focus:bg-white rounded-2xl px-4 py-3 pr-12 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:border-transparent transition-all ${confirm && confirm !== password ? 'border-red-300 focus:ring-red-400' : 'border-slate-200 focus:ring-emerald-500'}`}
                      placeholder="Re-enter new password"
                      required
                    />
                    <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition" tabIndex={-1}>
                      {showConfirm ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                  {confirm && confirm !== password && (
                    <p className="text-xs text-red-500 mt-1.5">Passwords do not match</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading || !token}
                  className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold py-3.5 rounded-2xl transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed text-sm shadow-lg shadow-emerald-500/20 mt-2"
                >
                  {loading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Updating...
                    </>
                  ) : 'Update Password'}
                </button>
              </form>
            </>
          ) : (
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-emerald-50 border-2 border-emerald-200 rounded-2xl flex items-center justify-center mx-auto mb-5">
                <ShieldCheck size={30} className="text-emerald-500" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">Password Updated!</h3>
              <p className="text-slate-500 text-sm leading-relaxed mb-6">
                Your password has been changed successfully. You can now sign in with your new password.
              </p>
              <button
                onClick={() => navigate('/login')}
                className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3.5 rounded-2xl transition text-sm shadow-lg shadow-emerald-500/20"
              >
                Continue to Login
              </button>
            </div>
          )}

          <div className="flex items-center gap-2 justify-center mt-8 text-slate-400 text-xs">
            <Lock size={12} />
            <span>Secured with JWT authentication</span>
          </div>
        </div>
      </div>
    </div>
  );
}
