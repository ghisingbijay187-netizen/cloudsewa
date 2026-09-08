import { HardDrive, AlertTriangle, CheckCircle } from 'lucide-react';
import { formatBytes, getInitials, getStorageColor, getStorageBadge } from './storageHelpers';

const UserStorageList = ({ storageStats, sortedStats, sortBy, setSortBy, loading }) => (
  <div className="card" style={{ padding: 0 }}>
    <div style={{
      padding: '16px 24px',
      borderBottom: '1px solid var(--gray-100)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    }}>
      <h3 className="card-title">Storage Per User</h3>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '0.8rem', color: 'var(--gray-500)' }}>Sort by:</span>
        <select
          className="form-select"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          style={{ width: 'auto', padding: '6px 12px', fontSize: '0.8rem' }}
        >
          <option value="usage">Most Used</option>
          <option value="percent">Highest %</option>
          <option value="name">Name</option>
        </select>
      </div>
    </div>

    {loading ? (
      <div className="loading-spinner"><div className="spinner" /></div>
    ) : storageStats.length === 0 ? (
      <div className="empty-state">
        <HardDrive size={48} />
        <h3>No storage data available</h3>
        <p>Storage statistics will appear once users upload files</p>
      </div>
    ) : (
      <div style={{ padding: '16px 24px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {sortedStats.map((stat) => (
            <div
              key={stat.id}
              style={{
                padding: '16px',
                backgroundColor: stat.percentage >= 80
                  ? 'var(--danger-light)'
                  : stat.percentage >= 60
                  ? 'var(--warning-light)'
                  : 'var(--gray-50)',
                borderRadius: 'var(--radius)',
                border: `1px solid ${
                  stat.percentage >= 80
                    ? 'var(--danger)'
                    : stat.percentage >= 60
                    ? 'var(--warning)'
                    : 'var(--gray-200)'
                }`
              }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '40px', height: '40px', borderRadius: '50%',
                    backgroundColor: stat.role === 'admin' ? 'var(--primary)' : 'var(--gray-400)',
                    color: 'white', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: '0.8rem', fontWeight: '600', flexShrink: 0
                  }}>
                    {getInitials(stat.name)}
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <p style={{ fontWeight: '600', color: 'var(--gray-900)', fontSize: '0.9rem' }}>
                        {stat.name}
                      </p>
                      <span className={`badge ${stat.role === 'admin' ? 'badge-primary' : 'badge-gray'}`}
                        style={{ fontSize: '0.7rem', textTransform: 'capitalize' }}>
                        {stat.role}
                      </span>
                      {!stat.isActive && (
                        <span className="badge badge-danger" style={{ fontSize: '0.7rem' }}>Inactive</span>
                      )}
                    </div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>{stat.email}</p>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <span className={`badge ${getStorageBadge(stat.percentage)}`} style={{ fontSize: '0.8rem' }}>
                    {stat.percentage}%
                  </span>
                  <p style={{ fontSize: '0.75rem', color: 'var(--gray-500)', marginTop: '4px' }}>
                    {formatBytes(stat.storageUsed)} / {stat.limitGB} GB
                  </p>
                </div>
              </div>

              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${stat.percentage}%`, backgroundColor: getStorageColor(stat.percentage) }}
                />
              </div>

              {stat.percentage >= 80 && (
                <div style={{
                  marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px',
                  fontSize: '0.75rem', color: 'var(--danger)'
                }}>
                  <AlertTriangle size={12} />
                  Storage almost full — consider increasing limit or deleting files
                </div>
              )}

              {stat.percentage === 0 && (
                <div style={{
                  marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px',
                  fontSize: '0.75rem', color: 'var(--success)'
                }}>
                  <CheckCircle size={12} />
                  No files uploaded yet
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    )}
  </div>
);

export default UserStorageList;
