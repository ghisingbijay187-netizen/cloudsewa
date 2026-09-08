import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import API from '../api/axios';
import {
  Users, FolderOpen, Archive, HardDrive,
  Clock, AlertCircle, CheckCircle,
  Upload, Download, Trash2, Shield, File, ChevronRight, AlertTriangle
} from 'lucide-react';
import { getFileTypeLabel } from '../utils/fileHelpers';

const Dashboard = () => {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [statsError, setStatsError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [recentFiles, setRecentFiles] = useState([]);
  const [filesLoading, setFilesLoading] = useState(false);

  useEffect(() => {
    if (isAdmin) {
      fetchStats();
    } else {
      setLoading(false);
      fetchRecentFiles();
    }
  }, [isAdmin]);

  const fetchRecentFiles = async () => {
    setFilesLoading(true);
    try {
      const { data } = await API.get('/files', { params: { limit: 5 } });
      setRecentFiles(data.files || []);
    } catch (error) {
      console.error('Failed to fetch recent files:', error);
    } finally {
      setFilesLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      setStatsError(false);
      const { data } = await API.get('/dashboard/stats');
      setStats(data.stats);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
      setStatsError(true);
    } finally {
      setLoading(false);
    }
  };

  const formatBytes = (bytes) => {
    if (!Number.isFinite(Number(bytes)) || Number(bytes) <= 0) return '0 MB';
    const mb = Number(bytes) / 1024 / 1024;
    if (mb < 1024) return `${mb.toFixed(1)} MB`;
    return `${(mb / 1024).toFixed(2)} GB`;
  };

  const formatDate = (date) => {
    if (!date) return 'Never';
    return new Date(date).toLocaleString();
  };

  const formatRelative = (date) => {
    if (!date) return '';
    return formatDate(date);
  };

  const getActionIcon = (action) => {
    const icons = {
      file_upload: <Upload size={14} />,
      file_download: <Download size={14} />,
      file_delete: <Trash2 size={14} />,
      login: <CheckCircle size={14} />,
      backup_complete: <Archive size={14} />,
      user_create: <Users size={14} />
    };
    return icons[action] || <Clock size={14} />;
  };

  // Short, human-friendly label for a mimetype
  const shortMime = (mimetype) => {
    if (!mimetype) return 'Other';
    if (mimetype === 'application/octet-stream') return 'Binary';
    if (mimetype.startsWith('image/')) return 'Images';
    if (mimetype.startsWith('video/')) return 'Videos';
    if (mimetype.startsWith('audio/')) return 'Audio';
    if (mimetype.includes('pdf')) return 'PDF';
    if (mimetype.includes('word')) return 'Docs';
    if (mimetype.includes('spreadsheet') || mimetype.includes('excel')) return 'Sheets';
    if (mimetype.includes('presentation') || mimetype.includes('powerpoint')) return 'Slides';
    if (mimetype.startsWith('text/')) return 'Text';
    if (mimetype.includes('zip') || mimetype.includes('compressed')) return 'Archives';
    return 'Other';
  };

  // A 5-step CSS gradient palette for the file-type bars
  const CHART_COLORS = ['var(--primary-light)', 'var(--info)', 'var(--warning)', 'var(--success)', 'var(--accent)'];

  const getActionColor = (action) => {
    if (action.includes('delete') || action.includes('failed')) return 'var(--danger)';
    if (action.includes('upload') || action.includes('create') || action.includes('complete')) return 'var(--success)';
    if (action.includes('download') || action.includes('restore')) return 'var(--info)';
    return 'var(--gray-500)';
  };

  const storagePercent = user && user.storageLimit > 0
    ? Math.round((Number(user.storageUsed) / Number(user.storageLimit)) * 100)
    : 0;

  return (
    <div className="page-container">

      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Welcome back, {user?.name?.split(' ')[0]} 👋
          </h1>
          <p className="page-subtitle">
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </p>
        </div>

        <button
          className="btn btn-primary"
          onClick={() => navigate('/files')}
        >
          <Upload size={16} />
          Upload Files
        </button>
      </div>

      {/* Personal storage card */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="card-header">
          <h3 className="card-title">Your Storage</h3>
          <span className="badge badge-primary">
            {storagePercent}% used
          </span>
        </div>

        <div className="progress-bar" style={{ marginBottom: '12px' }}>
          <div
            className={`progress-fill ${storagePercent >= 80 ? 'danger' : storagePercent >= 60 ? 'warning' : ''}`}
            style={{ width: `${storagePercent}%` }}
          />
        </div>

        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '0.875rem',
          color: 'var(--gray-500)'
        }}>
          <span>{formatBytes(user?.storageUsed)} used</span>
          <span>{formatBytes(user?.storageLimit)} total</span>
        </div>

        {storagePercent >= 80 && (
          <div className="storage-warning">
            <AlertTriangle size={15} />
            <span>
              Storage almost full ({storagePercent}%).{' '}
              {isAdmin
                ? 'Consider freeing up space or reviewing storage.'
                : <a onClick={() => navigate('/settings')} style={{ cursor: 'pointer' }}>Manage storage in Settings</a>}
            </span>
          </div>
        )}
      </div>

      {/* Admin error banner */}
      {isAdmin && !loading && statsError && !stats && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '12px 16px',
          backgroundColor: 'var(--danger-light)',
          border: '1px solid var(--danger)',
          borderRadius: 'var(--radius)',
          color: 'var(--danger)',
          fontSize: '0.875rem',
          marginBottom: '20px'
        }}>
          <AlertTriangle size={15} />
          <span style={{ flex: 1 }}>Failed to load dashboard stats.</span>
          <button
            className="btn btn-danger btn-sm"
            onClick={() => { setStatsError(false); fetchStats(); }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Admin stats */}
      {isAdmin && !loading && stats && (
        <>
          {/* Stats grid */}
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon stat-icon-blue">
                <Users size={22} />
              </div>
              <div className="stat-info">
                <h3>{stats.users.total}</h3>
                <p>Total Users ({stats.users.active} active)</p>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon stat-icon-green">
                <FolderOpen size={22} />
              </div>
              <div className="stat-info">
                <h3>{stats.files.total}</h3>
                <p>Total Files ({stats.files.uploadsThisWeek} this week)</p>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon stat-icon-blue">
                <HardDrive size={22} />
              </div>
              <div className="stat-info">
                <h3>{stats.storage.usedGB} GB</h3>
                <p>Storage used of {stats.storage.limitGB} GB</p>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon stat-icon-green">
                <Archive size={22} />
              </div>
              <div className="stat-info">
                <h3>{stats.backups.total}</h3>
                <p>Total Backups
                  {stats.backups.failedThisWeek > 0 && (
                    <span style={{ color: 'var(--danger)' }}>
                      {' '}({stats.backups.failedThisWeek} failed)
                    </span>
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* Bottom grid */}
          <div className="dash-bottom-grid">
            {/* Last backup */}
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Last Backup</h3>
                <Archive size={18} color="var(--gray-400)" />
              </div>

              {stats.backups.lastBackup ? (
                <div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '16px'
                  }}>
                    <CheckCircle size={16} color="var(--success)" />
                    <span style={{
                      fontSize: '0.875rem',
                      color: 'var(--success)',
                      fontWeight: '500'
                    }}>
                      Completed Successfully
                    </span>
                  </div>

                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}>
                    {[
                      ['Type', stats.backups.lastBackup.type],
                      ['Files', stats.backups.lastBackup.totalFiles],
                      ['Size', formatBytes(stats.backups.lastBackup.totalSize)],
                      ['Completed', formatDate(stats.backups.lastBackup.completedAt)]
                    ].map(([label, value]) => (
                      <div key={label} style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: '0.875rem'
                      }}>
                        <span style={{ color: 'var(--gray-500)' }}>{label}</span>
                        <span style={{
                          color: 'var(--gray-800)',
                          fontWeight: '500',
                          textTransform: 'capitalize'
                        }}>
                          {value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="empty-state" style={{ padding: '20px' }}>
                  <AlertCircle size={32} />
                  <p>No backups yet</p>
                </div>
              )}
            </div>

            {/* Recent activity */}
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Recent Activity</h3>
                <Clock size={18} color="var(--gray-400)" />
              </div>

              {stats.recentActivity?.length > 0 ? (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}>
                  {stats.recentActivity.slice(0, 6).map((log) => (
                    <div
                      key={log._id}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '10px'
                      }}
                    >
                      <div style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--gray-100)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        color: getActionColor(log.action)
                      }}>
                        {getActionIcon(log.action)}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{
                          fontSize: '0.8rem',
                          color: 'var(--gray-700)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {log.description}
                        </p>
                        <p style={{
                          fontSize: '0.7rem',
                          color: 'var(--gray-400)',
                          marginTop: '2px'
                        }}>
                          {log.user?.name} • {new Date(log.createdAt).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state" style={{ padding: '20px' }}>
                  <Clock size={32} />
                  <p>No recent activity</p>
                </div>
              )}
            </div>

            {/* File type distribution */}
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Files by Type</h3>
                <FolderOpen size={18} color="var(--gray-400)" />
              </div>

              {stats.filesByType?.length > 0 ? (
                <div className="chart-holder">
                  {(() => {
                    const items = stats.filesByType;
                    const maxCount = Math.max(...items.map(i => i.count), 1);
                    return items.map((item, i) => (
                      <div key={item._id || i} className="chart-row">
                        <span className="chart-label" title={item._id}>
                          {shortMime(item._id)}
                        </span>
                        <div className="chart-bar-track">
                          <div
                            className="chart-bar-fill"
                            style={{
                              width: `${Math.max(4, (item.count / maxCount) * 100)}%`,
                              backgroundColor: CHART_COLORS[i % CHART_COLORS.length]
                            }}
                          />
                        </div>
                        <span className="chart-count">{item.count}</span>
                      </div>
                    ));
                  })()}
                </div>
              ) : (
                <div className="empty-state" style={{ padding: '20px' }}>
                  <FolderOpen size={32} />
                  <p>No files yet</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Employee view */}
      {!isAdmin && (
        <>
          {/* Quick navigation */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px',
            marginBottom: '24px'
          }}>
          {[
            {
              icon: <FolderOpen size={24} />,
              label: 'My Files',
              desc: 'View and manage your files',
              path: '/files',
              color: 'stat-icon-blue'
            },
            {
              icon: <Archive size={24} />,
              label: 'Backups',
              desc: 'View backup history',
              path: '/backups',
              color: 'stat-icon-green'
            },
            {
              icon: <Trash2 size={24} />,
              label: 'Trash',
              desc: 'Recover deleted files',
              path: '/trash',
              color: 'stat-icon-orange'
            },
            {
              icon: <Shield size={24} />,
              label: 'Settings',
              desc: 'Manage your account',
              path: '/settings',
              color: 'stat-icon-blue'
            }
          ].map((item) => (
            <div
              key={item.path}
              className="card"
              onClick={() => navigate(item.path)}
              style={{ cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s' }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = 'var(--shadow-md)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'var(--shadow)';
              }}
            >
              <div className={`stat-icon ${item.color}`} style={{ marginBottom: '16px' }}>
                {item.icon}
              </div>
              <h3 style={{
                fontSize: '1rem',
                fontWeight: '600',
                color: 'var(--gray-900)',
                marginBottom: '4px'
              }}>
                {item.label}
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--gray-500)' }}>
                {item.desc}
              </p>
            </div>
          ))}
        </div>

          {/* Recent files widget */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Recent Files</h3>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => navigate('/files')}
                style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                View all <ChevronRight size={14} />
              </button>
            </div>

            {filesLoading ? (
              <div className="empty-state" style={{ padding: '20px' }}>
                <Clock size={28} />
                <p>Loading your files...</p>
              </div>
            ) : recentFiles.length > 0 ? (
              <div className="recent-files-list">
                {recentFiles.map((file) => (
                  <div
                    key={file._id}
                    className="recent-file-row"
                    onClick={() => navigate('/files')}
                  >
                    <div className="recent-file-icon">
                      <File size={18} color="var(--accent)" />
                      <span className="recent-file-type">{getFileTypeLabel(file.mimetype)}</span>
                    </div>
                    <div className="recent-file-info">
                      <p className="recent-file-name">{file.originalName}</p>
                      <p className="recent-file-meta">
                        {file.folder?.name ? `${file.folder.name} • ` : ''}
                        {formatBytes(file.size)} • {formatRelative(file.updatedAt || file.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state" style={{ padding: '20px' }}>
                <FolderOpen size={32} />
                <p>No files yet — upload your first file</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default Dashboard;