import { HardDrive, TrendingUp, AlertTriangle, Users } from 'lucide-react';
import { formatBytes, getStorageColor, getStorageBadge } from './storageHelpers';

const StorageOverview = ({ storageStats }) => {
  const totalUsed = storageStats.reduce((sum, s) => sum + (s.storageUsed || 0), 0);
  const totalLimit = storageStats.reduce((sum, s) => sum + (s.storageLimit || 0), 0);
  const totalPercent = totalLimit > 0 ? Math.round((totalUsed / totalLimit) * 100) : 0;
  const usersAbove80 = storageStats.filter(s => s.percentage >= 80).length;
  const usersAbove60 = storageStats.filter(s => s.percentage >= 60 && s.percentage < 80).length;

  return (
    <>
      <div className="stats-grid" style={{ marginBottom: '24px' }}>
        <div className="stat-card">
          <div className="stat-icon stat-icon-blue"><HardDrive size={22} /></div>
          <div className="stat-info">
            <h3>{formatBytes(totalUsed)}</h3>
            <p>Total Storage Used</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon stat-icon-blue"><TrendingUp size={22} /></div>
          <div className="stat-info">
            <h3>{totalPercent}%</h3>
            <p>Overall Usage ({formatBytes(totalLimit)} total)</p>
          </div>
        </div>

        <div className="stat-card">
          <div className={`stat-icon ${usersAbove80 > 0 ? 'stat-icon-red' : 'stat-icon-green'}`}>
            <AlertTriangle size={22} />
          </div>
          <div className="stat-info">
            <h3>{usersAbove80}</h3>
            <p>Users Above 80% Capacity</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon stat-icon-green"><Users size={22} /></div>
          <div className="stat-info">
            <h3>{storageStats.length}</h3>
            <p>Total Users ({usersAbove60} need attention)</p>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="card-header">
          <h3 className="card-title">System Storage Overview</h3>
          <span className={`badge ${getStorageBadge(totalPercent)}`}>{totalPercent}% used</span>
        </div>

        <div className="progress-bar" style={{ height: '12px', marginBottom: '12px' }}>
          <div
            className="progress-fill"
            style={{ width: `${totalPercent}%`, backgroundColor: getStorageColor(totalPercent) }}
          />
        </div>

        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '0.875rem',
          color: 'var(--gray-500)'
        }}>
          <span>{formatBytes(totalUsed)} used</span>
          <span>{formatBytes(totalLimit - totalUsed)} available</span>
          <span>{formatBytes(totalLimit)} total</span>
        </div>

        {totalPercent >= 80 && (
          <div style={{
            marginTop: '16px',
            padding: '12px 16px',
            backgroundColor: 'var(--danger-light)',
            borderRadius: 'var(--radius)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '0.875rem',
            color: 'var(--danger)'
          }}>
            <AlertTriangle size={16} />
            System storage is above 80%. Consider expanding storage capacity.
          </div>
        )}
      </div>
    </>
  );
};

export default StorageOverview;
