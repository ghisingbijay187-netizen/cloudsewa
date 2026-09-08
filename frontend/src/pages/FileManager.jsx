import { useState, useEffect, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useSearchParams } from 'react-router-dom';
import API from '../api/axios';
import { notify as toast } from '../utils/notify';
import { useAuth } from '../context/AuthContext';
import { canPreview } from '../utils/fileHelpers.jsx';
import {
  FolderPlus, Upload, Star, Eye, Download, Share2, History, Pencil,
  FolderInput, Tag, Trash2, FolderOpen, X, Files, Clock
} from 'lucide-react';

import Breadcrumb from '../components/files/Breadcrumb';
import FileUpload from '../components/files/FileUpload';
import FolderTree from '../components/files/FolderTree';
import FileList from '../components/files/FileList';
import SharedWithMe from '../components/files/SharedWithMe';
import ShareModal from '../components/files/ShareModal';
import FilePreviewModal from '../components/files/FilePreviewModal';
import VersionHistoryModal from '../components/files/VersionHistoryModal';
import RenameModal from '../components/files/RenameModal';
import MoveModal from '../components/files/MoveModal';
import TagsModal from '../components/files/TagsModal';
import ConfirmModal from '../components/common/ConfirmModal';
import ContextMenu from '../components/common/ContextMenu';

console.log('%c[CloudSewa] FileManager build v4 (idempotent bulk delete ACTIVE)', 'color:#0b6b3a;font-weight:bold');
import UploadQueue from '../components/files/UploadQueue';
import useSessionState from '../hooks/useSessionState';

