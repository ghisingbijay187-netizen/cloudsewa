import { RefreshCw, Check, X as XIcon, Key } from 'lucide-react';

const ResetRequestsList = ({
  requests, loading, processingRequest, onApprove, onReject, onRefresh
}) => (
  <div className="card" style={{ padding: 0 }}>
    <div style={{
      padding: '20px 24px', borderBottom: '1px solid var(--gray-100)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between'
    }}>
      <div>
        <h3 className="card-title">Password Reset Requests</h3>
        <p style={{ fontSize: '0.8rem', color: 'var(--gray-500)', marginTop: '4px' }}>
          Review and approve employee password reset requests
        </p>
      </div>
      <button className="btn btn-ghost btn-sm" onClick={onRefresh}>
        <RefreshCw size={14} /> Refresh
      </button>
    </div>

    {loading ? (
      <div className="loading-spinner"><div className="spinner" /></div>
    ) : requests.length === 0 ? (
      <div className="empty-state">
        <Key size={48} />
        <h3>No pending requests</h3>
        <p>Password reset requests from employees will appear here for your approval</p>
      </div>
    ) : (
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Employee</th>
              <th>Email</th>
              <th>Requested At</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {requests.map((request) => (
              <tr key={request._id}>
                <td data-label="Employee">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '36px', height: '36px', borderRadius: '50%',
                      backgroundColor: 'var(--gray-300)', color: 'white',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.75rem', fontWeight: '600', flexShrink: 0
                    }}>
                      {request.user?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                    </div>
                    <p style={{ fontWeight: '500', color: 'var(--gray-900)', fontSize: '0.875rem' }}>
                      {request.user?.name || 'Unknown'}
                    </p>
                  </div>
                </td>
                <td data-label="Email" style={{ color: 'var(--gray-600)', fontSize: '0.875rem' }}>
                  {request.email}
                </td>
                <td data-label="Requested At" style={{ color: 'var(--gray-500)', fontSize: '0.875rem' }}>
                  {new Date(request.createdAt).toLocaleString('en-US', {
                    month: 'short', day: 'numeric', year: 'numeric',
                    hour: '2-digit', minute: '2-digit'
                  })}
                </td>
                <td data-label="Status">
                  <span className="badge badge-warning" style={{ textTransform: 'capitalize' }}>
                    {request.status}
                  </span>
                </td>
                <td data-label="Actions">
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => onApprove(request)}
                      disabled={processingRequest === request._id}
                    >
                      <Check size={14} /> Approve
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => onReject(request)}
                      disabled={processingRequest === request._id}
                    >
                      <XIcon size={14} /> Reject
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </div>
);

export default ResetRequestsList;
