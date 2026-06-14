import { useState, useEffect, useRef } from 'react';
import {
  ArrowDownLeft, Plus, Trash2, Download, Search,
  ChevronDown, Pencil, Check, X, Building2, FileText
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
            ? 'border-gray-300 bg-white text-gray-800 font-semibold'
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
                      ${idx === hi ? 'bg-emerald-600 text-white' : 'hover:bg-gray-50 text-gray-700'}`}
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

const CRVModal = ({ onClose, onRefresh }: { onClose: () => void; onRefresh: () => void }) => {
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

  const handleDone = () => { onRefresh(); onClose(); };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">

        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-emerald-100 rounded-lg flex items-center justify-center">
              <ArrowDownLeft size={18} className="text-emerald-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">Cash Receipt Voucher</h2>
              {voucherNum && (
                <span className="text-xs font-mono text-emerald-600 font-semibold">{voucherNum}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="date" value={date} onChange={e => setDate(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-emerald-400 outline-none"
            />
            <button onClick={handleDone} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {/* Receiving Account */}
          <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Building2 size={15} className="text-emerald-600" />
              <span className="text-sm font-semibold text-emerald-700">Receiving Account</span>
              {mainAcct && (
                <span className="ml-auto text-xs text-emerald-600 font-medium font-mono">
                  Bal: {Number(mainAcct.current_balance || 0).toLocaleString('en-PK', { minimumFractionDigits: 0 })}
                </span>
              )}
            </div>
            <AccountSelector
              value={mainAccountId} onChange={setMainAccountId}
              accounts={accounts} placeholder="Select Cash / Bank account…"
            />
          </div>

          {/* Entry Form */}
          <div className={`border border-gray-200 rounded-xl p-4 ${editingId !== null ? 'bg-emerald-50/40' : 'bg-gray-50/30'}`}>
            {editingId !== null && (
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">Editing Entry</span>
                <button onClick={resetEntry} className="text-xs text-gray-400 hover:text-red-500 flex items-center gap-1 transition">
                  <X size={11} /> Cancel edit
                </button>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_160px] gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <FileText size={12} className="inline mr-1" />Income Account
                </label>
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
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-400 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount (Rs.)</label>
                <input
                  ref={amountRef} type="number" step="0.01" min="0" value={entry.amount}
                  onChange={e => setEntry(v => ({ ...v, amount: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter') saveEntry(); }}
                  placeholder="0.00"
                  className="w-full border border-emerald-300 bg-emerald-50 rounded-lg px-3 py-2 text-sm text-right font-bold font-mono text-emerald-700 focus:ring-2 focus:ring-emerald-400 outline-none"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <button onClick={saveEntry} disabled={saving}
                className="flex items-center gap-2 px-5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium transition disabled:opacity-50 shadow-sm">
                {saving
                  ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : editingId !== null ? <Check size={14} /> : <Plus size={14} />}
                {editingId !== null ? 'Update Entry' : 'Add Entry'}
              </button>
            </div>
          </div>

          {/* Lines Table */}
          {savedLines.length === 0 ? (
            <div className="border border-dashed border-gray-200 rounded-xl text-center py-10 text-gray-400">
              <div className="w-12 h-12 bg-emerald-50 border-2 border-dashed border-emerald-200 rounded-xl flex items-center justify-center mx-auto mb-2">
                <ArrowDownLeft size={20} className="text-emerald-300" />
              </div>
              <p className="text-sm font-medium text-gray-500">No entries yet</p>
              <p className="text-xs text-gray-400 mt-0.5">Fill the form above and click Add Entry</p>
            </div>
          ) : (
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">Account</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">Description</th>
                    <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">Amount</th>
                    <th className="w-20 px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {savedLines.map((line, i) => (
                    <tr key={line.voucher_id}
                      className={`transition ${editingId === line.voucher_id
                        ? 'bg-emerald-50 ring-1 ring-inset ring-emerald-300'
                        : i % 2 === 0 ? 'bg-white hover:bg-gray-50' : 'bg-gray-50/40 hover:bg-gray-50'}`}>
                      <td className="px-4 py-2.5 font-semibold text-gray-700">{line.account_name}</td>
                      <td className="px-4 py-2.5 text-gray-500">{line.narration || <span className="text-gray-300">—</span>}</td>
                      <td className="px-4 py-2.5 text-right font-bold font-mono text-emerald-700">
                        {line.amount.toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => {
                            setEditingId(line.voucher_id);
                            setEntry({ account_id: line.account_id, narration: line.narration, amount: String(line.amount) });
                          }} className="p-1.5 text-gray-300 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition">
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
                  <tr className="bg-gray-50 border-t border-gray-200">
                    <td colSpan={2} className="px-4 py-2.5 text-sm font-semibold text-gray-600">
                      {savedLines.length} {savedLines.length === 1 ? 'Entry' : 'Entries'}
                    </td>
                    <td className="px-4 py-2.5 text-right font-bold font-mono text-emerald-700 text-base">
                      {total.toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="text-sm text-gray-500">
            {savedLines.length > 0 && (
              <>
                <span className="font-bold text-emerald-600">{savedLines.length}</span> entr{savedLines.length === 1 ? 'y' : 'ies'}
                <span className="mx-2 text-gray-300">·</span>
                <span className="font-mono font-semibold text-gray-700">Rs. {total.toLocaleString('en-PK', { minimumFractionDigits: 2 })}</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button onClick={handleDone}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition">
              Cancel
            </button>
            <button onClick={handleDone} disabled={savedLines.length === 0}
              className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold transition disabled:opacity-40 shadow-sm">
              <Check size={14} /> Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const ReceiptVouchers = () => {
  const toast = useToast();
  const [showForm, setShowForm]         = useState(false);
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
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition shadow-sm">
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
          className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition disabled:opacity-60 shadow-sm">
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
            <p className="font-medium text-gray-500">Select date range and click <strong className="text-gray-800">Search</strong></p>
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
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Voucher #</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Date</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Account</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Description</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-emerald-600 uppercase tracking-wide">Amount</th>
                    <th className="w-12 px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {vouchers.map((v, i) => (
                    <tr key={v.voucher_id}
                      className={`hover:bg-gray-50 transition ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}>
                      <td className="px-4 py-3 font-mono font-bold text-emerald-600 text-xs">{v.voucher_number}</td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">
                        {new Date(v.voucher_date).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-3 text-gray-700 font-semibold text-sm">{v.account_name}</td>
                      <td className="px-4 py-3 text-gray-500 max-w-[160px] truncate text-sm">
                        {v.description || v.received_from || <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right font-bold font-mono text-emerald-700">
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
                  <tr className="bg-gray-50 border-t border-gray-200 font-semibold">
                    <td colSpan={4} className="px-4 py-3 text-right text-gray-500 text-xs uppercase tracking-wide">Total (this page)</td>
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

      {showForm && <CRVModal onClose={() => setShowForm(false)} onRefresh={fetchVouchers} />}
    </div>
  );
};

export default ReceiptVouchers;
