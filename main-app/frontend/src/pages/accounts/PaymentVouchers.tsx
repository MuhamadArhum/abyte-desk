import { useState, useEffect, useRef } from 'react';
import {
  ArrowUpRight, Plus, Trash2, Download, Search,
  ChevronDown, ArrowLeft, Pencil, Check, X,
  Building2, Calendar, FileText
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
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-sm text-left transition-all
          ${selected
            ? 'border-gray-200 bg-white text-gray-800 font-semibold'
            : 'border-dashed border-gray-300 bg-gray-50 text-gray-400 hover:border-gray-400'}`}
      >
        <span className="truncate flex-1">
          {selected ? `${selected.account_code} — ${selected.account_name}` : placeholder}
        </span>
        <ChevronDown size={13} className="text-gray-300 shrink-0 ml-1" />
      </button>

      {open && (
        <div className="absolute z-50 left-0 top-full mt-1.5 w-80 bg-white border border-gray-200 rounded-xl shadow-2xl">
          <div className="p-2.5 border-b border-gray-100">
            <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-1.5">
              <Search size={12} className="text-gray-400 shrink-0" />
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
                      ${idx === hi ? 'bg-gray-800 text-white' : 'hover:bg-gray-50 text-gray-700'}`}
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

type Line = { voucher_id: number; voucher_number: string; account_id: string; account_name: string; narration: string; amount: number };
type Entry = { account_id: string; narration: string; amount: string };

