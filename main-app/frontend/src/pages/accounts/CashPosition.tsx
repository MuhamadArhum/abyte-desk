import { useState, useEffect } from 'react';
import { Banknote, RefreshCw, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import api from '../../utils/api';
import { useToast } from '../../components/Toast';

const fmt = (n: number) =>
  Math.abs(n).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const TYPE_LABEL: Record<string, string> = {
  asset:     'Asset',
  liability: 'Liability',
  equity:    'Equity',
  revenue:   'Revenue',
  expense:   'Expense',
};

const TYPE_COLOR: Record<string, string> = {
  asset:     'bg-emerald-50 border-emerald-200 text-emerald-700',
  liability: 'bg-gray-50 border-gray-200 text-gray-600',
  equity:    'bg-gray-50 border-gray-200 text-gray-600',
  revenue:   'bg-emerald-50 border-emerald-200 text-emerald-700',
  expense:   'bg-red-50 border-red-200 text-red-700',
};

const TYPE_ROW: Record<string, string> = {
  asset:     'hover:bg-emerald-50/40',
  liability: 'hover:bg-gray-50/40',
  equity:    'hover:bg-gray-50/40',
  revenue:   'hover:bg-emerald-50/40',
  expense:   'hover:bg-red-50/40',
};

interface AccountRow {
  account_id: number;
  account_code: string;
  account_name: string;
  account_type: string;
  group_name: string;
  dr_balance: number;
  cr_balance: number;
}

interface Totals {
  dr: number;
  cr: number;
  net: number;
}

const CashPosition = () => {
  const toast = useToast();
  const [data, setData] = useState<AccountRow[]>([]);
  const [totals, setTotals] = useState<Totals>({ dr: 0, cr: 0, net: 0 });
  const [loading, setLoading] = useState(false);
  const [lastFetched, setLastFetched] = useState<string>('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/accounting/cash-position');
      setData(res.data.data || []);
      setTotals(res.data.totals || { dr: 0, cr: 0, net: 0 });
      setLastFetched(new Date().toLocaleTimeString('en-PK'));
    } catch {
      toast.error('Failed to load cash position');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // Group by account_type
  const grouped: Record<string, AccountRow[]> = {};
  for (const row of data) {
    if (!grouped[row.account_type]) grouped[row.account_type] = [];
    grouped[row.account_type].push(row);
  }
  const typeOrder = ['asset', 'liability', 'equity', 'revenue', 'expense'];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
            <Banknote size={20} className="text-emerald-700" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Cash Position</h1>
            <p className="text-sm text-gray-500">
              Restaurant ke tamam Level-4 accounts ka Dr/Cr balance
              {lastFetched && <span className="ml-2 text-xs text-gray-400">— Updated: {lastFetched}</span>}
            </p>
          </div>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-emerald-200 shadow-sm px-5 py-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Total Debit (Dr)</p>
          <p className="text-2xl font-bold text-emerald-700">{fmt(totals.dr)}</p>
          <p className="text-xs text-gray-400 mt-1">Assets + Expenses (Jama)</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Total Credit (Cr)</p>
          <p className="text-2xl font-bold text-gray-600">{fmt(totals.cr)}</p>
          <p className="text-xs text-gray-400 mt-1">Liabilities + Equity + Revenue (Nafi)</p>
        </div>
        <div className={`rounded-xl border shadow-sm px-5 py-4 ${
          totals.net > 0 ? 'bg-emerald-50 border-emerald-300' :
          totals.net < 0 ? 'bg-red-50 border-red-300' :
          'bg-gray-50 border-gray-200'
        }`}>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Net Cash Position</p>
          <div className="flex items-center gap-2">
            {totals.net > 0
              ? <TrendingUp size={20} className="text-emerald-600" />
              : totals.net < 0
              ? <TrendingDown size={20} className="text-red-600" />
              : <Minus size={20} className="text-gray-400" />}
            <p className={`text-2xl font-bold ${
              totals.net > 0 ? 'text-emerald-700' :
              totals.net < 0 ? 'text-red-600' :
              'text-gray-600'
            }`}>
              {fmt(totals.net)}
            </p>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {totals.net > 0 ? 'Dr Balance — Restaurant ka net faida' :
             totals.net < 0 ? 'Cr Balance — Liabilities zyada hain' :
             'Balanced'}
          </p>
        </div>
      </div>

      {/* Accounts Table grouped by type */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin h-8 w-8 rounded-full border-2 border-emerald-600 border-t-transparent" />
        </div>
      ) : data.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm text-center py-16 text-gray-400">
          <Banknote size={48} className="mx-auto mb-3 opacity-20" />
          <p>Koi Level-4 account nahi mila</p>
        </div>
      ) : (
        <div className="space-y-5">
          {typeOrder.map(type => {
            const rows = grouped[type];
            if (!rows || rows.length === 0) return null;
            const typeDr = rows.reduce((s, r) => s + r.dr_balance, 0);
            const typeCr = rows.reduce((s, r) => s + r.cr_balance, 0);
            return (
              <div key={type} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                {/* Type header */}
                <div className={`flex items-center justify-between px-5 py-3 border-b ${TYPE_COLOR[type]} border-opacity-60`}>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${TYPE_COLOR[type]}`}>
                      {TYPE_LABEL[type] || type}
                    </span>
                    <span className="text-sm text-gray-600 font-medium">
                      {rows.length} account{rows.length > 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="flex items-center gap-6 text-sm font-semibold">
                    <span className="text-emerald-700">Dr: {fmt(typeDr)}</span>
                    <span className="text-gray-600">Cr: {fmt(typeCr)}</span>
                  </div>
                </div>

                {/* Accounts rows */}
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wide">
                      <th className="px-5 py-2.5 text-left font-semibold w-32">Code</th>
                      <th className="px-5 py-2.5 text-left font-semibold">Account Name</th>
                      <th className="px-5 py-2.5 text-left font-semibold">Group</th>
                      <th className="px-5 py-2.5 text-right font-semibold w-40 text-emerald-600">Debit (Dr)</th>
                      <th className="px-5 py-2.5 text-right font-semibold w-40 text-gray-600">Credit (Cr)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <tr
                        key={row.account_id}
                        className={`border-b border-gray-50 transition ${TYPE_ROW[type]} ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}
                      >
                        <td className="px-5 py-3 font-mono text-xs text-gray-500">{row.account_code}</td>
                        <td className="px-5 py-3 font-medium text-gray-800">{row.account_name}</td>
                        <td className="px-5 py-3 text-gray-500 text-xs">{row.group_name}</td>
                        <td className="px-5 py-3 text-right">
                          {row.dr_balance > 0 ? (
                            <span className="font-semibold text-emerald-700">{fmt(row.dr_balance)}</span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-right">
                          {row.cr_balance > 0 ? (
                            <span className="font-semibold text-gray-600">{fmt(row.cr_balance)}</span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {/* Type subtotal */}
                    <tr className="bg-gray-100 border-t border-gray-200 font-bold text-sm">
                      <td colSpan={3} className="px-5 py-2.5 text-gray-600 text-right">
                        {TYPE_LABEL[type] || type} Sub-Total
                      </td>
                      <td className="px-5 py-2.5 text-right text-emerald-700">
                        {typeDr > 0 ? fmt(typeDr) : '—'}
                      </td>
                      <td className="px-5 py-2.5 text-right text-gray-600">
                        {typeCr > 0 ? fmt(typeCr) : '—'}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            );
          })}

          {/* Grand Total */}
          <div className="bg-gray-800 rounded-xl px-6 py-4 flex items-center justify-between text-white">
            <span className="font-bold text-base">Grand Total — All Level-4 Accounts</span>
            <div className="flex items-center gap-8">
              <div className="text-center">
                <p className="text-xs text-gray-400 mb-0.5">Total Dr</p>
                <p className="font-bold text-emerald-300 text-lg">{fmt(totals.dr)}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-400 mb-0.5">Total Cr</p>
                <p className="font-bold text-gray-300 text-lg">{fmt(totals.cr)}</p>
              </div>
              <div className="w-px h-10 bg-gray-600" />
              <div className="text-center">
                <p className="text-xs text-gray-400 mb-0.5">Net Position</p>
                <p className={`font-bold text-xl ${totals.net >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {fmt(totals.net)}
                  <span className="text-sm font-normal ml-1">{totals.net >= 0 ? 'Dr' : 'Cr'}</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CashPosition;
