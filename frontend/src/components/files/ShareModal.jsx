import { useEffect } from 'react';
import { X, Share2, Users, CheckCircle, UserCheck } from 'lucide-react';
import { useFocusTrap } from '../../hooks/useFocusTrap';

const ShareModal = ({ file, allUsers, selectedUsers, onToggleUser, onSave, onClose, loading, usersLoading }) => {
  const dialogRef = useFocusTrap(true);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!file) return null;

  // Exclude the file owner and all admins from share targets — admins already
  // have global access to every file, so sharing with them is redundant (and
  // this also hides yourself when you share as an admin).
  const filteredUsers = allUsers.filter(u => u._id !== (file.owner?._id || file.owner) && u.role !== 'admin');

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: '500px' }} ref={dialogRef} role="dialog" aria-modal="true" aria-label={`Share file: ${file.originalName}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3 className="modal-title">Share File</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--gray-500)', marginTop: '4px' }}>
              {file.originalName}
            </p>
          </div>
          <button className="btn-icon" onClick={onClose} aria-label="Close dialog">
            <X size={18} />
          </button>
        </div>

        <p style={{ fontSize: '0.8rem', color: 'var(--gray-500)', marginBottom: '16px' }}>
          Select users to share this file with. They will be able to view and download it.
        </p>

        {usersLoading ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            padding: '40px 24px'
          }}>
            <div className="loading-spinner">
              <div className="spinner" />
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--gray-500)' }}>Loading users…</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="empty-state" style={{ padding: '24px' }}>
            <Users size={32} />
            <p>No other users found</p>
          </div>
        ) : (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            maxHeight: '300px',
            overflowY: 'auto',
            marginBottom: '16px'
          }}>
            {filteredUsers.map((u) => {
              const isSelected = selectedUsers.includes(u._id);
              return (
                <div
                  key={u._id}
                  onClick={() => onToggleUser(u._id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    borderRadius: 'var(--radius)',
                    border: isSelected
                      ? '1.5px solid var(--primary-light)'
                      : '1px solid var(--gray-200)',
                    backgroundColor: isSelected ? 'var(--accent)' : 'var(--white)',
                    cursor: 'pointer',
                    transition: 'all 0.15s'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      backgroundColor: isSelected ? 'var(--primary)' : 'var(--gray-300)',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.75rem',
                      fontWeight: '600',
                      flexShrink: 0,
                      transition: 'background-color 0.15s'
                    }}>
                      {u.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                    </div>
                    <div>
                      <p style={{ fontSize: '0.875rem', fontWeight: '500', color: 'var(--gray-800)' }}>
                        {u.name}
                      </p>
                      <p style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>
                        {u.email} • {u.role}
                      </p>
                    </div>
                  </div>
                  {isSelected && (
                    <CheckCircle size={18} color="var(--primary-light)" />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {selectedUsers.length > 0 && (
          <div style={{
            padding: '10px 14px',
            backgroundColor: 'var(--success-light)',
            borderRadius: 'var(--radius)',
            marginBottom: '16px',
            fontSize: '0.8rem',
            color: 'var(--success)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <UserCheck size={14} />
            Sharing with {selectedUsers.length} user{selectedUsers.length !== 1 ? 's' : ''}
          </div>
        )}

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={onSave} disabled={loading}>
            <Share2 size={16} />
            {loading ? 'Saving...' : 'Update Sharing'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShareModal;
