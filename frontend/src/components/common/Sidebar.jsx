import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import {
  LayoutDashboard, FolderOpen, Archive,
  Trash2, Settings, Shield, LogOut,
  Cloud, HardDrive, Activity, Sun, Moon
} from 'lucide-react';

const Sidebar = ({ open = false, collapsed = false, onNavigate }) => {
  const { user, logout, isAdmin } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navItems = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/files', icon: FolderOpen, label: 'My Files' },
    { to: '/backups', icon: Archive, label: 'Backups' },
    { to: '/trash', icon: Trash2, label: 'Trash' },
    { to: '/settings', icon: Settings, label: 'Settings' },
    ...(isAdmin ? [
      { to: '/admin', icon: Shield, label: 'Admin Panel' },
      { to: '/activity', icon: Activity, label: 'Activity Logs' },
      { to: '/storage', icon: HardDrive, label: 'Storage Stats' }
    ] : [])
  ];

  const formatBytes = (bytes) => {
    if (!Number.isFinite(Number(bytes)) || Number(bytes) <= 0) return '0 MB';
    const mb = Number(bytes) / 1024 / 1024;
    if (mb < 1024) return `${mb.toFixed(0)} MB`;
    return `${(mb / 1024).toFixed(1)} GB`;
  };

  const storagePercent = user && user.storageLimit > 0
    ? Math.round((Number(user.storageUsed) / Number(user.storageLimit)) * 100)
    : 0;

  return (
    <aside
      className={`sidebar${collapsed ? ' sidebar-collapsed' : ''}${open ? ' sidebar-open' : ''}`}
      style={{
      position: 'fixed',
      top: 0,
      left: 0,
      height: '100vh',
      backgroundColor: '#020617',
      overflowY: 'auto',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 200,
      boxShadow: '2px 0 8px rgba(0,0,0,0.15)'
    }}>

      {/* Logo */}
      <div className="sb-logo" style={{
        padding: '20px 24px',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        height: 'var(--navbar-height)'
      }}>
        <div style={{
          width: '36px',
          height: '36px',
          borderRadius: 'var(--radius)',
          backgroundColor: 'rgba(255,255,255,0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <Cloud size={20} color="white" />
        </div>
        <div className="sb-brand-text">
          <h1 style={{
            fontSize: '1.125rem',
            fontWeight: '700',
            color: 'white',
            lineHeight: 1.2
          }}>
            CloudSewa
          </h1>
          <p style={{
            fontSize: '0.7rem',
            color: 'rgba(255,255,255,0.6)',
            lineHeight: 1.2
          }}>
            Secure File Storage
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: '8px 12px', overflowY: 'auto' }}>
        <p className="sb-label" style={{
          fontSize: '0.7rem',
          fontWeight: '600',
          color: 'rgba(255,255,255,0.4)',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
padding: '0 12px',
            marginBottom: '6px'
        }}>
          Menu
        </p>

        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onNavigate}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '7px 12px',
              borderRadius: 'var(--radius)',
              marginBottom: '2px',
              textDecoration: 'none',
              fontSize: '0.875rem',
              fontWeight: isActive ? '600' : '400',
              color: isActive ? 'white' : 'rgba(255,255,255,0.65)',
              backgroundColor: isActive
                ? 'rgba(255,255,255,0.15)'
                : 'transparent',
              transition: 'all 0.15s'
            })}
          >
            <Icon size={18} />
            <span className="sb-label">{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Dark mode toggle */}
      <div style={{ padding: '0 12px 6px' }}>
        <button
          className="sb-toggle"
          onClick={toggleTheme}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 14px',
            borderRadius: 'var(--radius)',
            border: 'none',
            backgroundColor: 'rgba(255,255,255,0.08)',
            cursor: 'pointer',
            transition: 'all 0.15s'
          }}
          onMouseEnter={e =>
            e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.15)'
          }
          onMouseLeave={e =>
            e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)'
          }
        >
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            {theme === 'dark' ? (
              <Sun size={16} color="rgba(255,255,255,0.7)" />
            ) : (
              <Moon size={16} color="rgba(255,255,255,0.7)" />
            )}
            <span className="sb-label" style={{
              fontSize: '0.8rem',
              color: 'rgba(255,255,255,0.7)',
              fontWeight: '500'
            }}>
              {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
            </span>
          </div>

          {/* Toggle switch */}
          <div className="sb-switch" style={{
            width: '36px',
            height: '20px',
            borderRadius: '10px',
            backgroundColor: theme === 'dark'
              ? 'var(--primary-light)'
              : 'rgba(255,255,255,0.2)',
            position: 'relative',
            transition: 'background-color 0.2s',
            flexShrink: 0
          }}>
            <div style={{
              position: 'absolute',
              top: '2px',
              left: theme === 'dark' ? '18px' : '2px',
              width: '16px',
              height: '16px',
              borderRadius: '50%',
              backgroundColor: 'white',
              transition: 'left 0.2s',
              boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
            }} />
          </div>
        </button>
      </div>

      {/* Storage indicator */}
      <div className="sb-storage" style={{ padding: '0 12px 12px' }}>
        <div style={{
          backgroundColor: 'rgba(255,255,255,0.08)',
          borderRadius: 'var(--radius)',
          padding: '10px'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '8px'
          }}>
            <HardDrive size={14} color="rgba(255,255,255,0.7)" />
            <p style={{
              fontSize: '0.75rem',
              color: 'rgba(255,255,255,0.7)',
              fontWeight: '500'
            }}>
              Storage
            </p>
          </div>

          <div style={{
            width: '100%',
            height: '6px',
            backgroundColor: 'rgba(255,255,255,0.2)',
            borderRadius: 'var(--radius-full)',
            overflow: 'hidden',
            marginBottom: '6px'
          }}>
            <div style={{
              width: `${storagePercent}%`,
              height: '100%',
              backgroundColor: storagePercent >= 80 ? '#ff6b6b' : '#69db7c',
              borderRadius: 'var(--radius-full)',
              transition: 'width 0.3s'
            }} />
          </div>

          <p style={{
            fontSize: '0.7rem',
            color: 'rgba(255,255,255,0.5)'
          }}>
            {formatBytes(user?.storageUsed)} of {formatBytes(user?.storageLimit)} used
          </p>
        </div>
      </div>

      {/* Logout button */}
      <div style={{ padding: '0 12px 12px' }}>
        <button
          className="sb-logout"
          onClick={handleLogout}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '8px 12px',
            borderRadius: 'var(--radius)',
            border: 'none',
            backgroundColor: 'rgba(255,255,255,0.08)',
            cursor: 'pointer',
            fontSize: '0.875rem',
            color: 'rgba(255,255,255,0.65)',
            transition: 'all 0.15s'
          }}
          onMouseEnter={e => {
            e.currentTarget.style.backgroundColor = 'rgba(255,100,100,0.2)';
            e.currentTarget.style.color = '#ff8080';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)';
            e.currentTarget.style.color = 'rgba(255,255,255,0.65)';
          }}
        >
          <LogOut size={18} />
          <span className="sb-label">Logout</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;