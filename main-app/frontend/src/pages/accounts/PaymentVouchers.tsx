import { useState, useEffect, useRef } from 'react';
import {
  ArrowUpRight, Plus, Trash2, Download, Search,
  ChevronDown, Pencil, Check, X, Building2, Calendar, ArrowLeft
} from 'lucide-react';
import Pagination from '../../components/Pagination';
import api from '../../utils/api';
import { useToast } from '../../components/Toast';
import { useConfirm } from '../../components/ConfirmDialog';
import { localToday } from '../../utils/dateUtils';

const AccountSelector = ({
  value, onChange, accounts, onAfterSelect, placeholder = 'Select account…', btnRef,
}: {
  value: string; onChange: (id: string) => void;
  accounts: any[]; onAfterSelect?: () => void; placeholder?: string;
  btnRef?: React.RefObject<HTMLButtonElement | null>;
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [hi, setHi] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const selected = accounts.find(a => String(a.account_id) === String(value));
  const filtered = accounts.filter(a =>
    !search || a.account_name.toLowerCase().includes(search.toLowerCase()) || a.account_code.includes(search)
  );

  useEffect(() => setHi(0), [search]);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const pick = (id: string) => { onChange(id); setOpen(false); setSearch(''); setHi(0); setTimeout(() => onAfterSelect?.(), 0); };

  return (
    <div ref={ref} className="relative w-full">
      <button ref={btnRef} type="button" onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white hover:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 text-left transition">
        <span className={selected ? 'text-gray-900 font-medium truncate' : 'text-gray-400'}>
          {selected ? `${selected.account_code} — ${selected.account_name}` : placeholder}
        </span>
        <ChevronDown size={13} className="text-gray-400 shrink-0 ml-1" />
      </button>
      {open && (
        <div className="absolute z-50 left-0 top-full mt-1 w-80 bg-white border border-gray-200 rounded-xl shadow-2xl">
          <div className="p-2 border-b border-gray-100">
            <div className="flex items-center gap-2 px-2 py-1.5 bg-gray-50 rounded-lg">
              <Search size={13} className="text-gray-400 shrink-0" />
              <input autoFocus type="text" value={search} onChange={e => setSearch(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'ArrowDown') { e.preventDefault(); setHi(h => Math.min(h + 1, filtered.length - 1)); }
                  else if (e.key === 'ArrowUp') { e.preventDefault(); setHi(h => Math.max(h - 1, 0)); }
                  else if (e.key === 'Enter') { e.preventDefault(); if (filtered[hi]) pick(String(filtered[hi].account_id)); }
                  else if (e.key === 'Escape') setOpen(false);
                }}
                className="bg-transparent text-sm outline-none w-full placeholder-gray-400" placeholder="Search by name or code…" />
            </div>
          </div>
          <ul className="max-h-52 overflow-y-auto py-1">
            {filtered.length === 0
              ? <li className="px-3 py-3 text-sm text-gray-400 text-center">No accounts found</li>
              : filtered.map((a, idx) => (
                <li key={a.account_id}>
                  <button type="button" onClick={() => pick(String(a.account_id))}
                    className={`w-full text-left px-3 py-2 flex items-center gap-2 text-sm transition ${idx === hi ? 'bg-emerald-50 text-emerald-700' : 'hover:bg-gray-50'}`}>
                    <span className="font-mono text-xs text-gray-400 shrink-0">{a.account_code}</span>
                    <span className="text-gray-800 truncate">{a.account_name}</span>
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

type SavedLine = { voucher_id: number; account_id: string; account_name: string; narration: string; amount: number };
type EntryForm = { account_id: string; narration: string; amount: string };

const CPVForm = ({ onBack, onRefresh, editVoucherNumber }: { onBack: () => void; onRefresh: () => void; editVoucherNumber?: string }) => {
  const toast = useToast();
  const [accounts, setAccounts]           = useState<any[]>([]);
  const [date, setDate]                   = useState(localToday());
  const [voucherNum, setVoucherNum]       = useState(editVoucherNumber || '');
  const [mainAccountId, setMainAccountId] = useState('');
  const [lines, setLines]                 = useState<SavedLine[]>([]);
  const [entry, setEntry]                 = useState<EntryForm>({ account_id: '', narration: '', amount: '' });
  const [saving, setSaving]               = useState(false);
  const [editingId, setEditingId]         = useState<number | null>(null);

  const narrationRef  = useRef<HTMLInputElement>(null);
  const amountRef     = useRef<HTMLInputElement>(null);
  const expAccBtnRef  = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    api.get('/accounting/accounts', { params: { tree: 1 } })
      .then(r => setAccounts((r.data.data || []).filter((a: any) => a.is_active && a.level === 4)))
      .catch(() => toast.error('Failed to load accounts'));

    if (editVoucherNumber) {
      api.get(`/accounting/payment-vouchers/lines/${editVoucherNumber}`).then(r => {
        const rows = r.data.data || [];
        if (rows.length) {
          setDate(rows[0].voucher_date?.split('T')[0] || localToday());
          setMainAccountId(rows[0].main_account_id ? String(rows[0].main_account_id) : '');
          setLines(rows.map((row: any) => ({
            voucher_id: row.voucher_id, account_id: String(row.account_id),
            account_name: row.account_name, narration: row.description || '', amount: Number(row.amount),
          })));
        }
      }).catch(() => toast.error('Failed to load voucher'));
    } else {
      api.get('/accounting/payment-vouchers/next-number').then(r => setVoucherNum(r.data.voucher_number)).catch(() => {});
      api.get('/settings').then(r => { if (r.data.cpv_default_account_id) setMainAccountId(String(r.data.cpv_default_account_id)); }).catch(() => {});
    }
  }, []);

  const resetEntry = () => {
    setEntry({ account_id: '', narration: '', amount: '' });
    setEditingId(null);
    setTimeout(() => expAccBtnRef.current?.focus(), 50);
  };

  const addEntry = async () => {
    if (!mainAccountId) { toast.error('Select the paying account first'); return; }
    if (!entry.account_id || !entry.amount) { toast.error('Account and Amount required'); return; }
    const amount = parseFloat(entry.amount);
    if (isNaN(amount) || amount <= 0) { toast.error('Enter a valid amount'); return; }
    setSaving(true);
    try {
      if (editingId !== null) await api.delete(`/accounting/payment-vouchers/${editingId}`);
      const res = await api.post('/accounting/payment-vouchers', {
        voucher_number: voucherNum, voucher_date: date,
        payment_to: entry.narration || '—', payment_type: 'expense',
        account_id: entry.account_id, main_account_id: mainAccountId,
        amount, payment_method: 'cash', description: entry.narration,
      });
      if (!voucherNum) setVoucherNum(res.data.voucher_number);
      const acct = accounts.find(a => String(a.account_id) === entry.account_id);
      const line: SavedLine = { voucher_id: res.data.voucher_id, account_id: entry.account_id, account_name: acct?.account_name ?? '', narration: entry.narration, amount };
      setLines(prev => editingId !== null ? prev.map(l => l.voucher_id === editingId ? line : l) : [...prev, line]);
      toast.success(editingId !== null ? 'Entry updated' : 'Entry added');
      resetEntry();
    } catch (err: any) { toast.error(err.response?.data?.message || 'Save failed'); }
    finally { setSaving(false); }
  };

  const deleteLine = async (id: number) => {
    try {
      await api.delete(`/accounting/payment-vouchers/${id}`);
      setLines(prev => prev.filter(l => l.voucher_id !== id));
      if (editingId === id) resetEntry();
    } catch (err: any) { toast.error(err.response?.data?.message || 'Delete failed'); }
  };

  const total = lines.reduce((s, l) => s + l.amount, 0);
  const mainAcct = accounts.find(a => String(a.account_id) === mainAccountId);
  const fmt = (n: number) => n.toLocaleString('en-PK', { minimumFractionDigits: 2 });

  return (
    <div className="p-4 sm:p-6">
      {/* Back header */}
      <div className="mb-5 flex items-center gap-3">
        <button onClick={() => { onRefresh(); onBack(); }}
          className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-800 transition">
          <ArrowLeft size={16} /> Back to List
        </button>
        {voucherNum && (
          <span className="px-2.5 py-1 bg-emerald-50 border border-emerald-200 text-emerald-600 rounded-full text-xs font-mono font-semibold">
            {voucherNum}
          </span>
        )}
        {editVoucherNumber && (
          <span className="px-2.5 py-1 bg-amber-50 border border-amber-200 text-amber-700 rounded-full text-xs font-semibold">Editing</span>
        )}
      </div>

      {/* Main form card */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden mb-4">

        {/* Card title bar */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
          <div className="w-9 h-9 bg-emerald-100 rounded-lg flex items-center justify-center">
            <ArrowUpRight size={18} className="text-emerald-500" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900">Cash Payment Voucher</h2>
            <p className="text-xs text-gray-500">Record outgoing payment entries</p>
          </div>
        </div>

        {/* Paying account + Date in one row */}
        <div className="px-6 py-4 border-b border-gray-100">
          <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5 shrink-0">
                <Building2 size={14} className="text-emerald-500" />
                <label className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">Paying Account (Cash/Bank)</label>
              </div>
              <div className="flex-1 min-w-[200px]">
                <AccountSelector value={mainAccountId} onChange={setMainAccountId} accounts={accounts}
                  placeholder="Select Cash / Bank account…" />
              </div>
              {mainAcct && (
                <span className="text-xs text-emerald-600 font-semibold bg-white border border-emerald-200 px-2.5 py-1 rounded-lg shrink-0">
                  Bal: {Number(mainAcct.current_balance || 0).toLocaleString('en-PK')}
                </span>
              )}
              <div className="flex items-center gap-1.5 shrink-0">
                <Calendar size={13} className="text-emerald-400" />
                <input type="date" value={date} onChange={e => setDate(e.target.value)}
                  className="border border-emerald-200 bg-white rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-emerald-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Entry form section */}
        <div className={`px-6 py-4 border-b border-gray-100 ${editingId !== null ? 'bg-amber-50/30' : ''}`}>
          {editingId !== null && (
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Editing Entry</span>
              <button onClick={resetEntry} className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition">
                <X size={11} /> Cancel Edit
              </button>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_140px_auto] gap-3 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Expense Account</label>
              <AccountSelector value={entry.account_id}
                onChange={id => setEntry(v => ({ ...v, account_id: id }))}
                onAfterSelect={() => narrationRef.current?.focus()}
                accounts={accounts} placeholder="Select account…"
                btnRef={expAccBtnRef} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Paid To / Description</label>
              <input ref={narrationRef} type="text" value={entry.narration}
                onChange={e => setEntry(v => ({ ...v, narration: e.target.value }))}
                onKeyDown={e => { if (e.key === 'Enter') amountRef.current?.focus(); }}
                placeholder="e.g. Supplier name, utility bill…"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount (Rs.)</label>
              <input ref={amountRef} type="number" step="0.01" min="0" value={entry.amount}
                onChange={e => setEntry(v => ({ ...v, amount: e.target.value }))}
                onKeyDown={e => { if (e.key === 'Enter') addEntry(); }}
                placeholder="0.00"
                className="w-full border border-emerald-300 rounded-lg px-3 py-2 text-sm text-right font-semibold text-emerald-700 outline-none focus:ring-2 focus:ring-emerald-400 bg-emerald-50" />
            </div>
            <button onClick={addEntry} disabled={saving}
              className="flex items-center justify-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium transition disabled:opacity-50 whitespace-nowrap">
              {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : editingId !== null ? <Check size={14} /> : <Plus size={14} />}
              {editingId !== null ? 'Update' : 'Add'}
            </button>
          </div>
        </div>

        {/* Lines table */}
        {lines.length > 0 && (
          <div className="px-6 py-4">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Account</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                  <th className="px-4 py-2.5 w-16" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {lines.map((line, i) => (
                  <tr key={line.voucher_id}
                    className={editingId === line.voucher_id ? 'bg-amber-50' : i % 2 === 0 ? 'bg-white hover:bg-gray-50' : 'bg-gray-50/40 hover:bg-gray-50'}>
                    <td className="px-4 py-2.5 text-xs font-mono text-gray-300">{String(i+1).padStart(2,'0')}</td>
                    <td className="px-4 py-2.5 font-medium text-gray-800 text-xs">{line.account_name}</td>
                    <td className="px-4 py-2.5 text-gray-500 text-xs">{line.narration || <span className="text-gray-300">—</span>}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-emerald-700">{fmt(line.amount)}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => { setEditingId(line.voucher_id); setEntry({ account_id: line.account_id, narration: line.narration, amount: String(line.amount) }); }}
                          className="p-1.5 text-gray-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-lg transition"><Pencil size={13} /></button>
                        <button onClick={() => deleteLine(line.voucher_id)}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-emerald-50 border-t border-emerald-200">
                  <td colSpan={3} className="px-4 py-2.5 text-sm font-medium text-emerald-700">
                    {lines.length} entr{lines.length === 1 ? 'y' : 'ies'}
                  </td>
                  <td className="px-4 py-2.5 text-right font-bold text-emerald-700">{fmt(total)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {lines.length === 0 && (
          <div className="px-6 py-8 text-center border-t border-gray-100">
            <ArrowUpRight size={32} className="mx-auto mb-2 text-gray-200" />
            <p className="text-sm font-medium text-gray-400">No entries yet — fill the form above and click Add</p>
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <button onClick={() => { onRefresh(); onBack(); }}
          className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium transition">
          <Check size={15} /> Done
        </button>
      </div>
    </div>
  );
};

const PaymentVouchers = () => {
  const toast = useToast();
  const confirm = useConfirm();
  const [view, setView]                 = useState<'list' | 'new'>('list');
  const [editVoucherNum, setEditVoucherNum] = useState<string | undefined>(undefined);
  const [vouchers, setVouchers]         = useState<any[]>([]);
  const [loading, setLoading]           = useState(false);
  const [hasLoaded, setHasLoaded]       = useState(false);
  const [pagination, setPagination]     = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [filters, setFilters]           = useState({ from_date: localToday(), to_date: localToday() });

  const fetchVouchers = async () => {
    setLoading(true); setHasLoaded(true);
    try {
      const res = await api.get('/accounting/payment-vouchers', {
        params: { ...filters, page: pagination.page, limit: pagination.limit }
      });
      setVouchers(res.data.data || []);
      setPagination(res.data.pagination);
    } catch { toast.error('Failed to load payment vouchers'); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (hasLoaded) fetchVouchers(); }, [pagination.page]);

  const handleDelete = async (voucher_number: string) => {
    const ok = await confirm({ title: 'Delete Payment Voucher', message: `Delete all entries of ${voucher_number}?`, type: 'danger' });
    if (!ok) return;
    try { await api.delete(`/accounting/payment-vouchers/group/${voucher_number}`); toast.success('Deleted'); fetchVouchers(); }
    catch (err: any) { toast.error(err.response?.data?.message || 'Delete failed'); }
  };

  const exportCSV = () => {
    const rows = [
      ['Voucher #', 'Date', 'Cash/Bank Account', 'Narration', 'Lines', 'Total Amount'],
      ...vouchers.map(v => [v.voucher_number, new Date(v.voucher_date).toLocaleDateString(), v.main_account_name || '', v.description || '', v.line_count, Number(v.total_amount).toFixed(2)])
    ];
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `cpv-${filters.from_date}-to-${filters.to_date}.csv`;
    a.click(); URL.revokeObjectURL(a.href);
  };

  if (view === 'new') return (
    <CPVForm
      onBack={() => { setEditVoucherNum(undefined); setView('list'); }}
      onRefresh={fetchVouchers}
      editVoucherNumber={editVoucherNum}
    />
  );

  const totalAmt = vouchers.reduce((s, v) => s + Number(v.total_amount), 0);
  const fmt = (n: number) => n.toLocaleString('en-PK', { minimumFractionDigits: 2 });

  return (
    <div className="p-4 sm:p-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <ArrowUpRight size={20} className="text-emerald-500" /> Cash Payment Vouchers
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Track all outgoing payments</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCSV} disabled={vouchers.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition disabled:opacity-40">
            <Download size={14} /> <span className="hidden sm:inline">Export CSV</span>
          </button>
          <button onClick={() => setView('new')}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium transition">
            <Plus size={16} /> <span className="hidden sm:inline">New CPV</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-3 items-center bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500 font-medium">From</span>
          <input type="date" value={filters.from_date}
            onChange={e => setFilters(f => ({ ...f, from_date: e.target.value }))}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-emerald-400" />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500 font-medium">To</span>
          <input type="date" value={filters.to_date}
            onChange={e => setFilters(f => ({ ...f, to_date: e.target.value }))}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-emerald-400" />
        </div>
        <button onClick={() => { setPagination(p => ({ ...p, page: 1 })); fetchVouchers(); }} disabled={loading}
          className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600 transition disabled:opacity-60">
          <Search size={13} /> {loading ? 'Loading…' : 'Search'}
        </button>
        {hasLoaded && <span className="ml-auto text-xs text-gray-400">{pagination.total} vouchers found</span>}
      </div>

      {/* Summary */}
      {hasLoaded && vouchers.length > 0 && (
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 text-center">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Total Vouchers</p>
            <p className="text-2xl font-bold text-gray-800 mt-1">{pagination.total}</p>
          </div>
          <div className="bg-emerald-50 rounded-xl border border-emerald-100 shadow-sm px-4 py-3 text-center">
            <p className="text-xs text-emerald-600 font-medium uppercase tracking-wide">Total Payments</p>
            <p className="text-xl font-bold text-emerald-700 mt-1 font-mono">{fmt(totalAmt)}</p>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {!hasLoaded ? (
          <div className="text-center py-16 text-gray-400">
            <ArrowUpRight size={40} className="mx-auto mb-3 opacity-20" />
            <p className="font-medium text-gray-500">Select date range and click <strong className="text-emerald-500">Search</strong></p>
          </div>
        ) : loading ? (
          <div className="flex justify-center py-14">
            <div className="animate-spin h-7 w-7 rounded-full border-2 border-emerald-400 border-t-transparent" />
          </div>
        ) : vouchers.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <ArrowUpRight size={40} className="mx-auto mb-3 opacity-20" />
            <p className="text-sm font-medium text-gray-500">No vouchers found for this period</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Voucher #</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cash/Bank</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Narration</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Lines</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                    <th className="px-4 py-3 w-20" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {vouchers.map(v => (
                    <tr key={v.voucher_number} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-3 font-mono font-semibold text-emerald-600 text-xs">{v.voucher_number}</td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">
                        {new Date(v.voucher_date).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-3 text-gray-700 font-medium text-xs">{v.main_account_name || <span className="text-gray-300">—</span>}</td>
                      <td className="px-4 py-3 text-gray-500 max-w-[180px] truncate text-xs">{v.description || <span className="text-gray-300">—</span>}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">{v.line_count}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-700 font-mono">{fmt(Number(v.total_amount))}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => { setEditVoucherNum(v.voucher_number); setView('new'); }}
                            className="p-1.5 text-gray-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-lg transition" title="Edit">
                            <Pencil size={13} />
                          </button>
                          <button onClick={() => handleDelete(v.voucher_number)}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition" title="Delete">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 border-t border-gray-200">
                    <td colSpan={5} className="px-4 py-3 text-sm font-medium text-gray-500">Total (this page)</td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-700 font-mono">{fmt(totalAmt)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
            <Pagination currentPage={pagination.page} totalPages={pagination.totalPages}
              onPageChange={page => setPagination(p => ({ ...p, page }))}
              totalItems={pagination.total} itemsPerPage={pagination.limit}
              onItemsPerPageChange={limit => setPagination(p => ({ ...p, limit, page: 1 }))} />
          </>
        )}
      </div>
    </div>
  );
};

export default PaymentVouchers;
