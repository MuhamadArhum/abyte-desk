import { useState, useEffect, useRef } from 'react';
import {
  BookOpen, Plus, Trash2, ChevronDown, Search,
  Lock, Eye, EyeOff, AlertTriangle, CheckCircle2,
  FileText, TrendingUp, TrendingDown, Send, RefreshCw, ArrowLeft, Calendar
} from 'lucide-react';
import Pagination from '../../components/Pagination';
import api from '../../utils/api';
import { useToast } from '../../components/Toast';
import { useConfirm } from '../../components/ConfirmDialog';
import { localToday } from '../../utils/dateUtils';
import ReportPasswordGate from '../../components/ReportPasswordGate';

const TYPE_TAG: Record<string, { bg: string; text: string; label: string }> = {
  asset:     { bg: 'bg-sky-100',     text: 'text-sky-700',     label: 'Asset'  },
  liability: { bg: 'bg-rose-100',    text: 'text-rose-700',    label: 'Liab'   },
  equity:    { bg: 'bg-violet-100',  text: 'text-violet-700',  label: 'Equity' },
  revenue:   { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Rev'    },
  expense:   { bg: 'bg-amber-100',   text: 'text-amber-700',   label: 'Exp'    },
};

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
        className="w-full flex items-center justify-between px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white hover:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 text-left transition">
        {sel ? (
          <span className="flex items-center gap-2 flex-1 min-w-0">
            {tag && <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded ${tag.bg} ${tag.text}`}>{tag.label}</span>}
            <span className="font-mono text-xs text-gray-400 shrink-0">{sel.account_code}</span>
            <span className="font-semibold text-gray-800 truncate">{sel.account_name}</span>
          </span>
        ) : (
          <span className="text-gray-400 flex-1">{placeholder}</span>
        )}
        <ChevronDown size={13} className="text-gray-300 shrink-0 ml-1" />
      </button>

      {open && (
        <div className="absolute z-50 left-0 top-full mt-1.5 w-80 bg-white border border-gray-200 rounded-xl shadow-2xl">
          <div className="p-2 border-b border-gray-100">
            <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-1.5">
              <Search size={12} className="text-gray-400" />
              <input autoFocus value={q} onChange={e => setQ(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'ArrowDown') { e.preventDefault(); setHi(h => Math.min(h + 1, list.length - 1)); }
                  else if (e.key === 'ArrowUp') { e.preventDefault(); setHi(h => Math.max(h - 1, 0)); }
                  else if (e.key === 'Enter' && list[hi]) { e.preventDefault(); pick(String(list[hi].account_id)); }
                  else if (e.key === 'Escape') setOpen(false);
                }}
                className="text-sm bg-transparent outline-none w-full placeholder-gray-400 text-gray-700"
                placeholder="Search name or code…" />
            </div>
          </div>
          <ul className="max-h-56 overflow-y-auto py-1">
            {list.length === 0
              ? <li className="px-4 py-3 text-sm text-gray-400 text-center">No accounts found</li>
              : list.map((a, i) => {
                  const t = TYPE_TAG[a.account_type];
                  return (
                    <li key={a.account_id}>
                      <button type="button" onClick={() => pick(String(a.account_id))}
                        className={`w-full text-left px-3 py-2 flex items-center gap-2.5 text-sm transition
                          ${i === hi ? 'bg-indigo-100 text-indigo-700' : 'hover:bg-gray-50 text-gray-700'}`}>
                        {t && <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded ${t.bg} ${t.text}`}>{t.label}</span>}
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

type Line = { dr_cr: 'Dr' | 'Cr'; account_id: string; narration: string; amount: string };

const JVForm = ({ onBack, onSuccess }: { onBack: () => void; onSuccess: () => void }) => {
  const toast = useToast();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [date, setDate] = useState(localToday());
  const [narration, setNarration] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const [saving, setSaving] = useState(false);

  // Active input row state
  const [inputDrCr, setInputDrCr] = useState<'Dr' | 'Cr' | null>(null);
  const [inputAccount, setInputAccount] = useState('');
  const [inputNarration, setInputNarration] = useState('');
  const [inputAmount, setInputAmount] = useState('');
  const narrationRef = useRef<HTMLInputElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const drBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    api.get('/accounting/accounts', { params: { tree: 1 } })
      .then(r => setAccounts((r.data.data || []).filter((a: any) => a.is_active && a.level === 4)))
      .catch(() => {});
  }, []);

  const totDr = lines.reduce((s, l) => s + (l.dr_cr === 'Dr' ? Number(l.amount || 0) : 0), 0);
  const totCr = lines.reduce((s, l) => s + (l.dr_cr === 'Cr' ? Number(l.amount || 0) : 0), 0);
  const diff = Math.abs(totDr - totCr);
  const balanced = lines.length >= 2 && diff < 0.01 && totDr > 0;
  const fmt = (n: number) => n.toLocaleString('en-PK', { minimumFractionDigits: 2 });

  const amountEnabled = inputDrCr !== null;

  const resetInputRow = () => {
    setInputDrCr(null);
    setInputAccount('');
    setInputNarration('');
    setInputAmount('');
    setTimeout(() => drBtnRef.current?.focus(), 0);
  };

  const addLine = () => {
    if (!inputDrCr || !inputAccount || !inputAmount || Number(inputAmount) <= 0) {
      toast.error('Select Dr/Cr, account, and enter amount');
      return;
    }
    setLines(prev => [...prev, {
      dr_cr: inputDrCr,
      account_id: inputAccount,
      narration: inputNarration,
      amount: inputAmount,
    }]);
    resetInputRow();
  };

  const save = async () => {
    if (!balanced) { toast.error('Debits must equal credits'); return; }
    if (lines.length < 2) { toast.error('At least 2 lines required'); return; }
    setSaving(true);
    try {
      await api.post('/accounting/journal-entries', {
        entry_date: date, description: narration,
        lines: lines.map(l => ({
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

  return (
    <div className="p-6">

      {/* Top bar: Back + Balance badge */}
      <div className="mb-5 flex items-center justify-between">
        <button onClick={() => { onSuccess(); onBack(); }}
          className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-800 transition">
          <ArrowLeft size={16} /> Back to List
        </button>
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${
          balanced ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
          : lines.length > 0 ? 'bg-red-50 text-red-600 border-red-200'
          : 'bg-gray-100 text-gray-400 border-gray-200'}`}>
          {balanced ? <CheckCircle2 size={11} /> : lines.length > 0 ? <AlertTriangle size={11} /> : null}
          {balanced ? 'Balanced' : lines.length > 0 ? `Diff: ${fmt(diff)}` : 'No entries yet'}
        </div>
      </div>

      {/* Main card */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">

        {/* Card header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
          <div className="w-9 h-9 bg-indigo-100 rounded-lg flex items-center justify-center shrink-0">
            <BookOpen size={18} className="text-indigo-600" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-semibold text-gray-900">New Journal Voucher</h2>
            <p className="text-xs text-gray-500">Double-entry bookkeeping</p>
          </div>
        </div>

        {/* Date + Narration row */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-4">
          <div className="flex items-center gap-2 shrink-0">
            <Calendar size={14} className="text-gray-400" />
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400" />
          </div>
          <div className="flex-1 flex items-center gap-2">
            <FileText size={14} className="text-gray-400 shrink-0" />
            <input type="text" value={narration} onChange={e => setNarration(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400 placeholder-gray-300"
              placeholder="Narration / description for this voucher…" />
          </div>
        </div>

        {/* ── Active Input Row ── */}
        <div className="px-6 py-4 border-b border-gray-100 bg-indigo-50/40">
          <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-3">Add Entry Line</p>
          <div className="flex items-center gap-3 flex-wrap">

            {/* Dr / Cr toggle */}
            <div className={`flex rounded-lg overflow-hidden border text-xs font-bold shrink-0 ${
              inputDrCr === 'Dr' ? 'border-sky-400' : inputDrCr === 'Cr' ? 'border-rose-400' : 'border-gray-300'}`}>
              <button ref={drBtnRef} type="button"
                onClick={() => setInputDrCr('Dr')}
                className={`px-5 py-2 transition-all ${inputDrCr === 'Dr' ? 'bg-sky-500 text-white' : 'bg-white text-gray-400 hover:text-sky-500'}`}>
                Dr
              </button>
              <button type="button"
                onClick={() => setInputDrCr('Cr')}
                className={`px-5 py-2 transition-all border-l ${inputDrCr === 'Cr' ? 'bg-rose-500 text-white border-rose-400' : 'bg-white text-gray-400 hover:text-rose-500 border-gray-300'}`}>
                Cr
              </button>
            </div>

            {/* Account selector */}
            <div className="flex-[2] min-w-[200px]">
              <AccountSelector
                value={inputAccount}
                onChange={id => setInputAccount(id)}
                onAfterSelect={() => setTimeout(() => narrationRef.current?.focus(), 0)}
                accounts={accounts}
                placeholder="Select account…"
              />
            </div>

            {/* Narration for this line */}
            <input
              ref={narrationRef}
              type="text"
              value={inputNarration}
              onChange={e => setInputNarration(e.target.value)}
              disabled={!amountEnabled}
              onKeyDown={e => { if (e.key === 'Enter') amountRef.current?.focus(); }}
              className="flex-[1.5] min-w-[140px] px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-400 bg-white placeholder-gray-300 disabled:bg-gray-50 disabled:text-gray-300 disabled:border-gray-200 disabled:cursor-not-allowed transition"
              placeholder="Particulars…"
            />

            {/* Amount — enabled only after Dr/Cr selected */}
            <input
              ref={amountRef}
              type="number"
              step="0.01"
              min="0"
              value={inputAmount}
              onChange={e => setInputAmount(e.target.value)}
              disabled={!amountEnabled}
              onKeyDown={e => { if (e.key === 'Enter') addLine(); }}
              className={`w-36 shrink-0 px-3 py-2 text-sm border rounded-lg text-right font-bold font-mono outline-none transition
                ${!amountEnabled
                  ? 'border-gray-200 bg-gray-50 text-gray-300 cursor-not-allowed'
                  : inputDrCr === 'Dr'
                    ? 'border-sky-300 bg-sky-50 text-sky-700 focus:ring-2 focus:ring-sky-300'
                    : 'border-rose-300 bg-rose-50 text-rose-600 focus:ring-2 focus:ring-rose-300'}`}
              placeholder="0.00"
            />

            {/* Add button */}
            <button type="button" onClick={addLine}
              disabled={!amountEnabled || !inputAccount || !inputAmount || Number(inputAmount) <= 0}
              className="shrink-0 flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition disabled:opacity-30 disabled:cursor-not-allowed">
              <Plus size={14} /> Add
            </button>
          </div>
          <p className="text-[10px] text-indigo-300 mt-2 ml-0.5">
            Select Dr or Cr → choose account → enter amount → press <kbd className="bg-white border border-indigo-200 text-indigo-400 px-1 py-0.5 rounded text-[10px] font-mono">Enter</kbd> or click Add
          </p>
        </div>

        {/* ── Lines Table ── */}
        {lines.length > 0 ? (
          <div className="px-6 py-4 border-b border-gray-100">
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <div className="min-w-[580px]">

                  {/* Header */}
                  <div className="grid bg-gray-50 border-b border-gray-200 text-[10px] font-bold text-gray-400 uppercase tracking-wide px-4 py-2.5 gap-3"
                    style={{ gridTemplateColumns: '28px 64px 1fr 1fr 130px 32px' }}>
                    <span className="text-center">#</span>
                    <span className="text-center">Dr/Cr</span>
                    <span>Account</span>
                    <span>Particulars</span>
                    <span className="text-right">Amount (Rs.)</span>
                    <span />
                  </div>

                  {/* Rows */}
                  {lines.map((line, i) => {
                    const isDr = line.dr_cr === 'Dr';
                    const acc = accounts.find(a => String(a.account_id) === String(line.account_id));
                    const tag = acc ? TYPE_TAG[acc.account_type] : null;
                    return (
                      <div key={i}
                        className={`grid gap-3 px-4 py-2.5 border-b border-gray-100 items-center text-sm transition-colors ${isDr ? 'hover:bg-sky-50/30' : 'hover:bg-rose-50/20'}`}
                        style={{ gridTemplateColumns: '28px 64px 1fr 1fr 130px 32px' }}>
                        <span className="text-center text-xs font-mono font-bold text-gray-300 select-none">
                          {String(i + 1).padStart(2, '0')}
                        </span>
                        <div className="flex justify-center">
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${isDr ? 'bg-sky-100 text-sky-700' : 'bg-rose-100 text-rose-600'}`}>
                            {line.dr_cr}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 min-w-0">
                          {tag && <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded ${tag.bg} ${tag.text}`}>{tag.label}</span>}
                          <span className="truncate text-gray-700 font-medium text-xs">{acc?.account_name || '—'}</span>
                        </div>
                        <span className="text-gray-400 text-xs truncate">{line.narration || <span className="text-gray-200">—</span>}</span>
                        <span className={`text-right font-bold font-mono text-xs ${isDr ? 'text-sky-700' : 'text-rose-600'}`}>
                          {fmt(Number(line.amount))}
                        </span>
                        <button type="button" onClick={() => setLines(p => p.filter((_, idx) => idx !== i))}
                          className="flex items-center justify-center w-7 h-7 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    );
                  })}

                  {/* Total / Balance row */}
                  <div className={`grid gap-3 px-4 py-3 items-center ${
                    balanced ? 'bg-emerald-50 border-t border-emerald-200'
                    : 'bg-red-50 border-t border-red-200'}`}
                    style={{ gridTemplateColumns: '28px 64px 1fr 1fr 130px 32px' }}>
                    <span /><span />
                    <span className={`col-span-2 text-xs font-bold uppercase tracking-widest ${balanced ? 'text-emerald-700' : 'text-red-600'}`}>
                      {balanced ? '✓  Balanced — Ready to post' : `Out of balance — diff: ${fmt(diff)}`}
                    </span>
                    <span className={`text-right font-bold font-mono text-xs ${balanced ? 'text-emerald-700' : 'text-red-500'}`}>
                      {fmt(totDr)}
                    </span>
                    <span />
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="px-6 py-8 border-b border-gray-100 text-center">
            <BookOpen size={32} className="mx-auto text-gray-200 mb-2" />
            <p className="text-sm text-gray-300 font-medium">No entries yet — add a line above</p>
          </div>
        )}

        {/* Totals strip + Post button */}
        <div className="px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="bg-sky-50 border border-sky-100 rounded-lg px-4 py-2.5 flex items-center gap-2">
              <TrendingUp size={14} className="text-sky-500" />
              <div>
                <p className="text-[10px] text-sky-500 font-bold uppercase tracking-wide">Total Dr</p>
                <p className="text-sm font-bold text-sky-700 font-mono leading-none mt-0.5">{fmt(totDr)}</p>
              </div>
            </div>
            <div className="bg-rose-50 border border-rose-100 rounded-lg px-4 py-2.5 flex items-center gap-2">
              <TrendingDown size={14} className="text-rose-500" />
              <div>
                <p className="text-[10px] text-rose-500 font-bold uppercase tracking-wide">Total Cr</p>
                <p className="text-sm font-bold text-rose-600 font-mono leading-none mt-0.5">{fmt(totCr)}</p>
              </div>
            </div>
          </div>
          <button type="button" onClick={save} disabled={saving || !balanced}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed">
            {saving
              ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : <Send size={14} />}
            {saving ? 'Posting…' : 'Post Journal Voucher'}
          </button>
        </div>
      </div>
    </div>
  );
};

const JvDeleteModal = ({ entry, onClose, onDeleted }: { entry: any; onClose: () => void; onDeleted: () => void }) => {
  const toast = useToast();
  const [pw, setPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [err, setErr] = useState('');
  const [ready, setReady] = useState(false);
  const [requiresPassword, setRequiresPassword] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    api.get('/settings').then(r => { setRequiresPassword(!!r.data.jv_delete_password_set); setReady(true); }).catch(() => setReady(true));
  }, []);

  const del = async () => {
    if (!ready) return;
    if (requiresPassword) {
      try {
        const res = await api.post('/settings/verify-password', { type: 'jv_delete', password: pw });
        if (!res.data.valid) { setErr('Incorrect password'); setPw(''); return; }
      } catch { setErr('Verification failed'); return; }
    }
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
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="bg-red-600 px-6 py-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
            <AlertTriangle size={20} className="text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-base">Delete Journal Voucher</p>
            <p className="text-red-200 text-xs font-semibold">{entry.entry_number}</p>
          </div>
        </div>
        <div className="p-6">
          <div className="bg-gray-50 rounded-xl p-4 mb-4 space-y-2 text-sm border border-gray-100">
            {[
              ['Date', new Date(entry.entry_date).toLocaleDateString('en-PK')],
              ['Amount', `Rs. ${Number(entry.total_debit).toLocaleString('en-PK', { minimumFractionDigits: 2 })}`],
              ['Status', entry.status],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between">
                <span className="text-gray-400 font-medium">{k}</span>
                <span className="font-bold text-gray-700 capitalize">{v}</span>
              </div>
            ))}
          </div>
          {entry.status === 'posted' && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
              ⚠ Posted entry — account balances will be reversed.
            </p>
          )}
          {ready && requiresPassword && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
                <Lock size={12} /> Password Required
              </label>
              <div className="relative">
                <input autoFocus type={showPw ? 'text' : 'password'} value={pw}
                  onChange={e => { setPw(e.target.value); setErr(''); }}
                  onKeyDown={e => { if (e.key === 'Enter') del(); }}
                  className="w-full px-4 pr-10 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-300 outline-none"
                  placeholder="Enter delete password" />
                <button type="button" onClick={() => setShowPw(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {err && <p className="text-red-500 text-xs mt-1 font-semibold">{err}</p>}
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={onClose}
              className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition">
              Cancel
            </button>
            <button onClick={del} disabled={deleting || !ready || (requiresPassword && !pw)}
              className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold transition disabled:opacity-40 flex items-center justify-center gap-2">
              <Trash2 size={14} /> {deleting ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const JournalEntries = () => {
  const toast = useToast();
  const confirm = useConfirm();
  const [view, setView]                 = useState<'list' | 'new'>('list');
  const [entries, setEntries]           = useState<any[]>([]);
  const [loading, setLoading]           = useState(false);
  const [hasLoaded, setHasLoaded]       = useState(false);
  const [pagination, setPagination]     = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [toDelete, setToDelete]         = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [fromDate, setFromDate]         = useState(localToday);
  const [toDate, setToDate]             = useState(localToday);

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
    const ok = await confirm({ title: 'Post Journal Entry', message: `Post ${entry.entry_number}? This will update account balances.`, type: 'warning' });
    if (!ok) return;
    try {
      await api.post(`/accounting/journal-entries/${entry.entry_id}/post`);
      toast.success('Entry posted'); load();
    } catch (e: any) { toast.error(e.response?.data?.message || 'Failed'); }
  };

  if (view === 'new') return <JVForm onBack={() => setView('list')} onSuccess={load} />;

  const fmt = (n: number) => Number(n).toLocaleString('en-PK', { minimumFractionDigits: 2 });
  const totalDr = entries.reduce((s, e) => s + Number(e.total_debit || 0), 0);
  const totalCr = entries.reduce((s, e) => s + Number(e.total_credit || 0), 0);

  return (
    <div className="p-6">

      {/* Header */}
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <BookOpen size={20} className="text-indigo-600" /> Journal Vouchers
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Double-entry bookkeeping ledger</p>
        </div>
        <button onClick={() => setView('new')}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition">
          <Plus size={14} /> New Journal Voucher
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 mb-4 flex flex-wrap items-center gap-3">
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none text-gray-700 focus:ring-2 focus:ring-indigo-400 bg-white font-medium">
          <option value="all">All Status</option>
          <option value="draft">Draft</option>
          <option value="posted">Posted</option>
        </select>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-400 font-medium">From</span>
          <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-400" />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-400 font-medium">To</span>
          <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-400" />
        </div>
        <button onClick={() => { setPagination(p => ({ ...p, page: 1 })); load(); }} disabled={loading}
          className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition disabled:opacity-60">
          <Search size={13} /> {loading ? 'Loading…' : 'Search'}
        </button>
        <button onClick={() => { setStatusFilter('all'); setFromDate(localToday); setToDate(localToday); setEntries([]); setHasLoaded(false); }}
          className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-500 hover:bg-gray-50 transition">
          <RefreshCw size={13} /> Reset
        </button>
        {hasLoaded && <span className="ml-auto text-xs text-gray-400 font-medium">{pagination.total} entries found</span>}
      </div>

      {/* Summary Cards */}
      {hasLoaded && entries.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 text-center">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Entries</p>
            <p className="text-2xl font-bold text-gray-800 mt-1">{pagination.total}</p>
          </div>
          <div className="bg-sky-50 rounded-xl border border-sky-100 shadow-sm px-4 py-3 text-center">
            <p className="text-xs font-semibold text-sky-500 uppercase tracking-wide">Total Debit</p>
            <p className="text-xl font-bold text-sky-700 mt-1 font-mono">{fmt(totalDr)}</p>
          </div>
          <div className="bg-rose-50 rounded-xl border border-rose-100 shadow-sm px-4 py-3 text-center">
            <p className="text-xs font-semibold text-rose-400 uppercase tracking-wide">Total Credit</p>
            <p className="text-xl font-bold text-rose-600 mt-1 font-mono">{fmt(totalCr)}</p>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {!hasLoaded ? (
          <div className="text-center py-16">
            <BookOpen size={44} className="mx-auto mb-3 text-gray-200" />
            <p className="font-medium text-gray-400">Select filters and click <span className="text-indigo-600">Search</span></p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Voucher #</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Description</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Debit</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Credit</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan={7} className="py-12 text-center">
                    <div className="animate-spin h-7 w-7 rounded-full border-2 border-gray-200 border-t-indigo-600 mx-auto" />
                  </td></tr>
                ) : entries.length > 0 ? entries.map((e, i) => (
                  <tr key={e.entry_id}
                    className={`hover:bg-gray-50 transition ${i % 2 ? 'bg-gray-50/40' : 'bg-white'}`}>
                    <td className="px-4 py-3 font-mono font-bold text-indigo-600 text-xs">{e.entry_number}</td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap font-medium text-xs">
                      {new Date(e.entry_date).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3 text-gray-600 max-w-[180px] truncate text-xs">{e.description || <span className="text-gray-300">—</span>}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-sky-700 text-xs">{fmt(e.total_debit)}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-rose-500 text-xs">{fmt(e.total_credit)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-semibold border capitalize ${
                        e.status === 'posted'  ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                        : e.status === 'draft' ? 'bg-amber-100 text-amber-700 border-amber-200'
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
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition" title="Delete">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan={7} className="py-10 text-center text-gray-400 text-sm font-medium">No entries found</td></tr>
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
