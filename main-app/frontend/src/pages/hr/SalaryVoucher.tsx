import { useState, useEffect } from 'react';
import { useSettings } from '../../context/SettingsContext';
import { FileText, Search, Printer, User, Filter } from 'lucide-react';
import api from '../../utils/api';
import { useToast } from '../../components/Toast';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const fmt = (v: number) => Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const SalaryVoucher = () => {
  const { currencySymbol: currency } = useSettings();
  const toast = useToast();

  const now = new Date();
  const [staffList, setStaffList] = useState<any[]>([]);
  const [staffId, setStaffId]   = useState('');
  const [month, setMonth]       = useState(now.getMonth() + 1);
  const [year, setYear]         = useState(now.getFullYear());
  const [slip, setSlip]         = useState<any>(null);
  const [loading, setLoading]   = useState(false);

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);

  useEffect(() => {
    api.get('/staff', { params: { limit: 500, is_active: 1 } })
      .then(r => setStaffList(r.data.data || []))
      .catch(() => { toast.error('Failed to load staff list'); });
  }, []);

  const fetchSlip = async () => {
    if (!staffId) { toast.error('Please select an employee'); return; }
    setLoading(true);
    try {
      const res = await api.get('/staff/reports/salary-voucher', { params: { staff_id: staffId, month, year } });
      setSlip(res.data);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to load salary slip');
    } finally { setLoading(false); }
  };

  const printSlip = () => {
    if (!slip) return;
    const s = slip;
    const rows = (s.allowance_items || []).map((a: any) =>
      `<tr><td class="lbl">+ ${a.name}</td><td class="val earn">+${currency}${fmt(a.value)}</td></tr>`).join('');
    const dedRows = (s.deduction_items || []).map((d: any) =>
      `<tr><td class="lbl">- ${d.name}</td><td class="val ded">-${currency}${fmt(d.value)}</td></tr>`).join('');

    const html = `<html><head><title>Salary Slip</title><style>
      *{box-sizing:border-box}
      body{font-family:Arial,sans-serif;max-width:700px;margin:20px auto;padding:0 20px;color:#111}
      .top{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #059669;padding-bottom:12px;margin-bottom:16px}
      .top h2{color:#059669;margin:0;font-size:20px}.top p{color:#555;font-size:13px;margin:2px 0}
      .badge{background:#ecfdf5;border:1px solid #6ee7b7;border-radius:20px;padding:4px 12px;font-size:12px;font-weight:700;color:#059669}
      .info{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:14px}
      .ib{background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:8px 12px}
      .ib label{display:block;font-size:10px;text-transform:uppercase;color:#9ca3af;margin-bottom:2px}
      .ib span{font-weight:700;font-size:13px}
      .sec{border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:12px}
      .sec-h{background:#f9fafb;padding:7px 14px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#374151;border-bottom:1px solid #e5e7eb}
      table{width:100%;border-collapse:collapse}
      td{padding:6px 14px;font-size:13px;border-bottom:1px solid #f3f4f6}tr:last-child td{border:none}
      .lbl{color:#6b7280}.val{text-align:right;font-weight:500}
      .earn{color:#059669}.ded{color:#ef4444}
      .net{background:#ecfdf5;font-weight:700;font-size:16px}
      .net td{color:#059669;padding:10px 14px;border-top:2px solid #059669}
      .sigs{display:grid;grid-template-columns:1fr 1fr 1fr;gap:30px;margin-top:30px;padding-top:4px}
      .sig{border-top:1px solid #111;text-align:center;font-size:11px;color:#6b7280;padding-top:4px}
      .foot{text-align:center;color:#9ca3af;font-size:11px;margin-top:16px;border-top:1px solid #e5e7eb;padding-top:8px}
      @media print{body{margin:0}@page{size:A4 portrait}}
    </style></head><body>
      <div class="top">
        <div>
          <h2>Salary Slip</h2>
          <p>${MONTHS[s.month-1]} ${s.year}</p>
        </div>
        <span class="badge">NET: ${currency}${fmt(s.net_pay)}</span>
      </div>
      <div class="info">
        <div class="ib"><label>Employee</label><span>${s.staff.full_name}</span></div>
        <div class="ib"><label>Emp. ID</label><span>${s.staff.employee_id || '-'}</span></div>
        <div class="ib"><label>Department</label><span>${s.staff.department || '-'}</span></div>
        <div class="ib"><label>Designation</label><span>${s.staff.position || '-'}</span></div>
        <div class="ib"><label>Days in Month</label><span>${s.days_in_month}</span></div>
        <div class="ib"><label>Public Holidays</label><span>${s.holidays}</span></div>
      </div>

      <div class="sec">
        <div class="sec-h">Attendance</div>
        <table>
          <tr><td class="lbl">Present Days</td><td class="val earn">${s.present_days}</td></tr>
          <tr><td class="lbl">Absent Days</td><td class="val ded">${s.absent_days}</td></tr>
          <tr><td class="lbl">Half Days</td><td class="val">${s.half_days}</td></tr>
          <tr><td class="lbl">Allowed Leaves</td><td class="val">${s.monthly_leave_allowed}</td></tr>
          <tr><td class="lbl">Holidays</td><td class="val">${s.holidays}</td></tr>
          ${s.adjustment_days ? `<tr><td class="lbl">Adjustment</td><td class="val ${s.adjustment_days>0?'earn':'ded'}">${s.adjustment_days>0?'+':''}${s.adjustment_days} days${s.adjustment_reason?' ('+s.adjustment_reason+')':''}</td></tr>` : ''}
          <tr><td class="lbl"><b>Total Payable Days</b></td><td class="val earn"><b>${s.total_attendance}</b></td></tr>
          <tr><td class="lbl">Daily Rate</td><td class="val">${currency}${fmt(s.daily_rate)}</td></tr>
        </table>
      </div>

      <div class="sec">
        <div class="sec-h">Earnings</div>
        <table>
          <tr><td class="lbl">Basic Salary</td><td class="val">${currency}${fmt(s.basic_salary)}</td></tr>
          <tr><td class="lbl">Earned Salary (${s.total_attendance} days × ${currency}${fmt(s.daily_rate)})</td><td class="val earn">${currency}${fmt(s.earned_salary)}</td></tr>
          ${rows}
          <tr><td class="lbl"><b>Gross Salary</b></td><td class="val earn"><b>${currency}${fmt(s.gross_salary)}</b></td></tr>
        </table>
      </div>

      ${(s.deduction_items?.length > 0 || s.account_deduction > 0) ? `
      <div class="sec">
        <div class="sec-h">Deductions</div>
        <table>
          ${dedRows}
          ${s.account_deduction > 0 ? `<tr><td class="lbl">${s.staff.salary_account_name || 'Account Deduction'}</td><td class="val ded">-${currency}${fmt(s.account_deduction)}</td></tr>` : ''}
        </table>
      </div>` : ''}

      <table class="sec">
        <tr class="net"><td>NET PAY</td><td style="text-align:right">${currency}${fmt(s.net_pay)}</td></tr>
      </table>

      <div class="sigs">
        <div class="sig">Prepared By</div>
        <div class="sig">Approved By</div>
        <div class="sig">Employee Signature</div>
      </div>
      <div class="foot">AByte ERP &mdash; Generated ${new Date().toLocaleDateString()}</div>
    </body></html>`;
    const w = window.open('', '_blank', 'width=800,height=750');
    if (w) { w.document.write(html); w.document.close(); w.print(); }
  };

  const Row = ({ label, value, cls = '' }: { label: string; value: any; cls?: string }) => (
    <div className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className={`font-semibold ${cls}`}>{value}</span>
    </div>
  );

  return (
    <div className="p-4 sm:p-6">
      {/* Header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-emerald-50 via-white to-white border-b border-gray-100 px-4 sm:px-8 py-4 sm:py-6 -mx-4 sm:-mx-6 -mt-4 sm:-mt-6 mb-6 sm:mb-8">
        <div className="relative flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-200">
            <FileText size={22} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Salary Slips</h1>
            <p className="text-sm text-gray-500 mt-0.5">Generate individual employee salary slip for any month</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-8">
        <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
          <Search size={15} className="text-emerald-500" /> Select Employee &amp; Period
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Employee</label>
            <select value={staffId} onChange={e => setStaffId(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm">
              <option value="">— Select Employee —</option>
              {staffList.map(s => (
                <option key={s.staff_id} value={s.staff_id}>
                  {s.full_name}{s.employee_id ? ` (${s.employee_id})` : ''}{s.department ? ` · ${s.department}` : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Month</label>
            <select value={month} onChange={e => setMonth(Number(e.target.value))}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm">
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Year</label>
            <select value={year} onChange={e => setYear(Number(e.target.value))}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm">
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>
        <div className="mt-4">
          <button onClick={fetchSlip} disabled={loading || !staffId}
            className="flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white px-6 py-2.5 rounded-xl hover:from-emerald-600 hover:to-emerald-700 shadow-md shadow-emerald-200 font-medium text-sm disabled:opacity-50 transition-all">
            <Filter size={15} /> {loading ? 'Generating...' : 'Generate Slip'}
          </button>
        </div>
      </div>

      {/* Salary Slip Display */}
      {slip && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {/* Slip header */}
          <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 p-6 text-white flex items-center justify-between">
            <div>
              <p className="text-emerald-200 text-xs font-medium uppercase tracking-widest">Salary Slip</p>
              <h2 className="text-2xl font-bold mt-0.5">{MONTHS[slip.month - 1]} {slip.year}</h2>
            </div>
            <button onClick={printSlip}
              className="flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-xl transition font-medium text-sm">
              <Printer size={16} /> Print Slip
            </button>
          </div>

          {/* Employee Info */}
          <div className="p-6 border-b border-gray-100 bg-emerald-50/30">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center">
                <User size={22} className="text-emerald-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">{slip.staff.full_name}</h3>
                <p className="text-gray-500 text-sm">{slip.staff.position || '—'} &bull; {slip.staff.department || '—'}</p>
                {slip.staff.employee_id && <p className="text-xs text-gray-400 mt-0.5">ID: {slip.staff.employee_id}</p>}
              </div>
              <div className="ml-auto text-right">
                <p className="text-xs text-gray-400">Days in Month</p>
                <p className="text-2xl font-bold text-gray-700">{slip.days_in_month}</p>
                <p className="text-xs text-emerald-600">{slip.holidays} Holidays</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-gray-100">

            {/* Attendance */}
            <div className="p-6">
              <h4 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">Attendance</h4>
              <div className="space-y-0.5">
                <Row label="Present Days"    value={slip.present_days}          cls="text-emerald-600" />
                <Row label="Absent Days"     value={slip.absent_days}           cls="text-red-500" />
                <Row label="Half Days"       value={slip.half_days}             cls="text-yellow-600" />
                <Row label="Allowed Leaves"  value={slip.monthly_leave_allowed} cls="text-blue-600" />
                <Row label="Holidays"        value={slip.holidays}              cls="text-gray-600" />
                {slip.adjustment_days !== 0 && (
                  <Row label="Adjustment"
                    value={`${slip.adjustment_days > 0 ? '+' : ''}${slip.adjustment_days} days`}
                    cls={slip.adjustment_days > 0 ? 'text-emerald-600' : 'text-red-500'} />
                )}
                <div className="pt-2 mt-2 border-t border-gray-100 flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-700">Total Payable Days</span>
                  <span className="font-bold text-emerald-700 text-lg">{slip.total_attendance}</span>
                </div>
                <Row label="Daily Rate" value={`${currency}${fmt(slip.daily_rate)}`} cls="text-gray-600" />
              </div>
            </div>

            {/* Earnings */}
            <div className="p-6">
              <h4 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">Earnings</h4>
              <div className="space-y-0.5">
                <Row label="Basic Salary"  value={`${currency}${fmt(slip.basic_salary)}`}  cls="text-gray-700" />
                <Row label="Earned Salary" value={`${currency}${fmt(slip.earned_salary)}`} cls="text-emerald-600" />
                {(slip.allowance_items || []).map((a: any) => (
                  <Row key={a.name} label={`+ ${a.name}`} value={`+${currency}${fmt(a.value)}`} cls="text-blue-600" />
                ))}
              </div>
              <div className="mt-3 pt-3 border-t-2 border-emerald-200 flex items-center justify-between">
                <span className="font-bold text-gray-800">Gross Salary</span>
                <span className="font-bold text-emerald-700 text-lg">{currency}{fmt(slip.gross_salary)}</span>
              </div>
            </div>

            {/* Deductions + Net */}
            <div className="p-6">
              <h4 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">Deductions</h4>
              <div className="space-y-0.5">
                {(slip.deduction_items || []).map((d: any) => (
                  <Row key={d.name} label={`- ${d.name}`} value={`-${currency}${fmt(d.value)}`} cls="text-red-500" />
                ))}
                {slip.account_deduction > 0 && (
                  <Row
                    label={slip.staff.salary_account_name || 'Account Deduction'}
                    value={`-${currency}${fmt(slip.account_deduction)}`}
                    cls="text-red-500"
                  />
                )}
                {slip.total_comp_deductions === 0 && slip.account_deduction === 0 && (
                  <p className="text-xs text-gray-400 py-2">No deductions this month</p>
                )}
              </div>

              <div className="mt-4 bg-emerald-50 border-2 border-emerald-200 rounded-xl p-4 flex items-center justify-between">
                <span className="font-bold text-emerald-800">NET PAY</span>
                <span className="font-bold text-emerald-700 text-2xl">{currency}{fmt(slip.net_pay)}</span>
              </div>
            </div>
          </div>

          {/* Signature area */}
          <div className="px-6 py-4 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-3 gap-8 bg-gray-50/60">
            {['Prepared By', 'Approved By', 'Employee Signature'].map(label => (
              <div key={label} className="text-center">
                <div className="border-t-2 border-gray-300 pt-2 mt-8">
                  <p className="text-xs text-gray-400">{label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SalaryVoucher;
