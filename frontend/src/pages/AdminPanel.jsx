import { useState, useEffect } from 'react';
import API from '../api/axios';
import { notify as toast } from '../utils/notify';
import { Users, Key, Plus, RefreshCw, UserPlus, UserX } from 'lucide-react';

import UserModal from '../components/admin/UserModal';
import UserManagement from '../components/admin/UserManagement';
import ResetRequestsList from '../components/admin/ResetRequestsList';
import RejectResetModal from '../components/admin/RejectResetModal';
import ConfirmModal from '../components/common/ConfirmModal';
import PendingRegistrationsList from '../components/admin/PendingRegistrationsList';
import RejectedRegistrationsList from '../components/admin/RejectedRegistrationsList';
import { validateName, validatePassword } from '../utils/validation';
import useSessionState from '../hooks/useSessionState';

const AdminPanel = () => {
  const [activeTab, setActiveTab] = useSessionState('ap:tab', 'users');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useSessionState('ap:search', '');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [formData, setFormData] = useState({
    name: '', email: '', password: '', role: 'employee', storageLimitGB: ''
  });
  const [formLoading, setFormLoading] = useState(false);

  const [resetRequests, setResetRequests] = useState([]);
  const [resetRequestsLoading, setResetRequestsLoading] = useState(false);
  const [processingRequest, setProcessingRequest] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [pendingConfirm, setPendingConfirm] = useState(null);
  const [pendingUsers, setPendingUsers] = useState([]);
  const [pendingUsersLoading, setPendingUsersLoading] = useState(false);
  const [processingPendingUser, setProcessingPendingUser] = useState(null);
  const [rejectedUsers, setRejectedUsers] = useState([]);
  const [rejectedUsersLoading, setRejectedUsersLoading] = useState(false);
  const [processingRejectedUser, setProcessingRejectedUser] = useState(null);

  useEffect(() => {
    fetchUsers();
    fetchResetRequests();
    fetchPendingUsers();
    fetchRejectedUsers();
  }, [search]);

  useEffect(() => {
    const onFocus = () => {
      fetchUsers();
      fetchResetRequests();
      fetchPendingUsers();
      fetchRejectedUsers();
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [search]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      const { data } = await API.get(`/users?${params}`);
      setUsers(data.users || []);
    } catch (error) {
      console.error('Fetch users error:', error);
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

const fetchResetRequests = async () => {
    try {
      setResetRequestsLoading(true);
      const { data } = await API.get('/reset-requests?status=pending');
      setResetRequests(data.requests || []);
    } catch (error) {
      console.error('Fetch reset requests error:', error);
      toast.error('Failed to load reset requests');
    } finally {
      setResetRequestsLoading(false);
    }
  };

  const fetchPendingUsers = async () => {
    try {
      setPendingUsersLoading(true);
      const { data } = await API.get('/users/pending');
      setPendingUsers(data.users || []);
    } catch (error) {
      console.error('Fetch pending users error:', error);
      toast.error('Failed to load pending registrations');
    } finally {
      setPendingUsersLoading(false);
    }
  };

  const fetchRejectedUsers = async () => {
    try {
      setRejectedUsersLoading(true);
      const { data } = await API.get('/users/rejected');
      setRejectedUsers(data.users || []);
    } catch (error) {
      console.error('Fetch rejected users error:', error);
      toast.error('Failed to load rejected registrations');
    } finally {
      setRejectedUsersLoading(false);
    }
  };

  const handleCreateUser = async () => {
    if (!formData.name || !formData.email || !formData.password) {
      toast.error('Please fill in all fields');
      return;
    }
    if (formData.password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    const nameError = validateName(formData.name);
    if (nameError) {
      toast.error(nameError);
      return;
    }
    const passwordError = validatePassword(formData.password);
    if (passwordError) {
      toast.error(passwordError);
      return;
    }
    try {
      setFormLoading(true);
      const payload = { ...formData };
      if (formData.storageLimitGB && parseFloat(formData.storageLimitGB) > 0) {
        payload.storageLimit = Math.round(parseFloat(formData.storageLimitGB) * 1024 * 1024 * 1024);
      }
      delete payload.storageLimitGB;
      await API.post('/users', payload);
      toast.success('User created successfully');
      setShowCreateModal(false);
      setFormData({ name: '', email: '', password: '', role: 'employee', storageLimitGB: '' });
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to create user');
    } finally {
      setFormLoading(false);
    }
  };

  const handleEditUser = async () => {
    try {
      setFormLoading(true);
      const payload = {
        name: formData.name,
        role: formData.role
      };
      if (formData.storageLimitGB && parseFloat(formData.storageLimitGB) > 0) {
        payload.storageLimit = Math.round(parseFloat(formData.storageLimitGB) * 1024 * 1024 * 1024);
      }
      await API.put(`/users/${selectedUser._id}`, payload);
      toast.success('User updated successfully');
      setShowEditModal(false);
      setSelectedUser(null);
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update user');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeactivate = async (user) => {
    setPendingConfirm({
      title: `${user.isActive ? 'Deactivate' : 'Activate'} user?`,
      message: `${user.isActive ? 'Deactivate' : 'Activate'} ${user.name}?`,
      confirmText: user.isActive ? 'Deactivate' : 'Activate',
      variant: user.isActive ? 'danger' : 'primary',
      onConfirm: async () => {
        try {
          if (user.isActive) {
            await API.put(`/users/${user._id}/deactivate`);
            toast.success('User deactivated');
          } else {
            await API.put(`/users/${user._id}`, { isActive: true });
            toast.success('User activated');
          }
          fetchUsers();
        } catch (error) {
          toast.error(error.response?.data?.message || 'Failed to update user status');
        }
      }
    });
  };

  const handleUnlock = async (user) => {
    try {
      await API.put(`/users/${user._id}/unlock`);
      toast.success(`${user.name}'s account unlocked`);
      fetchUsers();
    } catch {
      toast.error('Failed to unlock account');
    }
  };

  const handleDelete = async (user) => {
    setPendingConfirm({
      title: 'Permanently delete user?',
      message: `Permanently delete ${user.name}?\n\nThis action cannot be undone.`,
      confirmText: 'Delete',
      variant: 'danger',
      onConfirm: async () => {
        try {
          const res = await API.delete(`/users/${user._id}`);
          toast.success(res.data?.message || 'User deleted permanently');
          fetchUsers();
        } catch (error) {
          toast.error(error.response?.data?.message || 'Failed to delete user');
        }
      }
    });
  };

  const openEditModal = (user) => {
    setSelectedUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      password: '',
      role: user.role,
      storageLimitGB: user.storageLimit ? (user.storageLimit / (1024 * 1024 * 1024)).toString() : ''
    });
    setShowEditModal(true);
  };

  const handleApproveRequest = async (request) => {
    setPendingConfirm({
      title: 'Approve password reset?',
      message: `Approve password reset for ${request.email}?`,
      confirmText: 'Approve',
      variant: 'primary',
      onConfirm: async () => {
        try {
          setProcessingRequest(request._id);
          await API.put(`/reset-requests/${request._id}/approve`);
          toast.success(`Password reset approved for ${request.email}`);
          fetchResetRequests();
        } catch (error) {
          toast.error(error.response?.data?.message || 'Failed to approve request');
        } finally {
          setProcessingRequest(null);
        }
      }
    });
  };

  const handleRejectRequest = async () => {
    try {
      setProcessingRequest(selectedRequest._id);
      await API.put(`/reset-requests/${selectedRequest._id}/reject`, {
        reason: rejectReason || 'Request rejected by administrator'
      });
      toast.success('Request rejected');
      setShowRejectModal(false);
      setSelectedRequest(null);
      setRejectReason('');
      fetchResetRequests();
    } catch {
      toast.error('Failed to reject request');
    } finally {
      setProcessingRequest(null);
    }
  };

  const handleApprovePendingUser = async (user) => {
    setPendingConfirm({
      title: 'Approve registration?',
      message: `Approve ${user.name} (${user.email}) to use the workspace?`,
      confirmText: 'Approve',
      variant: 'primary',
      onConfirm: async () => {
        try {
          setProcessingPendingUser(user._id);
          await API.put(`/users/${user._id}/approve`);
          toast.success(`${user.name}'s registration approved`);
          fetchPendingUsers();
          fetchUsers();
        } catch (error) {
          toast.error(error.response?.data?.message || 'Failed to approve registration');
        } finally {
          setProcessingPendingUser(null);
        }
      }
    });
  };

  const handleRejectPendingUser = async (user) => {
    setPendingConfirm({
      title: 'Reject registration?',
      message: `Reject ${user.name} (${user.email})?\n\nTheir account will be rejected and they will not be able to sign in.`,
      confirmText: 'Reject',
      variant: 'danger',
      onConfirm: async () => {
        try {
          setProcessingPendingUser(user._id);
          await API.put(`/users/${user._id}/reject`);
          toast.success(`${user.name}'s registration rejected`);
          fetchPendingUsers();
        } catch (error) {
          toast.error(error.response?.data?.message || 'Failed to reject registration');
        } finally {
          setProcessingPendingUser(null);
        }
      }
    });
  };

  const handleReapproveRejectedUser = async (user) => {
    setPendingConfirm({
      title: 'Re-approve registration?',
      message: `Re-approve ${user.name} (${user.email})?\n\nThey will be able to sign in immediately.`,
      confirmText: 'Re-approve',
      variant: 'primary',
      onConfirm: async () => {
        try {
          setProcessingRejectedUser(user._id);
          await API.put(`/users/${user._id}/approve`);
          toast.success(`${user.name}'s registration approved`);
          fetchRejectedUsers();
          fetchUsers();
        } catch (error) {
          toast.error(error.response?.data?.message || 'Failed to approve registration');
        } finally {
          setProcessingRejectedUser(null);
        }
      }
    });
  };

  const handleDeleteRejectedUser = async (user) => {
    setPendingConfirm({
      title: 'Permanently delete user?',
      message: `Permanently delete ${user.name} (${user.email})?\n\nThis lets them register again with the same email. This action cannot be undone.`,
      confirmText: 'Delete',
      variant: 'danger',
      onConfirm: async () => {
        try {
          setProcessingRejectedUser(user._id);
          const res = await API.delete(`/users/${user._id}`);
          toast.success(res.data?.message || 'User deleted permanently');
          fetchRejectedUsers();
        } catch (error) {
          toast.error(error.response?.data?.message || 'Failed to delete user');
        } finally {
          setProcessingRejectedUser(null);
        }
      }
    });
  };

  return (
    <div className="page-container">

      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Admin Panel</h1>
          <p className="page-subtitle">Manage users, roles, and system access</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn btn-ghost" onClick={() => { fetchUsers(); fetchResetRequests(); fetchPendingUsers(); fetchRejectedUsers(); }}>
            <RefreshCw size={16} /> Refresh
          </button>
          {activeTab === 'users' && (
            <button
              className="btn btn-primary"
              onClick={() => {
                setFormData({ name: '', email: '', password: '', role: 'employee' });
                setSelectedUser(null);
                setShowCreateModal(true);
              }}
            >
              <Plus size={16} /> Add User
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '24px',
        borderBottom: '2px solid var(--gray-200)'
      }}>
        {[
          { id: 'users', label: 'User Management', icon: <Users size={16} /> },
          {
            id: 'reset-requests',
            label: 'Password Reset Requests',
            icon: <Key size={16} />,
            badge: resetRequests.length > 0 ? resetRequests.length : null
          },
          {
            id: 'pending-users',
            label: 'Pending Registrations',
            icon: <UserPlus size={16} />,
            badge: pendingUsers.length > 0 ? pendingUsers.length : null
          },
          {
            id: 'rejected-users',
            label: 'Rejected Registrations',
            icon: <UserX size={16} />,
            badge: rejectedUsers.length > 0 ? rejectedUsers.length : null
          }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '10px 20px', border: 'none',
              backgroundColor: 'transparent', cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: activeTab === tab.id ? '600' : '400',
              color: activeTab === tab.id ? 'var(--primary)' : 'var(--gray-500)',
              borderBottom: activeTab === tab.id
                ? '2px solid var(--primary)' : '2px solid transparent',
              marginBottom: '-2px', transition: 'all 0.15s'
            }}
          >
            {tab.icon}
            {tab.label}
            {tab.badge && (
              <span className="badge badge-danger" style={{ fontSize: '0.7rem' }}>
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Users Tab */}
      {activeTab === 'users' && (
        <UserManagement
          users={users}
          loading={loading}
          search={search}
          setSearch={setSearch}
          onEdit={openEditModal}
          onUnlock={handleUnlock}
          onDeactivate={handleDeactivate}
          onDelete={handleDelete}
        />
      )}

      {/* Password Reset Requests Tab */}
      {activeTab === 'reset-requests' && (
        <ResetRequestsList
          requests={resetRequests}
          loading={resetRequestsLoading}
          processingRequest={processingRequest}
          onApprove={handleApproveRequest}
          onReject={(request) => {
            setSelectedRequest(request);
            setShowRejectModal(true);
          }}
          onRefresh={fetchResetRequests}
        />
      )}

      {/* Pending Registrations Tab */}
      {activeTab === 'pending-users' && (
        <PendingRegistrationsList
          users={pendingUsers}
          loading={pendingUsersLoading}
          processingUser={processingPendingUser}
          onApprove={handleApprovePendingUser}
          onReject={handleRejectPendingUser}
          onRefresh={fetchPendingUsers}
        />
      )}

      {/* Rejected Registrations Tab */}
      {activeTab === 'rejected-users' && (
        <RejectedRegistrationsList
          users={rejectedUsers}
          loading={rejectedUsersLoading}
          processingUser={processingRejectedUser}
          onApprove={handleReapproveRejectedUser}
          onDelete={handleDeleteRejectedUser}
          onRefresh={fetchRejectedUsers}
        />
      )}

      {/* Create user modal */}
      {showCreateModal && (
        <UserModal
          title="Create New User"
          onClose={() => setShowCreateModal(false)}
          onSave={handleCreateUser}
          saveLabel="Create User"
          loading={formLoading}
          formData={formData}
          setFormData={setFormData}
          selectedUser={null}
        />
      )}

      {/* Edit user modal */}
      {showEditModal && (
        <UserModal
          title={`Edit — ${selectedUser?.name}`}
          onClose={() => { setShowEditModal(false); setSelectedUser(null); }}
          onSave={handleEditUser}
          saveLabel="Save Changes"
          loading={formLoading}
          formData={formData}
          setFormData={setFormData}
          selectedUser={selectedUser}
        />
      )}

      {/* Reject modal */}
      {showRejectModal && selectedRequest && (
        <RejectResetModal
          request={selectedRequest}
          reason={rejectReason}
          setReason={setRejectReason}
          onConfirm={handleRejectRequest}
          onClose={() => setShowRejectModal(false)}
        />
      )}

      <ConfirmModal
        open={!!pendingConfirm}
        title={pendingConfirm?.title}
        message={pendingConfirm?.message}
        confirmText={pendingConfirm?.confirmText}
        variant={pendingConfirm?.variant}
        onConfirm={() => pendingConfirm?.onConfirm?.()}
        onCancel={() => setPendingConfirm(null)}
      />
    </div>
  );
};

export default AdminPanel;
