import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import API from '../../api/axios';
import { getInitials } from '../../utils/formatters';
import {
  LogOut, Settings, ChevronDown,
  Bell, Upload, Download, Trash2,
  Archive, Users, Shield, Clock,
  X, CheckCheck, Menu,
  LayoutDashboard, FolderOpen, HardDrive,
  Activity, Search, FileText
} from 'lucide-react';

// ── Page search data ──
const PAGES = [
  { label: 'Dashboard', path: '/dashboard', icon: <LayoutDashboard size={15} />, keywords: ['dashboard', 'home', 'overview', 'stats'] },
  { label: 'File Manager', path: '/files', icon: <FolderOpen size={15} />, keywords: ['files', 'file', 'upload', 'documents', 'folder', 'manager'] },
  { label: 'Backup Manager', path: '/backups', icon: <Archive size={15} />, keywords: ['backup', 'backups', 'restore', 'archive'] },
  { label: 'Trash', path: '/trash', icon: <Trash2 size={15} />, keywords: ['trash', 'deleted', 'recycle', 'bin'] },
  { label: 'Settings', path: '/settings', icon: <Settings size={15} />, keywords: ['settings', 'profile', 'password', 'account'] },
  { label: 'Admin Panel', path: '/admin', icon: <Shield size={15} />, keywords: ['admin', 'users', 'manage', 'panel'], adminOnly: true },
  { label: 'Activity Logs', path: '/activity', icon: <Activity size={15} />, keywords: ['activity', 'logs', 'audit', 'history'], adminOnly: true },
  { label: 'Storage Stats', path: '/storage', icon: <HardDrive size={15} />, keywords: ['storage', 'stats', 'usage', 'space'], adminOnly: true },
];

const getNotificationIcon = (type) => {
  if (type?.startsWith('file_upload')) return <Upload size={13} />;
  if (type?.startsWith('file_download')) return <Download size={13} />;
  if (type?.startsWith('file_share')) return <Users size={13} />;
  if (type?.startsWith('file_delete')) return <Trash2 size={13} />;
  if (type?.startsWith('backup')) return <Archive size={13} />;
  if (type?.startsWith('storage')) return <HardDrive size={13} />;
  if (type?.startsWith('user')) return <Users size={13} />;
  if (type?.startsWith('reset')) return <Shield size={13} />;
  return <Clock size={13} />;
};

const getNotificationColor = (type) => {
  if (type?.includes('failed') || type?.includes('warning') || type?.includes('delete')) return 'var(--danger)';
  if (type?.includes('complete') || type?.includes('upload') || type?.includes('restore')) return 'var(--success)';
  if (type?.includes('share')) return 'var(--info)';
  return 'var(--gray-400)';
};

const getRelativeTime = (date) => {
  if (!date) return '';
  const now = new Date();
  const then = new Date(date);
  const seconds = Math.floor((now - then) / 1000);
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
};

