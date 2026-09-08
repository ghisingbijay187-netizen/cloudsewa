import { Settings, Info, Save, Loader } from 'lucide-react';

const retentionTypes = [
  { key: 'hourly', label: 'Hourly Backups', desc: 'Max hourly backups to keep', color: 'var(--gray-500)' },
  { key: 'daily', label: 'Daily Backups', desc: 'Max daily backups to keep', color: 'var(--success)' },
  { key: 'weekly', label: 'Weekly Backups', desc: 'Max weekly backups to keep', color: 'var(--info)' },
  { key: 'monthly', label: 'Monthly Backups', desc: 'Max monthly backups to keep', color: 'var(--warning)' },
  { key: 'manual', label: 'Manual Backups', desc: 'Max manual backups to keep per user', color: 'var(--primary-light)' }
];

const RetentionPolicy = ({
  retentionSettings, setRetentionSettings,
  getCountForType, deletableCounts,
  onApply, loading, onCancel, fetching
}) => (
  <div className="card" style={{ marginBottom: '24px' }}>
    <div className="card-header">
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <Settings size={18} color="var(--primary)" />
        <h3 className="card-title">Backup Retention Policy</h3>
      </div>
      <span className="badge badge-primary">Admin Only</span>
    </div>

    <div style={{
      padding: '12px 16px',
      backgroundColor: 'var(--accent)',
      borderRadius: 'var(--radius)',
      marginBottom: '20px',
      display: 'flex',
      alignItems: 'flex-start',
      gap: '10px',
      fontSize: '0.8rem',
      color: 'var(--primary)'
    }}>
      <Info size={14} style={{ flexShrink: 0, marginTop: '2px' }} />
      Set the maximum number of backups to retain for each type.
      When the limit is exceeded, the oldest backups are automatically deleted.
      Manual backups apply per user (admins and employees are kept separately).
      Click "Apply Policy" to enforce the current limits immediately.
    </div>

    {fetching && (
      <p style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        fontSize: '0.8rem',
        color: 'var(--gray-500)',
        marginBottom: '16px'
      }}>
        <Loader size={14} style={{ flexShrink: 0, animation: 'spin 1s linear infinite' }} />
        Loading current retention settings…
      </p>
    )}

    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
      gap: '16px',
      marginBottom: '20px',
      opacity: fetching ? 0.6 : 1,
      pointerEvents: fetching ? 'none' : 'auto'
    }}>
      {retentionTypes.map(({ key, label, desc, color }) => (
        <div
          key={key}
          style={{
            padding: '16px',
            backgroundColor: 'var(--gray-50)',
            borderRadius: 'var(--radius)',
            border: '1px solid var(--gray-200)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
            <div>
              <p style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--gray-800)', marginBottom: '2px' }}>
                {label}
              </p>
              <p style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>{desc}</p>
            </div>
            <span className="badge badge-gray" style={{ fontSize: '0.7rem', flexShrink: 0 }}>
              {fetching ? '…' : `${getCountForType(key)} current`}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={() => setRetentionSettings(prev => ({
                ...prev,
                [key]: Math.max(1, (prev[key] || 1) - 1)
              }))}
              style={{
                width: '32px', height: '32px', borderRadius: 'var(--radius)',
                border: '1px solid var(--gray-300)', backgroundColor: 'var(--white)',
                cursor: 'pointer', fontSize: '1.2rem', display: 'flex',
                alignItems: 'center', justifyContent: 'center', flexShrink: 0
              }}
            >−</button>

            <input
              type="number"
              min="1"
              max="100"
              value={retentionSettings[key] || 1}
              onChange={(e) => setRetentionSettings(prev => ({
                ...prev,
                [key]: Math.max(1, parseInt(e.target.value) || 1)
              }))}
              style={{
                flex: 1, textAlign: 'center', padding: '8px',
                border: `2px solid ${color}`, borderRadius: 'var(--radius)',
                fontSize: '1rem', fontWeight: '700', color: color,
                backgroundColor: 'var(--white)', outline: 'none'
              }}
            />

            <button
              onClick={() => setRetentionSettings(prev => ({
                ...prev,
                [key]: Math.min(100, (prev[key] || 1) + 1)
              }))}
              style={{
                width: '32px', height: '32px', borderRadius: 'var(--radius)',
                border: '1px solid var(--gray-300)', backgroundColor: 'var(--white)',
                cursor: 'pointer', fontSize: '1.2rem', display: 'flex',
                alignItems: 'center', justifyContent: 'center', flexShrink: 0
              }}
            >+</button>
          </div>

          {deletableCounts[key] > 0 && (
            <p style={{
              fontSize: '0.75rem', color: 'var(--danger)', marginTop: '8px',
              display: 'flex', alignItems: 'center', gap: '4px'
            }}>
              ⚠ {deletableCounts[key]} backup(s) will be deleted
            </p>
          )}
        </div>
      ))}
    </div>

    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
      <button className="btn btn-ghost" onClick={onCancel} disabled={fetching}>Cancel</button>
      <button className="btn btn-primary" onClick={onApply} disabled={loading || fetching}>
        <Save size={16} />
        {fetching ? 'Loading…' : loading ? 'Applying…' : 'Apply Policy'}
      </button>
    </div>
  </div>
);

export default RetentionPolicy;
