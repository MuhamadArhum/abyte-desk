import { useState, useEffect, useRef } from 'react';
import {
  BookOpen, Plus, Trash2, ChevronDown, Search,
  Lock, Eye, EyeOff, AlertTriangle, CheckCircle2, ArrowLeft,
  Calendar, FileText, TrendingUp, TrendingDown, Send, RefreshCw
} from 'lucide-react';
import Pagination from '../../components/Pagination';
import api from '../../utils/api';
import { useToast } from '../../components/Toast';
import { localToday, localMonthStart } from '../../utils/dateUtils';
import ReportPasswordGate from '../../components/ReportPasswordGate';

// ─── Type badges ──────────────────────────────────────────────────────────────
const TYPE_TAG: Record<string, { bg: string; text: string; label: string }> = {
  asset:     { bg: 'bg-sky-100',     text: 'text-sky-700',     label: 'Asset'  },
  liability: { bg: 'bg-rose-100',    text: 'text-rose-700',    label: 'Liab'   },
  equity:    { bg: 'bg-violet-100',  text: 'text-violet-700',  label: 'Equity' },
  revenue:   { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Rev'    },
  expense:   { bg: 'bg-amber-100',   text: 'text-amber-700',   label: 'Exp'    },
};

// ─── Account Selector ─────────────────────────────────────────────────────────
const AccountSelector = ({
  value, onChange, accounts, onAfterSelect, placeholder = 'Select account…',
}: {
  value: string; onChange: (id: string) => void;
  accounts: any[]; onAfterSelect?: () => void; placeholder?: string;
}) => {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [hi, setHi] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const sel = accounts.find(a => String(a.account_id) === String(value));
  const list = accounts.filter(a =>
    !q || a.account_name.toLowerCase().includes(q.toLowerCase()) || a.account_code.includes(q)
  );
  const tag = sel ? TYPE_TAG[sel.account_type] : null;

  useEffect(() => setHi(0), [q]);
  useEffect(() => {
    const fn = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  const pick = (id: string) => { onChange(id); setOpen(false); setQ(''); setTimeout(() => onAfterSelect?.(), 0); };

  return (
    <div ref={ref} className="relative w-full">
      <button type="button" onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-sm text-left transition
          ${sel ? 'bg-white border-slate-200' : 'bg-slate-50 border-dashed border-slate-300 hover:border-slate-400'}`}>
        {sel ? (
          <>
            {tag && <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded ${tag.bg} ${tag.text}`}>{tag.label}</span>}
            <span className="font-mono text-xs text-slate-400 shrink-0">{sel.account_code}</span>
            <span className="font-semibold text-slate-800 truncate flex-1">{sel.account_name}</span>
          </>
        ) : (
          <span className="text-slate-400 flex-1">{placeholder}</span>
        )}
        <ChevronDown size={13} className="text-slate-300 shrink-0" />
      </button>

      {open && (
        <div className="absolute z-50 left-0 top-full mt-1.5 w-80 bg-white border border-slate-200 rounded-xl shadow-2xl">
          <div className="p-2 border-b border-slate-100">
            <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-1.5">
              <Search size={12} className="text-slate-400" />
              <input autoFocus value={q} onChange={e => setQ(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'ArrowDown') { e.preventDefault(); setHi(h => Math.min(h + 1, list.length - 1)); }
                  else if (e.key === 'ArrowUp') { e.preventDefault(); setHi(h => Math.max(h - 1, 0)); }
                  else if (e.key === 'Enter' && list[hi]) { e.preventDefault(); pick(String(list[hi].account_id)); }
                  else if (e.key === 'Escape') setOpen(false);
                }}
                className="text-sm bg-transparent outline-none w-full placeholder-slate-400 text-slate-700"
                placeholder="Search name or code…" />
            </div>
          </div>
          <ul className="max-h-56 overflow-y-auto py-1">
            {list.length === 0
              ? <li className="px-4 py-3 text-sm text-slate-400 text-center">No accounts found</li>
              : list.map((a, i) => {
                  const t = TYPE_TAG[a.account_type];
                  return (
                    <li key={a.account_id}>
                      <button type="button" onClick={() => pick(String(a.account_id))}
                        className={`w-full text-left px-3 py-2 flex items-center gap-2.5 text-sm transition
                          ${i === hi ? 'bg-slate-800 text-white' : 'hover:bg-slate-50 text-slate-700'}`}>
                        {t && <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded ${i === hi ? 'bg-white/20 text-white' : `${t.bg} ${t.text}`}`}>{t.label}</span>}
                        <span className="font-mono text-xs opacity-60 shrink-0">{a.account_code}</span>
                        <span className="truncate flex-1 font-medium">{a.account_name}</span>
                        <span className="shrink-0 text-xs opacity-50 font-mono">{Number(a.current_balance || 0).toLocaleString()}</span>
                      </button>
                    </li>
                  );
                })}
          </ul>
        </div>
      )}
    </div>
  );
};

// ─── JV Form (full-page) ──────────────────────────────────────────────────────
type Line = { dr_cr: 'Dr' | 'Cr'; account_id: string; narration: string; amount: string };
const blank = (): Line => ({ dr_cr: 'Dr', account_id: '', narration: '', amount: '' });

const JournalEntryForm = ({ onBack, onSuccess }: { onBack: () => void; onSuccess: () => void }) => {
  const toast = useToast();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [date, setDate] = useState(localToday());
  const [narration, setNarration] = useState('');
  const [lines, setLines] = useState<Line[]>([blank(), blank()]);
  const [saving, setSaving] = useState(false);
  const amtRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    api.get('/accounting/accounts', { params: { tree: 1 } })
      .then(r => setAccounts((r.data.data || []).filter((a: any) => a.is_active && a.level === 4)))
      .catch(() => {});
  }, []);

  const upd = (i: number, p: Partial<Line>) => setLines(prev => prev.map((l, idx) => idx === i ? { ...l, ...p } : l));

  const toggle = (i: number, val: 'Dr' | 'Cr') => {
    setLines(prev => {
      const rest = prev.filter((_, idx) => idx !== i);
      const rDr = rest.reduce((s, l) => s + (l.dr_cr === 'Dr' ? Number(l.amount || 0) : 0), 0);
      const rCr = rest.reduce((s, l) => s + (l.dr_cr === 'Cr' ? Number(l.amount || 0) : 0), 0);
      const diff = parseFloat(Math.abs(rDr - rCr).toFixed(2));
      return prev.map((l, idx) => idx !== i ? l : { ...l, dr_cr: val, amount: diff > 0 && !l.amount ? String(diff) : l.amount });
    });
  };

  const totDr = lines.reduce((s, l) => s + (l.dr_cr === 'Dr' ? Number(l.amount || 0) : 0), 0);
  const totCr = lines.reduce((s, l) => s + (l.dr_cr === 'Cr' ? Number(l.amount || 0) : 0), 0);
  const diff = Math.abs(totDr - totCr);
  const balanced = lines.length >= 2 && diff < 0.01 && totDr > 0;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!balanced) { toast.error('Debits must equal credits'); return; }
    const valid = lines.filter(l => l.account_id && Number(l.amount) > 0);
    if (valid.length < 2) { toast.error('At least 2 lines required'); return; }
    setSaving(true);
    try {
      await api.post('/accounting/journal-entries', {
        entry_date: date, description: narration,
        lines: valid.map(l => ({
          account_id: l.account_id,
          description: l.narration,
          debit:  l.dr_cr === 'Dr' ? Number(l.amount) : 0,
          credit: l.dr_cr === 'Cr' ? Number(l.amount) : 0,
        })),
      });
      toast.success('Journal voucher posted');
      onSuccess(); onBack();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save');
    } finally { setSaving(false); }
  };

  const fmt = (n: number) => n.toLocaleString('en-PK', { minimumFractionDigits: 2 });

  return (
    <form onSubmit={save} className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 p-4 sm:p-6">

      {/* ── Page Header ── */}
      <div className="flex items-center justify-between mb-5">
        <button type="button" onClick={onBack}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-800 transition font-medium text-sm">
          <ArrowLeft size={16} /> Back to List
        </button>
        <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold border-2 transition-all ${
          balanced ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
          : totDr > 0 ? 'bg-red-50 border-red-300 text-red-600'
          : 'bg-slate-100 border-slate-300 text-slate-400'}`}>
          {balanced ? <><CheckCircle2 size={13} /> Balanced</> : totDr > 0 ? <><AlertTriangle size={13} /> Out of Balance</> : 'No entries yet'}
        </div>
      </div>

      {/* ── Voucher Document Card ── */}
      <div className="max-w-5xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200">

        {/* Banner */}
        <div className="bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 px-6 py-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center border border-white/20">
              <BookOpen size={22} className="text-white" />
            </div>
            <div>
              <p className="text-white/60 text-xs font-semibold uppercase tracking-widest">Accounts Module</p>
              <h2 className="text-white text-2xl font-black tracking-tight">JOURNAL VOUCHER</h2>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-white/10 rounded-xl px-4 py-2.5 border border-white/20">
            <Calendar size={15} className="text-white/60" />
            <div>
              <p className="text-white/50 text-[10px] uppercase tracking-widest font-bold">Date</p>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="bg-transparent text-white font-semibold text-sm outline-none cursor-pointer" />
            </div>
          </div>
        </div>

        {/* Narration Row */}
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-4">
            <label className="text-xs font-black text-slate-400 uppercase tracking-widest shrink-0 w-24 flex items-center gap-1.5">
              <FileText size={11} /> Narration
            </label>
            <input type="text" value={narration} onChange={e => setNarration(e.target.value)}
              className="flex-1 bg-transparent text-sm text-slate-700 outline-none placeholder-slate-300 border-b-2 border-transparent focus:border-slate-400 pb-0.5 transition font-medium"
              placeholder="Brief description of this journal entry…" />
          </div>
        </div>

        {/* Totals Strip */}
        <div className="grid grid-cols-3 divide-x divide-slate-100 border-b border-slate-100">
          <div className="px-6 py-3 flex items-center gap-3">
            <TrendingUp size={16} className="text-sky-500" />
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Total Debit</p>
              <p className="text-lg font-black text-sky-700 font-mono leading-none">{fmt(totDr)}</p>
            </div>
          </div>
          <div className="px-6 py-3 flex items-center gap-3">
            <TrendingDown size={16} className="text-rose-500" />
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Total Credit</p>
              <p className="text-lg font-black text-rose-600 font-mono leading-none">{fmt(totCr)}</p>
            </div>
          </div>
          <div className="px-6 py-3 flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full ${balanced ? 'bg-emerald-500' : totDr > 0 ? 'bg-red-500 animate-pulse' : 'bg-slate-300'}`} />
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Difference</p>
              <p className={`text-lg font-black font-mono leading-none ${balanced ? 'text-emerald-600' : totDr > 0 ? 'text-red-500' : 'text-slate-300'}`}>
                {balanced ? '0.00 ✓' : fmt(diff)}
              </p>
            </div>
          </div>
        </div>

        {/* Lines Table */}
        <div className="overflow-x-auto">
          {/* Header */}
          <div className="grid bg-slate-800 text-slate-300 text-[10px] font-black uppercase tracking-widest px-4 py-3 gap-2 min-w-[640px]"
            style={{ gridTemplateColumns: '32px 90px 1fr 1fr 145px 36px' }}>
            <span className="text-center text-slate-500">#</span>
            <span className="text-center">Dr / Cr</span>
            <span>Account</span>
            <span>Particulars</span>
            <span className="text-right">Amount (Rs.)</span>
            <span />
          </div>

          {/* Rows */}
          <div className="min-w-[640px]">
            {lines.map((line, i) => {
              const isDr = line.dr_cr === 'Dr';
              return (
                <div key={i}
                  className={`grid gap-2 px-4 py-3 border-b border-slate-100 items-center group transition-colors
                    ${isDr ? 'hover:bg-sky-50/40' : 'hover:bg-rose-50/30'}`}
                  style={{ gridTemplateColumns: '32px 90px 1fr 1fr 145px 36px' }}>

                  <span className="text-center text-xs font-mono font-bold text-slate-300 select-none">
                    {String(i + 1).padStart(2, '0')}
                  </span>

                  {/* Toggle */}
                  <div className="flex rounded-lg overflow-hidden border-2 text-xs font-black"
                    style={{ borderColor: isDr ? '#0284c7' : '#f43f5e' }}>
                    <button type="button" onClick={() => toggle(i, 'Dr')}
                      className={`flex-1 py-1.5 transition-all ${isDr ? 'bg-sky-500 text-white' : 'bg-white text-slate-400 hover:text-sky-500'}`}>
                      Dr
                    </button>
                    <button type="button" onClick={() => toggle(i, 'Cr')}
                      className={`flex-1 py-1.5 transition-all ${!isDr ? 'bg-rose-500 text-white' : 'bg-white text-slate-400 hover:text-rose-500'}`}>
                      Cr
                    </button>
                  </div>

                  {/* Account */}
                  <AccountSelector value={line.account_id}
                    onChange={id => upd(i, { account_id: id })}
                    onAfterSelect={() => amtRefs.current[i]?.focus()}
                    accounts={accounts} />

                  {/* Particulars */}
                  <input type="text" value={line.narration} onChange={e => upd(i, { narration: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-slate-300 bg-white placeholder-slate-300 text-slate-700"
                    placeholder="Details…" />

                  {/* Amount */}
                  <input ref={el => { amtRefs.current[i] = el; }}
                    type="number" step="0.01" min="0" value={line.amount}
                    onChange={e => upd(i, { amount: e.target.value })}
                    className={`w-full px-3 py-2 text-sm border-2 rounded-lg text-right font-black font-mono outline-none transition
                      ${isDr ? 'border-sky-200 bg-sky-50 text-sky-700 focus:ring-2 focus:ring-sky-300 focus:border-sky-400'
                             : 'border-rose-200 bg-rose-50 text-rose-600 focus:ring-2 focus:ring-rose-300 focus:border-rose-400'}`}
                    placeholder="0.00" />

                  {/* Delete */}
                  <button type="button" onClick={() => setLines(p => p.filter((_, idx) => idx !== i))}
                    disabled={lines.length <= 2}
                    className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-200 hover:text-red-500 hover:bg-red-50 transition disabled:opacity-20 disabled:cursor-not-allowed">
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Balance Footer */}
          <div className={`grid gap-2 px-4 py-3.5 items-center min-w-[640px] ${balanced ? 'bg-emerald-600' : totDr > 0 ? 'bg-red-500' : 'bg-slate-700'}`}
            style={{ gridTemplateColumns: '32px 90px 1fr 1fr 145px 36px' }}>
            <span /><span />
            <span className="col-span-2 text-white text-xs font-black uppercase tracking-widest">
              {balanced ? '✓  BALANCED — READY TO POST' : totDr > 0 ? `OUT OF BALANCE  —  DIFF: ${fmt(diff)}` : 'GRAND TOTAL'}
            </span>
            <span className="text-right text-white font-black font-mono">{fmt(totDr)}</span>
            <span />
          </div>
        </div>

        {/* Action Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
          <button type="button" onClick={() => setLines(p => [...p, blank()])}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-dashed border-slate-300 text-slate-500 hover:border-slate-400 hover:text-slate-700 hover:bg-white text-sm font-bold transition">
            <Plus size={15} /> Add Line
          </button>
          <div className="flex items-center gap-3">
            <button type="button" onClick={onBack}
              className="px-5 py-2.5 rounded-xl border-2 border-slate-200 text-slate-600 hover:bg-white text-sm font-bold transition">
              Cancel
            </button>
            <button type="submit" disabled={saving || !balanced}
              className="flex items-center gap-2 px-7 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-sm font-black transition disabled:opacity-40 disabled:cursor-not-allowed shadow-lg">
              {saving
                ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <Send size={15} />}
              {saving ? 'Posting…' : 'Post Journal Voucher'}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
};

// ─── Delete Modal ─────────────────────────────────────────────────────────────
const JvDeleteModal = ({ entry, onClose, onDeleted }: { entry: any; onClose: () => void; onDeleted: () => void }) => {
  const toast = useToast();
  const [pw, setPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [err, setErr] = useState('');
  const [correct, setCorrect] = useState('');
  const [ready, setReady] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    api.get('/settings').then(r => { setCorrect(r.data.jv_delete_password || ''); setReady(true); }).catch(() => setReady(true));
  }, []);

  const del = async () => {
    if (!ready) return;
    if (correct && pw !== correct) { setErr('Incorrect password'); setPw(''); return; }
    setDeleting(true);
    try {
      await api.delete(`/accounting/journal-entries/${entry.entry_id}`);
      toast.success(`${entry.entry_number} deleted`);
      onDeleted(); onClose();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to delete');
    } finally { setDeleting(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="bg-gradient-to-r from-red-600 to-rose-600 px-6 py-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
            <AlertTriangle size={20} className="text-white" />
          </div>
          <div>
            <p className="text-white font-black text-base">Delete Journal Voucher</p>
            <p className="text-red-200 text-xs font-semibold">{entry.entry_number}</p>
          </div>
        </div>
        <div className="p-6">
          <div className="bg-slate-50 rounded-xl p-4 mb-4 space-y-2 text-sm border border-slate-100">
            {[
              ['Date', new Date(entry.entry_date).toLocaleDateString('en-PK')],
              ['Amount', `Rs. ${Number(entry.total_debit).toLocaleString('en-PK', { minimumFractionDigits: 2 })}`],
              ['Status', entry.status],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between">
                <span className="text-slate-400 font-medium">{k}</span>
                <span className="font-bold text-slate-700 capitalize">{v}</span>
              </div>
            ))}
          </div>
          {entry.status === 'posted' && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
              ⚠ Posted entry — account balances will be reversed.
            </p>
          )}
          {ready && correct && (
            <div className="mb-4">
              <label className="text-xs font-black text-slate-500 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                <Lock size={10} /> Password Required
              </label>
              <div className="relative">
                <input autoFocus type={showPw ? 'text' : 'password'} value={pw}
                  onChange={e => { setPw(e.target.value); setErr(''); }}
                  onKeyDown={e => { if (e.key === 'Enter') del(); }}
                  className="w-full px-4 pr-10 py-2.5 border-2 border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-red-300 outline-none"
                  placeholder="Enter delete password" />
                <button type="button" onClick={() => setShowPw(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {err && <p className="text-red-500 text-xs mt-1 font-semibold">{err}</p>}
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={onClose}
              className="flex-1 py-2.5 border-2 border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition">
              Cancel
            </button>
            <button onClick={del} disabled={deleting || !ready || (!!correct && !pw)}
              className="flex-1 py-2.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white rounded-xl text-sm font-black transition disabled:opacity-40 flex items-center justify-center gap-2">
              <Trash2 size={14} /> {deleting ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── List Page ────────────────────────────────────────────────────────────────
const JournalEntries = () => {
  const toast = useToast();
  const [view, setView] = useState<'list' | 'new'>('list');
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [toDelete, setToDelete] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [fromDate, setFromDate] = useState(localToday);
  const [toDate, setToDate] = useState(localToday);

  useEffect(() => { if (hasLoaded) load(); }, [pagination.page]);

  const load = async () => {
    setLoading(true); setHasLoaded(true);
    try {
      const params: any = { page: pagination.page, limit: pagination.limit };
      if (statusFilter !== 'all') params.status = statusFilter;
      if (fromDate) params.from_date = fromDate;
      if (toDate) params.to_date = toDate;
      const res = await api.get('/accounting/journal-entries', { params });
      setEntries(res.data.data || []);
      if (res.data.pagination) setPagination(res.data.pagination);
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  };

  const post = async (entry: any) => {
    if (!window.confirm(`Post ${entry.entry_number}? This will update account balances.`)) return;
    try {
      await api.post(`/accounting/journal-entries/${entry.entry_id}/post`);
      toast.success('Entry posted'); load();
    } catch (e: any) { toast.error(e.response?.data?.message || 'Failed'); }
  };

  const fmt = (n: number) => Number(n).toLocaleString('en-PK', { minimumFractionDigits: 2 });

  const totalDr = entries.reduce((s, e) => s + Number(e.total_debit || 0), 0);
  const totalCr = entries.reduce((s, e) => s + Number(e.total_credit || 0), 0);

  if (view === 'new') return <JournalEntryForm onBack={() => setView('list')} onSuccess={load} />;

  return (
    <div className="p-4 sm:p-6 space-y-4">

      {/* ── Header Card ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-slate-700 via-slate-500 to-slate-700" />
        <div className="px-5 py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-slate-800 rounded-xl flex items-center justify-center shadow-md">
              <BookOpen size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900">Journal Vouchers</h1>
              <p className="text-sm text-slate-400 font-medium">Double-entry bookkeeping ledger</p>
            </div>
          </div>
          <button onClick={() => setView('new')}
            className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-sm font-black shadow-md transition">
            <Plus size={16} /> New Journal Voucher
          </button>
        </div>
      </div>

      {/* ── Filter Bar ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3 flex flex-wrap items-center gap-2 sm:gap-3">
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none text-slate-700 focus:ring-2 focus:ring-slate-300 bg-white font-medium">
          <option value="all">All Status</option>
          <option value="draft">Draft</option>
          <option value="posted">Posted</option>
        </select>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-400 font-bold">From</span>
          <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-slate-300" />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-400 font-bold">To</span>
          <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-slate-300" />
        </div>
        <button onClick={() => { setPagination(p => ({ ...p, page: 1 })); load(); }} disabled={loading}
          className="flex items-center gap-1.5 px-5 py-2 bg-slate-800 text-white rounded-lg text-sm font-black hover:bg-slate-900 transition disabled:opacity-60 shadow-sm">
          <Search size={13} /> {loading ? 'Loading…' : 'Search'}
        </button>
        <button onClick={() => { setStatusFilter('all'); setFromDate(localToday); setToDate(localToday); setEntries([]); setHasLoaded(false); }}
          className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-500 hover:bg-slate-50 transition">
          <RefreshCw size={13} /> Reset
        </button>
        {hasLoaded && <span className="ml-auto text-xs text-slate-400 font-semibold">{pagination.total} entries found</span>}
      </div>

      {/* ── Summary Cards ── */}
      {hasLoaded && entries.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-xl border-2 border-slate-200 px-4 py-3 text-center shadow-sm">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Entries</p>
            <p className="text-3xl font-black text-slate-800 mt-1">{pagination.total}</p>
          </div>
          <div className="bg-sky-50 rounded-xl border-2 border-sky-200 px-4 py-3 text-center shadow-sm">
            <p className="text-[10px] font-black text-sky-500 uppercase tracking-widest">Total Debit</p>
            <p className="text-xl font-black text-sky-700 mt-1 font-mono">{fmt(totalDr)}</p>
          </div>
          <div className="bg-rose-50 rounded-xl border-2 border-rose-200 px-4 py-3 text-center shadow-sm">
            <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest">Total Credit</p>
            <p className="text-xl font-black text-rose-600 mt-1 font-mono">{fmt(totalCr)}</p>
          </div>
        </div>
      )}

      {/* ── Table ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {!hasLoaded ? (
          <div className="text-center py-16">
            <BookOpen size={44} className="mx-auto mb-3 text-slate-200" />
            <p className="font-bold text-slate-400">Select filters and click <span className="text-slate-700">Search</span></p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="bg-slate-800 text-slate-300 text-[10px] uppercase tracking-widest font-black">
                  <th className="text-left px-4 py-3">Voucher #</th>
                  <th className="text-left px-4 py-3">Date</th>
                  <th className="text-left px-4 py-3">Description</th>
                  <th className="text-right px-4 py-3 text-sky-400">Debit</th>
                  <th className="text-right px-4 py-3 text-rose-400">Credit</th>
                  <th className="text-center px-4 py-3">Status</th>
                  <th className="text-center px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="py-12 text-center">
                    <div className="animate-spin h-7 w-7 rounded-full border-2 border-slate-300 border-t-slate-700 mx-auto" />
                  </td></tr>
                ) : entries.length > 0 ? entries.map((e, i) => (
                  <tr key={e.entry_id}
                    className={`border-b border-slate-100 hover:bg-slate-50 transition ${i % 2 ? 'bg-slate-50/30' : ''}`}>
                    <td className="px-4 py-3 font-mono font-black text-slate-700 text-xs">{e.entry_number}</td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap font-medium text-xs">
                      {new Date(e.entry_date).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3 text-slate-600 max-w-[180px] truncate text-xs">{e.description || <span className="text-slate-300">—</span>}</td>
                    <td className="px-4 py-3 text-right font-mono font-black text-sky-700 text-xs">{fmt(e.total_debit)}</td>
                    <td className="px-4 py-3 text-right font-mono font-black text-rose-500 text-xs">{fmt(e.total_credit)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black border capitalize ${
                        e.status === 'posted'   ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                        : e.status === 'draft'  ? 'bg-amber-100 text-amber-700 border-amber-200'
                        : 'bg-red-100 text-red-600 border-red-200'}`}>
                        {e.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {e.status === 'draft' && (
                          <button onClick={() => post(e)}
                            className="p-1.5 text-emerald-500 hover:bg-emerald-50 rounded-lg transition" title="Post">
                            <Send size={13} />
                          </button>
                        )}
                        <button onClick={() => setToDelete(e)}
                          className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition" title="Delete">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan={7} className="py-10 text-center text-slate-400 text-sm font-semibold">No entries found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        {hasLoaded && (
          <Pagination
            currentPage={pagination.page} totalPages={pagination.totalPages}
            onPageChange={p => setPagination(prev => ({ ...prev, page: p }))}
            totalItems={pagination.total} itemsPerPage={pagination.limit}
            onItemsPerPageChange={l => setPagination(p => ({ ...p, limit: l, page: 1 }))} />
        )}
      </div>

      {toDelete && <JvDeleteModal entry={toDelete} onClose={() => setToDelete(null)} onDeleted={load} />}
    </div>
  );
};

const JournalEntriesWithGate = () => <ReportPasswordGate><JournalEntries /></ReportPasswordGate>;
export default JournalEntriesWithGate;
