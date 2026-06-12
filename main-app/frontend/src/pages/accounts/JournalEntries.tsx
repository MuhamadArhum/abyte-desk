import { useState, useEffect, useRef } from 'react';
import {
  BookOpen, Plus, Send, Trash2, ChevronDown, Search,
  Lock, Eye, EyeOff, AlertTriangle, CheckCircle2, ArrowLeft,
  Calendar, FileText, TrendingUp, TrendingDown, Minus
} from 'lucide-react';
import Pagination from '../../components/Pagination';
import api from '../../utils/api';
import { useToast } from '../../components/Toast';
import { localToday, localMonthStart } from '../../utils/dateUtils';
import ReportPasswordGate from '../../components/ReportPasswordGate';

// ─────────────────────────── Account Selector ────────────────────────────────
const typeTag: Record<string, { bg: string; text: string; label: string }> = {
  asset:     { bg: 'bg-sky-100',    text: 'text-sky-700',    label: 'Asset'  },
  liability: { bg: 'bg-rose-100',   text: 'text-rose-700',   label: 'Liab'   },
  equity:    { bg: 'bg-violet-100', text: 'text-violet-700', label: 'Equity' },
  revenue:   { bg: 'bg-emerald-100',text: 'text-emerald-700',label: 'Rev'    },
  expense:   { bg: 'bg-amber-100',  text: 'text-amber-700',  label: 'Exp'    },
};

