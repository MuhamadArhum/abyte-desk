import { useEffect, useState } from 'react';
import { Megaphone, Plus, Trash2, Edit2, X, Loader2, CheckCircle, AlertTriangle, Wrench, Info, Radio, Clock, Eye, Users } from 'lucide-react';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';

type AnnouncementType = 'info' | 'warning' | 'maintenance' | 'success';

interface Announcement {
  id: number; title: string; message: string; type: AnnouncementType;
  is_active: number; starts_at: string | null; ends_at: string | null; created_at: string;
  view_count?: number;
}

interface ViewEntry {
  tenant_id: number;
  tenant_name: string;
  viewed_at: string;
}

const TYPE_CONFIG = {
  info:        { label: 'Info',        icon: Info,          gradient: 'from-blue-500 to-indigo-600',    soft: 'bg-blue-50 border-blue-200',    text: 'text-blue-700',    iconBg: 'bg-blue-100',    iconColor: 'text-blue-600',    badge: 'bg-blue-100 text-blue-700',    glow: 'shadow-blue-100' },
  warning:     { label: 'Warning',     icon: AlertTriangle, gradient: 'from-amber-500 to-orange-500',   soft: 'bg-amber-50 border-amber-200',   text: 'text-amber-700',   iconBg: 'bg-amber-100',   iconColor: 'text-amber-600',   badge: 'bg-amber-100 text-amber-700',   glow: 'shadow-amber-100' },
  maintenance: { label: 'Maintenance', icon: Wrench,        gradient: 'from-orange-500 to-red-500',     soft: 'bg-orange-50 border-orange-200', text: 'text-orange-700',  iconBg: 'bg-orange-100',  iconColor: 'text-orange-600',  badge: 'bg-orange-100 text-orange-700', glow: 'shadow-orange-100' },
  success:     { label: 'Success',     icon: CheckCircle,   gradient: 'from-emerald-500 to-teal-600',   soft: 'bg-emerald-50 border-emerald-200',text: 'text-emerald-700', iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600', badge: 'bg-emerald-100 text-emerald-700',glow: 'shadow-emerald-100' },
};

const empty = { title: '', message: '', type: 'info' as AnnouncementType, starts_at: '', ends_at: '' };

// ─── Who Viewed Modal ─────────────────────────────────────────────────────────
function ViewsModal({ announcement, onClose }: { announcement: Announcement; onClose: () => void }) {
  const [views, setViews]   = useState<ViewEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/announcements/${announcement.id}/views`)
      .then(r => setViews(r.data.data || r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [announcement.id]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center">
              <Users size={15} className="text-indigo-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">Who Viewed</h2>
              <p className="text-xs text-slate-400 truncate max-w-[220px]">{announcement.title}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
            <X size={16} />
          </button>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {loading ? (
            <div className="py-10 flex items-center justify-center">
              <Loader2 size={22} className="animate-spin text-indigo-400" />
            </div>
          ) : views.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <Eye size={28} className="mx-auto mb-2 text-slate-200" />
              <p className="text-sm font-medium">No views yet</p>
            </div>
          ) : (
            views.map((v, i) => (
              <div key={i} className="flex items-center gap-3 px-5 py-3 border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-[11px] font-bold text-indigo-700 flex-shrink-0">
                  {(v.tenant_name || '?')[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-700 truncate">{v.tenant_name}</p>
                  <p className="text-[11px] text-slate-400">
                    {new Date(v.viewed_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
        {!loading && views.length > 0 && (
          <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/60">
            <p className="text-xs text-slate-400 font-medium">{views.length} client{views.length !== 1 ? 's' : ''} viewed this announcement</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Announcements() {
  const { toast } = useToast();
  const [items, setItems]       = useState<Announcement[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing]   = useState<Announcement | null>(null);
  const [form, setForm]         = useState({ ...empty });
  const [saving, setSaving]     = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [viewingAnn, setViewingAnn] = useState<Announcement | null>(null);

  const load = () => {
    setLoading(true);
    api.get('/announcements').then(r => setItems(r.data.data || [])).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setForm({ ...empty }); setShowForm(true); };
  const openEdit   = (a: Announcement) => {
    setEditing(a);
    setForm({ title: a.title, message: a.message, type: a.type, starts_at: a.starts_at ? a.starts_at.slice(0, 16) : '', ends_at: a.ends_at ? a.ends_at.slice(0, 16) : '' });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, starts_at: form.starts_at || null, ends_at: form.ends_at || null };
      if (editing) { await api.put(`/announcements/${editing.id}`, { ...payload, is_active: editing.is_active }); toast('success', 'Announcement updated'); }
      else          { await api.post('/announcements', payload); toast('success', 'Announcement created & broadcasted!'); }
      setShowForm(false); load();
    } catch { toast('error', 'Failed to save announcement'); }
    finally { setSaving(false); }
  };

  const toggleActive = async (a: Announcement) => {
    try {
      await api.put(`/announcements/${a.id}`, { ...a, is_active: a.is_active ? 0 : 1 });
      toast('success', a.is_active ? 'Announcement deactivated' : 'Announcement is now live!');
      load();
    } catch { toast('error', 'Failed to update'); }
  };

  const handleDelete = async (id: number) => {
    setDeleting(id);
    try { await api.delete(`/announcements/${id}`); toast('success', 'Deleted'); load(); }
    catch { toast('error', 'Failed to delete'); }
    finally { setDeleting(null); }
  };

  const activeCount   = items.filter(a => a.is_active).length;
  const inputCls = 'w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-400 transition bg-white';

  return (
    <div className="p-6 max-w-4xl space-y-5">

      {/* Hero Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl px-8 py-7 shadow-xl">
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'radial-gradient(circle, #10b981 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-blue-500/8 rounded-full blur-2xl" />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-500/20 border border-emerald-500/30 rounded-2xl flex items-center justify-center">
              <Megaphone size={22} className="text-emerald-400" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white">Announcements</h2>
              <p className="text-slate-400 text-sm mt-0.5">Broadcast messages directly inside the client app</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {activeCount > 0 && (
              <div className="hidden sm:flex items-center gap-2 px-3 py-2 bg-emerald-500/15 border border-emerald-500/25 rounded-xl">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-emerald-400 text-xs font-bold">{activeCount} Live</span>
              </div>
            )}
            <button
              onClick={openCreate}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-bold rounded-xl shadow-lg shadow-emerald-500/30 transition"
            >
              <Plus size={16} /> New Announcement
            </button>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total',    value: items.length,                      color: 'text-slate-700',    bg: 'bg-white' },
          { label: 'Live Now', value: activeCount,                        color: 'text-emerald-600',  bg: 'bg-emerald-50 border-emerald-100' },
          { label: 'Inactive', value: items.length - activeCount,         color: 'text-slate-400',    bg: 'bg-white' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-2xl border border-slate-100 px-5 py-4 shadow-sm text-center`}>
            <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
            <p className="text-xs text-slate-400 font-medium mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Create/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            {/* Modal header with gradient */}
            <div className={`bg-gradient-to-r ${TYPE_CONFIG[form.type].gradient} px-6 py-5`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">
                    {(() => { const Icon = TYPE_CONFIG[form.type].icon; return <Icon size={18} className="text-white" />; })()}
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-sm">{editing ? 'Edit Announcement' : 'New Announcement'}</h3>
                    <p className="text-white/70 text-xs">Will appear as a banner in all client apps</p>
                  </div>
                </div>
                <button onClick={() => setShowForm(false)} className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg transition">
                  <X size={15} className="text-white" />
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Type selector */}
              <div className="grid grid-cols-4 gap-2">
                {(Object.keys(TYPE_CONFIG) as AnnouncementType[]).map(t => {
                  const cfg = TYPE_CONFIG[t];
                  const Icon = cfg.icon;
                  const selected = form.type === t;
                  return (
                    <button key={t} type="button" onClick={() => setForm(f => ({ ...f, type: t }))}
                      className={`relative flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 text-xs font-bold transition-all ${
                        selected ? `bg-gradient-to-br ${cfg.gradient} border-transparent text-white shadow-lg ${cfg.glow}` : 'border-slate-100 text-slate-400 hover:border-slate-200 hover:bg-slate-50'
                      }`}>
                      <Icon size={15} />
                      {cfg.label}
                    </button>
                  );
                })}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Title</label>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className={inputCls} placeholder="e.g. Scheduled Maintenance Tonight" required />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Message</label>
                <textarea rows={3} value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} className={`${inputCls} resize-none`} placeholder="Describe what clients need to know..." required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Starts (optional)</label>
                  <input type="datetime-local" value={form.starts_at} onChange={e => setForm(f => ({ ...f, starts_at: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Ends (optional)</label>
                  <input type="datetime-local" value={form.ends_at} onChange={e => setForm(f => ({ ...f, ends_at: e.target.value }))} className={inputCls} />
                </div>
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2.5 border border-slate-200 text-slate-600 text-sm font-semibold rounded-xl hover:bg-slate-50 transition">Cancel</button>
                <button type="submit" disabled={saving} className={`flex-1 flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r ${TYPE_CONFIG[form.type].gradient} text-white text-sm font-bold rounded-xl disabled:opacity-50 transition shadow-lg`}>
                  {saving ? <Loader2 size={15} className="animate-spin" /> : <Radio size={15} />}
                  {saving ? 'Broadcasting...' : editing ? 'Update' : 'Broadcast'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* List */}
      <div className="space-y-3">
        {loading ? (
          [...Array(3)].map((_, i) => <div key={i} className="h-28 bg-slate-100 rounded-2xl animate-pulse" />)
        ) : items.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 py-20 text-center shadow-sm">
            <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Megaphone size={28} className="text-slate-300" />
            </div>
            <p className="text-slate-600 font-bold">No announcements yet</p>
            <p className="text-slate-400 text-sm mt-1">Create one — it'll appear instantly in all client apps</p>
            <button onClick={openCreate} className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold rounded-xl transition shadow-md shadow-emerald-200">
              <Plus size={15} /> Create First Announcement
            </button>
          </div>
        ) : items.map(a => {
          const cfg = TYPE_CONFIG[a.type] || TYPE_CONFIG.info;
          const Icon = cfg.icon;
          return (
            <div key={a.id} className={`bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden transition-all ${!a.is_active ? 'opacity-55' : 'hover:shadow-md'}`}>
              {/* Colored left accent bar */}
              <div className={`flex items-stretch`}>
                <div className={`w-1.5 bg-gradient-to-b ${cfg.gradient} flex-shrink-0`} />
                <div className="flex items-start gap-4 p-5 flex-1 min-w-0">
                  <div className={`w-11 h-11 ${cfg.iconBg} rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm`}>
                    <Icon size={20} className={cfg.iconColor} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <h3 className="font-bold text-slate-800">{a.title}</h3>
                      <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${cfg.badge}`}>{cfg.label}</span>
                      <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full ${a.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${a.is_active ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                        {a.is_active ? 'Live' : 'Inactive'}
                      </span>
                      {(a.view_count ?? 0) > 0 && (
                        <button
                          onClick={() => setViewingAnn(a)}
                          className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors"
                        >
                          <Eye size={10} />
                          {a.view_count} view{a.view_count !== 1 ? 's' : ''}
                        </button>
                      )}
                    </div>
                    <p className="text-sm text-slate-500 leading-relaxed">{a.message}</p>
                    {(a.starts_at || a.ends_at) && (
                      <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-400">
                        <Clock size={11} />
                        {a.starts_at && <span>From {new Date(a.starts_at).toLocaleString('en-PK', { dateStyle: 'medium', timeStyle: 'short' })}</span>}
                        {a.starts_at && a.ends_at && <span>·</span>}
                        {a.ends_at && <span>Until {new Date(a.ends_at).toLocaleString('en-PK', { dateStyle: 'medium', timeStyle: 'short' })}</span>}
                      </div>
                    )}
                    <p className="text-[11px] text-slate-300 mt-1.5">Created {new Date(a.created_at).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => toggleActive(a)} className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${a.is_active ? 'bg-slate-100 text-slate-500 hover:bg-slate-200' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'}`}>
                      {a.is_active ? 'Pause' : 'Go Live'}
                    </button>
                    <button onClick={() => setViewingAnn(a)} title="Who viewed" className="p-2 hover:bg-indigo-50 rounded-lg text-slate-400 hover:text-indigo-600 transition">
                      <Eye size={14} />
                    </button>
                    <button onClick={() => openEdit(a)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700 transition">
                      <Edit2 size={14} />
                    </button>
                    <button onClick={() => handleDelete(a.id)} disabled={deleting === a.id} className="p-2 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-500 transition disabled:opacity-50">
                      {deleting === a.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {viewingAnn && <ViewsModal announcement={viewingAnn} onClose={() => setViewingAnn(null)} />}
    </div>
  );
}
