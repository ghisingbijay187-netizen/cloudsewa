import { useEffect } from 'react';
import { X, Download } from 'lucide-react';
import { useFocusTrap } from '../../hooks/useFocusTrap';

const FilePreviewModal = ({ file, previewUrl, onClose, onDownload }) => {
  const dialogRef = useFocusTrap(true);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!file) return null;

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      style={{ alignItems: 'flex-start', paddingTop: '40px' }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Preview: ${file.originalName}`}
        style={{
          backgroundColor: 'var(--white)',
          borderRadius: 'var(--radius-xl)',
          width: '90%',
          maxWidth: '900px',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{
          padding: '16px 24px',
          borderBottom: '1px solid var(--gray-200)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0
        }}>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: '600', color: 'var(--gray-900)' }}>
              {file.originalName}
            </h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--gray-500)', marginTop: '2px' }}>
              {file.mimetype} • v{file.currentVersion}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-ghost btn-sm" onClick={() => onDownload(file)}>
              <Download size={14} />
              Download
            </button>
            <button className="btn-icon" onClick={onClose} aria-label="Close dialog">
              <X size={18} />
            </button>
          </div>
        </div>

        <div style={{
          flex: 1,
          overflow: 'auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--gray-50)',
          minHeight: '400px',
          padding: '16px'
        }}>
          {file.mimetype?.startsWith('image/') && (
            <img
              src={previewUrl}
              alt={file.originalName}
              style={{
                maxWidth: '100%',
                maxHeight: '65vh',
                objectFit: 'contain',
                borderRadius: 'var(--radius)',
                boxShadow: 'var(--shadow-md)'
              }}
            />
          )}
          {file.mimetype === 'application/pdf' && (
            <iframe
              src={previewUrl}
              title={file.originalName}
              style={{
                width: '100%',
                height: '65vh',
                border: 'none',
                borderRadius: 'var(--radius)'
              }}
            />
          )}
          {file.mimetype?.startsWith('text/') && (
            <iframe
              src={previewUrl}
              title={file.originalName}
              style={{
                width: '100%',
                height: '65vh',
                border: 'none',
                backgroundColor: 'white',
                borderRadius: 'var(--radius)'
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default FilePreviewModal;
