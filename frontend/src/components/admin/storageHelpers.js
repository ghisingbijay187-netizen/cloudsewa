import { formatBytes, getInitials } from '../../utils/formatters';

export { formatBytes, getInitials };

export const getStorageColor = (percent) => {
  if (percent >= 80) return 'var(--danger)';
  if (percent >= 60) return 'var(--warning)';
  return 'var(--success)';
};

export const getStorageBadge = (percent) => {
  if (percent >= 80) return 'badge-danger';
  if (percent >= 60) return 'badge-warning';
  return 'badge-success';
};
