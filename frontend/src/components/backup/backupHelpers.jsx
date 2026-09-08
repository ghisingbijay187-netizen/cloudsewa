import { CheckCircle, XCircle, Clock, RefreshCw } from 'lucide-react';

export const getStatusIcon = (status) => {
  switch (status) {
    case 'completed': return <CheckCircle size={16} color="var(--success)" />;
    case 'failed': return <XCircle size={16} color="var(--danger)" />;
    case 'in_progress': return <RefreshCw size={16} color="var(--info)" />;
    default: return <Clock size={16} color="var(--gray-400)" />;
  }
};

export const getStatusBadge = (status) => {
  const map = {
    completed: 'badge-success',
    failed: 'badge-danger',
    in_progress: 'badge-primary',
    pending: 'badge-gray'
  };
  return map[status] || 'badge-gray';
};

export const getTypeBadge = (type) => {
  const colors = {
    manual: 'badge-primary',
    hourly: 'badge-gray',
    daily: 'badge-success',
    weekly: 'badge-warning',
    monthly: 'badge-danger'
  };
  return colors[type] || 'badge-gray';
};
