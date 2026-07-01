import { useEffect, useState } from 'react';
import { Users, UserCheck, UserX, TrendingUp, Building2, ChevronRight, Zap, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

interface Stats {
  total: number; active: number; inactive: number; monthly_revenue: number;
  expiring_soon: number; expired: number;
}
interface Tenant {
  tenant_id: number; tenant_code: string; tenant_name: string;
  company_name: string; is_active: number; modules_enabled: string | string[];
  created_at: string;
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 animate-pulse">
      <div className="flex items-start justify-between mb-4">
        <div className="w-11 h-11 bg-slate-100 rounded-xl" />
      </div>
      <div className="w-16 h-7 bg-slate-100 rounded-lg mb-1" />
      <div className="w-24 h-4 bg-slate-100 rounded" />
    </div>
  );
}

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30)  return `${days}d ago`;
  return new Date(d).toLocaleDateString('en-PK', { day: '2-digit', month: 'short' });
}

function getModuleCount(m: string | string[]): number {
  if (!m) return 0;
  if (Array.isArray(m)) return m.length;
  try { return JSON.parse(m).length; } catch { return 0; }
}

const avatarGradients = [
  'from-emerald-500 to-teal-600',
  'from-blue-500 to-indigo-600',
  'from-purple-500 to-violet-600',
  'from-orange-500 to-rose-500',
  'from-cyan-500 to-blue-600',
  'from-amber-500 to-orange-600',
];

