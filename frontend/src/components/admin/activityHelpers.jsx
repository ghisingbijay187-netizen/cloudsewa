import {
  Activity, Upload, Download, Trash2, LogIn,
  LogOut, Archive, Users, Settings,
  Folder, Shield, Tags
} from 'lucide-react';
import { getInitials as _getInitials } from '../../utils/formatters';

export const getInitials = _getInitials;

export const ACTION_ICONS = {
  login: <LogIn size={14} />,
  logout: <LogOut size={14} />,
  register: <Users size={14} />,
  login_failed: <Shield size={14} />,
  account_locked: <Shield size={14} />,
  file_upload: <Upload size={14} />,
  upload_rejected: <Shield size={14} />,
  file_download: <Download size={14} />,
  file_delete: <Trash2 size={14} />,
  file_restore: <Activity size={14} />,
  file_permanent_delete: <Trash2 size={14} />,
  file_version_restore: <Activity size={14} />,
  file_version_delete: <Trash2 size={14} />,
  file_share: <Users size={14} />,
  file_tags_update: <Tags size={14} />,
  folder_create: <Folder size={14} />,
  folder_delete: <Folder size={14} />,
  backup_start: <Archive size={14} />,
  backup_complete: <Archive size={14} />,
  backup_failed: <Archive size={14} />,
  backup_delete: <Trash2 size={14} />,
  backup_download: <Download size={14} />,
  backup_restore: <Archive size={14} />,
  user_create: <Users size={14} />,
  user_update: <Users size={14} />,
  user_delete: <Users size={14} />,
  user_deactivate: <Users size={14} />,
  role_change: <Shield size={14} />,
  settings_update: <Settings size={14} />,
  password_change: <Shield size={14} />
};

export const ACTION_COLORS = {
  login: 'var(--success)',
  logout: 'var(--gray-400)',
  register: 'var(--success)',
  login_failed: 'var(--danger)',
  account_locked: 'var(--danger)',
  file_upload: 'var(--success)',
  upload_rejected: 'var(--danger)',
  file_download: 'var(--info)',
  file_delete: 'var(--warning)',
  file_restore: 'var(--success)',
  file_permanent_delete: 'var(--danger)',
  file_version_restore: 'var(--info)',
  file_version_delete: 'var(--danger)',
  file_share: 'var(--primary-light)',
  file_tags_update: 'var(--info)',
  folder_create: 'var(--success)',
  folder_delete: 'var(--warning)',
  backup_start: 'var(--info)',
  backup_complete: 'var(--success)',
  backup_failed: 'var(--danger)',
  backup_delete: 'var(--danger)',
  backup_download: 'var(--info)',
  backup_restore: 'var(--success)',
  user_create: 'var(--success)',
  user_update: 'var(--info)',
  user_delete: 'var(--danger)',
  user_deactivate: 'var(--warning)',
  role_change: 'var(--warning)',
  settings_update: 'var(--info)',
  password_change: 'var(--warning)'
};

export const ACTION_BADGE = {
  login: 'badge-success',
  logout: 'badge-gray',
  register: 'badge-success',
  login_failed: 'badge-danger',
  account_locked: 'badge-danger',
  file_upload: 'badge-success',
  upload_rejected: 'badge-danger',
  file_download: 'badge-primary',
  file_delete: 'badge-warning',
  file_restore: 'badge-success',
  file_permanent_delete: 'badge-danger',
  file_version_restore: 'badge-primary',
  file_version_delete: 'badge-danger',
  file_share: 'badge-primary',
  file_tags_update: 'badge-primary',
  folder_create: 'badge-success',
  folder_delete: 'badge-warning',
  backup_start: 'badge-primary',
  backup_complete: 'badge-success',
  backup_failed: 'badge-danger',
  backup_delete: 'badge-danger',
  backup_download: 'badge-primary',
  backup_restore: 'badge-success',
  user_create: 'badge-success',
  user_update: 'badge-primary',
  user_delete: 'badge-danger',
  user_deactivate: 'badge-warning',
  role_change: 'badge-warning',
  settings_update: 'badge-primary',
  password_change: 'badge-warning'
};

export const ACTION_TYPES = [
  { value: '', label: 'All Actions' },
  { value: 'login', label: 'Login' },
  { value: 'logout', label: 'Logout' },
  { value: 'login_failed', label: 'Failed Login' },
  { value: 'file_upload', label: 'File Upload' },
  { value: 'upload_rejected', label: 'Upload Rejected' },
  { value: 'file_download', label: 'File Download' },
  { value: 'file_delete', label: 'File Delete' },
  { value: 'file_restore', label: 'File Restore' },
  { value: 'file_permanent_delete', label: 'Permanent Delete' },
  { value: 'file_version_restore', label: 'Version Restore' },
  { value: 'file_version_delete', label: 'Version Delete' },
  { value: 'file_tags_update', label: 'Tags Update' },
  { value: 'folder_create', label: 'Folder Create' },
  { value: 'backup_start', label: 'Backup Start' },
  { value: 'backup_complete', label: 'Backup Complete' },
  { value: 'backup_failed', label: 'Backup Failed' },
  { value: 'backup_delete', label: 'Backup Delete' },
  { value: 'backup_download', label: 'Backup Download' },
  { value: 'backup_restore', label: 'Backup Restore' },
  { value: 'user_create', label: 'User Create' },
  { value: 'user_update', label: 'User Update' },
  { value: 'user_delete', label: 'User Delete' },
  { value: 'password_change', label: 'Password Change' }
];

export const formatDateTime = (date) => {
  if (!date) return '—';
  return new Date(date).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
};

export const formatAction = (action) => {
  return action?.replace(/_/g, ' ') || '—';
};
