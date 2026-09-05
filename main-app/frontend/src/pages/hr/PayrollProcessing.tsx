import { useState, useEffect, useRef } from 'react';
import { useSettings } from '../../context/SettingsContext';
import { DollarSign, Calendar, Play, Download, CheckCircle, Printer, Search, ChevronDown } from 'lucide-react';
import api from '../../utils/api';
import { localToday } from '../../utils/dateUtils';
import { useToast } from '../../components/Toast';
import { useConfirm } from '../../components/ConfirmDialog';

// Inline Level-4 account selector (same pattern as other vouchers)
const AccountSelector = ({ accounts, value, onChange }: { accounts: any[]; value: number | ''; onChange: (id: number | '') => void }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const level4 = accounts.filter(a => a.is_active && a.level === 4);
  const filtered = search ? level4.filter(a => `${a.account_code} ${a.account_name}`.toLowerCase().includes(search.toLowerCase())) : level4;
  const selected = level4.find(a => a.account_id === value);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  return (
    <div ref={ref} className="relative">
      <div onClick={() => { setOpen(o => !o); setTimeout(() => inputRef.current?.focus(), 50); }}
        className="w-full px-3 py-2.5 border border-gray-200 rounded-xl cursor-pointer flex items-center justify-between bg-white hover:border-emerald-400 transition text-sm">
        {selected ? <span className="text-gray-800">{selected.account_code} — {selected.account_name}</span>
          : <span className="text-gray-400">Select debit account (Level 4)...</span>}
        <ChevronDown size={14} className="text-gray-400 flex-shrink-0" />
      </div>
      {value !== '' && (
        <button type="button" onClick={e => { e.stopPropagation(); onChange(''); }}
          className="absolute right-8 top-1/2 -translate-y-1/2 text-gray-300 hover:text-red-400 text-xs">✕</button>
      )}
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-xl">
          <div className="p-2 border-b border-gray-100 flex items-center gap-2">
            <Search size={13} className="text-gray-400" />
            <input ref={inputRef} type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search account..." className="flex-1 text-sm outline-none" />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filtered.length === 0 ? <p className="p-3 text-xs text-gray-400 text-center">No accounts</p>
              : filtered.map(a => (
                <div key={a.account_id} onMouseDown={() => { onChange(a.account_id); setOpen(false); setSearch(''); }}
                  className="px-3 py-2 text-sm cursor-pointer hover:bg-emerald-50 flex items-center gap-2">
                  <span className="font-mono text-xs text-gray-400">{a.account_code}</span>
                  <span>{a.account_name}</span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
};

const PayrollProcessing = () => {
  const { currencySymbol: currency } = useSettings();
  const toast = useToast();
  const confirm = useConfirm();
  const [step, setStep] = useState<'setup' | 'preview' | 'processing' | 'complete'>('setup');
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    from_date: '',
    to_date: '',
    payment_date: localToday(),
    department: ''
  });
  const [debitAccountId, setDebitAccountId] = useState<number | ''>('');
  const [accounts, setAccounts] = useState<any[]>([]);

  const [preview, setPreview] = useState<any[]>([]);
  const [bonusInputs, setBonusInputs] = useState<Record<number, number>>({});
  const [totals, setTotals] = useState({ count: 0, total_base: 0, total_deductions: 0, total_net: 0 });
  const [departments, setDepartments] = useState<string[]>([]);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    fetchDepartments();
    // Fetch accounts for selector
    api.get('/accounting/accounts', { params: { tree: 1 } }).then(res => {
      const flat: any[] = [];
      const flatten = (nodes: any[]) => nodes.forEach(n => { flat.push(n); if (n.children) flatten(n.children); });
      flatten(res.data.data || []);
      setAccounts(flat);
    }).catch(() => { toast.error('Failed to load accounts list'); });
  }, []);

  const fetchDepartments = async () => {
    try {
      const res = await api.get('/staff', { params: { limit: 200 } });
      const depts = new Set<string>();
      res.data.data?.forEach((s: any) => { if (s.department) depts.add(s.department); });
      setDepartments(Array.from(depts).sort());
    } catch (err) {
      // department fetch failure is non-critical; payroll can still run without filter
    }
  };

  const handlePreview = async () => {
    if (!formData.from_date || !formData.to_date || !formData.payment_date) {
      toast.error('Please fill all required fields');
      return;
    }
    if (!debitAccountId) {
      toast.error('Please select a salary expense (debit) account');
      return;
    }
    if (formData.from_date > formData.to_date) {
      toast.error('From Date cannot be after To Date');
      return;
    }

    setLoading(true);
    try {
      const res = await api.get('/staff/payroll/preview', { params: formData });
      const previewData = res.data.preview || [];
      setPreview(previewData);
      const initBonus: Record<number, number> = {};
      previewData.forEach((p: any) => { initBonus[p.staff_id] = 0; });
      setBonusInputs(initBonus);
      setTotals(res.data.totals || { count: 0, total_base: 0, total_deductions: 0, total_net: 0 });
      setStep('preview');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to load preview');
    } finally {
      setLoading(false);
    }
  };

  const handleProcess = async () => {
    const ok = await confirm({ title: 'Process Payroll', message: `Process payroll for ${preview.length} staff members? Total amount: ${currency}${totals.total_net.toLocaleString()}`, type: 'warning' });
    if (!ok) return;

    setStep('processing');
    setLoading(true);

    try {
      const payments = preview.map(p => {
        const extraBonus = bonusInputs[p.staff_id] || 0;
        const totalBonus = (p.bonuses || 0) + extraBonus;
        return {
          staff_id: p.staff_id,
          payment_date: formData.payment_date,
          from_date: formData.from_date,
          to_date: formData.to_date,
          amount: p.base_salary,
          deductions: p.deductions,
          bonuses: totalBonus,
          net_amount: p.base_salary - p.deductions + totalBonus
        };
      });

      const res = await api.post('/staff/payroll/process', { payments, debit_account_id: debitAccountId });
      setResult(res.data);
      toast.success(res.data.message);
      setStep('complete');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to process payroll');
      setStep('preview');
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = () => {
    const headers = ['Employee ID', 'Name', 'Department', 'Position', 'Base Salary', 'Deductions', 'Bonuses', 'Net Amount'];
    const rows = preview.map(p => [
      p.employee_id || '',
      `"${p.full_name}"`,
      p.department || '',
      p.position || '',
      p.base_salary.toFixed(0),
      p.deductions.toFixed(0),
      p.bonuses.toFixed(0),
      p.net_amount.toFixed(0)
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `payroll_${formData.payment_date}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const totalBonusAdded = Object.values(bonusInputs).reduce((a, b) => a + (b || 0), 0);

  const printPayslip = (p: any) => {
    const bonus = bonusInputs[p.staff_id] || 0;
    const net = p.base_salary - p.deductions + (p.bonuses || 0) + bonus;
    const html = `<html><head><title>Payslip</title><style>
      body{font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:30px}
      h2{color:#16a34a;text-align:center}hr{border:1px solid #e5e7eb}
      table{width:100%;border-collapse:collapse}td{padding:8px 12px}
      .label{color:#6b7280;font-size:13px}.value{font-weight:600;text-align:right}
      .total{background:#f0fdf4;font-weight:700;font-size:15px;color:#16a34a}
      @media print{body{margin:0}}
    </style></head><body>
      <h2>Payslip</h2><hr>
      <p><b>Employee:</b> ${p.full_name}</p>
      <p><b>ID:</b> ${p.employee_id || '-'} &nbsp; <b>Dept:</b> ${p.department || '-'} &nbsp; <b>Position:</b> ${p.position || '-'}</p>
      <p><b>Period:</b> ${formData.from_date} to ${formData.to_date} &nbsp; <b>Payment Date:</b> ${formData.payment_date}</p>
      <hr>
      <table>
        <tr><td class="label">Base Salary</td><td class="value">${currency}${p.base_salary.toLocaleString()}</td></tr>
        ${p.bonuses > 0 ? `<tr><td class="label">Backend Bonuses</td><td class="value" style="color:#16a34a">+${currency}${p.bonuses.toLocaleString()}</td></tr>` : ''}
        ${bonus > 0 ? `<tr><td class="label">Additional Bonus</td><td class="value" style="color:#16a34a">+${currency}${bonus.toLocaleString()}</td></tr>` : ''}
        ${p.deductions > 0 ? `<tr><td class="label">Deductions</td><td class="value" style="color:#ef4444">-${currency}${p.deductions.toLocaleString()}</td></tr>` : ''}
        <tr class="total"><td>Net Payable</td><td class="value">${currency}${net.toLocaleString()}</td></tr>
      </table>
      <hr><p style="text-align:center;color:#9ca3af;font-size:12px">Generated by AByte ERP — ${new Date().toLocaleDateString()}</p>
    </body></html>`;
    const w = window.open('', '_blank', 'width=700,height=500');
    if (w) { w.document.write(html); w.document.close(); w.print(); }
  };

  const resetFlow = () => {
    setStep('setup');
    setPreview([]);
    setTotals({ count: 0, total_base: 0, total_deductions: 0, total_net: 0 });
    setResult(null);
  };

  const steps = ['setup', 'preview', 'processing', 'complete'];

  return (
    <div className="p-4 sm:p-6">
      {/* Gradient Page Header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-green-50 via-white to-white border-b border-gray-100 px-4 md:px-8 py-4 md:py-6 -mx-4 md:-mx-8 -mt-4 md:-mt-8 mb-6 md:mb-8">
        <div className="absolute inset-0 opacity-5 bg-[url('data:image/svg+xml,%3Csvg width=%2260%22 height=%2260%22 viewBox=%220 0 60 60%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cg fill=%22none%22 fill-rule=%22evenodd%22%3E%3Cg fill=%22%23000%22 fill-opacity=%221%22%3E%3Cpath d=%22M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z%22/%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E')]" />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-200">
              <DollarSign size={22} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Payroll Processing</h1>
              <p className="text-sm text-gray-500 mt-0.5">Process monthly payroll</p>
            </div>
          </div>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 md:p-6 mb-6 md:mb-8">
        <div className="flex items-center justify-between">
          {steps.map((s, idx) => (
            <div key={s} className="flex items-center">
              <div className={`flex items-center gap-1.5 md:gap-2 ${step === s ? 'text-emerald-600' : idx < steps.indexOf(step) ? 'text-emerald-600' : 'text-gray-400'}`}>
                <div className={`w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center font-semibold text-sm ${step === s ? 'bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-md shadow-emerald-200' : idx < steps.indexOf(step) ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                  {idx + 1}
                </div>
                <span className="font-medium capitalize hidden sm:inline text-sm">{s}</span>
              </div>
              {idx < 3 && <div className={`w-6 md:w-16 h-1 mx-1 md:mx-4 rounded-full ${idx < steps.indexOf(step) ? 'bg-green-400' : 'bg-gray-200'}`}></div>}
            </div>
          ))}
        </div>
      </div>

      {/* Step 1: Setup */}
      {step === 'setup' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
          <h2 className="text-base font-semibold text-gray-800 mb-6 flex items-center gap-2">
            <span className="w-6 h-6 bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center text-xs font-bold">1</span>
            Payroll Configuration
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">From Date *</label>
              <input type="date" value={formData.from_date} onChange={(e) => setFormData({ ...formData, from_date: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">To Date *</label>
              <input type="date" value={formData.to_date} onChange={(e) => setFormData({ ...formData, to_date: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Payment Date *</label>
              <input type="date" value={formData.payment_date} onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Department Filter</label>
              <select value={formData.department} onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition">
                <option value="">All Departments</option>
                {departments.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Salary Expense Account <span className="text-red-500">*</span>
                <span className="text-gray-400 font-normal ml-1">[DR] — Total salary will be debited here</span>
              </label>
              <AccountSelector accounts={accounts} value={debitAccountId} onChange={setDebitAccountId} />
            </div>
          </div>
          <div className="flex justify-end mt-8">
            <button onClick={handlePreview} disabled={loading}
              className="flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white px-8 py-3 rounded-xl hover:from-emerald-600 hover:to-emerald-700 shadow-md shadow-emerald-200 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 font-medium disabled:opacity-50 disabled:hover:translate-y-0">
              <Calendar size={18} /> {loading ? 'Loading...' : 'Generate Preview'}
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Preview */}
      {step === 'preview' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200">
              <p className="text-gray-500 text-sm font-medium">Total Staff</p>
              <p className="text-3xl font-bold text-gray-800 mt-2">{totals.count}</p>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200">
              <p className="text-gray-500 text-sm font-medium">Total Base Salary</p>
              <p className="text-3xl font-bold text-emerald-600 mt-2">{currency}{totals.total_base.toLocaleString()}</p>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200">
              <p className="text-gray-500 text-sm font-medium">Total Deductions</p>
              <p className="text-3xl font-bold text-red-500 mt-2">{currency}{totals.total_deductions.toLocaleString()}</p>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200">
              <p className="text-gray-500 text-sm font-medium">Total Net Payable</p>
              <p className="text-3xl font-bold text-emerald-600 mt-2">{currency}{(totals.total_net + totalBonusAdded).toLocaleString()}</p>
              {totalBonusAdded > 0 && <p className="text-xs text-green-500 mt-1">+{currency}{totalBonusAdded.toLocaleString()} bonus added</p>}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-6">
            <div className="px-6 py-4 bg-gradient-to-r from-green-50 to-white border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-gray-800">Payroll Preview <span className="text-emerald-600">({preview.length} staff)</span></h3>
              <button onClick={exportCSV} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 px-3 py-1.5 rounded-lg transition">
                <Download size={15} /> Export CSV
              </button>
            </div>
            <div className="max-h-96 overflow-y-auto overflow-x-auto">
              <table className="w-full min-w-[600px]">
                <thead className="bg-gray-50 sticky top-0">
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Employee</th>
                    <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Base Salary</th>
                    <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Deductions</th>
                    <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Bonuses</th>
                    <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Net Amount</th>
                    <th className="px-6 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((p: any) => (
                    <tr key={p.staff_id} className="border-b border-gray-50 hover:bg-emerald-50/20 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-gray-800">{p.full_name}</div>
                        <div className="text-xs text-gray-400 mt-0.5">{p.employee_id || ''} {p.department ? `- ${p.department}` : ''}</div>
                      </td>
                      <td className="px-6 py-4 text-right font-medium text-gray-700">{currency}{p.base_salary.toLocaleString()}</td>
                      <td className="px-6 py-4 text-right font-medium text-red-500">{p.deductions > 0 ? `-${currency}${p.deductions.toLocaleString()}` : '-'}</td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <span className="text-gray-400 text-xs">{currency}</span>
                          <input
                            type="number" min={0}
                            value={bonusInputs[p.staff_id] ?? 0}
                            onChange={e => setBonusInputs(prev => ({ ...prev, [p.staff_id]: Math.max(0, Number(e.target.value)) }))}
                            className="w-24 px-2 py-1 text-right border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-400 focus:border-transparent outline-none"
                          />
                        </div>
                        {p.bonuses > 0 && <div className="text-xs text-green-500 text-right mt-0.5">+{currency}{p.bonuses.toLocaleString()} (backend)</div>}
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-emerald-600">
                        {currency}{(p.base_salary - p.deductions + (p.bonuses || 0) + (bonusInputs[p.staff_id] || 0)).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button onClick={() => printPayslip(p)} title="Print Payslip"
                          className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition">
                          <Printer size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex gap-4 justify-between">
            <button onClick={resetFlow}
              className="px-8 py-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition text-gray-600 font-medium">
              Back
            </button>
            <button onClick={handleProcess} disabled={loading || preview.length === 0}
              className="flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white px-8 py-3 rounded-xl hover:from-emerald-600 hover:to-emerald-700 shadow-md shadow-emerald-200 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 font-medium disabled:opacity-50 disabled:hover:translate-y-0">
              <Play size={18} /> Process Payroll
            </button>
          </div>
        </>
      )}

      {/* Step 3: Processing */}
      {step === 'processing' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
          <div className="animate-spin w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full mx-auto mb-6"></div>
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Processing Payroll...</h3>
          <p className="text-gray-500">Please wait while we process salary payments.</p>
        </div>
      )}

      {/* Step 4: Complete */}
      {step === 'complete' && result && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="text-emerald-600 w-12 h-12" />
          </div>
          <h3 className="text-xl font-bold text-gray-800 mb-2">Payroll Processed Successfully!</h3>
          <p className="text-gray-500 mb-8">All salary payments have been recorded.</p>
          <div className="text-left max-w-md mx-auto bg-emerald-50 border border-green-100 rounded-2xl p-6 mb-8">
            <p className="text-gray-700 mb-2 flex items-center gap-2">
              <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
              <span className="font-semibold">Successful Payments:</span> {result.successCount}
            </p>
            {result.errors && result.errors.length > 0 && (
              <p className="text-red-600 flex items-center gap-2">
                <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                <span className="font-semibold">Errors:</span> {result.errors.length}
              </p>
            )}
          </div>
          <button onClick={resetFlow}
            className="flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white px-8 py-3 rounded-xl hover:from-emerald-600 hover:to-emerald-700 shadow-md shadow-emerald-200 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 font-medium mx-auto">
            Process New Payroll
          </button>
        </div>
      )}
    </div>
  );
};

export default PayrollProcessing;
