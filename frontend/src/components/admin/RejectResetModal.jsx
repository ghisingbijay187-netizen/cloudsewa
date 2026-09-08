import { useEffect } from 'react';
import { XCircle, X as XIcon } from 'lucide-react';
import { useFocusTrap } from '../../hooks/useFocusTrap';

const RejectResetModal = ({ request, reason, setReason, onConfirm, onClose }) => {
  const dialogRef = useFocusTrap(true);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" ref={dialogRef} role="dialog" aria-modal="true" aria-label="Reject password reset request" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Reject Password Reset Request</h3>
          <button className="btn-icon" onClick={onClose} aria-label="Close dialog">
            <XCircle size={18} />
          </button>
        </div>
        <p style={{ fontSize: '0.875rem', color: 'var(--gray-600)', marginBottom: '16px' }}>
          Rejecting reset request for <strong>{request.email}</strong>.
          Please provide a reason (optional).
        </p>
        <div className="form-group">
          <label className="form-label" htmlFor="reject-reason">Reason for Rejection</label>
          <input
            id="reject-reason"
            type="text"
            className="form-input"
            placeholder="e.g. Could not verify identity"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            autoFocus
          />
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-danger" onClick={onConfirm}>
            <XIcon size={16} /> Confirm Reject
          </button>
        </div>
      </div>
    </div>
  );
};

export default RejectResetModal;