const FileManager = () => {
  const { refreshUser, isAdmin } = useAuth();
  const [files, setFiles] = useState([]);
  const [filesError, setFilesError] = useState(false);
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useSessionState('fm:search', searchParams.get('search') || '');
  const [currentFolder, setCurrentFolder] = useSessionState('fm:folder', null);
  const [breadcrumb, setBreadcrumb] = useSessionState('fm:breadcrumb', []);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [showVersions, setShowVersions] = useState(false);
  const [selectedFileVersions, setSelectedFileVersions] = useState(null);
  const [restoringVersion, setRestoringVersion] = useState(false);
  const [deletingVersion, setDeletingVersion] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalFiles, setTotalFiles] = useState(0);
  const [showShare, setShowShare] = useState(false);
  const [sharingFile, setSharingFile] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [sharingLoading, setSharingLoading] = useState(false);
  const [sharedFiles, setSharedFiles] = useState([]);
  const LIMIT = 20;

  // Rename modal state
  const [showRename, setShowRename] = useState(false);
  const [renamingItem, setRenamingItem] = useState(null);
  const [renamingType, setRenamingType] = useState(null); // 'file' | 'folder'
  const [renameLoading, setRenameLoading] = useState(false);

  // Move modal state
  const [showMove, setShowMove] = useState(false);
  const [movingFile, setMovingFile] = useState(null);
  const [moveLoading, setMoveLoading] = useState(false);

  // Tags state
  const [showTags, setShowTags] = useState(false);
  const [taggingFile, setTaggingFile] = useState(null);
  const [tagsLoading, setTagsLoading] = useState(false);
  const [allTags, setAllTags] = useState([]);
  const [tagFilter, setTagFilter] = useSessionState('fm:tag', '');

  // Confirm modal state
  const [pendingConfirm, setPendingConfirm] = useState(null);

  // View chips: My Files / Starred / Recent
  const [view, setView] = useSessionState('fm:view', 'files');

  // Upload queue (per-file progress)
  const [uploads, setUploads] = useState([]);

  // Multi-select bulk actions
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [bulkMoveIds, setBulkMoveIds] = useState([]);
  const [bulkShareIds, setBulkShareIds] = useState([]);

  // Right-click context menu
  const [contextMenu, setContextMenu] = useState(null);

  useEffect(() => {
    fetchFiles();
    fetchSharedWithMe();
    fetchAllTags();
  }, [currentFolder, search, tagFilter, page, view]);

  useEffect(() => {
    setPage(1);
  }, [currentFolder, search, tagFilter, view]);

  const fetchFiles = async () => {
    try {
      setLoading(true);
      setFilesError(false);
      const params = new URLSearchParams();
      if (view === 'files') {
        if (currentFolder) params.append('folderId', currentFolder);
      } else {
        // Starred / Recent are global cross-folder views.
        if (view === 'starred') params.append('starred', 'true');
        if (view === 'recent') params.append('recent', 'true');
      }
      if (search) params.append('search', search);
      if (tagFilter) params.append('tag', tagFilter);
      params.append('page', page);
      params.append('limit', LIMIT);

      const [filesRes, foldersRes] = await Promise.all([
        API.get(`/files?${params}`),
        API.get(`/files/folders?${params}`)
      ]);

      setFiles(filesRes.data.files || []);
      setTotalPages(filesRes.data.totalPages || 1);
      setTotalFiles(filesRes.data.total || 0);
      setFolders(foldersRes.data?.folders || []);
    } catch (error) {
      console.error('Fetch files error:', error);
      setFilesError(true);
      toast.error('Failed to load files. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchAllTags = async () => {
    try {
      const { data } = await API.get('/files/tags');
      setAllTags(data.tags || []);
    } catch (error) {
      console.error('Fetch tags error:', error);
      toast.error('Failed to load tags');
    }
  };

  const fetchSharedWithMe = async () => {
    try {
      const { data } = await API.get('/files/shared-with-me');
      setSharedFiles(data.files || []);
    } catch (error) {
      console.error('Fetch shared files error:', error);
      toast.error('Failed to load shared files');
    }
  };

  const fetchAllUsers = async () => {
    try {
      setUsersLoading(true);
      const { data } = await API.get('/users/directory');
      setAllUsers(data.users || []);
    } catch (error) {
      console.error('Fetch users error:', error);
      toast.error('Failed to load users');
    } finally {
      setUsersLoading(false);
    }
  };

  const addUpload = (name, size) => {
    const id = `up-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setUploads(prev => [...prev, { id, name, size, loaded: 0, progress: 0, status: 'uploading' }]);
    return id;
  };

  const updateUpload = (id, patch) =>
    setUploads(prev => prev.map(u => u.id === id ? { ...u, ...patch } : u));

  const dismissUpload = (id) =>
    setUploads(prev => prev.filter(u => u.id !== id));

  const onDrop = useCallback(async (acceptedFiles) => {
    if (acceptedFiles.length === 0) return;
    setUploading(true);
    const ids = acceptedFiles.map(f => addUpload(f.name, f.size));
    for (let i = 0; i < acceptedFiles.length; i++) {
      const file = acceptedFiles[i];
      const id = ids[i];
      try {
        const formData = new FormData();
        formData.append('file', file);
        if (currentFolder) formData.append('folderId', currentFolder);
        await API.post('/files/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (e) => {
            if (e.total > 0) {
              updateUpload(id, {
                progress: Math.round((e.loaded / e.total) * 100),
                loaded: e.loaded,
                status: 'uploading'
              });
            }
          }
        });
        updateUpload(id, { status: 'done', progress: 100, loaded: file.size });
      } catch (error) {
        updateUpload(id, { status: 'error', progress: 0 });
        const msg = error.response?.data?.message || `Failed to upload ${file.name}`;
        toast.error(msg);
      }
    }
    setUploading(false);
    fetchFiles();
    refreshUser();
    setTimeout(() => {
      setUploads(prev => prev.filter(u => u.status === 'uploading'));
    }, 4500);
  }, [currentFolder]);

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    noClick: true,
    noKeyboard: true
  });

  const handleDownload = async (file) => {
    try {
      const response = await API.get(`/files/${file._id}/download`, {
        responseType: 'blob'
      });
      if (response.data.downloadUrl) {
        window.open(response.data.downloadUrl, '_blank');
        toast.success('Download started');
        return;
      }
      // Local mode: create an object URL from the streamed blob and trigger a save
      const url = window.URL.createObjectURL(response.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.originalName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success('Download started');
    } catch {
      toast.error('Download failed');
    }
  };

  const handleDelete = async (file) => {
    setPendingConfirm({
      title: 'Move to trash?',
      message: `Move "${file.originalName}" to trash?`,
      confirmText: 'Move to trash',
      variant: 'danger',
      onConfirm: async () => {
        let outcome = 'moved to trash';
        try {
          await API.delete(`/files/${file._id}`);
        } catch (error) {
          outcome = error.response?.status === 404 ? 'is already in trash' : 'Failed to delete file';
        }
        fetchFiles();
        if (outcome === 'Failed to delete file') toast.error(outcome);
        else toast.success(`"${file.originalName}" ${outcome}`);
      }
    });
  };

  const handleViewVersions = (file) => {
    setSelectedFileVersions(file);
    setShowVersions(true);
  };

  const handleRestoreVersion = async (file, versionNumber) => {
    setPendingConfirm({
      title: 'Restore version?',
      message: `Restore version ${versionNumber} of "${file.originalName}"?\n\nThe current version will be saved as a new version, and the restored one becomes the active version (marked with a tick).`,
      confirmText: 'Restore',
      variant: 'primary',
      onConfirm: async () => {
        try {
          setRestoringVersion(true);
          const { data } = await API.put(`/files/${file._id}/version/${versionNumber}`);
          toast.success(`Version ${versionNumber} restored successfully`);
          // Keep the modal open and move the tick to the newly restored version.
          if (data.file) setSelectedFileVersions(data.file);
          fetchFiles();
          refreshUser();
        } catch {
          toast.error('Failed to restore version');
        } finally {
          setRestoringVersion(false);
        }
      }
    });
  };

  const handleDeleteVersion = async (file, versionNumber) => {
    setPendingConfirm({
      title: 'Delete this version?',
      message: `Delete version ${versionNumber} of "${file.originalName}"?\n\nThis permanently removes the saved snapshot and its stored copy. The current version is not affected.`,
      confirmText: 'Delete version',
      variant: 'danger',
      onConfirm: async () => {
        try {
          setDeletingVersion(true);
          const { data } = await API.delete(`/files/${file._id}/version/${versionNumber}`);
          toast.success(`Version ${versionNumber} deleted`);
          if (data.file) {
            setSelectedFileVersions(data.file);
          } else {
            setShowVersions(false);
            setSelectedFileVersions(null);
          }
          fetchFiles();
          refreshUser();
        } catch {
          toast.error('Failed to delete version');
        } finally {
          setDeletingVersion(false);
        }
      }
    });
  };

  const handlePreview = async (file) => {
    try {
      const token = localStorage.getItem('cloudsewa_token');
      const url = `${import.meta.env.VITE_API_URL}/files/${file._id}/preview?token=${encodeURIComponent(token || '')}`;
      setPreviewFile(file);
      setPreviewUrl(url);
      setShowPreview(true);
    } catch {
      toast.error('Failed to load preview');
    }
  };

  const closePreview = () => {
    setShowPreview(false);
    setPreviewFile(null);
    setPreviewUrl(null);
  };

  const handleOpenShare = async (file) => {
    setSharingFile(file);
    setSelectedUsers(file.sharedWith?.map(u => u._id || u) || []);
    setShowShare(true);
    await fetchAllUsers();
  };

  const handleShare = async () => {
    try {
      setSharingLoading(true);
      const ids = sharingFile?._id ? [sharingFile._id] : bulkShareIds;
      await Promise.all(ids.map(id => API.put(`/files/${id}/share`, {
        userIds: selectedUsers
      })));
      toast.success(ids.length === 1
        ? 'File sharing updated successfully'
        : `Sharing updated for ${ids.length} files`);
      setShowShare(false);
      setSharingFile(null);
      setBulkShareIds([]);
      setSelectedFiles([]);
      fetchFiles();
      fetchSharedWithMe();
    } catch {
      toast.error('Failed to update sharing');
    } finally {
      setSharingLoading(false);
    }
  };

  const handleBulkOpenShare = async () => {
    setBulkShareIds(selectedFiles.map(f => f._id));
    setSharingFile({
      _id: null,
      originalName: `${selectedFiles.length} file${selectedFiles.length !== 1 ? 's' : ''}`,
      owner: null
    });
    setSelectedUsers([]);
    setShowShare(true);
    await fetchAllUsers();
  };

  const toggleUserSelection = (userId) => {
    setSelectedUsers(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleRenameFile = (file) => {
    setRenamingItem(file);
    setRenamingType('file');
    setShowRename(true);
  };

  const handleRenameFolder = (folder) => {
    setRenamingItem(folder);
    setRenamingType('folder');
    setShowRename(true);
  };

  const handleRenameSubmit = async (newName) => {
    try {
      setRenameLoading(true);
      if (renamingType === 'file') {
        await API.put(`/files/${renamingItem._id}/rename`, { name: newName });
        toast.success('File renamed');
      } else {
        await API.put(`/files/folders/${renamingItem._id}`, { name: newName });
        toast.success('Folder renamed');
      }
      setShowRename(false);
      setRenamingItem(null);
      setRenamingType(null);
      fetchFiles();
    } catch (error) {
      const msg = error.response?.data?.message || 'Failed to rename';
      toast.error(msg);
    } finally {
      setRenameLoading(false);
    }
  };

  const handleOpenMove = (file) => {
    setMovingFile(file);
    setBulkMoveIds([]);
    setShowMove(true);
  };

  const handleBulkOpenMove = () => {
    setBulkMoveIds(selectedFiles.map(f => f._id));
    setMovingFile({
      _id: null,
      originalName: `${selectedFiles.length} file${selectedFiles.length !== 1 ? 's' : ''}`
    });
    setShowMove(true);
  };

  const handleMoveSubmit = async (destFolderId) => {
    try {
      setMoveLoading(true);
      const ids = movingFile?._id ? [movingFile._id] : bulkMoveIds;
      await Promise.all(ids.map(id => API.put(`/files/${id}/move`, {
        folderId: destFolderId
      })));
      toast.success(ids.length === 1 ? 'File moved' : `${ids.length} files moved`);
      setShowMove(false);
      setMovingFile(null);
      setBulkMoveIds([]);
      setSelectedFiles([]);
      fetchFiles();
    } catch (error) {
      const msg = error.response?.data?.message || 'Failed to move file';
      toast.error(msg);
    } finally {
      setMoveLoading(false);
    }
  };

  const handleDeleteFolder = async (folder) => {
    setPendingConfirm({
      title: 'Delete folder?',
      message: `Delete folder "${folder.name}" and all of its contents (files and sub-folders)?\n\nThe folder and its contents will be moved to trash.`,
      confirmText: 'Delete folder',
      variant: 'danger',
      onConfirm: async () => {
        let outcome = 'moved to trash';
        try {
          await API.delete(`/files/folders/${folder._id}`);
        } catch (error) {
          outcome = error.response?.status === 404 ? 'is already in trash' : 'Failed to delete folder';
        }
        fetchFiles();
        if (outcome === 'Failed to delete folder') toast.error(outcome);
        else toast.success(`"${folder.name}" ${outcome}`);
      }
    });
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      await API.post('/files/folders', {
        name: newFolderName,
        parent: currentFolder
      });
      toast.success('Folder created');
      setNewFolderName('');
      setShowNewFolder(false);
      fetchFiles();
    } catch {
      toast.error('Failed to create folder');
    }
  };

  const handleColorChange = async (folder, color) => {
    try {
      await API.put(`/files/folders/${folder._id}`, { color });
      toast.success('Folder color updated');
      fetchFiles();
    } catch {
      toast.error('Failed to update folder color');
    }
  };

  const handleToggleStarFile = async (file) => {
    try {
      const { data } = await API.put(`/files/${file._id}/star`, { starred: !file.starred });
      toast.success(data.starred ? 'Added to favorites' : 'Removed from favorites');
      fetchFiles();
    } catch {
      toast.error('Failed to update favorites');
    }
  };

  const handleToggleStarFolder = async (folder) => {
    try {
      const { data } = await API.put(`/files/folders/${folder._id}/star`, { starred: !folder.starred });
      toast.success(data.starred ? 'Added to favorites' : 'Removed from favorites');
      fetchFiles();
    } catch {
      toast.error('Failed to update favorites');
    }
  };

  const selectedIds = new Set(selectedFiles.map(f => f._id));

  const toggleSelect = (id) => {
    setSelectedFiles(prev =>
      prev.some(f => f._id === id)
        ? prev.filter(f => f._id !== id)
        : [...prev, { _id: id }]
    );
  };

  const handleSelectAll = (ids) => {
    if (ids.length === 0) {
      setSelectedFiles([]);
    } else {
      setSelectedFiles(files.filter(f => ids.includes(f._id)));
    }
  };

  const handleClearSelection = () => setSelectedFiles([]);

  const handleBulkDelete = () => {
    const n = selectedFiles.length;
    setPendingConfirm({
      title: 'Move to trash?',
      message: `Move ${n} file${n !== 1 ? 's' : ''} to trash?`,
      confirmText: 'Move to trash',
      variant: 'danger',
      onConfirm: async () => {
        const ids = selectedFiles.map(f => f._id);
        const results = await Promise.allSettled(ids.map(id => API.delete(`/files/${id}`)));
        const trashed = [];
        const failed = [];
        ids.forEach((id, i) => {
          if (results[i].status === 'fulfilled') trashed.push(id);
          else if (results[i].reason?.response?.status === 404) trashed.push(id);
          else failed.push(id);
        });
        setSelectedFiles([]);
        fetchFiles();
        if (failed.length === 0) {
          toast.success(`${trashed.length} file${trashed.length !== 1 ? 's' : ''} moved to trash`);
        } else if (trashed.length > 0) {
          toast.error(`${trashed.length} moved to trash, ${failed.length} failed`);
        } else {
          toast.error('Failed to move files to trash');
        }
      }
    });
  };

  const openContextMenu = (e, kind, item) => {
    e.preventDefault();
    const fileItems = [
      ...(canPreview(item.mimetype)
        ? [{ label: 'Preview', icon: <Eye size={15} />, onClick: () => handlePreview(item) }]
        : []),
      { label: 'Download', icon: <Download size={15} />, onClick: () => handleDownload(item) },
      { label: 'Share', icon: <Share2 size={15} />, onClick: () => handleOpenShare(item) },
      ...(item.versions?.length > 0
        ? [{ label: 'Version history', icon: <History size={15} />, onClick: () => handleViewVersions(item) }]
        : []),
      { separator: true },
      { label: 'Rename', icon: <Pencil size={15} />, onClick: () => handleRenameFile(item) },
      { label: 'Move to folder', icon: <FolderInput size={15} />, onClick: () => handleOpenMove(item) },
      { label: 'Manage tags', icon: <Tag size={15} />, onClick: () => handleManageTags(item) },
      {
        label: item.starred ? 'Remove from favorites' : 'Add to favorites',
        icon: <Star size={15} />,
        onClick: () => handleToggleStarFile(item)
      },
      { separator: true },
      { label: 'Move to trash', icon: <Trash2 size={15} />, danger: true, onClick: () => handleDelete(item) }
    ];
    const folderItems = [
      { label: 'Open', icon: <FolderOpen size={15} />, onClick: () => openFolder(item) },
      { separator: true },
      { label: 'Rename', icon: <Pencil size={15} />, onClick: () => handleRenameFolder(item) },
      {
        label: item.starred ? 'Remove from favorites' : 'Add to favorites',
        icon: <Star size={15} />,
        onClick: () => handleToggleStarFolder(item)
      },
      { separator: true },
      { label: 'Move to trash', icon: <Trash2 size={15} />, danger: true, onClick: () => handleDeleteFolder(item) }
    ];
    setContextMenu({ x: e.clientX, y: e.clientY, items: kind === 'file' ? fileItems : folderItems });
  };

  const handleManageTags = (file) => {
    setTaggingFile(file);
    setShowTags(true);
  };

  const handleSaveTags = async (tags) => {
    try {
      setTagsLoading(true);
      await API.put(`/files/${taggingFile._id}/tags`, { tags });
      toast.success('Tags updated');
      setShowTags(false);
      setTaggingFile(null);
      fetchFiles();
      fetchAllTags();
    } catch {
      toast.error('Failed to update tags');
    } finally {
      setTagsLoading(false);
    }
  };

  const openFolder = (folder) => {
    setSelectedFiles([]);
    setBreadcrumb([...breadcrumb, {
      id: folder._id,
      name: folder.name
    }]);
    setCurrentFolder(folder._id);
  };

  return (
    <div
      className="page-container"
      {...getRootProps()}
      style={{ position: 'relative', minHeight: 'calc(100vh - 64px)' }}
    >
      <FileUpload
        isDragActive={isDragActive}
        getInputProps={getInputProps}
      />

      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">File Manager</h1>
          <p className="page-subtitle">
            {view === 'starred'
              ? 'Your favorite files and folders'
              : view === 'recent'
                ? 'Recently modified files and folders'
                : search
                  ? `Search results for "${search}"`
                  : 'Manage your business files'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button
            className="btn btn-ghost"
            onClick={() => setShowNewFolder(true)}
          >
            <FolderPlus size={16} />
            New Folder
          </button>
          <button
            className="btn btn-primary"
            onClick={open}
            disabled={uploading}
          >
            <Upload size={16} />
            {uploading ? 'Uploading...' : 'Upload Files'}
          </button>
        </div>
      </div>

      <Breadcrumb
        search={search}
        setSearch={setSearch}
        currentFolder={currentFolder}
        setCurrentFolder={setCurrentFolder}
        breadcrumb={breadcrumb}
        setBreadcrumb={setBreadcrumb}
      />

      {/* View chips: My Files / Starred / Recent */}
      <div style={{
        display: 'flex',
        gap: '8px',
        flexWrap: 'wrap',
        marginBottom: '16px'
      }}>
        {[
          { id: 'files', label: 'My Files', icon: <Files size={15} /> },
          { id: 'starred', label: 'Starred', icon: <Star size={15} /> },
          { id: 'recent', label: 'Recent', icon: <Clock size={15} /> }
        ].map((v) => (
          <button
            key={v.id}
            className="btn btn-ghost btn-sm"
            onClick={() => setView(v.id)}
            style={view === v.id ? {
              backgroundColor: 'var(--primary)',
              color: 'var(--white)',
              borderColor: 'var(--primary)'
            } : undefined}
          >
            {v.icon}
            {v.label}
          </button>
        ))}
      </div>

      {/* Bulk actions bar */}
      {selectedFiles.length > 0 && (
        <div className="card" style={{
          position: 'sticky',
          top: '72px',
          zIndex: 40,
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
          <span style={{ fontWeight: '700', fontSize: '0.85rem', color: 'var(--primary)' }}>
            {selectedFiles.length} selected
          </span>
          <button className="btn btn-ghost btn-sm" onClick={handleClearSelection}>
            <X size={14} />
            Clear
          </button>
          <div style={{ flex: 1 }} />
          <button className="btn btn-primary btn-sm" onClick={handleBulkOpenMove}>
            <FolderInput size={14} />
            Move
          </button>
          <button className="btn btn-primary btn-sm" onClick={handleBulkOpenShare}>
            <Share2 size={14} />
            Share
          </button>
          <button className="btn btn-danger btn-sm" onClick={handleBulkDelete}>
            <Trash2 size={14} />
            Move to trash
          </button>
        </div>
      )}

      {/* New folder input */}
      {showNewFolder && (
        <div className="card" style={{ marginBottom: '16px', padding: '16px' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            <FolderPlus size={20} color="var(--primary)" />
            <input
              className="form-input"
              placeholder="Folder name"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
              autoFocus
              style={{ flex: 1 }}
            />
            <button className="btn btn-primary btn-sm" onClick={handleCreateFolder}>
              Create
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setShowNewFolder(false);
                setNewFolderName('');
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {!isAdmin && (
        <SharedWithMe
          sharedFiles={sharedFiles}
          onPreview={handlePreview}
          onDownload={handleDownload}
        />
      )}

      <FolderTree
        folders={folders}
        onOpenFolder={openFolder}
        onRenameFolder={handleRenameFolder}
        onDeleteFolder={handleDeleteFolder}
        onColorChange={handleColorChange}
        onToggleStar={handleToggleStarFolder}
        onContextMenu={openContextMenu}
      />

      <FileList
        files={files}
        totalFiles={totalFiles}
        totalPages={totalPages}
        page={page}
        setPage={setPage}
        loading={loading}
        search={search}
        setSearch={setSearch}
        limit={LIMIT}
        onPreview={handlePreview}
        onDownload={handleDownload}
        onDelete={handleDelete}
        onShare={handleOpenShare}
        onViewVersions={handleViewVersions}
        onRename={handleRenameFile}
        onMove={handleOpenMove}
        onUpload={open}
        onManageTags={handleManageTags}
        loadError={filesError}
        onRetry={() => { setFilesError(false); fetchFiles(); }}
        selectedIds={selectedIds}
        onToggleSelect={toggleSelect}
        onToggleSelectAll={handleSelectAll}
        onToggleStar={handleToggleStarFile}
        onContextMenu={openContextMenu}
      />

      {/* Tag filter */}
      {allTags.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          flexWrap: 'wrap', marginBottom: '16px'
        }}>
          <span style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--gray-500)' }}>
            Filter by tag:
          </span>
          {['', ...allTags].map((t) => (
            <button
              key={t || 'all'}
              className="btn btn-ghost btn-sm"
              onClick={() => setTagFilter(tagFilter === t ? '' : t)}
              style={tagFilter === t ? {
                backgroundColor: 'var(--primary)',
                color: 'var(--white)',
                borderColor: 'var(--primary)'
              } : undefined}
            >
              {t || 'All'}
            </button>
          ))}
        </div>
      )}

      {showShare && (
        <ShareModal
          file={sharingFile}
          allUsers={allUsers}
          usersLoading={usersLoading}
          selectedUsers={selectedUsers}
          onToggleUser={toggleUserSelection}
          onSave={handleShare}
          onClose={() => setShowShare(false)}
          loading={sharingLoading}
        />
      )}

      {showPreview && (
        <FilePreviewModal
          file={previewFile}
          previewUrl={previewUrl}
          onClose={closePreview}
          onDownload={handleDownload}
        />
      )}

      {showVersions && (
        <VersionHistoryModal
          file={selectedFileVersions}
          onRestore={handleRestoreVersion}
          onDelete={handleDeleteVersion}
          restoring={restoringVersion}
          deleting={deletingVersion}
          onClose={() => setShowVersions(false)}
        />
      )}

      {showRename && (
        <RenameModal
          currentName={renamingItem?.originalName || renamingItem?.name || ''}
          onRename={handleRenameSubmit}
          onClose={() => {
            setShowRename(false);
            setRenamingItem(null);
            setRenamingType(null);
          }}
          loading={renameLoading}
        />
      )}

      {showMove && (
        <MoveModal
          file={movingFile}
          currentFolderId={currentFolder}
          onMove={handleMoveSubmit}
          onClose={() => {
            setShowMove(false);
            setMovingFile(null);
          }}
          loading={moveLoading}
        />
      )}

      {showTags && (
        <TagsModal
          file={taggingFile}
          allTags={allTags}
          onSave={handleSaveTags}
          onClose={() => {
            setShowTags(false);
            setTaggingFile(null);
          }}
          loading={tagsLoading}
        />
      )}

      <UploadQueue uploads={uploads} onDismiss={dismissUpload} />

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenu.items}
          onClose={() => setContextMenu(null)}
        />
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

export default FileManager;
