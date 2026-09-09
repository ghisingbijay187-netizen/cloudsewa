import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import API from '../api/axios';
import {
  Cloud, Eye, EyeOff, Lock, Mail, User,
  Clock, CheckCircle, XCircle, RefreshCw, ArrowLeft
} from 'lucide-react';
import { validateName, validatePassword } from '../utils/validation';
import useSessionState from '../hooks/useSessionState';

const Register = () => {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useSessionState('reg:step', 'form'); // form | pending | approved | rejected
  const [savedName, setSavedName] = useSessionState('reg:name', '');
  const [savedEmail, setSavedEmail] = useSessionState('reg:email', '');
  const [formData, setFormData] = useState({
    name: savedName,
    email: savedEmail,
    password: '',
    confirmPassword: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [userId, setUserId] = useSessionState('reg:userId', null);
  const [registrationToken, setRegistrationToken] = useSessionState('reg:token', '');
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [rejectedReason, setRejectedReason] = useSessionState('reg:reason', '');

  // Auto check registration status every 30 seconds while pending
  useEffect(() => {
    if (step !== 'pending' || !userId || !registrationToken) return;
    const interval = setInterval(() => {
      handleCheckStatus(true);
    }, 30000);
    return () => clearInterval(interval);
  }, [step, userId, registrationToken]);

  // Recover from a persisted 'pending' step whose credentials were lost
  useEffect(() => {
    if (step === 'pending' && !userId) {
      setError('Your previous registration session is no longer valid. Please register again.');
      setStep('form');
    }
  }, [step, userId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (name === 'name') setSavedName(value);
    if (name === 'email') setSavedEmail(value);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name || !formData.email || !formData.password) {
      setError('Please fill in all fields');
      return;
    }

    const nameError = validateName(formData.name);
    if (nameError) {
      setError(nameError);
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

    setLoading(true);
    const result = await register(formData.name, formData.email, formData.password);
    setLoading(false);

    if (result.success && result.pending) {
      if (result.userId && result.registrationToken) {
        setUserId(result.userId);
        setRegistrationToken(result.registrationToken || '');
        setStep('pending');
      } else {
        setError(result.message || 'Registration submitted. Please contact your administrator.');
      }
    } else if (result.success) {
      navigate('/dashboard');
    } else {
      setError(result.message);
    }
  };

  const handleCheckStatus = async (silent = false) => {
    if (!userId || !registrationToken) {
      if (!silent) {
        setError('Your registration session is no longer valid. Please register again or contact your administrator.');
        setStep('form');
      }
      return;
    }
    try {
      if (!silent) setCheckingStatus(true);
      const { data } = await API.get(
        `/auth/registration-status/${userId}?token=${encodeURIComponent(registrationToken)}`
      );

      if (data.status === 'approved') {
        setStep('approved');
      } else if (data.status === 'rejected') {
        setRejectedReason(data.rejectedReason || 'Registration rejected by administrator');
        setStep('rejected');
      }
    } catch {
      if (!silent) setError('Failed to check status. Please try again.');
    } finally {
      if (!silent) setCheckingStatus(false);
    }
  };

  const resetForm = () => {
    setStep('form');
    setFormData({ name: '', email: '', password: '', confirmPassword: '' });
    setSavedName('');
    setSavedEmail('');
    setUserId(null);
    setRegistrationToken('');
    setRejectedReason('');
    setError('');
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      backgroundColor: 'var(--gray-50)',
      fontFamily: 'var(--font-sans)'
    }}>
      {/* Left panel */}
      <div className="hide-mobile" style={{
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
      }}>
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
          Join CloudSewa and protect your business data with enterprise-grade security.
        </p>

        <div style={{
          marginTop: '60px',
          padding: '24px',
          backgroundColor: 'rgba(255,255,255,0.05)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.1)',
          maxWidth: '340px',
          width: '100%',
          zIndex: 1
        }}>
          <p style={{
            fontSize: '0.8rem',
            color: 'rgba(255,255,255,0.6)',
            marginBottom: '12px',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            fontWeight: '700',
            fontFamily: 'var(--font-display)'
          }}>
            System Initialization
          </p>
          <p style={{
            fontSize: '0.875rem',
            color: 'rgba(255,255,255,0.8)',
            lineHeight: 1.6
          }}>
            To initialize your secure workspace, please register your company's primary email first. 
            The initial account will configure system-wide security, invite employees, and schedule automated backups.
          </p>
        </div>
      </div>

      {/* Right panel */}
      <div className="auth-panel" style={{
        width: '480px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '60px 48px',
        backgroundColor: 'var(--white)',
        overflowY: 'auto'
      }}>
        <div style={{ width: '100%', maxWidth: '360px' }}>

          {/* ── STEP 1: Registration form ── */}
          {step === 'form' && (
            <>
              <div style={{ marginBottom: '36px' }}>
                <h2 style={{
                  fontSize: '1.75rem',
                  fontWeight: '700',
                  color: 'var(--gray-900)',
                  marginBottom: '8px'
                }}>
                  Create account
                </h2>
                <p style={{ color: 'var(--gray-500)', fontSize: '0.9rem' }}>
                  Set up your CloudSewa account
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
                  <label className="form-label" htmlFor="reg-name">Full Name</label>
                  <div style={{ position: 'relative' }}>
                    <User
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
                      id="reg-name"
                      type="text"
                      name="name"
                      className="form-input"
                      placeholder="Your full name"
                      value={formData.name}
                      onChange={handleChange}
                      style={{ paddingLeft: '40px' }}
                      autoComplete="name"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="reg-email">Email Address</label>
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
                      id="reg-email"
                      type="email"
                      name="email"
                      className="form-input"
                      placeholder="your@email.com"
                      value={formData.email}
                      onChange={handleChange}
                      style={{ paddingLeft: '40px' }}
                      autoComplete="email"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="reg-password">Password</label>
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
                      id="reg-password"
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      className="form-input"
                      placeholder="Min 8 chars, upper+lower+number+symbol"
                      value={formData.password}
                      onChange={handleChange}
                      style={{ paddingLeft: '40px', paddingRight: '40px' }}
                      autoComplete="new-password"
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

                <div className="form-group">
                  <label className="form-label" htmlFor="reg-confirm">Confirm Password</label>
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
                      id="reg-confirm"
                      type={showPassword ? 'text' : 'password'}
                      name="confirmPassword"
                      className="form-input"
                      placeholder="Repeat your password"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      style={{ paddingLeft: '40px' }}
                      autoComplete="new-password"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="btn btn-primary btn-full"
                  disabled={loading}
                  style={{ marginTop: '8px', height: '44px' }}
                >
                  {loading ? 'Creating account...' : 'Create Account'}
                </button>
              </form>
            </>
          )}

          {/* ── STEP 2: Pending admin approval ── */}
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
                Awaiting Approval
              </h2>
              <p style={{
                color: 'var(--gray-500)', fontSize: '0.9rem',
                lineHeight: 1.7, marginBottom: '8px'
              }}>
                Your account registration for <strong>{formData.email}</strong>
                has been submitted for review.
              </p>
              <p style={{
                color: 'var(--gray-400)', fontSize: '0.8rem',
                marginBottom: '32px'
              }}>
                An administrator needs to approve your account before you can sign in.
                Please wait and check back shortly.
                This page auto-checks every 30 seconds.
              </p>

              {error && (
                <div style={{
                  padding: '12px 16px', backgroundColor: 'var(--danger-light)',
                  border: '1px solid var(--danger)', borderRadius: 'var(--radius)',
                  color: 'var(--danger)', fontSize: '0.875rem', marginBottom: '16px'
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
                  {userId}
                </strong>
                <br />
                <span style={{ fontSize: '0.75rem' }}>
                  Save this as a reference if you need to follow up with your admin.
                </span>
              </div>
            </div>
          )}

          {/* ── STEP 3: Approved ── */}
          {step === 'approved' && (
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
                Account Approved!
              </h2>
              <p style={{
                color: 'var(--gray-500)', fontSize: '0.9rem',
                lineHeight: 1.7, marginBottom: '32px'
              }}>
                An administrator has approved your registration.
                You can now sign in with your credentials.
              </p>
              <Link to="/login" onClick={resetForm}  className="btn btn-primary btn-full"
                style={{ textDecoration: 'none', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', height: '44px' }}>
                Go to Login
              </Link>
            </div>
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
                Registration Rejected
              </h2>
              <p style={{
                color: 'var(--gray-500)', fontSize: '0.9rem',
                lineHeight: 1.7, marginBottom: '12px'
              }}>
                Sorry, your account registration was not approved.
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
                onClick={resetForm}
                style={{ marginBottom: '12px' }}
              >
                Register with a different account
              </button>
              <Link to="/login" className="btn btn-primary btn-full"
                style={{ textDecoration: 'none', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', height: '44px' }}>
                Go to Login
              </Link>
            </div>
          )}

          {/* Bottom links */}
          {step === 'form' && (
            <p style={{
              textAlign: 'center',
              marginTop: '24px',
              fontSize: '0.875rem',
              color: 'var(--gray-500)'
            }}>
              Already have an account?{' '}
              <Link
                to="/login"
                style={{ color: 'var(--primary-light)', fontWeight: '500' }}
              >
                Sign in
              </Link>
            </p>
          )}

          {step === 'pending' && (
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

export default Register;
