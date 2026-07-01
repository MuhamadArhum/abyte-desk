import { useState } from 'react';
import { TrendingUp, TrendingDown, Download, RefreshCw, Printer, BarChart3, DollarSign, Percent } from 'lucide-react';
import DateRangeFilter from '../../components/DateRangeFilter';
import api from '../../utils/api';
import { useToast } from '../../components/Toast';
import { printReport, buildTable } from '../../utils/reportPrinter';
import { localToday } from '../../utils/dateUtils';
import ReportPasswordGate from '../../components/ReportPasswordGate';

interface PLSection {
  account_code: string;
  account_name: string;
  amount: number;
}

interface PLData {
  revenue: PLSection[];
  expenses: PLSection[];
  total_revenue: number;
  total_expenses: number;
  net_profit: number;
}

const fmt = (n: number) => new Intl.NumberFormat('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
const fmtShort = (n: number) => {
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toFixed(0);
};

const exportToCSV = (data: PLData, fromDate: string, toDate: string) => {
  const rows = [
    ['Section', 'Account Code', 'Account Name', 'Amount (Rs)', '% of Revenue'],
    ['REVENUE', '', '', '', ''],
    ...data.revenue.map(r => ['', r.account_code, r.account_name, r.amount.toFixed(2), data.total_revenue > 0 ? ((r.amount / data.total_revenue) * 100).toFixed(1) + '%' : '0%']),
    ['', '', 'Total Revenue', data.total_revenue.toFixed(2), '100%'],
    ['', '', '', '', ''],
    ['EXPENSES', '', '', '', ''],
    ...data.expenses.map(e => ['', e.account_code, e.account_name, e.amount.toFixed(2), data.total_revenue > 0 ? ((e.amount / data.total_revenue) * 100).toFixed(1) + '%' : '0%']),
    ['', '', 'Total Expenses', data.total_expenses.toFixed(2), data.total_revenue > 0 ? ((data.total_expenses / data.total_revenue) * 100).toFixed(1) + '%' : '0%'],
    ['', '', '', '', ''],
    ['', '', data.net_profit >= 0 ? 'NET PROFIT' : 'NET LOSS', Math.abs(data.net_profit).toFixed(2), data.total_revenue > 0 ? ((Math.abs(data.net_profit) / data.total_revenue) * 100).toFixed(1) + '%' : '0%'],
  ];
  const csv = rows.map(r => r.map(v => v.includes(',') || v.includes('"') ? `"${v}"` : v).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  a.download = `profit-loss-${fromDate}-to-${toDate}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
};

const ProfitLoss = () => {
  const toast = useToast();
  const [data, setData] = useState<PLData | null>(null);
  const [loading, setLoading] = useState(false);
  const [fromDate, setFromDate] = useState(localToday());
  const [toDate, setToDate] = useState(localToday());

  const fetchPL = async () => {
    if (!fromDate || !toDate) { toast.error('Select date range'); return; }
    if (fromDate > toDate) { toast.error('From date must be before to date'); return; }
    setLoading(true);
    try {
      const res = await api.get('/accounting/reports/profit-loss', { params: { from_date: fromDate, to_date: toDate } });
      setData(res.data);
      if (res.data.revenue.length === 0 && res.data.expenses.length === 0) toast.info('No data for selected period');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to load profit & loss');
      setData(null);
    } finally { setLoading(false); }
  };

  const handlePrint = () => {
    if (!data) return;
    let content = buildTable(
      ['Account Code', 'Account Name', 'Amount'],
      data.revenue.map(r => [r.account_code, r.account_name, fmt(r.amount)]),
      { alignRight: [2], summaryRow: ['', 'Total Revenue', fmt(data.total_revenue)], caption: 'REVENUE' }
    );
    content += buildTable(
      ['Account Code', 'Account Name', 'Amount'],
      data.expenses.map(e => [e.account_code, e.account_name, fmt(e.amount)]),
      { alignRight: [2], summaryRow: ['', 'Total Expenses', fmt(data.total_expenses)], caption: 'EXPENSES' }
    );
    content += `<div style="margin-top:20px;padding:14px 16px;border-top:3px solid #111;background:${data.net_profit >= 0 ? '#ecfdf5' : '#fef2f2'};border-radius:8px;display:flex;justify-content:space-between;align-items:center">
      <span style="font-size:16px;font-weight:800;color:${data.net_profit >= 0 ? '#065f46' : '#991b1b'}">${data.net_profit >= 0 ? 'NET PROFIT' : 'NET LOSS'}</span>
      <span style="font-size:18px;font-weight:800;color:${data.net_profit >= 0 ? '#059669' : '#dc2626'}">${fmt(Math.abs(data.net_profit))}</span>
    </div>`;
    printReport({ title: 'Profit & Loss Statement', dateRange: `${fromDate} to ${toDate}`, content });
  };

  const margin = data && data.total_revenue > 0 ? (data.net_profit / data.total_revenue) * 100 : 0;
  const expenseRatio = data && data.total_revenue > 0 ? (data.total_expenses / data.total_revenue) * 100 : 0;

  return (
    <div className="p-4 sm:p-6 space-y-4">

      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
        <div className="px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
              <BarChart3 size={20} className="text-emerald-700" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-gray-900">Profit & Loss Statement</h1>
              <p className="text-xs sm:text-sm text-gray-500">Income statement for the selected period</p>
            </div>
          </div>
          {data && (
            <div className="flex gap-2">
              <button onClick={handlePrint}
                className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition font-medium">
                <Printer size={14} /> Print
              </button>
              <button onClick={() => exportToCSV(data, fromDate, toDate)}
                className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition font-medium">
                <Download size={14} /> Export CSV
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 sm:px-5 py-3.5">
        <div className="flex flex-wrap items-center gap-3">
          <DateRangeFilter standalone={false} dateFrom={fromDate} dateTo={toDate} onFromChange={setFromDate} onToChange={setToDate} onApply={fetchPL} applyLabel={loading ? 'Loading...' : 'Generate'} />
          <button onClick={() => { setFromDate(localToday()); setToDate(localToday()); setData(null); }}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition">
            <RefreshCw size={13} /> Reset
          </button>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
        </div>
      )}

      {/* Empty State */}
      {!loading && !data && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm text-center py-16">
          <BarChart3 size={48} className="mx-auto mb-3 text-gray-200" />
          <p className="text-gray-500 font-semibold">No data to display</p>
          <p className="text-sm text-gray-400 mt-1">Select a date range and click Generate</p>
        </div>
      )}

      {/* Report */}
      {!loading && data && (
        <>
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white rounded-xl border border-emerald-100 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                  <DollarSign size={16} className="text-emerald-600" />
                </div>
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Revenue</span>
              </div>
              <p className="text-2xl font-bold text-emerald-700 font-mono">{fmtShort(data.total_revenue)}</p>
              <p className="text-xs text-gray-400 mt-0.5">{fmt(data.total_revenue)}</p>
            </div>

            <div className="bg-white rounded-xl border border-rose-100 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-rose-100 rounded-lg flex items-center justify-center">
                  <TrendingDown size={16} className="text-rose-500" />
                </div>
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Expenses</span>
              </div>
              <p className="text-2xl font-bold text-rose-600 font-mono">{fmtShort(data.total_expenses)}</p>
              <p className="text-xs text-gray-400 mt-0.5">{fmt(data.total_expenses)}</p>
            </div>

            <div className={`bg-white rounded-xl border shadow-sm p-4 ${data.net_profit >= 0 ? 'border-green-100' : 'border-red-100'}`}>
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${data.net_profit >= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
                  {data.net_profit >= 0
                    ? <TrendingUp size={16} className="text-green-600" />
                    : <TrendingDown size={16} className="text-red-500" />}
                </div>
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  Net {data.net_profit >= 0 ? 'Profit' : 'Loss'}
                </span>
              </div>
              <p className={`text-2xl font-bold font-mono ${data.net_profit >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                {fmtShort(Math.abs(data.net_profit))}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">{fmt(Math.abs(data.net_profit))}</p>
            </div>

            <div className="bg-white rounded-xl border border-emerald-100 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                  <Percent size={16} className="text-emerald-600" />
                </div>
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Margin</span>
              </div>
              <p className={`text-2xl font-bold font-mono ${margin >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                {margin.toFixed(1)}%
              </p>
              <p className="text-xs text-gray-400 mt-0.5">Expense ratio: {expenseRatio.toFixed(1)}%</p>
            </div>
          </div>

          {/* Revenue Table */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-3 flex items-center justify-between">
              <h2 className="text-white font-bold text-sm uppercase tracking-widest flex items-center gap-2">
                <TrendingUp size={16} /> Revenue
              </h2>
              <span className="text-emerald-100 text-sm font-mono font-semibold">{fmt(data.total_revenue)}</span>
            </div>
            {data.revenue.length === 0 ? (
              <div className="py-8 text-center text-gray-400 text-sm italic">No revenue accounts for this period</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100 text-xs uppercase tracking-wider text-gray-400">
                      <th className="text-left px-5 py-2.5 font-semibold">Account</th>
                      <th className="text-right px-5 py-2.5 font-semibold w-36">Amount (Rs)</th>
                      <th className="text-right px-5 py-2.5 font-semibold w-24">% of Rev</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.revenue.map((item, i) => {
                      const pct = data.total_revenue > 0 ? (item.amount / data.total_revenue) * 100 : 0;
                      return (
                        <tr key={item.account_code} className={`border-b border-gray-50 hover:bg-emerald-50/30 transition ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                          <td className="px-5 py-3">
                            <span className="font-medium text-gray-900">{item.account_name}</span>
                            <span className="text-xs text-gray-400 ml-2 font-mono">{item.account_code}</span>
                          </td>
                          <td className="px-5 py-3 text-right font-semibold text-gray-800 font-mono">{fmt(item.amount)}</td>
                          <td className="px-5 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden hidden sm:block">
                                <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${Math.min(pct, 100)}%` }} />
                              </div>
                              <span className="text-xs font-semibold text-emerald-600 w-12 text-right">{pct.toFixed(1)}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-emerald-600 text-white">
                      <td className="px-5 py-3 font-bold text-sm">Total Revenue</td>
                      <td className="px-5 py-3 text-right font-bold font-mono text-base">{fmt(data.total_revenue)}</td>
                      <td className="px-5 py-3 text-right font-bold text-sm">100%</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* Expenses Table */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-rose-500 to-red-600 px-5 py-3 flex items-center justify-between">
              <h2 className="text-white font-bold text-sm uppercase tracking-widest flex items-center gap-2">
                <TrendingDown size={16} /> Expenses
              </h2>
              <span className="text-rose-100 text-sm font-mono font-semibold">{fmt(data.total_expenses)}</span>
            </div>
            {data.expenses.length === 0 ? (
              <div className="py-8 text-center text-gray-400 text-sm italic">No expense accounts for this period</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100 text-xs uppercase tracking-wider text-gray-400">
                      <th className="text-left px-5 py-2.5 font-semibold">Account</th>
                      <th className="text-right px-5 py-2.5 font-semibold w-36">Amount (Rs)</th>
                      <th className="text-right px-5 py-2.5 font-semibold w-24">% of Rev</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.expenses.map((item, i) => {
                      const pct = data.total_revenue > 0 ? (item.amount / data.total_revenue) * 100 : 0;
                      return (
                        <tr key={item.account_code} className={`border-b border-gray-50 hover:bg-rose-50/30 transition ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                          <td className="px-5 py-3">
                            <span className="font-medium text-gray-900">{item.account_name}</span>
                            <span className="text-xs text-gray-400 ml-2 font-mono">{item.account_code}</span>
                          </td>
                          <td className="px-5 py-3 text-right font-semibold text-gray-800 font-mono">{fmt(item.amount)}</td>
                          <td className="px-5 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden hidden sm:block">
                                <div className="h-full bg-rose-400 rounded-full" style={{ width: `${Math.min(pct, 100)}%` }} />
                              </div>
                              <span className="text-xs font-semibold text-rose-500 w-12 text-right">{pct.toFixed(1)}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-rose-500 text-white">
                      <td className="px-5 py-3 font-bold text-sm">Total Expenses</td>
                      <td className="px-5 py-3 text-right font-bold font-mono text-base">{fmt(data.total_expenses)}</td>
                      <td className="px-5 py-3 text-right font-bold text-sm">{expenseRatio.toFixed(1)}%</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* Net Profit/Loss Bar */}
          <div className={`rounded-xl px-6 py-5 flex items-center justify-between shadow-lg ${data.net_profit >= 0 ? 'bg-gradient-to-r from-green-600 to-emerald-600' : 'bg-gradient-to-r from-red-600 to-rose-600'} text-white`}>
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${data.net_profit >= 0 ? 'bg-white/20' : 'bg-white/20'}`}>
                {data.net_profit >= 0
                  ? <TrendingUp size={24} className="text-white" />
                  : <TrendingDown size={24} className="text-white" />}
              </div>
              <div>
                <p className="text-xs text-white/70 uppercase tracking-widest font-semibold">
                  {data.net_profit >= 0 ? 'Net Profit' : 'Net Loss'}
                </p>
                <p className="text-sm text-white/80 mt-0.5">
                  Margin: <span className="font-bold text-white">{margin.toFixed(1)}%</span>
                  <span className="mx-2 opacity-40">|</span>
                  Period: {fromDate} → {toDate}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-3xl font-black font-mono tracking-tight">{fmt(Math.abs(data.net_profit))}</p>
              <p className="text-xs text-white/60 mt-0.5">Revenue − Expenses</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const ProfitLossWithGate = () => <ReportPasswordGate><ProfitLoss /></ReportPasswordGate>;
export default ProfitLossWithGate;
