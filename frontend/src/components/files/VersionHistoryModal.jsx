import { useEffect } from 'react';
import { X, History, Clock, CheckCircle, RotateCcw, Trash2 } from 'lucide-react';
import { formatBytes, formatDate } from '../../utils/formatters';
import { useFocusTrap } from '../../hooks/useFocusTrap';

const VersionHistoryModal = ({ file, onRestore, onDelete, restoring, deleting, onClose }) => {
  const dialogRef = useFocusTrap(true);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!file) return null;

  const currentDate = file.lastContentChangeAt || file.updatedAt;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: '580px' }} ref={dialogRef} role="dialog" aria-modal="true" aria-label={`Version history: ${file.originalName}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3 className="modal-title">Version History</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--gray-500)', marginTop: '4px' }}>
              {file.originalName}
            </p>
          </div>
          <button className="btn-icon" onClick={onClose} aria-label="Close dialog">
            <X size={18} />
          </button>
        </div>

        {/* Current version — the tick marks what is active right now */}
        <div style={{
          padding: '12px 16px',
          backgroundColor: 'var(--success-light)',
          borderRadius: 'var(--radius)',
          border: '1.5px solid var(--success)',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <CheckCircle size={18} color="var(--success)" />
            <div>
              <p style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--gray-900)' }}>
                Current Version (v{file.currentVersion})
              </p>
              <p style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>
                {formatBytes(file.size)} • {formatDate(currentDate)}
              </p>
            </div>
          </div>
          <span className="badge badge-success">Current</span>
        </div>

        {file.versions.length === 0 ? (
          <div className="empty-state" style={{ padding: '24px' }}>
            <History size={32} />
            <p>No previous versions available</p>
            <p style={{ fontSize: '0.75rem', color: 'var(--gray-500)', maxWidth: '340px' }}>
              Uploading a new version will keep the current one here for up to 3
              saved versions.
            </p>
          </div>
        ) : (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            maxHeight: '300px',
            overflowY: 'auto'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '4px'
            }}>
              <p style={{
                fontSize: '0.75rem',
                fontWeight: '600',
                color: 'var(--gray-500)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                Previous Versions
              </p>
              <span style={{ fontSize: '0.7rem', color: 'var(--gray-400)' }}>
                oldest removed automatically at 3
              </span>
            </div>
            {[...file.versions].sort((a, b) => b.versionNumber - a.versionNumber).map((version) => (
              <div
                key={version.versionNumber}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  backgroundColor: 'var(--gray-50)',
                  borderRadius: 'var(--radius)',
                  border: '1px solid var(--gray-200)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--accent)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    color: 'var(--primary)',
                    flexShrink: 0
                  }}>
                    v{version.versionNumber}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: '0.875rem', fontWeight: '500', color: 'var(--gray-800)' }}>
                      Version {version.versionNumber}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                      <Clock size={11} color="var(--gray-400)" />
                      <span style={{ fontSize: '0.75rem', color: 'var(--gray-500)', whiteSpace: 'nowrap' }}>
                        {formatDate(version.createdAt)} • {formatBytes(version.size)}
                      </span>
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                  <button
                    className="btn btn-success btn-sm"
                    onClick={() => onRestore(file, version.versionNumber)}
                    disabled={restoring || deleting}
                  >
                    <RotateCcw size={14} />
                    {restoring ? 'Restoring...' : 'Restore'}
                  </button>
                  <button
                    className="btn-icon-danger"
                    onClick={() => onDelete(file, version.versionNumber)}
                    disabled={restoring || deleting}
                    aria-label={`Delete version ${version.versionNumber}`}
                    title="Delete this version"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};

export default VersionHistoryModal;