const AccountSelector = ({
  value, onChange, accounts, onAfterSelect, placeholder = 'Select account…',
}: {
  value: string; onChange: (id: string) => void;
  accounts: any[]; onAfterSelect?: () => void; placeholder?: string;
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [hi, setHi] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const selected  = accounts.find(a => String(a.account_id) === String(value));
  const filtered  = accounts.filter(a =>
    !search ||
    a.account_name.toLowerCase().includes(search.toLowerCase()) ||
    a.account_code.includes(search)
  );
  const tag = selected ? typeTag[selected.account_type] : null;

  useEffect(() => setHi(0), [search]);
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const pick = (id: string) => {
    onChange(id); setOpen(false); setSearch(''); setHi(0);
    setTimeout(() => onAfterSelect?.(), 0);
  };

  return (
    <div ref={ref} className="relative w-full">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-sm text-left transition-all
          ${selected ? 'border-slate-300 bg-white' : 'border-dashed border-slate-300 bg-slate-50 hover:border-slate-400'}`}
      >
        {selected ? (
          <>
            {tag && (
              <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded ${tag.bg} ${tag.text}`}>
                {tag.label}
              </span>
            )}
            <span className="text-slate-400 font-mono text-xs shrink-0">{selected.account_code}</span>
            <span className="text-slate-800 font-semibold truncate flex-1">{selected.account_name}</span>
          </>
        ) : (
          <span className="text-slate-400 flex-1">{placeholder}</span>
        )}
        <ChevronDown size={13} className="text-slate-300 shrink-0" />
      </button>

      {selected && (
        <p className="text-[11px] text-slate-400 mt-0.5 px-1">
          Bal: <span className="font-semibold text-slate-500 font-mono">
            {Number(selected.current_balance || 0).toLocaleString('en-PK', { minimumFractionDigits: 2 })}
          </span>
        </p>
      )}

      {open && (
        <div className="absolute z-50 left-0 top-full mt-1.5 w-80 bg-white border border-slate-200 rounded-xl shadow-2xl ring-1 ring-slate-900/5">
          <div className="p-2.5 border-b border-slate-100">
            <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-1.5">
              <Search size={12} className="text-slate-400 shrink-0" />
              <input
                autoFocus
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'ArrowDown') { e.preventDefault(); setHi(h => Math.min(h + 1, filtered.length - 1)); }
                  else if (e.key === 'ArrowUp') { e.preventDefault(); setHi(h => Math.max(h - 1, 0)); }
                  else if (e.key === 'Enter') { e.preventDefault(); if (filtered[hi]) pick(String(filtered[hi].account_id)); }
                  else if (e.key === 'Escape') setOpen(false);
                }}
                className="text-sm bg-transparent outline-none w-full placeholder-slate-400 text-slate-700"
                placeholder="Search name or code…"
              />
            </div>
          </div>
          <ul className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0
              ? <li className="px-4 py-3 text-sm text-slate-400 text-center">No accounts found</li>
              : filtered.map((a, idx) => {
                  const t = typeTag[a.account_type];
                  return (
                    <li key={a.account_id}>
                      <button
                        type="button"
                        onClick={() => pick(String(a.account_id))}
                        className={`w-full text-left px-3 py-2 flex items-center gap-2.5 transition text-sm
                          ${idx === hi ? 'bg-slate-800 text-white' : 'hover:bg-slate-50 text-slate-700'}`}
                      >
                        {t && (
                          <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded ${idx === hi ? 'bg-white/20 text-white' : `${t.bg} ${t.text}`}`}>
                            {t.label}
                          </span>
                        )}
                        <span className="font-mono text-xs opacity-60 shrink-0">{a.account_code}</span>
                        <span className="truncate flex-1 font-medium">{a.account_name}</span>
                        <span className="shrink-0 text-xs opacity-50 font-mono">
                          {Number(a.current_balance || 0).toLocaleString()}
                        </span>
                      </button>
                    </li>
                  );
                })
            }
          </ul>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────── JV Form ─────────────────────────────────────────
type JvLine = { dr_cr: 'Dr' | 'Cr'; account_id: string; narration: string; amount: string };
const newLine = (): JvLine => ({ dr_cr: 'Dr', account_id: '', narration: '', amount: '' });

const JournalEntryForm = ({ onBack, onSuccess }: { onBack: () => void; onSuccess: () => void }) => {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [date, setDate] = useState(localToday());
  const [narration, setNarration] = useState('');
  const [lines, setLines] = useState<JvLine[]>([newLine(), newLine()]);
  const amountRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    api.get('/accounting/accounts', { params: { tree: 1 } })
      .then(r => setAccounts((r.data.data || []).filter((a: any) => a.is_active && a.level === 4)))
      .catch(() => {});
  }, []);

  const set = (i: number, patch: Partial<JvLine>) =>
    setLines(prev => prev.map((l, idx) => idx === i ? { ...l, ...patch } : l));

  const toggleDrCr = (i: number, val: 'Dr' | 'Cr') => {
    setLines(prev => {
      const others = prev.filter((_, idx) => idx !== i);
      const otherDr = others.reduce((s, l) => s + (l.dr_cr === 'Dr' ? Number(l.amount || 0) : 0), 0);
      const otherCr = others.reduce((s, l) => s + (l.dr_cr === 'Cr' ? Number(l.amount || 0) : 0), 0);
      const diff = parseFloat(Math.abs(otherDr - otherCr).toFixed(2));
      return prev.map((l, idx) => {
        if (idx !== i) return l;
        return { ...l, dr_cr: val, amount: diff > 0 && !l.amount ? String(diff) : l.amount };
      });
    });
  };

  const totDr = lines.reduce((s, l) => s + (l.dr_cr === 'Dr' ? Number(l.amount || 0) : 0), 0);
  const totCr = lines.reduce((s, l) => s + (l.dr_cr === 'Cr' ? Number(l.amount || 0) : 0), 0);
  const diff     = Math.abs(totDr - totCr);
  const balanced = lines.length >= 2 && diff < 0.01 && totDr > 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!balanced) { toast.error('Debits must equal credits'); return; }
    const validLines = lines.filter(l => l.account_id && Number(l.amount) > 0);
    if (validLines.length < 2) { toast.error('At least 2 lines required'); return; }
    setSaving(true);
    try {
      await api.post('/accounting/journal-entries', {
        entry_date: date, description: narration,
        lines: validLines.map(l => ({
          account_id: l.account_id,
          description: l.narration,
          debit:  l.dr_cr === 'Dr' ? Number(l.amount) : 0,
          credit: l.dr_cr === 'Cr' ? Number(l.amount) : 0,
        })),
      });
      toast.success('Journal voucher saved');
      onSuccess(); onBack();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save');
    } finally { setSaving(false); }
  };

  return (
    <div className="h-full flex flex-col bg-slate-50">

      {/* ── Top Bar ── */}
      <div className="bg-white border-b border-slate-200 px-5 py-3 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 rounded-lg hover:bg-slate-100 transition text-slate-500">
            <ArrowLeft size={18} />
          </button>
          <div className="w-px h-6 bg-slate-200" />
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center">
              <BookOpen size={15} className="text-white" />
            </div>
            <div>
              <p className="font-bold text-slate-800 text-sm leading-none">Journal Voucher</p>
              <p className="text-xs text-slate-400 mt-0.5">Double-entry transaction</p>
            </div>
          </div>
        </div>

        {/* Balance Chip */}
        <div className={`hidden sm:flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold border transition-all ${
          balanced
            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
            : totDr > 0
              ? 'bg-red-50 border-red-200 text-red-600'
              : 'bg-slate-100 border-slate-200 text-slate-400'
        }`}>
          {balanced ? (
            <><CheckCircle2 size={14} /> Balanced</>
          ) : totDr > 0 ? (
            <><AlertTriangle size={14} /> Diff {diff.toLocaleString('en-PK', { minimumFractionDigits: 2 })}</>
          ) : (
            <><Minus size={14} /> Awaiting input</>
          )}
        </div>
      </div>

      {/* ── Voucher Meta Card ── */}
      <div className="px-5 pt-4 pb-0 shrink-0">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          {/* Header stripe */}
          <div className="bg-slate-800 rounded-t-xl px-5 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText size={16} className="text-slate-300" />
              <span className="text-white font-semibold text-sm tracking-wide">NEW JOURNAL VOUCHER</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar size={13} className="text-slate-400" />
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="bg-transparent text-white text-sm font-mono border-none outline-none cursor-pointer"
              />
            </div>
          </div>

          {/* Narration */}
          <div className="px-5 py-3.5 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest shrink-0 w-20">Narration</label>
              <input
                type="text"
                value={narration}
                onChange={e => setNarration(e.target.value)}
                className="flex-1 text-sm text-slate-700 bg-transparent outline-none placeholder-slate-300 border-b border-transparent focus:border-slate-300 pb-0.5 transition"
                placeholder="Brief description of this transaction…"
              />
            </div>
          </div>

          {/* Totals strip */}
          <div className="px-5 py-2.5 flex items-center gap-6 bg-slate-50/60 rounded-b-xl">
            <div className="flex items-center gap-2">
              <TrendingUp size={13} className="text-sky-500" />
              <span className="text-xs text-slate-400">Total Dr</span>
              <span className="text-sm font-bold text-sky-700 font-mono">{totDr.toLocaleString('en-PK', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="w-px h-4 bg-slate-200" />
            <div className="flex items-center gap-2">
              <TrendingDown size={13} className="text-rose-500" />
              <span className="text-xs text-slate-400">Total Cr</span>
              <span className="text-sm font-bold text-rose-600 font-mono">{totCr.toLocaleString('en-PK', { minimumFractionDigits: 2 })}</span>
            </div>
            {!balanced && totDr > 0 && (
              <>
                <div className="w-px h-4 bg-slate-200" />
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">Difference</span>
                  <span className="text-sm font-bold text-red-500 font-mono">{diff.toLocaleString('en-PK', { minimumFractionDigits: 2 })}</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Lines ── */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <form id="jv-form" onSubmit={submit}>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">

            {/* Column Headers */}
            <div className="grid bg-slate-800 text-slate-300 text-[11px] font-bold uppercase tracking-widest px-3 py-2.5 gap-2"
              style={{ gridTemplateColumns: '28px 80px 1fr 1fr 130px 30px' }}>
              <span className="text-center">#</span>
              <span className="text-center">Dr / Cr</span>
              <span>Account</span>
              <span>Narration</span>
              <span className="text-right pr-1">Amount (Rs)</span>
              <span />
            </div>

            {/* Rows */}
            {lines.map((line, i) => {
              const isDr = line.dr_cr === 'Dr';
              return (
                <div
                  key={i}
                  className={`grid gap-2 px-3 py-2.5 border-b border-slate-100 items-center transition-colors
                    ${isDr ? 'hover:bg-sky-50/30' : 'hover:bg-rose-50/20'}`}
                  style={{ gridTemplateColumns: '28px 80px 1fr 1fr 130px 30px' }}
                >
                  {/* Row # */}
                  <span className="text-center text-xs font-mono text-slate-300 select-none">
                    {String(i + 1).padStart(2, '0')}
                  </span>

                  {/* Dr / Cr toggle */}
                  <div className="flex rounded-lg border border-slate-200 overflow-hidden bg-slate-50 text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => toggleDrCr(i, 'Dr')}
                      className={`flex-1 py-1.5 transition ${isDr ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-400 hover:text-sky-600'}`}
                    >Dr</button>
                    <button
                      type="button"
                      onClick={() => toggleDrCr(i, 'Cr')}
                      className={`flex-1 py-1.5 transition ${!isDr ? 'bg-rose-500 text-white shadow-sm' : 'text-slate-400 hover:text-rose-500'}`}
                    >Cr</button>
                  </div>

                  {/* Account */}
                  <AccountSelector
                    value={line.account_id}
                    onChange={id => set(i, { account_id: id })}
                    onAfterSelect={() => amountRefs.current[i]?.focus()}
                    accounts={accounts}
                  />

                  {/* Narration */}
                  <input
                    type="text"
                    value={line.narration}
                    onChange={e => set(i, { narration: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-slate-300 bg-white text-slate-700 placeholder-slate-300"
                    placeholder="Line detail…"
                  />

                  {/* Amount */}
                  <div className="relative">
                    <input
                      ref={el => { amountRefs.current[i] = el; }}
                      type="number"
                      step="0.01"
                      min="0"
                      value={line.amount}
                      onChange={e => set(i, { amount: e.target.value })}
                      className={`w-full pl-2 pr-2 py-1.5 text-sm border rounded-lg text-right font-semibold font-mono outline-none transition
                        ${isDr
                          ? 'border-sky-200 bg-sky-50 text-sky-700 focus:ring-2 focus:ring-sky-300'
                          : 'border-rose-200 bg-rose-50 text-rose-600 focus:ring-2 focus:ring-rose-300'}`}
                      placeholder="0.00"
                    />
                  </div>

                  {/* Delete */}
                  <button
                    type="button"
                    onClick={() => setLines(prev => prev.filter((_, idx) => idx !== i))}
                    disabled={lines.length <= 2}
                    className="flex items-center justify-center p-1 rounded text-slate-300 hover:text-red-400 hover:bg-red-50 transition disabled:opacity-20 disabled:cursor-not-allowed"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              );
            })}

            {/* Balance Row */}
            <div className={`grid gap-2 px-3 py-3 items-center ${balanced ? 'bg-emerald-600' : totDr > 0 ? 'bg-red-500' : 'bg-slate-700'}`}
              style={{ gridTemplateColumns: '28px 80px 1fr 1fr 130px 30px' }}>
              <span />
              <span />
              <span className="col-span-2 text-white text-xs font-bold uppercase tracking-wide">
                {balanced ? '✓  Balanced — Ready to Save' : totDr > 0 ? `Difference: ${diff.toLocaleString('en-PK', { minimumFractionDigits: 2 })}` : 'Total'}
              </span>
              <span className="text-right text-white font-bold font-mono text-sm pr-1">
                {totDr.toLocaleString('en-PK', { minimumFractionDigits: 2 })}
              </span>
              <span />
            </div>
          </div>
        </form>
      </div>

      {/* ── Footer ── */}
      <div className="bg-white border-t border-slate-200 px-5 py-3.5 shrink-0 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setLines(prev => [...prev, newLine()])}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-dashed border-slate-300 text-slate-500 hover:border-slate-400 hover:text-slate-700 hover:bg-slate-50 text-sm font-medium transition"
        >
          <Plus size={14} /> Add Line
        </button>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onBack}
            className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium transition">
            Cancel
          </button>
          <button
            type="submit"
            form="jv-form"
            disabled={saving || !balanced}
            className="flex items-center gap-2 px-6 py-2 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-sm font-bold transition disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
          >
            {saving
              ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : <Send size={14} />}
            {saving ? 'Saving…' : 'Post Journal Voucher'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────── Delete Modal ────────────────────────────────────
const JvDeleteModal = ({ entry, onClose, onDeleted }: { entry: any; onClose: () => void; onDeleted: () => void }) => {
  const toast = useToast();
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [correctPw, setCorrectPw] = useState('');
  const [pwLoaded, setPwLoaded] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    api.get('/settings')
      .then(res => { setCorrectPw(res.data.jv_delete_password || ''); setPwLoaded(true); })
      .catch(() => setPwLoaded(true));
  }, []);

  const handleDelete = async () => {
    if (!pwLoaded) return;
    if (correctPw && password !== correctPw) { setError('Incorrect password'); setPassword(''); return; }
    setDeleting(true);
    try {
      await api.delete(`/accounting/journal-entries/${entry.entry_id}`);
      toast.success(`${entry.entry_number} deleted`);
      onDeleted(); onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete');
    } finally { setDeleting(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="bg-red-600 px-6 py-4 flex items-center gap-3">
          <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">
            <AlertTriangle size={18} className="text-white" />
          </div>
          <div>
            <p className="text-white font-bold">Delete Journal Voucher</p>
            <p className="text-red-100 text-xs">{entry.entry_number}</p>
          </div>
        </div>
        <div className="p-6">
          <div className="bg-slate-50 rounded-xl p-4 mb-4 space-y-2 text-sm">
            {[
              ['Date', new Date(entry.entry_date).toLocaleDateString('en-PK')],
              ['Amount', `Rs. ${Number(entry.total_debit).toLocaleString('en-PK', { minimumFractionDigits: 2 })}`],
              ['Status', entry.status],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between">
                <span className="text-slate-400">{k}</span>
                <span className="font-semibold text-slate-700 capitalize">{v}</span>
              </div>
            ))}
          </div>
          {entry.status === 'posted' && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
              ⚠ This entry is posted. Account balances will be reversed.
            </p>
          )}
          {pwLoaded && correctPw && (
            <div className="mb-4">
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                <Lock size={11} /> Password Required
              </label>
              <div className="relative">
                <input
                  autoFocus
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(''); }}
                  onKeyDown={e => { if (e.key === 'Enter') handleDelete(); }}
                  className="w-full px-4 pr-10 py-2.5 border-2 border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-red-400 outline-none"
                  placeholder="Enter delete password"
                />
                <button type="button" onClick={() => setShowPw(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={onClose}
              className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition">
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting || !pwLoaded || (!!correctPw && !password)}
              className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-bold transition disabled:opacity-40 flex items-center justify-center gap-2"
            >
              <Trash2 size={14} /> {deleting ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────── List Page ───────────────────────────────────────
const JournalEntries = () => {
  const toast = useToast();
  const [view, setView] = useState<'list' | 'new'>('list');
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [deleteEntry, setDeleteEntry] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [fromDate, setFromDate] = useState(localMonthStart);
  const [toDate, setToDate] = useState(localToday);

  useEffect(() => { if (hasLoaded) fetchEntries(); }, [pagination.page]);

  const fetchEntries = async () => {
    setLoading(true); setHasLoaded(true);
    try {
      const params: any = { page: pagination.page, limit: pagination.limit };
      if (statusFilter !== 'all') params.status = statusFilter;
      if (fromDate) params.from_date = fromDate;
      if (toDate) params.to_date = toDate;
      const res = await api.get('/accounting/journal-entries', { params });
      setEntries(res.data.data || []);
      if (res.data.pagination) setPagination(res.data.pagination);
    } catch { toast.error('Failed to load entries'); }
    finally { setLoading(false); }
  };

  const handlePost = async (entry: any) => {
    if (!window.confirm(`Post ${entry.entry_number}? This will update account balances.`)) return;
    try {
      await api.post(`/accounting/journal-entries/${entry.entry_id}/post`);
      toast.success('Entry posted');
      fetchEntries();
    } catch (err: any) { toast.error(err.response?.data?.message || 'Failed to post'); }
  };

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      draft:    'bg-amber-100 text-amber-700 border-amber-200',
      posted:   'bg-emerald-100 text-emerald-700 border-emerald-200',
      reversed: 'bg-red-100 text-red-700 border-red-200',
    };
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border capitalize ${map[s] ?? 'bg-slate-100 text-slate-500 border-slate-200'}`}>
        {s}
      </span>
    );
  };

  const pageDebit  = entries.reduce((s, e) => s + Number(e.total_debit  || 0), 0);
  const pageCredit = entries.reduce((s, e) => s + Number(e.total_credit || 0), 0);

  if (view === 'new') return <JournalEntryForm onBack={() => setView('list')} onSuccess={fetchEntries} />;

  return (
    <div className="p-4 sm:p-6 space-y-4">

      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center shadow-sm">
            <BookOpen size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Journal Vouchers</h1>
            <p className="text-sm text-slate-400">Double-entry bookkeeping ledger</p>
          </div>
        </div>
        <button
          onClick={() => setView('new')}
          className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-sm font-bold shadow-sm transition"
        >
          <Plus size={15} /> New Journal Voucher
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3 flex flex-wrap items-center gap-2 sm:gap-3">
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none bg-white text-slate-700 focus:ring-2 focus:ring-slate-300"
        >
          <option value="all">All Status</option>
          <option value="draft">Draft</option>
          <option value="posted">Posted</option>
        </select>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-400 font-medium">From</span>
          <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-slate-300" />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-400 font-medium">To</span>
          <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-slate-300" />
        </div>
        <button
          onClick={() => { setPagination(p => ({ ...p, page: 1 })); fetchEntries(); }}
          disabled={loading}
          className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-semibold hover:bg-slate-900 transition disabled:opacity-60"
        >
          <Search size={13} /> {loading ? 'Loading…' : 'Search'}
        </button>
        {hasLoaded && <span className="ml-auto text-xs text-slate-400">{pagination.total} entries found</span>}
      </div>

      {/* Summary Cards */}
      {hasLoaded && entries.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3 text-center">
            <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide">Entries</p>
            <p className="text-2xl font-black text-slate-800 mt-1">{pagination.total}</p>
          </div>
          <div className="bg-white rounded-xl border border-sky-200 shadow-sm px-4 py-3 text-center">
            <p className="text-xs text-sky-500 font-semibold uppercase tracking-wide">Total Debit</p>
            <p className="text-lg font-black text-sky-700 mt-1 font-mono">{pageDebit.toLocaleString('en-PK', { minimumFractionDigits: 0 })}</p>
          </div>
          <div className="bg-white rounded-xl border border-rose-200 shadow-sm px-4 py-3 text-center">
            <p className="text-xs text-rose-400 font-semibold uppercase tracking-wide">Total Credit</p>
            <p className="text-lg font-black text-rose-600 mt-1 font-mono">{pageCredit.toLocaleString('en-PK', { minimumFractionDigits: 0 })}</p>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {!hasLoaded ? (
          <div className="text-center py-16 text-slate-400">
            <BookOpen size={40} className="mx-auto mb-3 opacity-20" />
            <p className="font-semibold text-slate-500">Select filters and click <strong className="text-slate-700">Search</strong></p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-400">
                  <th className="text-left px-4 py-3 font-bold">Voucher #</th>
                  <th className="text-left px-4 py-3 font-bold">Date</th>
                  <th className="text-left px-4 py-3 font-bold">Description</th>
                  <th className="text-right px-4 py-3 font-bold text-sky-500">Debit</th>
                  <th className="text-right px-4 py-3 font-bold text-rose-400">Credit</th>
                  <th className="text-center px-4 py-3 font-bold">Status</th>
                  <th className="text-center px-4 py-3 font-bold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center">
                      <div className="animate-spin h-6 w-6 rounded-full border-2 border-slate-400 border-t-transparent mx-auto" />
                    </td>
                  </tr>
                ) : entries.length > 0 ? (
                  entries.map((entry, i) => (
                    <tr
                      key={entry.entry_id}
                      className={`border-b border-slate-100 hover:bg-slate-50/60 transition ${i % 2 === 0 ? '' : 'bg-slate-50/30'}`}
                    >
                      <td className="px-4 py-3 font-mono font-bold text-slate-700">{entry.entry_number}</td>
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                        {new Date(entry.entry_date).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-3 text-slate-600 max-w-[180px] truncate">{entry.description || <span className="text-slate-300">—</span>}</td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-sky-700">
                        {Number(entry.total_debit).toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-rose-500">
                        {Number(entry.total_credit).toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-center">{statusBadge(entry.status)}</td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {entry.status === 'draft' && (
                            <button
                              onClick={() => handlePost(entry)}
                              className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                              title="Post"
                            >
                              <Send size={13} />
                            </button>
                          )}
                          <button
                            onClick={() => setDeleteEntry(entry)}
                            className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                            title="Delete"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-slate-400 text-sm">No entries found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        {hasLoaded && (
          <Pagination
            currentPage={pagination.page} totalPages={pagination.totalPages}
            onPageChange={page => setPagination(p => ({ ...p, page }))}
            totalItems={pagination.total} itemsPerPage={pagination.limit}
            onItemsPerPageChange={limit => setPagination(p => ({ ...p, limit, page: 1 }))}
          />
        )}
      </div>

      {deleteEntry && (
        <JvDeleteModal
          entry={deleteEntry}
          onClose={() => setDeleteEntry(null)}
          onDeleted={fetchEntries}
        />
      )}
    </div>
  );
};

const JournalEntriesWithGate = () => <ReportPasswordGate><JournalEntries /></ReportPasswordGate>;
export default JournalEntriesWithGate;
