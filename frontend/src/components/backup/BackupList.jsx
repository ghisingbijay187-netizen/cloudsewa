import {
  RefreshCw,
  Archive, Download, RotateCcw, Trash2, Play, ChevronLeft, ChevronRight
} from 'lucide-react';
import { formatBytes, formatDate } from '../../utils/formatters';
import { getStatusIcon, getStatusBadge, getTypeBadge } from './backupHelpers';

const BackupList = ({
  backups, loading, isAdmin, restoring,
  page, setPage, totalPages, total, limit,
  onRestore, onDownload, onDelete, onTrigger, onRefresh
}) => {
  const getPageNumbers = () => {
    const pages = [];
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || Math.abs(i - page) <= 1) {
        pages.push(i);
      } else if (pages[pages.length - 1] !== '...') {
        pages.push('...');
      }
    }
    return pages;
  };

  return (
  <div className="card" style={{ padding: 0 }}>
    <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--gray-100)' }}>
      <div className="card-header" style={{ margin: 0 }}>
        <h3 className="card-title">
          {isAdmin ? 'Backup History' : 'My Backup History'}
        </h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span className="badge badge-gray">{total} total</span>
          <button className="btn btn-ghost btn-sm" onClick={onRefresh}>
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>
      </div>
    </div>

    {loading ? (
      <div className="loading-spinner"><div className="spinner" /></div>
    ) : backups.length === 0 ? (
      <div className="empty-state">
        <Archive size={48} />
        <h3>No backups yet</h3>
        <p>
          {isAdmin
            ? 'Run a manual backup or wait for the scheduled backup'
            : 'Click "Backup My Files" to create your first backup'}
        </p>
        <button className="btn btn-primary" onClick={onTrigger} style={{ marginTop: '16px' }}>
          <Play size={16} />
          {isAdmin ? 'Run First Backup' : 'Backup My Files'}
        </button>
      </div>
    ) : (
      <>
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Status</th>
              <th>Files</th>
              <th>Size</th>
              <th>Created</th>
              <th>Completed</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {backups.map((backup) => (
              <tr key={backup._id}>
                <td data-label="Name">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Archive size={16} color="var(--gray-400)" />
                    <span style={{
                      fontSize: '0.8rem', fontWeight: '500', color: 'var(--gray-700)',
                      maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                    }}>
                      {isAdmin && backup.initiatedBy?.name
                        ? backup.initiatedBy.name.trim().split(/\s+/)[0] + "'s backup"
                        : backup.name}
                    </span>
                  </div>
                </td>
                <td data-label="Type">
                  <span className={`badge ${getTypeBadge(backup.type)}`} style={{ textTransform: 'capitalize' }}>
                    {backup.type}
                  </span>
                </td>
                <td data-label="Status">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {getStatusIcon(backup.status)}
                    <span className={`badge ${getStatusBadge(backup.status)}`} style={{ textTransform: 'capitalize' }}>
                      {backup.status.replace('_', ' ')}
                    </span>
                  </div>
                </td>
                <td data-label="Files" style={{ color: 'var(--gray-600)', fontSize: '0.875rem' }}>{backup.totalFiles}</td>
                <td data-label="Size" style={{ color: 'var(--gray-600)', fontSize: '0.875rem' }}>{formatBytes(backup.totalSize)}</td>
                <td data-label="Created" style={{ color: 'var(--gray-500)', fontSize: '0.8rem' }}>{formatDate(backup.createdAt)}</td>
                <td data-label="Completed" style={{ color: 'var(--gray-500)', fontSize: '0.8rem' }}>{formatDate(backup.completedAt)}</td>
                <td data-label="Actions">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end' }}>
                    {backup.status === 'completed' && (
                      <>
                        <button
                          className="btn-icon-highlight"
                          onClick={() => onRestore(backup)}
                          disabled={restoring === backup._id}
                          title="Restore this backup"
                          aria-label={`Restore backup from ${backup.type}`}
                          style={{ color: 'var(--success)' }}
                        >
                          {restoring === backup._id ? <RefreshCw size={16} /> : <RotateCcw size={16} />}
                        </button>
                        <button className="btn-icon" onClick={() => onDownload(backup)} title="Download backup" aria-label="Download backup">
                          <Download size={16} />
                        </button>
                      </>
                    )}
                    <button className="btn-icon" onClick={() => onDelete(backup)} title="Delete backup" aria-label="Delete backup" style={{ color: 'var(--danger)' }}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div style={{
          padding: '14px 20px',
          borderTop: '1px solid var(--gray-100)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <p style={{ fontSize: '0.85rem', color: 'var(--gray-500)' }}>
            Showing {((page - 1) * limit) + 1}–{Math.min(page * limit, total)} of {total} backups
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
              <ChevronLeft size={16} /> Prev
            </button>
            {getPageNumbers().map((p, idx) =>
              p === '...' ? (
                <span key={`e${idx}`} style={{ padding: '4px 6px', color: 'var(--gray-400)', fontSize: '0.85rem' }}>...</span>
              ) : (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 'var(--radius)',
                    border: p === page
                      ? '1.5px solid var(--primary)'
                      : '1px solid var(--gray-200)',
                    backgroundColor: p === page ? 'var(--primary)' : 'var(--white)',
                    color: p === page ? 'var(--white)' : 'var(--gray-700)',
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                    fontWeight: p === page ? '600' : '400'
                  }}
                >{p}</button>
              )
            )}
            <button className="btn btn-ghost btn-sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
              Next <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
      </>
    )}
  </div>
  );
};

export default BackupList;
