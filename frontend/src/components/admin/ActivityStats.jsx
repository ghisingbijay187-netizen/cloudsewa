import { Activity, Upload, Shield, Archive } from 'lucide-react';

const ActivityStats = ({ total, counts, loading }) => {
  const stats = [
    {
      label: 'Total Events',
      value: loading ? null : total,
      icon: <Activity size={20} />,
      color: 'stat-icon-blue'
    },
    {
      label: 'File Operations',
      value: loading ? null : counts.fileOps,
      icon: <Upload size={20} />,
      color: 'stat-icon-green'
    },
    {
      label: 'Auth Events',
      value: loading ? null : counts.authEvents,
      icon: <Shield size={20} />,
      color: 'stat-icon-blue'
    },
    {
      label: 'Backup Events',
      value: loading ? null : counts.backupEvents,
      icon: <Archive size={20} />,
      color: 'stat-icon-green'
    }
  ];

  return (
    <div className="stats-grid" style={{ marginBottom: '24px' }}>
      {stats.map((stat) => (
        <div key={stat.label} className="stat-card">
          <div className={`stat-icon ${stat.color}`}>{stat.icon}</div>
          <div className="stat-info">
            <h3>{loading ? '—' : stat.value}</h3>
            <p>{stat.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ActivityStats;
