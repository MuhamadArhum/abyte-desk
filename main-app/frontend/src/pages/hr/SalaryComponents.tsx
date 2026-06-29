import { useState, useEffect } from 'react';
import { useSettings } from '../../context/SettingsContext';
import { Sliders, Plus, Pencil, Trash2, TrendingUp, TrendingDown } from 'lucide-react';
import { motion } from 'framer-motion';
import api from '../../utils/api';
import { useToast } from '../../components/Toast';
import { useConfirm } from '../../components/ConfirmDialog';
import ModalWrapper from '../../components/ModalWrapper';

const ComponentModal = ({ comp, onClose, onSuccess }: { comp: any | null; onClose: () => void; onSuccess: () => void }) => {
  const toast = useToast();
  const [form, setForm] = useState({
    name: comp?.name || '',
    type: comp?.type || 'allowance',
    calculation: comp?.calculation || 'fixed',
    default_value: comp?.default_value ?? 0,
    is_taxable: comp?.is_taxable ? true : false,
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Component name required'); return; }
    setLoading(true);
    try {
      if (comp) {
        await api.put(`/staff/salary-components/${comp.component_id}`, form);
        toast.success('Component updated');
      } else {
        await api.post('/staff/salary-components', form);
        toast.success('Component created');
      }
      onSuccess(); onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save');
    } finally { setLoading(false); }
  };

  return (
    <ModalWrapper onClose={onClose}>
      <div className="bg-gradient-to-r from-violet-500 to-violet-600 p-6 rounded-t-2xl">
        <h2 className="text-base font-semibold text-white">{comp ? 'Edit Component' : 'New Salary Component'}</h2>
        <p className="text-violet-100 text-xs mt-0.5">{comp ? 'Update component details' : 'Add an allowance or deduction component'}</p>
      </div>
      <div className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Component Name *</label>
            <input autoFocus value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 bg-gray-50/50 outline-none transition" placeholder="e.g. House Rent Allowance" required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Type *</label>
              <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 bg-gray-50/50 outline-none transition">
                <option value="allowance">Allowance (+)</option>
                <option value="deduction">Deduction (-)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Calculation</label>
              <select value={form.calculation} onChange={e => setForm({ ...form, calculation: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 bg-gray-50/50 outline-none transition">
                <option value="fixed">Fixed Amount</option>
                <option value="percentage">% of Base Salary</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Default Value {form.calculation === 'percentage' ? '(%)' : '(Amount)'}
            </label>
            <input type="number" min={0} step="0.01" value={form.default_value}
              onChange={e => setForm({ ...form, default_value: Number(e.target.value) })}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 bg-gray-50/50 outline-none transition" />
          </div>
          <label className="flex items-center gap-2 cursor-pointer p-3 bg-violet-50 rounded-xl border border-violet-100">
            <input type="checkbox" checked={form.is_taxable} onChange={e => setForm({ ...form, is_taxable: e.target.checked })}
              className="w-4 h-4 rounded text-violet-600" />
            <span className="text-sm text-gray-700 font-medium">Taxable component</span>
          </label>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50 transition">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 px-4 py-2.5 bg-gradient-to-r from-violet-500 to-violet-600 text-white rounded-xl text-sm font-semibold hover:from-violet-600 hover:to-violet-700 disabled:opacity-50 transition">
              {loading ? 'Saving...' : comp ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </ModalWrapper>
  );
};

const SalaryComponents = () => {
  const { currencySymbol: currency } = useSettings();
  const toast = useToast();
  const confirm = useConfirm();
  const [components, setComponents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editComp, setEditComp] = useState<any>(null);

  useEffect(() => { fetchComponents(); }, []);

  const fetchComponents = async () => {
    setLoading(true);
    try {
      const res = await api.get('/staff/salary-components');
      setComponents(res.data.data || []);
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  };

  const handleDelete = async (comp: any) => {
    const ok = await confirm({ title: 'Delete Component', message: `Delete "${comp.name}"?`, type: 'danger' });
    if (!ok) return;
    try {
      await api.delete(`/staff/salary-components/${comp.component_id}`);
      toast.success('Component deleted');
      fetchComponents();
    } catch (err: any) { toast.error(err.response?.data?.message || 'Failed to delete'); }
  };

  const allowances = components.filter(c => c.type === 'allowance');
  const deductions = components.filter(c => c.type === 'deduction');

  const renderGroup = (items: any[], type: 'allowance' | 'deduction') => (
    <div>
      <div className={`flex items-center gap-2 mb-4 ${type === 'allowance' ? 'text-emerald-700' : 'text-red-700'}`}>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${type === 'allowance' ? 'bg-emerald-100' : 'bg-red-100'}`}>
          {type === 'allowance' ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
        </div>
        <h2 className="font-semibold">{type === 'allowance' ? 'Allowances' : 'Deductions'}</h2>
        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{items.length}</span>
      </div>
      <div className="space-y-3">
        {items.map((c, i) => (
          <motion.div
            key={c.component_id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07 }}
            className={`bg-white rounded-2xl border shadow-sm p-4 flex items-center justify-between hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 ${type === 'allowance' ? 'border-green-100' : 'border-red-100'}`}>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900 text-sm">{c.name}</span>
                {c.is_taxable ? (
                  <span className="inline-flex items-center gap-1 text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />Taxable
                  </span>
                ) : null}
                {!c.is_active ? (
                  <span className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />Inactive
                  </span>
                ) : null}
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                {c.calculation === 'percentage'
                  ? `${c.default_value}% of base salary`
                  : `${currency}${Number(c.default_value).toLocaleString()} fixed`}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => { setEditComp(c); setShowModal(true); }}
                className="p-2 text-gray-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-all"><Pencil size={14} /></button>
              <button onClick={() => handleDelete(c)}
                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"><Trash2 size={14} /></button>
            </div>
          </motion.div>
        ))}
        {items.length === 0 && <p className="text-sm text-gray-400 pl-1">No {type}s defined</p>}
      </div>
    </div>
  );

  return (
    <div className="p-8">
      {/* Gradient page header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-violet-50 via-white to-white border-b border-gray-100 px-8 py-6 -mx-8 -mt-8 mb-8">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=%2260%22 height=%2260%22 viewBox=%220 0 60 60%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cg fill=%22none%22 fill-rule=%22evenodd%22%3E%3Cg fill=%22%238b5cf6%22 fill-opacity=%221%22%3E%3Cpath d=%22M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-5" />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-violet-600 rounded-2xl flex items-center justify-center shadow-lg shadow-violet-200">
              <Sliders size={22} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Salary Components</h1>
              <p className="text-sm text-gray-500 mt-0.5">Allowances & deductions for payroll</p>
            </div>
          </div>
          <button onClick={() => { setEditComp(null); setShowModal(true); }}
            className="flex items-center gap-2 bg-gradient-to-r from-violet-500 to-violet-600 text-white px-5 py-2.5 rounded-xl hover:from-violet-600 hover:to-violet-700 shadow-md shadow-violet-200 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 font-medium text-sm">
            <Plus size={16} /> New Component
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3 animate-pulse">
              <div className="h-4 bg-gray-100 rounded w-1/3" />
              {[...Array(3)].map((__, j) => <div key={j} className="h-12 bg-gray-50 rounded-xl" />)}
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {renderGroup(allowances, 'allowance')}
          {renderGroup(deductions, 'deduction')}
        </div>
      )}

      {showModal && <ComponentModal comp={editComp} onClose={() => setShowModal(false)} onSuccess={fetchComponents} />}
    </div>
  );
};

export default SalaryComponents;
