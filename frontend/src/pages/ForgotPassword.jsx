import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import API from '../api/axios';
import {
  Cloud, Mail, ArrowLeft, Clock,
  CheckCircle, XCircle, Lock, Eye, EyeOff,
  RefreshCw
} from 'lucide-react';
import useSessionState from '../hooks/useSessionState';

const ForgotPassword = () => {
  const [step, setStep] = useSessionState('fp:step', 'form'); // form | pending | approved | rejected | success
  const [email, setEmail] = useSessionState('fp:email', '');
  const [requestId, setRequestId] = useSessionState('fp:requestId', null);
  const [requestToken, setRequestToken] = useSessionState('fp:requestToken', '');
  const [loading, setLoading] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [error, setError] = useState('');
  const [rejectedReason, setRejectedReason] = useSessionState('fp:reason', '');
  const [resetToken, setResetToken] = useSessionState('fp:resetToken', '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [resetting, setResetting] = useState(false);

  // Auto check status every 30 seconds when pending
  useEffect(() => {
    if (step !== 'pending' || !requestId) return;
    const interval = setInterval(() => {
      handleCheckStatus(true);
    }, 30000);
    return () => clearInterval(interval);
  }, [step, requestId]);

  // Recover from a persisted 'pending' step whose credentials were lost
  useEffect(() => {
    if (step === 'pending' && !requestId) {
      setError('Your previous request is no longer valid. Please submit a new one.');
      setStep('form');
    }
  }, [step, requestId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email) {
      setError('Please enter your email address');
      return;
    }
    try {
      setLoading(true);
      const { data } = await API.post('/auth/forgot-password', { email });
      if (data.requestId && data.requestToken) {
        setRequestId(data.requestId);
        setRequestToken(data.requestToken || '');
        setStep('pending');
      } else {
        setError(data.message || 'Something went wrong. Please try again.');
      }
    } catch (error) {
      setError(error.response?.data?.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckStatus = async (silent = false) => {
    if (!requestId || !requestToken) {
      if (!silent) {
        setError('Your password reset request is no longer valid. Please submit a new one.');
        setStep('form');
      }
      return;
    }
    try {
      if (!silent) setCheckingStatus(true);
      const { data } = await API.get(
        `/auth/reset-status/${requestId}?requestToken=${encodeURIComponent(requestToken)}`
      );

      if (data.status === 'approved' && data.resetToken) {
        setResetToken(data.resetToken);
        setStep('approved');
      } else if (data.status === 'rejected') {
        setRejectedReason(data.rejectedReason || 'Request rejected by administrator');
        setStep('rejected');
      }
    } catch {
      if (!silent) setError('Failed to check status. Please try again.');
    } finally {
      if (!silent) setCheckingStatus(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');
    if (!password || !confirmPassword) {
      setError('Please fill in all fields');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    try {
      setResetting(true);
      await API.put(`/auth/reset-password/${resetToken}`, { password });
      setStep('success');
    } catch (error) {
      setError(error.response?.data?.message || 'Reset failed. Please try again.');
    } finally {
      setResetting(false);
    }
  };

  const getPasswordStrength = () => {
    if (!password) return null;
    if (password.length < 8) return { level: 1, label: 'Too short', color: 'var(--danger)' };
    if (password.match(/[A-Z]/) && password.match(/[0-9]/))
      return { level: 3, label: 'Strong', color: 'var(--success)' };
    if (password.match(/[A-Z]/) || password.match(/[0-9]/))
      return { level: 2, label: 'Moderate', color: 'var(--warning)' };
    return { level: 1, label: 'Weak', color: 'var(--danger)' };
  };

  const strength = getPasswordStrength();

  return (
    <div style={{ minHeight: '100vh', display: 'flex', backgroundColor: 'var(--gray-50)' }}>

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
          width: '80px', height: '80px',
          backgroundColor: 'rgba(255,255,255,0.15)',
          borderRadius: '20px', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          marginBottom: '32px'
        }}>
          <Cloud size={40} color="white" />
        </div>
        <h1 style={{
          fontSize: '2.5rem', fontWeight: '700',
          color: 'white', marginBottom: '16px', textAlign: 'center'
        }}>
          CloudSewa
        </h1>
        <p style={{
          fontSize: '1.125rem', color: 'rgba(255,255,255,0.75)',
          textAlign: 'center', maxWidth: '360px', lineHeight: 1.7
        }}>
          Secure cloud file storage and automated backup system for small businesses in Nepal.
        </p>

        {/* Security note */}
        <div style={{
          marginTop: '40px', padding: '20px',
          backgroundColor: 'rgba(255,255,255,0.08)',
          borderRadius: 'var(--radius-lg)', maxWidth: '320px', width: '100%'
        }}>
          <p style={{
            fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)',
            marginBottom: '8px', textTransform: 'uppercase',
            letterSpacing: '0.05em', fontWeight: '600'
          }}>
            Security Policy
          </p>
          <p style={{
            fontSize: '0.875rem', color: 'rgba(255,255,255,0.8)', lineHeight: 1.6
          }}>
            Password resets require administrator approval to protect your business data.
            Your admin will verify your identity before granting access.
          </p>
        </div>
      </div>

      {/* Right panel */}
      <div className="auth-panel" style={{
        width: '480px', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '60px 48px', backgroundColor: 'var(--white)', overflowY: 'auto'
      }}>
        <div style={{ width: '100%', maxWidth: '360px' }}>

          {/* ── STEP 1: Submit email ── */}
          {step === 'form' && (
            <>
              <div style={{ marginBottom: '36px' }}>
                <h2 style={{
                  fontSize: '1.75rem', fontWeight: '700',
                  color: 'var(--gray-900)', marginBottom: '8px'
                }}>
                  Forgot password?
                </h2>
                <p style={{ color: 'var(--gray-500)', fontSize: '0.9rem' }}>
                  Enter your email address. Your administrator will review
                  and approve your password reset request.
                </p>
              </div>

              {error && (
                <div style={{
                  padding: '12px 16px', backgroundColor: 'var(--danger-light)',
                  border: '1px solid var(--danger)', borderRadius: 'var(--radius)',
                  color: 'var(--danger)', fontSize: '0.875rem', marginBottom: '20px'
                }}>
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label className="form-label" htmlFor="forgot-email">Email Address</label>
                  <div style={{ position: 'relative' }}>
                    <Mail size={16} style={{
                      position: 'absolute', left: '12px', top: '50%',
                      transform: 'translateY(-50%)', color: 'var(--gray-400)'
                    }} />
                    <input
                      id="forgot-email"
                      type="email"
                      className="form-input"
                      placeholder="your@email.com"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); setError(''); }}
                      style={{ paddingLeft: '40px' }}
                      autoFocus
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="btn btn-primary btn-full"
                  disabled={loading}
                  style={{ height: '44px', marginTop: '8px' }}
                >
                  {loading ? 'Submitting...' : 'Submit Reset Request'}
                </button>
              </form>
            </>
          )}

          {/* ── STEP 2: Pending approval ── */}
          {step === 'pending' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: '72px', height: '72px',
                backgroundColor: 'var(--warning-light)',
                borderRadius: '50%', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 24px'
              }}>
                <Clock size={36} color="var(--warning)" />
              </div>
              <h2 style={{
                fontSize: '1.5rem', fontWeight: '700',
                color: 'var(--gray-900)', marginBottom: '12px'
              }}>
                Pending Admin Approval
              </h2>
              <p style={{
                color: 'var(--gray-500)', fontSize: '0.9rem',
                lineHeight: 1.7, marginBottom: '8px'
              }}>
                Your password reset request has been submitted for <strong>{email}</strong>.
              </p>
              <p style={{
                color: 'var(--gray-400)', fontSize: '0.8rem',
                marginBottom: '32px'
              }}>
                Your administrator needs to approve this request.
                Please wait and check back shortly.
                This page auto-checks every 30 seconds.
              </p>

              {error && (
                <div style={{
                  padding: '12px 16px', backgroundColor: 'var(--danger-light)',
                  borderRadius: 'var(--radius)', color: 'var(--danger)',
                  fontSize: '0.875rem', marginBottom: '16px'
                }}>
                  {error}
                </div>
              )}

              <button
                className="btn btn-primary btn-full"
                onClick={() => handleCheckStatus(false)}
                disabled={checkingStatus}
              >
                {checkingStatus
                  ? <><RefreshCw size={16} /> Checking...</>
                  : <><RefreshCw size={16} /> Check Status Now</>}
              </button>

              <div style={{
                marginTop: '16px', padding: '12px 16px',
                backgroundColor: 'var(--gray-50)',
                borderRadius: 'var(--radius)',
                fontSize: '0.8rem', color: 'var(--gray-500)'
              }}>
                Reference ID: <strong style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                  {requestId}
                </strong>
                <br />
                <span style={{ fontSize: '0.75rem' }}>
                  Save this as a reference if you need to follow up with your admin.
                </span>
              </div>
            </div>
          )}

          {/* ── STEP 3: Approved — enter new password ── */}
          {step === 'approved' && (
            <>
              <div style={{ marginBottom: '24px', textAlign: 'center' }}>
                <div style={{
                  width: '72px', height: '72px',
                  backgroundColor: 'var(--success-light)',
                  borderRadius: '50%', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 16px'
                }}>
                  <CheckCircle size={36} color="var(--success)" />
                </div>
                <h2 style={{
                  fontSize: '1.5rem', fontWeight: '700',
                  color: 'var(--gray-900)', marginBottom: '8px'
                }}>
                  Request Approved!
                </h2>
                <p style={{ color: 'var(--gray-500)', fontSize: '0.9rem' }}>
                  Your administrator has approved your request.
                  Please enter your new password below.
                </p>
              </div>

              {error && (
                <div style={{
                  padding: '12px 16px', backgroundColor: 'var(--danger-light)',
                  border: '1px solid var(--danger)', borderRadius: 'var(--radius)',
                  color: 'var(--danger)', fontSize: '0.875rem', marginBottom: '20px'
                }}>
                  {error}
                </div>
              )}

              <form onSubmit={handleResetPassword}>
                <div className="form-group">
                  <label className="form-label" htmlFor="forgot-new-pw">New Password</label>
                  <div style={{ position: 'relative' }}>
                    <Lock size={16} style={{
                      position: 'absolute', left: '12px', top: '50%',
                      transform: 'translateY(-50%)', color: 'var(--gray-400)'
                    }} />
                    <input
                      id="forgot-new-pw"
                      type={showPassword ? 'text' : 'password'}
                      className="form-input"
                      placeholder="Min 8 characters"
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); setError(''); }}
                      style={{ paddingLeft: '40px', paddingRight: '40px' }}
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      style={{
                        position: 'absolute', right: '12px', top: '50%',
                        transform: 'translateY(-50%)', background: 'none',
                        border: 'none', cursor: 'pointer',
                        color: 'var(--gray-400)', display: 'flex'
                      }}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>

                  {/* Password strength */}
                  {strength && (
                    <div style={{ marginTop: '8px' }}>
                      <div style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
                        {[1, 2, 3].map((level) => (
                          <div key={level} style={{
                            flex: 1, height: '4px', borderRadius: '2px',
                            backgroundColor: level <= strength.level
                              ? strength.color : 'var(--gray-200)',
                            transition: 'background-color 0.2s'
                          }} />
                        ))}
                      </div>
                      <p style={{ fontSize: '0.75rem', color: strength.color }}>
                        {strength.label}
                      </p>
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="forgot-confirm-pw">Confirm New Password</label>
                  <div style={{ position: 'relative' }}>
                    <Lock size={16} style={{
                      position: 'absolute', left: '12px', top: '50%',
                      transform: 'translateY(-50%)', color: 'var(--gray-400)'
                    }} />
                    <input
                      id="forgot-confirm-pw"
                      type={showPassword ? 'text' : 'password'}
                      className="form-input"
                      placeholder="Repeat new password"
                      value={confirmPassword}
                      onChange={(e) => { setConfirmPassword(e.target.value); setError(''); }}
                      style={{ paddingLeft: '40px' }}
                    />
                  </div>
                  {confirmPassword && password !== confirmPassword && (
                    <p style={{ fontSize: '0.75rem', color: 'var(--danger)', marginTop: '4px' }}>
                      Passwords do not match
                    </p>
                  )}
                  {confirmPassword && password === confirmPassword && (
                    <p style={{
                      fontSize: '0.75rem', color: 'var(--success)',
                      marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px'
                    }}>
                      <CheckCircle size={12} /> Passwords match
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  className="btn btn-primary btn-full"
                  disabled={resetting}
                  style={{ height: '44px' }}
                >
                  {resetting ? 'Resetting...' : 'Reset Password'}
                </button>
              </form>
            </>
          )}

          {/* ── STEP 4: Rejected ── */}
          {step === 'rejected' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: '72px', height: '72px',
                backgroundColor: 'var(--danger-light)',
                borderRadius: '50%', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 24px'
              }}>
                <XCircle size={36} color="var(--danger)" />
              </div>
              <h2 style={{
                fontSize: '1.5rem', fontWeight: '700',
                color: 'var(--gray-900)', marginBottom: '12px'
              }}>
                Request Rejected
              </h2>
              <p style={{
                color: 'var(--gray-500)', fontSize: '0.9rem',
                lineHeight: 1.7, marginBottom: '12px'
              }}>
                Your password reset request was not approved.
              </p>
              {rejectedReason && (
                <div style={{
                  padding: '12px 16px', backgroundColor: 'var(--danger-light)',
                  borderRadius: 'var(--radius)', marginBottom: '24px',
                  fontSize: '0.875rem', color: 'var(--danger)'
                }}>
                  <strong>Reason:</strong> {rejectedReason}
                </div>
              )}
              <p style={{
                color: 'var(--gray-400)', fontSize: '0.8rem', marginBottom: '24px'
              }}>
                Please contact your administrator directly for assistance.
              </p>
              <button
                className="btn btn-ghost btn-full"
                onClick={() => {
                  setStep('form');
                  setEmail('');
                  setRequestId(null);
                  setRequestToken('');
                  setResetToken('');
                  setRejectedReason('');
                  setPassword('');
                  setConfirmPassword('');
                  setShowPassword(false);
                  setError('');
                }}
              >
                Submit New Request
              </button>
            </div>
          )}

          {/* ── STEP 5: Success ── */}
          {step === 'success' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: '72px', height: '72px',
                backgroundColor: 'var(--success-light)',
                borderRadius: '50%', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 24px'
              }}>
                <CheckCircle size={36} color="var(--success)" />
              </div>
              <h2 style={{
                fontSize: '1.5rem', fontWeight: '700',
                color: 'var(--gray-900)', marginBottom: '12px'
              }}>
                Password Reset Successfully!
              </h2>
              <p style={{
                color: 'var(--gray-500)', fontSize: '0.9rem',
                lineHeight: 1.7, marginBottom: '32px'
              }}>
                Your password has been updated. You can now log in with your new password.
              </p>
              <Link to="/login" className="btn btn-primary btn-full"
                style={{ textDecoration: 'none', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', height: '44px' }}>
                Go to Login
              </Link>
            </div>
          )}

          {/* Back to login */}
          {(step === 'form' || step === 'pending') && (
            <div style={{ marginTop: '28px', textAlign: 'center' }}>
              <Link to="/login" style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                color: 'var(--primary-light)', fontSize: '0.875rem', fontWeight: '500'
              }}>
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

export default ForgotPassword;