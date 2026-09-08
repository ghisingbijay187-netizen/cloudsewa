import { useState } from 'react';
import FileCard from './FileCard';

const PREVIEW_COUNT = 6;

const FolderTree = ({ folders, onOpenFolder, onRenameFolder, onDeleteFolder, onColorChange, onToggleStar, onContextMenu }) => {
  const [showAll, setShowAll] = useState(false);

  if (folders.length === 0) return null;

  const visible = showAll ? folders : folders.slice(0, PREVIEW_COUNT);

  return (
    <div style={{ marginBottom: '24px' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '12px'
      }}>
        <h3 style={{
          fontSize: '0.8rem',
          fontWeight: '600',
          color: 'var(--gray-500)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          margin: 0
        }}>
          Folders
        </h3>
        {folders.length > PREVIEW_COUNT && (
          <button
            onClick={() => setShowAll(s => !s)}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              fontSize: '0.8rem',
              fontWeight: '600',
              color: 'var(--primary)'
            }}
          >
            {showAll
              ? 'Show less'
              : `Show all (${folders.length})`}
          </button>
        )}
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
        gap: '12px'
      }}>
        {visible.map((folder) => (
          <FileCard
            key={folder._id}
            folder={folder}
            onOpen={onOpenFolder}
            onRename={onRenameFolder}
            onDelete={onDeleteFolder}
            onColorChange={onColorChange}
            onToggleStar={onToggleStar}
            onContextMenu={onContextMenu}
          />
        ))}
      </div>
      {!showAll && folders.length - visible.length > 0 && (
        <div style={{
          marginTop: '10px',
          fontSize: '0.8rem',
          color: 'var(--gray-500)'
        }}>
          {folders.length - visible.length} more folder{folders.length - visible.length !== 1 ? 's' : ''} hidden
        </div>
      )}
    </div>
  );
};

export default FolderTree;