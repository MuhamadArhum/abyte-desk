import { useState, useEffect, useRef } from 'react';
import {
  ArrowDownLeft, Plus, Trash2, Download, Search,
  ChevronDown, Pencil, Check, X, Building2, Calendar, ArrowLeft
} from 'lucide-react';
import Pagination from '../../components/Pagination';
import api from '../../utils/api';
import { useToast } from '../../components/Toast';
import { localToday } from '../../utils/dateUtils';

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
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white hover:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 text-left transition">
        <span className={selected ? 'text-gray-900 font-medium truncate' : 'text-gray-400'}>
          {selected ? `${selected.account_code} — ${selected.account_name}` : placeholder}
        </span>
        <ChevronDown size={13} className="text-gray-400 shrink-0 ml-1" />
      </button>

      {open && (
        <div className="absolute z-50 left-0 top-full mt-1.5 w-80 bg-white border border-gray-200 rounded-xl shadow-2xl">
          <div className="p-2.5 border-b border-gray-100">
            <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-1.5">
              <Search size={12} className="text-gray-400 shrink-0" />
              <input
                autoFocus type="text" value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'ArrowDown') { e.preventDefault(); setHi(h => Math.min(h + 1, filtered.length - 1)); }
                  else if (e.key === 'ArrowUp') { e.preventDefault(); setHi(h => Math.max(h - 1, 0)); }
                  else if (e.key === 'Enter') { e.preventDefault(); if (filtered[hi]) pick(String(filtered[hi].account_id)); }
                  else if (e.key === 'Escape') setOpen(false);
                }}
                className="text-sm bg-transparent outline-none w-full placeholder-gray-400 text-gray-700"
                placeholder="Search name or code…"
              />
            </div>
          </div>
          <ul className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0
              ? <li className="px-4 py-3 text-sm text-gray-400 text-center">No accounts found</li>
              : filtered.map((a, idx) => (
                <li key={a.account_id}>
                  <button
                    type="button"
                    onClick={() => pick(String(a.account_id))}
                    className={`w-full text-left px-3 py-2 flex items-center gap-2 text-sm transition
                      ${idx === hi ? 'bg-emerald-50 text-emerald-700' : 'hover:bg-gray-50 text-gray-700'}`}
                  >
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
  const fmt = (n: number) => n.toLocaleString('en-PK', { minimumFractionDigits: 2 });

  return (
    <div className="p-6">
      {/* Back header */}
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => { onRefresh(); onBack(); }}
            className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-800 transition">
            <ArrowLeft size={16} /> Back to List
          </button>
          {voucherNum && (
            <span className="px-2.5 py-1 bg-emerald-50 border border-emerald-200 text-emerald-600 rounded-full text-xs font-mono font-semibold">
              {voucherNum}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <Calendar size={13} className="text-gray-400" />
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-emerald-400" />
        </div>
      </div>

      {/* Main form card */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden mb-4">

        {/* Card title bar */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
          <div className="w-9 h-9 bg-emerald-100 rounded-lg flex items-center justify-center">
            <ArrowDownLeft size={18} className="text-emerald-500" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900">Cash Receipt Voucher</h2>
            <p className="text-xs text-gray-500">Record incoming payment entries</p>
          </div>
        </div>

        {/* Receiving account section */}
        <div className="px-6 py-4 border-b border-gray-100">
          <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5 shrink-0">
                <Building2 size={14} className="text-emerald-500" />
                <label className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">Receiving Account (Cash/Bank)</label>
              </div>
              <div className="flex-1 min-w-[220px]">
                <AccountSelector
                  value={mainAccountId} onChange={setMainAccountId}
                  accounts={accounts} placeholder="Select Cash / Bank account…"
                />
              </div>
              {mainAcct && (
                <span className="text-xs text-emerald-600 font-semibold bg-white border border-emerald-200 px-2.5 py-1 rounded-lg">
                  Bal: {Number(mainAcct.current_balance || 0).toLocaleString('en-PK')}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Entry form section */}
        <div className={`px-6 py-4 border-b border-gray-100 ${editingId !== null ? 'bg-emerald-50/20' : ''}`}>
          {editingId !== null && (
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">Editing Entry</span>
              <button onClick={resetEntry} className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition">
                <X size={11} /> Cancel Edit
              </button>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_140px_auto] gap-3 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Income Account</label>
              <AccountSelector
                value={entry.account_id}
                onChange={id => setEntry(v => ({ ...v, account_id: id }))}
                onAfterSelect={() => narrationRef.current?.focus()}
                accounts={accounts} placeholder="Select account…"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Received From / Description</label>
              <input
                ref={narrationRef} type="text" value={entry.narration}
                onChange={e => setEntry(v => ({ ...v, narration: e.target.value }))}
                onKeyDown={e => { if (e.key === 'Enter') amountRef.current?.focus(); }}
                placeholder="Customer name, invoice #…"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount (Rs.)</label>
              <input
                ref={amountRef} type="number" step="0.01" min="0" value={entry.amount}
                onChange={e => setEntry(v => ({ ...v, amount: e.target.value }))}
                onKeyDown={e => { if (e.key === 'Enter') saveEntry(); }}
                placeholder="0.00"
                className="w-full border border-emerald-300 rounded-lg px-3 py-2 text-sm text-right font-semibold text-emerald-700 outline-none focus:ring-2 focus:ring-emerald-400 bg-emerald-50"
              />
            </div>
            <button onClick={saveEntry} disabled={saving}
              className="flex items-center justify-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium transition disabled:opacity-50 whitespace-nowrap">
              {saving
                ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : editingId !== null ? <Check size={14} /> : <Plus size={14} />}
              {editingId !== null ? 'Update' : 'Add'}
            </button>
          </div>
        </div>

        {/* Lines table */}
        {savedLines.length > 0 && (
          <div className="px-6 py-4">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Account</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                  <th className="px-4 py-2.5 w-16" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {savedLines.map((line, i) => (
                  <tr key={line.voucher_id}
                    className={editingId === line.voucher_id ? 'bg-emerald-50' : i % 2 === 0 ? 'bg-white hover:bg-gray-50' : 'bg-gray-50/40 hover:bg-gray-50'}>
                    <td className="px-4 py-2.5 font-medium text-gray-800">{line.account_name}</td>
                    <td className="px-4 py-2.5 text-gray-500">{line.narration || <span className="text-gray-300">—</span>}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-emerald-700">
                      {line.amount.toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => {
                          setEditingId(line.voucher_id);
                          setEntry({ account_id: line.account_id, narration: line.narration, amount: String(line.amount) });
                        }} className="p-1.5 text-gray-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-lg transition">
                          <Pencil size={13} />
                        </button>
                        <button onClick={() => deleteLine(line.voucher_id)}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 border-t border-gray-200">
                  <td colSpan={2} className="px-4 py-2.5 text-sm font-medium text-gray-500">
                    {savedLines.length} entr{savedLines.length === 1 ? 'y' : 'ies'}
                  </td>
                  <td className="px-4 py-2.5 text-right font-bold text-emerald-700">{fmt(total)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {savedLines.length === 0 && (
          <div className="px-6 py-8 text-center border-t border-gray-100 text-gray-400">
            <ArrowDownLeft size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm font-medium text-gray-500">No entries yet — fill the form above and click Add</p>
          </div>
        )}
      </div>

      {/* Done button */}
      <div className="flex justify-end">
        <button onClick={() => { onRefresh(); onBack(); }}
          className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium transition">
          <Check size={15} /> Done
        </button>
      </div>
    </div>
  );
};

const ReceiptVouchers = () => {
  const toast = useToast();
  const [view, setView]                 = useState<'list' | 'new'>('list');
  const [vouchers, setVouchers]         = useState<any[]>([]);
  const [loading, setLoading]           = useState(false);
  const [hasLoaded, setHasLoaded]       = useState(false);
  const [pagination, setPagination]     = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [filters, setFilters]           = useState({ from_date: localToday(), to_date: localToday() });

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

  const handleDelete = async (voucher_number: string) => {
    if (!confirm(`Delete all entries of ${voucher_number}?`)) return;
    try {
      await api.delete(`/accounting/receipt-vouchers/group/${voucher_number}`);
      toast.success('Deleted'); fetchVouchers();
    } catch (err: any) { toast.error(err.response?.data?.message || 'Delete failed'); }
  };

  const exportCSV = () => {
    const rows = [
      ['Voucher #', 'Date', 'Cash/Bank Account', 'Narration', 'Lines', 'Total Amount'],
      ...vouchers.map(v => [v.voucher_number, new Date(v.voucher_date).toLocaleDateString(), v.main_account_name || '', v.description || '', v.line_count, Number(v.total_amount).toFixed(2)])
    ];
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `crv-${filters.from_date}-to-${filters.to_date}.csv`;
    a.click(); URL.revokeObjectURL(a.href);
  };

  if (view === 'new') return <CRVForm onBack={() => setView('list')} onRefresh={fetchVouchers} />;

  const totalAmt = vouchers.reduce((s, v) => s + Number(v.total_amount), 0);

  return (
    <div className="p-6">

      {/* Header */}
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <ArrowDownLeft size={20} className="text-emerald-600" /> Cash Receipt Vouchers
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Track all incoming payments</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCSV} disabled={vouchers.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition shadow-sm disabled:opacity-40">
            <Download size={14} /> Export
          </button>
          <button onClick={() => setView('new')}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium transition">
            <Plus size={14} /> New CRV
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-400 font-medium">From</span>
          <input type="date" value={filters.from_date}
            onChange={e => setFilters(f => ({ ...f, from_date: e.target.value }))}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-400" />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-400 font-medium">To</span>
          <input type="date" value={filters.to_date}
            onChange={e => setFilters(f => ({ ...f, to_date: e.target.value }))}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-400" />
        </div>
        <button onClick={() => { setPagination(p => ({ ...p, page: 1 })); fetchVouchers(); }} disabled={loading}
          className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600 transition disabled:opacity-60">
          <Search size={13} /> {loading ? 'Loading…' : 'Search'}
        </button>
        {hasLoaded && <span className="ml-auto text-xs text-gray-400 font-medium">{pagination.total} vouchers</span>}
      </div>

      {/* Summary */}
      {hasLoaded && vouchers.length > 0 && (
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 text-center">
            <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">Vouchers</p>
            <p className="text-2xl font-bold text-gray-800 mt-1">{pagination.total}</p>
          </div>
          <div className="bg-emerald-50 rounded-xl border border-emerald-100 shadow-sm px-4 py-3 text-center">
            <p className="text-xs text-emerald-600 font-semibold uppercase tracking-wide">Total Received</p>
            <p className="text-xl font-bold text-emerald-700 mt-1 font-mono">
              {totalAmt.toLocaleString('en-PK', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {!hasLoaded ? (
          <div className="text-center py-16 text-gray-400">
            <ArrowDownLeft size={40} className="mx-auto mb-3 opacity-20" />
            <p className="font-medium text-gray-500">Select date range and click <strong className="text-emerald-600">Search</strong></p>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-14">
            <div className="animate-spin h-6 w-6 rounded-full border-2 border-gray-300 border-t-emerald-600" />
          </div>
        ) : vouchers.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <ArrowDownLeft size={40} className="mx-auto mb-3 opacity-20" />
            <p className="font-medium text-gray-500 text-sm">No vouchers found for this period</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Voucher #</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Cash/Bank</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Narration</th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase">Lines</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Total</th>
                    <th className="w-12 px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {vouchers.map(v => (
                    <tr key={v.voucher_number} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-3 font-mono font-bold text-emerald-600 text-xs">{v.voucher_number}</td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">
                        {new Date(v.voucher_date).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-3 text-gray-700 font-medium text-xs">{v.main_account_name || <span className="text-gray-300">—</span>}</td>
                      <td className="px-4 py-3 text-gray-500 max-w-[180px] truncate text-xs">
                        {v.description || <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">{v.line_count}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-bold font-mono text-emerald-700">
                        {Number(v.total_amount).toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => handleDelete(v.voucher_number)}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition">
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 border-t border-gray-200">
                    <td colSpan={5} className="px-4 py-3 text-sm font-medium text-gray-500">Total (this page)</td>
                    <td className="px-4 py-3 text-right font-bold font-mono text-emerald-700">
                      {totalAmt.toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                    </td>
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
