import { useState, useEffect, useCallback } from 'react';
import { ClipboardList } from 'lucide-react';
import api from '../../utils/api';
import { localToday, localMonthStart } from '../../utils/dateUtils';
import { useToast } from '../../components/Toast';
import DateRangeFilter from '../../components/DateRangeFilter';

interface Section { section_id: number; section_name: string; }

const IssuanceReports = () => {
  const [summary, setSummary]   = useState<any>(null);
  const [topIssued, setTopIssued] = useState<any[]>([]);
  const [loading, setLoading]   = useState(false);
  const [dateFrom, setDateFrom] = useState(localToday());
  const [dateTo, setDateTo]     = useState(localToday());
  const [sections, setSections] = useState<Section[]>([]);
  const [sectionFilter, setSectionFilter] = useState('');
  const { error } = useToast();

  useEffect(() => {
    api.get('/sections').then(r => setSections(r.data.data || []));
  }, []);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/inventory-reports/issuance-summary', {
        params: { from_date: dateFrom, to_date: dateTo, section_id: sectionFilter || undefined }
      });
      setSummary(res.data.summary);
      setTopIssued(res.data.top_issued_products || []);
    } catch { error('Failed to load report'); }
    finally { setLoading(false); }
  }, [dateFrom, dateTo, sectionFilter]);

  const fmt = (n: any) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtQty = (n: any) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 });

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
          <ClipboardList size={20} className="text-emerald-600" /> Stock Issuance Reports
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Summary of stock issues, returns, and raw sales</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-5">
        <div className="flex flex-wrap gap-4 items-end">
          <DateRangeFilter dateFrom={dateFrom} dateTo={dateTo} onFromChange={setDateFrom} onToChange={setDateTo} onApply={fetchReport} />
          <select value={sectionFilter} onChange={e => setSectionFilter(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none">
            <option value="">All Sections</option>
            {sections.map(s => <option key={s.section_id} value={s.section_id}>{s.section_name}</option>)}
          </select>
          <button onClick={fetchReport}
            className="px-5 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700">
            Run Report
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" /></div>
      ) : summary ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white border border-gray-100 shadow-sm rounded-xl p-5">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Stock Issues</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{summary.issues.count}</p>
              <p className="text-sm text-emerald-600 font-medium mt-1">Cost: {fmt(summary.issues.amount)}</p>
            </div>
            <div className="bg-white border border-gray-100 shadow-sm rounded-xl p-5">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Stock Returns</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{summary.returns.count}</p>
              <p className="text-sm text-blue-600 font-medium mt-1">Return transactions</p>
            </div>
            <div className="bg-white border border-gray-100 shadow-sm rounded-xl p-5">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Raw Sales</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{summary.raw_sales.count}</p>
              <p className="text-sm text-orange-600 font-medium mt-1">Revenue: {fmt(summary.raw_sales.amount)}</p>
            </div>
          </div>

          {/* Top Issued Products */}
          {topIssued.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b">
                <h2 className="font-semibold text-gray-800">Top Issued Products (by Quantity)</h2>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Qty Issued</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {topIssued.map((row, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 text-gray-400">{i + 1}</td>
                      <td className="px-4 py-2.5 font-medium text-gray-900">{row.product_name}</td>
                      <td className="px-4 py-2.5 text-right font-medium">{fmtQty(row.total_qty)}</td>
                      <td className="px-4 py-2.5 text-right text-emerald-700 font-medium">{fmt(row.total_cost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-10 text-center text-gray-400">
          Select filters and click Run Report to view issuance summary
        </div>
      )}
    </div>
  );
};

export default IssuanceReports;
