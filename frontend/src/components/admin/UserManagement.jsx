import {
  Users, CheckCircle, XCircle, Shield,
  Search, Edit, Unlock, Lock, Trash2, Clock
} from 'lucide-react';
import { formatBytes } from '../../utils/formatters';

const UserManagementTab = ({ users, loading, search, setSearch, onEdit, onUnlock, onDeactivate, onDelete }) => (
  <>
    <div className="stats-grid" style={{ marginBottom: '24px' }}>
      {[
        { label: 'Total Users', value: users.length, icon: <Users size={20} />, color: 'stat-icon-blue' },
        { label: 'Active Users', value: users.filter(u => u.isActive).length, icon: <CheckCircle size={20} />, color: 'stat-icon-green' },
        { label: 'Admins', value: users.filter(u => u.role === 'admin').length, icon: <Shield size={20} />, color: 'stat-icon-blue' },
        { label: 'Inactive Users', value: users.filter(u => !u.isActive).length, icon: <XCircle size={20} />, color: 'stat-icon-red' }
      ].map((stat) => (
        <div key={stat.label} className="stat-card">
          <div className={`stat-icon ${stat.color}`}>{stat.icon}</div>
          <div className="stat-info">
            <h3>{stat.value}</h3>
            <p>{stat.label}</p>
          </div>
        </div>
      ))}
    </div>

    <div style={{ marginBottom: '20px' }}>
      <div className="search-bar" style={{ maxWidth: '400px' }}>
        <Search size={16} className="search-icon" />
        <input
          className="form-input"
          placeholder="Search users by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ paddingLeft: '40px' }}
        />
      </div>
    </div>

    <div className="card" style={{ padding: 0 }}>
      {loading ? (
        <div className="loading-spinner"><div className="spinner" /></div>
      ) : users.length === 0 ? (
        <div className="empty-state">
          <Users size={48} />
          <h3>No users found</h3>
          <p>Add users to get started</p>
        </div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Status</th>
                <th>Storage</th>
                <th>Last Login</th>
                <th>Joined</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const isLocked = !!(user.lockUntil && new Date(user.lockUntil) > new Date());
                return (
                <tr key={user._id}>
                  <td data-label="User">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{
                        width: '36px', height: '36px', borderRadius: '50%',
                        backgroundColor: user.role === 'admin' ? 'var(--primary)' : 'var(--gray-300)',
                        color: 'white', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', fontSize: '0.75rem',
                        fontWeight: '600', flexShrink: 0
                      }}>
                        {user.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                      </div>
                      <div>
                        <p style={{ fontWeight: '500', color: 'var(--gray-900)', fontSize: '0.875rem' }}>
                          {user.name}
                        </p>
                        <p style={{ color: 'var(--gray-500)', fontSize: '0.75rem' }}>
                          {user.email}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td data-label="Role">
                    <span className={`badge ${user.role === 'admin' ? 'badge-primary' : 'badge-gray'}`}
                      style={{ textTransform: 'capitalize' }}>
                      {user.role === 'admin' && <Shield size={10} style={{ marginRight: '4px' }} />}
                      {user.role}
                    </span>
                  </td>
                  <td data-label="Status">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {isLocked
                        ? <Lock size={14} color="var(--warning)" />
                        : user.isActive
                          ? <CheckCircle size={14} color="var(--success)" />
                          : <XCircle size={14} color="var(--danger)" />}
                      <span className={`badge ${isLocked ? 'badge-warning' : user.isActive ? 'badge-success' : 'badge-danger'}`}>
                        {isLocked ? 'Locked' : user.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </td>
                  <td data-label="Storage">
                    <div>
<div style={{
                          width: '80px', height: '4px',
                          backgroundColor: 'var(--gray-200)',
                          borderRadius: '2px', overflow: 'hidden', marginBottom: '4px'
                        }}>
                          <div style={{
                            width: `${user.storageLimit > 0 ? Math.min(100, Math.round((Number(user.storageUsed) / Number(user.storageLimit)) * 100)) : 0}%`,
                            height: '100%', backgroundColor: 'var(--primary-light)', borderRadius: '2px'
                          }} />
                        </div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>
                        {formatBytes(user.storageUsed)} / {formatBytes(user.storageLimit)}
                      </span>
                    </div>
                  </td>
                  <td data-label="Last Login" style={{ color: 'var(--gray-500)', fontSize: '0.875rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Clock size={12} />
                      {user.lastLogin
                        ? new Date(user.lastLogin).toLocaleDateString('en-US', {
                            month: 'short', day: 'numeric', year: 'numeric'
                          })
                        : 'Never'}
                    </div>
                  </td>
                  <td data-label="Joined" style={{ color: 'var(--gray-500)', fontSize: '0.875rem' }}>
                    {new Date(user.createdAt).toLocaleDateString('en-US', {
                      month: 'short', day: 'numeric', year: 'numeric'
                    })}
                  </td>
                  <td data-label="Actions">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '2px', justifyContent: 'flex-end' }}>
                      <button className="btn-icon" onClick={() => onEdit(user)} title="Edit user" aria-label="Edit user">
                        <Edit size={15} />
                      </button>
                      <button className="btn-icon" onClick={() => onUnlock(user)}
                        title="Unlock account" aria-label="Unlock account" style={{ color: 'var(--info)' }}>
                        <Unlock size={15} />
                      </button>
                      <button className="btn-icon" onClick={() => onDeactivate(user)}
                        title={user.isActive ? 'Deactivate' : 'Activate'}
                        aria-label={user.isActive ? 'Deactivate user' : 'Activate user'}
                        style={{ color: user.isActive ? 'var(--warning)' : 'var(--success)' }}>
                        {user.isActive ? <Lock size={15} /> : <Unlock size={15} />}
                      </button>
                      <button className="btn-icon" onClick={() => onDelete(user)}
                        title="Delete user" aria-label="Delete user" style={{ color: 'var(--danger)' }}>
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  </>
);

export default UserManagementTab;
