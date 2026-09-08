import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Cloud, Eye, EyeOff, Lock, Mail } from 'lucide-react';
import useLocalState from '../hooks/useLocalState';

const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useLocalState('login:email', '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useLocalState('login:showPassword', false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const value = e.target.value;
    if (e.target.name === 'email') setEmail(value);
    else setPassword(value);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }
    setLoading(true);
    const result = await login(email, password);
    setLoading(false);
    if (result.success) {
      navigate('/dashboard');
    } else {
      setError(result.message);
      setPassword('');
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      backgroundColor: 'var(--gray-50)',
      fontFamily: 'var(--font-sans)'
    }}>
      {/* Left panel */}
      <div style={{
        flex: 1,
        background: 'linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '60px',
        color: 'white',
        position: 'relative',
        overflow: 'hidden'
      }}
        className="hide-mobile"
      >
        {/* Subtle decorative grid/glow inside panel */}
        <div style={{
          position: 'absolute',
          top: '-10%',
          right: '-10%',
          width: '300px',
          height: '300px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(59,130,246,0.15) 0%, transparent 70%)',
          pointerEvents: 'none'
        }} />
        <div style={{
          position: 'absolute',
          bottom: '-10%',
          left: '-10%',
          width: '350px',
          height: '350px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(99,102,241,0.1) 0%, transparent 70%)',
          pointerEvents: 'none'
        }} />

        <div style={{
          width: '80px',
          height: '80px',
          backgroundColor: 'rgba(255,255,255,0.08)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: '22px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '32px',
          boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.2)',
          zIndex: 1
        }}>
          <Cloud size={40} color="white" />
        </div>
        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: '2.75rem',
          fontWeight: '800',
          color: 'white',
          marginBottom: '16px',
          textAlign: 'center',
          letterSpacing: '-0.03em',
          zIndex: 1
        }}>
          CloudSewa
        </h1>
        <p style={{
          fontSize: '1.125rem',
          color: 'rgba(255,255,255,0.75)',
          textAlign: 'center',
          maxWidth: '380px',
          lineHeight: 1.7,
          zIndex: 1,
          fontWeight: '500'
        }}>
          Secure cloud file storage and automated backup system for small businesses in Nepal.
        </p>

        <div style={{ marginTop: '60px', display: 'flex', flexDirection: 'column', gap: '20px', zIndex: 1 }}>
          {[
            { icon: '🔒', text: 'AES-256 encrypted file storage' },
            { icon: '⚡', text: 'Automated backup scheduling' },
            { icon: '👥', text: 'Role-based access control' },
            { icon: '📊', text: 'Real-time admin dashboard' }
          ].map((item, i) => (
            <div key={i} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              color: 'rgba(255,255,255,0.85)',
              fontSize: '0.95rem',
              fontWeight: '500'
            }}>
              <span style={{ fontSize: '1.25rem' }}>{item.icon}</span>
              {item.text}
            </div>
          ))}
        </div>
      </div>

      {/* Right panel — form */}
      <div className="auth-panel" style={{
        width: '480px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '60px 48px',
        backgroundColor: 'var(--white)'
      }}>
        <div style={{ width: '100%', maxWidth: '360px' }}>
          <div style={{ marginBottom: '40px' }}>
            <h2 style={{
              fontSize: '1.75rem',
              fontWeight: '700',
              color: 'var(--gray-900)',
              marginBottom: '8px'
            }}>
              Welcome back
            </h2>
            <p style={{ color: 'var(--gray-500)', fontSize: '0.9rem' }}>
              Sign in to your CloudSewa account
            </p>
          </div>

          {error && (
            <div style={{
              padding: '12px 16px',
              backgroundColor: 'var(--danger-light)',
              border: '1px solid var(--danger)',
              borderRadius: 'var(--radius)',
              color: 'var(--danger)',
              fontSize: '0.875rem',
              marginBottom: '20px'
            }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="login-email">Email Address</label>
              <div style={{ position: 'relative' }}>
                <Mail
                  size={16}
                  style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--gray-400)'
                  }}
                />
                <input
                  id="login-email"
                  type="email"
                  name="email"
                  className="form-input"
                  placeholder="your@email.com"
                  value={email}
                  onChange={handleChange}
                  style={{ paddingLeft: '40px' }}
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="login-password">Password</label>
              <div style={{ position: 'relative' }}>
                <Lock
                  size={16}
                  style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--gray-400)'
                  }}
                />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  className="form-input"
                  placeholder="Enter your password"
                  value={password}
                  onChange={handleChange}
                  style={{ paddingLeft: '40px', paddingRight: '40px' }}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--gray-400)',
                    padding: '0',
                    display: 'flex'
                  }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-full"
              disabled={loading}
              style={{ marginTop: '8px', height: '44px' }}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div style={{ textAlign: 'right', marginTop: '8px', marginBottom: '4px' }}>
            <Link
              to="/forgot-password"
              style={{
                fontSize: '0.8rem',
                color: 'var(--primary-light)'
              }}
            >
              Forgot your password?
            </Link>
          </div>

          <p style={{
            textAlign: 'center',
            marginTop: '24px',
            fontSize: '0.875rem',
            color: 'var(--gray-500)'
          }}>
            Don't have an account?{' '}
            <Link
              to="/register"
              style={{ color: 'var(--primary-light)', fontWeight: '500' }}
            >
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;