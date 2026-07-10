import { useState } from 'react';
import { Scale, Calendar, Download, RefreshCw, Printer, CheckCircle2, AlertTriangle } from 'lucide-react';
import api from '../../utils/api';
import { useToast } from '../../components/Toast';
import { printReport, buildTable } from '../../utils/reportPrinter';
import { localToday } from '../../utils/dateUtils';
import ReportPasswordGate from '../../components/ReportPasswordGate';

interface TrialBalanceRow {
  account_code: string;
  account_name: string;
  account_type: string;
  debit: number;
  credit: number;
}

const fmt = (n: number) => new Intl.NumberFormat('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

const typeColor: Record<string, string> = {
  asset:     'bg-emerald-100 text-emerald-700',
  liability: 'bg-red-100 text-red-700',
  equity:    'bg-gray-100 text-gray-600',
  revenue:   'bg-emerald-100 text-emerald-700',
  expense:   'bg-gray-100 text-gray-600',
};

const TrialBalance = () => {
  const toast = useToast();
  const [data, setData] = useState<TrialBalanceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [asOfDate, setAsOfDate] = useState(localToday);

  const fetchTrialBalance = async () => {
    if (!asOfDate) { toast.error('Select an as-of date'); return; }
    setLoading(true);
    setHasLoaded(true);
    try {
      const res = await api.get('/accounting/reports/trial-balance', { params: { as_of_date: asOfDate } });
      setData(res.data.trial_balance || []);
      if ((res.data.trial_balance || []).length === 0) toast.info('No data found for selected date');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to load trial balance');
      setData([]);
    } finally { setLoading(false); }
  };

  const totals = data.reduce((acc, row) => ({
    debit: acc.debit + Number(row.debit),
    credit: acc.credit + Number(row.credit),
  }), { debit: 0, credit: 0 });

  const isBalanced = data.length > 0 && Math.abs(totals.debit - totals.credit) < 0.01;
  const diff = Math.abs(totals.debit - totals.credit);

  const handlePrint = () => {
    if (!data.length) return;
    const rows = data.map(r => [r.account_code, r.account_name, r.debit > 0 ? fmt(r.debit) : '—', r.credit > 0 ? fmt(r.credit) : '—']);
    const content = buildTable(['Code', 'Account Name', 'Debit', 'Credit'], rows, {
      alignRight: [2, 3],
      summaryRow: ['', 'TOTAL', fmt(totals.debit), fmt(totals.credit)],
    });
    printReport({ title: 'Trial Balance', subtitle: isBalanced ? 'Balanced ✓' : 'OUT OF BALANCE ⚠', dateRange: `As of ${asOfDate}`, content });
  };

  const exportCSV = () => {
    const header = 'Code,Account Name,Type,Debit,Credit';
    const rows = data.map(r => [r.account_code, `"${r.account_name}"`, r.account_type, r.debit || '', r.credit || ''].join(','));
    rows.push(`,,TOTAL,${totals.debit.toFixed(2)},${totals.credit.toFixed(2)}`);
    const csv = [header, ...rows].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `trial-balance-${asOfDate}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  // Group by type for summary
  const typeTotals = data.reduce((acc, row) => {
    const t = row.account_type || 'other';
    if (!acc[t]) acc[t] = { debit: 0, credit: 0 };
    acc[t].debit += Number(row.debit);
    acc[t].credit += Number(row.credit);
    return acc;
  }, {} as Record<string, { debit: number; credit: number }>);

  return (
    <div className="p-4 sm:p-6 space-y-4">

      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-emerald-500 to-emerald-400" />
        <div className="px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
              <Scale size={20} className="text-emerald-700" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-gray-900">Trial Balance</h1>
              <p className="text-xs sm:text-sm text-gray-500">Verify debits and credits as of a date</p>
            </div>
          </div>
          {data.length > 0 && (
            <div className="flex gap-2">
              <button onClick={handlePrint}
                className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition font-medium">
                <Printer size={14} /> Print
              </button>
              <button onClick={exportCSV}
                className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition font-medium">
                <Download size={14} /> Export CSV
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 sm:px-5 py-3.5">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">As of Date</label>
            <input type="date" value={asOfDate} onChange={e => setAsOfDate(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
          </div>
          <button onClick={fetchTrialBalance} disabled={loading}
            className="flex items-center gap-1.5 px-5 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 transition disabled:opacity-60 shadow-sm">
            <Calendar size={14} /> {loading ? 'Loading...' : 'Generate'}
          </button>
          <button onClick={() => { setAsOfDate(localToday()); setData([]); setHasLoaded(false); }}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition">
            <RefreshCw size={13} /> Reset
          </button>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm flex items-center justify-center py-14">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
        </div>
      )}

      {/* Empty */}
      {!loading && !hasLoaded && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm text-center py-14">
          <Scale size={44} className="mx-auto mb-3 text-gray-200" />
          <p className="text-gray-500 font-semibold">Select a date and click Generate</p>
        </div>
      )}

      {!loading && hasLoaded && data.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm text-center py-14">
          <Scale size={44} className="mx-auto mb-3 text-gray-200" />
          <p className="text-gray-500 font-semibold">No data found for {asOfDate}</p>
        </div>
      )}

      {!loading && data.length > 0 && (
        <>
          {/* Balance Status */}
          <div className={`flex flex-wrap items-center gap-4 px-5 py-3.5 rounded-xl border-2 ${isBalanced ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
            <div className="flex items-center gap-2">
              {isBalanced
                ? <CheckCircle2 size={20} className="text-emerald-600 shrink-0" />
                : <AlertTriangle size={20} className="text-red-600 shrink-0" />}
              <span className={`font-bold text-sm ${isBalanced ? 'text-emerald-800' : 'text-red-800'}`}>
                {isBalanced ? 'Trial Balance is Balanced' : `Out of Balance — Difference: ${fmt(diff)}`}
              </span>
            </div>
            <div className="flex items-center gap-4 ml-auto text-sm">
              <span className="text-gray-500">Total Dr: <strong className="text-gray-800 font-mono">{fmt(totals.debit)}</strong></span>
              <span className="text-gray-500">Total Cr: <strong className="text-gray-800 font-mono">{fmt(totals.credit)}</strong></span>
              <span className="text-gray-400 text-xs">{data.length} accounts</span>
            </div>
          </div>

          {/* Type Summary Chips */}
          <div className="flex flex-wrap gap-2">
            {Object.entries(typeTotals).map(([type, t]) => (
              <div key={type} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold ${typeColor[type] || 'bg-gray-100 text-gray-600'}`}>
                <span className="capitalize">{type}</span>
                <span className="opacity-60">|</span>
                <span className="font-mono">{fmt(t.debit || t.credit)}</span>
              </div>
            ))}
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[500px]">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-xs uppercase tracking-wider text-gray-400">
                    <th className="text-left px-4 py-3 font-semibold whitespace-nowrap">Code</th>
                    <th className="text-left px-4 py-3 font-semibold">Account Name</th>
                    <th className="text-center px-3 py-3 font-semibold whitespace-nowrap">Type</th>
                    <th className="text-right px-4 py-3 font-semibold whitespace-nowrap text-emerald-600">Debit</th>
                    <th className="text-right px-4 py-3 font-semibold whitespace-nowrap text-gray-500">Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((row, i) => (
                    <tr key={row.account_code} className={`border-b border-gray-50 hover:bg-gray-50/60 transition ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/20'}`}>
                      <td className="px-4 py-2.5 font-mono text-xs text-gray-400">{row.account_code}</td>
                      <td className="px-4 py-2.5 text-gray-800 font-medium">{row.account_name}</td>
                      <td className="px-3 py-2.5 text-center">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${typeColor[row.account_type] || 'bg-gray-100 text-gray-500'}`}>
                          {row.account_type?.slice(0, 3)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono font-semibold text-emerald-700">
                        {row.debit > 0 ? fmt(row.debit) : <span className="text-gray-200">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono font-semibold text-gray-600">
                        {row.credit > 0 ? fmt(row.credit) : <span className="text-gray-200">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className={`${isBalanced ? 'bg-emerald-600' : 'bg-red-600'} text-white`}>
                    <td colSpan={3} className="px-4 py-3 font-bold text-sm uppercase tracking-wide">Total</td>
                    <td className="px-4 py-3 text-right font-bold font-mono text-base">{fmt(totals.debit)}</td>
                    <td className="px-4 py-3 text-right font-bold font-mono text-base">{fmt(totals.credit)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const TrialBalanceWithGate = () => <ReportPasswordGate><TrialBalance /></ReportPasswordGate>;
export default TrialBalanceWithGate;
