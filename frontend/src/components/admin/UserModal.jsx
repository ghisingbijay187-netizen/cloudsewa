import { useEffect } from 'react';
import { XCircle } from 'lucide-react';
import { useFocusTrap } from '../../hooks/useFocusTrap';

const UserModal = ({
  title, onClose, onSave, saveLabel,
  loading, formData, setFormData, selectedUser
}) => {
  const dialogRef = useFocusTrap(true);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
  <div className="modal-overlay" onClick={onClose}>
    <div
      className="modal"
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="modal-header">
        <h3 className="modal-title">{title}</h3>
        <button className="btn-icon" onClick={onClose} aria-label="Close dialog">
          <XCircle size={18} />
        </button>
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="um-name">Full Name</label>
        <input
          id="um-name"
          type="text"
          className="form-input"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="User's full name"
          autoFocus
        />
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="um-email">Email Address</label>
        <input
          id="um-email"
          type="email"
          className="form-input"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          placeholder="user@email.com"
          disabled={!!selectedUser}
          style={selectedUser ? {
            backgroundColor: 'var(--gray-50)',
            color: 'var(--gray-400)',
            cursor: 'not-allowed'
          } : {}}
        />
      </div>

      {!selectedUser && (
        <div className="form-group">
          <label className="form-label" htmlFor="um-password">Password</label>
          <input
            id="um-password"
            type="password"
            className="form-input"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            placeholder="Min 8 chars, upper+lower+number+symbol"
          />
        </div>
      )}

      <div className="form-group">
        <label className="form-label" htmlFor="um-role">Role</label>
        <select
          id="um-role"
          className="form-select"
          value={formData.role}
          onChange={(e) => setFormData({ ...formData, role: e.target.value })}
        >
          <option value="employee">Employee</option>
          <option value="admin">Admin</option>
        </select>
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="um-storage">Storage Limit (GB)</label>
        <input
          id="um-storage"
          type="number"
          min="1"
          step="0.25"
          className="form-input"
          value={formData.storageLimitGB}
          onChange={(e) => setFormData({ ...formData, storageLimitGB: e.target.value })}
          placeholder="e.g. 1"
        />
        <small style={{ color: 'var(--gray-500)', fontSize: '0.75rem', display: 'block', marginTop: '4px' }}>
          Amount of storage this user is allowed (min 1GB). Leave empty for default.
        </small>
      </div>

      <div className="modal-footer">
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={onSave} disabled={loading}>
          {loading ? 'Saving...' : saveLabel}
        </button>
      </div>
    </div>
  </div>
  );
};

export default UserModal;
