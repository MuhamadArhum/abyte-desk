import { useEffect, useState } from 'react';
import { Megaphone, Plus, Trash2, Edit2, X, Loader2, CheckCircle, AlertTriangle, Wrench, Info } from 'lucide-react';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';

type AnnouncementType = 'info' | 'warning' | 'maintenance' | 'success';

interface Announcement {
  id: number;
  title: string;
  message: string;
  type: AnnouncementType;
  is_active: number;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
}

const TYPE_CONFIG = {
  info:        { label: 'Info',        icon: Info,          bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200',    iconColor: 'text-blue-500',    badge: 'bg-blue-100 text-blue-700' },
  warning:     { label: 'Warning',     icon: AlertTriangle, bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200',   iconColor: 'text-amber-500',   badge: 'bg-amber-100 text-amber-700' },
  maintenance: { label: 'Maintenance', icon: Wrench,        bg: 'bg-orange-50',  text: 'text-orange-700',  border: 'border-orange-200',  iconColor: 'text-orange-500',  badge: 'bg-orange-100 text-orange-700' },
  success:     { label: 'Success',     icon: CheckCircle,   bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', iconColor: 'text-emerald-500', badge: 'bg-emerald-100 text-emerald-700' },
};

const empty = { title: '', message: '', type: 'info' as AnnouncementType, starts_at: '', ends_at: '' };

export default function Announcements() {
  const { toast } = useToast();
  const [items, setItems]       = useState<Announcement[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing]   = useState<Announcement | null>(null);
  const [form, setForm]         = useState({ ...empty });
  const [saving, setSaving]     = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);

  const load = () => {
    setLoading(true);
    api.get('/announcements').then(r => setItems(r.data)).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setForm({ ...empty }); setShowForm(true); };
  const openEdit   = (a: Announcement) => {
    setEditing(a);
    setForm({
      title: a.title, message: a.message, type: a.type,
      starts_at: a.starts_at ? a.starts_at.slice(0, 16) : '',
      ends_at:   a.ends_at   ? a.ends_at.slice(0, 16)   : '',
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, starts_at: form.starts_at || null, ends_at: form.ends_at || null };
      if (editing) {
        await api.put(`/announcements/${editing.id}`, { ...payload, is_active: editing.is_active });
        toast('success', 'Announcement updated');
      } else {
        await api.post('/announcements', payload);
        toast('success', 'Announcement created');
      }
      setShowForm(false);
      load();
    } catch {
      toast('error', 'Failed to save announcement');
    } finally { setSaving(false); }
  };

  const toggleActive = async (a: Announcement) => {
    try {
      await api.put(`/announcements/${a.id}`, { ...a, is_active: a.is_active ? 0 : 1 });
      toast('success', a.is_active ? 'Announcement deactivated' : 'Announcement activated');
      load();
    } catch { toast('error', 'Failed to update'); }
  };

  const handleDelete = async (id: number) => {
    setDeleting(id);
    try {
      await api.delete(`/announcements/${id}`);
      toast('success', 'Deleted');
      load();
    } catch { toast('error', 'Failed to delete'); }
    finally { setDeleting(null); }
  };

  const inputCls = 'w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-400 transition bg-white';

  return (
    <div className="p-6 max-w-4xl space-y-5">

      {/* Header */}
      <div className="relative bg-white border border-slate-100 rounded-2xl px-6 py-4 shadow-sm overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-50/60 via-transparent to-transparent pointer-events-none" />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
              <Megaphone size={18} className="text-emerald-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">Announcements</h2>
              <p className="text-slate-400 text-sm mt-0.5">Broadcast messages to all clients inside the app</p>
            </div>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold rounded-xl shadow-md shadow-emerald-200 transition"
          >
            <Plus size={16} /> New Announcement
          </button>
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-800">{editing ? 'Edit Announcement' : 'New Announcement'}</h3>
              <button onClick={() => setShowForm(false)} className="p-1.5 hover:bg-slate-100 rounded-lg transition">
                <X size={16} className="text-slate-500" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Title</label>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className={inputCls} placeholder="e.g. Scheduled Maintenance" required />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Message</label>
                <textarea rows={3} value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} className={`${inputCls} resize-none`} placeholder="Describe the announcement in detail..." required />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Type</label>
                <div className="grid grid-cols-4 gap-2">
                  {(Object.keys(TYPE_CONFIG) as AnnouncementType[]).map(t => {
                    const cfg = TYPE_CONFIG[t];
                    const Icon = cfg.icon;
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setForm(f => ({ ...f, type: t }))}
                        className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 text-xs font-semibold transition ${
                          form.type === t ? `${cfg.bg} ${cfg.border} ${cfg.text}` : 'border-slate-100 text-slate-400 hover:border-slate-200'
                        }`}
                      >
                        <Icon size={16} />
                        {cfg.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Start (optional)</label>
                  <input type="datetime-local" value={form.starts_at} onChange={e => setForm(f => ({ ...f, starts_at: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">End (optional)</label>
                  <input type="datetime-local" value={form.ends_at} onChange={e => setForm(f => ({ ...f, ends_at: e.target.value }))} className={inputCls} />
                </div>
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2.5 border border-slate-200 text-slate-600 text-sm font-semibold rounded-xl hover:bg-slate-50 transition">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl disabled:opacity-50 transition">
                  {saving ? <Loader2 size={15} className="animate-spin" /> : null}
                  {saving ? 'Saving...' : editing ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* List */}
      <div className="space-y-3">
        {loading ? (
          [...Array(3)].map((_, i) => <div key={i} className="h-24 bg-slate-100 rounded-2xl animate-pulse" />)
        ) : items.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 py-16 text-center shadow-sm">
            <Megaphone size={32} className="mx-auto mb-3 text-slate-300" />
            <p className="text-slate-500 font-semibold">No announcements yet</p>
            <p className="text-slate-400 text-sm mt-1">Create one to broadcast a message to all clients</p>
          </div>
        ) : items.map(a => {
          const cfg = TYPE_CONFIG[a.type] || TYPE_CONFIG.info;
          const Icon = cfg.icon;
          return (
            <div key={a.id} className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${!a.is_active ? 'opacity-60' : ''}`}>
              <div className="flex items-start gap-4 p-5">
                <div className={`w-10 h-10 ${cfg.bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
                  <Icon size={18} className={cfg.iconColor} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="font-bold text-slate-800 text-sm">{a.title}</h3>
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${cfg.badge}`}>{cfg.label}</span>
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${a.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {a.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 leading-relaxed">{a.message}</p>
                  {(a.starts_at || a.ends_at) && (
                    <p className="text-xs text-slate-400 mt-2">
                      {a.starts_at && <>From: {new Date(a.starts_at).toLocaleString('en-PK')}</>}
                      {a.starts_at && a.ends_at && ' · '}
                      {a.ends_at && <>Until: {new Date(a.ends_at).toLocaleString('en-PK')}</>}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => toggleActive(a)} className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${a.is_active ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}>
                    {a.is_active ? 'Deactivate' : 'Activate'}
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
          );
        })}
      </div>
    </div>
  );
}
