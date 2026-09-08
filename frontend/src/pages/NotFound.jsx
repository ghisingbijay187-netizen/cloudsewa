import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Home, ArrowLeft, Cloud } from 'lucide-react';

const NotFound = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'var(--gray-50)',
      padding: '24px',
      textAlign: 'center'
    }}>
      {/* Logo */}
      <div style={{
        width: '64px',
        height: '64px',
        borderRadius: '16px',
        backgroundColor: 'var(--primary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '24px'
      }}>
        <Cloud size={32} color="white" />
      </div>

      {/* 404 number */}
      <h1 style={{
        fontSize: '8rem',
        fontWeight: '800',
        color: 'var(--gray-200)',
        lineHeight: 1,
        marginBottom: '8px',
        letterSpacing: '-4px'
      }}>
        404
      </h1>

      <h2 style={{
        fontSize: '1.5rem',
        fontWeight: '700',
        color: 'var(--gray-900)',
        marginBottom: '12px'
      }}>
        Page Not Found
      </h2>

      <p style={{
        fontSize: '1rem',
        color: 'var(--gray-500)',
        maxWidth: '400px',
        lineHeight: 1.6,
        marginBottom: '40px'
      }}>
        The page you are looking for does not exist or has been moved.
        Please check the URL or return to the dashboard.
      </p>

      {/* Buttons */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
        <button
          className="btn btn-ghost"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft size={16} />
          Go Back
        </button>
        <button
          className="btn btn-primary"
          onClick={() => navigate(isAuthenticated ? '/dashboard' : '/login')}
        >
          <Home size={16} />
          {isAuthenticated ? 'Go to Dashboard' : 'Go to Login'}
        </button>
      </div>
    </div>
  );
};

export default NotFound;