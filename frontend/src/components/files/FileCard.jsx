import { useState } from 'react';
import { Folder, Pencil, Trash2, Check, Star } from 'lucide-react';

const FOLDER_COLORS = [
  '#1F3864', '#3B82F6', '#22C55E', '#F59E0B',
  '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6'
];

const FileCard = ({ folder, onOpen, onRename = () => {}, onDelete = () => {}, onColorChange = () => {}, onToggleStar = () => {}, onContextMenu = () => {} }) => {
  const [showPalette, setShowPalette] = useState(false);
  const color = folder.color || '#1F3864';

  return (
    <div
      onClick={() => onOpen(folder)}
      onContextMenu={(e) => onContextMenu(e, folder)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        gap: '10px',
        padding: '14px',
        backgroundColor: 'var(--white)',
        borderRadius: 'var(--radius)',
        border: '1px solid var(--gray-200)',
        cursor: 'pointer',
        transition: 'all 0.15s',
        position: 'relative',
        height: '100%',
        boxSizing: 'border-box'
      }}
      onMouseEnter={e => {
        e.currentTarget.style.backgroundColor = 'var(--accent)';
        e.currentTarget.style.borderColor = 'var(--primary-light)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.backgroundColor = 'var(--white)';
        e.currentTarget.style.borderColor = 'var(--gray-200)';
      }}
    >
      {/* Icon + action buttons row (actions don't squeeze the name) */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <Folder size={30} color={color} style={{ flexShrink: 0 }} />
        <div
          style={{ display: 'flex', gap: '2px', flexShrink: 0 }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="btn-icon"
            title={folder.starred ? "Remove from favorites" : "Add to favorites"}
            aria-label={`${folder.starred ? 'Unstar' : 'Star'} folder ${folder.name}`}
            onClick={() => onToggleStar(folder)}
            style={{ color: folder.starred ? '#F59E0B' : 'var(--gray-500)' }}
          >
            <Star size={14} fill={folder.starred ? '#F59E0B' : 'none'} />
          </button>
          <button
            className="btn-icon"
            title="Change folder color"
            aria-label={`Change color of folder ${folder.name}`}
            onClick={() => setShowPalette(s => !s)}
            style={{ color: 'var(--gray-500)' }}
          >
            <span style={{
              width: '12px', height: '12px', borderRadius: '50%',
              backgroundColor: color, display: 'inline-block', border: '1px solid var(--gray-300)'
            }} />
          </button>
          <button
            className="btn-icon"
            title="Rename folder"
            aria-label={`Rename folder ${folder.name}`}
            onClick={() => onRename(folder)}
            style={{ color: 'var(--primary-light)' }}
          >
            <Pencil size={14} />
          </button>
          <button
            className="btn-icon"
            title="Delete folder"
            aria-label={`Delete folder ${folder.name}`}
            onClick={() => onDelete(folder)}
            style={{ color: 'var(--danger)' }}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Full-width folder name */}
      <span
        title={folder.name}
        style={{
          fontSize: '0.875rem',
          fontWeight: '600',
          color: 'var(--gray-800)',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          wordBreak: 'break-word',
          lineHeight: 1.35,
          minHeight: '2.4em'
        }}
      >
        {folder.name}
      </span>

      {showPalette && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            zIndex: 20,
            backgroundColor: 'var(--white)',
            borderRadius: 'var(--radius)',
            boxShadow: 'var(--shadow-lg)',
            border: '1px solid var(--gray-200)',
            padding: '8px',
            display: 'flex',
            gap: '6px',
            flexWrap: 'wrap',
            width: 'fit-content'
          }}
        >
          {FOLDER_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => {
                onColorChange(folder, c);
                setShowPalette(false);
              }}
              title={c}
              aria-label={`Set folder color to ${c}`}
              style={{
                width: '22px', height: '22px', borderRadius: '50%',
                backgroundColor: c, border: c === color
                  ? '2px solid var(--gray-800)'
                  : '1px solid var(--gray-300)',
                cursor: 'pointer', display: 'flex', alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {c === color && <Check size={12} color="white" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default FileCard;