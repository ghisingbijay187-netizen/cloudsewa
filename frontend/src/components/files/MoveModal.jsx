import { useState, useEffect } from 'react';
import { X, Folder, FolderOpen, ChevronRight, Check, Loader, Home } from 'lucide-react';
import API from '../../api/axios';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { notify as toast } from '../../utils/notify';

const MoveModal = ({ file, currentFolderId, onMove, onClose, loading }) => {
  const dialogRef = useFocusTrap(true);
  const [path, setPath] = useState([]);
  const [folders, setFolders] = useState([]);
  const [subLoading, setSubLoading] = useState(false);
  const [selectedId, setSelectedId] = useState(currentFolderId || null);
  const [selectedName, setSelectedName] = useState('My Files (root)');

  useEffect(() => {
    let active = true;
    setSubLoading(true);
    const parentId = path.length ? path[path.length - 1].id : null;
    API.get(`/files/folders${parentId ? `?folderId=${parentId}` : ''}`)
      .then(({ data }) => { if (active) setFolders(data.folders || []); })
      .catch(() => { if (active) { setFolders([]); toast.error('Failed to load folders'); } })
      .finally(() => { if (active) setSubLoading(false); });
    return () => { active = false; };
  }, [path]);

  const selectRoot = () => {
    setSelectedId(null);
    setSelectedName('My Files (root)');
  };

  const navigateInto = (folder) => {
    setPath((p) => [...p, { id: folder._id, name: folder.name }]);
  };

  const navigateTo = (idx) => {
    const next = path.slice(0, idx);
    setPath(next);
  };

  const currentParentId = path.length ? path[path.length - 1].id : null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        ref={dialogRef}
        className="modal"
        style={{ maxWidth: '480px' }}
        role="dialog"
        aria-modal="true"
        aria-label={`Move ${file.originalName}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <h3 className="modal-title">Move File</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--gray-500)', marginTop: '4px' }}>
              {file.originalName}
            </p>
          </div>
          <button className="btn-icon" onClick={onClose} aria-label="Close dialog">
            <X size={18} />
          </button>
        </div>

        {/* Breadcrumb navigation */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          padding: '8px 12px',
          backgroundColor: 'var(--gray-50)',
          borderRadius: 'var(--radius)',
          border: '1px solid var(--gray-200)',
          marginBottom: '12px',
          flexWrap: 'wrap',
          fontSize: '0.8rem'
        }}>
          <button
            onClick={selectRoot}
            style={{
              background: selectedId === null ? 'var(--primary-light)' : 'none',
              color: selectedId === null ? 'white' : 'var(--primary-light)',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              padding: '4px 8px',
              cursor: 'pointer',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <Home size={13} />
            Root
          </button>
          {path.map((p, idx) => (
            <span key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <ChevronRight size={13} color="var(--gray-400)" />
              <button
                onClick={() => navigateTo(idx + 1)}
                style={{
                  background: 'none',
                  color: 'var(--gray-600)',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: '500',
                  padding: '4px 6px',
                  borderRadius: 'var(--radius-sm)'
                }}
              >
                {p.name}
              </button>
            </span>
          ))}
        </div>

        {/* Select current folder as destination */}
        <button
          onClick={() => {
            setSelectedId(currentParentId);
            setSelectedName(path.length ? path[path.length - 1].name : 'My Files (root)');
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 12px',
            border: '1px solid var(--gray-200)',
            borderRadius: 'var(--radius)',
            backgroundColor:
              selectedId === currentParentId
                ? 'var(--accent)'
                : 'var(--white)',
            borderStyle:
              selectedId === currentParentId ? 'solid' : 'dashed',
            borderColor:
              selectedId === currentParentId ? 'var(--primary-light)' : 'var(--gray-300)',
            width: '100%',
            cursor: 'pointer',
            marginBottom: '12px'
          }}
        >
          {selectedId === currentParentId ? (
            <Check size={16} color="var(--primary-light)" />
          ) : (
            <Folder size={16} color="var(--gray-400)" />
          )}
          <span style={{
            fontSize: '0.875rem',
            fontWeight: selectedId === currentParentId ? '600' : '400',
            color: selectedId === currentParentId ? 'var(--primary)' : 'var(--gray-600)'
          }}>
            Move to "{path.length ? path[path.length - 1].name : 'My Files (root)'}"
          </span>
        </button>

        {/* Subfolder list */}
        <div style={{
          fontSize: '0.75rem',
          fontWeight: '600',
          color: 'var(--gray-500)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: '8px'
        }}>
          {subLoading ? 'Loading...' : 'Sub-folders'}
        </div>

        {subLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '24px' }}>
            <Loader size={20} className="spin" style={{ animation: 'spin 1s linear infinite' }} />
          </div>
        ) : folders.length === 0 ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '24px',
            color: 'var(--gray-400)',
            fontSize: '0.875rem'
          }}>
            <FolderOpen size={28} style={{ marginBottom: '8px' }} />
            <span>No sub-folders</span>
          </div>
        ) : (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            maxHeight: '220px',
            overflowY: 'auto'
          }}>
            {folders.map((folder) => (
              <div
                key={folder._id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius)',
                  border: '1px solid var(--gray-200)',
                  backgroundColor: 'var(--white)',
                  cursor: 'pointer'
                }}
              >
                <div
                  onClick={() => navigateInto(folder)}
                  style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, cursor: 'pointer' }}
                >
                  <Folder size={18} color="var(--primary)" />
                  <span style={{ fontSize: '0.875rem', color: 'var(--gray-700)', fontWeight: '500' }}>
                    {folder.name}
                  </span>
                </div>
                <button
                  onClick={() => {
                    setSelectedId(folder._id);
                    setSelectedName(folder.name);
                  }}
                  style={{
                    border: 'none',
                    background: selectedId === folder._id ? 'var(--accent)' : 'transparent',
                    borderRadius: 'var(--radius-sm)',
                    padding: '4px 8px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '0.75rem',
                    color: selectedId === folder._id ? 'var(--primary)' : 'var(--gray-400)'
                  }}
                >
                  {selectedId === folder._id && <Check size={13} />}
                  {selectedId === folder._id ? 'Selected' : 'Select'}
                </button>
                <button
                  onClick={() => navigateInto(folder)}
                  style={{
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    color: 'var(--gray-400)'
                  }}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={() => onMove(selectedId)}
            disabled={loading || selectedId === currentFolderId}
          >
            {loading ? 'Moving...' : (selectedId === currentFolderId ? 'Already here' : `Move to ${selectedName}`)}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MoveModal;