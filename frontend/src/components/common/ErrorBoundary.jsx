import { Component } from 'react';
import { Cloud, RefreshCw, Home } from 'lucide-react';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('CloudSewa Error Boundary caught:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/dashboard';
  };

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  render() {
    if (this.state.hasError) {
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
            backgroundColor: 'var(--danger)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '24px'
          }}>
            <Cloud size={32} color="white" />
          </div>

          <h1 style={{
            fontSize: '2rem',
            fontWeight: '700',
            color: 'var(--gray-900)',
            marginBottom: '12px'
          }}>
            Something went wrong
          </h1>

          <p style={{
            fontSize: '1rem',
            color: 'var(--gray-500)',
            maxWidth: '480px',
            lineHeight: 1.6,
            marginBottom: '12px'
          }}>
            CloudSewa encountered an unexpected error. Your files and data
            are safe. Please try refreshing the page or returning to the dashboard.
          </p>

          {/* Error details — only in development */}
          {import.meta.env.DEV && this.state.error && (
            <div style={{
              marginBottom: '28px',
              padding: '16px',
              backgroundColor: 'var(--danger-light)',
              borderRadius: 'var(--radius)',
              border: '1px solid rgba(244, 67, 54, 0.2)',
              maxWidth: '600px',
              width: '100%',
              textAlign: 'left'
            }}>
              <p style={{
                fontSize: '0.75rem',
                fontWeight: '600',
                color: 'var(--danger)',
                marginBottom: '8px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                Error Details (Development Only)
              </p>
              <p style={{
                fontSize: '0.8rem',
                color: 'var(--danger)',
                fontFamily: 'monospace',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all'
              }}>
                {this.state.error.toString()}
              </p>
              {this.state.errorInfo && (
                <p style={{
                  fontSize: '0.75rem',
                  color: 'var(--gray-500)',
                  fontFamily: 'monospace',
                  marginTop: '8px',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                  maxHeight: '120px',
                  overflowY: 'auto'
                }}>
                  {this.state.errorInfo.componentStack}
                </p>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div style={{
            display: 'flex',
            gap: '12px',
            flexWrap: 'wrap',
            justifyContent: 'center'
          }}>
            <button
              className="btn btn-ghost"
              onClick={this.handleReset}
            >
              Try Again
            </button>
            <button
              className="btn btn-ghost"
              onClick={this.handleReload}
            >
              <RefreshCw size={16} />
              Reload Page
            </button>
            <button
              className="btn btn-primary"
              onClick={this.handleGoHome}
            >
              <Home size={16} />
              Go to Dashboard
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;