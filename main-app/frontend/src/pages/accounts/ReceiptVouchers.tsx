import { useState, useEffect, useRef } from 'react';
import {
  ArrowDownLeft, Plus, Trash2, Download, Search,
  ChevronDown, ArrowLeft, Pencil, Check, X,
  Building2, Calendar, Hash, FileText
} from 'lucide-react';
import Pagination from '../../components/Pagination';
import api from '../../utils/api';
import { useToast } from '../../components/Toast';
import { localToday } from '../../utils/dateUtils';

// ─────────────────────────── Account Selector ────────────────────────────────
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

  const selected = accounts.find(a => String(a.account_id) === String(value));
  const filtered = accounts.filter(a =>
    !search ||
    a.account_name.toLowerCase().includes(search.toLowerCase()) ||
    a.account_code.includes(search)
  );

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
        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-sm text-left transition-all
          ${selected
            ? 'border-emerald-300 bg-white text-slate-800 font-semibold'
            : 'border-dashed border-emerald-200 bg-emerald-50/50 text-slate-400 hover:border-emerald-300'}`}
      >
        <span className="truncate flex-1">
          {selected ? `${selected.account_code} — ${selected.account_name}` : placeholder}
        </span>
        <ChevronDown size={13} className="text-slate-300 shrink-0 ml-1" />
      </button>

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
              : filtered.map((a, idx) => (
                <li key={a.account_id}>
                  <button
                    type="button"
                    onClick={() => pick(String(a.account_id))}
                    className={`w-full text-left px-3 py-2 flex items-center gap-2 text-sm transition
                      ${idx === hi ? 'bg-emerald-600 text-white' : 'hover:bg-slate-50 text-slate-700'}`}
                  >
                    <span className="font-mono text-xs opacity-60 shrink-0">{a.account_code}</span>
                    <span className="truncate flex-1 font-medium">{a.account_name}</span>
                    <span className="shrink-0 text-xs opacity-50 font-mono">
                      {Number(a.current_balance || 0).toLocaleString()}
                    </span>
                  </button>
                </li>
              ))
            }
          </ul>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────── CRV Form ────────────────────────────────────────
type Line = { voucher_id: number; voucher_number: string; account_id: string; account_name: string; narration: string; amount: number };
type Entry = { account_id: string; narration: string; amount: string };

const CRVForm = ({ onBack, onRefresh }: { onBack: () => void; onRefresh: () => void }) => {
  const toast = useToast();
  const [accounts, setAccounts]           = useState<any[]>([]);
  const [date, setDate]                   = useState(localToday());
  const [voucherNum, setVoucherNum]       = useState('');
  const [mainAccountId, setMainAccountId] = useState('');
  const [savedLines, setSavedLines]       = useState<Line[]>([]);
  const [entry, setEntry]                 = useState<Entry>({ account_id: '', narration: '', amount: '' });
  const [saving, setSaving]               = useState(false);
  const [editingId, setEditingId]         = useState<number | null>(null);

  const narrationRef = useRef<HTMLInputElement>(null);
  const amountRef    = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.get('/accounting/accounts', { params: { tree: 1 } })
      .then(r => setAccounts((r.data.data || []).filter((a: any) => a.is_active && a.level === 4)))
      .catch(() => toast.error('Failed to load accounts'));
    api.get('/accounting/receipt-vouchers/next-number')
      .then(r => setVoucherNum(r.data.voucher_number))
      .catch(() => {});
    api.get('/settings')
      .then(r => { if (r.data.crv_default_account_id) setMainAccountId(String(r.data.crv_default_account_id)); })
      .catch(() => {});
  }, []);

  const resetEntry = () => { setEntry({ account_id: '', narration: '', amount: '' }); setEditingId(null); };

  const saveEntry = async () => {
    if (!mainAccountId) { toast.error('Select the receiving account first'); return; }
    if (!entry.account_id || !entry.amount) { toast.error('Account and Amount required'); return; }
    const amount = parseFloat(entry.amount);
    if (isNaN(amount) || amount <= 0) { toast.error('Enter a valid amount'); return; }
    setSaving(true);
    try {
      if (editingId !== null) await api.delete(`/accounting/receipt-vouchers/${editingId}`);
      const res = await api.post('/accounting/receipt-vouchers', {
        voucher_number: voucherNum, voucher_date: date,
        received_from: entry.narration || '—', receipt_type: 'customer',
        account_id: entry.account_id, main_account_id: mainAccountId,
        amount, payment_method: 'cash', description: entry.narration,
      });
      if (!voucherNum) setVoucherNum(res.data.voucher_number);
      const acct = accounts.find(a => String(a.account_id) === entry.account_id);
      const line: Line = {
        voucher_id: res.data.voucher_id, voucher_number: res.data.voucher_number,
        account_id: entry.account_id, account_name: acct?.account_name ?? '',
        narration: entry.narration, amount,
      };
      setSavedLines(prev => editingId !== null ? prev.map(l => l.voucher_id === editingId ? line : l) : [...prev, line]);
      toast.success(editingId !== null ? 'Entry updated' : 'Entry added');
      resetEntry();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Save failed');
    } finally { setSaving(false); }
  };

  const deleteLine = async (id: number) => {
    try {
      await api.delete(`/accounting/receipt-vouchers/${id}`);
      setSavedLines(prev => prev.filter(l => l.voucher_id !== id));
      if (editingId === id) resetEntry();
    } catch (err: any) { toast.error(err.response?.data?.message || 'Delete failed'); }
  };

  const total = savedLines.reduce((s, l) => s + l.amount, 0);
  const mainAcct = accounts.find(a => String(a.account_id) === mainAccountId);

  return (
    <div className="h-full flex flex-col bg-slate-50">

      {/* ── Top Bar ── */}
      <div className="bg-white border-b border-slate-200 px-5 py-3 flex items-center gap-3 shrink-0">
        <button onClick={() => { onRefresh(); onBack(); }} className="p-2 rounded-lg hover:bg-slate-100 transition text-slate-500">
          <ArrowLeft size={18} />
        </button>
        <div className="w-px h-6 bg-slate-200" />
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center">
            <ArrowDownLeft size={15} className="text-white" />
          </div>
          <div>
            <p className="font-bold text-slate-800 text-sm leading-none">Cash Receipt Voucher</p>
            <p className="text-xs text-slate-400 mt-0.5">Incoming payments</p>
          </div>
        </div>
        {voucherNum && (
          <span className="ml-2 px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold font-mono border border-emerald-200">
            {voucherNum}
          </span>
        )}
      </div>

      {/* ── Voucher Header Card ── */}
      <div className="px-5 pt-4 shrink-0">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Header Banner */}
          <div className="bg-emerald-600 px-5 py-3.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText size={16} className="text-emerald-100" />
              <div>
                <p className="text-white font-bold text-sm tracking-wide">CASH RECEIPT VOUCHER</p>
                {voucherNum && <p className="text-emerald-100 text-xs font-mono">{voucherNum}</p>}
              </div>
            </div>
            <div className="flex items-center gap-2 bg-emerald-500/40 rounded-lg px-3 py-1.5">
              <Calendar size={13} className="text-emerald-100" />
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="bg-transparent text-white text-sm font-mono border-none outline-none cursor-pointer"
              />
            </div>
          </div>

          {/* Receiving Account */}
          <div className="px-5 py-4 border-b border-slate-100">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 shrink-0">
                <Building2 size={15} className="text-emerald-500" />
                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Receiving Account</span>
              </div>
              <div className="flex-1 min-w-[220px] max-w-xs">
                <AccountSelector
                  value={mainAccountId}
                  onChange={setMainAccountId}
                  accounts={accounts}
                  placeholder="Select Cash / Bank account…"
                />
              </div>
              {mainAcct && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg">
                  <span className="text-xs text-emerald-700 font-semibold">{mainAcct.account_name}</span>
                  <span className="text-xs text-slate-400 font-mono">
                    Bal: {Number(mainAcct.current_balance || 0).toLocaleString('en-PK', { minimumFractionDigits: 0 })}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Entry Form */}
          <div className={`px-5 py-4 ${editingId !== null ? 'bg-emerald-50/60' : 'bg-white'}`}>
            {editingId !== null && (
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-emerald-700 uppercase tracking-wide">Editing Entry</span>
                <button onClick={resetEntry} className="text-xs text-slate-400 hover:text-red-500 flex items-center gap-1 transition">
                  <X size={12} /> Cancel
                </button>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_160px_auto] gap-3 items-end">
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5 block">
                  Income Account
                </label>
                <AccountSelector
                  value={entry.account_id}
                  onChange={id => setEntry(v => ({ ...v, account_id: id }))}
                  onAfterSelect={() => narrationRef.current?.focus()}
                  accounts={accounts}
                  placeholder="Select account…"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5 block">
                  Received From / Description
                </label>
                <input
                  ref={narrationRef}
                  type="text"
                  value={entry.narration}
                  onChange={e => setEntry(v => ({ ...v, narration: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter') amountRef.current?.focus(); }}
                  placeholder="e.g. Customer name, invoice #…"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-300 bg-white text-slate-700"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5 block">
                  Amount (Rs.)
                </label>
                <input
                  ref={amountRef}
                  type="number"
                  step="0.01"
                  min="0"
                  value={entry.amount}
                  onChange={e => setEntry(v => ({ ...v, amount: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter') saveEntry(); }}
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-emerald-200 bg-emerald-50 rounded-lg text-sm text-right font-bold font-mono text-emerald-700 outline-none focus:ring-2 focus:ring-emerald-300"
                />
              </div>
              <button
                onClick={saveEntry}
                disabled={saving}
                className="flex items-center justify-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold transition disabled:opacity-50 whitespace-nowrap shadow-sm"
              >
                {saving
                  ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : editingId !== null ? <Check size={14} /> : <Plus size={14} />}
                {editingId !== null ? 'Update' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Lines Table ── */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {savedLines.length === 0 ? (
          <div className="text-center py-14 text-slate-400">
            <div className="w-14 h-14 bg-emerald-50 border-2 border-dashed border-emerald-200 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <ArrowDownLeft size={22} className="text-emerald-300" />
            </div>
            <p className="font-semibold text-slate-500 text-sm">No entries yet</p>
            <p className="text-xs text-slate-400 mt-1">Fill the form above and click Add</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            {/* Table Header */}
            <div className="bg-slate-800 grid px-4 py-2.5 text-[11px] font-bold uppercase tracking-widest text-slate-300"
              style={{ gridTemplateColumns: '1fr 1.2fr 120px 60px' }}>
              <span>Account</span>
              <span>Description</span>
              <span className="text-right">Amount</span>
              <span />
            </div>

            {savedLines.map((line, i) => (
              <div
                key={line.voucher_id}
                className={`grid px-4 py-3 border-b border-slate-100 items-center gap-2 transition
                  ${editingId === line.voucher_id ? 'bg-emerald-50 ring-1 ring-inset ring-emerald-300' : i % 2 === 0 ? 'bg-white hover:bg-slate-50/60' : 'bg-slate-50/30 hover:bg-slate-50/60'}`}
                style={{ gridTemplateColumns: '1fr 1.2fr 120px 60px' }}
              >
                <span className="font-semibold text-slate-700 text-sm truncate">{line.account_name}</span>
                <span className="text-slate-500 text-sm truncate">{line.narration || <span className="text-slate-300">—</span>}</span>
                <span className="text-right font-bold font-mono text-emerald-700 text-sm">
                  {line.amount.toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                </span>
                <div className="flex items-center justify-end gap-1">
                  <button onClick={() => {
                    setEditingId(line.voucher_id);
                    setEntry({ account_id: line.account_id, narration: line.narration, amount: String(line.amount) });
                  }} className="p-1.5 text-slate-300 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition">
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => deleteLine(line.voucher_id)}
                    className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}

            {/* Total Footer */}
            <div className="bg-emerald-600 px-4 py-3 flex items-center justify-between">
              <span className="text-white font-bold text-xs uppercase tracking-wide">
                {savedLines.length} {savedLines.length === 1 ? 'Entry' : 'Entries'}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-emerald-100 text-xs font-semibold uppercase tracking-wide">Total</span>
                <span className="text-white font-black font-mono text-lg">
                  {total.toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      <div className="bg-white border-t border-slate-200 px-5 py-3.5 shrink-0 flex items-center justify-between">
        <div>
          {savedLines.length > 0 && (
            <p className="text-sm text-slate-500">
              <span className="font-bold text-emerald-600">{savedLines.length}</span> entr{savedLines.length === 1 ? 'y' : 'ies'} saved
              <span className="ml-2 text-slate-300">|</span>
              <span className="ml-2 font-mono font-semibold text-slate-700">Rs. {total.toLocaleString('en-PK', { minimumFractionDigits: 2 })}</span>
            </p>
          )}
        </div>
        <button
          onClick={() => { onRefresh(); onBack(); }}
          className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold transition shadow-sm"
        >
          <Check size={15} /> Done
        </button>
      </div>
    </div>
  );
};

// ─────────────────────────── List Page ───────────────────────────────────────
const ReceiptVouchers = () => {
  const toast = useToast();
  const [view, setView] = useState<'list' | 'new'>('list');
  const [vouchers, setVouchers]     = useState<any[]>([]);
  const [loading, setLoading]       = useState(false);
  const [hasLoaded, setHasLoaded]   = useState(false);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [filters, setFilters]       = useState({ from_date: localToday(), to_date: localToday() });

  const fetchVouchers = async () => {
    setLoading(true); setHasLoaded(true);
    try {
      const res = await api.get('/accounting/receipt-vouchers', {
        params: { ...filters, page: pagination.page, limit: pagination.limit }
      });
      setVouchers(res.data.data || []);
      setPagination(res.data.pagination);
    } catch { toast.error('Failed to load receipt vouchers'); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (hasLoaded) fetchVouchers(); }, [pagination.page]);

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this voucher entry?')) return;
    try {
      await api.delete(`/accounting/receipt-vouchers/${id}`);
      toast.success('Deleted'); fetchVouchers();
    } catch (err: any) { toast.error(err.response?.data?.message || 'Delete failed'); }
  };

  const exportCSV = () => {
    const header = 'Voucher #,Date,Account,Description,Amount';
    const rows = vouchers.map(v => [
      v.voucher_number,
      new Date(v.voucher_date).toLocaleDateString(),
      `"${v.account_name || ''}"`,
      `"${v.description || v.received_from || ''}"`,
      Number(v.amount).toFixed(2),
    ].join(','));
    const csv = [header, ...rows].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `crv-${filters.from_date}-to-${filters.to_date}.csv`;
    a.click(); URL.revokeObjectURL(a.href);
  };

  const totalAmt = vouchers.reduce((s, v) => s + Number(v.amount), 0);

  if (view === 'new') return <CRVForm onBack={() => setView('list')} onRefresh={fetchVouchers} />;

  return (
    <div className="p-4 sm:p-6 space-y-4">

      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center shadow-sm">
            <ArrowDownLeft size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Cash Receipt Vouchers</h1>
            <p className="text-sm text-slate-400">Track all incoming payments</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCSV} disabled={vouchers.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50 transition font-medium disabled:opacity-40">
            <Download size={14} /> <span className="hidden sm:inline">Export</span>
          </button>
          <button onClick={() => setView('new')}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-sm transition">
            <Plus size={15} /> New CRV
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3 flex flex-wrap items-center gap-2 sm:gap-3">
        <Hash size={13} className="text-slate-300 hidden sm:block" />
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-400 font-medium">From</span>
          <input type="date" value={filters.from_date}
            onChange={e => setFilters(f => ({ ...f, from_date: e.target.value }))}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-300" />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-400 font-medium">To</span>
          <input type="date" value={filters.to_date}
            onChange={e => setFilters(f => ({ ...f, to_date: e.target.value }))}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-300" />
        </div>
        <button
          onClick={() => { setPagination(p => ({ ...p, page: 1 })); fetchVouchers(); }}
          disabled={loading}
          className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 transition disabled:opacity-60"
        >
          <Search size={13} /> {loading ? 'Loading…' : 'Search'}
        </button>
        {hasLoaded && <span className="ml-auto text-xs text-slate-400">{pagination.total} vouchers</span>}
      </div>

      {/* Summary */}
      {hasLoaded && vouchers.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3 text-center">
            <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide">Vouchers</p>
            <p className="text-2xl font-black text-slate-800 mt-1">{pagination.total}</p>
          </div>
          <div className="bg-white rounded-xl border border-emerald-200 shadow-sm px-4 py-3 text-center">
            <p className="text-xs text-emerald-500 font-semibold uppercase tracking-wide">Total Received</p>
            <p className="text-xl font-black text-emerald-600 mt-1 font-mono">
              {totalAmt.toLocaleString('en-PK', { minimumFractionDigits: 0 })}
            </p>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {!hasLoaded ? (
          <div className="text-center py-14 text-slate-400">
            <ArrowDownLeft size={40} className="mx-auto mb-3 opacity-20" />
            <p className="font-semibold text-slate-500">Select date range and click <strong className="text-emerald-600">Search</strong></p>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-14">
            <div className="animate-spin h-6 w-6 rounded-full border-2 border-emerald-500 border-t-transparent" />
          </div>
        ) : vouchers.length === 0 ? (
          <div className="text-center py-14 text-slate-400">
            <ArrowDownLeft size={40} className="mx-auto mb-3 opacity-20" />
            <p className="font-semibold text-slate-500 text-sm">No vouchers found for this period</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-400">
                    <th className="text-left px-4 py-3 font-bold">Voucher #</th>
                    <th className="text-left px-4 py-3 font-bold">Date</th>
                    <th className="text-left px-4 py-3 font-bold">Account</th>
                    <th className="text-left px-4 py-3 font-bold">Description</th>
                    <th className="text-right px-4 py-3 font-bold text-emerald-500">Amount</th>
                    <th className="w-12 px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {vouchers.map((v, i) => (
                    <tr key={v.voucher_id}
                      className={`border-b border-slate-100 hover:bg-slate-50/60 transition ${i % 2 === 0 ? '' : 'bg-slate-50/30'}`}>
                      <td className="px-4 py-3 font-mono font-bold text-emerald-600 text-xs">{v.voucher_number}</td>
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap text-xs">
                        {new Date(v.voucher_date).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-3 text-slate-700 font-semibold">{v.account_name}</td>
                      <td className="px-4 py-3 text-slate-500 max-w-[160px] truncate">{v.description || v.received_from || <span className="text-slate-300">—</span>}</td>
                      <td className="px-4 py-3 text-right font-bold font-mono text-emerald-700">
                        {Number(v.amount).toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => handleDelete(v.voucher_id)}
                          className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition">
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-emerald-600 text-white">
                    <td colSpan={4} className="px-4 py-3 font-bold text-xs uppercase tracking-wide">Total (this page)</td>
                    <td className="px-4 py-3 text-right font-black font-mono">{totalAmt.toLocaleString('en-PK', { minimumFractionDigits: 2 })}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
            <Pagination
              currentPage={pagination.page} totalPages={pagination.totalPages}
              onPageChange={page => setPagination(p => ({ ...p, page }))}
              totalItems={pagination.total} itemsPerPage={pagination.limit}
              onItemsPerPageChange={limit => setPagination(p => ({ ...p, limit, page: 1 }))}
            />
          </>
        )}
      </div>
    </div>
  );
};

export default ReceiptVouchers;
