import { useState, useEffect, useRef, useCallback } from 'react';
import { Book, RefreshCw, Printer, Search, ChevronDown, TrendingUp, TrendingDown } from 'lucide-react';
import Pagination from '../../components/Pagination';
import api from '../../utils/api';
import { useToast } from '../../components/Toast';
import { localToday } from '../../utils/dateUtils';
import ReportPasswordGate from '../../components/ReportPasswordGate';

// ── Searchable account picker ────────────────────────────────────────────────
const AccountPicker = ({
  value, onChange, accounts
}: { value: string; onChange: (id: string) => void; accounts: any[] }) => {
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

  useEffect(() => { setHi(0); }, [search]);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const select = (id: string) => { onChange(id); setOpen(false); setSearch(''); };

  return (
    <div ref={ref} className="relative w-full sm:min-w-[280px]">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white hover:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-left">
        <span className={selected ? 'font-medium text-gray-900' : 'text-gray-400'}>
          {selected ? `${selected.account_code} — ${selected.account_name}` : 'Select Account...'}
        </span>
        <ChevronDown size={14} className="text-gray-400 ml-2 shrink-0" />
      </button>
      {open && (
        <div className="absolute z-50 left-0 top-full mt-1 w-full sm:w-96 bg-white border border-gray-200 rounded-xl shadow-2xl">
          <div className="p-2 border-b border-gray-100">
            <div className="flex items-center gap-2 px-2 py-1.5 bg-gray-50 rounded-lg">
              <Search size={13} className="text-gray-400" />
              <input autoFocus type="text" value={search} onChange={e => setSearch(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'ArrowDown') { e.preventDefault(); setHi(h => Math.min(h + 1, filtered.length - 1)); }
                  else if (e.key === 'ArrowUp') { e.preventDefault(); setHi(h => Math.max(h - 1, 0)); }
                  else if (e.key === 'Enter' && filtered.length > 0) { e.preventDefault(); select(String(filtered[hi]?.account_id ?? filtered[0].account_id)); }
                  else if (e.key === 'Escape') setOpen(false);
                }}
                className="bg-transparent text-sm outline-none w-full" placeholder="Search by name or code..." />
            </div>
          </div>
          <ul className="max-h-64 overflow-y-auto py-1">
            {filtered.length === 0
              ? <li className="px-4 py-3 text-sm text-gray-400">No accounts found</li>
              : filtered.map((a, idx) => (
                <li key={a.account_id}>
                  <button type="button" onClick={() => select(String(a.account_id))}
                    className={`w-full text-left px-4 py-2.5 flex items-center justify-between gap-3 ${idx === hi ? 'bg-emerald-50' : 'hover:bg-gray-50'}`}>
                    <div>
                      <span className="text-xs font-mono text-gray-400">{a.account_code}</span>
                      <span className="ml-2 text-sm text-gray-800 font-medium">{a.account_name}</span>
                    </div>
                    <span className="text-xs text-gray-500 shrink-0 capitalize">{a.account_type}</span>
                  </button>
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
};

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n: number) => Math.abs(n).toLocaleString('en-PK', { minimumFractionDigits: 2 });
const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' });

// ── Main Component ────────────────────────────────────────────────────────────
const GeneralLedger = () => {
  const toast = useToast();
  const [accounts, setAccounts] = useState<any[]>([]);

  // Read URL params — set by Trial Balance 6 Col when opening in new tab
  const urlParams  = new URLSearchParams(window.location.search);
  const paramAccId = urlParams.get('account_id') || '';
  const paramFrom  = urlParams.get('from_date')  || localToday();
  const paramTo    = urlParams.get('to_date')    || localToday();

  const [selectedAccount, setSelectedAccount] = useState(paramAccId);
  const [fromDate, setFromDate] = useState(paramFrom);
  const [toDate, setToDate]     = useState(paramTo);

  const [loading, setLoading] = useState(false);
  const [ledgerData, setLedgerData] = useState<any[]>([]);
  const [openingBalance, setOpeningBalance] = useState(0);
  const [accountInfo, setAccountInfo] = useState<any>(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 0 });

  useEffect(() => {
    api.get('/accounting/accounts', { params: { tree: 1 } })
      .then(r => setAccounts((r.data.data || []).filter((a: any) => a.is_active && a.level >= 4)))
      .catch(() => {});
  }, []);

  const fetchLedger = useCallback(async (page = 1) => {
    if (!selectedAccount) { toast.error('Please select an account first'); return; }
    setLoading(true);
    try {
      const res = await api.get('/accounting/general-ledger', {
        params: { account_id: selectedAccount, from_date: fromDate, to_date: toDate, page, limit: pagination.limit }
      });
      setLedgerData(res.data.data || []);
      setOpeningBalance(Number(res.data.opening_balance || 0));
      setAccountInfo(res.data.account || null);
      if (res.data.pagination) setPagination(res.data.pagination);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to load ledger');
    } finally {
      setLoading(false);
    }
  }, [selectedAccount, fromDate, toDate]);

  // Auto-load when opened from Trial Balance via URL params
  useEffect(() => {
    if (paramAccId && accounts.length > 0) fetchLedger(1);
  }, [accounts]);

  // Compute running balance from opening balance
  const debitIncrease = accountInfo ? ['asset', 'expense'].includes(accountInfo.account_type) : true;
  const rows: { row: any; runningBalance: number }[] = [];
  let running = openingBalance;
  for (const row of ledgerData) {
    const dr = Number(row.debit || 0);
    const cr = Number(row.credit || 0);
    running += debitIncrease ? (dr - cr) : (cr - dr);
    rows.push({ row, runningBalance: running });
  }
  const closingBalance = running;

  const totalDebit = ledgerData.reduce((s, r) => s + Number(r.debit || 0), 0);
  const totalCredit = ledgerData.reduce((s, r) => s + Number(r.credit || 0), 0);

  const handlePrint = () => {
    if (!accountInfo || rows.length === 0) return;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<html><head><title>Account Ledger</title>
    <style>
      body { font-family: Arial, sans-serif; font-size: 12px; margin: 20px; }
      h2 { text-align: center; margin: 0; font-size: 16px; }
      p  { text-align: center; color: #555; margin: 4px 0 16px; }
      table { width: 100%; border-collapse: collapse; }
      th { background: #1f2937; color: white; padding: 8px; text-align: left; font-size: 11px; }
      td { padding: 6px 8px; border-bottom: 1px solid #e5e7eb; }
      .right { text-align: right; }
      .ob { background: #f0fdf4; font-style: italic; }
      .total { background: #f3f4f6; font-weight: bold; }
      .cb { background: #ecfdf5; font-weight: bold; }
    </style></head><body>
    <h2>Account Ledger — ${accountInfo.account_name}</h2>
    <p>Code: ${accountInfo.account_code} &nbsp;|&nbsp; Period: ${fromDate} to ${toDate}</p>
    <table>
      <tr><th>Date</th><th>JV #</th><th>Narration</th><th class="right">Debit</th><th class="right">Credit</th><th class="right">Balance</th></tr>
      <tr class="ob"><td colspan="3">Opening Balance</td><td class="right"></td><td class="right"></td><td class="right">${fmt(openingBalance)} ${openingBalance >= 0 ? 'Dr' : 'Cr'}</td></tr>
      ${rows.map(({ row, runningBalance }) => `
        <tr>
          <td>${fmtDate(row.entry_date)}</td>
          <td>${row.entry_number}</td>
          <td>${row.description || ''}</td>
          <td class="right">${Number(row.debit) > 0 ? fmt(row.debit) : ''}</td>
          <td class="right">${Number(row.credit) > 0 ? fmt(row.credit) : ''}</td>
          <td class="right">${fmt(runningBalance)} ${runningBalance >= 0 ? 'Dr' : 'Cr'}</td>
        </tr>`).join('')}
      <tr class="total"><td colspan="3">Total</td><td class="right">${fmt(totalDebit)}</td><td class="right">${fmt(totalCredit)}</td><td></td></tr>
      <tr class="cb"><td colspan="3">Closing Balance</td><td></td><td></td><td class="right">${fmt(closingBalance)} ${closingBalance >= 0 ? 'Dr' : 'Cr'}</td></tr>
    </table>
    </body></html>`);
    win.document.close();
    win.print();
  };

  return (
    <div className="p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-emerald-100 rounded-xl flex items-center justify-center">
            <Book size={18} className="text-emerald-700" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Account Ledger</h1>
            <p className="text-sm text-gray-500">Per-account transaction history with running balance</p>
          </div>
        </div>
        {ledgerData.length > 0 && (
          <button onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition">
            <Printer size={15} /> <span className="hidden sm:inline">Print Ledger</span>
          </button>
        )}
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-6">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Account</label>
            <AccountPicker value={selectedAccount} onChange={setSelectedAccount} accounts={accounts} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">From Date</label>
            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">To Date</label>
            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500" />
          </div>
          <button onClick={() => fetchLedger(1)}
            className="px-6 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 transition shadow-sm">
            View Ledger
          </button>
          <button onClick={() => { setSelectedAccount(''); setLedgerData([]); setAccountInfo(null); setFromDate(localToday()); setToDate(localToday()); }}
            className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition">
            <RefreshCw size={14} /> Reset
          </button>
        </div>
      </div>

      {/* Account Info Cards — shown after data loads */}
      {accountInfo && ledgerData.length >= 0 && !loading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4">
            <p className="text-xs text-gray-500 mb-1">Account</p>
            <p className="font-bold text-gray-900">{accountInfo.account_name}</p>
            <p className="text-xs text-gray-400 mt-0.5 font-mono">{accountInfo.account_code}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4">
            <p className="text-xs text-gray-500 mb-1">Opening Balance</p>
            <p className={`font-bold text-lg ${openingBalance >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
              {fmt(openingBalance)}
            </p>
            <p className="text-xs text-gray-400">{openingBalance >= 0 ? 'Debit' : 'Credit'}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4">
            <p className="text-xs text-gray-500 mb-1">Period Turnover</p>
            <div className="flex items-center gap-3 mt-1">
              <div>
                <p className="text-xs text-gray-400">Dr</p>
                <p className="font-semibold text-emerald-700">{fmt(totalDebit)}</p>
              </div>
              <div className="w-px h-8 bg-gray-200" />
              <div>
                <p className="text-xs text-gray-400">Cr</p>
                <p className="font-semibold text-gray-600">{fmt(totalCredit)}</p>
              </div>
            </div>
          </div>
          <div className={`rounded-xl border shadow-sm px-5 py-4 ${closingBalance >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
            <p className="text-xs text-gray-500 mb-1">Closing Balance</p>
            <p className={`font-bold text-lg ${closingBalance >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
              {fmt(closingBalance)}
            </p>
            <div className="flex items-center gap-1 mt-0.5">
              {closingBalance >= 0
                ? <TrendingUp size={13} className="text-emerald-600" />
                : <TrendingDown size={13} className="text-red-500" />}
              <p className="text-xs text-gray-500">{closingBalance >= 0 ? 'Debit' : 'Credit'}</p>
            </div>
          </div>
        </div>
      )}

      {/* Ledger Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {!selectedAccount && !loading ? (
          <div className="text-center py-16 text-gray-400">
            <Book size={48} className="mx-auto mb-3 opacity-20" />
            <p className="font-medium">Select an account to view its ledger</p>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin h-8 w-8 rounded-full border-2 border-emerald-600 border-t-transparent" />
          </div>
        ) : ledgerData.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Book size={48} className="mx-auto mb-3 opacity-20" />
            <p className="font-medium">No transactions found for this period</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[600px]">
                <thead>
                  <tr className="bg-gray-800 text-white">
                    <th className="px-4 py-3 text-left font-semibold rounded-tl-lg whitespace-nowrap">Date</th>
                    <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">JV #</th>
                    <th className="px-4 py-3 text-left font-semibold">Narration</th>
                    <th className="px-4 py-3 text-right font-semibold whitespace-nowrap">Debit</th>
                    <th className="px-4 py-3 text-right font-semibold whitespace-nowrap">Credit</th>
                    <th className="px-4 py-3 text-right font-semibold whitespace-nowrap rounded-tr-lg">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Opening Balance Row */}
                  <tr className="bg-emerald-50 border-b border-emerald-100">
                    <td className="px-4 py-3 text-xs text-emerald-600 font-medium" colSpan={3}>
                      Opening Balance — {fromDate}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-emerald-700 font-semibold">
                      {openingBalance > 0 ? fmt(openingBalance) : ''}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-600 font-semibold">
                      {openingBalance < 0 ? fmt(openingBalance) : ''}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-bold text-gray-800">
                      {fmt(openingBalance)}
                      <span className={`ml-1 text-xs font-normal ${openingBalance >= 0 ? 'text-emerald-600' : 'text-gray-600'}`}>
                        {openingBalance >= 0 ? 'Dr' : 'Cr'}
                      </span>
                    </td>
                  </tr>

                  {/* Transaction Rows */}
                  {rows.map(({ row, runningBalance }, i) => (
                    <tr key={row.line_id} className={`border-b border-gray-50 hover:bg-gray-50 transition ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{fmtDate(row.entry_date)}</td>
                      <td className="px-4 py-3 font-mono text-xs text-emerald-700 font-semibold">{row.entry_number}</td>
                      <td className="px-4 py-3 text-gray-700">{row.description || <span className="text-gray-300 italic">—</span>}</td>
                      <td className="px-4 py-3 text-right font-medium text-emerald-700">
                        {Number(row.debit) > 0 ? fmt(Number(row.debit)) : ''}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-600">
                        {Number(row.credit) > 0 ? fmt(Number(row.credit)) : ''}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-800">
                        {fmt(runningBalance)}
                        <span className={`ml-1 text-xs font-normal ${runningBalance >= 0 ? 'text-emerald-500' : 'text-gray-500'}`}>
                          {runningBalance >= 0 ? 'Dr' : 'Cr'}
                        </span>
                      </td>
                    </tr>
                  ))}

                  {/* Totals Row */}
                  <tr className="bg-gray-100 border-t-2 border-gray-300 font-bold">
                    <td colSpan={3} className="px-4 py-3 text-gray-700 text-right">Period Total</td>
                    <td className="px-4 py-3 text-right text-emerald-700">{fmt(totalDebit)}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{fmt(totalCredit)}</td>
                    <td className="px-4 py-3"></td>
                  </tr>

                  {/* Closing Balance Row */}
                  <tr className={`font-bold border-t border-gray-200 ${closingBalance >= 0 ? 'bg-emerald-50' : 'bg-red-50'}`}>
                    <td colSpan={3} className="px-4 py-3 text-gray-700 text-right">Closing Balance — {toDate}</td>
                    <td className="px-4 py-3 text-right text-emerald-700">
                      {closingBalance >= 0 ? fmt(closingBalance) : ''}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {closingBalance < 0 ? fmt(closingBalance) : ''}
                    </td>
                    <td className={`px-4 py-3 text-right text-base ${closingBalance >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                      {fmt(closingBalance)}
                      <span className="ml-1 text-xs font-normal">
                        {closingBalance >= 0 ? 'Dr' : 'Cr'}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <Pagination
              currentPage={pagination.page}
              totalPages={pagination.totalPages}
              onPageChange={p => { setPagination(prev => ({ ...prev, page: p })); fetchLedger(p); }}
              totalItems={pagination.total}
              itemsPerPage={pagination.limit}
              onItemsPerPageChange={limit => setPagination(p => ({ ...p, limit, page: 1 }))}
            />
          </>
        )}
      </div>
    </div>
  );
};

const GeneralLedgerWithGate = () => <ReportPasswordGate><GeneralLedger /></ReportPasswordGate>;
export default GeneralLedgerWithGate;
