import { useState, useRef, useEffect } from 'react';
import { X, Tag, Plus } from 'lucide-react';
import { useFocusTrap } from '../../hooks/useFocusTrap';

const TagsModal = ({ file, allTags = [], onSave, onClose, loading }) => {
  const dialogRef = useFocusTrap(true);
  const [tags, setTags] = useState(() => (file?.tags || []).slice());
  const [input, setInput] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const addTag = () => {
    const t = input.trim().toLowerCase();
    if (!t) return;
    if (t.length > 20) return;
    if (!tags.includes(t)) setTags([...tags, t]);
    setInput('');
  };

  const removeTag = (t) => setTags(tags.filter(x => x !== t));

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); addTag(); }
    if (e.key === 'Backspace' && !input && tags.length > 0) removeTag(tags[tags.length - 1]);
    if (e.key === 'Escape') onClose();
  };

  // Sugestions = all tags not already added
  const suggestions = allTags.filter(t => !tags.includes(t)).slice(0, 8);

  const handleSave = () => {
    const trimmed = [...new Set(tags.map(t => t.trim().toLowerCase()).filter(Boolean))].slice(0, 10);
    onSave(trimmed);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        ref={dialogRef}
        className="modal"
        style={{ maxWidth: '480px' }}
        role="dialog"
        aria-modal="true"
        aria-label={`Edit tags for ${file?.originalName}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Tag size={18} color="var(--primary-light)" />
            <div>
              <h3 className="modal-title">Edit Tags</h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>
                {file?.originalName}
              </p>
            </div>
          </div>
          <button className="btn-icon" onClick={onClose} aria-label="Close dialog">
            <X size={18} />
          </button>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="tag-input">Add a tag</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              ref={inputRef}
              id="tag-input"
              type="text"
              className="form-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a tag and press Enter"
              maxLength={20}
            />
            <button type="button" className="btn btn-ghost" onClick={addTag}>
              <Plus size={16} />
            </button>
          </div>
        </div>

        {tags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '16px' }}>
            {tags.map((t) => (
              <span
                key={t}
                className="badge badge-primary"
                style={{ fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
              >
                {t}
                <button
                  onClick={() => removeTag(t)}
                  aria-label={`Remove tag ${t}`}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'inherit', padding: '0', display: 'inline-flex'
                  }}
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        )}

        {suggestions.length > 0 && (
          <div style={{ marginBottom: '16px' }}>
            <p style={{ fontSize: '0.7rem', color: 'var(--gray-400)', marginBottom: '6px' }}>Suggestions</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {suggestions.map((t) => (
                <button
                  key={t}
                  className="badge badge-gray"
                  onClick={() => { if (!tags.includes(t)) setTags([...tags, t]); }}
                  style={{ fontSize: '0.75rem', cursor: 'pointer', border: 'none' }}
                >
                  + {t}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="modal-footer">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSave}
            disabled={loading}
          >
            <Tag size={16} />
            {loading ? 'Saving...' : 'Save Tags'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TagsModal;
