import { useEffect, useState } from 'react';
import { TrendingUp, Users, DollarSign, Calendar, TrendingDown, BarChart2 } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, Legend
} from 'recharts';
import api from '../api/axios';

interface MonthData { month: string; mrr: number; new_clients: number; }
interface ClientRow {
  tenant_id: number; display_name: string; tenant_code: string;
  is_active: number; modules: string[]; monthly_price: number; joined_at: string;
}
interface ModuleBreakdownRow { module: string; clients: number; revenue: number; }
interface RevenueData {
  current_mrr: number; annual_projection: number;
  active_clients: number; total_clients: number; avg_per_client: number;
  churn_rate: number;
  module_breakdown: ModuleBreakdownRow[];
  monthly_chart: MonthData[];
  client_breakdown: ClientRow[];
}

const avatarGradients = [
  'from-emerald-500 to-teal-600',
  'from-blue-500 to-indigo-600',
  'from-purple-500 to-violet-600',
  'from-orange-500 to-rose-500',
  'from-cyan-500 to-blue-600',
  'from-amber-500 to-orange-600',
];

const MODULE_STYLES: Record<string, { bg: string; text: string; label: string; pie?: string }> = {
  sales:     { bg: 'bg-blue-50',    text: 'text-blue-600',    label: 'Sales',     pie: '#3b82f6' },
  inventory: { bg: 'bg-emerald-50', text: 'text-emerald-600', label: 'Inventory', pie: '#10b981' },
  accounts:  { bg: 'bg-purple-50',  text: 'text-purple-600',  label: 'Accounts',  pie: '#8b5cf6' },
  hr:        { bg: 'bg-orange-50',  text: 'text-orange-600',  label: 'HR',        pie: '#f97316' },
};

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 animate-pulse">
      <div className="w-10 h-10 bg-slate-100 rounded-xl mb-3" />
      <div className="w-24 h-7 bg-slate-100 rounded mb-1" />
      <div className="w-32 h-4 bg-slate-100 rounded" />
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-lg text-sm">
      <p className="font-semibold text-slate-700 mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }} className="font-medium">
          {p.name === 'mrr' ? `MRR: Rs. ${Number(p.value).toLocaleString()}` : `New Clients: ${p.value}`}
        </p>
      ))}
    </div>
  );
};

