import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import API from '../api/axios';
import { notify as toast } from '../utils/notify';
import { getInitials } from '../utils/formatters';
import { validateName, validatePassword } from '../utils/validation';
import {
  User, Lock, HardDrive, Shield,
  Save, Eye, EyeOff, CheckCircle
} from 'lucide-react';

const Settings = () => {
  const { user, updateUser } = useAuth();

  const [profileData, setProfileData] = useState({ name: user?.name || '' });
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showPasswords, setShowPasswords] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);

  const formatBytes = (bytes) => {
    if (!Number.isFinite(Number(bytes)) || Number(bytes) <= 0) return '0 MB';
    const mb = Number(bytes) / 1024 / 1024;
    if (mb < 1024) return `${mb.toFixed(1)} MB`;
    return `${(mb / 1024).toFixed(2)} GB`;
  };

  const storagePercent = user && user.storageLimit > 0
    ? Math.round((Number(user.storageUsed) / Number(user.storageLimit)) * 100)
    : 0;

  const handleProfileSave = async () => {
    if (!profileData.name.trim()) {
      toast.error('Name cannot be empty');
      return;
    }
    const nameError = validateName(profileData.name);
    if (nameError) {
      toast.error(nameError);
      return;
    }
    try {
      setProfileLoading(true);
      const { data } = await API.put('/auth/profile', { name: profileData.name });
      updateUser(data.user);
      toast.success('Profile updated successfully');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update profile');
    } finally {
      setProfileLoading(false);
    }
  };

  const handlePasswordSave = async () => {
    if (!passwordData.currentPassword || !passwordData.newPassword) {
      toast.error('Please fill in all password fields');
      return;
    }
    if (passwordData.newPassword.length < 8) {
      toast.error('New password must be at least 8 characters');
      return;
    }
    const passwordError = validatePassword(passwordData.newPassword);
    if (passwordError) {
      toast.error(passwordError);
      return;
    }
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    try {
      setPasswordLoading(true);
      await API.put('/auth/password', {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword
      });
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
      toast.success('Password updated successfully');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update password');
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="page-container">

      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Manage your account and preferences</p>
        </div>
      </div>

      <div className="settings-grid" style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '24px'
      }}>

        {/* Profile section */}
        <div className="card">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <User size={18} color="var(--primary)" />
              <h3 className="card-title">Profile Information</h3>
            </div>
          </div>

          {/* Avatar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            marginBottom: '24px',
            padding: '16px',
            backgroundColor: 'var(--gray-50)',
            borderRadius: 'var(--radius)'
          }}>
            <div style={{
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              backgroundColor: 'var(--primary)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.25rem',
              fontWeight: '700',
              flexShrink: 0
            }}>
              {getInitials(user?.name)}
            </div>
            <div style={{ minWidth: 0 }}>
              <p style={{
                fontWeight: '600',
                color: 'var(--gray-900)',
                fontSize: '1rem'
              }}>
                {user?.name}
              </p>
              <p style={{
                color: 'var(--gray-500)',
                fontSize: '0.875rem',
                overflowWrap: 'anywhere',
                wordBreak: 'break-all'
              }}>
                {user?.email}
              </p>
              <span className={`badge ${user?.role === 'admin' ? 'badge-primary' : 'badge-gray'}`}
                style={{ marginTop: '4px', textTransform: 'capitalize' }}>
                {user?.role}
              </span>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="settings-name">Full Name</label>
            <input
              id="settings-name"
              type="text"
              className="form-input"
              value={profileData.name}
              onChange={(e) => setProfileData({ name: e.target.value })}
              placeholder="Your full name"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="settings-email">Email Address</label>
            <input
              id="settings-email"
              type="email"
              className="form-input"
              value={user?.email || ''}
              disabled
              style={{
                backgroundColor: 'var(--gray-50)',
                color: 'var(--gray-400)',
                cursor: 'not-allowed'
              }}
            />
            <span className="form-error" style={{ color: 'var(--gray-400)' }}>
              Email cannot be changed
            </span>
          </div>

          <button
            className="btn btn-primary"
            onClick={handleProfileSave}
            disabled={profileLoading}
          >
            <Save size={16} />
            {profileLoading ? 'Saving...' : 'Save Profile'}
          </button>
        </div>

        {/* Password section */}
        <div className="card">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Lock size={18} color="var(--primary)" />
              <h3 className="card-title">Change Password</h3>
            </div>
            <button
              className="btn-icon"
              onClick={() => setShowPasswords(!showPasswords)}
              title={showPasswords ? 'Hide passwords' : 'Show passwords'}
              aria-label={showPasswords ? 'Hide passwords' : 'Show passwords'}
            >
              {showPasswords ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="settings-current-pw">Current Password</label>
            <input
              id="settings-current-pw"
              type={showPasswords ? 'text' : 'password'}
              className="form-input"
              value={passwordData.currentPassword}
              onChange={(e) => setPasswordData({
                ...passwordData,
                currentPassword: e.target.value
              })}
              placeholder="Enter current password"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="settings-new-pw">New Password</label>
            <input
              id="settings-new-pw"
              type={showPasswords ? 'text' : 'password'}
              className="form-input"
              value={passwordData.newPassword}
              onChange={(e) => setPasswordData({
                ...passwordData,
                newPassword: e.target.value
              })}
              placeholder="Min 8 chars, upper+lower+number+symbol"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="settings-confirm-pw">Confirm New Password</label>
            <input
              id="settings-confirm-pw"
              type={showPasswords ? 'text' : 'password'}
              className="form-input"
              value={passwordData.confirmPassword}
              onChange={(e) => setPasswordData({
                ...passwordData,
                confirmPassword: e.target.value
              })}
              placeholder="Repeat new password"
            />
          </div>

          {/* Password strength */}
          {passwordData.newPassword && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{
                display: 'flex',
                gap: '4px',
                marginBottom: '6px'
              }}>
                {[1, 2, 3, 4].map((level) => {
                  const strength = passwordData.newPassword.length >= 8
                    ? passwordData.newPassword.match(/[A-Z]/) ? 4
                      : passwordData.newPassword.match(/[0-9]/) ? 3
                      : 2
                    : 1;
                  return (
                    <div
                      key={level}
                      style={{
                        flex: 1,
                        height: '4px',
                        borderRadius: '2px',
                        backgroundColor: level <= strength
                          ? strength >= 4 ? 'var(--success)'
                            : strength >= 3 ? 'var(--warning)'
                            : 'var(--danger)'
                          : 'var(--gray-200)'
                      }}
                    />
                  );
                })}
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--gray-400)' }}>
                {passwordData.newPassword.length < 8
                  ? 'Too short — minimum 8 characters'
                  : passwordData.newPassword.match(/[A-Z]/)
                  ? 'Strong password'
                  : passwordData.newPassword.match(/[0-9]/)
                  ? 'Good — add uppercase for stronger password'
                  : 'Moderate — add numbers or uppercase letters'}
              </p>
            </div>
          )}

          <button
            className="btn btn-primary"
            onClick={handlePasswordSave}
            disabled={passwordLoading}
          >
            <Lock size={16} />
            {passwordLoading ? 'Updating...' : 'Update Password'}
          </button>
        </div>

        {/* Storage section */}
        <div className="card">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <HardDrive size={18} color="var(--primary)" />
              <h3 className="card-title">Storage Usage</h3>
            </div>
            <span className={`badge ${
              storagePercent >= 80 ? 'badge-danger'
              : storagePercent >= 60 ? 'badge-warning'
              : 'badge-success'
            }`}>
              {storagePercent}% used
            </span>
          </div>

          <div className="progress-bar" style={{ marginBottom: '12px' }}>
            <div
              className={`progress-fill ${
                storagePercent >= 80 ? 'danger'
                : storagePercent >= 60 ? 'warning'
                : ''
              }`}
              style={{ width: `${storagePercent}%` }}
            />
          </div>

          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '0.875rem',
            color: 'var(--gray-500)',
            marginBottom: '20px'
          }}>
            <span>{formatBytes(user?.storageUsed)} used</span>
            <span>{formatBytes(user?.storageLimit)} total</span>
          </div>

          <div style={{
            padding: '12px 16px',
            backgroundColor: 'var(--gray-50)',
            borderRadius: 'var(--radius)',
            fontSize: '0.8rem',
            color: 'var(--gray-500)'
          }}>
            Storage limit is managed by your administrator.
            Contact your admin to increase your storage quota.
          </div>
        </div>

        {/* Security section */}
        <div className="card">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Shield size={18} color="var(--primary)" />
              <h3 className="card-title">Security Information</h3>
            </div>
          </div>

          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            {[
              {
                label: 'File Encryption',
                value: 'AES-256 at rest',
                status: true
              },
              {
                label: 'Data in Transit',
                value: 'HTTPS/TLS encrypted',
                status: true
              },
              {
                label: 'Authentication',
                value: 'JWT + bcrypt (cost 12)',
                status: true
              },
              {
                label: 'Account Lockout',
                value: 'After 5 failed attempts',
                status: true
              },
              {
                label: 'Last Login',
                value: user?.lastLogin
                  ? new Date(user.lastLogin).toLocaleString()
                  : 'First login',
                status: true
              },
              {
                label: 'Member Since',
                value: user?.createdAt
                  ? new Date(user.createdAt).toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric'
                    })
                  : '—',
                status: true
              }
            ].map((item) => (
              <div
                key={item.label}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 0',
                  borderBottom: '1px solid var(--gray-100)'
                }}
              >
                <span style={{
                  fontSize: '0.875rem',
                  color: 'var(--gray-600)'
                }}>
                  {item.label}
                </span>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  {item.status && (
                    <CheckCircle size={14} color="var(--success)" />
                  )}
                  <span style={{
                    fontSize: '0.8rem',
                    fontWeight: '500',
                    color: 'var(--gray-800)'
                  }}>
                    {item.value}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;