import { useEffect, useState, useCallback } from 'react';
import { ClipboardList, Search, RefreshCw, ChevronLeft, ChevronRight, Shield } from 'lucide-react';
import api from '../api/axios';

interface AuditEntry {
  log_id: number;
  admin_name: string;
  admin_email: string;
  action: string;
  target_type: string | null;
  target_id: number | null;
  target_name: string | null;
  details: string | null;
  ip_address: string | null;
  created_at: string;
}

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 1)   return 'just now';
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7)   return `${days}d ago`;
  return new Date(d).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
}

function actionBadge(action: string) {
  const a = action.toLowerCase();
  if (a.includes('create') || a.includes('add'))        return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
  if (a.includes('delete') || a.includes('remove'))     return 'bg-red-50 text-red-700 border border-red-200';
  if (a.includes('update') || a.includes('change'))     return 'bg-amber-50 text-amber-700 border border-amber-200';
  if (a.includes('reset') || a.includes('password'))    return 'bg-slate-100 text-slate-600 border border-slate-200';
  if (a.includes('login') || a.includes('logout'))      return 'bg-slate-100 text-slate-600 border border-slate-200';
  return 'bg-slate-50 text-slate-600 border border-slate-200';
}

function formatAction(action: string) {
  return action.replace(/_/g, ' ');
}

export default function AuditLog() {
  const [logs, setLogs]       = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [from, setFrom]       = useState('');
  const [to, setTo]           = useState('');
  const [page, setPage]       = useState(1);
  const [total, setTotal]     = useState(0);
  const [pages, setPages]     = useState(1);

  const load = useCallback(() => {
    setLoading(true);
    const params: Record<string, string> = { page: String(page) };
    if (search) params.action = search;
    if (from)   params.from   = from;
    if (to)     params.to     = to;

    api.get('/audit', { params })
      .then(r => {
        setLogs(r.data.data || []);
        setTotal(r.data.total || 0);
        setPages(r.data.pages || 1);
      })
      .finally(() => setLoading(false));
  }, [search, from, to, page]);

  useEffect(() => { load(); }, [load]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    load();
  };

  const clearFilters = () => {
    setSearch('');
    setFrom('');
    setTo('');
    setPage(1);
  };

  return (
    <div className="p-6 max-w-7xl space-y-5">
      {/* Page Header */}
      <div className="relative bg-white border border-slate-100 rounded-2xl px-6 py-4 shadow-sm overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-50/60 via-transparent to-transparent pointer-events-none" />
        <div className="absolute -top-6 -left-6 w-28 h-28 bg-emerald-400/8 rounded-full blur-3xl pointer-events-none" />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-emerald-100 rounded-xl flex items-center justify-center shadow-sm">
              <ClipboardList size={18} className="text-emerald-600" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-800">Audit Log</h1>
              <p className="text-xs text-slate-400 font-medium">Track all super admin actions</p>
            </div>
          </div>
          <button
            onClick={load}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 border border-slate-200 rounded-xl transition-all"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <form onSubmit={handleSearch} className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Search Action</label>
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="e.g. CREATE_TENANT"
                className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">From Date</label>
            <input
              type="date"
              value={from}
              onChange={e => setFrom(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">To Date</label>
            <input
              type="date"
              value={to}
              onChange={e => setTo(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            Apply
          </button>
          {(search || from || to) && (
            <button
              type="button"
              onClick={clearFilters}
              className="px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-700 border border-slate-200 rounded-xl transition-colors"
            >
              Clear
            </button>
          )}
        </form>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-emerald-100 rounded-lg flex items-center justify-center">
              <Shield size={13} className="text-emerald-600" />
            </div>
            <span className="text-sm font-bold text-slate-700">Action History</span>
            <span className="text-xs text-slate-400 font-medium">({total} entries)</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60">
                <th className="text-left px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">#</th>
                <th className="text-left px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">Admin</th>
                <th className="text-left px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">Action</th>
                <th className="text-left px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">Target</th>
                <th className="text-left px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">Details</th>
                <th className="text-left px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">IP</th>
                <th className="text-left px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                [...Array(8)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {[40, 120, 120, 100, 120, 80, 80].map((w, j) => (
                      <td key={j} className="px-5 py-3.5">
                        <div className="h-4 bg-slate-100 rounded" style={{ width: w }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-400">
                    <ClipboardList size={32} className="mx-auto mb-2 text-slate-200" />
                    <p className="text-sm font-medium">No audit logs found</p>
                  </td>
                </tr>
              ) : (
                logs.map(log => (
                  <tr key={log.log_id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-5 py-3.5 text-slate-400 text-xs font-mono">#{log.log_id}</td>
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-slate-700 text-xs">{log.admin_name || 'System'}</p>
                      <p className="text-slate-400 text-[11px]">{log.admin_email}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex px-2 py-0.5 rounded-lg text-[11px] font-bold uppercase tracking-wide ${actionBadge(log.action)}`}>
                        {formatAction(log.action)}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      {log.target_type ? (
                        <div>
                          <p className="text-xs text-slate-500 capitalize">{log.target_type}</p>
                          {log.target_name && <p className="text-xs font-semibold text-slate-700">{log.target_name}</p>}
                        </div>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 max-w-[200px]">
                      {log.details ? (
                        <p className="text-xs text-slate-500 truncate" title={log.details}>
                          {log.details.length > 60 ? log.details.slice(0, 60) + '…' : log.details}
                        </p>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-xs font-mono text-slate-400">{log.ip_address || '—'}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="text-xs text-slate-500">{timeAgo(log.created_at)}</p>
                      <p className="text-[10px] text-slate-300">{new Date(log.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</p>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pages > 1 && (
          <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between">
            <p className="text-xs text-slate-400">Page {page} of {pages}</p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 text-slate-400 hover:text-slate-600 disabled:opacity-30 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => setPage(p => Math.min(pages, p + 1))}
                disabled={page === pages}
                className="p-1.5 text-slate-400 hover:text-slate-600 disabled:opacity-30 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