const CPVForm = ({ onBack, onRefresh }: { onBack: () => void; onRefresh: () => void }) => {
  const toast = useToast();
  const [accounts, setAccounts]       = useState<any[]>([]);
  const [date, setDate]               = useState(localToday());
  const [voucherNum, setVoucherNum]   = useState('');
  const [mainAccountId, setMainAccountId] = useState('');
  const [savedLines, setSavedLines]   = useState<Line[]>([]);
  const [entry, setEntry]             = useState<Entry>({ account_id: '', narration: '', amount: '' });
  const [saving, setSaving]           = useState(false);
  const [editingId, setEditingId]     = useState<number | null>(null);

  const narrationRef = useRef<HTMLInputElement>(null);
  const amountRef    = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.get('/accounting/accounts', { params: { tree: 1 } })
      .then(r => setAccounts((r.data.data || []).filter((a: any) => a.is_active && a.level === 4)))
      .catch(() => toast.error('Failed to load accounts'));
    api.get('/accounting/payment-vouchers/next-number')
      .then(r => setVoucherNum(r.data.voucher_number))
      .catch(() => {});
    api.get('/settings')
      .then(r => { if (r.data.cpv_default_account_id) setMainAccountId(String(r.data.cpv_default_account_id)); })
      .catch(() => {});
  }, []);

  const resetEntry = () => { setEntry({ account_id: '', narration: '', amount: '' }); setEditingId(null); };

  const saveEntry = async () => {
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
      await api.delete(`/accounting/payment-vouchers/${id}`);
      setSavedLines(prev => prev.filter(l => l.voucher_id !== id));
      if (editingId === id) resetEntry();
    } catch (err: any) { toast.error(err.response?.data?.message || 'Delete failed'); }
  };

  const total = savedLines.reduce((s, l) => s + l.amount, 0);
  const mainAcct = accounts.find(a => String(a.account_id) === mainAccountId);

  return (
    <div className="p-6">

      {/* Header */}
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => { onRefresh(); onBack(); }}
            className="flex items-center gap-2 text-gray-500 hover:text-gray-800 transition text-sm font-medium">
            <ArrowLeft size={16} /> Back to List
          </button>
          {voucherNum && (
            <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-bold font-mono border border-orange-200">
              {voucherNum}
            </span>
          )}
        </div>
        {savedLines.length > 0 && (
          <p className="text-sm text-gray-500">
            <span className="font-bold text-orange-600">{savedLines.length}</span> entr{savedLines.length === 1 ? 'y' : 'ies'}
            <span className="mx-2 text-gray-300">|</span>
            <span className="font-mono font-semibold text-gray-700">Rs. {total.toLocaleString('en-PK', { minimumFractionDigits: 2 })}</span>
          </p>
        )}
      </div>

      {/* Voucher Card */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden mb-4">

        {/* Title Bar */}
        <div className="bg-gray-800 px-5 py-4 flex items-center justify-between text-white">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-orange-500 rounded-lg flex items-center justify-center">
              <ArrowUpRight size={16} className="text-white" />
            </div>
            <div>
              <p className="text-white/60 text-[10px] font-semibold uppercase tracking-widest">Accounts Module</p>
              <h2 className="text-white font-bold text-base tracking-wide">CASH PAYMENT VOUCHER</h2>
            </div>
            {voucherNum && <span className="font-mono text-gray-400 text-xs ml-1">{voucherNum}</span>}
          </div>
          <div className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-1.5 border border-white/20">
            <Calendar size={13} className="text-white/60" />
            <input
              type="date" value={date} onChange={e => setDate(e.target.value)}
              className="bg-transparent text-white text-sm font-mono border-none outline-none cursor-pointer"
            />
          </div>
        </div>

        {/* Paying Account */}
        <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/40">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 shrink-0">
              <Building2 size={14} className="text-orange-400" />
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Paying Account</span>
            </div>
            <div className="flex-1 min-w-[220px] max-w-xs">
              <AccountSelector value={mainAccountId} onChange={setMainAccountId} accounts={accounts}
                placeholder="Select Cash / Bank account…" />
            </div>
            {mainAcct && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-orange-50 border border-orange-200 rounded-lg">
                <span className="text-xs text-orange-600 font-semibold">{mainAcct.account_name}</span>
                <span className="text-xs text-gray-400 font-mono">
                  Bal: {Number(mainAcct.current_balance || 0).toLocaleString('en-PK', { minimumFractionDigits: 0 })}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Entry Form */}
        <div className={`px-5 py-4 ${editingId !== null ? 'bg-amber-50/60' : 'bg-white'}`}>
          {editingId !== null && (
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-amber-600 uppercase tracking-wide">Editing Entry</span>
              <button onClick={resetEntry} className="text-xs text-gray-400 hover:text-red-500 flex items-center gap-1 transition">
                <X size={12} /> Cancel
              </button>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_160px_auto] gap-3 items-end">
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5 block">
                <FileText size={10} className="inline mr-1" />Expense Account
              </label>
              <AccountSelector value={entry.account_id}
                onChange={id => setEntry(v => ({ ...v, account_id: id }))}
                onAfterSelect={() => narrationRef.current?.focus()}
                accounts={accounts} placeholder="Select account…" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5 block">
                Paid To / Description
              </label>
              <input
                ref={narrationRef} type="text" value={entry.narration}
                onChange={e => setEntry(v => ({ ...v, narration: e.target.value }))}
                onKeyDown={e => { if (e.key === 'Enter') amountRef.current?.focus(); }}
                placeholder="e.g. Supplier name, utility bill…"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-gray-300 bg-white text-gray-700"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5 block">
                Amount (Rs.)
              </label>
              <input
                ref={amountRef} type="number" step="0.01" min="0" value={entry.amount}
                onChange={e => setEntry(v => ({ ...v, amount: e.target.value }))}
                onKeyDown={e => { if (e.key === 'Enter') saveEntry(); }}
                placeholder="0.00"
                className="w-full px-3 py-2 border border-orange-200 bg-orange-50 rounded-lg text-sm text-right font-bold font-mono text-orange-700 outline-none focus:ring-2 focus:ring-orange-300"
              />
            </div>
            <button onClick={saveEntry} disabled={saving}
              className="flex items-center justify-center gap-1.5 px-4 py-2 bg-gray-800 hover:bg-gray-900 text-white rounded-lg text-sm font-medium transition disabled:opacity-50 whitespace-nowrap shadow-sm">
              {saving
                ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : editingId !== null ? <Check size={14} /> : <Plus size={14} />}
              {editingId !== null ? 'Update' : 'Add'}
            </button>
          </div>
        </div>
      </div>

      {/* Lines Table */}
      {savedLines.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm text-center py-14 text-gray-400">
          <div className="w-14 h-14 bg-orange-50 border-2 border-dashed border-orange-200 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <ArrowUpRight size={22} className="text-orange-300" />
          </div>
          <p className="font-medium text-gray-500 text-sm">No entries yet</p>
          <p className="text-xs text-gray-400 mt-1">Fill the form above and click Add</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden mb-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-800 text-white">
                <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide">Account</th>
                <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide">Description</th>
                <th className="text-right px-4 py-3 font-semibold text-xs uppercase tracking-wide">Amount</th>
                <th className="w-20 px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {savedLines.map((line, i) => (
                <tr key={line.voucher_id}
                  className={`transition ${editingId === line.voucher_id ? 'bg-amber-50 ring-1 ring-inset ring-amber-300' : i % 2 === 0 ? 'bg-white hover:bg-gray-50/60' : 'bg-gray-50/30 hover:bg-gray-50/60'}`}>
                  <td className="px-4 py-3 font-semibold text-gray-700 text-sm">{line.account_name}</td>
                  <td className="px-4 py-3 text-gray-500 text-sm">{line.narration || <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-3 text-right font-bold font-mono text-orange-700 text-sm">
                    {line.amount.toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => {
                        setEditingId(line.voucher_id);
                        setEntry({ account_id: line.account_id, narration: line.narration, amount: String(line.amount) });
                      }} className="p-1.5 text-gray-300 hover:text-orange-500 hover:bg-orange-50 rounded-lg transition">
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => deleteLine(line.voucher_id)}
                        className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-orange-500 text-white">
                <td colSpan={2} className="px-4 py-3 font-semibold text-xs uppercase tracking-wide">
                  {savedLines.length} {savedLines.length === 1 ? 'Entry' : 'Entries'}
                </td>
                <td className="px-4 py-3 text-right font-bold font-mono text-base">
                  {total.toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Done Button */}
      <div className="flex justify-end">
        <button onClick={() => { onRefresh(); onBack(); }}
          className="flex items-center gap-2 px-6 py-2.5 bg-gray-800 hover:bg-gray-900 text-white rounded-lg text-sm font-medium transition shadow-sm">
          <Check size={15} /> Done
        </button>
      </div>
    </div>
  );
};

const PaymentVouchers = () => {
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
      const res = await api.get('/accounting/payment-vouchers', {
        params: { ...filters, page: pagination.page, limit: pagination.limit }
      });
      setVouchers(res.data.data || []);
      setPagination(res.data.pagination);
    } catch { toast.error('Failed to load payment vouchers'); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (hasLoaded) fetchVouchers(); }, [pagination.page]);

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this voucher entry?')) return;
    try {
      await api.delete(`/accounting/payment-vouchers/${id}`);
      toast.success('Deleted'); fetchVouchers();
    } catch (err: any) { toast.error(err.response?.data?.message || 'Delete failed'); }
  };

  const exportCSV = () => {
    const header = 'Voucher #,Date,Account,Description,Amount';
    const rows = vouchers.map(v => [
      v.voucher_number,
      new Date(v.voucher_date).toLocaleDateString(),
      `"${v.account_name || ''}"`,
      `"${v.description || v.payment_to || ''}"`,
      Number(v.amount).toFixed(2),
    ].join(','));
    const csv = [header, ...rows].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `cpv-${filters.from_date}-to-${filters.to_date}.csv`;
    a.click(); URL.revokeObjectURL(a.href);
  };

  const totalAmt = vouchers.reduce((s, v) => s + Number(v.amount), 0);

  if (view === 'new') return <CPVForm onBack={() => setView('list')} onRefresh={fetchVouchers} />;

  return (
    <div className="p-6">

      {/* Header */}
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <ArrowUpRight size={20} className="text-orange-500" /> Cash Payment Vouchers
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Track all outgoing payments</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCSV} disabled={vouchers.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition shadow-sm disabled:opacity-40">
            <Download size={14} /> Export
          </button>
          <button onClick={() => setView('new')}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-900 text-white rounded-lg text-sm font-medium transition shadow-sm">
            <Plus size={14} /> New CPV
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-400 font-medium">From</span>
          <input type="date" value={filters.from_date}
            onChange={e => setFilters(f => ({ ...f, from_date: e.target.value }))}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-gray-300" />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-400 font-medium">To</span>
          <input type="date" value={filters.to_date}
            onChange={e => setFilters(f => ({ ...f, to_date: e.target.value }))}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-gray-300" />
        </div>
        <button onClick={() => { setPagination(p => ({ ...p, page: 1 })); fetchVouchers(); }} disabled={loading}
          className="flex items-center gap-1.5 px-4 py-2 bg-gray-800 text-white rounded-lg text-sm font-medium hover:bg-gray-900 transition disabled:opacity-60 shadow-sm">
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
          <div className="bg-orange-50 rounded-xl border border-orange-100 shadow-sm px-4 py-3 text-center">
            <p className="text-xs text-orange-500 font-semibold uppercase tracking-wide">Total Payments</p>
            <p className="text-xl font-bold text-orange-700 mt-1 font-mono">
              {totalAmt.toLocaleString('en-PK', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {!hasLoaded ? (
          <div className="text-center py-16 text-gray-400">
            <ArrowUpRight size={40} className="mx-auto mb-3 opacity-20" />
            <p className="font-medium text-gray-500">Select date range and click <strong className="text-gray-800">Search</strong></p>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-14">
            <div className="animate-spin h-6 w-6 rounded-full border-2 border-gray-300 border-t-gray-700" />
          </div>
        ) : vouchers.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <ArrowUpRight size={40} className="mx-auto mb-3 opacity-20" />
            <p className="font-medium text-gray-500 text-sm">No vouchers found for this period</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="bg-gray-800 text-white">
                    <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide">Voucher #</th>
                    <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide">Date</th>
                    <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide">Account</th>
                    <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide">Description</th>
                    <th className="text-right px-4 py-3 font-semibold text-xs uppercase tracking-wide text-orange-300">Amount</th>
                    <th className="w-12 px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {vouchers.map((v, i) => (
                    <tr key={v.voucher_id}
                      className={`hover:bg-gray-50 transition ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}>
                      <td className="px-4 py-3 font-mono font-bold text-orange-600 text-xs">{v.voucher_number}</td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">
                        {new Date(v.voucher_date).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-3 text-gray-700 font-semibold text-sm">{v.account_name}</td>
                      <td className="px-4 py-3 text-gray-500 max-w-[160px] truncate text-sm">{v.description || v.payment_to || <span className="text-gray-300">—</span>}</td>
                      <td className="px-4 py-3 text-right font-bold font-mono text-orange-700">
                        {Number(v.amount).toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => handleDelete(v.voucher_id)}
                          className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition">
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-100 border-t-2 border-gray-300 font-semibold">
                    <td colSpan={4} className="px-4 py-3 text-right text-gray-700 text-xs uppercase tracking-wide">Total (this page)</td>
                    <td className="px-4 py-3 text-right font-bold font-mono text-orange-700">{totalAmt.toLocaleString('en-PK', { minimumFractionDigits: 2 })}</td>
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

export default PaymentVouchers;
