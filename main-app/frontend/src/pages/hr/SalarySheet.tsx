import { useState, useEffect, useMemo } from 'react';
import { useSettings } from '../../context/SettingsContext';
import { FileText, Download, Filter, Printer, ChevronDown, ChevronRight, PlusCircle, X, Check, ExternalLink } from 'lucide-react';
import api from '../../utils/api';
import { useToast } from '../../components/Toast';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const n  = (v: any) => Number(v ?? 0);
const fmt = (v: number, dec = 2) => v.toLocaleString(undefined, { minimumFractionDigits: dec, maximumFractionDigits: dec });

// ── Adjustment Modal ──────────────────────────────────────────────────────────
interface AdjModalProps {
  staff: any;
  month: number;
  year: number;
  onClose: () => void;
  onSaved: () => void;
}
const AdjustmentModal = ({ staff, month, year, onClose, onSaved }: AdjModalProps) => {
  const toast = useToast();
  const [days, setDays]     = useState<string>(String(n(staff.adjustment_days) || ''));
  const [reason, setReason] = useState<string>(staff.adjustment_reason || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.post('/staff/reports/salary-adjustment', {
        staff_id: staff.staff_id, month, year,
        days: parseFloat(days) || 0,
        reason: reason.trim() || null,
      });
      toast.success('Adjustment saved');
      onSaved();
      onClose();
    } catch {
      toast.error('Failed to save adjustment');
    } finally { setSaving(false); }
  };

  const handleClear = async () => {
    setSaving(true);
    try {
      await api.post('/staff/reports/salary-adjustment', {
        staff_id: staff.staff_id, month, year, days: 0, reason: null,
      });
      toast.success('Adjustment cleared');
      onSaved();
      onClose();
    } catch {
      toast.error('Failed to clear');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-white font-semibold text-sm">Attendance Adjustment</p>
            <p className="text-indigo-200 text-xs mt-0.5">{staff.full_name} · {MONTHS[month - 1]} {year}</p>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Days (+add / −deduct)</label>
            <input
              type="number"
              step="0.5"
              value={days}
              onChange={e => setDays(e.target.value)}
              placeholder="e.g. 1 or -1"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
            />
            <p className="text-xs text-gray-400 mt-1">
              Positive = extra paid days &nbsp;|&nbsp; Negative = deduct days
            </p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Reason</label>
            <input
              type="text"
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="e.g. Overtime bonus, disciplinary deduction..."
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
            />
          </div>

          {/* Preview */}
          {days !== '' && !isNaN(parseFloat(days)) && (
            <div className="bg-indigo-50 rounded-xl p-3 text-xs text-indigo-800 space-y-1">
              <div className="flex justify-between">
                <span>Current Total Attendance</span>
                <span className="font-bold">{fmt(n(staff.total_attendance), 1)} days</span>
              </div>
              <div className="flex justify-between">
                <span>Adjustment</span>
                <span className={`font-bold ${parseFloat(days) >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                  {parseFloat(days) >= 0 ? '+' : ''}{parseFloat(days)} days
                </span>
              </div>
              <div className="flex justify-between border-t border-indigo-200 pt-1 mt-1">
                <span className="font-semibold">New Total</span>
                <span className="font-bold">{fmt(n(staff.total_attendance) - n(staff.adjustment_days) + parseFloat(days), 1)} days</span>
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            {n(staff.adjustment_days) !== 0 && (
              <button onClick={handleClear} disabled={saving}
                className="px-4 py-2 border border-red-200 text-red-600 rounded-xl text-sm hover:bg-red-50 transition">
                Clear
              </button>
            )}
            <button onClick={onClose} className="flex-1 px-4 py-2 border border-gray-200 text-gray-600 rounded-xl text-sm hover:bg-gray-50 transition">
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving}
              className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition">
              <Check size={14} /> {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
// ─────────────────────────────────────────────────────────────────────────────

const SalarySheet = () => {
  const { currencySymbol: currency } = useSettings();
  const toast = useToast();

  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear]   = useState(now.getFullYear());
  const [deptFilter, setDeptFilter] = useState('all');

  const [data, setData]   = useState<any[]>([]);
  const [meta, setMeta]   = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [collapsedDepts, setCollapsedDepts] = useState<Record<string, boolean>>({});
  const [adjStaff, setAdjStaff] = useState<any>(null);   // opens adjustment modal

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);

  const departments = useMemo(() => {
    const s = new Set<string>();
    data.forEach(r => { if (r.department) s.add(r.department); });
    return Array.from(s).sort();
  }, [data]);

  const filtered = useMemo(() =>
    deptFilter === 'all' ? data : data.filter(r => r.department === deptFilter),
    [data, deptFilter]
  );

  const grouped = useMemo(() => {
    const map: Record<string, any[]> = {};
    filtered.forEach(r => {
      const d = r.department || '(No Department)';
      if (!map[d]) map[d] = [];
      map[d].push(r);
    });
    return map;
  }, [filtered]);

  const ZERO = { present_days: 0, absent_days: 0, monthly_leave_allowed: 0, total_attendance: 0, salary: 0, earned_salary: 0, total_allowances: 0, gross_salary: 0, total_comp_deductions: 0, net_salary: 0 };

  const grandTotal = useMemo(() => filtered.reduce((acc, r) => ({
    present_days:          acc.present_days          + n(r.present_days),
    absent_days:           acc.absent_days           + n(r.absent_days),
    monthly_leave_allowed: acc.monthly_leave_allowed + n(r.monthly_leave_allowed),
    total_attendance:      acc.total_attendance      + n(r.total_attendance),
    salary:                acc.salary                + n(r.salary),
    earned_salary:         acc.earned_salary         + n(r.earned_salary),
    total_allowances:      acc.total_allowances      + n(r.total_allowances),
    gross_salary:          acc.gross_salary          + n(r.gross_salary),
    total_comp_deductions: acc.total_comp_deductions + n(r.total_comp_deductions),
    net_salary:            acc.net_salary            + n(r.net_salary),
  }), { ...ZERO }), [filtered]);

  const fetchSheet = async () => {
    setLoading(true);
    try {
      const res = await api.get('/staff/reports/salary-sheet', {
        params: { month, year, department: deptFilter === 'all' ? undefined : deptFilter }
      });
      setData(res.data.data || []);
      setMeta(res.data.meta || {});
    } catch {
      toast.error('Failed to load salary sheet');
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchSheet(); }, []);

  const deptTotal = (rows: any[]) => rows.reduce((acc, r) => ({
    present_days:          acc.present_days          + n(r.present_days),
    absent_days:           acc.absent_days           + n(r.absent_days),
    total_attendance:      acc.total_attendance      + n(r.total_attendance),
    salary:                acc.salary                + n(r.salary),
    earned_salary:         acc.earned_salary         + n(r.earned_salary),
    total_allowances:      acc.total_allowances      + n(r.total_allowances),
    gross_salary:          acc.gross_salary          + n(r.gross_salary),
    total_comp_deductions: acc.total_comp_deductions + n(r.total_comp_deductions),
    net_salary:            acc.net_salary            + n(r.net_salary),
  }), { present_days: 0, absent_days: 0, total_attendance: 0, salary: 0, earned_salary: 0, total_allowances: 0, gross_salary: 0, total_comp_deductions: 0, net_salary: 0 });

  const toggleDept = (d: string) => setCollapsedDepts(p => ({ ...p, [d]: !p[d] }));

  // ── CSV Export ──
  const exportCSV = () => {
    const headers = ['Emp ID','Name','Dept','Designation','Present','Absent','Half Days','Allowed Leaves','Holidays','Adjustment','Total Attendance','Basic Salary','Daily Rate','Earned Salary','Allowances','Gross Salary','Comp.Ded.','A/C Code','Deduction','Net Pay'];
    const rows = filtered.map(r => [
      r.employee_id || '',
      `"${r.full_name}"`,
      r.department || '',
      r.position || '',
      n(r.present_days), n(r.absent_days), n(r.half_days),
      n(r.monthly_leave_allowed),
      n(r.holidays),
      n(r.adjustment_days),
      fmt(n(r.total_attendance), 2),
      n(r.salary).toFixed(0),
      n(r.daily_rate).toFixed(4),
      n(r.earned_salary).toFixed(0),
      n(r.total_allowances).toFixed(0),
      n(r.gross_salary).toFixed(0),
      n(r.total_comp_deductions).toFixed(0),
      r.salary_account_code || '',
      r.salary_account_id ? n(r.salary_account_balance).toFixed(0) : '',
      n(r.net_salary).toFixed(0),
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `salary_sheet_${MONTHS[month-1]}_${year}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  // ── Print ──
  const printSheet = () => {
    const rows = filtered.map(r => `
      <tr>
        <td>${r.employee_id || '-'}</td>
        <td><b>${r.full_name}</b></td>
        <td>${r.position || '-'}</td>
        <td align="center">${n(r.present_days)}</td>
        <td align="center" style="color:#ef4444">${n(r.absent_days)}</td>
        <td align="center" style="color:#3b82f6">${n(r.monthly_leave_allowed)}</td>
        <td align="center" style="color:#8b5cf6">${n(r.holidays)}</td>
        <td align="center" style="color:#6366f1">${n(r.adjustment_days) !== 0 ? (n(r.adjustment_days) > 0 ? '+' : '') + n(r.adjustment_days) : '-'}</td>
        <td align="center" style="font-weight:700">${fmt(n(r.total_attendance), 1)}</td>
        <td align="right">${currency}${fmt(n(r.salary))}</td>
        <td align="right" style="color:#059669;font-weight:700">${currency}${fmt(n(r.earned_salary))}</td>
        <td align="right" style="color:#2563eb">${n(r.total_allowances) > 0 ? `+${currency}${fmt(n(r.total_allowances))}` : '-'}</td>
        <td align="right" style="font-weight:700;color:#065f46">${currency}${fmt(n(r.gross_salary))}</td>
        <td align="right" style="color:#ea580c">${n(r.total_comp_deductions) > 0 ? `-${currency}${fmt(n(r.total_comp_deductions))}` : '-'}</td>
        <td align="right" style="color:#7c3aed">${r.salary_account_id ? `${r.salary_account_code} ${currency}${fmt(n(r.salary_account_balance))}` : '-'}</td>
        <td align="right" style="font-weight:700;color:#059669">${currency}${fmt(n(r.net_salary))}</td>
      </tr>`).join('');

    const html = `<html><head><title>Salary Sheet</title><style>
      body{font-family:Arial,sans-serif;font-size:10px;padding:20px}
      h2{text-align:center;color:#059669;margin:0 0 4px}
      p{text-align:center;color:#6b7280;margin:0 0 12px;font-size:11px}
      table{width:100%;border-collapse:collapse}
      th{background:#f0fdf4;padding:5px 6px;border:1px solid #d1fae5;font-size:9px;white-space:nowrap;text-align:left}
      td{padding:4px 6px;border:1px solid #e5e7eb;white-space:nowrap}
      .tot{background:#ecfdf5;font-weight:700}
      @media print{@page{size:landscape A4}body{margin:0}}
    </style></head><body>
      <h2>Salary Sheet — ${MONTHS[month-1]} ${year}</h2>
      <p>Days in Month: ${meta.days_in_month} &nbsp;|&nbsp; Holidays: ${meta.holidays} &nbsp;|&nbsp; Total Staff: ${filtered.length}</p>
      <table>
        <thead><tr>
          <th>Emp ID</th><th>Name</th><th>Designation</th>
          <th>Present</th><th>Absent</th><th>Allow.Leaves</th><th>Holidays</th><th>Adj.</th><th>Total Att.</th>
          <th>Basic Salary</th><th>Earned Salary</th><th>Allowances</th><th>Gross Salary</th><th>Comp.Ded.</th><th>Deduction</th><th>Net Pay</th>
        </tr></thead>
        <tbody>${rows}
          <tr class="tot">
            <td colspan="3">GRAND TOTAL (${filtered.length} Staff)</td>
            <td align="center">${grandTotal.present_days}</td>
            <td align="center">${grandTotal.absent_days}</td>
            <td colspan="3"></td>
            <td align="center">${fmt(grandTotal.total_attendance, 1)}</td>
            <td align="right">${currency}${fmt(grandTotal.earned_salary)}</td>
            <td align="right">${currency}${fmt(grandTotal.earned_salary)}</td>
            <td align="right">+${currency}${fmt(grandTotal.total_allowances)}</td>
            <td align="right">${currency}${fmt(grandTotal.gross_salary)}</td>
            <td align="right">-${currency}${fmt(grandTotal.total_comp_deductions)}</td>
            <td></td>
            <td align="right">${currency}${fmt(grandTotal.net_salary)}</td>
          </tr>
        </tbody>
      </table>
    </body></html>`;
    const w = window.open('', '_blank', 'width=1400,height=800');
    if (w) { w.document.write(html); w.document.close(); w.print(); }
  };

  // ── Shared cell classes ──
  const th = 'px-3 py-3 font-semibold uppercase tracking-wider whitespace-nowrap text-xs';

  return (
    <div className="p-8">
      {/* Header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-emerald-50 via-white to-white border-b border-gray-100 px-8 py-6 -mx-8 -mt-8 mb-8">
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-200">
              <FileText size={22} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Salary Sheet</h1>
              <p className="text-sm text-gray-500 mt-0.5">Complete monthly payroll with attendance breakdown</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={exportCSV} className="flex items-center gap-2 border border-gray-200 text-gray-600 px-4 py-2 rounded-xl hover:bg-gray-50 transition text-sm font-medium">
              <Download size={15} /> CSV
            </button>
            <button onClick={printSheet} className="flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white px-5 py-2.5 rounded-xl hover:from-emerald-600 hover:to-emerald-700 shadow-md shadow-emerald-200 font-medium text-sm">
              <Printer size={15} /> Print
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-4 mb-6">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Month</label>
            <select value={month} onChange={e => setMonth(Number(e.target.value))}
              className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500">
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Year</label>
            <select value={year} onChange={e => setYear(Number(e.target.value))}
              className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500">
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Department</label>
            <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500">
              <option value="all">All Departments</option>
              {departments.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <button onClick={fetchSheet} disabled={loading}
            className="flex items-center gap-2 bg-emerald-500 text-white px-5 py-2 rounded-xl hover:bg-emerald-600 transition text-sm font-medium disabled:opacity-50">
            <Filter size={15} /> {loading ? 'Loading...' : 'Generate'}
          </button>
        </div>
      </div>

      {/* Meta Cards */}
      {meta.days_in_month && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          {[
            { label: 'Total Staff',     value: filtered.length,                        cls: 'text-gray-800' },
            { label: 'Days in Month',   value: meta.days_in_month,                     cls: 'text-gray-600' },
            { label: 'Public Holidays', value: meta.holidays,                          cls: 'text-purple-600' },
            { label: 'Total Gross',     value: `${currency}${fmt(grandTotal.gross_salary)}`,  cls: 'text-gray-700' },
            { label: 'Net Payable',     value: `${currency}${fmt(grandTotal.net_salary)}`,    cls: 'text-emerald-600' },
          ].map(c => (
            <div key={c.label} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
              <p className="text-xs text-gray-400 font-medium">{c.label}</p>
              <p className={`text-xl font-bold mt-1 ${c.cls}`}>{c.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-16 text-center text-gray-400">
          <FileText size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">No data — click Generate to load</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {/* Identity */}
                  <th className={`${th} text-left text-gray-500`}>Emp. ID</th>
                  <th className={`${th} text-left text-gray-500`}>Name</th>
                  <th className={`${th} text-left text-gray-500`}>Designation</th>
                  {/* Attendance block */}
                  <th className={`${th} text-center text-emerald-600`}>Present</th>
                  <th className={`${th} text-center text-red-500`}>Absent</th>
                  <th className={`${th} text-center text-blue-500`}>Allowed<br/>Leaves</th>
                  <th className={`${th} text-center text-purple-500`}>Holidays</th>
                  <th className={`${th} text-center text-indigo-500`}>Adj.</th>
                  {/* Total */}
                  <th className={`${th} text-center text-gray-700 bg-gray-100`}>Total<br/>Attendance</th>
                  {/* Salary */}
                  <th className={`${th} text-right text-gray-500`}>Basic<br/>Salary</th>
                  <th className={`${th} text-right text-emerald-600 bg-emerald-50`}>Earned<br/>Salary</th>
                  <th className={`${th} text-right text-blue-600`}>Allowances</th>
                  <th className={`${th} text-right text-emerald-700 bg-emerald-50`}>Gross<br/>Salary</th>
                  <th className={`${th} text-right text-orange-500`}>Comp.<br/>Ded.</th>
                  {/* Salary Account / Deduction */}
                  <th className={`${th} text-right text-red-500`}>Deduction</th>
                  {/* Net */}
                  <th className={`${th} text-right text-emerald-700 bg-emerald-50`}>Net Pay</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(grouped).map(([dept, rows]) => {
                  const dt = deptTotal(rows);
                  const collapsed = collapsedDepts[dept];
                  return (
                    <>
                      {/* Dept header */}
                      <tr key={`dept-${dept}`} className="bg-emerald-50/60 cursor-pointer select-none" onClick={() => toggleDept(dept)}>
                        <td colSpan={16} className="px-3 py-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {collapsed ? <ChevronRight size={13} className="text-emerald-600" /> : <ChevronDown size={13} className="text-emerald-600" />}
                              <span className="text-xs font-bold uppercase tracking-widest text-emerald-700">{dept}</span>
                              <span className="text-xs text-gray-400">({rows.length} staff)</span>
                            </div>
                            <div className="flex items-center gap-4 text-xs font-semibold">
                              <span>Att: {fmt(dt.total_attendance, 1)}</span>
                              <span className="text-emerald-700">Earned: {currency}{fmt(dt.earned_salary)}</span>
                              {dt.total_allowances > 0 && <span className="text-blue-600">Allow: +{currency}{fmt(dt.total_allowances)}</span>}
                              <span className="text-emerald-800 font-semibold">Gross: {currency}{fmt(dt.gross_salary)}</span>
                              <span className="text-emerald-700 font-bold">Net: {currency}{fmt(dt.net_salary)}</span>
                            </div>
                          </div>
                        </td>
                      </tr>

                      {/* Employee rows */}
                      {!collapsed && rows.map((r: any) => (
                        <tr key={r.staff_id} className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors">
                          {/* Identity */}
                          <td className="px-3 py-2.5 font-mono text-gray-400">{r.employee_id || '-'}</td>
                          <td className="px-3 py-2.5 font-semibold text-gray-800 whitespace-nowrap">{r.full_name}</td>
                          <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{r.position || '-'}</td>

                          {/* Attendance */}
                          <td className="px-3 py-2.5 text-center">
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 font-bold">
                              {n(r.present_days)}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full font-bold ${n(r.absent_days) > 0 ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-300'}`}>
                              {n(r.absent_days)}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-center text-blue-600 font-semibold">{n(r.monthly_leave_allowed)}</td>
                          <td className="px-3 py-2.5 text-center text-purple-600 font-medium">{n(r.holidays)}</td>

                          {/* Adjustment */}
                          <td className="px-3 py-2.5 text-center">
                            <button
                              onClick={() => setAdjStaff(r)}
                              className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold transition ${
                                n(r.adjustment_days) !== 0
                                  ? n(r.adjustment_days) > 0
                                    ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                                    : 'bg-red-100 text-red-600 hover:bg-red-200'
                                  : 'bg-gray-100 text-gray-400 hover:bg-indigo-50 hover:text-indigo-600'
                              }`}
                              title={r.adjustment_reason || 'Click to set adjustment'}
                            >
                              {n(r.adjustment_days) !== 0
                                ? <>{n(r.adjustment_days) > 0 ? '+' : ''}{n(r.adjustment_days)}</>
                                : <PlusCircle size={13} />}
                            </button>
                          </td>

                          {/* Total Attendance */}
                          <td className="px-3 py-2.5 text-center bg-gray-50">
                            <span className="font-bold text-gray-800">{fmt(n(r.total_attendance), 1)}</span>
                            <span className="text-gray-400 ml-1">/ {meta.days_in_month}</span>
                          </td>

                          {/* Salary */}
                          <td className="px-3 py-2.5 text-right text-gray-600">{currency}{fmt(n(r.salary))}</td>
                          <td className="px-3 py-2.5 text-right font-semibold text-emerald-700 bg-emerald-50">{currency}{fmt(n(r.earned_salary))}</td>

                          {/* Allowances */}
                          <td className="px-3 py-2.5 text-right text-blue-600 font-medium">
                            {n(r.total_allowances) > 0 ? `+${currency}${fmt(n(r.total_allowances))}` : <span className="text-gray-300">—</span>}
                          </td>

                          {/* Gross Salary */}
                          <td className="px-3 py-2.5 text-right font-bold text-emerald-800 bg-emerald-50">{currency}{fmt(n(r.gross_salary))}</td>

                          {/* Component Deductions */}
                          <td className="px-3 py-2.5 text-right text-orange-600 font-medium">
                            {n(r.total_comp_deductions) > 0 ? `-${currency}${fmt(n(r.total_comp_deductions))}` : <span className="text-gray-300">—</span>}
                          </td>

                          {/* Salary Account Balance */}
                          <td className="px-3 py-2.5 text-right">
                            {r.salary_account_id ? (
                              <button
                                onClick={() => {
                                  const from = `${year}-${String(month).padStart(2,'0')}-01`;
                                  const last = new Date(year, month, 0).getDate();
                                  const to   = `${year}-${String(month).padStart(2,'0')}-${String(last).padStart(2,'0')}`;
                                  window.open(`/general-ledger?account_id=${r.salary_account_id}&from_date=${from}&to_date=${to}`, '_blank');
                                }}
                                className="group inline-flex items-center gap-1 font-semibold text-red-600 hover:opacity-80 transition"
                                title={`${r.salary_account_code} — ${r.salary_account_name}\nClick to open ledger`}
                              >
                                {currency}{fmt(n(r.salary_account_balance))}
                                <ExternalLink size={10} className="opacity-40 group-hover:opacity-100" />
                              </button>
                            ) : (
                              <span className="text-gray-300 text-xs">—</span>
                            )}
                          </td>

                          {/* Net Pay */}
                          <td className="px-3 py-2.5 text-right font-bold text-emerald-700 bg-emerald-50">{currency}{fmt(n(r.net_salary))}</td>
                        </tr>
                      ))}
                    </>
                  );
                })}

                {/* Grand Total */}
                <tr className="bg-emerald-50 border-t-2 border-emerald-300">
                  <td colSpan={3} className="px-3 py-4 font-bold text-gray-700 text-sm">
                    GRAND TOTAL — {filtered.length} Employees &nbsp;|&nbsp; {MONTHS[month - 1]} {year}
                  </td>
                  <td className="px-3 py-4 text-center font-bold text-emerald-700">{grandTotal.present_days}</td>
                  <td className="px-3 py-4 text-center font-bold text-red-500">{grandTotal.absent_days}</td>
                  <td className="px-3 py-4 text-center font-bold text-blue-600">{grandTotal.monthly_leave_allowed}</td>
                  <td colSpan={2} />
                  <td className="px-3 py-4 text-center font-bold text-gray-800 bg-gray-100">{fmt(grandTotal.total_attendance, 1)}</td>
                  <td className="px-3 py-4 text-right font-bold text-gray-800">{currency}{fmt(grandTotal.salary)}</td>
                  <td className="px-3 py-4 text-right font-bold text-emerald-700 bg-emerald-50">{currency}{fmt(grandTotal.earned_salary)}</td>
                  <td className="px-3 py-4 text-right font-bold text-blue-600">+{currency}{fmt(grandTotal.total_allowances)}</td>
                  <td className="px-3 py-4 text-right font-bold text-emerald-800 bg-emerald-50">{currency}{fmt(grandTotal.gross_salary)}</td>
                  <td className="px-3 py-4 text-right font-bold text-orange-600">-{currency}{fmt(grandTotal.total_comp_deductions)}</td>
                  <td />
                  <td className="px-3 py-4 text-right font-bold text-emerald-700 text-sm bg-emerald-50">{currency}{fmt(grandTotal.net_salary)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 text-xs text-gray-500 flex flex-wrap gap-x-6 gap-y-1">
            <span><b>Total Attendance</b> = Present + (Half Days × 0.5) + Allowed Leaves + Holidays + Adjustment</span>
            <span><b>Earned Salary</b> = (Basic Salary ÷ Days in Month) × Total Attendance</span>
            <span><b>Gross Salary</b> = Earned Salary + Allowance Components</span>
            <span><b>Net Pay</b> = Gross Salary − Component Deductions − Account Deduction</span>
          </div>
        </div>
      )}

      {/* Adjustment Modal */}
      {adjStaff && (
        <AdjustmentModal
          staff={adjStaff}
          month={month}
          year={year}
          onClose={() => setAdjStaff(null)}
          onSaved={fetchSheet}
        />
      )}
    </div>
  );
};

export default SalarySheet;
