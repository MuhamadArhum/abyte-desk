import { useState, useEffect } from 'react';
import { useSettings } from '../../context/SettingsContext';
import { BarChart3, Package, DollarSign, AlertTriangle, XCircle, TrendingUp, Tag, Clock } from 'lucide-react';
import DateRangeFilter from '../../components/DateRangeFilter';
import api from '../../utils/api';
import { localToday } from '../../utils/dateUtils';
import ReportPasswordGate from '../../components/ReportPasswordGate';

interface TopProduct {
  product_id: number;
  product_name: string;
  category_name: string | null;
  units_sold: number;
  revenue: number;
}

interface CategoryData {
  category_id: number;
  category_name: string;
  product_count: number;
  total_stock: number;
  stock_value: number;
}

interface SlowMover {
  product_id: number;
  product_name: string;
  category_name: string | null;
  current_stock: number;
  last_sale_date: string | null;
  days_since_last_sale: number | null;
  value_at_risk: number;
}

const InventoryReports = () => {
  const { currencySymbol: currency } = useSettings();
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState(localToday());
  const [dateTo, setDateTo] = useState(localToday());
  const [summary, setSummary] = useState({
    total_products: 0, total_stock_value: 0, total_units: 0, low_stock_count: 0, out_of_stock_count: 0
  });
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [categories, setCategories] = useState<CategoryData[]>([]);
  const [slowMovers, setSlowMovers] = useState<SlowMover[]>([]);

  const fetchAll = async (from = dateFrom, to = dateTo) => {
    setLoading(true);
    try {
      const [summaryRes, topRes, catRes, slowRes] = await Promise.all([
        api.get('/inventory-reports/summary'),
        api.get('/inventory-reports/top-products', { params: { limit: 10, date_from: from, date_to: to } }),
        api.get('/inventory-reports/category-breakdown'),
        api.get('/inventory-reports/slow-movers?days=30'),
      ]);
      setSummary(summaryRes.data);
      setTopProducts(topRes.data.data || []);
      setCategories(catRes.data.data || []);
      setSlowMovers(slowRes.data.data || []);
    } catch (error) {
      console.error('Failed to fetch reports', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  const maxUnitsSold = topProducts.length > 0 ? topProducts[0].units_sold : 1;

  return (
    <div className="p-4 sm:p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-xl font-semibold tracking-tight text-gray-900 flex items-center gap-3">
          <BarChart3 className="text-emerald-600" size={20} />
          Inventory Reports
        </h1>
        <p className="text-gray-500 mt-1">Stock analytics and performance insights</p>
      </div>

      <DateRangeFilter dateFrom={dateFrom} dateTo={dateTo} onFromChange={setDateFrom} onToChange={setDateTo} onApply={() => fetchAll()} />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-50 rounded-xl"><Package size={24} className="text-emerald-600" /></div>
            <div>
              <p className="text-2xl font-bold text-gray-800">{summary.total_products}</p>
              <p className="text-sm text-gray-500">Total Products</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-50 rounded-xl"><DollarSign size={24} className="text-emerald-600" /></div>
            <div>
              <p className="text-2xl font-bold text-emerald-600">{currency}{Number(summary.total_stock_value).toLocaleString()}</p>
              <p className="text-sm text-gray-500">Stock Value</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-yellow-50 rounded-xl"><AlertTriangle size={24} className="text-yellow-600" /></div>
            <div>
              <p className="text-2xl font-bold text-yellow-600">{summary.low_stock_count}</p>
              <p className="text-sm text-gray-500">Low Stock</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-red-50 rounded-xl"><XCircle size={24} className="text-red-600" /></div>
            <div>
              <p className="text-2xl font-bold text-red-600">{summary.out_of_stock_count}</p>
              <p className="text-sm text-gray-500">Out of Stock</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Top Selling Products */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-5 border-b border-gray-100 flex items-center gap-2">
            <TrendingUp size={20} className="text-emerald-600" />
            <h2 className="font-semibold text-gray-800">Top Selling Products</h2>
          </div>
          {topProducts.length === 0 ? (
            <div className="p-8 text-center text-gray-400">No sales data available</div>
          ) : (
            <div className="p-4 space-y-3">
              {topProducts.map((p, idx) => (
                <div key={p.product_id} className="flex items-center gap-3">
                  <span className="w-6 text-center font-bold text-gray-400 text-sm">#{idx + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-gray-800 text-sm truncate">{p.product_name}</span>
                      <span className="text-sm text-gray-500 ml-2 shrink-0">{Number(p.units_sold)} sold</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div
                        className="bg-emerald-500 h-2 rounded-full transition-all"
                        style={{ width: `${(Number(p.units_sold) / maxUnitsSold) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Category Breakdown */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-5 border-b border-gray-100 flex items-center gap-2">
            <Tag size={20} className="text-emerald-600" />
            <h2 className="font-semibold text-gray-800">Category Breakdown</h2>
          </div>
          {categories.length === 0 ? (
            <div className="p-8 text-center text-gray-400">No categories found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="p-3 text-left">Category</th>
                    <th className="p-3 text-right">Products</th>
                    <th className="p-3 text-right">Stock</th>
                    <th className="p-3 text-right">Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {categories.map((c) => (
                    <tr key={c.category_id} className="hover:bg-gray-50">
                      <td className="p-3 font-medium text-gray-800">{c.category_name}</td>
                      <td className="p-3 text-right text-gray-600">{Number(c.product_count)}</td>
                      <td className="p-3 text-right text-gray-600">{Number(c.total_stock)}</td>
                      <td className="p-3 text-right font-medium text-gray-800">{currency}{Number(c.stock_value).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Slow Movers */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex items-center gap-2">
          <Clock size={20} className="text-orange-600" />
          <h2 className="font-semibold text-gray-800">Slow Moving Products</h2>
          <span className="text-sm text-gray-400 ml-1">(not sold in 30+ days)</span>
        </div>
        {slowMovers.length === 0 ? (
          <div className="p-8 text-center text-gray-400">All products are selling well</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 font-medium">
                <tr>
                  <th className="p-4 text-left">Product</th>
                  <th className="p-4 text-left">Category</th>
                  <th className="p-4 text-right">Current Stock</th>
                  <th className="p-4 text-right">Days Since Sale</th>
                  <th className="p-4 text-right">Value at Risk</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {slowMovers.map((p) => (
                  <tr key={p.product_id} className="hover:bg-gray-50">
                    <td className="p-4 font-medium text-gray-800">{p.product_name}</td>
                    <td className="p-4 text-gray-500">{p.category_name || 'Uncategorized'}</td>
                    <td className="p-4 text-right text-gray-600">{Number(p.current_stock)}</td>
                    <td className="p-4 text-right">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        p.days_since_last_sale === null ? 'bg-red-100 text-red-700' :
                        Number(p.days_since_last_sale) > 90 ? 'bg-red-100 text-red-700' :
                        Number(p.days_since_last_sale) > 60 ? 'bg-orange-100 text-orange-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {p.days_since_last_sale === null ? 'Never sold' : `${p.days_since_last_sale} days`}
                      </span>
                    </td>
                    <td className="p-4 text-right font-medium text-red-600">{currency}{Number(p.value_at_risk).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

const InventoryReportsWithGate = () => <ReportPasswordGate><InventoryReports /></ReportPasswordGate>;
export default InventoryReportsWithGate;
