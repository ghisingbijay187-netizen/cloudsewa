import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import API from '../api/axios';
import { notify as toast } from '../utils/notify';
import { Play, Settings, Shield } from 'lucide-react';

import BackupScheduler from '../components/backup/BackupScheduler';
import RetentionPolicy from '../components/backup/RetentionPolicy';
import BackupList from '../components/backup/BackupList';
import ConfirmModal from '../components/common/ConfirmModal';

const BackupManager = () => {
  const { isAdmin } = useAuth();
  const LIMIT = 10;
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [triggering, setTriggering] = useState(false);
  const [restoring, setRestoring] = useState(null);
  const [showRetention, setShowRetention] = useState(false);
  const [retentionSettings, setRetentionSettings] = useState({
    hourly: 24,
    daily: 7,
    weekly: 4,
    monthly: 3,
    manual: 10
  });
  const [retentionLoading, setRetentionLoading] = useState(false);
  const [retentionFetching, setRetentionFetching] = useState(false);
  const [currentCounts, setCurrentCounts] = useState([]);
  const [deletableCounts, setDeletableCounts] = useState({});
  const [pendingConfirm, setPendingConfirm] = useState(null);

  useEffect(() => {
    fetchBackups();
    if (isAdmin) fetchRetentionSettings();
  }, [page, isAdmin]);

  const fetchBackups = async () => {
    try {
      setLoading(true);
      const endpoint = isAdmin ? '/backups' : '/backups/my-backups';
      const { data } = await API.get(endpoint, {
        params: { page, limit: LIMIT }
      });
      setBackups(data.backups || []);
      setTotalPages(data.totalPages || 1);
      setTotal(data.total || 0);
    } catch (error) {
      console.error('Fetch backups error:', error);
      toast.error('Failed to load backups. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchRetentionSettings = async () => {
    try {
      setRetentionFetching(true);
      const { data } = await API.get('/backups/retention');
      setRetentionSettings(data.retentionSettings);
      setCurrentCounts(data.currentCounts || []);
      setDeletableCounts(data.deletableCounts || {});
    } catch (error) {
      console.error('Fetch retention error:', error);
      toast.error('Failed to load retention settings');
    } finally {
      setRetentionFetching(false);
    }
  };

  const handleApplyRetention = async () => {
    setPendingConfirm({
      title: 'Apply retention policy?',
      message:
        'This will permanently delete backups exceeding the limits:\n' +
        `• Hourly: keep last ${retentionSettings.hourly}\n` +
        `• Daily: keep last ${retentionSettings.daily}\n` +
        `• Weekly: keep last ${retentionSettings.weekly}\n` +
        `• Monthly: keep last ${retentionSettings.monthly}\n` +
        `• Manual: keep last ${retentionSettings.manual}`,
      confirmText: 'Apply policy',
      variant: 'danger',
      onConfirm: async () => {
        try {
          setRetentionLoading(true);
          const { data } = await API.put('/backups/retention', retentionSettings);
          toast.success(data.message);
          fetchBackups();
          fetchRetentionSettings();
        } catch {
          toast.error('Failed to apply retention policy');
        } finally {
          setRetentionLoading(false);
        }
      }
    });
  };

  const triggerBackup = async () => {
    const message = isAdmin
      ? 'Trigger a full system backup now?'
      : 'Backup your files now?';
    setPendingConfirm({
      title: 'Start backup?',
      message,
      confirmText: 'Start backup',
      variant: 'primary',
      onConfirm: async () => {
        try {
          setTriggering(true);
          const endpoint = isAdmin ? '/backups/manual' : '/backups/my-backup';
          await API.post(endpoint);
          toast.success(
            isAdmin
              ? 'System backup completed successfully'
              : 'Your files have been backed up successfully'
          );
          fetchBackups();
        } catch (error) {
          toast.error('Backup failed: ' + (error.response?.data?.message || 'Unknown error'));
        } finally {
          setTriggering(false);
        }
      }
    });
  };

  const handleRestore = async (backup) => {
    setPendingConfirm({
      title: 'Restore backup?',
      message: `Restore backup "${backup.name}"?\n\nThis will restore all files from this backup.`,
      confirmText: 'Restore',
      variant: 'primary',
      onConfirm: async () => {
        try {
          setRestoring(backup._id);
          const { data } = await API.post(`/backups/${backup._id}/restore`);
          toast.success(data.message);
          fetchBackups();
        } catch (error) {
          toast.error('Restore failed: ' + (error.response?.data?.message || 'Unknown error'));
        } finally {
          setRestoring(null);
        }
      }
    });
  };

  const handleDownload = async (backup) => {
    try {
      const response = await API.get(`/backups/${backup._id}/download`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${backup.name}.zip`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Backup download started');
    } catch {
      toast.error('Download failed');
    }
  };

  const handleDelete = async (backup) => {
    setPendingConfirm({
      title: 'Delete backup?',
      message: `Delete backup "${backup.name}"?\n\nThis cannot be undone.`,
      confirmText: 'Delete',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await API.delete(`/backups/${backup._id}`);
          toast.success('Backup deleted');
          fetchBackups();
        } catch {
          toast.error('Failed to delete backup');
        }
      }
    });
  };

  const getCountForType = (type) => {
    const found = currentCounts.find(c => c._id === type);
    return found ? found.count : 0;
  };

  return (
    <div className="page-container">

      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            {isAdmin ? 'Backup Manager' : 'My Backups'}
          </h1>
          <p className="page-subtitle">
            {isAdmin
              ? 'Manage system-wide backups and restore files'
              : 'Backup and restore your own files'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          {isAdmin && (
            <button
              className="btn btn-ghost"
              onClick={() => setShowRetention(!showRetention)}
            >
              <Settings size={16} />
              Retention Policy
            </button>
          )}
          <button
            className="btn btn-primary"
            onClick={triggerBackup}
            disabled={triggering}
          >
            <Play size={16} />
            {triggering
              ? 'Running Backup...'
              : isAdmin ? 'Run System Backup' : 'Backup My Files'}
          </button>
        </div>
      </div>

      {isAdmin && showRetention && (
        <RetentionPolicy
          retentionSettings={retentionSettings}
          setRetentionSettings={setRetentionSettings}
          getCountForType={getCountForType}
          deletableCounts={deletableCounts}
          onApply={handleApplyRetention}
          loading={retentionLoading}
          fetching={retentionFetching}
          onCancel={() => setShowRetention(false)}
        />
      )}

      {isAdmin && <BackupScheduler />}

      {!isAdmin && (
        <div style={{
          padding: '16px 20px',
          backgroundColor: 'var(--accent)',
          borderRadius: 'var(--radius-lg)',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px'
        }}>
          <Shield size={20} color="var(--primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <p style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--primary)', marginBottom: '4px' }}>
              Your Personal Backup
            </p>
            <p style={{ fontSize: '0.8rem', color: 'var(--gray-600)' }}>
              You can backup and restore your own files here.
              System-wide backups are managed by the administrator.
              Your backups are stored for 30 days.
            </p>
          </div>
        </div>
      )}

      <BackupList
        backups={backups}
        loading={loading}
        isAdmin={isAdmin}
        restoring={restoring}
        page={page}
        setPage={setPage}
        totalPages={totalPages}
        total={total}
        limit={LIMIT}
        onRestore={handleRestore}
        onDownload={handleDownload}
        onDelete={handleDelete}
        onTrigger={triggerBackup}
        onRefresh={fetchBackups}
      />

      <ConfirmModal
        open={!!pendingConfirm}
        title={pendingConfirm?.title}
        message={pendingConfirm?.message}
        confirmText={pendingConfirm?.confirmText}
        variant={pendingConfirm?.variant}
        onConfirm={() => pendingConfirm?.onConfirm?.()}
        onCancel={() => setPendingConfirm(null)}
      />
    </div>
  );
};

export default BackupManager;
