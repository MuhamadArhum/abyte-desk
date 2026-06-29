import { useState, useEffect } from 'react';
import { BookOpen, Save, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';
import api from '../../utils/api';
import { useToast } from '../../components/Toast';
import { useConfirm } from '../../components/ConfirmDialog';

const LEAVE_TYPES = [
  { key: 'annual', label: 'Annual Leave',  color: 'bg-blue-50 border-blue-200',   accent: 'text-blue-700',  dot: 'bg-blue-500',  icon: 'bg-blue-100 text-blue-600' },
  { key: 'sick',   label: 'Sick Leave',    color: 'bg-red-50 border-red-200',     accent: 'text-red-700',   dot: 'bg-red-500',   icon: 'bg-red-100 text-red-600' },
  { key: 'casual', label: 'Casual Leave',  color: 'bg-amber-50 border-amber-200', accent: 'text-amber-700', dot: 'bg-amber-500', icon: 'bg-amber-100 text-amber-600' },
  { key: 'unpaid', label: 'Unpaid Leave',  color: 'bg-gray-50 border-gray-200',   accent: 'text-gray-700',  dot: 'bg-gray-400',  icon: 'bg-gray-100 text-gray-600' },
];

const LeavePolicies = () => {
  const toast = useToast();
  const confirm = useConfirm();
  const [policies, setPolicies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<number | null>(null);  // B-035: policy_id is number
  const [carrying, setCarrying] = useState(false);
  const [edited, setEdited] = useState<Record<number, any>>({});

  useEffect(() => { fetchPolicies(); }, []);

  const fetchPolicies = async () => {
    setLoading(true);
    try {
      const res = await api.get('/staff/leave-policies');
      setPolicies(res.data.data || []);
    } catch { toast.error('Failed to load leave policies'); }
    finally { setLoading(false); }
  };

  const handleChange = (id: number, field: string, value: any) => {
    setEdited(prev => ({
      ...prev,
      [id]: { ...(prev[id] || {}), [field]: value }
    }));
  };

  const getVal = (policy: any, field: string) => {
    return edited[policy.policy_id]?.[field] ?? policy[field];
  };

  const handleSave = async (policy: any) => {
    const changes = edited[policy.policy_id];
    if (!changes) return;
    setSaving(policy.policy_id);
    try {
      // B-007: URL must use leave_type (backend route is /leave-policies/:leave_type)
      // B-007: field must be carry_forward_allowed (matches backend column name)
      await api.put(`/staff/leave-policies/${policy.leave_type}`, {
        annual_entitlement: getVal(policy, 'annual_entitlement'),
        carry_forward_allowed: getVal(policy, 'carry_forward_allowed'),
        max_carry_forward: getVal(policy, 'max_carry_forward'),
      });
      toast.success(`${policy.leave_type} policy updated`);
      setEdited(prev => { const n = { ...prev }; delete n[policy.policy_id]; return n; });
      fetchPolicies();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save');
    } finally { setSaving(null); }
  };

  const handleCarryForward = async () => {
    const ok = await confirm({ title: 'Run Year-End Carry-Forward', message: 'Run year-end carry-forward for all staff? This will update leave balances based on current policies.', type: 'warning' });
    if (!ok) return;
    setCarrying(true);
    try {
      const res = await api.post('/staff/leave-policies/carry-forward');
      toast.success(res.data.message || 'Carry-forward processed successfully');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to process carry-forward');
    } finally { setCarrying(false); }
  };

  const typeInfo = (leaveType: string) => LEAVE_TYPES.find(t => t.key === leaveType);

  return (
    <div className="p-8">
      {/* Gradient page header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-teal-50 via-white to-white border-b border-gray-100 px-8 py-6 -mx-8 -mt-8 mb-8">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=%2260%22 height=%2260%22 viewBox=%220 0 60 60%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cg fill=%22none%22 fill-rule=%22evenodd%22%3E%3Cg fill=%22%2314b8a6%22 fill-opacity=%221%22%3E%3Cpath d=%22M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-5" />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-teal-500 to-teal-600 rounded-2xl flex items-center justify-center shadow-lg shadow-teal-200">
              <BookOpen size={22} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Leave Policies</h1>
              <p className="text-sm text-gray-500 mt-0.5">Configure annual entitlements and carry-forward rules</p>
            </div>
          </div>
          <button
            onClick={handleCarryForward}
            disabled={carrying}
            className="flex items-center gap-2 bg-gradient-to-r from-teal-500 to-teal-600 text-white px-5 py-2.5 rounded-xl hover:from-teal-600 hover:to-teal-700 shadow-md shadow-teal-200 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
          >
            <RefreshCw size={16} className={carrying ? 'animate-spin' : ''} />
            {carrying ? 'Processing...' : 'Run Year-End Carry-Forward'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4 animate-pulse">
              <div className="h-5 bg-gray-100 rounded w-1/3" />
              <div className="h-10 bg-gray-50 rounded-xl" />
              <div className="h-14 bg-gray-50 rounded-xl" />
              <div className="h-10 bg-gray-50 rounded-xl" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {policies.map((policy, i) => {
            const info = typeInfo(policy.leave_type);
            const isDirty = !!edited[policy.policy_id];
            const carryEnabled = getVal(policy, 'carry_forward_allowed');
            return (
              <motion.div
                key={policy.policy_id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07, duration: 0.3 }}
                className={`bg-white rounded-2xl border-2 shadow-sm p-6 hover:shadow-md transition-all duration-200 ${info?.color || 'border-gray-200'}`}>
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${info?.icon || 'bg-gray-100 text-gray-600'}`}>
                      <BookOpen size={16} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 text-base capitalize">
                        {info?.label || policy.leave_type}
                      </h3>
                      <div className={`flex items-center gap-1 text-xs font-medium mt-0.5 ${info?.accent || 'text-gray-600'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${info?.dot || 'bg-gray-400'}`} />
                        {getVal(policy, 'annual_entitlement')} days/year
                      </div>
                    </div>
                  </div>
                  {isDirty && (
                    <button
                      onClick={() => handleSave(policy)}
                      disabled={saving === policy.policy_id}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-teal-500 to-teal-600 text-white rounded-lg text-xs font-semibold hover:from-teal-600 hover:to-teal-700 disabled:opacity-50 transition shadow-sm"
                    >
                      <Save size={13} />
                      {saving === policy.policy_id ? 'Saving...' : 'Save Changes'}
                    </button>
                  )}
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Annual Entitlement (days)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={365}
                      value={getVal(policy, 'annual_entitlement')}
                      onChange={e => handleChange(policy.policy_id, 'annual_entitlement', Number(e.target.value))}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 bg-gray-50/50 outline-none transition"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 bg-white/80 rounded-xl border border-gray-100">
                    <div>
                      <p className="text-sm font-medium text-gray-700">Allow Carry-Forward</p>
                      <p className="text-xs text-gray-400">Unused days roll over to next year</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!carryEnabled}
                        onChange={e => handleChange(policy.policy_id, 'carry_forward_allowed', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
                    </label>
                  </div>

                  {carryEnabled ? (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Max Carry-Forward Days
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={365}
                        value={getVal(policy, 'max_carry_forward')}
                        onChange={e => handleChange(policy.policy_id, 'max_carry_forward', Number(e.target.value))}
                        className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 bg-gray-50/50 outline-none transition"
                      />
                      <p className="text-xs text-gray-400 mt-1">Set 0 for unlimited carry-forward</p>
                    </div>
                  ) : (
                    <div className="p-3 bg-gray-50 rounded-xl text-sm text-gray-400 text-center border border-gray-100">
                      Unused leave will not carry forward
                    </div>
                  )}

                  <div className="pt-2 border-t border-gray-100 flex justify-between text-xs text-gray-400">
                    <span>Entitlement: <span className="font-semibold text-gray-600">{policy.annual_entitlement} days/yr</span></span>
                    <span>Max carry-forward: <span className="font-semibold text-gray-600">{policy.carry_forward_allowed ? (policy.max_carry_forward || 'Unlimited') : 'None'}</span></span>
                  </div>
                </div>
              </motion.div>
            );
          })}
          {policies.length === 0 && (
            <div className="col-span-2 text-center py-16 text-gray-400">
              <BookOpen size={40} className="mx-auto mb-3 opacity-30" />
              <p>No leave policies found. Run the HR migration first.</p>
            </div>
          )}
        </div>
      )}

      <div className="mt-8 bg-teal-50 border border-teal-200 rounded-2xl p-5">
        <h3 className="font-semibold text-teal-800 mb-2 flex items-center gap-2">
          <RefreshCw size={15} className="text-teal-600" />
          About Year-End Carry-Forward
        </h3>
        <ul className="text-sm text-teal-700 space-y-1 list-disc list-inside">
          <li>Run at the end of each leave year to roll unused leave balances to the next year</li>
          <li>For each staff member, unused days are added to their next-year balance (capped by Max Carry-Forward)</li>
          <li>Leave types with carry-forward disabled will have balances reset to the annual entitlement</li>
          <li>This action is logged in the system for audit purposes</li>
        </ul>
      </div>
    </div>
  );
};

export default LeavePolicies;
