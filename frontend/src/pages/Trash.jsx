import { useState, useEffect } from 'react';
import API from '../api/axios';
import { notify as toast } from '../utils/notify';
import { useAuth } from '../context/AuthContext';
import ConfirmModal from '../components/common/ConfirmModal';
import {
  Trash2, RotateCcw, AlertTriangle, Folder,
  File, FileText, FileImage, FileVideo,
  FileAudio, RefreshCw
} from 'lucide-react';

const Trash = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const { refreshUser } = useAuth();
  const [pendingConfirm, setPendingConfirm] = useState(null);

  useEffect(() => {
    fetchTrash();
  }, []);

  const fetchTrash = async () => {
    try {
      setLoading(true);
      const { data } = await API.get('/files/trash');
      const files = (data.files || []).map(f => ({
        ...f,
        kind: 'file',
        label: f.originalName
      }));
      const folders = (data.folders || []).map(f => ({
        ...f,
        kind: 'folder',
        label: f.name
      }));
      setItems(
        [...folders, ...files].sort(
          (a, b) => new Date(b.deletedAt) - new Date(a.deletedAt)
        )
      );
      setSelectedIds(new Set());
    } catch (error) {
      console.error('Fetch trash error:', error);
      toast.error('Failed to load trash. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (item) => {
    try {
      const url = item.kind === 'folder'
        ? `/files/folders/${item._id}/restore`
        : `/files/${item._id}/restore`;
      await API.put(url);
      toast.success(`${item.label} restored successfully`);
      fetchTrash();
    } catch {
      toast.error('Failed to restore item');
    }
  };

  const handlePermanentDelete = async (item) => {
    setPendingConfirm({
      title: 'Permanently delete?',
      message: `Permanently delete "${item.label}"?\n\nThis action cannot be undone.`,
      confirmText: 'Delete',
      variant: 'danger',
      onConfirm: async () => {
        try {
          const url = item.kind === 'folder'
            ? `/files/folders/${item._id}/permanent`
            : `/files/${item._id}/permanent`;
          await API.delete(url);
          toast.success('Item permanently deleted');
          fetchTrash();
          refreshUser();
        } catch {
          toast.error('Failed to permanently delete item');
        }
      }
    });
  };

  const handleEmptyTrash = async () => {
    setPendingConfirm({
      title: 'Empty trash?',
      message: `This will permanently delete all ${items.length} item${items.length !== 1 ? 's' : ''}.\n\nThis action cannot be undone.`,
      confirmText: 'Empty trash',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await API.delete('/files/trash/empty');
          toast.success('Trash emptied successfully');
          fetchTrash();
          refreshUser();
        } catch {
          toast.error('Failed to empty trash');
        }
      }
    });
  };

  const routeFor = (item, action) => item.kind === 'folder'
    ? `/files/folders/${item._id}/${action}`
    : `/files/${item._id}/${action}`;

  const selectedItems = items.filter((item) => selectedIds.has(item._id));

  const toggleSelect = (item) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(item._id)) next.delete(item._id);
      else next.add(item._id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === items.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(items.map((item) => item._id)));
  };

  const handleBulkRestore = async () => {
    try {
      await Promise.all(selectedItems.map((item) => API.put(routeFor(item, 'restore'))));
      toast.success(`${selectedItems.length} item${selectedItems.length !== 1 ? 's' : ''} restored successfully`);
      setSelectedIds(new Set());
      fetchTrash();
    } catch {
      toast.error('Failed to restore items');
    }
  };

  const handleBulkPermanentDelete = () => {
    const n = selectedItems.length;
    setPendingConfirm({
      title: 'Permanently delete?',
      message: `Permanently delete ${n} item${n !== 1 ? 's' : ''}?\n\nThis action cannot be undone.`,
      confirmText: 'Delete',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await Promise.all(selectedItems.map((item) => API.delete(routeFor(item, 'permanent'))));
          toast.success(`${n} item${n !== 1 ? 's' : ''} permanently deleted`);
          setSelectedIds(new Set());
          fetchTrash();
          refreshUser();
        } catch {
          toast.error('Failed to permanently delete items');
        }
      }
    });
  };

  const getItemIcon = (item) => {
    if (item.kind === 'folder') {
      return <Folder size={28} color={item.color || '#1F3864'} />;
    }
    const mimetype = item.mimetype;
    if (!mimetype) return <File size={28} color="var(--gray-400)" />;
    if (mimetype.startsWith('image/')) return <FileImage size={28} color="var(--file-image)" />;
    if (mimetype.startsWith('video/')) return <FileVideo size={28} color="var(--file-video)" />;
    if (mimetype.startsWith('audio/')) return <FileAudio size={28} color="var(--file-audio)" />;
    if (mimetype.includes('pdf')) return <FileText size={28} color="var(--file-pdf)" />;
    return <File size={28} color="var(--gray-400)" />;
  };

  const formatSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const getDaysLeft = (deletedAt) => {
    if (!deletedAt) return 30;
    const deleted = new Date(deletedAt);
    const expiry = new Date(deleted.getTime() + 30 * 24 * 60 * 60 * 1000);
    const now = new Date();
    const daysLeft = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
    return Math.max(0, daysLeft);
  };

  return (
    <div className="page-container">

      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Trash</h1>
          <p className="page-subtitle">
            Files and folders are permanently deleted after 30 days
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            className="btn btn-ghost"
            onClick={fetchTrash}
          >
            <RefreshCw size={16} />
            Refresh
          </button>
          {items.length > 0 && (
            <button
              className="btn btn-danger"
              onClick={handleEmptyTrash}
            >
              <Trash2 size={16} />
              Empty Trash
            </button>
          )}
        </div>
      </div>

      {/* Warning banner */}
      {items.length > 0 && (
        <div style={{
          padding: '12px 16px',
          backgroundColor: 'var(--warning-light)',
          border: '1px solid var(--warning)',
          borderRadius: 'var(--radius)',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontSize: '0.875rem',
          color: 'var(--warning)'
        }}>
          <AlertTriangle size={16} />
          <span>
            <strong>{items.length} item{items.length !== 1 ? 's' : ''}</strong> in trash.
            Items are automatically deleted after 30 days.
          </span>
        </div>
      )}

      {/* Items */}
      {loading ? (
        <div className="loading-spinner">
          <div className="spinner" />
        </div>
      ) : items.length === 0 ? (
        <div className="empty-state">
          <Trash2 size={48} />
          <h3>Trash is empty</h3>
          <p>Deleted files and folders will appear here for 30 days before permanent deletion</p>
        </div>
      ) : (
        <>
          {selectedIds.size > 0 && (
            <div className="card" style={{
              marginBottom: '16px',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              flexWrap: 'wrap',
              border: '1px solid var(--primary-light)',
              backgroundColor: 'var(--accent)',
              boxShadow: 'var(--shadow-md)'
            }}>
              <span style={{ fontWeight: '600', fontSize: '0.875rem', color: 'var(--primary)' }}>
                {selectedIds.size} item{selectedIds.size !== 1 ? 's' : ''} selected
              </span>
              <div style={{ flex: 1 }} />
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setSelectedIds(new Set())}
              >
                Clear
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={handleBulkRestore}
              >
                <RotateCcw size={14} />
                Restore
              </button>
              <button
                className="btn btn-danger btn-sm"
                onClick={handleBulkPermanentDelete}
              >
                <Trash2 size={14} />
                Permanently delete
              </button>
            </div>
          )}
          <div className="card" style={{ padding: 0 }}>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th style={{ width: '36px', textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      aria-label="Select all items"
                      checked={items.length > 0 && items.every((i) => selectedIds.has(i._id))}
                      onChange={handleSelectAll}
                      style={{ cursor: 'pointer' }}
                    />
                  </th>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Size</th>
                  <th>Deleted</th>
                  <th>Days Left</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((file) => {
                  const daysLeft = getDaysLeft(file.deletedAt);
                  return (
                    <tr key={`${file.kind}-${file._id}`}>
                      <td style={{ textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          aria-label={`Select ${file.label}`}
                          checked={selectedIds.has(file._id)}
                          onChange={() => toggleSelect(file)}
                          style={{ cursor: 'pointer' }}
                        />
                      </td>
                      <td data-label="Name">
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          opacity: 0.7
                        }}>
                          {getItemIcon(file)}
                          <span style={{
                            fontWeight: '500',
                            color: 'var(--gray-600)',
                            maxWidth: '300px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            textDecoration: 'line-through'
                          }}>
                            {file.label}
                          </span>
                        </div>
                      </td>
                      <td data-label="Type">
                        <span className={`badge ${file.kind === 'folder' ? 'badge-warning' : 'badge-gray'}`}>
                          {file.kind === 'folder' ? 'Folder' : 'File'}
                        </span>
                      </td>
                      <td data-label="Size" style={{
                        color: 'var(--gray-500)',
                        fontSize: '0.875rem'
                      }}>
                        {formatSize(file.kind === 'folder' ? file.totalSize : file.size)}
                      </td>
                      <td data-label="Deleted" style={{
                        color: 'var(--gray-500)',
                        fontSize: '0.875rem'
                      }}>
                        {file.deletedAt
                          ? new Date(file.deletedAt).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            })
                          : '—'}
                      </td>
                      <td data-label="Days Left">
                        <span className={`badge ${
                          daysLeft <= 3
                            ? 'badge-danger'
                            : daysLeft <= 7
                            ? 'badge-warning'
                            : 'badge-gray'
                        }`}>
                          {daysLeft} day{daysLeft !== 1 ? 's' : ''}
                        </span>
                      </td>
                      <td data-label="Actions">
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          justifyContent: 'flex-end'
                        }}>
                          <button
                            className="btn-icon-highlight"
                            onClick={() => handleRestore(file)}
                            title="Restore"
                            style={{ color: 'var(--success)' }}
                          >
                            <RotateCcw size={16} />
                          </button>
                          <button
                            className="btn-icon-danger"
                            onClick={() => handlePermanentDelete(file)}
                            title="Permanently delete"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        </>
      )}
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

export default Trash;