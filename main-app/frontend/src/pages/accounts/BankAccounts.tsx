import { useState, useEffect } from 'react';
import { Building2, Plus, Edit, Trash2, X } from 'lucide-react';
import api from '../../utils/api';
import { useToast } from '../../components/Toast';

const BankAccountModal = ({ isOpen, onClose, onSuccess, bankAccount }: any) => {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    account_id: '',
    bank_name: '',
    account_number: '',
    account_holder: '',
    branch: '',
    ifsc_code: '',
    opening_balance: '0'
  });

  useEffect(() => {
    if (isOpen) {
      // Fetch bank-type accounts
      api.get('/accounting/accounts', { params: { type: 'asset', limit: 200 } })
        .then(r => setAccounts(r.data.data || []))
        .catch(() => {});
    }
    if (bankAccount) {
      setFormData({
        account_id: bankAccount.account_id || '',
        bank_name: bankAccount.bank_name || '',
        account_number: bankAccount.account_number || '',
        account_holder: bankAccount.account_holder || '',
        branch: bankAccount.branch || '',
        ifsc_code: bankAccount.ifsc_code || '',
        opening_balance: '0'
      });
    } else {
      setFormData({ account_id: '', bank_name: '', account_number: '', account_holder: '', branch: '', ifsc_code: '', opening_balance: '0' });
    }
  }, [isOpen, bankAccount]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.bank_name || !formData.account_number || !formData.account_id) {
      toast.error('Please fill all required fields');
      return;
    }

    setLoading(true);
    try {
      if (bankAccount) {
        await api.put(`/accounting/bank-accounts/${bankAccount.bank_account_id}`, formData);
        toast.success('Bank account updated');
      } else {
        await api.post('/accounting/bank-accounts', formData);
        toast.success('Bank account created');
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Operation failed');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-base font-semibold text-gray-800">{bankAccount ? 'Edit Bank Account' : 'Add Bank Account'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Linked Account *</label>
              <select value={formData.account_id} onChange={(e) => setFormData({ ...formData, account_id: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500" required disabled={!!bankAccount}>
                <option value="">Select Account</option>
                {accounts.filter(a => a.account_name.toLowerCase().includes('bank')).map(a => (
                  <option key={a.account_id} value={a.account_id}>{a.account_code} - {a.account_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Bank Name *</label>
              <input type="text" value={formData.bank_name}
                onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500"
                placeholder="e.g., HBL, MCB" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Account Number *</label>
              <input type="text" value={formData.account_number}
                onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500"
                placeholder="e.g., 1234567890" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Account Holder</label>
              <input type="text" value={formData.account_holder}
                onChange={(e) => setFormData({ ...formData, account_holder: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500"
                placeholder="e.g., John Doe" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Branch</label>
              <input type="text" value={formData.branch}
                onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500"
                placeholder="e.g., Main Branch" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">IFSC/Swift Code</label>
              <input type="text" value={formData.ifsc_code}
                onChange={(e) => setFormData({ ...formData, ifsc_code: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500"
                placeholder="e.g., HBBL0012345" />
            </div>
            {!bankAccount && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Opening Balance</label>
                <input type="number" step="0.01" value={formData.opening_balance}
                  onChange={(e) => setFormData({ ...formData, opening_balance: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  placeholder="0.00" />
              </div>
            )}
          </div>

          <div className="flex gap-3 mt-6">
            <button type="button" onClick={onClose} disabled={loading}
              className="flex-1 px-6 py-3 border border-gray-300 rounded-xl hover:bg-gray-50 font-medium transition">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 bg-emerald-600 text-white px-6 py-3 rounded-xl hover:bg-emerald-700 font-medium transition disabled:bg-gray-400">
              {loading ? 'Saving...' : bankAccount ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const BankAccounts = () => {
  const toast = useToast();
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<any>(null);

  const fetchBankAccounts = async () => {
    setLoading(true);
    try {
      const res = await api.get('/accounting/bank-accounts');
      setBankAccounts(res.data.data || []);
    } catch (err) {
      toast.error('Failed to fetch bank accounts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchBankAccounts(); }, []);

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this bank account?')) return;
    try {
      await api.delete(`/accounting/bank-accounts/${id}`);
      toast.success('Bank account deleted');
      fetchBankAccounts();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Delete failed');
    }
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Building2 className="text-emerald-600" size={20} />
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-gray-900">Bank Accounts</h1>
            <p className="text-gray-600 text-sm mt-1">Manage your bank accounts</p>
          </div>
        </div>
        <button onClick={() => { setSelectedAccount(null); setShowModal(true); }}
          className="flex items-center gap-2 bg-emerald-600 text-white px-6 py-3 rounded-xl hover:bg-emerald-700 transition shadow-lg">
          <Plus size={20} /> Add Bank Account
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : bankAccounts.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
          <Building2 className="mx-auto text-gray-300 mb-4" size={64} />
          <h3 className="text-xl font-semibold text-gray-700 mb-2">No Bank Accounts</h3>
          <p className="text-gray-500 mb-6">Get started by adding your first bank account</p>
          <button onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 bg-emerald-600 text-white px-6 py-3 rounded-xl hover:bg-emerald-700 transition">
            <Plus size={20} /> Add Bank Account
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Bank Name</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Account Number</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Account Holder</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Branch</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Current Balance</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Status</th>
                  <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {bankAccounts.map((account) => (
                  <tr key={account.bank_account_id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-800">{account.bank_name}</div>
                      <div className="text-xs text-gray-500">{account.account_code} - {account.account_name}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{account.account_number}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{account.account_holder || '-'}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{account.branch || '-'}</td>
                    <td className="px-6 py-4">
                      <span className="font-semibold text-gray-800">Rs. {Number(account.current_balance).toFixed(0)}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${account.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                        {account.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => { setSelectedAccount(account); setShowModal(true); }}
                          className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition">
                          <Edit size={18} />
                        </button>
                        <button onClick={() => handleDelete(account.bank_account_id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition">
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <BankAccountModal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setSelectedAccount(null); }}
        onSuccess={fetchBankAccounts}
        bankAccount={selectedAccount}
      />
    </div>
  );
};

export default BankAccounts;
