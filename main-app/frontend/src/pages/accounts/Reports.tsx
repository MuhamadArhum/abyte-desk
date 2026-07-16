import { useState, useEffect } from 'react';
import { Printer, Download, TrendingDown, Users, BookOpen } from 'lucide-react';
import DateRangeFilter from '../../components/DateRangeFilter';
import api from '../../utils/api';
import { localToday } from '../../utils/dateUtils';
import ReportPasswordGate from '../../components/ReportPasswordGate';
import { useToast } from '../../components/Toast';

const fmt = (n: number) => new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

const exportCSV = (data: any[], filename: string, columns: { key: string; label: string }[]) => {
  const header = columns.map(c => c.label).join(',');
  const rows = data.map(row => columns.map(c => {
    const val = row[c.key] ?? '';
    const str = String(val);
    return str.includes(',') || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
  }).join(','));
  const csv = [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
};

const Reports = () => {
  const toast = useToast();
  const [pl, setPl] = useState<any>(null);
  const [bs, setBs] = useState<any>(null);
  const [vouchers, setVouchers] = useState<{ cpv: any; crv: any } | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState(localToday());

  // Cash Flow
  const [cfFrom, setCfFrom] = useState(localToday());
  const [cfTo, setCfTo] = useState(localToday());
  const [cfData, setCfData] = useState<any>(null);
  const [cfLoading, setCfLoading] = useState(false);

  // Payables Aging
  const [payables, setPayables] = useState<any[]>([]);
  const [payablesSummary, setPayablesSummary] = useState<any>(null);
  const [payablesLoading, setPayablesLoading] = useState(false);

  // Account Statement
  const [accounts, setAccounts] = useState<any[]>([]);
  const [stmtAccountId, setStmtAccountId] = useState('');
  const [stmtFrom, setStmtFrom] = useState(localToday());
  const [stmtTo, setStmtTo] = useState(localToday());
  const [stmtData, setStmtData] = useState<any>(null);
  const [stmtLoading, setStmtLoading] = useState(false);
  const [dateTo, setDateTo] = useState(localToday());

  useEffect(() => {
    fetchAll();
    api.get('/accounting/accounts', { params: { limit: 500 } }).then(r => setAccounts(r.data.data || [])).catch(() => {});
  }, []);

  const fetchAll = async (from = dateFrom, to = dateTo) => {
    setLoading(true);
    try {
      const [plRes, bsRes, cpvRes, crvRes] = await Promise.all([
        api.get('/accounting/reports/profit-loss', { params: { from_date: from, to_date: to } }),
        api.get('/accounting/reports/balance-sheet', { params: { as_of_date: to } }),
        api.get('/accounting/payment-vouchers', { params: { from_date: from, to_date: to, limit: 5 } }),
        api.get('/accounting/receipt-vouchers', { params: { from_date: from, to_date: to, limit: 5 } }),
      ]);
      setPl(plRes.data);
      setBs(bsRes.data);
      setVouchers({ cpv: cpvRes.data, crv: crvRes.data });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCashFlow = async () => {
    setCfLoading(true);
    try {
      const res = await api.get('/accounting/reports/cash-flow', { params: { from_date: cfFrom, to_date: cfTo } });
      setCfData(res.data);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to load cash flow');
    } finally {
      setCfLoading(false);
    }
  };

  const fetchPayablesAging = async () => {
    setPayablesLoading(true);
    try {
      const res = await api.get('/accounting/reports/payables-aging');
      setPayables(res.data.data || []);
      setPayablesSummary(res.data.summary || null);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to load payables aging');
    } finally {
      setPayablesLoading(false);
    }
  };

  const fetchAccountStatement = async () => {
    if (!stmtAccountId) { toast.error('Select an account'); return; }
    setStmtLoading(true);
    try {
      const res = await api.get('/accounting/reports/account-statement', {
        params: { account_id: stmtAccountId, from_date: stmtFrom, to_date: stmtTo }
      });
      setStmtData(res.data);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to load account statement');
    } finally {
      setStmtLoading(false);
    }
  };

  const handlePrint = () => window.print();

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Accounting Reports</h1>
          <p className="text-sm text-gray-500">Profit & Loss, Balance Sheet, Voucher Summary</p>
        </div>
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors print:hidden"
        >
          <Printer size={16} /> Print
        </button>
      </div>

      <DateRangeFilter
        dateFrom={dateFrom}
        dateTo={dateTo}
        onFromChange={setDateFrom}
        onToChange={setDateTo}
        onApply={() => fetchAll(dateFrom, dateTo)}
      />

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Profit & Loss */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b bg-gray-50">
              <h2 className="font-semibold text-gray-800">Profit & Loss Statement</h2>
              <p className="text-xs text-gray-500 mt-0.5">{pl?.period?.from_date} to {pl?.period?.to_date}</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-gray-100">
              {/* Revenue */}
              <div className="p-5">
                <h3 className="text-sm font-semibold text-emerald-700 mb-3 uppercase tracking-wide">Revenue</h3>
                {(pl?.revenue?.accounts || []).length === 0 ? (
                  <p className="text-sm text-gray-400">No revenue entries</p>
                ) : (
                  <table className="w-full text-sm">
                    <tbody>
                      {(pl?.revenue?.accounts || []).map((a: any) => (
                        <tr key={a.account_id} className="border-b last:border-0">
                          <td className="py-2 text-gray-600">{a.account_code} — {a.account_name}</td>
                          <td className="py-2 text-right font-medium text-gray-800">{fmt(a.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-emerald-200 bg-emerald-50">
                        <td className="py-2.5 px-1 font-semibold text-emerald-800">Total Revenue</td>
                        <td className="py-2.5 text-right font-bold text-emerald-800">{fmt(pl?.revenue?.total || 0)}</td>
                      </tr>
                    </tfoot>
                  </table>
                )}
              </div>

              {/* Expenses */}
              <div className="p-5">
                <h3 className="text-sm font-semibold text-red-600 mb-3 uppercase tracking-wide">Expenses</h3>
                {(pl?.expenses?.accounts || []).length === 0 ? (
                  <p className="text-sm text-gray-400">No expense entries</p>
                ) : (
                  <table className="w-full text-sm">
                    <tbody>
                      {(pl?.expenses?.accounts || []).map((a: any) => (
                        <tr key={a.account_id} className="border-b last:border-0">
                          <td className="py-2 text-gray-600">{a.account_code} — {a.account_name}</td>
                          <td className="py-2 text-right font-medium text-gray-800">{fmt(a.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-red-200 bg-red-50">
                        <td className="py-2.5 px-1 font-semibold text-red-700">Total Expenses</td>
                        <td className="py-2.5 text-right font-bold text-red-700">{fmt(pl?.expenses?.total || 0)}</td>
                      </tr>
                    </tfoot>
                  </table>
                )}
              </div>
            </div>

            {/* Net Profit/Loss */}
            <div className={`flex justify-between items-center px-6 py-4 border-t ${(pl?.net_profit ?? 0) >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
              <span className={`font-bold text-lg ${(pl?.net_profit ?? 0) >= 0 ? 'text-emerald-800' : 'text-red-700'}`}>
                {(pl?.net_profit ?? 0) >= 0 ? 'Net Profit' : 'Net Loss'}
              </span>
              <span className={`font-bold text-xl ${(pl?.net_profit ?? 0) >= 0 ? 'text-emerald-800' : 'text-red-700'}`}>
                {(pl?.net_profit ?? 0) < 0 ? '-' : ''}{fmt(Math.abs(pl?.net_profit ?? 0))}
              </span>
            </div>
          </div>

          {/* Balance Sheet Summary */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b bg-gray-50">
              <h2 className="font-semibold text-gray-800">Balance Sheet Summary</h2>
              <p className="text-xs text-gray-500 mt-0.5">As of {bs?.as_of_date}</p>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-gray-100">
              <div className="p-5">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Total Assets</p>
                <p className="text-2xl font-bold text-emerald-700">{fmt(bs?.total_assets || 0)}</p>
              </div>
              <div className="p-5">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Total Liabilities</p>
                <p className="text-2xl font-bold text-red-600">{fmt(bs?.total_liabilities || 0)}</p>
              </div>
              <div className="p-5">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Total Equity</p>
                <p className="text-2xl font-bold text-emerald-700">{fmt(bs?.total_equity || 0)}</p>
                {(bs?.net_profit ?? 0) !== 0 && (
                  <p className="text-xs text-gray-400 mt-1">incl. net profit {(bs?.net_profit ?? 0) >= 0 ? '+' : ''}{fmt(bs?.net_profit ?? 0)}</p>
                )}
              </div>
            </div>
            <div className="px-6 py-3 border-t bg-gray-50 flex justify-between text-sm">
              <span className="text-gray-600 font-medium">Liabilities + Equity</span>
              <span className="font-bold text-gray-800">{fmt(bs?.total_liabilities_equity || 0)}</span>
            </div>
          </div>

          {/* Voucher Summary */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* CPV */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b bg-gray-50">
                <h2 className="font-semibold text-gray-800 text-sm">Recent Cash Payment Vouchers (CPV)</h2>
              </div>
              <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[400px]">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left px-5 py-2.5 text-gray-500 font-medium">Voucher #</th>
                    <th className="text-left px-5 py-2.5 text-gray-500 font-medium">Date</th>
                    <th className="text-right px-5 py-2.5 text-gray-500 font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {(vouchers?.cpv?.data || []).length === 0 ? (
                    <tr><td colSpan={3} className="px-5 py-6 text-center text-gray-400">No CPVs for this period</td></tr>
                  ) : (
                    (vouchers?.cpv?.data || []).map((v: any) => (
                      <tr key={v.voucher_id} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="px-5 py-2.5 font-mono text-gray-700">{v.voucher_number}</td>
                        <td className="px-5 py-2.5 text-gray-600">{v.voucher_date}</td>
                        <td className="px-5 py-2.5 text-right font-medium text-gray-800">{fmt(Number(v.amount))}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              </div>
            </div>

            {/* CRV */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b bg-gray-50">
                <h2 className="font-semibold text-gray-800 text-sm">Recent Cash Receipt Vouchers (CRV)</h2>
              </div>
              <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[400px]">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left px-5 py-2.5 text-gray-500 font-medium">Voucher #</th>
                    <th className="text-left px-5 py-2.5 text-gray-500 font-medium">Date</th>
                    <th className="text-right px-5 py-2.5 text-gray-500 font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {(vouchers?.crv?.data || []).length === 0 ? (
                    <tr><td colSpan={3} className="px-5 py-6 text-center text-gray-400">No CRVs for this period</td></tr>
                  ) : (
                    (vouchers?.crv?.data || []).map((v: any) => (
                      <tr key={v.voucher_id} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="px-5 py-2.5 font-mono text-gray-700">{v.voucher_number}</td>
                        <td className="px-5 py-2.5 text-gray-600">{v.voucher_date}</td>
                        <td className="px-5 py-2.5 text-right font-medium text-gray-800">{fmt(Number(v.amount))}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Cash Flow Statement ─────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b bg-gray-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingDown size={18} className="text-emerald-600" />
            <div>
              <h2 className="font-semibold text-gray-800">Cash Flow Statement</h2>
              <p className="text-xs text-gray-500 mt-0.5">Receipts vs Payments summary</p>
            </div>
          </div>
        </div>
        <div className="p-5">
          <div className="flex flex-wrap gap-3 items-end mb-5">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">From</label>
              <input type="date" value={cfFrom} onChange={e => setCfFrom(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">To</label>
              <input type="date" value={cfTo} onChange={e => setCfTo(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500" />
            </div>
            <button onClick={fetchCashFlow} disabled={cfLoading}
              className="px-5 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm transition disabled:opacity-50">
              {cfLoading ? 'Loading...' : 'Generate'}
            </button>
          </div>
          {cfData && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: `Total Receipts (${cfData.summary.receipt_count})`, value: cfData.summary.total_receipts, color: 'text-emerald-600' },
                  { label: `Total Payments (${cfData.summary.payment_count})`, value: cfData.summary.total_payments, color: 'text-red-600' },
                  { label: 'Net Cash Flow', value: cfData.summary.net_cash_flow, color: cfData.summary.net_cash_flow >= 0 ? 'text-emerald-600' : 'text-red-600' },
                ].map(c => (
                  <div key={c.label} className="bg-gray-50 rounded-lg p-4 text-center border border-gray-100">
                    <p className="text-xs text-gray-500">{c.label}</p>
                    <p className={`text-xl font-bold mt-1 ${c.color}`}>{fmt(c.value)}</p>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Top Receipts by Account</h3>
                  <div className="space-y-1">
                    {cfData.top_receipts.map((r: any) => (
                      <div key={r.account_name} className="flex justify-between text-sm py-1 border-b border-gray-50">
                        <span className="text-gray-700">{r.account_name}</span>
                        <span className="text-emerald-600 font-medium">{fmt(r.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Top Payments by Account</h3>
                  <div className="space-y-1">
                    {cfData.top_payments.map((r: any) => (
                      <div key={r.account_name} className="flex justify-between text-sm py-1 border-b border-gray-50">
                        <span className="text-gray-700">{r.account_name}</span>
                        <span className="text-red-600 font-medium">{fmt(r.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
          {!cfData && !cfLoading && (
            <p className="text-center text-gray-400 py-6 text-sm">Select date range and click Generate</p>
          )}
        </div>
      </div>

      {/* ── Payables Aging ─────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b bg-gray-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users size={18} className="text-emerald-600" />
            <div>
              <h2 className="font-semibold text-gray-800">Payables Aging</h2>
              <p className="text-xs text-gray-500 mt-0.5">Outstanding supplier payables by age</p>
            </div>
          </div>
          <div className="flex gap-2">
            {payables.length > 0 && (
              <button onClick={() => exportCSV(payables, 'payables-aging', [
                { key: 'supplier_name', label: 'Supplier' }, { key: 'invoice_count', label: 'Invoices' },
                { key: 'total_outstanding', label: 'Total Outstanding' }, { key: 'current', label: 'Current' },
                { key: 'days_1_30', label: '1-30 Days' }, { key: 'days_31_60', label: '31-60 Days' },
                { key: 'days_61_90', label: '61-90 Days' }, { key: 'days_90_plus', label: '90+ Days' },
              ])} className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">
                <Download size={14} /> Export
              </button>
            )}
            <button onClick={fetchPayablesAging} disabled={payablesLoading}
              className="px-4 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm transition disabled:opacity-50">
              {payablesLoading ? 'Loading...' : 'Refresh'}
            </button>
          </div>
        </div>
        <div className="p-5">
          {payablesSummary && (
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-5">
              {[
                { label: 'Total Outstanding', value: fmt(payablesSummary.total_outstanding), color: 'text-gray-800' },
                { label: 'Current', value: fmt(payablesSummary.current), color: 'text-emerald-600' },
                { label: '1–30 Days', value: fmt(payablesSummary.days_1_30), color: 'text-yellow-600' },
                { label: '31–60 Days', value: fmt(payablesSummary.days_31_60), color: 'text-orange-600' },
                { label: '61–90 Days', value: fmt(payablesSummary.days_61_90), color: 'text-red-500' },
                { label: '90+ Days', value: fmt(payablesSummary.days_90_plus), color: 'text-red-700' },
              ].map(c => (
                <div key={c.label} className="bg-gray-50 rounded-lg p-3 text-center border border-gray-100">
                  <p className="text-xs text-gray-500">{c.label}</p>
                  <p className={`text-sm font-bold mt-1 ${c.color}`}>{c.value}</p>
                </div>
              ))}
            </div>
          )}
          {payables.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>{['Supplier','Invoices','Total Outstanding','Current','1-30d','31-60d','61-90d','90+d'].map(h => (
                    <th key={h} className="px-4 py-3 text-left font-semibold text-gray-600">{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {payables.map((r: any) => (
                    <tr key={r.supplier_id} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-800">{r.supplier_name}</td>
                      <td className="px-4 py-3 text-center text-gray-600">{r.invoice_count}</td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-800">{fmt(r.total_outstanding)}</td>
                      <td className="px-4 py-3 text-right text-emerald-600">{fmt(r.current)}</td>
                      <td className="px-4 py-3 text-right text-yellow-600">{fmt(r.days_1_30)}</td>
                      <td className="px-4 py-3 text-right text-orange-600">{fmt(r.days_31_60)}</td>
                      <td className="px-4 py-3 text-right text-red-500">{fmt(r.days_61_90)}</td>
                      <td className="px-4 py-3 text-right font-bold text-red-700">{fmt(r.days_90_plus)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-center text-gray-400 py-6 text-sm">Click Refresh to load payables aging</p>
          )}
        </div>
      </div>

      {/* ── Account Statement ───────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b bg-gray-50 flex items-center gap-2">
          <BookOpen size={18} className="text-emerald-600" />
          <div>
            <h2 className="font-semibold text-gray-800">Account Statement</h2>
            <p className="text-xs text-gray-500 mt-0.5">Transactions for any GL account with running balance</p>
          </div>
        </div>
        <div className="p-5">
          <div className="flex flex-wrap gap-3 items-end mb-5">
            <div className="min-w-[220px]">
              <label className="block text-xs font-medium text-gray-600 mb-1">Account</label>
              <select value={stmtAccountId} onChange={e => setStmtAccountId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500">
                <option value="">Select Account</option>
                {accounts.map((a: any) => (
                  <option key={a.account_id} value={a.account_id}>{a.account_code} - {a.account_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">From</label>
              <input type="date" value={stmtFrom} onChange={e => setStmtFrom(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">To</label>
              <input type="date" value={stmtTo} onChange={e => setStmtTo(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500" />
            </div>
            <button onClick={fetchAccountStatement} disabled={stmtLoading}
              className="px-5 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm transition disabled:opacity-50">
              {stmtLoading ? 'Loading...' : 'Generate'}
            </button>
            {stmtData && stmtData.data.length > 0 && (
              <button onClick={() => exportCSV(stmtData.data, `account-statement-${stmtData.account?.account_code}`, [
                { key: 'txn_date', label: 'Date' }, { key: 'reference', label: 'Reference' },
                { key: 'description', label: 'Description' }, { key: 'source', label: 'Source' },
                { key: 'debit', label: 'Debit' }, { key: 'credit', label: 'Credit' }, { key: 'balance', label: 'Balance' },
              ])} className="flex items-center gap-1 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">
                <Download size={14} /> Export
              </button>
            )}
          </div>
          {stmtData && (
            <div className="space-y-4">
              <div className="flex gap-4 flex-wrap">
                <div className="bg-gray-50 rounded-lg px-4 py-3 border border-gray-100">
                  <p className="text-xs text-gray-500">Account</p>
                  <p className="font-semibold text-gray-800">{stmtData.account?.account_code} - {stmtData.account?.account_name}</p>
                </div>
                <div className="bg-gray-50 rounded-lg px-4 py-3 border border-gray-100">
                  <p className="text-xs text-gray-500">Opening Balance</p>
                  <p className={`font-semibold ${stmtData.opening_balance >= 0 ? 'text-gray-800' : 'text-red-600'}`}>{fmt(Math.abs(stmtData.opening_balance))}{stmtData.opening_balance < 0 ? ' Cr' : ' Dr'}</p>
                </div>
                <div className="bg-gray-50 rounded-lg px-4 py-3 border border-gray-100">
                  <p className="text-xs text-gray-500">Closing Balance</p>
                  <p className={`font-semibold ${stmtData.closing_balance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{fmt(Math.abs(stmtData.closing_balance))}{stmtData.closing_balance < 0 ? ' Cr' : ' Dr'}</p>
                </div>
                <div className="bg-gray-50 rounded-lg px-4 py-3 border border-gray-100">
                  <p className="text-xs text-gray-500">Transactions</p>
                  <p className="font-semibold text-gray-800">{stmtData.data.length}</p>
                </div>
              </div>
              {stmtData.data.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[650px] text-sm">
                    <thead className="bg-gray-50 border-b">
                      <tr>{['Date','Reference','Description','Source','Debit','Credit','Balance'].map(h => (
                        <th key={h} className="px-4 py-3 text-left font-semibold text-gray-600">{h}</th>
                      ))}</tr>
                    </thead>
                    <tbody>
                      {stmtData.data.map((r: any, i: number) => (
                        <tr key={i} className="border-b hover:bg-gray-50">
                          <td className="px-4 py-2.5 text-gray-600">{r.txn_date}</td>
                          <td className="px-4 py-2.5 font-mono text-gray-700 text-xs">{r.reference}</td>
                          <td className="px-4 py-2.5 text-gray-700 max-w-[200px] truncate">{r.description}</td>
                          <td className="px-4 py-2.5">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${r.source === 'Journal' ? 'bg-blue-100 text-blue-700' : r.source === 'CPV' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                              {r.source}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right text-gray-700">{r.debit > 0 ? fmt(r.debit) : '-'}</td>
                          <td className="px-4 py-2.5 text-right text-gray-700">{r.credit > 0 ? fmt(r.credit) : '-'}</td>
                          <td className="px-4 py-2.5 text-right font-semibold text-gray-800">{fmt(Math.abs(r.balance))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-center text-gray-400 py-4 text-sm">No transactions found for this period</p>
              )}
            </div>
          )}
          {!stmtData && !stmtLoading && (
            <p className="text-center text-gray-400 py-6 text-sm">Select an account and date range, then click Generate</p>
          )}
        </div>
      </div>

    </div>
  );
};

const ReportsWithGate = () => <ReportPasswordGate><Reports /></ReportPasswordGate>;
export default ReportsWithGate;
