import { useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import API from '../api/axios';
import { Cloud, Lock, Eye, EyeOff, CheckCircle, ArrowLeft } from 'lucide-react';
import { validatePassword } from '../utils/validation';

const ResetPassword = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.password || !formData.confirmPassword) {
      setError('Please fill in all fields');
      return;
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    const passwordError = validatePassword(formData.password);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    try {
      setLoading(true);
      await API.put(`/auth/reset-password/${token}`, {
        password: formData.password
      });

      setSuccess(true);

      // Auto redirect to dashboard after 3 seconds
      setTimeout(() => {
        navigate('/login');
      }, 3000);

    } catch (error) {
      setError(error.response?.data?.message || 'Reset failed. The link may have expired.');
    } finally {
      setLoading(false);
    }
  };

  const getPasswordStrength = () => {
    const pwd = formData.password;
    if (!pwd) return null;
    if (pwd.length < 8) return { level: 1, label: 'Too short', color: 'var(--danger)' };
    if (pwd.match(/[A-Z]/) && pwd.match(/[0-9]/) && pwd.match(/[^A-Za-z0-9]/))
      return { level: 4, label: 'Very strong', color: 'var(--success)' };
    if (pwd.match(/[A-Z]/) && pwd.match(/[0-9]/))
      return { level: 3, label: 'Strong', color: 'var(--success)' };
    if (pwd.match(/[A-Z]/) || pwd.match(/[0-9]/))
      return { level: 2, label: 'Moderate', color: 'var(--warning)' };
    return { level: 1, label: 'Weak', color: 'var(--danger)' };
  };

  const strength = getPasswordStrength();

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      backgroundColor: 'var(--gray-50)'
    }}>
      {/* Left panel */}
      <div className="hide-mobile" style={{
        flex: 1,
        backgroundColor: 'var(--primary)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '60px'
      }}>
        <div style={{
          width: '80px',
          height: '80px',
          backgroundColor: 'rgba(255,255,255,0.15)',
          borderRadius: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '32px'
        }}>
          <Cloud size={40} color="white" />
        </div>
        <h1 style={{
          fontSize: '2.5rem',
          fontWeight: '700',
          color: 'white',
          marginBottom: '16px',
          textAlign: 'center'
        }}>
          CloudSewa
        </h1>
        <p style={{
          fontSize: '1.125rem',
          color: 'rgba(255,255,255,0.75)',
          textAlign: 'center',
          maxWidth: '360px',
          lineHeight: 1.7
        }}>
          Secure cloud file storage and automated backup system for small businesses in Nepal.
        </p>
      </div>

      {/* Right panel */}
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

          {!success ? (
            <>
              <div style={{ marginBottom: '36px' }}>
                <h2 style={{
                  fontSize: '1.75rem',
                  fontWeight: '700',
                  color: 'var(--gray-900)',
                  marginBottom: '8px'
                }}>
                  Reset password
                </h2>
                <p style={{ color: 'var(--gray-500)', fontSize: '0.9rem' }}>
                  Enter your new password below. Make sure it is at least 8 characters long.
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
                  {error.includes('expired') && (
                    <div style={{ marginTop: '8px' }}>
                      <Link
                        to="/forgot-password"
                        style={{
                          color: 'var(--danger)',
                          fontWeight: '600',
                          textDecoration: 'underline'
                        }}
                      >
                        Request a new reset link
                      </Link>
                    </div>
                  )}
                </div>
              )}

              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label className="form-label" htmlFor="reset-new-pw">New Password</label>
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
                      id="reset-new-pw"
                      type={showPassword ? 'text' : 'password'}
                      className="form-input"
                      placeholder="Min 8 chars, upper+lower+number+symbol"
                      value={formData.password}
                      onChange={(e) => {
                        setFormData({ ...formData, password: e.target.value });
                        setError('');
                      }}
                      style={{ paddingLeft: '40px', paddingRight: '40px' }}
                      autoFocus
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
                        display: 'flex'
                      }}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>

                  {/* Password strength */}
                  {strength && (
                    <div style={{ marginTop: '8px' }}>
                      <div style={{
                        display: 'flex',
                        gap: '4px',
                        marginBottom: '4px'
                      }}>
                        {[1, 2, 3, 4].map((level) => (
                          <div
                            key={level}
                            style={{
                              flex: 1,
                              height: '4px',
                              borderRadius: '2px',
                              backgroundColor: level <= strength.level
                                ? strength.color
                                : 'var(--gray-200)',
                              transition: 'background-color 0.2s'
                            }}
                          />
                        ))}
                      </div>
                      <p style={{
                        fontSize: '0.75rem',
                        color: strength.color
                      }}>
                        {strength.label}
                      </p>
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="reset-confirm-pw">Confirm New Password</label>
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
                      id="reset-confirm-pw"
                      type={showPassword ? 'text' : 'password'}
                      className="form-input"
                      placeholder="Repeat new password"
                      value={formData.confirmPassword}
                      onChange={(e) => {
                        setFormData({ ...formData, confirmPassword: e.target.value });
                        setError('');
                      }}
                      style={{ paddingLeft: '40px' }}
                    />
                  </div>
                  {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                    <p style={{
                      fontSize: '0.75rem',
                      color: 'var(--danger)',
                      marginTop: '4px'
                    }}>
                      Passwords do not match
                    </p>
                  )}
                  {formData.confirmPassword && formData.password === formData.confirmPassword && (
                    <p style={{
                      fontSize: '0.75rem',
                      color: 'var(--success)',
                      marginTop: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <CheckCircle size={12} /> Passwords match
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  className="btn btn-primary btn-full"
                  disabled={loading}
                  style={{ height: '44px', marginTop: '8px' }}
                >
                  {loading ? 'Resetting...' : 'Reset Password'}
                </button>
              </form>
            </>
          ) : (
            /* Success state */
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: '72px',
                height: '72px',
                backgroundColor: 'var(--success-light)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 24px'
              }}>
                <CheckCircle size={36} color="var(--success)" />
              </div>
              <h2 style={{
                fontSize: '1.5rem',
                fontWeight: '700',
                color: 'var(--gray-900)',
                marginBottom: '12px'
              }}>
                Password reset!
              </h2>
              <p style={{
                color: 'var(--gray-500)',
                fontSize: '0.9rem',
                lineHeight: 1.7,
                marginBottom: '24px'
              }}>
                Your password has been reset successfully.
                Redirecting you to login in 3 seconds...
              </p>
              <button
                className="btn btn-primary btn-full"
                onClick={() => navigate('/login')}
              >
                Go to Login Now
              </button>
            </div>
          )}

          {!success && (
            <div style={{ marginTop: '28px', textAlign: 'center' }}>
              <Link
                to="/login"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  color: 'var(--primary-light)',
                  fontSize: '0.875rem',
                  fontWeight: '500'
                }}
              >
                <ArrowLeft size={14} />
                Back to login
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;