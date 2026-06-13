import { useState, useEffect, useCallback } from 'react';
import { PackageSearch } from 'lucide-react';
import api from '../../utils/api';
import { localToday, localMonthStart } from '../../utils/dateUtils';
import { useToast } from '../../components/Toast';
import DateRangeFilter from '../../components/DateRangeFilter';

const ItemWisePurchase = () => {
  const [data, setData]       = useState<any[]>([]);
  const [totals, setTotals]   = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState(localToday());
  const [dateTo, setDateTo]     = useState(localToday());
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [supplierFilter, setSupplierFilter] = useState('');
  const { error } = useToast();

  useEffect(() => {
    api.get('/suppliers', { params: { limit: 200 } }).then(r => setSuppliers(r.data.data || []));
  }, []);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/inventory-reports/item-wise-purchase', {
        params: { from_date: dateFrom, to_date: dateTo, supplier_id: supplierFilter || undefined }
      });
      setData(res.data.data || []);
      setTotals(res.data.totals);
    } catch { error('Failed to load report'); }
    finally { setLoading(false); }
  }, [dateFrom, dateTo, supplierFilter]);

  const fmt  = (n: any) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  const fmtAmt = (n: any) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const typeLabel = (t: string) => {
    if (t === 'raw_material')  return <span className="px-2 py-0.5 text-xs bg-orange-50 text-orange-700 rounded">Raw Material</span>;
    if (t === 'semi_finished') return <span className="px-2 py-0.5 text-xs bg-blue-50 text-blue-700 rounded">Semi-Finished</span>;
    return <span className="px-2 py-0.5 text-xs bg-emerald-50 text-emerald-700 rounded">Finished Good</span>;
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
          <PackageSearch size={20} className="text-indigo-600" /> Item Wise Purchase
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Purchase summary grouped by product</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-5">
        <div className="flex flex-wrap gap-4 items-end">
          <DateRangeFilter dateFrom={dateFrom} dateTo={dateTo} onFromChange={setDateFrom} onToChange={setDateTo} onApply={fetchReport} />
          <select value={supplierFilter} onChange={e => setSupplierFilter(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none">
            <option value="">All Suppliers</option>
            {suppliers.map((s: any) => <option key={s.supplier_id} value={s.supplier_id}>{s.supplier_name}</option>)}
          </select>
          <button onClick={fetchReport}
            className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
            Run Report
          </button>
        </div>
      </div>

      {totals && (
        <div className="grid grid-cols-2 gap-4 mb-5">
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
            <p className="text-xs text-indigo-600 font-medium uppercase tracking-wide">Total Qty Purchased</p>
            <p className="text-2xl font-bold text-indigo-900 mt-1">{fmt(totals.grand_qty)}</p>
          </div>
          <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
            <p className="text-xs text-emerald-600 font-medium uppercase tracking-wide">Total Purchase Amount</p>
            <p className="text-2xl font-bold text-emerald-900 mt-1">{fmtAmt(totals.grand_total)}</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" /></div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Vouchers</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Qty</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Avg Price</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">No data. Run report with date range.</td></tr>
              ) : data.map((row, i) => (
                <tr key={row.product_id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 text-gray-400">{i + 1}</td>
                  <td className="px-4 py-2.5 font-medium text-gray-900">{row.product_name}</td>
                  <td className="px-4 py-2.5">{typeLabel(row.product_type)}</td>
                  <td className="px-4 py-2.5 text-right text-gray-600">{row.voucher_count}</td>
                  <td className="px-4 py-2.5 text-right font-medium">{fmt(row.total_qty)}</td>
                  <td className="px-4 py-2.5 text-right text-gray-600">{fmtAmt(row.avg_unit_price)}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-indigo-700">{fmtAmt(row.total_amount)}</td>
                </tr>
              ))}
            </tbody>
            {data.length > 0 && totals && (
              <tfoot>
                <tr className="bg-gray-50 font-semibold border-t-2 border-gray-200">
                  <td colSpan={4} className="px-4 py-3 text-right text-gray-700">Grand Total</td>
                  <td className="px-4 py-3 text-right">{fmt(totals.grand_qty)}</td>
                  <td></td>
                  <td className="px-4 py-3 text-right text-indigo-700">{fmtAmt(totals.grand_total)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        )}
      </div>
    </div>
  );
};

export default ItemWisePurchase;
