import { useEffect, useState } from 'react';
import {
  RefreshCw, Activity, CheckCircle2,
  TrendingUp, Calendar, ChevronRight, Wifi, WifiOff,
} from 'lucide-react';
import api from '../api/axios';
import ActivityDetailModal from '../components/ActivityDetailModal';

interface TenantActivity {
  tenant_id:    number;
  tenant_code:  string;
  display_name: string;
  is_active:    number;
  today_logins: number;
  week_logins:  number;
  total_logins: number;
  last_login: {
    user_name:  string;
    ip_address: string;
    created_at: string;
  } | null;
}

const avatarGradients = [
  'from-emerald-500 to-teal-600',
  'from-blue-500 to-indigo-600',
  'from-purple-500 to-violet-600',
  'from-orange-500 to-rose-500',
  'from-cyan-500 to-blue-600',
  'from-amber-500 to-orange-600',
];

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 1)   return 'Just now';
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return 'Yesterday';
  return `${days}d ago`;
}

function isToday(dateStr: string): boolean {
  return new Date(dateStr).toDateString() === new Date().toDateString();
}

function isOnline(dateStr: string): boolean {
  return Date.now() - new Date(dateStr).getTime() < 30 * 60 * 1000;
}

function SkeletonRow() {
  return (
    <tr className="animate-pulse border-b border-slate-100">
      {[180, 110, 80, 80, 100, 130, 60].map((w, i) => (
        <td key={i} className="px-5 py-4">
          <div className="h-4 bg-slate-100 rounded" style={{ width: w }} />
        </td>
      ))}
    </tr>
  );
}

