import { useEffect, useState } from 'react';
import { X, Clock, TrendingUp, User, Globe, Calendar, LogIn } from 'lucide-react';
import api from '../api/axios';

interface LogEntry {
  log_id:     number;
  user_name:  string;
  ip_address: string;
  created_at: string;
}

interface DayEntry {
  day: string;
  cnt: number;
}

interface Detail {
  today_logins: number;
  week_logins:  number;
  daily_chart:  DayEntry[];
  logs:         LogEntry[];
}

interface Props {
  tenantId:   number;
  tenantName: string;
  onClose:    () => void;
}

function timeAgo(dateStr: string): string {
  const diff  = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins  < 1)  return 'Just now';
  if (mins  < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days  === 1)return 'Yesterday';
  return `${days}d ago`;
}

function isToday(dateStr: string) {
  return new Date(dateStr).toDateString() === new Date().toDateString();
}

function formatDay(dayStr: string): string {
  const d = new Date(dayStr);
  const today = new Date();
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString())     return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-PK', { weekday: 'short', day: '2-digit', month: 'short' });
}

export default function ActivityDetailModal({ tenantId, tenantName, onClose }: Props) {
  const [data, setData]       = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/tenants/${tenantId}/activity`)
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [tenantId]);

  const maxCount = data ? Math.max(...data.daily_chart.map(d => Number(d.cnt)), 1) : 1;

  // Fill last 7 days even if no data for some days
  const last7: DayEntry[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split('T')[0];
    const found = data?.daily_chart.find(x => x.day === key || x.day?.startsWith(key));
    last7.push({ day: key, cnt: found ? Number(found.cnt) : 0 });
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-2xl sm:rounded-3xl rounded-t-3xl shadow-2xl border border-slate-200 flex flex-col max-h-[92vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-sm">
              {tenantName.charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 className="font-bold text-slate-800">{tenantName}</h3>
              <p className="text-xs text-slate-500">Login activity — last 7 days</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 transition">
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
            </div>
          ) : data ? (
            <div className="p-6 space-y-6">

              {/* Summary stats */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Today',     value: data.today_logins, icon: Clock,       color: 'text-blue-600',   bg: 'bg-blue-50' },
                  { label: 'This Week', value: data.week_logins,  icon: TrendingUp,  color: 'text-purple-600', bg: 'bg-purple-50' },
                  { label: 'All Time',  value: (data as any).total_logins || data.logs.length, icon: LogIn, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                ].map(({ label, value, icon: Icon, color, bg }) => (
                  <div key={label} className="bg-slate-50 rounded-2xl p-4 text-center">
                    <div className={`w-8 h-8 ${bg} rounded-xl flex items-center justify-center mx-auto mb-2`}>
                      <Icon size={15} className={color} />
                    </div>
                    <p className="text-2xl font-bold text-slate-800">{value}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{label}</p>
                  </div>
                ))}
              </div>

              {/* 7-day bar chart */}
              <div>
                <p className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                  <Calendar size={15} className="text-slate-400" />
                  Daily Login Count
                </p>
                <div className="flex items-end gap-2 h-28 bg-slate-50 rounded-2xl px-4 pt-3 pb-0">
                  {last7.map(({ day, cnt }) => (
                    <div key={day} className="flex-1 flex flex-col items-center justify-end gap-1 h-full">
                      <span className="text-xs font-bold text-slate-600">
                        {cnt > 0 ? cnt : ''}
                      </span>
                      <div
                        className={`w-full rounded-t-lg transition-all duration-500 ${
                          cnt > 0 ? 'bg-emerald-500' : 'bg-slate-200'
                        }`}
                        style={{ height: cnt > 0 ? `${Math.max((cnt / maxCount) * 70, 8)}%` : '8%' }}
                        title={`${formatDay(day)}: ${cnt} login${cnt !== 1 ? 's' : ''}`}
                      />
                      <span className="text-[10px] text-slate-400 pb-2 whitespace-nowrap">
                        {formatDay(day) === 'Today' ? 'Today' : formatDay(day).split(' ')[0]}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Login log */}
              <div>
                <p className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                  <LogIn size={15} className="text-slate-400" />
                  Recent Logins
                  <span className="text-xs text-slate-400 font-normal">({data.logs.length} records)</span>
                </p>

                {data.logs.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 text-sm bg-slate-50 rounded-2xl">
                    No login records found
                  </div>
                ) : (
                  <div className="space-y-2">
                    {data.logs.slice(0, 30).map((log, i) => {
                      const today = isToday(log.created_at);
                      return (
                        <div
                          key={log.log_id || i}
                          className={`flex items-center gap-4 px-4 py-3 rounded-xl border ${
                            today
                              ? 'bg-emerald-50/50 border-emerald-100'
                              : 'bg-slate-50 border-slate-100'
                          }`}
                        >
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
                            today ? 'bg-emerald-100' : 'bg-slate-100'
                          }`}>
                            <User size={14} className={today ? 'text-emerald-600' : 'text-slate-500'} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-slate-800 font-semibold text-sm truncate">
                              {log.user_name || 'Unknown'}
                              {today && (
                                <span className="ml-2 text-[10px] bg-emerald-100 text-emerald-600 px-1.5 py-0.5 rounded-full font-medium">
                                  Today
                                </span>
                              )}
                            </p>
                            <div className="flex items-center gap-3 mt-0.5">
                              <span className="text-slate-400 text-xs flex items-center gap-1">
                                <Globe size={10} />
                                {log.ip_address || '—'}
                              </span>
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-slate-500 text-xs font-medium">{timeAgo(log.created_at)}</p>
                            <p className="text-slate-400 text-[10px] mt-0.5">
                              {new Date(log.created_at).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                    {data.logs.length > 30 && (
                      <p className="text-center text-xs text-slate-400 pt-1">
                        Showing 30 of {data.logs.length} records
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="py-20 text-center text-slate-400">Failed to load activity data</div>
          )}
        </div>
      </div>
    </div>
  );
}
