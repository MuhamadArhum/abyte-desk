import { useState, useEffect, useRef, useMemo } from 'react';
import { Scale, Download, RefreshCw, Printer, LayoutGrid, Search, ChevronDown, X } from 'lucide-react';
import api from '../../utils/api';
import { useToast } from '../../components/Toast';
import { localToday, localMonthStart } from '../../utils/dateUtils';
import ReportPasswordGate from '../../components/ReportPasswordGate';

// ── Searchable parent account picker ─────────────────────────────────────────
const AccountPicker = ({ value, onChange, accounts }: {
  value: string; onChange: (id: string, name: string) => void; accounts: any[];
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [hi, setHi] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const selected = accounts.find(a => String(a.account_id) === value);
  const filtered = accounts.filter(a =>
    !search || a.account_name.toLowerCase().includes(search.toLowerCase()) || a.account_code.includes(search)
  );

  useEffect(() => { setHi(0); }, [search]);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const select = (a: any) => { onChange(String(a.account_id), a.account_name); setOpen(false); setSearch(''); };
  const clear   = (e: React.MouseEvent) => { e.stopPropagation(); onChange('', ''); };

  return (
    <div ref={ref} className="relative min-w-[280px]">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white hover:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-left">
        <span className={selected ? 'font-medium text-gray-900' : 'text-gray-400'}>
          {selected ? `${selected.account_code} — ${selected.account_name}` : 'All Accounts'}
        </span>
        <div className="flex items-center gap-1 shrink-0 ml-2">
          {selected && (
            <span onClick={clear} className="text-gray-300 hover:text-red-400 transition">
              <X size={13} />
            </span>
          )}
          <ChevronDown size={13} className="text-gray-400" />
        </div>
      </button>
      {open && (
        <div className="absolute z-50 left-0 top-full mt-1 w-96 bg-white border border-gray-200 rounded-xl shadow-2xl">
          <div className="p-2 border-b border-gray-100">
            <div className="flex items-center gap-2 px-2 py-1.5 bg-gray-50 rounded-lg">
              <Search size={13} className="text-gray-400" />
              <input autoFocus type="text" value={search} onChange={e => setSearch(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'ArrowDown') { e.preventDefault(); setHi(h => Math.min(h + 1, filtered.length - 1)); }
                  else if (e.key === 'ArrowUp') { e.preventDefault(); setHi(h => Math.max(h - 1, 0)); }
                  else if (e.key === 'Enter' && filtered.length > 0) { e.preventDefault(); select(filtered[hi] ?? filtered[0]); }
                  else if (e.key === 'Escape') setOpen(false);
                }}
                className="bg-transparent text-sm outline-none w-full" placeholder="Search by name or code..." />
            </div>
          </div>
          <ul className="max-h-64 overflow-y-auto py-1">
            <li>
              <button type="button" onClick={() => { onChange('', ''); setOpen(false); }}
                className="w-full text-left px-4 py-2.5 text-sm text-gray-500 italic hover:bg-gray-50">
                — All Accounts
              </button>
            </li>
            {filtered.length === 0
              ? <li className="px-4 py-3 text-sm text-gray-400">No accounts found</li>
              : filtered.map((a, idx) => (
                <li key={a.account_id}>
                  <button type="button" onClick={() => select(a)}
                    className={`w-full text-left px-4 py-2.5 flex items-center justify-between gap-3 ${idx === hi ? 'bg-emerald-50' : 'hover:bg-gray-50'}`}>
                    <div>
                      <span className="text-xs font-mono text-gray-400">{a.account_code}</span>
                      <span className="ml-2 text-sm text-gray-800 font-medium">{a.account_name}</span>
                    </div>
                    <span className="text-xs text-gray-400 shrink-0 capitalize bg-gray-100 px-1.5 py-0.5 rounded">
                      L{a.level}
                    </span>
                  </button>
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
};

// ── Types ─────────────────────────────────────────────────────────────────────
interface Row6Col {
  account_id: number;
  parent_account_id: number | null;
  level: number;
  account_code: string;
  account_name: string;
  account_type: string;
  opening_dr: number;
  opening_cr: number;
  period_dr: number;
  period_cr: number;
  closing_dr: number;
  closing_cr: number;
}

interface DisplayRow extends Row6Col {
  agg_opening_dr: number;
  agg_opening_cr: number;
  agg_period_dr: number;
  agg_period_cr: number;
  agg_closing_dr: number;
  agg_closing_cr: number;
  isLeaf: boolean;
}

interface Totals6Col {
  opening_dr: number; opening_cr: number;
  period_dr: number;  period_cr: number;
  closing_dr: number; closing_cr: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt  = (n: number) => n > 0.005 ? n.toLocaleString('en-PK', { minimumFractionDigits: 2 }) : '';
const fmtN = (n: number) => n.toLocaleString('en-PK', { minimumFractionDigits: 2 });

// Build displayRows: tree aggregation + level/zero filtering
function buildDisplayRows(
  data: Row6Col[],
  levels: { l1: boolean; l2: boolean; l3: boolean; l4: boolean },
  showZero: boolean,
): DisplayRow[] {
  if (!data.length) return [];

  // 1. Init map
  const map = new Map<number, DisplayRow>();
  for (const row of data) {
    map.set(row.account_id, {
      ...row,
      agg_opening_dr: row.opening_dr,
      agg_opening_cr: row.opening_cr,
      agg_period_dr:  row.period_dr,
      agg_period_cr:  row.period_cr,
      agg_closing_dr: row.closing_dr,
      agg_closing_cr: row.closing_cr,
      isLeaf: true,
    });
  }

  // 2. Mark parents as non-leaf
  for (const row of data) {
    if (row.parent_account_id !== null && map.has(row.parent_account_id)) {
      map.get(row.parent_account_id)!.isLeaf = false;
    }
  }

  // 3. Bubble-up aggregated values (deepest level processed first)
  const byLevel = [...map.values()].sort((a, b) => b.level - a.level);
  for (const node of byLevel) {
    if (node.parent_account_id !== null && map.has(node.parent_account_id)) {
      const parent = map.get(node.parent_account_id)!;
      parent.agg_opening_dr += node.agg_opening_dr;
      parent.agg_opening_cr += node.agg_opening_cr;
      parent.agg_period_dr  += node.agg_period_dr;
      parent.agg_period_cr  += node.agg_period_cr;
      parent.agg_closing_dr += node.agg_closing_dr;
      parent.agg_closing_cr += node.agg_closing_cr;
    }
  }

  // 4. Determine which levels to show (l4 covers 4 and deeper)
  const activeLevels = new Set<number>();
  if (levels.l1) activeLevels.add(1);
  if (levels.l2) activeLevels.add(2);
  if (levels.l3) activeLevels.add(3);
  if (levels.l4) { [4, 5, 6, 7, 8].forEach(n => activeLevels.add(n)); }

  // 5. Filter and return in original order
  return data
    .map(r => map.get(r.account_id)!)
    .filter(r => {
      if (!activeLevels.has(r.level)) return false;
      if (!showZero) {
        const hasValue = r.agg_opening_dr > 0.005 || r.agg_opening_cr > 0.005 ||
                         r.agg_period_dr  > 0.005 || r.agg_period_cr  > 0.005 ||
                         r.agg_closing_dr > 0.005 || r.agg_closing_cr > 0.005;
        if (!hasValue) return false;
      }
      return true;
    });
}

// ── Level chip ────────────────────────────────────────────────────────────────
const LevelChip = ({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition select-none ${
      active
        ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
        : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
    }`}
  >
    {label}
  </button>
);

// ── Main component ────────────────────────────────────────────────────────────
const TrialBalance6Col = () => {
  const toast = useToast();
  const [data, setData]       = useState<Row6Col[]>([]);
  const [totals, setTotals]   = useState<Totals6Col | null>(null);
  const [loading, setLoading] = useState(false);
  const [fromDate, setFromDate] = useState(localToday());
  const [toDate, setToDate]     = useState(localToday());
  const [accounts, setAccounts] = useState<any[]>([]);
  const [parentId, setParentId]     = useState('');
  const [parentName, setParentName] = useState('');

  // Level / zero-balance filter state
  const [levels, setLevels] = useState({ l1: true, l2: true, l3: true, l4: true });
  const [showZero, setShowZero] = useState(false);


  useEffect(() => {
    api.get('/accounting/accounts', { params: { tree: 1 } })
      .then(r => setAccounts((r.data.data || []).filter((a: any) => a.is_active)))
      .catch(() => {});
  }, []);

  const openLedger = (accountId: number) => {
    const url = `/general-ledger?account_id=${accountId}&from_date=${fromDate}&to_date=${toDate}`;
    window.open(url, '_blank');
  };

  const generate = async () => {
    if (!fromDate || !toDate) { toast.error('Select date range'); return; }
    if (fromDate > toDate) { toast.error('From date must be before To date'); return; }
    setLoading(true);
    try {
      const params: any = { from_date: fromDate, to_date: toDate };
      if (parentId) params.parent_account_id = parentId;
      const res = await api.get('/accounting/reports/trial-balance-6col', { params });
      setData(res.data.data || []);
      setTotals(res.data.totals || null);
      if ((res.data.data || []).length === 0) toast.info('No data found for selected period');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to load');
      setData([]); setTotals(null);
    } finally {
      setLoading(false);
    }
  };

  // Build display rows whenever data or filters change
  const displayRows = useMemo(
    () => buildDisplayRows(data, levels, showZero),
    [data, levels, showZero]
  );

  const toggleLevel = (key: 'l1' | 'l2' | 'l3' | 'l4') =>
    setLevels(prev => ({ ...prev, [key]: !prev[key] }));

  const isBalanced = totals
    ? Math.abs(totals.closing_dr - totals.closing_cr) < 0.01
    : null;

  // ── Row styling by level ──────────────────────────────────────────────────
  const rowBg = (r: DisplayRow) => {
    if (!r.isLeaf && r.level === 1) return 'bg-slate-100';
    if (!r.isLeaf && r.level === 2) return 'bg-slate-50';
    return 'bg-white';
  };

  const descClass = (r: DisplayRow) => {
    const indent =
      r.level === 1 ? 'pl-2' :
      r.level === 2 ? 'pl-6' :
      r.level === 3 ? 'pl-10' : 'pl-14';
    const weight =
      (!r.isLeaf && r.level === 1) ? 'font-bold text-gray-800 uppercase text-xs tracking-wide' :
      (!r.isLeaf && r.level === 2) ? 'font-semibold text-gray-700' :
      (!r.isLeaf && r.level === 3) ? 'font-medium text-gray-700' :
      'font-normal text-gray-600';
    return `px-3 py-2.5 ${indent} ${weight}`;
  };

  // ── Print ─────────────────────────────────────────────────────────────────
  const handlePrint = () => {
    if (!displayRows.length || !totals) return;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<html><head><title>Trial Balance 6 Column</title>
    <style>
      body { font-family: Arial, sans-serif; font-size: 10px; margin: 20px; }
      h2 { text-align:center; margin:0 0 2px; font-size:14px; }
      p  { text-align:center; color:#555; margin:0 0 12px; font-size:10px; }
      table { width:100%; border-collapse:collapse; }
      th { background:#1f2937; color:#fff; padding:6px 8px; font-size:9px; text-align:center; border:1px solid #374151; }
      th.left { text-align:left; }
      td { padding:4px 8px; border-bottom:1px solid #e5e7eb; font-size:10px; }
      td.right { text-align:right; white-space:nowrap; }
      .l1 td { background:#f1f5f9; font-weight:bold; text-transform:uppercase; font-size:9px; letter-spacing:.04em; }
      .l2 td { background:#f8fafc; font-weight:600; }
      .l3 td { font-weight:500; }
      .l4 td { color:#4b5563; }
      .i1 { padding-left:4px; }  .i2 { padding-left:16px; }
      .i3 { padding-left:28px; } .i4 { padding-left:40px; }
      .total-row td { background:#1f2937; color:#fff; font-weight:bold; }
    </style></head><body>
    <h2>Trial Balance — 6 Column</h2>
    <p>Period: ${fromDate} to ${toDate}${parentName ? ` &nbsp;|&nbsp; ${parentName} &amp; sub-accounts` : ''}</p>
    <table>
      <tr>
        <th class="left" rowspan="2" style="width:38%">Account Description</th>
        <th colspan="2">Opening Balance</th>
        <th colspan="2">Current</th>
        <th colspan="2">Closing Balance</th>
      </tr>
      <tr>
        <th>Debit</th><th>Credit</th>
        <th>Debit</th><th>Credit</th>
        <th>Debit</th><th>Credit</th>
      </tr>
      ${displayRows.map(r => {
        const lv = Math.min(r.level, 4);
        return `<tr class="l${lv}">
          <td class="i${lv}">${r.account_code} ${r.account_name}</td>
          <td class="right">${fmt(r.agg_opening_dr)}</td>
          <td class="right">${fmt(r.agg_opening_cr)}</td>
          <td class="right">${fmt(r.agg_period_dr)}</td>
          <td class="right">${fmt(r.agg_period_cr)}</td>
          <td class="right">${fmt(r.agg_closing_dr)}</td>
          <td class="right">${fmt(r.agg_closing_cr)}</td>
        </tr>`;
      }).join('')}
      <tr class="total-row">
        <td>GRAND TOTAL</td>
        <td class="right">${fmtN(totals.opening_dr)}</td>
        <td class="right">${fmtN(totals.opening_cr)}</td>
        <td class="right">${fmtN(totals.period_dr)}</td>
        <td class="right">${fmtN(totals.period_cr)}</td>
        <td class="right">${fmtN(totals.closing_dr)}</td>
        <td class="right">${fmtN(totals.closing_cr)}</td>
      </tr>
    </table>
    </body></html>`);
    win.document.close(); win.print();
  };

  // ── Export CSV ────────────────────────────────────────────────────────────
  const exportCSV = () => {
    const header = 'Level,Code,Account Name,Opening Dr,Opening Cr,Current Dr,Current Cr,Closing Dr,Closing Cr';
    const rows = displayRows.map(r =>
      [r.level, r.account_code, `"${r.account_name}"`,
       r.agg_opening_dr.toFixed(0), r.agg_opening_cr.toFixed(0),
       r.agg_period_dr.toFixed(0),  r.agg_period_cr.toFixed(0),
       r.agg_closing_dr.toFixed(0), r.agg_closing_cr.toFixed(0)].join(',')
    );
    if (totals) {
      rows.push(['', 'GRAND TOTAL', '',
        totals.opening_dr.toFixed(0), totals.opening_cr.toFixed(0),
        totals.period_dr.toFixed(0),  totals.period_cr.toFixed(0),
        totals.closing_dr.toFixed(0), totals.closing_cr.toFixed(0)].join(','));
    }
    const csv = [header, ...rows].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `trial-balance-6col-${fromDate}-${toDate}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="p-6">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-emerald-100 rounded-xl flex items-center justify-center">
            <LayoutGrid size={18} className="text-emerald-700" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Trial Balance — 6 Column</h1>
            <p className="text-sm text-gray-500">Opening Balance · Current · Closing Balance</p>
          </div>
        </div>
        {data.length > 0 && (
          <div className="flex gap-2">
            <button onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition">
              <Printer size={15} /> Print
            </button>
            <button onClick={exportCSV}
              className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition">
              <Download size={15} /> Export CSV
            </button>
          </div>
        )}
      </div>

      {/* Filters card */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-4">
        {/* Row 1: date + account picker + buttons */}
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Account Filter</label>
            <AccountPicker
              value={parentId}
              onChange={(id, name) => { setParentId(id); setParentName(name); }}
              accounts={accounts}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">From Date</label>
            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">To Date</label>
            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500" />
          </div>
          <button onClick={generate} disabled={loading}
            className="px-6 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 transition shadow-sm disabled:opacity-50">
            {loading ? 'Generating…' : 'Generate'}
          </button>
          <button onClick={() => {
            setFromDate(localMonthStart()); setToDate(localToday());
            setData([]); setTotals(null); setParentId(''); setParentName('');
          }}
            className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition">
            <RefreshCw size={14} /> Reset
          </button>
        </div>

        {/* Row 2: Level chips + Zero Balance toggle */}
        <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-gray-100">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide mr-1">Show:</span>
          <LevelChip label="Level 1" active={levels.l1} onClick={() => toggleLevel('l1')} />
          <LevelChip label="Level 2" active={levels.l2} onClick={() => toggleLevel('l2')} />
          <LevelChip label="Level 3" active={levels.l3} onClick={() => toggleLevel('l3')} />
          <LevelChip label="Level 4" active={levels.l4} onClick={() => toggleLevel('l4')} />
          <div className="w-px h-5 bg-gray-200 mx-1" />
          <LevelChip label="Zero Balance" active={showZero} onClick={() => setShowZero(v => !v)} />
          {data.length > 0 && (
            <span className="ml-auto text-xs text-gray-400">
              {displayRows.length} account{displayRows.length !== 1 ? 's' : ''} shown
            </span>
          )}
        </div>

        {/* Active parent filter badge */}
        {parentId && (
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs text-gray-500">Showing:</span>
            <span className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium px-2.5 py-1 rounded-full">
              {parentName} & all sub-accounts
              <button onClick={() => { setParentId(''); setParentName(''); }} className="hover:text-red-500 transition">
                <X size={11} />
              </button>
            </span>
          </div>
        )}
      </div>

      {/* Balance status banner */}
      {totals && (
        <div className={`mb-4 px-5 py-3 rounded-xl border-2 flex items-center gap-3 ${isBalanced ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
          <Scale size={20} className={isBalanced ? 'text-emerald-600' : 'text-red-500'} />
          <div>
            <p className={`font-semibold text-sm ${isBalanced ? 'text-emerald-800' : 'text-red-800'}`}>
              {isBalanced ? 'Trial Balance is Balanced' : 'Trial Balance is Out of Balance'}
            </p>
            {!isBalanced && (
              <p className="text-xs text-red-600 mt-0.5">
                Closing difference: {Math.abs(totals.closing_dr - totals.closing_cr).toLocaleString('en-PK', { minimumFractionDigits: 2 })}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin h-8 w-8 rounded-full border-2 border-emerald-600 border-t-transparent" />
          </div>
        ) : data.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <LayoutGrid size={48} className="mx-auto mb-3 opacity-20" />
            <p className="font-medium">Select a date range and click Generate</p>
          </div>
        ) : displayRows.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <LayoutGrid size={48} className="mx-auto mb-3 opacity-20" />
            <p className="font-medium">No accounts match the current level filter</p>
            <p className="text-sm mt-1">Try enabling more levels or toggle Zero Balance</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-800 text-white">
                  <th className="px-3 py-2.5 text-left font-semibold" rowSpan={2} style={{ minWidth: 280 }}>
                    Account Description
                  </th>
                  <th className="px-3 py-2.5 text-center font-semibold border-l border-gray-600" colSpan={2}>
                    Opening Balance
                  </th>
                  <th className="px-3 py-2.5 text-center font-semibold border-l border-gray-600" colSpan={2}>
                    Current
                  </th>
                  <th className="px-3 py-2.5 text-center font-semibold border-l border-gray-600" colSpan={2}>
                    Closing Balance
                  </th>
                </tr>
                <tr className="bg-gray-700 text-gray-200 text-xs">
                  <th className="px-3 py-2 text-right font-medium border-l border-gray-600 w-32">Debit</th>
                  <th className="px-3 py-2 text-right font-medium w-32">Credit</th>
                  <th className="px-3 py-2 text-right font-medium border-l border-gray-600 w-32">Debit</th>
                  <th className="px-3 py-2 text-right font-medium w-32">Credit</th>
                  <th className="px-3 py-2 text-right font-medium border-l border-gray-600 w-32">Debit</th>
                  <th className="px-3 py-2 text-right font-medium w-32">Credit</th>
                </tr>
              </thead>
              <tbody>
                {displayRows.map(row => (
                  <tr key={row.account_id}
                    className={`border-b border-gray-100 hover:brightness-95 transition ${rowBg(row)}`}>
                    {/* Account Description (code + name, indented) */}
                    <td className={descClass(row)}>
                      <span className="font-mono text-gray-400 mr-2 text-xs">{row.account_code}</span>
                      {row.level >= 4 ? (
                        <button
                          type="button"
                          onClick={() => openLedger(row.account_id)}
                          className="hover:text-emerald-700 hover:underline transition-colors text-left cursor-pointer"
                          title="Open Ledger in new tab"
                        >
                          {row.account_name}
                        </button>
                      ) : (
                        row.account_name
                      )}
                    </td>

                    {/* Opening Balance */}
                    <td className="px-3 py-2.5 text-right text-blue-700 font-medium border-l border-gray-100 w-32 whitespace-nowrap">
                      {fmt(row.agg_opening_dr)}
                    </td>
                    <td className="px-3 py-2.5 text-right text-orange-600 font-medium w-32 whitespace-nowrap">
                      {fmt(row.agg_opening_cr)}
                    </td>

                    {/* Current (Period) */}
                    <td className="px-3 py-2.5 text-right text-blue-700 font-medium border-l border-gray-100 w-32 whitespace-nowrap">
                      {fmt(row.agg_period_dr)}
                    </td>
                    <td className="px-3 py-2.5 text-right text-orange-600 font-medium w-32 whitespace-nowrap">
                      {fmt(row.agg_period_cr)}
                    </td>

                    {/* Closing Balance */}
                    <td className="px-3 py-2.5 text-right text-blue-700 font-semibold border-l border-gray-100 w-32 whitespace-nowrap">
                      {fmt(row.agg_closing_dr)}
                    </td>
                    <td className="px-3 py-2.5 text-right text-orange-600 font-semibold w-32 whitespace-nowrap">
                      {fmt(row.agg_closing_cr)}
                    </td>
                  </tr>
                ))}
              </tbody>

              {/* Grand Total row */}
              {totals && (
                <tfoot>
                  <tr className="bg-gray-800 text-white font-bold">
                    <td className="px-3 py-3 text-sm tracking-wide">GRAND TOTAL</td>
                    <td className="px-3 py-3 text-right border-l border-gray-600">
                      {fmtN(totals.opening_dr)}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {fmtN(totals.opening_cr)}
                    </td>
                    <td className="px-3 py-3 text-right border-l border-gray-600">
                      {fmtN(totals.period_dr)}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {fmtN(totals.period_cr)}
                    </td>
                    <td className={`px-3 py-3 text-right border-l border-gray-600 ${isBalanced ? 'text-emerald-300' : 'text-red-300'}`}>
                      {fmtN(totals.closing_dr)}
                    </td>
                    <td className={`px-3 py-3 text-right ${isBalanced ? 'text-emerald-300' : 'text-red-300'}`}>
                      {fmtN(totals.closing_cr)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>

    </div>
  );
};

const TrialBalance6ColWithGate = () => <ReportPasswordGate><TrialBalance6Col /></ReportPasswordGate>;
export default TrialBalance6ColWithGate;