export default function Dashboard() {
  const navigate = useNavigate();
  const { admin } = useAuth();
  const [stats, setStats]   = useState<Stats | null>(null);
  const [recent, setRecent] = useState<Tenant[]>([]);
  const [loading, setLoading]           = useState(true);
  const [recentLoading, setRecentLoading] = useState(true);

  useEffect(() => {
    api.get('/tenants/stats')
      .then(r => setStats(r.data))
      .finally(() => setLoading(false));

    api.get('/tenants')
      .then(r => setRecent((r.data.data as Tenant[]).slice(0, 6)))
      .finally(() => setRecentLoading(false));
  }, []);

  const activeRate = stats && stats.total > 0
    ? Math.round((stats.active / stats.total) * 100) : 0;

  const greeting = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="p-6 max-w-6xl space-y-5">

      {/* Header Card */}
      <div className="relative bg-white border border-slate-100 rounded-2xl px-6 py-5 shadow-sm overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-50/70 via-transparent to-transparent pointer-events-none" />
        <div className="absolute -top-8 -left-8 w-36 h-36 bg-emerald-400/8 rounded-full blur-3xl pointer-events-none" />
        <div className="relative flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <p className="text-[11px] font-bold text-emerald-600 uppercase tracking-widest">Live Console</p>
            </div>
            <h2 className="text-2xl font-bold text-slate-800">
              {greeting}, <span className="text-emerald-600">{admin?.name?.split(' ')[0] || 'Admin'}</span> 👋
            </h2>
            <p className="text-xs text-slate-400 mt-0.5 font-medium">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <div className="hidden sm:flex flex-col items-end gap-1">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 text-white text-xs font-bold rounded-full shadow-md shadow-emerald-200">
              <Zap size={11} />
              Super Admin
            </span>
            <p className="text-[11px] text-slate-400">Full system access</p>
          </div>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
          : (
            <>
              {/* Total Clients */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-md transition-shadow duration-200 group">
                <div className="w-11 h-11 bg-slate-50 rounded-xl flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                  <Users size={20} className="text-slate-600" />
                </div>
                <p className="text-2xl font-bold text-slate-800 mb-0.5">{stats?.total ?? 0}</p>
                <p className="text-slate-500 text-sm">Total Clients</p>
              </div>

              {/* Active Clients */}
              <div className="bg-white rounded-2xl border border-emerald-100 p-5 hover:shadow-md transition-shadow duration-200 group">
                <div className="w-11 h-11 bg-emerald-50 rounded-xl flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                  <UserCheck size={20} className="text-emerald-600" />
                </div>
                <p className="text-2xl font-bold text-slate-800 mb-0.5">{stats?.active ?? 0}</p>
                <p className="text-slate-500 text-sm">Active Clients</p>
              </div>

              {/* Inactive Clients */}
              <div className="bg-white rounded-2xl border border-red-100 p-5 hover:shadow-md transition-shadow duration-200 group">
                <div className="w-11 h-11 bg-red-50 rounded-xl flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                  <UserX size={20} className="text-red-500" />
                </div>
                <p className="text-2xl font-bold text-slate-800 mb-0.5">{stats?.inactive ?? 0}</p>
                <p className="text-slate-500 text-sm">Inactive Clients</p>
              </div>

              {/* Monthly Revenue — gradient card */}
              <div className="relative bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-5 overflow-hidden shadow-lg shadow-emerald-200 group hover:-translate-y-0.5 transition-transform duration-200">
                <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-white/10 rounded-full blur-2xl pointer-events-none" />
                <div className="w-11 h-11 bg-white/20 rounded-xl flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                  <TrendingUp size={20} className="text-white" />
                </div>
                <p className="text-2xl font-bold text-white mb-0.5">
                  Rs. {(stats?.monthly_revenue || 0).toLocaleString()}
                </p>
                <p className="text-emerald-100 text-sm">Monthly Revenue</p>
              </div>
            </>
          )
        }
      </div>

      {/* Expiring Soon Warning */}
      {!loading && stats && ((stats.expiring_soon ?? 0) > 0 || (stats.expired ?? 0) > 0) && (
        <div className="flex flex-wrap gap-3">
          {(stats.expiring_soon ?? 0) > 0 && (
            <div
              onClick={() => navigate('/clients')}
              className="flex-1 min-w-[220px] flex items-center gap-4 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-3.5 cursor-pointer hover:bg-amber-100 transition-colors group"
            >
              <div className="w-9 h-9 bg-amber-100 border border-amber-200 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                <AlertTriangle size={17} className="text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-amber-800">
                  {stats.expiring_soon} subscription{stats.expiring_soon !== 1 ? 's' : ''} expiring soon
                </p>
                <p className="text-xs text-amber-600">Within 30 days — click to view clients</p>
              </div>
              <ChevronRight size={16} className="ml-auto text-amber-400 group-hover:translate-x-0.5 transition-transform" />
            </div>
          )}
          {(stats.expired ?? 0) > 0 && (
            <div
              onClick={() => navigate('/clients')}
              className="flex-1 min-w-[220px] flex items-center gap-4 bg-red-50 border border-red-200 rounded-2xl px-5 py-3.5 cursor-pointer hover:bg-red-100 transition-colors group"
            >
              <div className="w-9 h-9 bg-red-100 border border-red-200 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                <AlertTriangle size={17} className="text-red-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-red-800">
                  {stats.expired} subscription{stats.expired !== 1 ? 's' : ''} expired
                </p>
                <p className="text-xs text-red-600">Action required — click to manage</p>
              </div>
              <ChevronRight size={16} className="ml-auto text-red-400 group-hover:translate-x-0.5 transition-transform" />
            </div>
          )}
        </div>
      )}

      {/* Middle row */}
      {!loading && stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Active rate */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 bg-emerald-100 rounded-lg flex items-center justify-center">
                <UserCheck size={14} className="text-emerald-600" />
              </div>
              <h3 className="text-sm font-bold text-slate-700">Client Activity Rate</h3>
            </div>
            <div className="flex items-end gap-3 mb-3">
              <span className="text-4xl font-black text-slate-800">{activeRate}%</span>
              <span className="text-sm text-slate-400 mb-1.5 font-medium">clients active</span>
            </div>
            <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden mb-2">
              <div
                className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full transition-all duration-700"
                style={{ width: `${activeRate}%` }}
              />
            </div>
            <div className="flex justify-between text-xs font-medium mt-1">
              <span className="text-emerald-600">{stats.active} active</span>
              <span className="text-slate-400">{stats.inactive} inactive</span>
            </div>
          </div>

          {/* Revenue summary */}
          <div className="relative bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-5 text-white overflow-hidden hover:shadow-lg transition-shadow">
            <div className="absolute -top-6 -right-6 w-28 h-28 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute -bottom-8 -left-4 w-36 h-36 bg-teal-500/8 rounded-full blur-3xl pointer-events-none" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 bg-white/10 rounded-lg flex items-center justify-center">
                  <TrendingUp size={14} className="text-emerald-400" />
                </div>
                <h3 className="text-sm font-bold text-slate-300">Revenue Summary</h3>
              </div>
              <p className="text-3xl font-black text-white mb-0.5">
                Rs. {(stats.monthly_revenue || 0).toLocaleString()}
              </p>
              <p className="text-slate-400 text-sm">Monthly recurring</p>
              <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span className="text-emerald-400 text-sm font-semibold">
                    Avg Rs. {stats.total > 0 ? Math.round(stats.monthly_revenue / stats.total).toLocaleString() : 0} / client
                  </span>
                </div>
                <button
                  onClick={() => navigate('/revenue')}
                  className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition-colors font-medium"
                >
                  View details <ChevronRight size={13} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recent Clients */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-slate-100 rounded-lg flex items-center justify-center">
              <Building2 size={14} className="text-slate-500" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-700">Recent Clients</h3>
              <p className="text-[11px] text-slate-400">Latest onboarded</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/clients')}
            className="text-xs text-slate-500 hover:text-emerald-600 flex items-center gap-1 transition-colors font-semibold"
          >
            View all <ChevronRight size={13} />
          </button>
        </div>

        {recentLoading ? (
          <div className="divide-y divide-slate-50">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-3.5 animate-pulse">
                <div className="w-9 h-9 bg-slate-100 rounded-xl flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-4 bg-slate-100 rounded w-40" />
                  <div className="h-3 bg-slate-100 rounded w-28" />
                </div>
                <div className="h-4 bg-slate-100 rounded w-16" />
              </div>
            ))}
          </div>
        ) : recent.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-sm">No clients yet</div>
        ) : (
          <div className="divide-y divide-slate-50">
            {recent.map((c, idx) => (
              <div
                key={c.tenant_id}
                onClick={() => navigate(`/clients/${c.tenant_id}`)}
                className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50/80 cursor-pointer transition-colors group"
              >
                <div className={`w-9 h-9 bg-gradient-to-br ${avatarGradients[idx % avatarGradients.length]} rounded-xl flex items-center justify-center text-sm font-bold text-white flex-shrink-0 shadow-sm`}>
                  {(c.company_name || c.tenant_name).charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800 text-sm truncate">
                    {c.company_name || c.tenant_name}
                  </p>
                  <p className="text-slate-400 text-xs font-mono">
                    {c.tenant_code} · {getModuleCount(c.modules_enabled)} module{getModuleCount(c.modules_enabled) !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                    c.is_active ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-slate-100 text-slate-500 border border-slate-200'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${c.is_active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                    {c.is_active ? 'Active' : 'Inactive'}
                  </span>
                  <p className="text-xs text-slate-400 mt-1">{timeAgo(c.created_at)}</p>
                </div>
                <ChevronRight size={14} className="text-slate-300 group-hover:text-emerald-500 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
