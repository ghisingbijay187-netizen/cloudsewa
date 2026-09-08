import { Clock, Calendar, CheckCircle } from 'lucide-react';

const schedules = [
  { type: 'Hourly', icon: <Clock size={16} />, desc: 'Every hour at :00', color: 'var(--gray-500)' },
  { type: 'Daily', icon: <Calendar size={16} />, desc: 'Every day at midnight', color: 'var(--success)' },
  { type: 'Weekly', icon: <Calendar size={16} />, desc: 'Every Sunday at midnight', color: 'var(--info)' },
  { type: 'Monthly', icon: <Calendar size={16} />, desc: '1st of every month', color: 'var(--warning)' }
];

const BackupScheduler = () => (
  <div className="stats-grid" style={{ marginBottom: '28px' }}>
    {schedules.map((s) => (
      <div key={s.type} className="card" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <div style={{ color: s.color }}>{s.icon}</div>
          <span style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--gray-800)' }}>
            {s.type} Backup
          </span>
        </div>
        <p style={{ fontSize: '0.8rem', color: 'var(--gray-500)' }}>{s.desc}</p>
        <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <CheckCircle size={12} color="var(--success)" />
          <span style={{ fontSize: '0.75rem', color: 'var(--success)' }}>Scheduler active</span>
        </div>
      </div>
    ))}
  </div>
);

export default BackupScheduler;
