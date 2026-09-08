import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import { ACTION_TYPES } from './activityHelpers';

const ActivityFilters = ({
  action, startDate, endDate,
  onActionChange, onStartDateChange, onEndDateChange, onReset
}) => {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const triggerRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      const inside =
        (triggerRef.current && triggerRef.current.contains(e.target)) ||
        (listRef.current && listRef.current.contains(e.target));
      if (!inside) setOpen(false);
    };
    const handleWindowScroll = () => setOpen(false);
    const handleResize = () => setOpen(false);
    document.addEventListener('click', handleClick);
    window.addEventListener('scroll', handleWindowScroll);
    window.addEventListener('resize', handleResize);
    return () => {
      document.removeEventListener('click', handleClick);
      window.removeEventListener('scroll', handleWindowScroll);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const toggleOpen = () => {
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    }
    setOpen((o) => !o);
  };

  const currentLabel = ACTION_TYPES.find((a) => a.value === action)?.label || 'All Actions';

  return (
    <div className="card" style={{ marginBottom: '20px' }}>
      <div className="activity-filters" style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr auto',
        gap: '16px',
        alignItems: 'end'
      }}>
        <div className="form-group" style={{ marginBottom: 0, minWidth: 0 }}>
          <label className="form-label" htmlFor="af-action">Action Type</label>
          <button
            ref={triggerRef}
            type="button"
            id="af-action"
            className="form-select filter-select-trigger"
            onClick={toggleOpen}
            aria-haspopup="listbox"
            aria-expanded={open}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {currentLabel}
            </span>
            <ChevronDown
              size={15}
              style={{
                flexShrink: 0,
                transform: open ? 'rotate(180deg)' : 'none',
                transition: 'transform 0.2s'
              }}
            />
          </button>
          {open && pos && createPortal(
            <div
              ref={listRef}
              className="filter-dropdown"
              role="listbox"
              style={{ top: pos.top, left: pos.left, width: pos.width }}
            >
              {ACTION_TYPES.map((a) => (
                <button
                  key={a.value}
                  type="button"
                  role="option"
                  aria-selected={a.value === action}
                  className={`filter-dropdown-option${a.value === action ? ' active' : ''}`}
                  onClick={() => { onActionChange(a.value); setOpen(false); }}
                >
                  {a.label}
                </button>
              ))}
            </div>,
            document.body
          )}
        </div>

        <div className="form-group" style={{ marginBottom: 0, minWidth: 0 }}>
          <label className="form-label" htmlFor="af-start">Start Date</label>
          <input
            id="af-start"
            type="date"
            className="form-input"
            value={startDate}
            onChange={(e) => onStartDateChange(e.target.value)}
          />
        </div>

        <div className="form-group" style={{ marginBottom: 0, minWidth: 0 }}>
          <label className="form-label" htmlFor="af-end">End Date</label>
          <input
            id="af-end"
            type="date"
            className="form-input"
            value={endDate}
            onChange={(e) => onEndDateChange(e.target.value)}
          />
        </div>

        <button className="btn btn-ghost" onClick={onReset}>
          Reset
        </button>
      </div>
    </div>
  );
};

export default ActivityFilters;