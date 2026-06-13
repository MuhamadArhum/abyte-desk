import { useState, useCallback } from 'react';
import { Search, BookOpen } from 'lucide-react';
import api from '../../utils/api';
import { localToday, localMonthStart } from '../../utils/dateUtils';
import { useToast } from '../../components/Toast';
import DateRangeFilter from '../../components/DateRangeFilter';

interface Product { product_id: number; product_name: string; barcode?: string; }

const ItemsLedger = () => {
  const [productSearch, setProductSearch] = useState('');
  const [productResults, setProductResults] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [dateFrom, setDateFrom] = useState(localToday());
  const [dateTo, setDateTo]     = useState(localToday());
  const [ledger, setLedger]     = useState<any[]>([]);
  const [productInfo, setProductInfo] = useState<any>(null);
  const [loading, setLoading]   = useState(false);
  const { error } = useToast();

  const searchProducts = async (q: string) => {
    setProductSearch(q);
    if (q.length < 2) { setProductResults([]); return; }
    const res = await api.get('/products', { params: { search: q, limit: 10 } });
    setProductResults(res.data.data || []);
  };

  const selectProduct = (p: Product) => {
    setSelectedProduct(p); setProductSearch(p.product_name); setProductResults([]);
  };

  const fetchLedger = useCallback(async () => {
    if (!selectedProduct) return error('Select a product first');
    setLoading(true);
    try {
      const res = await api.get('/inventory-reports/items-ledger', {
        params: { product_id: selectedProduct.product_id, from_date: dateFrom, to_date: dateTo }
      });
      setLedger(res.data.ledger || []);
      setProductInfo(res.data.product);
    } catch { error('Failed to load ledger'); }
    finally { setLoading(false); }
  }, [selectedProduct, dateFrom, dateTo]);

  const fmt = (n: any) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  const fmtAmt = (n: any) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const dirColor = (dir: string) => dir === 'IN' ? 'text-emerald-700 bg-emerald-50' : 'text-rose-700 bg-rose-50';

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
          <BookOpen size={20} className="text-purple-600" /> Items Ledger
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Full transaction history for any product</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-5">
        <div className="flex flex-wrap gap-4 items-end">
          {/* Product search */}
          <div className="flex-1 min-w-[250px] max-w-sm">
            <label className="block text-sm font-medium text-gray-700 mb-1">Product *</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
              <input type="text" value={productSearch} onChange={e => searchProducts(e.target.value)}
                placeholder="Search product..."
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none" />
            </div>
            {productResults.length > 0 && (
              <div className="absolute z-10 w-80 bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
                {productResults.map(p => (
                  <button key={p.product_id} onClick={() => selectProduct(p)}
                    className="w-full text-left px-4 py-2.5 hover:bg-gray-50 text-sm border-b last:border-0">
                    {p.product_name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <DateRangeFilter dateFrom={dateFrom} dateTo={dateTo} onFromChange={setDateFrom} onToChange={setDateTo} onApply={fetchLedger} />
          <button onClick={fetchLedger}
            className="px-5 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700">
            Load Ledger
          </button>
        </div>
      </div>

      {/* Product info bar */}
      {productInfo && (
        <div className="bg-purple-50 border border-purple-100 rounded-lg px-4 py-3 mb-4 flex gap-6 text-sm">
          <span><span className="text-gray-500">Product:</span> <strong>{productInfo.product_name}</strong></span>
          {productInfo.barcode && <span><span className="text-gray-500">Barcode:</span> {productInfo.barcode}</span>}
          <span><span className="text-gray-500">Current Stock:</span> <strong>{fmt(productInfo.stock_quantity)}</strong></span>
        </div>
      )}

      {/* Ledger table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" /></div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ref #</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Party</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Dir</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Qty</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {ledger.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-400">
                  {selectedProduct ? 'No transactions found for selected date range' : 'Select a product to view ledger'}
                </td></tr>
              ) : ledger.map((row, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 text-gray-600">{row.txn_date}</td>
                  <td className="px-4 py-2.5 text-gray-800 font-medium">{row.txn_type}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-blue-700">{row.ref_number}</td>
                  <td className="px-4 py-2.5 text-gray-600">{row.party || '—'}</td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${dirColor(row.direction)}`}>{row.direction}</span>
                  </td>
                  <td className="px-4 py-2.5 text-right">{fmt(row.qty)}</td>
                  <td className="px-4 py-2.5 text-right">{fmtAmt(row.amount)}</td>
                  <td className={`px-4 py-2.5 text-right font-semibold ${Number(row.running_balance) < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                    {fmt(row.running_balance)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default ItemsLedger;
