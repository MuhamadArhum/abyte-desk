import { useState, useEffect, useMemo } from 'react';
import { useSettings } from '../../context/SettingsContext';
import { Plus, Eye, Edit, Trash2, User, Search, Filter, RotateCcw, TrendingUp } from 'lucide-react';
import Pagination from '../../components/Pagination';
import api from '../../utils/api';
import { useToast } from '../../components/Toast';
import { useConfirm } from '../../components/ConfirmDialog';
import AddStaffModal from '../../components/AddStaffModal';
import StaffDetailsModal from '../../components/StaffDetailsModal';
import SalaryIncrementModal from '../../components/SalaryIncrementModal';
import { SkeletonTable } from '../../components/Skeleton';
import EmptyState from '../../components/EmptyState';

const Staff = () => {
  const { currencySymbol: currency } = useSettings();
  const toast = useToast();
  const confirm = useConfirm();
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showIncrementModal, setShowIncrementModal] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<any>(null);
  const [staffToEdit, setStaffToEdit] = useState<any>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');

  // Extract unique departments from staff list
  const departments = useMemo(() => {
    const depts = new Set<string>();
    staff.forEach((s: any) => {
      if (s.department) depts.add(s.department);
    });
    return Array.from(depts).sort();
  }, [staff]);

  useEffect(() => {
    fetchStaff();
  }, [pagination.page, statusFilter, departmentFilter]);

  const fetchStaff = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: any = {
        page: pagination.page,
        limit: pagination.limit
      };

      if (statusFilter !== 'all') {
        params.is_active = statusFilter;
      }

      if (departmentFilter !== 'all') {
        params.department = departmentFilter;
      }

      if (searchTerm) {
        params.search = searchTerm;
      }

      const res = await api.get('/staff', { params });
      setStaff(res.data.data || []);
      if (res.data.pagination) {
        setPagination(res.data.pagination);
      }
    } catch (error) {
      setError('Failed to load staff. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setPagination({ ...pagination, page: 1 });
    fetchStaff();
  };

  const handleViewDetails = (staffMember: any) => {
    setSelectedStaff(staffMember);
    setShowDetailsModal(true);
  };

  const handleEdit = (staffMember: any) => {
    setStaffToEdit(staffMember);
    setShowAddModal(true);
  };

  const handleDelete = async (staffId: number, name: string) => {
    const ok = await confirm({ title: 'Deactivate Staff', message: `Are you sure you want to deactivate ${name}?`, type: 'danger' });
    if (!ok) return;

    try {
      await api.delete(`/staff/${staffId}`);
      toast.success('Staff member deactivated successfully');
      fetchStaff();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to deactivate staff member');
    }
  };

  const handleReactivate = async (staffId: number, name: string) => {
    const ok = await confirm({ title: 'Reactivate Staff', message: `Reactivate ${name}?`, type: 'warning' });
    if (!ok) return;

    try {
      await api.put(`/staff/${staffId}`, { is_active: 1 });
      toast.success(`${name} has been reactivated`);
      fetchStaff();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to reactivate staff member');
    }
  };

  return (
    <div className="p-4 sm:p-6">
      {/* Gradient Header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-emerald-50 via-white to-white border-b border-gray-100 px-4 sm:px-8 py-4 sm:py-6 -mx-4 sm:-mx-6 -mt-4 sm:-mt-6 mb-6 sm:mb-8">
        <div className="absolute inset-0 opacity-5 bg-[url('data:image/svg+xml,%3Csvg width=%2260%22 height=%2260%22 viewBox=%220 0 60 60%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cg fill=%22none%22 fill-rule=%22evenodd%22%3E%3Cg fill=%22%23000%22 fill-opacity=%221%22%3E%3Cpath d=%22M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')]" />
        <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-200">
              <User size={22} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Staff Management</h1>
              <p className="text-sm text-gray-500 mt-0.5">Manage your team members</p>
            </div>
          </div>
          <button
            onClick={() => {
              setStaffToEdit(null);
              setShowAddModal(true);
            }}
            className="flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white px-5 py-2.5 rounded-xl hover:from-emerald-600 hover:to-emerald-700 shadow-md shadow-emerald-200 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 font-medium text-sm"
          >
            <Plus size={18} />
            <span className="hidden sm:inline">Add Staff Member</span>
            <span className="sm:hidden">Add</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <p className="text-gray-600 text-sm">Total Staff</p>
          <p className="text-3xl font-bold text-gray-800 mt-2">{pagination.total}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <p className="text-gray-600 text-sm">Active Staff</p>
          <p className="text-3xl font-bold text-emerald-600 mt-2">
            {staff.filter((s: any) => s.is_active === 1).length}
          </p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <p className="text-gray-600 text-sm">Inactive Staff</p>
          <p className="text-3xl font-bold text-gray-600 mt-2">
            {staff.filter((s: any) => s.is_active === 0).length}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-100 shadow-sm px-5 py-4 mb-6">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Search */}
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                placeholder="Search by name, position, or phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 outline-none transition"
              />
            </div>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPagination(p => ({ ...p, page: 1 })); }}
              className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 outline-none transition"
            >
              <option value="all">All Status</option>
              <option value="1">Active</option>
              <option value="0">Inactive</option>
            </select>
          </div>

          {/* Department Filter */}
          {departments.length > 0 && (
            <select
              value={departmentFilter}
              onChange={(e) => { setDepartmentFilter(e.target.value); setPagination(p => ({ ...p, page: 1 })); }}
              className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 outline-none transition"
            >
              <option value="all">All Departments</option>
              {departments.map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          )}

          <button
            onClick={handleSearch}
            className="flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white px-5 py-2 rounded-xl hover:from-emerald-600 hover:to-emerald-700 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 font-medium text-sm"
          >
            Apply
          </button>
        </div>
      </div>

      {/* Staff Table */}
      {loading ? (
        <SkeletonTable rows={6} cols={7} />
      ) : error && !loading ? (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center">
          <p className="text-red-700 font-medium mb-3">{error}</p>
          <button
            onClick={fetchStaff}
            className="px-5 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition font-medium text-sm"
          >
            Retry
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead className="bg-gray-50">
              <tr className="border-b border-gray-100">
                <th className="text-left p-4 font-semibold text-gray-700">Emp. ID</th>
                <th className="text-left p-4 font-semibold text-gray-700">Name</th>
                <th className="text-left p-4 font-semibold text-gray-700">Position</th>
                <th className="text-left p-4 font-semibold text-gray-700">Department</th>
                <th className="text-left p-4 font-semibold text-gray-700">Phone</th>
                <th className="text-right p-4 font-semibold text-gray-700">Salary</th>
                <th className="text-center p-4 font-semibold text-gray-700">Status</th>
                <th className="text-center p-4 font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {staff.length > 0 ? (
                staff.map((member: any) => (
                  <tr key={member.staff_id} className="border-b border-gray-50 hover:bg-emerald-50/20 transition-colors">
                    <td className="p-4 text-gray-600 font-mono text-sm">{member.employee_id || '-'}</td>
                    <td className="p-4 font-semibold text-gray-800">{member.full_name}</td>
                    <td className="p-4">{member.position}</td>
                    <td className="p-4 text-gray-600">{member.department || '-'}</td>
                    <td className="p-4 text-gray-600">{member.phone || '-'}</td>
                    <td className="p-4 text-right font-medium">
                      {member.salary ? `${currency}${Number(member.salary).toFixed(0)}` : '-'}
                    </td>
                    <td className="p-4 text-center">
                      {member.is_active === 1 ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">
                          <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleViewDetails(member)}
                          className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                          title="View Details"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          onClick={() => handleEdit(member)}
                          className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                          title="Edit"
                        >
                          <Edit size={16} />
                        </button>
                        {member.is_active === 1 ? (
                          <>
                            <button
                              onClick={() => { setSelectedStaff(member); setShowIncrementModal(true); }}
                              className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                              title="Salary Increment"
                            >
                              <TrendingUp size={16} />
                            </button>
                            <button
                              onClick={() => handleDelete(member.staff_id, member.full_name)}
                              className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                              title="Deactivate"
                            >
                              <Trash2 size={16} />
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => handleReactivate(member.staff_id, member.full_name)}
                            className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                            title="Reactivate"
                          >
                            <RotateCcw size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : !loading && staff.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-0">
                    <EmptyState
                      icon={User}
                      title="No staff members found"
                      description="Try adjusting your filters or add a new staff member"
                    />
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>

          </div>
          {/* Pagination */}
          <Pagination
            currentPage={pagination.page}
            totalPages={pagination.totalPages}
            onPageChange={(page) => setPagination({ ...pagination, page })}
            totalItems={pagination.total}
            itemsPerPage={pagination.limit}
            onItemsPerPageChange={(limit) => setPagination(p => ({ ...p, limit, page: 1 }))}
          />
        </div>
      )}

      {/* Modals */}
      <AddStaffModal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setStaffToEdit(null);
        }}
        onSuccess={fetchStaff}
        staffToEdit={staffToEdit}
      />

      {selectedStaff && (
        <>
          <StaffDetailsModal
            isOpen={showDetailsModal}
            onClose={() => {
              setShowDetailsModal(false);
              setSelectedStaff(null);
            }}
            staffId={selectedStaff.staff_id}
          />

          <SalaryIncrementModal
            isOpen={showIncrementModal}
            onClose={() => {
              setShowIncrementModal(false);
              setSelectedStaff(null);
            }}
            onSuccess={fetchStaff}
            staffMember={selectedStaff}
          />
        </>
      )}
    </div>
  );
};

export default Staff;