export default function Revenue() {
  const [data, setData]       = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]         = useState<'mrr' | 'clients'>('mrr');

  useEffect(() => {
    api.get('/tenants/revenue')
      .then(r => setData(r.data))
      .catch(() => { setData(null); })
      .finally(() => setLoading(false));
  }, []);

  const statCards = data ? [
    {
      label: 'Monthly Revenue',
      value: `Rs. ${data.current_mrr.toLocaleString()}`,
      sub:   'Current MRR',
      icon:  TrendingUp, bg: 'bg-emerald-50', color: 'text-emerald-600', gradient: true,
    },
    {
      label: 'Annual Projection',
      value: `Rs. ${data.annual_projection.toLocaleString()}`,
      sub:   'Based on current MRR',
      icon:  DollarSign, bg: 'bg-slate-100', color: 'text-slate-600', gradient: false,
    },
    {
      label: 'Active Clients',
      value: `${data.active_clients} / ${data.total_clients}`,
      sub:   'Active / Total',
      icon:  Users, bg: 'bg-slate-100', color: 'text-slate-600', gradient: false,
    },
    {
      label: 'Avg per Client',
      value: `Rs. ${data.avg_per_client.toLocaleString()}`,
      sub:   'Per active client',
      icon:  Calendar, bg: 'bg-slate-100', color: 'text-slate-600', gradient: false,
    },
    {
      label: 'Churn Rate',
      value: `${data.churn_rate}%`,
      sub:   'Inactive / Total clients',
      icon:  TrendingDown,
      bg:    data.churn_rate > 20 ? 'bg-red-50' : data.churn_rate > 10 ? 'bg-amber-50' : 'bg-green-50',
      color: data.churn_rate > 20 ? 'text-red-500' : data.churn_rate > 10 ? 'text-amber-600' : 'text-emerald-600',
      gradient: false,
    },
  ] : [];

  return (
    <div className="p-6 max-w-6xl space-y-5">

      {/* Header */}
      <div className="relative bg-white border border-slate-100 rounded-2xl px-6 py-4 shadow-sm overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-50/60 via-transparent to-transparent pointer-events-none" />
        <div className="absolute -top-6 -left-6 w-28 h-28 bg-emerald-400/8 rounded-full blur-3xl pointer-events-none" />
        <div className="relative flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Revenue</h2>
            <p className="text-slate-400 text-sm mt-0.5">
              {loading ? '...' : (
                <>Monthly recurring revenue &amp; client breakdown</>
              )}
            </p>
          </div>
          {!loading && data && (
            <div className="hidden sm:flex flex-col items-end gap-1">
              <span className="text-2xl font-black text-slate-800">Rs. {data.current_mrr.toLocaleString()}</span>
              <p className="text-xs text-slate-400 font-medium">Current MRR</p>
            </div>
          )}
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        {loading
          ? [...Array(5)].map((_, i) => <SkeletonCard key={i} />)
          : statCards.map(({ label, value, sub, icon: Icon, bg, color, gradient }) => (
              gradient ? (
                <div key={label} className="relative bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-5 overflow-hidden shadow-lg shadow-emerald-200 group hover:-translate-y-0.5 transition-transform duration-200">
                  <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-white/10 rounded-full blur-2xl pointer-events-none" />
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                    <Icon size={18} className="text-white" />
                  </div>
                  <p className="text-2xl font-bold text-white mb-0.5">{value}</p>
                  <p className="text-emerald-100 text-sm">{label}</p>
                  <p className="text-emerald-200/70 text-xs mt-0.5">{sub}</p>
                </div>
              ) : (
                <div key={label} className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-md transition-shadow duration-200 group">
                  <div className={`w-10 h-10 ${bg} rounded-xl flex items-center justify-center mb-3 group-hover:scale-105 transition-transform`}>
                    <Icon size={18} className={color} />
                  </div>
                  <p className="text-2xl font-bold text-slate-800 mb-0.5">{value}</p>
                  <p className="text-slate-500 text-sm">{label}</p>
                  <p className="text-slate-400 text-xs mt-0.5">{sub}</p>
                </div>
              )
            ))
        }
      </div>

      {/* Chart */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-sm font-semibold text-slate-700">Growth — Last 12 Months</h3>
            <p className="text-xs text-slate-400 mt-0.5">MRR growth as clients joined</p>
          </div>
          <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
            {(['mrr', 'clients'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${
                  tab === t ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {t === 'mrr' ? 'Revenue' : 'New Clients'}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="h-56 bg-slate-50 rounded-xl animate-pulse" />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            {tab === 'mrr' ? (
              <AreaChart data={data?.monthly_chart} margin={{ top: 5, right: 5, bottom: 0, left: 10 }}>
                <defs>
                  <linearGradient id="mrrGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#10b981" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false}
                  tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="mrr" stroke="#10b981" strokeWidth={2.5}
                  fill="url(#mrrGrad)" dot={false} activeDot={{ r: 5, fill: '#10b981' }} />
              </AreaChart>
            ) : (
              <BarChart data={data?.monthly_chart} margin={{ top: 5, right: 5, bottom: 0, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="new_clients" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            )}
          </ResponsiveContainer>
        )}
      </div>

      {/* Module Revenue Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Pie Chart */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 bg-blue-100 rounded-lg flex items-center justify-center">
              <BarChart2 size={14} className="text-blue-600" />
            </div>
            <h3 className="text-sm font-bold text-slate-700">Module Revenue Mix</h3>
          </div>
          {loading ? (
            <div className="h-52 bg-slate-50 rounded-xl animate-pulse" />
          ) : (
            <ResponsiveContainer width="100%" height={210}>
              <PieChart>
                <Pie
                  data={(data?.module_breakdown || []).filter(m => m.revenue > 0).map(m => ({
                    name: MODULE_STYLES[m.module]?.label || m.module,
                    value: m.revenue,
                    fill: MODULE_STYLES[m.module]?.pie || '#94a3b8',
                  }))}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {(data?.module_breakdown || []).filter(m => m.revenue > 0).map((m, i) => (
                    <Cell key={i} fill={MODULE_STYLES[m.module]?.pie || '#94a3b8'} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => [`Rs. ${Number(v).toLocaleString()}`, 'Revenue']} />
                <Legend iconType="circle" iconSize={8} formatter={(v) => <span className="text-xs text-slate-600">{v}</span>} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Module table */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-700">Module Breakdown</h3>
            <p className="text-xs text-slate-400 mt-0.5">Revenue contribution per module</p>
          </div>
          <div className="divide-y divide-slate-50">
            {loading ? (
              [...Array(4)].map((_, i) => (
                <div key={i} className="px-5 py-4 animate-pulse flex justify-between">
                  <div className="w-24 h-4 bg-slate-100 rounded" />
                  <div className="w-20 h-4 bg-slate-100 rounded" />
                </div>
              ))
            ) : (
              (data?.module_breakdown || []).map(m => {
                const s = MODULE_STYLES[m.module] || { bg: 'bg-slate-50', text: 'text-slate-600', label: m.module };
                const totalMrr = data?.current_mrr || 1;
                const pct = totalMrr > 0 ? Math.round((m.revenue / totalMrr) * 100) : 0;
                return (
                  <div key={m.module} className="px-5 py-4 flex items-center gap-3">
                    <span className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-bold ${s.bg} ${s.text} w-24 justify-center`}>
                      {s.label}
                    </span>
                    <div className="flex-1">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-500">{m.clients} client{m.clients !== 1 ? 's' : ''}</span>
                        <span className="font-semibold text-slate-700">Rs. {m.revenue.toLocaleString()}</span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%`, backgroundColor: s.pie || '#94a3b8' }}
                        />
                      </div>
                    </div>
                    <span className="text-xs font-bold text-slate-400 w-8 text-right">{pct}%</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Client Breakdown */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <div className="w-7 h-7 bg-emerald-100 rounded-lg flex items-center justify-center">
            <TrendingUp size={14} className="text-emerald-600" />
          </div>
          <h3 className="text-sm font-bold text-slate-700">Per-Client Revenue</h3>
        </div>
        {loading ? (
          <div className="p-5 space-y-3 animate-pulse">
            {[...Array(3)].map((_, i) => <div key={i} className="h-14 bg-slate-100 rounded-xl" />)}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  {['Client', 'Modules', 'Monthly', 'Annual', 'Status', 'Joined'].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(data?.client_breakdown || [])
                  .sort((a, b) => b.monthly_price - a.monthly_price)
                  .map((c, idx) => (
                    <tr key={c.tenant_id} className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 bg-gradient-to-br ${avatarGradients[idx % avatarGradients.length]} rounded-xl flex items-center justify-center text-xs font-bold text-white flex-shrink-0 shadow-sm`}>
                            {c.display_name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-800">{c.display_name}</p>
                            <p className="text-slate-400 text-xs font-mono">{c.tenant_code}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex flex-wrap gap-1">
                          {c.modules.map(m => {
                            const s = MODULE_STYLES[m] || { bg: 'bg-slate-50', text: 'text-slate-500', label: m };
                            return <span key={m} className={`px-2 py-0.5 rounded-lg text-xs font-medium ${s.bg} ${s.text}`}>{s.label}</span>;
                          })}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 font-semibold text-slate-700">
                        Rs. {c.monthly_price.toLocaleString()}
                      </td>
                      <td className="px-5 py-3.5 text-slate-500">
                        Rs. {(c.monthly_price * 12).toLocaleString()}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                          c.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${c.is_active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                          {c.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-slate-400 text-xs">
                        {new Date(c.joined_at).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                    </tr>
                  ))
                }
              </tbody>
              {data && (
                <tfoot>
                  <tr className="bg-slate-50 border-t-2 border-slate-200">
                    <td className="px-5 py-3 font-bold text-slate-700">Total (Active)</td>
                    <td className="px-5 py-3" />
                    <td className="px-5 py-3 font-bold text-emerald-600">
                      Rs. {data.current_mrr.toLocaleString()}
                    </td>
                    <td className="px-5 py-3 font-bold text-slate-700">
                      Rs. {data.annual_projection.toLocaleString()}
                    </td>
                    <td className="px-5 py-3" /><td className="px-5 py-3" />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
