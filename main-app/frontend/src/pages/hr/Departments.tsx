import { useState, useEffect } from 'react';
import { Building2, Plus, Pencil, Trash2, Users, Briefcase } from 'lucide-react';
import { motion } from 'framer-motion';
import api from '../../utils/api';
import { useToast } from '../../components/Toast';
import { useConfirm } from '../../components/ConfirmDialog';
import { SkeletonCards } from '../../components/Skeleton';
import ModalWrapper from '../../components/ModalWrapper';

// ── Department Modal ──────────────────────────────────────────────────────────
const DeptModal = ({ dept, onClose, onSuccess }: { dept: any | null; onClose: () => void; onSuccess: () => void }) => {
  const toast = useToast();
  const [form, setForm] = useState({ name: dept?.name || '', description: dept?.description || '', head_of_dept: dept?.head_of_dept || '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Department name required'); return; }
    setLoading(true);
    try {
      if (dept) await api.put(`/staff/departments/${dept.department_id}`, form);
      else       await api.post('/staff/departments', form);
      toast.success(dept ? 'Department updated' : 'Department created');
      onSuccess(); onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save');
    } finally { setLoading(false); }
  };

  return (
    <ModalWrapper onClose={onClose}>
      <div className="bg-gradient-to-r from-cyan-500 to-cyan-600 p-6 rounded-t-2xl">
        <h2 className="text-base font-semibold text-white">{dept ? 'Edit Department' : 'New Department'}</h2>
        <p className="text-cyan-100 text-xs mt-0.5">{dept ? 'Update department details' : 'Add a new department'}</p>
      </div>
      <div className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Name *</label>
            <input autoFocus value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-400 bg-gray-50/50 outline-none transition" placeholder="e.g. Sales" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Head of Department</label>
            <input value={form.head_of_dept} onChange={e => setForm({ ...form, head_of_dept: e.target.value })}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-400 bg-gray-50/50 outline-none transition" placeholder="Manager name" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-400 bg-gray-50/50 outline-none transition resize-none" rows={2} />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50 transition">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-cyan-600 text-white rounded-xl text-sm font-semibold hover:from-cyan-600 hover:to-cyan-700 disabled:opacity-50 transition">
              {loading ? 'Saving...' : dept ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </ModalWrapper>
  );
};

