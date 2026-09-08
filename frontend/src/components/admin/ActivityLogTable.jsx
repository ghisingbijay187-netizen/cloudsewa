import {
  Activity, Clock, ChevronLeft, ChevronRight
} from 'lucide-react';
import {
  ACTION_ICONS, ACTION_COLORS, ACTION_BADGE,
  formatDateTime, formatAction, getInitials
} from './activityHelpers';

const ActivityLogTable = ({
  logs, loading, total, page, setPage, totalPages,
  limit, action, startDate, endDate, onReset
}) => {
  const hasFilter = action || startDate || endDate;

  return (
    <div className="card" style={{ padding: 0 }}>
      <div style={{
        padding: '16px 24px',
        borderBottom: '1px solid var(--gray-100)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <h3 className="card-title">
          {action ? `Showing: ${formatAction(action)}` : 'All Activity'}
        </h3>
        <span className="badge badge-gray">
          Page {page} of {totalPages}
        </span>
      </div>

      {loading ? (
        <div className="loading-spinner"><div className="spinner" /></div>
      ) : logs.length === 0 ? (
        <div className="empty-state">
          <Activity size={48} />
          <h3>No activity logs found</h3>
          <p>
            {hasFilter
              ? 'Try adjusting your filters'
              : 'Activity will appear here as users interact with the system'}
          </p>
          {hasFilter && (
            <button className="btn btn-ghost" onClick={onReset} style={{ marginTop: '16px' }}>
              Clear Filters
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Action</th>
                  <th>Description</th>
                  <th>Resource</th>
                  <th>IP Address</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log._id}>
                    <td data-label="User">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{
                          width: '30px',
                          height: '30px',
                          borderRadius: '50%',
                          backgroundColor: 'var(--primary)',
                          color: 'white',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.65rem',
                          fontWeight: '600',
                          flexShrink: 0
                        }}>
                          {getInitials(log.user?.name)}
                        </div>
                        <div>
                          <p style={{ fontSize: '0.8rem', fontWeight: '500', color: 'var(--gray-800)' }}>
                            {log.user?.name || 'Unknown'}
                          </p>
                          <p style={{ fontSize: '0.7rem', color: 'var(--gray-400)' }}>
                            {log.user?.email || '—'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td data-label="Action">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ color: ACTION_COLORS[log.action] || 'var(--gray-400)' }}>
                          {ACTION_ICONS[log.action] || <Activity size={14} />}
                        </span>
                        <span className={`badge ${ACTION_BADGE[log.action] || 'badge-gray'}`}
                          style={{ fontSize: '0.7rem', textTransform: 'capitalize' }}>
                          {formatAction(log.action)}
                        </span>
                      </div>
                    </td>
                    <td data-label="Description" style={{ maxWidth: '280px', fontSize: '0.8rem', color: 'var(--gray-600)' }}>
                      <span style={{
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block'
                      }}>
                        {log.description}
                      </span>
                    </td>
                    <td data-label="Resource">
                      {log.resourceType ? (
                        <div>
                          <span className="badge badge-gray" style={{ fontSize: '0.7rem', textTransform: 'capitalize' }}>
                            {log.resourceType}
                          </span>
                          {log.resourceName && (
                            <p style={{
                              fontSize: '0.7rem', color: 'var(--gray-400)', marginTop: '2px',
                              maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                            }}>
                              {log.resourceName}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span style={{ color: 'var(--gray-300)' }}>—</span>
                      )}
                    </td>
                    <td data-label="IP Address" style={{ fontSize: '0.8rem', color: 'var(--gray-500)', fontFamily: 'var(--font-mono)' }}>
                      {log.ipAddress || '—'}
                    </td>
                    <td data-label="Time">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--gray-500)' }}>
                        <Clock size={12} />
                        {formatDateTime(log.createdAt)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--gray-100)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <p style={{ fontSize: '0.875rem', color: 'var(--gray-500)' }}>
              Showing {((page - 1) * limit) + 1}–{Math.min(page * limit, total)} of {total} events
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                <ChevronLeft size={16} /> Previous
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                Next <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ActivityLogTable;
