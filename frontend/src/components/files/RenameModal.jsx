import { useState, useRef, useEffect } from 'react';
import { X, Pencil } from 'lucide-react';
import { useFocusTrap } from '../../hooks/useFocusTrap';

const RenameModal = ({ currentName, onRename, onClose, loading }) => {
  const dialogRef = useFocusTrap(true);
  const [name, setName] = useState(currentName || '');
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.select();
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || trimmed === currentName) return;
    onRename(trimmed);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        ref={dialogRef}
        className="modal"
        style={{ maxWidth: '440px' }}
        role="dialog"
        aria-modal="true"
        aria-label={`Rename ${currentName}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Pencil size={18} color="var(--primary-light)" />
            <h3 className="modal-title">Rename</h3>
          </div>
          <button className="btn-icon" onClick={onClose} aria-label="Close dialog">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="rename-input">New name</label>
            <input
              ref={inputRef}
              id="rename-input"
              type="text"
              className="form-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter new name"
              onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
              autoFocus
            />
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading || !name.trim() || name.trim() === currentName}
            >
              {loading ? 'Renaming...' : 'Rename'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RenameModal;