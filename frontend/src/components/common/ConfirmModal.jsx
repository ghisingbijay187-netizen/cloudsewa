import { useEffect, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';

const ConfirmModal = ({
  open,
  title = 'Confirm action',
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  onConfirm,
  onCancel
}) => {
  const confirmRef = useRef(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && confirmRef.current) {
      confirmRef.current.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape' && !loading) onCancel?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, loading, onCancel]);

  const handleConfirm = async () => {
    if (loading) return;
    const result = onConfirm?.();
    if (result && typeof result.then === 'function') {
      setLoading(true);
      try {
        await result;
      } catch {
        // actions already surface their own errors via toast; still dismiss
      } finally {
        setLoading(false);
        onCancel?.();
      }
    } else {
      onCancel?.();
    }
  };

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={loading ? undefined : onCancel}>
      <div
        className="modal"
        style={{ maxWidth: '420px', padding: '28px' }}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '50%',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: variant === 'danger' ? 'rgba(239, 68, 68, 0.12)' : 'rgba(59, 130, 246, 0.12)',
            color: variant === 'danger' ? 'var(--danger)' : 'var(--primary)'
          }}>
            <AlertTriangle size={20} />
          </div>
          <h3 className="modal-title" style={{ margin: 0, fontSize: '1.1rem' }}>{title}</h3>
        </div>

        {message && (
          <p style={{
            margin: 0,
            fontSize: '0.9rem',
            color: 'var(--gray-600)',
            lineHeight: 1.5,
            whiteSpace: 'pre-line'
          }}>
            {message}
          </p>
        )}

        <div className="modal-footer" style={{ marginTop: '22px' }}>
          <button className="btn btn-ghost" onClick={onCancel} disabled={loading}>{cancelText}</button>
          <button
            ref={confirmRef}
            className={`btn ${variant === 'danger' ? 'btn-danger' : 'btn-primary'}`}
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading ? `${confirmText}...` : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;