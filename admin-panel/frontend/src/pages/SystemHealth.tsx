import React, { useEffect, useState, useCallback } from 'react';
import { Activity, Cpu, HardDrive, Database, Users, LifeBuoy, DollarSign, RefreshCw } from 'lucide-react';
import api from '../api/axios';

interface HealthData {
  cpu_percent: number;
  ram_percent: number;
  ram_used_gb: number;
  ram_total_gb: number;
  disk_percent: number;
  disk_used_gb: number;
  disk_total_gb: number;
  db_connections: number;
  active_tenants: number;
  open_tickets: number;
  unpaid_amount: number;
  uptime_hours: number;
}

function GaugeRing({ value, color, size = 80 }: { value: number; color: string; size?: number }) {
  const r = (size - 14) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (Math.min(value, 100) / 100) * circ;
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={7} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={7}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.6s ease' }}
      />
    </svg>
  );
}

function MetricGauge({ label, value, unit, color, icon: Icon, detail }: {
  label: string; value: number; unit: string; color: string; icon: React.ElementType; detail?: string;
}) {
  const gaugeColor = value > 85 ? '#ef4444' : value > 65 ? '#f59e0b' : color;
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col items-center gap-3">
      <div className="relative w-20 h-20">
        <GaugeRing value={value} color={gaugeColor} size={80} />
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <Icon size={14} className="text-slate-400 mb-0.5" />
          <span className="text-base font-black text-slate-800">{Math.round(value)}<span className="text-[10px] font-semibold text-slate-400">{unit}</span></span>
        </div>
      </div>
      <div className="text-center">
        <p className="text-xs font-bold text-slate-700">{label}</p>
        {detail && <p className="text-[11px] text-slate-400 mt-0.5">{detail}</p>}
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color, sub }: { label: string; value: string | number; icon: React.ElementType; color: string; sub?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
          <Icon size={18} />
        </div>
      </div>
      <p className="text-2xl font-black text-slate-800">{value}</p>
      <p className="text-xs font-semibold text-slate-500 mt-0.5">{label}</p>
      {sub && <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function SystemHealth() {
  const [data, setData]       = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetch = useCallback(() => {
    api.get('/system/health')
      .then(r => { setData(r.data); setLastUpdate(new Date()); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetch();
    const id = setInterval(fetch, 30000);
    return () => clearInterval(id);
  }, [fetch]);

  return (
    <div className="p-6 max-w-5xl space-y-5">
      {/* Header */}
      <div className="relative bg-white border border-slate-100 rounded-2xl px-6 py-4 shadow-sm overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-50/60 via-transparent to-transparent pointer-events-none" />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-emerald-100 rounded-xl flex items-center justify-center shadow-sm">
              <Activity size={18} className="text-emerald-600" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-800">System Health</h1>
              <p className="text-xs text-slate-400 font-medium">
                {lastUpdate ? `Last updated ${lastUpdate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : 'Loading...'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden sm:flex items-center gap-1.5 text-xs font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-full">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              Auto-refresh 30s
            </span>
            <button
              onClick={fetch}
              disabled={loading}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </div>

      {loading && !data ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-44 bg-slate-100 rounded-2xl animate-pulse" />)}
        </div>
      ) : data ? (
        <>
          {/* Resource Gauges */}
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3 px-1">Server Resources</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <MetricGauge
                label="CPU Load" value={data.cpu_percent} unit="%" color="#10b981"
                icon={Cpu} detail="1-min average"
              />
              <MetricGauge
                label="RAM Usage" value={data.ram_percent} unit="%" color="#6366f1"
                icon={Activity} detail={`${data.ram_used_gb}GB / ${data.ram_total_gb}GB`}
              />
              <MetricGauge
                label="Disk Usage" value={data.disk_percent} unit="%" color="#f59e0b"
                icon={HardDrive} detail={`${data.disk_used_gb}GB / ${data.disk_total_gb}GB`}
              />
            </div>
          </div>

          {/* App Stats */}
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3 px-1">Application Stats</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <StatCard
                label="DB Connections" value={data.db_connections}
                icon={Database} color="bg-indigo-100 text-indigo-600"
                sub="Active threads"
              />
              <StatCard
                label="Active Tenants" value={data.active_tenants}
                icon={Users} color="bg-emerald-100 text-emerald-600"
                sub="Subscribed clients"
              />
              <StatCard
                label="Open Tickets" value={data.open_tickets}
                icon={LifeBuoy} color="bg-amber-100 text-amber-600"
                sub="Pending support"
              />
              <StatCard
                label="Unpaid Revenue" value={`Rs. ${Number(data.unpaid_amount).toLocaleString()}`}
                icon={DollarSign} color="bg-rose-100 text-rose-600"
                sub="Outstanding invoices"
              />
            </div>
          </div>

          {/* Uptime */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-6 py-4 flex items-center gap-4">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse flex-shrink-0" />
            <p className="text-sm font-semibold text-slate-700">
              Server uptime: <span className="text-emerald-600 font-black">{data.uptime_hours >= 24
                ? `${Math.floor(data.uptime_hours / 24)}d ${Math.floor(data.uptime_hours % 24)}h`
                : `${Math.floor(data.uptime_hours)}h ${Math.round((data.uptime_hours % 1) * 60)}m`}
              </span>
            </p>
          </div>
        </>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm py-20 text-center">
          <Activity size={32} className="mx-auto mb-2 text-slate-200" />
          <p className="text-sm text-slate-400 font-medium">Failed to load system metrics</p>
        </div>
      )}
    </div>
  );
}
