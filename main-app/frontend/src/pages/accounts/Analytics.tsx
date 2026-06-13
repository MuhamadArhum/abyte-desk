import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, DollarSign, FileText, CreditCard, Receipt } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import DateRangeFilter from '../../components/DateRangeFilter';
import api from '../../utils/api';
import { localToday, localMonthStart } from '../../utils/dateUtils';
import ReportPasswordGate from '../../components/ReportPasswordGate';

const fmt = (n: number) => new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

const Analytics = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState(localToday());
  const [dateTo, setDateTo] = useState(localToday());

  useEffect(() => { fetchData(); }, [dateFrom, dateTo]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/accounting/reports/analytics', { params: { from_date: dateFrom, to_date: dateTo } });
      setData(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const summary = data?.summary || { total_revenue: 0, total_expenses: 0, net_profit: 0 };
  const vouchers = data?.vouchers || { cpv_count: 0, cpv_amount: 0, crv_count: 0, crv_amount: 0 };
  const jv = data?.journal_summary || { posted: 0, draft: 0 };
  const trend = (data?.monthly_trend || []).map((r: any) => ({
    ...r,
    month: r.month.slice(0, 7),
  }));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Accounts Analytics</h1>
      </div>

      <DateRangeFilter
        dateFrom={dateFrom}
        dateTo={dateTo}
        onFromChange={setDateFrom}
        onToChange={setDateTo}
        onApply={fetchData}
      />

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600" />
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 bg-emerald-50 rounded-lg"><TrendingUp size={18} className="text-emerald-600" /></div>
                <span className="text-sm text-gray-500">Total Revenue</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{fmt(summary.total_revenue)}</p>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 bg-red-50 rounded-lg"><TrendingDown size={18} className="text-red-500" /></div>
                <span className="text-sm text-gray-500">Total Expenses</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{fmt(summary.total_expenses)}</p>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className={`p-2 rounded-lg ${summary.net_profit >= 0 ? 'bg-blue-50' : 'bg-orange-50'}`}>
                  <DollarSign size={18} className={summary.net_profit >= 0 ? 'text-blue-600' : 'text-orange-500'} />
                </div>
                <span className="text-sm text-gray-500">Net Profit</span>
              </div>
              <p className={`text-2xl font-bold ${summary.net_profit >= 0 ? 'text-blue-700' : 'text-red-600'}`}>
                {summary.net_profit < 0 ? '-' : ''}{fmt(Math.abs(summary.net_profit))}
              </p>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 bg-purple-50 rounded-lg"><FileText size={18} className="text-purple-600" /></div>
                <span className="text-sm text-gray-500">Journal Vouchers</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{jv.posted + jv.draft}</p>
              <p className="text-xs text-gray-400 mt-1">{jv.posted} posted · {jv.draft} draft</p>
            </div>
          </div>

          {/* Monthly Trend Chart */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-sm font-semibold text-gray-800 mb-4">Monthly Revenue vs Expenses</h2>
            {trend.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-gray-400 text-sm">No data for selected period</div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={trend} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} tickFormatter={(v) => fmt(v)} width={90} />
                  <Tooltip
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: 13 }}
                    formatter={(val: any) => fmt(Number(val))}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="revenue" name="Revenue" stroke="#10b981" strokeWidth={2.5} dot={{ r: 4, fill: '#10b981', stroke: '#fff', strokeWidth: 2 }} activeDot={{ r: 6 }} />
                  <Line type="monotone" dataKey="expenses" name="Expenses" stroke="#ef4444" strokeWidth={2.5} dot={{ r: 4, fill: '#ef4444', stroke: '#fff', strokeWidth: 2 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Top Accounts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h2 className="text-sm font-semibold text-gray-800 mb-4">Top Revenue Accounts</h2>
              {(data?.top_revenue || []).length === 0 ? (
                <p className="text-sm text-gray-400 py-4 text-center">No revenue entries for this period</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 text-gray-500 font-medium">Account</th>
                      <th className="text-right py-2 text-gray-500 font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.top_revenue || []).map((a: any) => (
                      <tr key={a.account_id} className="border-b last:border-0">
                        <td className="py-2.5 text-gray-700">{a.account_code} — {a.account_name}</td>
                        <td className="py-2.5 text-right font-medium text-emerald-700">{fmt(a.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h2 className="text-sm font-semibold text-gray-800 mb-4">Top Expense Accounts</h2>
              {(data?.top_expenses || []).length === 0 ? (
                <p className="text-sm text-gray-400 py-4 text-center">No expense entries for this period</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 text-gray-500 font-medium">Account</th>
                      <th className="text-right py-2 text-gray-500 font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.top_expenses || []).map((a: any) => (
                      <tr key={a.account_id} className="border-b last:border-0">
                        <td className="py-2.5 text-gray-700">{a.account_code} — {a.account_name}</td>
                        <td className="py-2.5 text-right font-medium text-red-600">{fmt(a.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Voucher Summary */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
              <div className="p-3 bg-orange-50 rounded-xl"><CreditCard size={22} className="text-orange-500" /></div>
              <div>
                <p className="text-sm text-gray-500">Cash Payment Vouchers (CPV)</p>
                <p className="text-xl font-bold text-gray-900">{fmt(vouchers.cpv_amount)}</p>
                <p className="text-xs text-gray-400">{vouchers.cpv_count} vouchers</p>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
              <div className="p-3 bg-teal-50 rounded-xl"><Receipt size={22} className="text-teal-600" /></div>
              <div>
                <p className="text-sm text-gray-500">Cash Receipt Vouchers (CRV)</p>
                <p className="text-xl font-bold text-gray-900">{fmt(vouchers.crv_amount)}</p>
                <p className="text-xs text-gray-400">{vouchers.crv_count} vouchers</p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const AnalyticsWithGate = () => <ReportPasswordGate><Analytics /></ReportPasswordGate>;
export default AnalyticsWithGate;
