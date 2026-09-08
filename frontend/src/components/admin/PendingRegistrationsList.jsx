import { RefreshCw, Check, X as XIcon, UserPlus } from 'lucide-react';

const PendingRegistrationsList = ({
  users, loading, processingUser, onApprove, onReject, onRefresh
}) => (
  <div className="card" style={{ padding: 0 }}>
    <div style={{
      padding: '20px 24px', borderBottom: '1px solid var(--gray-100)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between'
    }}>
      <div>
        <h3 className="card-title">Pending Registrations</h3>
        <p style={{ fontSize: '0.8rem', color: 'var(--gray-500)', marginTop: '4px' }}>
          Approve or reject user accounts before they can sign in
        </p>
      </div>
      <button className="btn btn-ghost btn-sm" onClick={onRefresh}>
        <RefreshCw size={14} /> Refresh
      </button>
    </div>

    {loading ? (
      <div className="loading-spinner"><div className="spinner" /></div>
    ) : users.length === 0 ? (
      <div className="empty-state">
        <UserPlus size={48} />
        <h3>No pending registrations</h3>
        <p>New registrations will appear here for your approval before they can use the workspace</p>
      </div>
    ) : (
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Requested At</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user._id}>
                <td data-label="Name">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '36px', height: '36px', borderRadius: '50%',
                      backgroundColor: 'var(--gray-300)', color: 'white',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.75rem', fontWeight: '600', flexShrink: 0
                    }}>
                      {user.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                    </div>
                    <p style={{ fontWeight: '500', color: 'var(--gray-900)', fontSize: '0.875rem' }}>
                      {user.name || 'Unknown'}
                    </p>
                  </div>
                </td>
                <td data-label="Email" style={{ color: 'var(--gray-600)', fontSize: '0.875rem' }}>
                  {user.email}
                </td>
                <td data-label="Requested At" style={{ color: 'var(--gray-500)', fontSize: '0.875rem' }}>
                  {new Date(user.createdAt).toLocaleString('en-US', {
                    month: 'short', day: 'numeric', year: 'numeric',
                    hour: '2-digit', minute: '2-digit'
                  })}
                </td>
                <td data-label="Status">
                  <span className="badge badge-warning" style={{ textTransform: 'capitalize' }}>
                    {user.registrationStatus}
                  </span>
                </td>
                <td data-label="Actions">
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => onApprove(user)}
                      disabled={processingUser === user._id}
                    >
                      <Check size={14} /> Approve
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => onReject(user)}
                      disabled={processingUser === user._id}
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

export default PendingRegistrationsList;