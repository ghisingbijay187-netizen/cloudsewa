import { X } from 'lucide-react';

const dismissButtonStyle = {
  background: 'rgba(255,255,255,0.18)',
  border: 'none',
  borderRadius: '50%',
  width: '20px',
  height: '20px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  color: 'rgba(255,255,255,0.9)',
  padding: 0,
  flexShrink: 0,
  marginTop: '2px',
  transition: 'background-color 0.15s'
};

const ToastDismissButton = ({ onDismiss }) => (
  <button
    type="button"
    aria-label="Dismiss notification"
    title="Dismiss"
    onClick={(e) => {
      e.stopPropagation();
      onDismiss();
    }}
    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.32)'; }}
    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.18)'; }}
    style={dismissButtonStyle}
  >
    <X size={12} />
  </button>
);

export default ToastDismissButton;