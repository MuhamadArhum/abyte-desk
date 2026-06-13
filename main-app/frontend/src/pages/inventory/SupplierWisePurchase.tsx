import { useState, useCallback } from 'react';
import { Truck } from 'lucide-react';
import api from '../../utils/api';
import { localToday, localMonthStart } from '../../utils/dateUtils';
import { useToast } from '../../components/Toast';
import DateRangeFilter from '../../components/DateRangeFilter';

const SupplierWisePurchase = () => {
  const [data, setData]       = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState(localToday());
  const [dateTo, setDateTo]     = useState(localToday());
  const { showToast } = useToast();

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/inventory-reports/supplier-wise', {
        params: { from_date: dateFrom, to_date: dateTo }
      });
      setData(res.data.data || []);
    } catch { showToast('error', 'Failed to load report'); }
    finally { setLoading(false); }
  }, [dateFrom, dateTo]);

  const fmt = (n: any) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const grandPurchased = data.reduce((s, r) => s + r.purchased, 0);
  const grandReturned  = data.reduce((s, r) => s + r.returned, 0);
  const grandNet       = data.reduce((s, r) => s + r.net, 0);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
          <Truck size={20} className="text-teal-600" /> Supplier Wise Purchase & Return
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Purchase and return summary by supplier</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-5">
        <div className="flex flex-wrap gap-4 items-end">
          <DateRangeFilter dateFrom={dateFrom} dateTo={dateTo} onFromChange={setDateFrom} onToChange={setDateTo} onApply={fetchReport} />
          <button onClick={fetchReport}
            className="px-5 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700">
            Run Report
          </button>
        </div>
      </div>

      {data.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-5">
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
            <p className="text-xs text-indigo-600 font-medium uppercase tracking-wide">Total Purchased</p>
            <p className="text-2xl font-bold text-indigo-900 mt-1">{fmt(grandPurchased)}</p>
          </div>
          <div className="bg-rose-50 border border-rose-100 rounded-xl p-4">
            <p className="text-xs text-rose-600 font-medium uppercase tracking-wide">Total Returned</p>
            <p className="text-2xl font-bold text-rose-900 mt-1">{fmt(grandReturned)}</p>
          </div>
          <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
            <p className="text-xs text-emerald-600 font-medium uppercase tracking-wide">Net Purchase</p>
            <p className="text-2xl font-bold text-emerald-900 mt-1">{fmt(grandNet)}</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" /></div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Supplier</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Vouchers</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Purchased</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Returned</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Net</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-400">No data. Run report with date range.</td></tr>
              ) : data.map((row, i) => (
                <tr key={row.supplier_id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 text-gray-400">{i + 1}</td>
                  <td className="px-4 py-2.5 font-medium text-gray-900">{row.supplier_name}</td>
                  <td className="px-4 py-2.5 text-right text-gray-600">{row.pv_count}</td>
                  <td className="px-4 py-2.5 text-right font-medium text-indigo-700">{fmt(row.purchased)}</td>
                  <td className="px-4 py-2.5 text-right text-rose-600">{fmt(row.returned)}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-emerald-700">{fmt(row.net)}</td>
                </tr>
              ))}
            </tbody>
            {data.length > 0 && (
              <tfoot>
                <tr className="bg-gray-50 font-semibold border-t-2 border-gray-200">
                  <td colSpan={3} className="px-4 py-3 text-right text-gray-700">Grand Total</td>
                  <td className="px-4 py-3 text-right text-indigo-700">{fmt(grandPurchased)}</td>
                  <td className="px-4 py-3 text-right text-rose-600">{fmt(grandReturned)}</td>
                  <td className="px-4 py-3 text-right text-emerald-700">{fmt(grandNet)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        )}
      </div>
    </div>
  );
};

export default SupplierWisePurchase;