// ── Designation Modal ─────────────────────────────────────────────────────────
const DesigModal = ({ desig, departments, onClose, onSuccess }: { desig: any | null; departments: any[]; onClose: () => void; onSuccess: () => void }) => {
  const toast = useToast();
  const [form, setForm] = useState({
    name: desig?.name || '',
    department_id: desig?.department_id?.toString() || '',
    description: desig?.description || '',
    is_active: desig?.is_active ?? 1,
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Designation name required'); return; }
    setLoading(true);
    try {
      const payload = { ...form, department_id: form.department_id ? parseInt(form.department_id) : null };
      if (desig) await api.put(`/staff/designations/${desig.designation_id}`, payload);
      else       await api.post('/staff/designations', payload);
      toast.success(desig ? 'Designation updated' : 'Designation created');
      onSuccess(); onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save');
    } finally { setLoading(false); }
  };

  return (
    <ModalWrapper onClose={onClose}>
      <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 p-6 rounded-t-2xl">
        <h2 className="text-base font-semibold text-white">{desig ? 'Edit Designation' : 'New Designation'}</h2>
        <p className="text-emerald-100 text-xs mt-0.5">{desig ? 'Update designation details' : 'Add a new job designation / position'}</p>
      </div>
      <div className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Designation Name *</label>
            <input autoFocus value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 bg-gray-50/50 outline-none transition" placeholder="e.g. Sales Manager" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Department</label>
            <select value={form.department_id} onChange={e => setForm({ ...form, department_id: e.target.value })}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 bg-gray-50/50 outline-none transition">
              <option value="">-- All Departments --</option>
              {departments.map(d => <option key={d.department_id} value={d.department_id}>{d.name}</option>)}
            </select>
            <p className="text-xs text-gray-400 mt-1">Link to a department to filter designations in the employee form</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 bg-gray-50/50 outline-none transition resize-none" rows={2} />
          </div>
          {desig && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Status</label>
              <select value={form.is_active} onChange={e => setForm({ ...form, is_active: parseInt(e.target.value) })}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 bg-gray-50/50 outline-none transition">
                <option value={1}>Active</option>
                <option value={0}>Inactive</option>
              </select>
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50 transition">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl text-sm font-semibold hover:from-emerald-600 hover:to-emerald-700 disabled:opacity-50 transition">
              {loading ? 'Saving...' : desig ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </ModalWrapper>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────
const Departments = () => {
  const toast = useToast();
  const confirm = useConfirm();
  const [activeTab, setActiveTab] = useState<'departments' | 'designations'>('departments');

  const [depts, setDepts]           = useState<any[]>([]);
  const [desigs, setDesigs]         = useState<any[]>([]);
  const [staffCounts, setStaffCounts] = useState<Record<string, number>>({});
  const [loading, setLoading]       = useState(true);

  const [showDeptModal, setShowDeptModal]   = useState(false);
  const [editDept, setEditDept]             = useState<any>(null);
  const [showDesigModal, setShowDesigModal] = useState(false);
  const [editDesig, setEditDesig]           = useState<any>(null);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [dRes, sRes, desigRes] = await Promise.all([
        api.get('/staff/departments'),
        api.get('/staff', { params: { limit: 500 } }),
        api.get('/staff/designations'),
      ]);
      setDepts(dRes.data.data || []);
      setDesigs(desigRes.data.data || []);
      const counts: Record<string, number> = {};
      for (const s of sRes.data.data || []) {
        if (s.department) counts[s.department] = (counts[s.department] || 0) + 1;
      }
      setStaffCounts(counts);
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  };

  const handleDeleteDept = async (dept: any) => {
    const ok = await confirm({ title: 'Delete Department', message: `Delete department "${dept.name}"?`, type: 'danger' });
    if (!ok) return;
    try {
      await api.delete(`/staff/departments/${dept.department_id}`);
      toast.success('Department deleted');
      fetchAll();
    } catch (err: any) { toast.error(err.response?.data?.message || 'Failed to delete'); }
  };

  const handleDeleteDesig = async (desig: any) => {
    const ok = await confirm({ title: 'Delete Designation', message: `Delete designation "${desig.name}"?`, type: 'danger' });
    if (!ok) return;
    try {
      await api.delete(`/staff/designations/${desig.designation_id}`);
      toast.success('Designation deleted');
      fetchAll();
    } catch (err: any) { toast.error(err.response?.data?.message || 'Failed to delete'); }
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-cyan-50 via-white to-white border-b border-gray-100 px-8 py-6 -mx-8 -mt-8 mb-8">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=%2260%22 height=%2260%22 viewBox=%220 0 60 60%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cg fill=%22none%22 fill-rule=%22evenodd%22%3E%3Cg fill=%22%2306b6d4%22 fill-opacity=%221%22%3E%3Cpath d=%22M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-5" />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-2xl flex items-center justify-center shadow-lg shadow-cyan-200">
              <Building2 size={22} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">HR Configuration</h1>
              <p className="text-sm text-gray-500 mt-0.5">Manage departments and designations</p>
            </div>
          </div>
          <button
            onClick={() => {
              if (activeTab === 'departments') { setEditDept(null); setShowDeptModal(true); }
              else { setEditDesig(null); setShowDesigModal(true); }
            }}
            className="flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-cyan-600 text-white px-5 py-2.5 rounded-xl hover:from-cyan-600 hover:to-cyan-700 shadow-md shadow-cyan-200 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 font-medium text-sm">
            <Plus size={16} /> {activeTab === 'departments' ? 'New Department' : 'New Designation'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6 w-fit">
        <button
          onClick={() => setActiveTab('departments')}
          className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'departments' ? 'bg-white text-cyan-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
          <Building2 size={15} /> Departments
        </button>
        <button
          onClick={() => setActiveTab('designations')}
          className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'designations' ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
          <Briefcase size={15} /> Designations
        </button>
      </div>

      {loading ? (
        <SkeletonCards count={6} />
      ) : activeTab === 'departments' ? (
        /* ── Departments Grid ── */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {depts.map((d, i) => (
            <motion.div key={d.department_id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-3 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-cyan-50 rounded-xl flex items-center justify-center">
                    <Building2 size={18} className="text-cyan-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{d.name}</h3>
                    {d.head_of_dept && <p className="text-xs text-gray-500 mt-0.5">Head: {d.head_of_dept}</p>}
                  </div>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${d.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                  {d.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
              {d.description && <p className="text-sm text-gray-500">{d.description}</p>}
              <div className="flex items-center gap-1.5 text-sm text-cyan-700 font-medium bg-cyan-50 rounded-lg px-3 py-1.5 w-fit">
                <Users size={14} /> {staffCounts[d.name] || 0} staff
              </div>
              <div className="flex gap-2 pt-1 border-t border-gray-100">
                <button onClick={() => { setEditDept(d); setShowDeptModal(true); }}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-sm text-gray-600 hover:bg-cyan-50 hover:text-cyan-700 rounded-lg transition-all">
                  <Pencil size={14} /> Edit
                </button>
                <button onClick={() => handleDeleteDept(d)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-sm text-red-500 hover:bg-red-50 rounded-lg transition-all">
                  <Trash2 size={14} /> Delete
                </button>
              </div>
            </motion.div>
          ))}
          {depts.length === 0 && (
            <div className="col-span-3 text-center py-16 text-gray-400">
              <Building2 size={40} className="mx-auto mb-3 opacity-30" />
              <p>No departments yet. Create one to get started.</p>
            </div>
          )}
        </div>
      ) : (
        /* ── Designations Table ── */
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-5 py-3 font-semibold text-gray-600">Designation</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-600">Department</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-600">Description</th>
                <th className="text-center px-5 py-3 font-semibold text-gray-600">Status</th>
                <th className="text-center px-5 py-3 font-semibold text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {desigs.map((d, i) => (
                <motion.tr key={d.designation_id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                  className="hover:bg-gray-50 transition">
                  <td className="px-5 py-3 font-semibold text-gray-800">
                    <div className="flex items-center gap-2">
                      <Briefcase size={14} className="text-emerald-500" />
                      {d.name}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-gray-500">{d.department_name || <span className="text-gray-300 italic">All departments</span>}</td>
                  <td className="px-5 py-3 text-gray-400 text-xs max-w-xs truncate">{d.description || '-'}</td>
                  <td className="px-5 py-3 text-center">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${d.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                      {d.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <button onClick={() => { setEditDesig(d); setShowDesigModal(true); }}
                        className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition">
                        <Pencil size={15} />
                      </button>
                      <button onClick={() => handleDeleteDesig(d)}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
              {desigs.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-gray-400">
                    <Briefcase size={36} className="mx-auto mb-3 opacity-20" />
                    <p>No designations yet. Create one to use in the employee form.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showDeptModal  && <DeptModal  dept={editDept}   onClose={() => { setShowDeptModal(false);  setEditDept(null);  }} onSuccess={fetchAll} />}
      {showDesigModal && <DesigModal desig={editDesig} departments={depts} onClose={() => { setShowDesigModal(false); setEditDesig(null); }} onSuccess={fetchAll} />}
    </div>
  );
};

export default Departments;
