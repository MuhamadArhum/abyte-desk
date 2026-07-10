import { useState } from 'react';
import { FileBarChart, Calendar, Download, RefreshCw, Printer, CheckCircle, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';
import api from '../../utils/api';
import { useToast } from '../../components/Toast';
import { printReport } from '../../utils/reportPrinter';
import { localToday } from '../../utils/dateUtils';
import ReportPasswordGate from '../../components/ReportPasswordGate';

// ── Types ──────────────────────────────────────────────────────────────────

interface BSNode {
  account_id: number;
  account_code: string;
  account_name: string;
  account_type: string;
  parent_account_id: number | null;
  level: number;
  is_system: number;
  balance: number;
  children: BSNode[];
}

interface BSData {
  as_of_date: string;
  assets: BSNode[];
  liabilities: BSNode[];
  equity: BSNode[];
  net_profit: number;
  total_assets: number;
  total_liabilities: number;
  total_equity: number;
  total_liabilities_equity: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

// Flatten tree to CSV rows
function flattenForCSV(nodes: BSNode[], sectionLabel: string, rows: any[] = []) {
  for (const n of nodes) {
    rows.push({
      section: sectionLabel,
      level: n.level,
      code: n.account_code,
      name: '  '.repeat(n.level - 1) + n.account_name,
      balance: fmt(Math.abs(n.balance)),
    });
    flattenForCSV(n.children, '', rows);
  }
  return rows;
}

// Build print HTML for a section tree
function buildPrintSection(_: BSNode[], title: string, _total: number): string {
  return `
    <div style="margin-bottom:20px">
      <div style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:1px;border-bottom:2px solid #111;padding-bottom:4px;margin-bottom:8px">{currency}{title}</div>
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead><tr style="background:#f3f4f6">
          <th style="text-align:left;padding:6px 8px;border-bottom:1px solid #ccc">Account</th>
          <th style="text-align:right;padding:6px 8px;border-bottom:1px solid #ccc">Amount</th>
        </tr></thead>
        <tbody>{currency}{nodes.map(renderNode).join('')}</tbody>
        <tfoot><tr style="background:#ecfdf5;font-weight:700">
          <td style="padding:8px;border-top:2px solid #111">Total ${title}</td>
          <td style="padding:8px;text-align:right;border-top:2px solid #111">{currency}{fmt(total)}</td>
        </tr></tfoot>
      </table>
    </div>`;
}

// ── Tree Row Component ─────────────────────────────────────────────────────

function TreeRow({ node, section }: { node: BSNode; section: 'asset' | 'liability' | 'equity' }) {
  const isParent = node.children.length > 0;
  const indentPx = (node.level - 1) * 20;

  const colorMap = {
    asset:     { row: 'hover:bg-emerald-50/40', subtotal: 'bg-emerald-50 text-emerald-800', border: 'border-emerald-200' },
    liability: { row: 'hover:bg-red-50/40',     subtotal: 'bg-red-50 text-red-800',         border: 'border-red-200' },
    equity:    { row: 'hover:bg-gray-50/40',    subtotal: 'bg-gray-50 text-gray-700',        border: 'border-gray-200' },
  };
  const c = colorMap[section];

  return (
    <>
      <tr className={`${c.row} transition-colors`}>
        <td className="py-2 pr-4" style={{ paddingLeft: `${indentPx + 12}px` }}>
          <span className={`text-sm ${isParent ? 'font-semibold text-gray-800' : 'text-gray-700'}`}>
            <span className="text-gray-400 mr-2 text-xs">{node.account_code}</span>
            {node.account_name}
          </span>
        </td>
        <td className="py-2 px-4 text-right w-36">
          {/* Show balance only for leaf nodes */}
          {!isParent && (
            <span className="text-sm font-medium text-gray-800 tabular-nums">
              {fmt(Math.abs(node.balance))}
            </span>
          )}
        </td>
      </tr>

      {/* Render children */}
      {node.children.map(child => (
        <TreeRow key={child.account_id} node={child} section={section} />
      ))}

      {/* Subtotal row for parent nodes (not level-1 root) */}
      {isParent && node.level > 1 && (
        <tr className={`${c.subtotal} border-t ${c.border}`}>
          <td className="py-1.5 pr-4 text-xs font-semibold italic" style={{ paddingLeft: `${indentPx + 12}px` }}>
            Subtotal — {node.account_name}
          </td>
          <td className="py-1.5 px-4 text-right text-sm font-bold tabular-nums w-36">
            {fmt(Math.abs(node.balance))}
          </td>
        </tr>
      )}
    </>
  );
}

// ── Section Card ──────────────────────────────────────────────────────────

function SectionCard({
  title,
  nodes,
  total,
  totalLabel,
  section,
  extra,
}: {
  title: string;
  nodes: BSNode[];
  total: number;
  totalLabel: string;
  section: 'asset' | 'liability' | 'equity';
  extra?: React.ReactNode;
}) {
  const headerColors = {
    asset:     'from-emerald-600 to-emerald-700',
    liability: 'from-red-600 to-red-700',
    equity:    'from-gray-600 to-gray-700',
  };
  const totalColors = {
    asset:     'bg-emerald-600 text-white',
    liability: 'bg-red-600 text-white',
    equity:    'bg-gray-600 text-white',
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Section Header */}
      <div className={`bg-gradient-to-r ${headerColors[section]} px-5 py-3`}>
        <h2 className="text-white font-bold text-sm uppercase tracking-widest">{title}</h2>
      </div>

      {/* Accounts Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider py-2 px-3">Account</th>
              <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider py-2 px-4 w-36">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {nodes.length === 0 ? (
              <tr>
                <td colSpan={2} className="text-center py-6 text-gray-400 text-sm italic">No accounts</td>
              </tr>
            ) : (
              nodes.map(node => (
                <TreeRow key={node.account_id} node={node} section={section} />
              ))
            )}
            {extra}
          </tbody>
        </table>
      </div>

      {/* Total Row */}
      <div className={`${totalColors[section]} flex justify-between items-center px-5 py-3`}>
        <span className="font-bold text-sm uppercase tracking-wide">{totalLabel}</span>
        <span className="font-bold text-lg tabular-nums">{fmt(total)}</span>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

const BalanceSheet = () => {
  const toast = useToast();
  const [data, setData] = useState<BSData | null>(null);
  const [loading, setLoading] = useState(false);
  const [asOfDate, setAsOfDate] = useState(localToday);

  const fetchBalanceSheet = async () => {
    if (!asOfDate) { toast.error('Select an as-of date'); return; }
    setLoading(true);
    try {
      const res = await api.get('/accounting/reports/balance-sheet', { params: { as_of_date: asOfDate } });
      setData(res.data);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to load balance sheet');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => { setAsOfDate(localToday()); setData(null); };

  // ── Export CSV ──
  const handleExport = () => {
    if (!data) return;
    const rows: any[] = [];
    flattenForCSV(data.assets,      'Assets',      rows);
    rows.push({ section: '', level: '', code: '', name: 'TOTAL ASSETS',      balance: fmt(data.total_assets) });
    rows.push({ section: '', level: '', code: '', name: '', balance: '' });
    flattenForCSV(data.liabilities, 'Liabilities', rows);
    rows.push({ section: '', level: '', code: '', name: 'TOTAL LIABILITIES', balance: fmt(data.total_liabilities) });
    rows.push({ section: '', level: '', code: '', name: '', balance: '' });
    flattenForCSV(data.equity,      'Equity',      rows);
    rows.push({ section: '', level: '', code: '', name: 'Net Profit / (Loss)', balance: fmt(data.net_profit) });
    rows.push({ section: '', level: '', code: '', name: 'TOTAL EQUITY',       balance: fmt(data.total_equity) });
    rows.push({ section: '', level: '', code: '', name: '', balance: '' });
    rows.push({ section: '', level: '', code: '', name: 'TOTAL LIABILITIES + EQUITY', balance: fmt(data.total_liabilities_equity) });

    const header = 'Section,Level,Code,Account,Balance';
    const csv = [header, ...rows.map(r =>
      [r.section, r.level, r.code, `"${r.name}"`, r.balance].join(',')
    )].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `balance-sheet-${asOfDate}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  // ── Print ──
  const handlePrint = () => {
    if (!data) return;
    const netProfitRow = `
      <tr style="background:#f5f3ff">
        <td style="padding-left:24px;font-style:italic;color:#6b7280">Net Profit / (Loss)</td>
        <td style="text-align:right;font-weight:600;color:${data.net_profit >= 0 ? '#059669' : '#dc2626'}">{currency}{fmt(data.net_profit)}</td>
      </tr>`;

    let content = buildPrintSection(data.assets, 'Assets', data.total_assets);
    content    += buildPrintSection(data.liabilities, 'Liabilities', data.total_liabilities);

    // Equity section with Net Profit injected
    const equityHTML = buildPrintSection(data.equity, 'Equity', data.total_equity)
      .replace('</tbody>', `${netProfitRow}</tbody>`);
    content += equityHTML;

    content += `
      <div style="margin-top:16px;background:#111827;color:white;padding:12px 16px;border-radius:6px;display:flex;justify-content:space-between;align-items:center">
        <span style="font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:1px">Total Liabilities + Equity</span>
        <span style="font-size:18px;font-weight:700">{currency}{fmt(data.total_liabilities_equity)}</span>
      </div>`;

    const isBalanced = Math.abs(data.total_assets - data.total_liabilities_equity) < 0.01;
    content += `
      <div style="margin-top:8px;text-align:center;font-size:11px;color:${isBalanced ? '#059669' : '#dc2626'};font-weight:600">
        ${isBalanced ? '✓ Balance Sheet is Balanced' : '⚠ Balance Sheet is OUT OF BALANCE — Difference: ' + fmt(Math.abs(data.total_assets - data.total_liabilities_equity))}
      </div>`;

    printReport({ title: 'Balance Sheet', dateRange: `As of ${asOfDate}`, content });
  };

  const isBalanced = data ? Math.abs(data.total_assets - data.total_liabilities_equity) < 0.01 : true;

  return (
    <div className="p-4 sm:p-6 space-y-4 min-h-full bg-gray-50/50">
      {/* ── Page Header ── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-emerald-500 to-emerald-400" />
        <div className="px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center shadow-sm">
              <FileBarChart className="text-white" size={20} />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-gray-900">Balance Sheet</h1>
              <p className="text-xs sm:text-sm text-gray-500">Financial position as of a specific date</p>
            </div>
          </div>
          {data && (
            <div className="flex items-center gap-2">
              <button onClick={handlePrint} className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition font-medium">
                <Printer size={14} /> Print
              </button>
              <button onClick={handleExport} className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition font-medium">
                <Download size={14} /> Export CSV
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Filter Bar ── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 sm:px-5 py-3.5">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">As of Date</label>
            <input type="date" value={asOfDate} onChange={e => setAsOfDate(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
          </div>
          <button onClick={fetchBalanceSheet} disabled={loading}
            className="flex items-center gap-1.5 px-5 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 transition disabled:opacity-50 shadow-sm">
            <Calendar size={14} /> {loading ? 'Loading...' : 'Generate'}
          </button>
          <button onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition">
            <RefreshCw size={13} /> Reset
          </button>
        </div>
      </div>

      {/* ── Loading ── */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600" />
        </div>
      )}

      {/* ── Empty State ── */}
      {!loading && !data && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm text-center py-16">
          <FileBarChart size={48} className="mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500 font-medium">No data to display</p>
          <p className="text-sm text-gray-400 mt-1">Select a date and click Generate</p>
        </div>
      )}

      {/* ── Report ── */}
      {!loading && data && (
        <>
          {/* Balance Status */}
          <div className={`mb-6 flex flex-wrap items-center gap-3 px-5 py-3 rounded-xl border-2 ${
            isBalanced ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'
          }`}>
            {isBalanced
              ? <CheckCircle className="text-emerald-600 flex-shrink-0" size={22} />
              : <AlertTriangle className="text-red-600 flex-shrink-0" size={22} />}
            <div className="flex-1">
              <p className={`font-semibold text-sm ${isBalanced ? 'text-emerald-800' : 'text-red-800'}`}>
                {isBalanced ? 'Balance Sheet is Balanced' : 'Balance Sheet is OUT OF BALANCE'}
              </p>
              <p className="text-xs text-gray-600 mt-0.5">
                Assets: <strong>{fmt(data.total_assets)}</strong>
                &nbsp;|&nbsp;
                Liabilities + Equity: <strong>{fmt(data.total_liabilities_equity)}</strong>
                {!isBalanced && (
                  <span className="text-red-600 ml-2">
                    Difference: {fmt(Math.abs(data.total_assets - data.total_liabilities_equity))}
                  </span>
                )}
              </p>
            </div>
            {/* Summary chips */}
            <div className="hidden md:flex items-center gap-3">
              <div className="text-center px-4 py-1.5 bg-emerald-100 rounded-lg">
                <p className="text-xs text-emerald-600 font-semibold uppercase">Assets</p>
                <p className="text-sm font-bold text-emerald-800 tabular-nums">{fmt(data.total_assets)}</p>
              </div>
              <div className="text-center px-4 py-1.5 bg-red-100 rounded-lg">
                <p className="text-xs text-red-600 font-semibold uppercase">Liabilities</p>
                <p className="text-sm font-bold text-red-800 tabular-nums">{fmt(data.total_liabilities)}</p>
              </div>
              <div className="text-center px-4 py-1.5 bg-gray-100 rounded-lg">
                <p className="text-xs text-gray-600 font-semibold uppercase">Equity</p>
                <p className="text-sm font-bold text-gray-700 tabular-nums">{fmt(data.total_equity)}</p>
              </div>
            </div>
          </div>

          {/* Three Section Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
            {/* Assets */}
            <SectionCard
              title="Assets"
              nodes={data.assets}
              total={data.total_assets}
              totalLabel="Total Assets"
              section="asset"
            />

            {/* Liabilities + Equity stacked */}
            <div className="flex flex-col gap-5">
              <SectionCard
                title="Liabilities"
                nodes={data.liabilities}
                total={data.total_liabilities}
                totalLabel="Total Liabilities"
                section="liability"
              />

              {/* Equity with Net Profit row */}
              <SectionCard
                title="Equity"
                nodes={data.equity}
                total={data.total_equity}
                totalLabel="Total Equity"
                section="equity"
                extra={
                  <tr className="bg-gray-50/60 border-t border-gray-100">
                    <td className="py-2 px-3 pl-5">
                      <span className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                        {data.net_profit >= 0
                          ? <TrendingUp size={14} className="text-emerald-500" />
                          : <TrendingDown size={14} className="text-red-500" />}
                        Net Profit / (Loss)
                      </span>
                    </td>
                    <td className="py-2 px-4 text-right w-36">
                      <span className={`text-sm font-bold tabular-nums ${data.net_profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {fmt(data.net_profit)}
                      </span>
                    </td>
                  </tr>
                }
              />
            </div>
          </div>

          {/* Grand Total Bar */}
          <div className="bg-gray-900 text-white rounded-xl px-6 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shadow-lg">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-widest mb-0.5">Total Liabilities + Equity</p>
              <p className="text-sm text-gray-300">As of {asOfDate}</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold tabular-nums">{fmt(data.total_liabilities_equity)}</p>
              {isBalanced && (
                <p className="text-xs text-emerald-400 mt-0.5 flex items-center justify-end gap-1">
                  <CheckCircle size={12} /> Balanced
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const BalanceSheetWithGate = () => <ReportPasswordGate><BalanceSheet /></ReportPasswordGate>;
export default BalanceSheetWithGate;
