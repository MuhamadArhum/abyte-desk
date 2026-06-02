import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Eye, EyeOff, AlertCircle, ArrowRight,
  ShieldCheck, Users, BarChart3, Lock,
} from 'lucide-react';

const features = [
  { icon: Users,      text: 'Multi-tenant client management' },
  { icon: BarChart3,  text: 'Real-time revenue overview' },
  { icon: ShieldCheck,text: 'Secure module-based access' },
];

export default function Login() {
  const { login } = useAuth();
  const navigate  = useNavigate();

  const [email, setEmail]     = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]   = useState(false);
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">

      {/* ── Left brand panel ── */}
      <div className="hidden lg:flex lg:w-[52%] relative flex-col justify-between p-12 bg-slate-900 overflow-hidden">

        {/* Decorative grid */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)`,
            backgroundSize: '40px 40px',
          }}
        />

        {/* Glow blobs */}
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-72 h-72 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Logo */}
        <div className="relative flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center shadow-lg shadow-emerald-500/30 bg-white">
            <img src="/logo.png" alt="AByte" className="w-full h-full object-contain" />
          </div>
          <span className="text-white font-bold text-lg tracking-tight">AByte POS</span>
        </div>

        {/* Center copy */}
        <div className="relative">
          <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Super Admin Console
          </div>

          <h1 className="text-4xl font-extrabold text-white leading-tight mb-4">
            Manage your<br />
            <span className="text-emerald-400">entire business</span><br />
            from one place.
          </h1>
          <p className="text-slate-400 text-base leading-relaxed max-w-sm">
            Onboard clients, track revenue, and control module access — all in a single dashboard.
          </p>

          {/* Feature list */}
          <ul className="mt-8 space-y-3.5">
            {features.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3">
                <div className="w-8 h-8 bg-slate-800 border border-slate-700 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Icon size={15} className="text-emerald-400" />
                </div>
                <span className="text-slate-300 text-sm">{text}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Footer */}
        <p className="relative text-slate-600 text-xs">
          © {new Date().getFullYear()} AByte Technologies. All rights reserved.
        </p>
      </div>

      {/* ── Right form panel ── */}
      <div className="flex-1 flex flex-col justify-center items-center bg-white px-6 py-12">
        <div className="w-full max-w-sm">

          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-2 justify-center mb-10">
            <div className="w-9 h-9 rounded-xl overflow-hidden flex items-center justify-center shadow-md bg-white">
              <img src="/logo.png" alt="AByte" className="w-full h-full object-contain" />
            </div>
            <span className="text-slate-800 font-bold text-lg">AByte POS</span>
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-800">Welcome back</h2>
            <p className="text-slate-500 text-sm mt-1">Sign in to access your admin console</p>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-600 rounded-2xl px-4 py-3 mb-5 text-sm">
              <AlertCircle size={16} className="mt-0.5 flex-shrink-0 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Email */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Email address
              </label>
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

            {/* Password */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full border border-slate-200 bg-slate-50 hover:bg-white focus:bg-white rounded-2xl px-4 py-3 pr-12 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
                >
                  {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold py-3.5 rounded-2xl transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed text-sm shadow-lg shadow-emerald-500/20 mt-1"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  Sign In
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          {/* Security note */}
          <div className="flex items-center gap-2 justify-center mt-8 text-slate-400 text-xs">
            <Lock size={12} />
            <span>Secured with JWT authentication</span>
          </div>
        </div>
      </div>

    </div>
  );
}
