import toast from 'react-hot-toast';
import ToastDismissButton from '../components/common/ToastDismissButton';

const actionButtonStyle = {
  flexShrink: 0,
  background: 'rgba(255,255,255,0.25)',
  border: 'none',
  color: 'white',
  borderRadius: '6px',
  padding: '4px 10px',
  fontSize: '0.75rem',
  fontWeight: '700',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  transition: 'background-color 0.15s'
};

const publish = (type, message, options) => {
  const { action, ...toastOptions } = options || {};
  let id;
  const content = (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', width: '100%' }}>
      <span style={{ flex: 1, wordBreak: 'break-word', lineHeight: 1.4 }}>{message}</span>
      {action && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            toast.dismiss(id);
            action.onClick?.();
          }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.4)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.25)'; }}
          style={actionButtonStyle}
        >
          {action.label}
        </button>
      )}
      <ToastDismissButton onDismiss={() => toast.dismiss(id)} />
    </div>
  );
  id = toast[type](content, toastOptions);
  return id;
};

// Drop-in replacement for react-hot-toast's toast.success/error/info that
// renders an X button so users can dismiss a notification instead of waiting
// for the 4s auto-hide.
export const notify = {
  success: (message, options) => publish('success', message, options),
  error: (message, options) => publish('error', message, options),
  info: (message, options) => publish('info', message, options)
};

export default notify;