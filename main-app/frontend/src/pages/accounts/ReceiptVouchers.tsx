import { useState, useEffect, useRef } from 'react';
import { ArrowDownCircle, Plus, Trash2, Download, Search, ChevronDown, ArrowLeft, Pencil, Check, X } from 'lucide-react';
import Pagination from '../../components/Pagination';
import api from '../../utils/api';
import { useToast } from '../../components/Toast';
import { localToday, localMonthStart } from '../../utils/dateUtils';

const AccountSelector = ({
  value, onChange, accounts, onAfterSelect,
}: {
  value: string; onChange: (id: string) => void; accounts: any[]; onAfterSelect?: () => void;
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

  const select = (id: string) => {
    onChange(id); setOpen(false); setSearch(''); setHi(0);
    setTimeout(() => onAfterSelect?.(), 0);
  };

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white hover:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-left transition">
        <span className={selected ? 'text-gray-900 font-medium truncate' : 'text-gray-400'}>
          {selected ? `${selected.account_code} — ${selected.account_name}` : 'Select Account…'}
        </span>
        <ChevronDown size={13} className="text-gray-400 shrink-0 ml-1" />
      </button>
      {open && (
        <div className="absolute z-50 left-0 top-full mt-1 w-72 sm:w-80 bg-white border border-gray-200 rounded-xl shadow-2xl">
          <div className="p-2 border-b border-gray-100">
            <div className="flex items-center gap-2 px-2 py-1.5 bg-gray-50 rounded-lg">
              <Search size={13} className="text-gray-400 shrink-0" />
              <input autoFocus type="text" value={search} onChange={e => setSearch(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'ArrowDown') { e.preventDefault(); setHi(h => Math.min(h + 1, filtered.length - 1)); }
                  else if (e.key === 'ArrowUp') { e.preventDefault(); setHi(h => Math.max(h - 1, 0)); }
                  else if (e.key === 'Enter') { e.preventDefault(); if (filtered[hi]) select(String(filtered[hi].account_id)); }
                  else if (e.key === 'Escape') setOpen(false);
                }}
                className="bg-transparent text-sm outline-none w-full placeholder-gray-400"
                placeholder="Search by name or code…" />
            </div>
          </div>
          <ul className="max-h-52 overflow-y-auto py-1">
            {filtered.length === 0
              ? <li className="px-3 py-3 text-sm text-gray-400 text-center">No accounts found</li>
              : filtered.map((a, idx) => (
                <li key={a.account_id}>
                  <button type="button" onClick={() => select(String(a.account_id))}
                    className={`w-full text-left px-3 py-2 flex items-center gap-2 text-sm transition ${idx === hi ? 'bg-emerald-50 text-emerald-700' : 'hover:bg-gray-50'}`}>
                    <span className="font-mono text-xs text-gray-400 shrink-0">{a.account_code}</span>
                    <span className="text-gray-800 truncate">{a.account_name}</span>
                  </button>
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
};

// ── Full-page CRV Entry Form ──────────────────────────────────────────────────
type SavedLine = { voucher_id: number; voucher_number: string; account_id: string; account_name: string; narration: string; amount: number };

const CRVForm = ({ onBack, onRefresh }: { onBack: () => void; onRefresh: () => void }) => {
  const toast = useToast();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [date, setDate] = useState(localToday());
  const [voucherNumber, setVoucherNumber] = useState('');
  const [mainAccountId, setMainAccountId] = useState('');
  const [savedLines, setSavedLines] = useState<SavedLine[]>([]);
  const [entry, setEntry] = useState({ account_id: '', narration: '', amount: '' });
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const narrationRef = useRef<HTMLInputElement>(null);
  const amountRef    = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.get('/accounting/accounts', { params: { tree: 1 } })
      .then(r => setAccounts((r.data.data || []).filter((a: any) => a.is_active && a.level === 4)))
      .catch(() => toast.error('Failed to load accounts. Check DB migration.'));
    api.get('/accounting/receipt-vouchers/next-number')
      .then(r => setVoucherNumber(r.data.voucher_number))
      .catch(() => {});
  }, []);

  const resetEntry = () => {
    setEntry({ account_id: '', narration: '', amount: '' });
    setEditingId(null);
  };

  const saveEntry = async () => {
    if (!date || !mainAccountId) { toast.error('Main Account is required'); return; }
    if (!entry.account_id || !entry.amount) { toast.error('Account and Amount are required'); return; }
    const amount = parseFloat(entry.amount);
    if (isNaN(amount) || amount <= 0) { toast.error('Enter a valid amount'); return; }
    setSaving(true);
    try {
      if (editingId !== null) {
        await api.delete(`/accounting/receipt-vouchers/${editingId}`);
      }
      const res = await api.post('/accounting/receipt-vouchers', {
        voucher_number: voucherNumber,
        voucher_date: date, received_from: entry.narration || '—',
        receipt_type: 'customer', account_id: entry.account_id,
        main_account_id: mainAccountId,
        amount, payment_method: 'cash', description: entry.narration,
      });
      if (!voucherNumber) setVoucherNumber(res.data.voucher_number);
      const acct = accounts.find(a => String(a.account_id) === entry.account_id);
      const newLine: SavedLine = {
        voucher_id: res.data.voucher_id, voucher_number: res.data.voucher_number,
        account_id: entry.account_id, account_name: acct?.account_name ?? '',
        narration: entry.narration, amount,
      };
      if (editingId !== null) {
        setSavedLines(prev => prev.map(l => l.voucher_id === editingId ? newLine : l));
        toast.success('Entry updated');
      } else {
        setSavedLines(prev => [...prev, newLine]);
        toast.success('Entry saved');
      }
      resetEntry();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Save failed');
    } finally { setSaving(false); }
  };

  const startEdit = (line: SavedLine) => {
    setEntry({ account_id: line.account_id, narration: line.narration, amount: String(line.amount) });
    setEditingId(line.voucher_id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const deleteLine = async (voucher_id: number) => {
    try {
      await api.delete(`/accounting/receipt-vouchers/${voucher_id}`);
      setSavedLines(prev => prev.filter(l => l.voucher_id !== voucher_id));
    } catch (err: any) { toast.error(err.response?.data?.message || 'Delete failed'); }
  };

  const handleDone = () => { onRefresh(); onBack(); };
  const total = savedLines.reduce((s, l) => s + l.amount, 0);

  return (
    <div className="h-full flex flex-col bg-gray-50">

      {/* Top Bar */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4 shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button onClick={handleDone}
              className="w-9 h-9 bg-gray-100 hover:bg-gray-200 rounded-xl flex items-center justify-center transition">
              <ArrowLeft size={17} className="text-gray-600" />
            </button>
            <div className="w-9 h-9 bg-emerald-100 rounded-xl flex items-center justify-center">
              <ArrowDownCircle size={17} className="text-emerald-700" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-gray-900">Cash Receipt Voucher</h2>
                {voucherNumber && (
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-lg text-sm font-mono font-bold">{voucherNumber}</span>
                )}
              </div>
              <p className="text-xs text-gray-500">Sab entries is ek voucher mein save hongi</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-500 hidden sm:block">Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
          </div>
        </div>
      </div>

      {/* Main Account Row */}
      <div className="px-4 sm:px-6 py-3 bg-blue-50 border-b border-blue-100 shrink-0">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-semibold text-blue-700 uppercase tracking-wider whitespace-nowrap">Main Account</span>
          <div className="flex-1 min-w-[220px] max-w-xs">
            <AccountSelector
              value={mainAccountId}
              onChange={setMainAccountId}
              accounts={accounts}
            />
          </div>
          {mainAccountId && (
            <span className="text-xs text-blue-600 font-medium">
              {accounts.find(a => String(a.account_id) === mainAccountId)?.account_name}
            </span>
          )}
        </div>
      </div>

      {/* Entry Form */}
      <div className={`px-4 sm:px-6 py-4 bg-white border-b shrink-0 ${editingId !== null ? 'border-emerald-300 bg-emerald-50/40' : 'border-gray-100'}`}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            {editingId !== null ? '✏️ Editing Entry' : 'New Entry'}
          </p>
          {editingId !== null && (
            <button onClick={resetEntry} className="text-xs text-gray-400 hover:text-red-500 flex items-center gap-1 transition">
              <X size={13} /> Cancel Edit
            </button>
          )}
        </div>
        {/* Row 1: Account + Description */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1.5 block">Account</label>
            <AccountSelector value={entry.account_id}
              onChange={id => setEntry(v => ({ ...v, account_id: id }))}
              onAfterSelect={() => narrationRef.current?.focus()}
              accounts={accounts} />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1.5 block">Description / Received From</label>
            <input ref={narrationRef} type="text" value={entry.narration}
              onChange={e => setEntry(v => ({ ...v, narration: e.target.value }))}
              onKeyDown={e => { if (e.key === 'Enter') amountRef.current?.focus(); }}
              placeholder="e.g. Customer Name, Invoice #..."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 bg-white outline-none" />
          </div>
        </div>
        {/* Row 2: Amount | Save Button */}
        <div className="flex items-end gap-3">
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1.5 block">Amount</label>
            <input ref={amountRef} type="number" step="0.01" min="0"
              value={entry.amount}
              onChange={e => setEntry(v => ({ ...v, amount: e.target.value }))}
              onKeyDown={e => { if (e.key === 'Enter') saveEntry(); }}
              placeholder="0.00"
              className="w-48 px-3 py-2 border border-emerald-200 bg-emerald-50 rounded-lg text-sm text-right font-semibold text-emerald-700 focus:ring-2 focus:ring-emerald-500 outline-none" />
          </div>
          <button onClick={saveEntry} disabled={saving}
            className="flex items-center gap-1.5 px-5 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 transition disabled:opacity-50 whitespace-nowrap">
            {saving
              ? <span className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />
              : editingId !== null ? <Check size={15} /> : <Plus size={15} />}
            {editingId !== null ? 'Update Entry' : 'Save Entry'}
          </button>
        </div>
      </div>

      {/* Saved Lines */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {savedLines.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <ArrowDownCircle size={24} className="opacity-30" />
            </div>
            <p className="text-sm font-medium text-gray-500">No entries yet</p>
            <p className="text-xs mt-1 text-gray-400">Fill the form above and press Enter or click Add</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse min-w-[500px]">
                <thead>
                  <tr className="bg-gray-800 text-white text-xs uppercase tracking-wider">
                    <th className="px-4 py-3 text-left font-semibold">Voucher #</th>
                    <th className="px-4 py-3 text-left font-semibold">Account</th>
                    <th className="px-4 py-3 text-left font-semibold">Description</th>
                    <th className="px-4 py-3 text-right font-semibold">Amount</th>
                    <th className="px-4 py-3 w-20"></th>
                  </tr>
                </thead>
                <tbody>
                  {savedLines.map((line, i) => (
                    <tr key={line.voucher_id} className={`border-b border-gray-100 ${line.voucher_id === editingId ? 'bg-emerald-50 ring-1 ring-inset ring-emerald-300' : i % 2 === 0 ? 'bg-white' : 'bg-gray-50/60'}`}>
                      <td className="px-4 py-3 font-mono text-xs font-bold text-emerald-700">{line.voucher_number}</td>
                      <td className="px-4 py-3 text-gray-800 font-medium">{line.account_name}</td>
                      <td className="px-4 py-3 text-gray-500">{line.narration || '—'}</td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-800 font-mono">
                        {line.amount.toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => startEdit(line)}
                            className="p-1.5 text-gray-300 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition">
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => deleteLine(line.voucher_id)}
                            className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-emerald-600 text-white font-bold">
                    <td colSpan={3} className="px-4 py-3 text-right text-xs uppercase tracking-wide">Total</td>
                    <td className="px-4 py-3 text-right font-mono text-base">{total.toLocaleString('en-PK', { minimumFractionDigits: 2 })}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 sm:px-6 py-4 bg-white border-t border-gray-200 shrink-0 flex items-center justify-between">
        <p className="text-sm">
          {savedLines.length > 0
            ? <span className="text-emerald-600 font-semibold">{savedLines.length} entr{savedLines.length !== 1 ? 'ies' : 'y'} saved ✓</span>
            : <span className="text-gray-400 text-xs">Fill form above and click Save Entry</span>}
        </p>
        <button onClick={handleDone}
          className="px-5 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 transition shadow-sm">
          Done
        </button>
      </div>
    </div>
  );
};

// ── Main List Page ────────────────────────────────────────────────────────────
const ReceiptVouchers = () => {
  const toast = useToast();
  const [view, setView] = useState<'list' | 'new'>('list');
  const [vouchers, setVouchers]   = useState<any[]>([]);
  const [loading, setLoading]     = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [filters, setFilters]     = useState({ from_date: localMonthStart(), to_date: localToday() });

  const fetchVouchers = async () => {
    setLoading(true);
    setHasLoaded(true);
    try {
      const res = await api.get('/accounting/receipt-vouchers', {
        params: { ...filters, page: pagination.page, limit: pagination.limit }
      });
      setVouchers(res.data.data || []);
      setPagination(res.data.pagination);
    } catch { toast.error('Failed to fetch Cash Receipt Vouchers'); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (hasLoaded) fetchVouchers(); }, [pagination.page]);

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this Cash Receipt Voucher?')) return;
    try {
      await api.delete(`/accounting/receipt-vouchers/${id}`);
      toast.success('Deleted'); fetchVouchers();
    } catch (err: any) { toast.error(err.response?.data?.message || 'Delete failed'); }
  };

  const totalAmount = vouchers.reduce((sum, v) => sum + Number(v.amount), 0);

  const exportCSV = () => {
    const header = 'Voucher #,Date,Account,Narration,Amount';
    const rows = vouchers.map(v => [v.voucher_number, new Date(v.voucher_date).toLocaleDateString(), `"${v.account_name || ''}"`, `"${v.description || v.received_from || ''}"`, Number(v.amount).toFixed(0)].join(','));
    const csv = [header, ...rows].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `crv-${localToday()}.csv`; a.click(); URL.revokeObjectURL(a.href);
  };

  if (view === 'new') return <CRVForm onBack={() => setView('list')} onRefresh={fetchVouchers} />;

  return (
    <div className="p-4 sm:p-6 space-y-4">

      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="h-1 bg-emerald-600" />
        <div className="px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
              <ArrowDownCircle size={20} className="text-emerald-700" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-gray-900">Cash Receipt Voucher <span className="text-emerald-600 font-medium">(CRV)</span></h1>
              <p className="text-xs sm:text-sm text-gray-500">Track all incoming payments</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={exportCSV} disabled={vouchers.length === 0}
              className="flex items-center gap-1.5 px-3 sm:px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition disabled:opacity-40 font-medium">
              <Download size={14} /> <span className="hidden sm:inline">Export CSV</span>
            </button>
            <button onClick={() => setView('new')}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 transition shadow-sm">
              <Plus size={15} /> New CRV
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 sm:px-5 py-4">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider hidden sm:block">Filters</span>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-500">From</span>
            <input type="date" value={filters.from_date}
              onChange={e => setFilters(f => ({ ...f, from_date: e.target.value }))}
              className="px-2 sm:px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-500">To</span>
            <input type="date" value={filters.to_date}
              onChange={e => setFilters(f => ({ ...f, to_date: e.target.value }))}
              className="px-2 sm:px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
          </div>
          <button onClick={() => { setPagination(p => ({ ...p, page: 1 })); fetchVouchers(); }} disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 transition disabled:opacity-60 shadow-sm">
            <Search size={14} /> {loading ? 'Loading...' : 'Load'}
          </button>
          {hasLoaded && <span className="ml-auto text-xs text-gray-400">{pagination.total} vouchers</span>}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {!hasLoaded ? (
          <div className="text-center py-16 text-gray-400">
            <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <ArrowDownCircle size={24} className="opacity-30" />
            </div>
            <p className="font-semibold text-gray-500 text-sm">Set date range and click <strong className="text-emerald-600">Load</strong></p>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin h-6 w-6 rounded-full border-2 border-emerald-600 border-t-transparent" />
          </div>
        ) : vouchers.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <ArrowDownCircle size={24} className="opacity-30" />
            </div>
            <p className="font-semibold text-gray-500 text-sm">No receipt vouchers found</p>
            <p className="text-xs mt-1">Click <strong className="text-emerald-600">New CRV</strong> to create entries</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse min-w-[500px]">
                <thead>
                  <tr className="bg-gray-800 text-white text-xs uppercase tracking-wider">
                    <th className="px-4 py-3 text-left font-semibold">Voucher #</th>
                    <th className="px-4 py-3 text-left font-semibold">Date</th>
                    <th className="px-4 py-3 text-left font-semibold">Account</th>
                    <th className="px-4 py-3 text-left font-semibold">Description</th>
                    <th className="px-4 py-3 text-right font-semibold">Amount</th>
                    <th className="px-4 py-3 w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {vouchers.map((v, i) => (
                    <tr key={v.voucher_id} className={`border-b border-gray-50 hover:bg-emerald-50/30 transition ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}>
                      <td className="px-4 py-3 font-mono text-xs font-bold text-emerald-700">{v.voucher_number}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                        {new Date(v.voucher_date).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-3 text-gray-800 font-medium">{v.account_name}</td>
                      <td className="px-4 py-3 text-gray-500 max-w-[160px] truncate">{v.description || v.received_from || '—'}</td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-800 font-mono whitespace-nowrap">
                        {Number(v.amount).toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => handleDelete(v.voucher_id)}
                          className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-emerald-600 text-white">
                    <td colSpan={4} className="px-4 py-3 text-right font-bold text-xs uppercase tracking-wide">Total (this page)</td>
                    <td className="px-4 py-3 text-right font-bold font-mono">{totalAmount.toLocaleString('en-PK', { minimumFractionDigits: 2 })}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
            <div className="border-t border-gray-100">
              <Pagination
                currentPage={pagination.page} totalPages={pagination.totalPages}
                onPageChange={page => setPagination(p => ({ ...p, page }))}
                totalItems={pagination.total} itemsPerPage={pagination.limit}
                onItemsPerPageChange={limit => setPagination(p => ({ ...p, limit, page: 1 }))}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ReceiptVouchers;