export default function ActivityPage() {
  const [data, setData]           = useState<TenantActivity[]>([]);
  const [loading, setLoading]     = useState(true);
  const [selected, setSelected]   = useState<TenantActivity | null>(null);
  const [filter, setFilter]       = useState<'all' | 'today' | 'inactive'>('all');

  const load = () => {
    setLoading(true);
    api.get('/tenants/activity').then(r => setData(r.data.data)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const filtered = data.filter(t => {
    if (filter === 'today')    return t.today_logins > 0;
    if (filter === 'inactive') return !t.last_login || (!isToday(t.last_login.created_at));
    return true;
  });

  const totalToday    = data.reduce((s, t) => s + t.today_logins, 0);
  const activeToday   = data.filter(t => t.today_logins > 0).length;
  const onlineNow     = data.filter(t => t.last_login && isOnline(t.last_login.created_at)).length;

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="relative bg-white border border-slate-100 rounded-2xl px-6 py-4 shadow-sm overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-50/60 via-transparent to-transparent pointer-events-none" />
        <div className="absolute -top-6 -left-6 w-28 h-28 bg-emerald-400/8 rounded-full blur-3xl pointer-events-none" />
        <div className="relative flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Usage & Activity</h2>
            <p className="text-slate-400 text-sm mt-0.5">
              {loading ? '...' : (
                <><span className="font-semibold text-emerald-600">{onlineNow}</span> clients online now</>
              )}
            </p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 text-sm border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Online Now",        value: onlineNow,             icon: Wifi,         gradient: true,          sub: 'last 30 min' },
          { label: "Logged In Today",   value: activeToday,           icon: CheckCircle2, bg: 'bg-slate-100', text: 'text-slate-600',  sub: 'unique clients' },
          { label: "Total Logins Today",value: totalToday,            icon: Activity,     bg: 'bg-slate-100', text: 'text-slate-600',  sub: 'all sessions' },
          { label: "No Activity Today", value: data.length - activeToday, icon: WifiOff,  bg: 'bg-slate-100', text: 'text-slate-500',  sub: 'not logged in' },
        ].map(({ label, value, icon: Icon, bg, text, sub, gradient }: any) => (
          gradient ? (
            <div key={label} className="relative bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-4 overflow-hidden shadow-md shadow-emerald-200 group hover:-translate-y-0.5 transition-transform duration-200">
              <div className="absolute -bottom-3 -right-3 w-16 h-16 bg-white/10 rounded-full blur-xl pointer-events-none" />
              <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                <Icon size={17} className="text-white" />
              </div>
              <p className="text-2xl font-bold text-white">{loading ? '—' : value}</p>
              <p className="text-emerald-100 text-xs font-medium mt-0.5">{label}</p>
              <p className="text-emerald-200/70 text-xs">{sub}</p>
            </div>
          ) : (
            <div key={label} className="bg-white rounded-2xl border border-slate-200 p-4 hover:shadow-md transition-shadow">
              <div className={`w-9 h-9 ${bg} rounded-xl flex items-center justify-center mb-3`}>
                <Icon size={17} className={text} />
              </div>
              <p className="text-2xl font-bold text-slate-800">{loading ? '—' : value}</p>
              <p className="text-slate-600 text-xs font-medium mt-0.5">{label}</p>
              <p className="text-slate-400 text-xs">{sub}</p>
            </div>
          )
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1 w-fit">
        {([
          { key: 'all',      label: 'All Clients',    count: data.length },
          { key: 'today',    label: 'Active Today',   count: activeToday },
          { key: 'inactive', label: 'Not Today',      count: data.length - activeToday },
        ] as const).map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              filter === tab.key
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
            <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
              filter === tab.key ? 'bg-slate-100 text-slate-600' : 'bg-slate-200/50 text-slate-400'
            }`}>
              {loading ? '…' : tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                {['Client', 'Status', 'Today', 'This Week', 'Last Login', 'Last User', 'Detail'].map(h => (
                  <th key={h} className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
                : filtered.map((t, idx) => {
                    const ll    = t.last_login;
                    const online = ll && isOnline(ll.created_at);
                    const today  = ll && isToday(ll.created_at);

                    return (
                      <tr
                        key={t.tenant_id}
                        className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors"
                      >
                        {/* Client */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="relative flex-shrink-0">
                              <div className={`w-9 h-9 bg-gradient-to-br ${avatarGradients[idx % avatarGradients.length]} rounded-xl flex items-center justify-center text-sm font-bold text-white shadow-sm`}>
                                {t.display_name.charAt(0).toUpperCase()}
                              </div>
                              {online && (
                                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 border-2 border-white rounded-full" />
                              )}
                            </div>
                            <div>
                              <p className="font-semibold text-slate-800 leading-tight">{t.display_name}</p>
                              <p className="text-slate-400 text-xs font-mono">{t.tenant_code}</p>
                            </div>
                          </div>
                        </td>

                        {/* Account status */}
                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${
                            t.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${t.is_active ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                            {t.is_active ? 'Active' : 'Suspended'}
                          </span>
                        </td>

                        {/* Today logins */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <span className={`text-lg font-bold ${
                              t.today_logins > 0 ? 'text-slate-800' : 'text-slate-300'
                            }`}>
                              {t.today_logins}
                            </span>
                            {t.today_logins > 0 && (
                              <span className="text-xs bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded-lg font-medium">
                                logins
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Week logins */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-1.5">
                            <TrendingUp size={13} className={t.week_logins > 0 ? 'text-emerald-500' : 'text-slate-200'} />
                            <span className={`font-semibold ${t.week_logins > 0 ? 'text-slate-700' : 'text-slate-300'}`}>
                              {t.week_logins}
                            </span>
                          </div>
                        </td>

                        {/* Last login time */}
                        <td className="px-5 py-4">
                          {ll ? (
                            <div>
                              <div className="flex items-center gap-1.5">
                                {online && <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse flex-shrink-0" />}
                                <span className={`font-medium text-xs ${
                                  online ? 'text-emerald-600' : today ? 'text-emerald-600' : 'text-slate-500'
                                }`}>
                                  {online ? 'Online now' : timeAgo(ll.created_at)}
                                </span>
                              </div>
                              <p className="text-slate-400 text-xs mt-0.5">
                                {new Date(ll.created_at).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                          ) : (
                            <span className="text-slate-300 text-xs">Never logged in</span>
                          )}
                        </td>

                        {/* Last user */}
                        <td className="px-5 py-4">
                          {ll ? (
                            <div>
                              <p className="text-slate-700 font-medium text-xs">{ll.user_name || '—'}</p>
                              <p className="text-slate-400 text-xs font-mono mt-0.5">{ll.ip_address || '—'}</p>
                            </div>
                          ) : (
                            <span className="text-slate-300 text-xs">—</span>
                          )}
                        </td>

                        {/* Detail button */}
                        <td className="px-5 py-4">
                          <button
                            onClick={() => setSelected(t)}
                            className="flex items-center gap-1 text-xs text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 px-2.5 py-1.5 rounded-lg transition font-medium"
                          >
                            View <ChevronRight size={13} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
              }

              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-14 text-center">
                    <Calendar size={32} className="text-slate-200 mx-auto mb-3" />
                    <p className="text-slate-400 font-medium">No clients match this filter</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <ActivityDetailModal
          tenantId={selected.tenant_id}
          tenantName={selected.display_name}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
