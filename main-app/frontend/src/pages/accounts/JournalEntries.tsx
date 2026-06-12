import { useState, useEffect, useRef } from 'react';
import { FileText, Plus, Send, Trash2, ChevronDown, Search, Lock, Eye, EyeOff, AlertTriangle, CheckCircle2, XCircle, ArrowLeft, Hash, Calendar, AlignLeft } from 'lucide-react';
import Pagination from '../../components/Pagination';
import api from '../../utils/api';
import { useToast } from '../../components/Toast';
import { localToday, localMonthStart } from '../../utils/dateUtils';
import ReportPasswordGate from '../../components/ReportPasswordGate';

const AccountSelector = ({
  value, onChange, accounts, onAfterSelect, placeholder = 'Select Account...'
}: {
  value: string; onChange: (id: string) => void; accounts: any[]; onAfterSelect?: () => void; placeholder?: string;
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [hi, setHi] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const selected = accounts.find(a => String(a.account_id) === String(value));
  const filtered = accounts.filter(a =>
    !search || a.account_name.toLowerCase().includes(search.toLowerCase()) || a.account_code.includes(search)
  );

  useEffect(() => { setHi(0); }, [search]);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const selectAccount = (id: string) => {
    onChange(id); setOpen(false); setSearch(''); setHi(0);
    setTimeout(() => onAfterSelect?.(), 0);
  };

  const typeColor: Record<string, string> = {
    asset: 'bg-blue-100 text-blue-700',
    liability: 'bg-rose-100 text-rose-700',
    equity: 'bg-purple-100 text-purple-700',
    revenue: 'bg-emerald-100 text-emerald-700',
    expense: 'bg-amber-100 text-amber-700',
  };

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white hover:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-left transition group">
        <div className="flex items-center gap-2 min-w-0">
          {selected ? (
            <>
              <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${typeColor[selected.account_type] || 'bg-gray-100 text-gray-600'}`}>
                {selected.account_type?.slice(0,3)}
              </span>
              <span className="text-gray-400 font-mono text-xs shrink-0">{selected.account_code}</span>
              <span className="text-gray-800 font-medium truncate">{selected.account_name}</span>
            </>
          ) : (
            <span className="text-gray-400">{placeholder}</span>
          )}
        </div>
        <ChevronDown size={14} className="text-gray-400 shrink-0 ml-1 group-hover:text-indigo-500 transition" />
      </button>
      {selected && (
        <p className="text-[11px] text-gray-400 mt-0.5 px-1">
          Balance: <span className="font-semibold text-gray-600">{Number(selected.current_balance || 0).toLocaleString('en-PK', { minimumFractionDigits: 2 })}</span>
        </p>
      )}
      {open && (
        <div className="absolute z-50 left-0 top-full mt-1 w-80 bg-white border border-gray-200 rounded-xl shadow-2xl">
          <div className="p-2 border-b border-gray-100">
            <div className="flex items-center gap-2 px-2 py-1.5 bg-gray-50 rounded-lg">
              <Search size={13} className="text-gray-400" />
              <input autoFocus type="text" value={search} onChange={e => setSearch(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'ArrowDown') { e.preventDefault(); setHi(h => Math.min(h + 1, filtered.length - 1)); }
                  else if (e.key === 'ArrowUp') { e.preventDefault(); setHi(h => Math.max(h - 1, 0)); }
                  else if (e.key === 'Enter') { e.preventDefault(); if (filtered.length > 0) selectAccount(String(filtered[hi]?.account_id ?? filtered[0].account_id)); }
                  else if (e.key === 'Escape') setOpen(false);
                }}
                className="bg-transparent text-sm outline-none w-full placeholder-gray-400"
                placeholder="Search by name or code..." />
            </div>
          </div>
          <ul className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 && <li className="px-3 py-3 text-sm text-gray-400 text-center">No accounts found</li>}
            {filtered.map((a, idx) => (
              <li key={a.account_id}>
                <button type="button" onClick={() => selectAccount(String(a.account_id))}
                  className={`w-full text-left px-3 py-2 flex items-center gap-2 transition ${idx === hi ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-gray-50'}`}>
                  <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${typeColor[a.account_type] || 'bg-gray-100 text-gray-600'}`}>
                    {a.account_type?.slice(0,3)}
                  </span>
                  <span className="text-xs text-gray-400 font-mono shrink-0">{a.account_code}</span>
                  <span className="text-sm text-gray-800 truncate flex-1">{a.account_name}</span>
                  <span className="text-xs text-gray-400 shrink-0 font-mono">{Number(a.current_balance || 0).toLocaleString()}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

type JvLine = { dr_cr: 'Dr' | 'Cr'; account_id: string; narration: string; debit: string; credit: string };
const emptyLine = (): JvLine => ({ dr_cr: 'Dr', account_id: '', narration: '', debit: '', credit: '' });

// ── JV Entry Form ─────────────────────────────────────────────────────────────
const JournalEntryForm = ({ onBack, onSuccess }: { onBack: () => void; onSuccess: () => void }) => {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [entryDate, setEntryDate] = useState(localToday());
  const [description, setDescription] = useState('');
  const [lines, setLines] = useState<JvLine[]>([emptyLine(), emptyLine()]);
  const narrationRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    api.get('/accounting/accounts', { params: { tree: 1 } })
      .then(r => setAccounts((r.data.data || []).filter((a: any) => a.is_active && a.level === 4)))
      .catch(() => {});
  }, []);

  const updateLine = (i: number, patch: Partial<JvLine>) =>
    setLines(prev => prev.map((l, idx) => idx === i ? { ...l, ...patch } : l));

  const handleDrCr = (i: number, val: 'Dr' | 'Cr') => {
    setLines(prev => {
      const others = prev.filter((_, idx) => idx !== i);
      const otherDr = others.reduce((s, l) => s + Number(l.debit || 0), 0);
      const otherCr = others.reduce((s, l) => s + Number(l.credit || 0), 0);
      const remaining = parseFloat(Math.abs(otherDr - otherCr).toFixed(2));
      return prev.map((l, idx) => {
        if (idx !== i) return l;
        const existingAmt = l.debit || l.credit || '';
        const autoAmt = remaining > 0 ? String(remaining) : existingAmt;
        return { ...l, dr_cr: val, debit: val === 'Dr' ? autoAmt : '', credit: val === 'Cr' ? autoAmt : '' };
      });
    });
  };

  const handleAmountChange = (i: number, val: string) =>
    setLines(prev => prev.map((l, idx) => {
      if (idx !== i) return l;
      return l.dr_cr === 'Dr' ? { ...l, debit: val, credit: '' } : { ...l, credit: val, debit: '' };
    }));

  const totals = lines.reduce((acc, l) => ({
    debit: acc.debit + Number(l.debit || 0),
    credit: acc.credit + Number(l.credit || 0)
  }), { debit: 0, credit: 0 });

  const diff = Math.abs(totals.debit - totals.credit);
  const isBalanced = lines.length >= 2 && diff < 0.01 && totals.debit > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isBalanced) { toast.error('Debits must equal credits and total must be > 0'); return; }
    setLoading(true);
    try {
      await api.post('/accounting/journal-entries', {
        entry_date: entryDate, description,
        lines: lines.filter(l => l.account_id).map(l => ({
          account_id: l.account_id, description: l.narration,
          debit: Number(l.debit || 0), credit: Number(l.credit || 0)
        }))
      });
      toast.success('Journal entry created successfully');
      onSuccess();
      onBack();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create entry');
    } finally {
      setLoading(false);
    }
  };

  const filledLines = lines.filter(l => l.account_id && (Number(l.debit) > 0 || Number(l.credit) > 0));

  return (
    <div className="h-full flex flex-col bg-gray-50/60">

      {/* ── Top Bar ── */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3.5 shrink-0 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button onClick={onBack}
              className="w-9 h-9 bg-gray-100 hover:bg-gray-200 rounded-xl flex items-center justify-center transition">
              <ArrowLeft size={17} className="text-gray-600" />
            </button>
            <div className="w-9 h-9 bg-indigo-100 rounded-xl flex items-center justify-center">
              <FileText size={17} className="text-indigo-700" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-gray-900 leading-tight">New Journal Voucher</h2>
              <p className="text-xs text-gray-400 hidden sm:block">Double-entry bookkeeping</p>
            </div>
          </div>

          {/* Balance Status Badge */}
          <div className="flex items-center gap-3">
            {isBalanced ? (
              <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold border border-emerald-200">
                <CheckCircle2 size={13} /> Balanced
              </span>
            ) : totals.debit > 0 ? (
              <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-100 text-red-600 rounded-full text-xs font-bold border border-red-200">
                <XCircle size={13} /> Diff: {diff.toLocaleString('en-PK', { minimumFractionDigits: 2 })}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {/* ── Voucher Header Card ── */}
      <div className="px-4 sm:px-6 pt-4 shrink-0">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Date */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                <Calendar size={12} /> Voucher Date
              </label>
              <input type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white transition" required />
            </div>
            {/* Narration */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                <AlignLeft size={12} /> Narration / Description
              </label>
              <input type="text" value={description} onChange={e => setDescription(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white transition"
                placeholder="General narration for this journal entry..." />
            </div>
          </div>
        </div>
      </div>

      {/* ── Lines Table ── */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
        <form id="jv-form" onSubmit={handleSubmit}>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">

            {/* Table Header */}
            <div className="grid items-center bg-gray-50 border-b border-gray-200 px-3 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wider"
              style={{ gridTemplateColumns: '32px 72px 1fr 1fr 120px 120px 36px' }}>
              <span className="text-center">#</span>
              <span className="text-center">Type</span>
              <span className="pl-2">Account</span>
              <span className="pl-2">Narration</span>
              <span className="text-right pr-2">Debit</span>
              <span className="text-right pr-2">Credit</span>
              <span />
            </div>

            {/* Lines */}
            {lines.map((line, i) => (
              <div key={i}
                className={`grid items-start gap-0 border-b border-gray-100 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}
                style={{ gridTemplateColumns: '32px 72px 1fr 1fr 120px 120px 36px' }}>

                {/* Row # */}
                <div className="flex items-center justify-center pt-3 pb-2">
                  <span className="text-[11px] font-mono text-gray-300">{String(i + 1).padStart(2, '0')}</span>
                </div>

                {/* Dr/Cr Toggle */}
                <div className="flex items-center justify-center pt-2.5 pb-2 px-1">
                  <div className="flex rounded-lg overflow-hidden border border-gray-200 bg-gray-100">
                    <button type="button" onClick={() => handleDrCr(i, 'Dr')}
                      className={`px-2.5 py-1.5 text-xs font-bold transition leading-none ${line.dr_cr === 'Dr'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-gray-500 hover:text-indigo-600 hover:bg-gray-50'}`}>
                      Dr
                    </button>
                    <button type="button" onClick={() => handleDrCr(i, 'Cr')}
                      className={`px-2.5 py-1.5 text-xs font-bold transition leading-none ${line.dr_cr === 'Cr'
                        ? 'bg-rose-500 text-white shadow-sm'
                        : 'text-gray-500 hover:text-rose-500 hover:bg-gray-50'}`}>
                      Cr
                    </button>
                  </div>
                </div>

                {/* Account */}
                <div className="py-2 pr-2">
                  <AccountSelector
                    value={line.account_id}
                    onChange={id => updateLine(i, { account_id: id })}
                    onAfterSelect={() => narrationRefs.current[i]?.focus()}
                    accounts={accounts}
                  />
                </div>

                {/* Narration */}
                <div className="py-2 pr-2">
                  <input ref={el => { narrationRefs.current[i] = el; }}
                    type="text" value={line.narration}
                    onChange={e => updateLine(i, { narration: e.target.value })}
                    className="w-full px-2.5 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 bg-white outline-none transition"
                    placeholder="Line narration..." />
                </div>

                {/* Debit */}
                <div className="py-2 pr-2">
                  <input type="number" step="0.01" min="0"
                    value={line.dr_cr === 'Dr' ? (line.debit || '') : ''}
                    onChange={e => handleAmountChange(i, e.target.value)}
                    disabled={line.dr_cr === 'Cr'}
                    className={`w-full px-2.5 py-2 border rounded-lg text-sm text-right font-semibold outline-none transition ${
                      line.dr_cr === 'Dr'
                        ? 'border-indigo-200 bg-indigo-50 text-indigo-700 focus:ring-2 focus:ring-indigo-400'
                        : 'border-gray-100 bg-gray-100 text-gray-300 cursor-not-allowed'}`}
                    placeholder="0.00" />
                </div>

                {/* Credit */}
                <div className="py-2 pr-2">
                  <input type="number" step="0.01" min="0"
                    value={line.dr_cr === 'Cr' ? (line.credit || '') : ''}
                    onChange={e => handleAmountChange(i, e.target.value)}
                    disabled={line.dr_cr === 'Dr'}
                    className={`w-full px-2.5 py-2 border rounded-lg text-sm text-right font-semibold outline-none transition ${
                      line.dr_cr === 'Cr'
                        ? 'border-rose-200 bg-rose-50 text-rose-600 focus:ring-2 focus:ring-rose-400'
                        : 'border-gray-100 bg-gray-100 text-gray-300 cursor-not-allowed'}`}
                    placeholder="0.00" />
                </div>

                {/* Delete */}
                <div className="flex items-center justify-center pt-2.5">
                  <button type="button" onClick={() => setLines(prev => prev.filter((_, idx) => idx !== i))}
                    disabled={lines.length <= 2}
                    className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition disabled:opacity-20 disabled:cursor-not-allowed">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}

            {/* Totals Bar */}
            <div className={`grid items-center px-3 py-3 ${isBalanced ? 'bg-emerald-600' : totals.debit > 0 ? 'bg-rose-600' : 'bg-gray-700'} text-white`}
              style={{ gridTemplateColumns: '32px 72px 1fr 1fr 120px 120px 36px' }}>
              <div />
              <div />
              <div className="pl-2 text-xs font-bold uppercase tracking-wide col-span-2">
                {isBalanced ? '✓ Balanced' : totals.debit > 0 ? `Difference: ${diff.toLocaleString('en-PK', { minimumFractionDigits: 2 })}` : 'Total'}
              </div>
              <div className="text-right pr-2 font-mono font-bold text-sm">
                {totals.debit.toLocaleString('en-PK', { minimumFractionDigits: 2 })}
              </div>
              <div className="text-right pr-2 font-mono font-bold text-sm">
                {totals.credit.toLocaleString('en-PK', { minimumFractionDigits: 2 })}
              </div>
              <div />
            </div>
          </div>
        </form>
      </div>

      {/* ── Footer ── */}
      <div className="px-4 sm:px-6 py-4 bg-white border-t border-gray-200 shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-3">
            <button type="button" onClick={() => setLines(prev => [...prev, emptyLine()])}
              className="flex items-center gap-1.5 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-3 py-2 rounded-lg text-sm font-medium transition">
              <Plus size={14} /> Add Line
            </button>
            <span className="text-xs text-gray-400">{filledLines.length} of {lines.length} lines filled</span>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onBack}
              className="px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-100 transition font-medium">
              Cancel
            </button>
            <button type="submit" form="jv-form" disabled={loading || !isBalanced}
              className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition disabled:opacity-40 disabled:cursor-not-allowed shadow-sm">
              {loading
                ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                : <Send size={14} />}
              {loading ? 'Saving...' : 'Save Journal Voucher'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Delete Modal ──────────────────────────────────────────────────────────────
const JvDeleteModal = ({ entry, onClose, onDeleted }: { entry: any; onClose: () => void; onDeleted: () => void }) => {
  const toast = useToast();
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [correctPw, setCorrectPw] = useState('');
  const [pwLoaded, setPwLoaded] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    api.get('/settings').then(res => { setCorrectPw(res.data.jv_delete_password || ''); setPwLoaded(true); }).catch(() => setPwLoaded(true));
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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex flex-col items-center mb-5">
          <div className="w-14 h-14 bg-red-50 border-2 border-red-200 rounded-2xl flex items-center justify-center mb-3">
            <AlertTriangle size={28} className="text-red-500" />
          </div>
          <h2 className="text-lg font-bold text-gray-900">Delete Journal Voucher</h2>
          <p className="text-sm text-gray-500 mt-1 text-center">
            This action <span className="font-semibold text-red-600">cannot be undone</span>.
            {entry.status === 'posted' && ' Account balances will be reversed.'}
          </p>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 mb-5 text-sm space-y-1.5">
          <div className="flex justify-between"><span className="text-gray-500">Voucher #</span><span className="font-mono font-bold text-gray-800">{entry.entry_number}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">Date</span><span className="text-gray-700">{new Date(entry.entry_date).toLocaleDateString()}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">Amount</span><span className="font-semibold text-gray-800">{Number(entry.total_debit).toLocaleString('en-PK', { minimumFractionDigits: 2 })}</span></div>
          <div className="flex justify-between">
            <span className="text-gray-500">Status</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${entry.status === 'posted' ? 'bg-emerald-100 text-emerald-700' : 'bg-yellow-100 text-yellow-700'}`}>{entry.status}</span>
          </div>
        </div>
        {pwLoaded && correctPw && (
          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-700 mb-1.5"><Lock size={13} className="inline mr-1" /> Enter Password to Confirm</label>
            <div className="relative">
              <input autoFocus type={showPw ? 'text' : 'password'} value={password}
                onChange={e => { setPassword(e.target.value); setError(''); }}
                onKeyDown={e => { if (e.key === 'Enter') handleDelete(); }}
                placeholder="Enter password..."
                className="w-full pl-4 pr-10 py-2.5 border-2 border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-red-400 focus:border-red-400 outline-none transition" />
              <button type="button" onClick={() => setShowPw(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {error && <p className="text-red-500 text-xs mt-1.5">{error}</p>}
          </div>
        )}
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition">Cancel</button>
          <button onClick={handleDelete} disabled={deleting || !pwLoaded || (!!correctPw && !password)}
            className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
            <Trash2 size={15} /> {deleting ? 'Deleting...' : 'Delete Permanently'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Main List Page ─────────────────────────────────────────────────────────────
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

  const handleLoad = () => { setPagination(p => ({ ...p, page: 1 })); fetchEntries(); };

  const handlePost = async (entry: any) => {
    if (!window.confirm(`Post journal entry ${entry.entry_number}? This will update account balances.`)) return;
    try {
      await api.post(`/accounting/journal-entries/${entry.entry_id}/post`);
      toast.success('Entry posted successfully');
      fetchEntries();
    } catch (err: any) { toast.error(err.response?.data?.message || 'Failed to post'); }
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      draft: 'bg-amber-100 text-amber-700 border border-amber-200',
      posted: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
      reversed: 'bg-red-100 text-red-700 border border-red-200'
    };
    return <span className={`px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${map[status] ?? 'bg-gray-100 text-gray-600'}`}>{status}</span>;
  };

  const totalDebit  = entries.reduce((s, e) => s + Number(e.total_debit || 0), 0);
  const totalCredit = entries.reduce((s, e) => s + Number(e.total_credit || 0), 0);

  if (view === 'new') return <JournalEntryForm onBack={() => setView('list')} onSuccess={fetchEntries} />;

  return (
    <div className="p-4 sm:p-6 space-y-4">

      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-indigo-500 to-purple-500" />
        <div className="px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
              <FileText size={20} className="text-indigo-700" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-gray-900">Journal Vouchers</h1>
              <p className="text-xs sm:text-sm text-gray-500">Double-entry accounting transactions</p>
            </div>
          </div>
          <button onClick={() => setView('new')}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl hover:bg-indigo-700 transition shadow-sm text-sm font-semibold">
            <Plus size={15} /> New JV
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 sm:px-5 py-3.5">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <Hash size={14} className="text-gray-400 hidden sm:block" />
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white">
            <option value="all">All Status</option>
            <option value="draft">Draft</option>
            <option value="posted">Posted</option>
          </select>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-400 font-medium">From</span>
            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
              className="px-2 sm:px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-400 font-medium">To</span>
            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
              className="px-2 sm:px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
          </div>
          <button onClick={handleLoad} disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition disabled:opacity-60 shadow-sm">
            <Search size={14} /> {loading ? 'Loading...' : 'Load'}
          </button>
          {hasLoaded && (
            <span className="ml-auto text-xs text-gray-400">{pagination.total} entries</span>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      {hasLoaded && entries.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 text-center">
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">Entries</p>
            <p className="text-xl font-bold text-gray-800">{pagination.total}</p>
          </div>
          <div className="bg-white rounded-xl border border-indigo-100 shadow-sm px-4 py-3 text-center">
            <p className="text-xs text-indigo-400 font-medium uppercase tracking-wide mb-1">Total Debit</p>
            <p className="text-lg font-bold text-indigo-700 font-mono">{totalDebit.toLocaleString('en-PK', { minimumFractionDigits: 0 })}</p>
          </div>
          <div className="bg-white rounded-xl border border-rose-100 shadow-sm px-4 py-3 text-center">
            <p className="text-xs text-rose-400 font-medium uppercase tracking-wide mb-1">Total Credit</p>
            <p className="text-lg font-bold text-rose-600 font-mono">{totalCredit.toLocaleString('en-PK', { minimumFractionDigits: 0 })}</p>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {!hasLoaded ? (
          <div className="text-center py-16 text-gray-400">
            <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <FileText size={24} className="opacity-30" />
            </div>
            <p className="font-semibold text-gray-500 text-sm">Set date range and click <strong className="text-indigo-600">Load</strong></p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs uppercase tracking-wider text-gray-500">
                  <th className="text-left px-4 py-3 font-semibold">Entry #</th>
                  <th className="text-left px-4 py-3 font-semibold">Date</th>
                  <th className="text-left px-4 py-3 font-semibold">Description</th>
                  <th className="text-right px-4 py-3 font-semibold text-indigo-600">Debit</th>
                  <th className="text-right px-4 py-3 font-semibold text-rose-500">Credit</th>
                  <th className="text-center px-4 py-3 font-semibold">Status</th>
                  <th className="text-center px-4 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="p-8 text-center">
                    <div className="animate-spin h-6 w-6 rounded-full border-2 border-indigo-500 border-t-transparent mx-auto" />
                  </td></tr>
                ) : entries.length > 0 ? (
                  entries.map((entry: any, i: number) => (
                    <tr key={entry.entry_id} className={`border-b border-gray-50 hover:bg-indigo-50/20 transition ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                      <td className="px-4 py-3 font-mono font-bold text-indigo-700 text-sm">{entry.entry_number}</td>
                      <td className="px-4 py-3 text-gray-500 text-sm whitespace-nowrap">
                        {new Date(entry.entry_date).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-sm max-w-[200px] truncate">{entry.description || '—'}</td>
                      <td className="px-4 py-3 text-right font-semibold text-sm text-indigo-700 font-mono">
                        {Number(entry.total_debit).toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-sm text-rose-600 font-mono">
                        {Number(entry.total_credit).toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-center">{statusBadge(entry.status)}</td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {entry.status === 'draft' && (
                            <button onClick={() => handlePost(entry)}
                              className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                              title="Post Entry">
                              <Send size={14} />
                            </button>
                          )}
                          <button onClick={() => setDeleteEntry(entry)}
                            className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                            title="Delete">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={7} className="p-8 text-center text-gray-400 text-sm">No entries found for this period</td></tr>
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

      {deleteEntry && <JvDeleteModal entry={deleteEntry} onClose={() => setDeleteEntry(null)} onDeleted={fetchEntries} />}
    </div>
  );
};

const JournalEntriesWithGate = () => <ReportPasswordGate><JournalEntries /></ReportPasswordGate>;
export default JournalEntriesWithGate;