const Navbar = ({ onToggleSidebar, sidebarOpen }) => {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifLoading, setNotifLoading] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchDrop, setShowSearchDrop] = useState(false);

  const notifRef = useRef(null);
  const dropdownRef = useRef(null);
  const searchRef = useRef(null);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setDropdownOpen(false);
      if (searchRef.current && !searchRef.current.contains(e.target)) setShowSearchDrop(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Search logic
  useEffect(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) { setSearchResults([]); setShowSearchDrop(false); return; }

    const matched = PAGES.filter(page => {
      if (page.adminOnly && !isAdmin) return false;
      return page.keywords.some(k => k.includes(q)) || page.label.toLowerCase().includes(q);
    });

    setSearchResults(matched);
    setShowSearchDrop(true);
  }, [searchQuery, isAdmin]);

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter') {
      const q = searchQuery.trim().toLowerCase();
      if (!q) return;

      // If there is a matched page — navigate there
      if (searchResults.length > 0) {
        navigate(searchResults[0].path);
        setSearchQuery('');
        setShowSearchDrop(false);
        return;
      }

      // Fallback — search files
      navigate(`/files?search=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery('');
      setShowSearchDrop(false);
    }

    if (e.key === 'Escape') {
      setSearchQuery('');
      setShowSearchDrop(false);
    }
  };

  const handleSelectResult = (page) => {
    navigate(page.path);
    setSearchQuery('');
    setShowSearchDrop(false);
  };

  const fetchNotifications = async () => {
    try {
      setNotifLoading(true);
      const { data } = await API.get('/notifications?limit=10&page=1');
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch (error) {
      console.error('Fetch notifications error:', error);
    } finally {
      setNotifLoading(false);
    }
  };

  const handleMarkAllRead = async () => {
    setUnreadCount(0);
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    try {
      await API.put('/notifications/read-all');
    } catch (error) {
      console.error('Mark all read error:', error);
      fetchNotifications();
    }
  };

  const handleMarkRead = async (notif) => {
    if (notif.isRead) return;
    setNotifications(prev => prev.map(n => n._id === notif._id ? { ...n, isRead: true } : n));
    setUnreadCount(c => Math.max(0, c - 1));
    try {
      await API.put(`/notifications/${notif._id}/read`);
    } catch (error) {
      console.error('Mark read error:', error);
      fetchNotifications();
    }
  };

  const handleOpenNotification = async (notif) => {
    await handleMarkRead(notif);
    if (notif.link) navigate(notif.link);
    setNotifOpen(false);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <nav
      className="navbar"
      style={{
      position: 'fixed',
      top: 0,
      right: 0,
      height: 'var(--navbar-height)',
      backgroundColor: 'var(--white)',
      borderBottom: '1px solid var(--gray-200)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 24px',
      zIndex: 100,
      boxShadow: 'var(--shadow-sm)'
    }}>

      {/* Mobile hamburger */}
      <button
        className="navbar-hamburger"
        onClick={onToggleSidebar}
        aria-label={sidebarOpen ? 'Close menu' : 'Open menu'}
        style={{
          alignItems: 'center',
          justifyContent: 'center',
          width: '38px', height: '38px',
          borderRadius: 'var(--radius)',
          border: '1px solid var(--gray-200)',
          backgroundColor: 'var(--white)',
          cursor: 'pointer',
          color: 'var(--gray-700)',
          flexShrink: 0
        }}
      >
        {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Smart Search */}
      <div ref={searchRef} className="navbar-search" style={{ position: 'relative' }}>
        <div style={{ position: 'relative' }}>
          <Search
            size={15}
            style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--gray-400)',
              pointerEvents: 'none'
            }}
          />
          <input
            className="form-input"
            placeholder="Search pages or files..."
            aria-label="Search pages or files"
            role="combobox"
            aria-expanded={showSearchDrop}
            aria-controls="navbar-search-dropdown"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            onFocus={() => { if (searchQuery) setShowSearchDrop(true); }}
            style={{ paddingLeft: '36px', paddingRight: searchQuery ? '32px' : '12px' }}
          />
          {searchQuery && (
            <button
              onClick={() => { setSearchQuery(''); setShowSearchDrop(false); }}
              aria-label="Clear search"
              style={{
                position: 'absolute', right: '10px', top: '50%',
                transform: 'translateY(-50%)', background: 'none',
                border: 'none', cursor: 'pointer', color: 'var(--gray-400)',
                display: 'flex', padding: '0'
              }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Search dropdown */}
        {showSearchDrop && (
          <div id="navbar-search-dropdown" role="listbox" aria-label="Search results" style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            right: 0,
            backgroundColor: 'var(--white)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-lg)',
            border: '1px solid var(--gray-200)',
            zIndex: 300,
            overflow: 'hidden'
          }}>
            {searchResults.length > 0 ? (
              <>
                <div style={{
                  padding: '8px 12px 4px',
                  fontSize: '0.7rem',
                  fontWeight: '600',
                  color: 'var(--gray-400)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>
                  Pages
                </div>
                {searchResults.map((page) => (
                  <div
                    key={page.path}
                    onClick={() => handleSelectResult(page)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '10px 14px',
                      cursor: 'pointer',
                      backgroundColor: location.pathname === page.path
                        ? 'var(--accent)'
                        : 'transparent',
                      transition: 'background-color 0.15s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--gray-50)'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor =
                      location.pathname === page.path ? 'var(--accent)' : 'transparent'}
                  >
                    <div style={{
                      width: '28px', height: '28px',
                      borderRadius: 'var(--radius)',
                      backgroundColor: 'var(--accent)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'var(--primary)', flexShrink: 0
                    }}>
                      {page.icon}
                    </div>
                    <div>
                      <p style={{
                        fontSize: '0.875rem', fontWeight: '500',
                        color: 'var(--gray-800)', margin: 0
                      }}>
                        {page.label}
                      </p>
                      <p style={{
                        fontSize: '0.7rem', color: 'var(--gray-400)', margin: 0
                      }}>
                        {page.path}
                      </p>
                    </div>
                    {location.pathname === page.path && (
                      <span className="badge badge-primary" style={{
                        marginLeft: 'auto', fontSize: '0.65rem'
                      }}>
                        Current
                      </span>
                    )}
                  </div>
                ))}
                <div style={{
                  padding: '8px 14px',
                  borderTop: '1px solid var(--gray-100)',
                  fontSize: '0.75rem',
                  color: 'var(--gray-400)'
                }}>
                  Press <kbd style={{
                    padding: '1px 5px',
                    backgroundColor: 'var(--gray-100)',
                    borderRadius: '3px',
                    border: '1px solid var(--gray-300)',
                    fontSize: '0.7rem'
                  }}>Enter</kbd> to go to first result
                </div>
              </>
            ) : (
              <div style={{
                padding: '10px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                cursor: 'pointer',
                transition: 'background-color 0.15s'
              }}
                onClick={() => {
                  navigate(`/files?search=${encodeURIComponent(searchQuery.trim())}`);
                  setSearchQuery('');
                  setShowSearchDrop(false);
                }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--gray-50)'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <div style={{
                  width: '28px', height: '28px',
                  borderRadius: 'var(--radius)',
                  backgroundColor: 'var(--accent)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--primary)', flexShrink: 0
                }}>
                  <FileText size={15} />
                </div>
                <div>
                  <p style={{ fontSize: '0.875rem', fontWeight: '500', color: 'var(--gray-800)', margin: 0 }}>
                    Search files for "{searchQuery}"
                  </p>
                  <p style={{ fontSize: '0.7rem', color: 'var(--gray-400)', margin: 0 }}>
                    Search in File Manager
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right side */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>

        {/* Notification bell */}
        <div ref={notifRef} style={{ position: 'relative' }}>
          <button
            className="btn-icon"
            onClick={() => { setNotifOpen(!notifOpen); if (!notifOpen) fetchNotifications(); }}
            style={{ position: 'relative' }}
            aria-label="Notifications"
            aria-haspopup="true"
            aria-expanded={notifOpen}
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span style={{
                position: 'absolute', top: '-4px', right: '-4px',
                width: '18px', height: '18px', borderRadius: '50%',
                backgroundColor: 'var(--danger)', color: 'white',
                fontSize: '0.6rem', fontWeight: '700',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '2px solid white'
              }}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="navbar-notif-panel" role="dialog" aria-label="Notifications" style={{
              position: 'absolute', top: 'calc(100% + 8px)', right: 0,
              width: '360px', backgroundColor: 'var(--white)',
              borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)',
              border: '1px solid var(--gray-200)', zIndex: 300, overflow: 'hidden'
            }}>
              <div style={{
                padding: '14px 16px', borderBottom: '1px solid var(--gray-100)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--gray-900)' }}>
                    Recent Activity
                  </h4>
                  {unreadCount > 0 && (
                    <span className="badge badge-danger" style={{ fontSize: '0.7rem' }}>
                      {unreadCount} new
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllRead}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        fontSize: '0.75rem', color: 'var(--primary-light)',
                        display: 'flex', alignItems: 'center', gap: '4px',
                        padding: '4px 8px', borderRadius: 'var(--radius)'
                      }}
                      title="Mark all as read"
                    >
                      <CheckCheck size={14} /> Mark all read
                    </button>
                  )}
                  <button className="btn-icon" onClick={() => setNotifOpen(false)} aria-label="Close notifications">
                    <X size={14} />
                  </button>
                </div>
              </div>

              <div style={{ maxHeight: '380px', overflowY: 'auto' }}>
                {notifLoading ? (
                  <div style={{ padding: '24px', textAlign: 'center' }}>
                    <div className="spinner" style={{ width: '24px', height: '24px', margin: '0 auto' }} />
                  </div>
                ) : notifications.length === 0 ? (
                  <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--gray-400)' }}>
                    <Bell size={32} style={{ marginBottom: '8px', opacity: 0.4 }} />
                    <p style={{ fontSize: '0.875rem' }}>No recent activity</p>
                  </div>
                ) : (
                  notifications.map((notif, idx) => {
                    const isNew = !notif.isRead;
                    return (
                      <div
                        key={notif._id || idx}
                        onClick={() => handleOpenNotification(notif)}
                        style={{
                          padding: '12px 16px',
                          borderBottom: '1px solid var(--gray-100)',
                          backgroundColor: isNew ? 'rgba(214, 228, 240, 0.35)' : 'transparent',
                          display: 'flex', alignItems: 'flex-start', gap: '10px',
                          position: 'relative', cursor: 'pointer'
                        }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--gray-50)'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = isNew ? 'rgba(214, 228, 240, 0.35)' : 'transparent'}
                      >
                        {isNew && (
                          <div style={{
                            position: 'absolute', left: '6px', top: '50%',
                            transform: 'translateY(-50%)', width: '6px', height: '6px',
                            borderRadius: '50%', backgroundColor: 'var(--primary-light)'
                          }} />
                        )}
                        <div style={{
                          width: '30px', height: '30px', borderRadius: '50%',
                          backgroundColor: 'var(--gray-100)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0, color: getNotificationColor(notif.type)
                        }}>
                          {getNotificationIcon(notif.type)}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{
                            fontSize: '0.8rem',
                            color: isNew ? 'var(--gray-900)' : 'var(--gray-600)',
                            fontWeight: isNew ? '600' : '500',
                            lineHeight: 1.3
                          }}>
                            {notif.title}
                          </p>
                          <p style={{
                            fontSize: '0.75rem', color: 'var(--gray-500)',
                            lineHeight: 1.4, overflow: 'hidden',
                            textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            marginTop: '2px'
                          }}>
                            {notif.message}
                          </p>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                            {notif.priority === 'high' && (
                              <span className="badge badge-danger" style={{ fontSize: '0.6rem' }}>
                                High
                              </span>
                            )}
                            <span style={{ fontSize: '0.7rem', color: 'var(--gray-400)' }}>{getRelativeTime(notif.createdAt)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div style={{
                padding: '12px 16px', borderTop: '1px solid var(--gray-100)',
                display: 'flex', alignItems: 'center',
                justifyContent: isAdmin ? 'space-between' : 'center'
              }}>
                {unreadCount === 0 ? (
                  <p style={{ fontSize: '0.75rem', color: 'var(--gray-400)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <CheckCheck size={13} /> All caught up
                  </p>
                ) : (
                  <button onClick={handleMarkAllRead} style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: '0.8rem', color: 'var(--primary-light)',
                    display: 'flex', alignItems: 'center', gap: '4px'
                  }}>
                    <CheckCheck size={14} /> Mark all as read
                  </button>
                )}
                {isAdmin && (
                  <button style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: '0.8rem', color: 'var(--primary-light)', fontWeight: '500'
                  }} onClick={() => { navigate('/activity'); setNotifOpen(false); }}>
                    View all logs →
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* User dropdown */}
        <div ref={dropdownRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            aria-haspopup="menu"
            aria-expanded={dropdownOpen}
            aria-label="Account menu"
            style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '6px 12px', borderRadius: 'var(--radius)',
              border: '1px solid var(--gray-200)',
              backgroundColor: 'var(--white)', cursor: 'pointer'
            }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--gray-50)'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--white)'}
          >
            <div style={{
              width: '32px', height: '32px', borderRadius: '50%',
              backgroundColor: 'var(--primary)', color: 'var(--white)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.75rem', fontWeight: '600', flexShrink: 0
            }}>
              {getInitials(user?.name)}
            </div>
            <div className="navbar-user-name" style={{ textAlign: 'left' }}>
              <p style={{ fontSize: '0.875rem', fontWeight: '500', color: 'var(--gray-800)', lineHeight: 1.2 }}>
                {user?.name}
              </p>
              <p style={{ fontSize: '0.7rem', color: 'var(--gray-500)', lineHeight: 1.2, textTransform: 'capitalize' }}>
                {user?.role}
              </p>
            </div>
            <ChevronDown size={14} style={{
              color: 'var(--gray-400)',
              transform: dropdownOpen ? 'rotate(180deg)' : 'rotate(0)',
              transition: 'transform 0.2s'
            }} />
          </button>

          {dropdownOpen && (
            <div role="menu" aria-label="Account menu" style={{
              position: 'absolute', top: 'calc(100% + 8px)', right: 0,
              backgroundColor: 'var(--white)', borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-lg)', border: '1px solid var(--gray-200)',
              minWidth: '200px', zIndex: 200, overflow: 'hidden'
            }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--gray-100)' }}>
                <p style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--gray-900)' }}>{user?.name}</p>
                <p style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>{user?.email}</p>
              </div>
              <div style={{ padding: '8px' }}>
                <button
                  role="menuitem"
                  onClick={() => { navigate('/settings'); setDropdownOpen(false); }}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '10px 12px', borderRadius: 'var(--radius)',
                    border: 'none', backgroundColor: 'transparent', cursor: 'pointer',
                    fontSize: '0.875rem', color: 'var(--gray-700)'
                  }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--gray-50)'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <Settings size={16} /> Settings
                </button>
                <button
                  role="menuitem"
                  onClick={handleLogout}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '10px 12px', borderRadius: 'var(--radius)',
                    border: 'none', backgroundColor: 'transparent', cursor: 'pointer',
                    fontSize: '0.875rem', color: 'var(--danger)'
                  }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--danger-light)'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <LogOut size={16} /> Logout
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;