import { X, CheckCircle, AlertCircle, Upload, File } from 'lucide-react';
import { formatBytes } from '../../utils/formatters';

const UploadQueue = ({ uploads, onDismiss }) => {
  const active = uploads.filter(u => u.status === 'uploading').length;
  const finished = uploads.filter(u => u.status === 'done' || u.status === 'error').length;

  if (uploads.length === 0) return null;

  return (
    <div className="upload-queue-tray" style={{
      position: 'fixed',
      right: '20px',
      bottom: '20px',
      zIndex: 800,
      width: '320px',
      maxHeight: '50vh',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      overflowY: 'auto'
    }}>
      {uploads.map((u) => (
        <div
          key={u.id}
          style={{
            backgroundColor: 'var(--white)',
            borderRadius: 'var(--radius)',
            border: u.status === 'error'
              ? '1px solid var(--danger)'
              : '1px solid var(--gray-200)',
            boxShadow: 'var(--shadow-md)',
            padding: '12px 14px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <File size={16} color={u.status === 'error' ? 'var(--danger)' : 'var(--primary)'} style={{ flexShrink: 0 }} />
            <span style={{
              flex: 1,
              fontSize: '0.8rem',
              fontWeight: '600',
              color: 'var(--gray-800)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }} title={u.name}>
              {u.name}
            </span>
            {u.status === 'done' && (
              <CheckCircle size={16} color="var(--success)" style={{ flexShrink: 0 }} />
            )}
            {u.status === 'error' && (
              <AlertCircle size={16} color="var(--danger)" style={{ flexShrink: 0 }} />
            )}
            {(u.status !== 'uploading') && (
              <button
                className="btn-icon"
                onClick={() => onDismiss(u.id)}
                aria-label="Remove from upload queue"
                title="Remove"
                style={{ width: '20px', height: '20px', flexShrink: 0 }}
              >
                <X size={12} />
              </button>
            )}
          </div>

          {u.status === 'uploading' && (
            <>
              <div style={{
                height: '6px',
                backgroundColor: 'var(--gray-100)',
                borderRadius: '999px',
                marginTop: '8px',
                overflow: 'hidden'
              }}>
                <div style={{
                  height: '100%',
                  width: `${u.progress || 0}%`,
                  backgroundColor: 'var(--primary)',
                  borderRadius: '999px',
                  transition: 'width 0.15s'
                }} />
              </div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginTop: '4px',
                fontSize: '0.7rem',
                color: 'var(--gray-500)'
              }}>
                <span>Uploading... {formatBytes(u.loaded || 0)}</span>
                <span>{u.progress || 0}%</span>
              </div>
            </>
          )}
          {u.status === 'done' && (
            <div style={{
              marginTop: '6px',
              fontSize: '0.7rem',
              color: 'var(--success)',
              fontWeight: '600'
            }}>
              Uploaded successfully ({formatBytes(u.size || 0)})
            </div>
          )}
          {u.status === 'error' && (
            <div style={{
              marginTop: '6px',
              fontSize: '0.7rem',
              color: 'var(--danger)'
            }}>
              Upload failed
            </div>
          )}
        </div>
      ))}

      <button
        onClick={() => finished > 0 && uploads.filter(u => u.status === 'done' || u.status === 'error').forEach(u => onDismiss(u.id))}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          backgroundColor: 'var(--white)',
          border: '1px solid var(--gray-200)',
          borderRadius: 'var(--radius)',
          boxShadow: 'var(--shadow-md)',
          padding: '8px',
          fontSize: '0.75rem',
          fontWeight: '600',
          color: 'var(--gray-600)',
          cursor: 'pointer'
        }}
      >
        <Upload size={14} />
        {active > 0 ? `${active} uploading…` : `${finished} finished • Clear`}
      </button>
    </div>
  );
};

export default UploadQueue;
