import { useEffect, useRef } from 'react';

const ContextMenu = ({ x, y, items, onClose }) => {
  const ref = useRef(null);

  useEffect(() => {
    const close = () => onClose();
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('click', close);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  if (!items || items.length === 0) return null;

  const MENU_WIDTH = 200;
  const ITEM_HEIGHT = 34;
  const estimateHeight = items.length * ITEM_HEIGHT + 14;
  const left = Math.min(x, window.innerWidth - MENU_WIDTH - 8);
  const top = Math.min(y, window.innerHeight - estimateHeight - 8);

  return (
    <div
      ref={ref}
      onClick={(e) => e.stopPropagation()}
      role="menu"
      style={{
        position: 'fixed',
        left: Math.max(8, left),
        top: Math.max(8, top),
        zIndex: 900,
        minWidth: `${MENU_WIDTH}px`,
        backgroundColor: 'var(--white)',
        borderRadius: 'var(--radius)',
        border: '1px solid var(--gray-200)',
        boxShadow: 'var(--shadow-lg)',
        padding: '6px'
      }}
    >
      {items.map((item, idx) => (
        item.separator ? (
          <div
            key={idx}
            style={{
              height: '1px',
              backgroundColor: 'var(--gray-200)',
              margin: '6px 4px'
            }}
          />
        ) : (
          <button
            key={idx}
            type="button"
            role="menuitem"
            onClick={() => {
              item.onClick?.();
              onClose();
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--accent)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
            style={{
              display: 'flex',
              width: '100%',
              gap: '10px',
              alignItems: 'center',
              padding: '7px 10px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              borderRadius: '6px',
              fontSize: '0.85rem',
              fontWeight: '500',
              color: item.danger ? 'var(--danger)' : 'var(--gray-700)'
            }}
          >
            <span style={{ display: 'flex', width: '16px', justifyContent: 'center' }}>
              {item.icon}
            </span>
            {item.label}
          </button>
        )
      ))}
    </div>
  );
};

export default ContextMenu;