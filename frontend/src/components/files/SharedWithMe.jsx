import { useState } from 'react';
import { Users, ChevronRight, Eye, Download, UserCheck } from 'lucide-react';
import { formatBytes } from '../../utils/formatters';
import { getFileIcon, canPreview, getFileTypeLabel } from '../../utils/fileHelpers.jsx';

const SharedWithMe = ({ sharedFiles, onPreview, onDownload }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={{ marginBottom: '20px' }}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '10px 16px',
          backgroundColor: 'var(--white)',
          border: '1px solid var(--gray-200)',
          borderRadius: 'var(--radius)',
          cursor: 'pointer',
          fontSize: '0.875rem',
          fontWeight: '500',
          color: 'var(--gray-700)',
          width: '100%',
          justifyContent: 'space-between'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Users size={16} color="var(--primary-light)" />
          Shared With Me
          <span className="badge badge-primary">{sharedFiles.length}</span>
        </div>
        <ChevronRight
          size={16}
          style={{
            transform: expanded ? 'rotate(90deg)' : 'rotate(0)',
            transition: 'transform 0.2s'
          }}
        />
      </button>

      {expanded && (
        <div className="card" style={{ padding: 0, marginTop: '8px' }}>
          {sharedFiles.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center' }}>
              <Users size={32} color="var(--gray-300)" style={{ marginBottom: '12px' }} />
              <p style={{ fontSize: '0.875rem', fontWeight: '500', color: 'var(--gray-600)' }}>
                No files shared with you yet
              </p>
              <p style={{ fontSize: '0.8rem', color: 'var(--gray-400)', marginTop: '4px' }}>
                When someone shares a file with you, it will appear here.
              </p>
            </div>
          ) : (
            <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Shared By</th>
                  <th>Size</th>
                  <th>Type</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sharedFiles.map((file) => (
                  <tr key={file._id}>
                    <td data-label="Name">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {getFileIcon(file.mimetype)}
                        <span style={{
                          fontWeight: '500',
                          color: 'var(--gray-800)',
                          maxWidth: '220px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {file.originalName}
                        </span>
                      </div>
                    </td>
                    <td data-label="Shared By">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <UserCheck size={14} color="var(--success)" />
                        <span style={{ fontSize: '0.8rem', color: 'var(--gray-600)' }}>
                          {file.owner?.name || 'Unknown'}
                        </span>
                      </div>
                    </td>
                    <td data-label="Size" style={{ color: 'var(--gray-500)', fontSize: '0.875rem' }}>
                      {formatBytes(file.size)}
                    </td>
                    <td data-label="Type">
                      <span className="badge badge-gray">
                        {getFileTypeLabel(file.mimetype)}
                      </span>
                    </td>
                    <td data-label="Actions">
                      <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                        {canPreview(file.mimetype) && (
                          <button
                            className="btn-icon"
                            onClick={() => onPreview(file)}
                            title="Preview"
                            style={{ color: 'var(--primary-light)' }}
                          >
                            <Eye size={16} />
                          </button>
                        )}
                        <button
                          className="btn-icon"
                          onClick={() => onDownload(file)}
                          title="Download"
                        >
                          <Download size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SharedWithMe;
