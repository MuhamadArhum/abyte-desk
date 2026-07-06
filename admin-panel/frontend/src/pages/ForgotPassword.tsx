import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, AlertCircle, CheckCircle, Lock } from 'lucide-react';
import api from '../api/axios';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email: email.trim().toLowerCase() });
      setSent(true);
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
        : undefined;
      setError(msg || 'Failed to send reset email. Please try again.');
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
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Account Recovery
          </div>
          <h1 className="text-4xl font-extrabold text-white leading-tight mb-4">
            Forgot your<br />
            <span className="text-emerald-400">password?</span>
          </h1>
          <p className="text-slate-400 text-base leading-relaxed max-w-sm">
            Enter your registered email address and we'll send you a secure link to reset your admin password.
          </p>
          <ul className="mt-8 space-y-3.5">
            {['Enter your email address', 'Check your inbox for the reset link', 'Create a new secure password'].map((step, i) => (
              <li key={i} className="flex items-center gap-3">
                <div className="w-6 h-6 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-emerald-400 text-[10px] font-black">{i + 1}</span>
                </div>
                <span className="text-slate-300 text-sm">{step}</span>
              </li>
            ))}
          </ul>
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

          {!sent ? (
            <>
              <Link to="/login" className="inline-flex items-center gap-2 text-xs text-slate-400 hover:text-emerald-600 transition mb-8">
                <ArrowLeft size={14} /> Back to Login
              </Link>

              <div className="mb-8">
                <h2 className="text-2xl font-bold text-slate-800">Reset Password</h2>
                <p className="text-slate-500 text-sm mt-1">We'll email you a secure reset link</p>
              </div>

              {error && (
                <div className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-600 rounded-2xl px-4 py-3 mb-5 text-sm">
                  <AlertCircle size={16} className="mt-0.5 flex-shrink-0 text-red-500" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full border border-slate-200 bg-slate-50 hover:bg-white focus:bg-white rounded-2xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                    placeholder="admin@abyte.com"
                    required
                    autoFocus
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold py-3.5 rounded-2xl transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed text-sm shadow-lg shadow-emerald-500/20"
                >
                  {loading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Sending...
                    </>
                  ) : 'Send Reset Link'}
                </button>
              </form>

              <p className="text-center text-xs text-slate-400 mt-6">
                Remember your password?{' '}
                <Link to="/login" className="text-emerald-600 font-semibold hover:text-emerald-700 transition">Sign In</Link>
              </p>
            </>
          ) : (
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-emerald-50 border-2 border-emerald-200 rounded-2xl flex items-center justify-center mx-auto mb-5">
                <CheckCircle size={30} className="text-emerald-500" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">Check your inbox</h3>
              <p className="text-slate-500 text-sm leading-relaxed mb-1">We've sent a password reset link to</p>
              <p className="font-bold text-slate-800 text-sm mb-6">{email}</p>
              <p className="text-xs text-slate-400 mb-6">
                Didn't receive it? Check your spam folder or{' '}
                <button onClick={() => setSent(false)} className="text-emerald-600 font-semibold hover:text-emerald-700 transition">try again</button>.
              </p>
              <Link to="/login" className="inline-flex items-center gap-2 bg-slate-900 text-white text-sm font-semibold px-5 py-2.5 rounded-2xl hover:bg-slate-800 transition">
                <ArrowLeft size={14} /> Back to Login
              </Link>
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
