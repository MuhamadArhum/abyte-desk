import { useState, useEffect } from 'react';
import { Printer } from 'lucide-react';
import DateRangeFilter from '../../components/DateRangeFilter';
import api from '../../utils/api';
import { localToday } from '../../utils/dateUtils';
import ReportPasswordGate from '../../components/ReportPasswordGate';

const fmt = (n: number) => new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

const Reports = () => {
  const [pl, setPl] = useState<any>(null);
  const [bs, setBs] = useState<any>(null);
  const [vouchers, setVouchers] = useState<{ cpv: any; crv: any } | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState(localToday());
  const [dateTo, setDateTo] = useState(localToday());

  useEffect(() => { fetchAll(); }, []);

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

  const handlePrint = () => window.print();

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
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
              <table className="w-full text-sm">
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

            {/* CRV */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b bg-gray-50">
                <h2 className="font-semibold text-gray-800 text-sm">Recent Cash Receipt Vouchers (CRV)</h2>
              </div>
              <table className="w-full text-sm">
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
      )}
    </div>
  );
};

const ReportsWithGate = () => <ReportPasswordGate><Reports /></ReportPasswordGate>;
export default ReportsWithGate;
