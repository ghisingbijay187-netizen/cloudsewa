const LoadingSpinner = ({ fullScreen = true, message = 'Loading...' }) => {
  if (fullScreen) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        gap: '16px',
        backgroundColor: 'var(--gray-50)'
      }}>
        <div style={{
          width: '48px',
          height: '48px',
          border: '4px solid var(--gray-200)',
          borderTopColor: 'var(--primary-light)',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite'
        }} />
        <p style={{
          color: 'var(--gray-500)',
          fontSize: '0.875rem'
        }}>
          {message}
        </p>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="loading-spinner">
      <div className="spinner" />
    </div>
  );
};

export default LoadingSpinner;