import { useState } from 'react';
import {
  Download, Trash2, Eye, Share2, History, Pencil, FolderInput, Tag,
  FolderPlus, Upload, Search, X, ArrowUp, ArrowDown, ArrowUpDown,
  AlertTriangle, RefreshCw, Star
} from 'lucide-react';
import { formatBytes, formatDate } from '../../utils/formatters';
import { getFileIcon, canPreview, getFileTypeLabel } from '../../utils/fileHelpers.jsx';

const LoadingState = () => (
  <div className="loading-spinner">
    <div className="spinner" />
  </div>
);

const ErrorState = ({ onClearSearch, onRetry, search }) => (
  <div style={{
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px 20px',
    textAlign: 'center'
  }}>
    <AlertTriangle size={48} color="var(--danger)" style={{ marginBottom: '16px' }} />
    <h3 style={{ fontSize: '1.1rem', fontWeight: '600', color: 'var(--gray-700)', marginBottom: '8px' }}>
      Couldn't load your files
    </h3>
    <p style={{ fontSize: '0.875rem', color: 'var(--gray-500)', marginBottom: '20px' }}>
      Something went wrong while connecting to the server.
    </p>
    <div style={{ display: 'flex', gap: '10px' }}>
      <button className="btn btn-danger" onClick={onRetry}>
        <RefreshCw size={16} />
        Retry
      </button>
      {search && (
        <button
          onClick={onClearSearch}
          className="btn btn-ghost"
        >
          <X size={14} />
          Clear Search
        </button>
      )}
    </div>
  </div>
);

const EmptyState = ({ search, onClearSearch, onUpload }) => (
  <div style={{
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px 20px',
    textAlign: 'center'
  }}>
    {search ? (
      <>
        <Search size={48} color="var(--gray-300)" style={{ marginBottom: '16px' }} />
        <h3 style={{ fontSize: '1.1rem', fontWeight: '600', color: 'var(--gray-700)', marginBottom: '8px' }}>
          No files found
        </h3>
        <p style={{ fontSize: '0.875rem', color: 'var(--gray-500)', marginBottom: '20px' }}>
          No files match "<strong>{search}</strong>"
        </p>
        <button
          onClick={onClearSearch}
          style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            padding: '10px 20px',
            borderRadius: 'var(--radius)',
            border: '1.5px solid var(--gray-300)',
            backgroundColor: 'var(--white)',
            cursor: 'pointer',
            fontSize: '0.875rem',
            fontWeight: '500',
            color: 'var(--gray-700)'
          }}
        >
          <X size={14} />
          Clear Search
        </button>
      </>
    ) : (
      <>
        <FolderPlus size={48} color="var(--gray-300)" style={{ marginBottom: '16px' }} />
        <h3 style={{ fontSize: '1.1rem', fontWeight: '600', color: 'var(--gray-700)', marginBottom: '8px' }}>
          No files yet
        </h3>
        <p style={{ fontSize: '0.875rem', color: 'var(--gray-500)', marginBottom: '20px' }}>
          Upload files or drag and drop them here
        </p>
        <button className="btn btn-primary" onClick={onUpload}>
          <Upload size={16} />
          Upload Your First File
        </button>
      </>
    )}
  </div>
);

const Pagination = ({ page, setPage, totalPages, totalFiles, limit }) => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '12px',
    marginTop: '16px',
    padding: '12px 16px',
    backgroundColor: 'var(--white)',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--gray-200)'
  }}>
    <p style={{ fontSize: '0.875rem', color: 'var(--gray-500)' }}>
      Showing {((page - 1) * limit) + 1}–{Math.min(page * limit, totalFiles)} of {totalFiles} files
    </p>
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
      <button
        className="btn btn-ghost btn-sm"
        onClick={() => setPage(1)}
        disabled={page === 1}
      >«</button>
      <button
        className="btn btn-ghost btn-sm"
        onClick={() => setPage(p => Math.max(1, p - 1))}
        disabled={page === 1}
      >‹ Prev</button>
      {Array.from({ length: totalPages }, (_, i) => i + 1)
        .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
        .reduce((acc, p, idx, arr) => {
          if (idx > 0 && p - arr[idx - 1] > 1) acc.push('...');
          acc.push(p);
          return acc;
        }, [])
        .map((p, idx) => (
          p === '...' ? (
            <span key={`e${idx}`} style={{
              padding: '6px 8px',
              fontSize: '0.875rem',
              color: 'var(--gray-400)'
            }}>...</span>
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
        ))}
      <button
        className="btn btn-ghost btn-sm"
        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
        disabled={page === totalPages}
      >Next ›</button>
      <button
        className="btn btn-ghost btn-sm"
        onClick={() => setPage(totalPages)}
        disabled={page === totalPages}
      >»</button>
    </div>
  </div>
);

const SortHeader = ({ label, column, sortKey, sortDir, onSort }) => (
  <th
    onClick={() => onSort(column)}
    style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
    aria-sort={sortKey === column ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
  >
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
      {label}
      {sortKey === column
        ? (sortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)
        : <ArrowUpDown size={12} style={{ opacity: 0.4 }} />}
    </span>
  </th>
);

const FileList = ({
  files, totalFiles, totalPages, page, setPage,
  loading, search, setSearch, limit,
  onPreview, onDownload, onDelete, onShare, onViewVersions, onRename, onMove, onUpload, onManageTags,
  loadError, onRetry,
  selectedIds, onToggleSelect, onToggleSelectAll, onToggleStar, onContextMenu
}) => {
  const [sortKey, setSortKey] = useState('updatedAt');
  const [sortDir, setSortDir] = useState('desc');

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const sortedFiles = [...files].sort((a, b) => {
    let valA, valB;
    if (sortKey === 'name') {
      valA = a.originalName?.toLowerCase() || '';
      valB = b.originalName?.toLowerCase() || '';
      return sortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
    }
    if (sortKey === 'size') { valA = a.size || 0; valB = b.size || 0; }
    else if (sortKey === 'type') {
      valA = (a.mimetype || '').toLowerCase();
      valB = (b.mimetype || '').toLowerCase();
      return sortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
    }
    else if (sortKey === 'version') { valA = a.currentVersion || 0; valB = b.currentVersion || 0; }
    else {
      valA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      valB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
    }
    if (valA < valB) return sortDir === 'asc' ? -1 : 1;
    if (valA > valB) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  if (loading) {
    return <LoadingState />;
  }

  if (loadError && files.length === 0) {
    return (
      <ErrorState
        search={search}
        onClearSearch={() => setSearch('')}
        onRetry={onRetry}
      />
    );
  }

  if (files.length === 0) {
    return <EmptyState search={search} onClearSearch={() => setSearch('')} onUpload={onUpload} />;
  }

  return (
    <>
      <h3 style={{
        fontSize: '0.8rem',
        fontWeight: '600',
        color: 'var(--gray-500)',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        marginBottom: '12px'
      }}>
        Files ({totalFiles}{totalFiles !== files.length
          ? ` — showing ${((page - 1) * limit) + 1}–${Math.min(page * limit, totalFiles)}`
          : ''})
      </h3>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-container file-list-table">
          <table>
            <thead>
              <tr>
                <th style={{ width: '36px', textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    aria-label="Select all files on this page"
                    checked={files.length > 0 && files.every(f => selectedIds.has(f._id))}
                    onChange={() => {
                      const all = files.every(f => selectedIds.has(f._id));
                      onToggleSelectAll(all ? [] : files.map(f => f._id));
                    }}
                    style={{ cursor: 'pointer' }}
                  />
                </th>
                <SortHeader label="Name" column="name" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortHeader label="Size" column="size" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortHeader label="Type" column="type" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortHeader label="Modified" column="updatedAt" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortHeader label="Version" column="version" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <th>Tags</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sortedFiles.map((file) => (
                <tr
                  key={file._id}
                  onContextMenu={(e) => onContextMenu?.(e, 'file', file)}
                  style={{
                    backgroundColor: selectedIds.has(file._id) ? 'var(--accent)' : undefined
                  }}
                >
                  <td data-label="Select" style={{ textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      aria-label={`Select ${file.originalName}`}
                      checked={selectedIds.has(file._id)}
                      onChange={() => onToggleSelect(file._id)}
                      onClick={(e) => e.stopPropagation()}
                      style={{ cursor: 'pointer' }}
                    />
                  </td>
                  <td data-label="Name">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      {getFileIcon(file.mimetype)}
                      <span style={{
                        fontWeight: '500',
                        color: 'var(--gray-800)',
                        maxWidth: '250px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {file.originalName}
                      </span>
                      {file.sharedWith?.length > 0 && (
                        <span
                          className="badge badge-primary"
                          style={{ fontSize: '0.65rem' }}
                          title={`Shared with ${file.sharedWith.length} user(s)`}
                        >
                          <Share2 size={10} style={{ marginRight: '3px' }} />
                          {file.sharedWith.length}
                        </span>
                      )}
                    </div>
                  </td>
                  <td data-label="Size" style={{ color: 'var(--gray-500)', fontSize: '0.875rem' }}>
                    {formatBytes(file.size)}
                  </td>
                  <td data-label="Type">
                    <span className="badge badge-gray">
                      {getFileTypeLabel(file.mimetype)}
                    </span>
                  </td>
                  <td data-label="Modified" style={{ color: 'var(--gray-500)', fontSize: '0.875rem' }}>
                    {formatDate(file.updatedAt)}
                  </td>
                  <td data-label="Version">
                    <span className="badge badge-primary">v{file.currentVersion}</span>
                  </td>
                  <td data-label="Tags">
                    {file.tags?.length > 0 ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxWidth: '160px' }}>
                        {file.tags.slice(0, 3).map((t) => (
                          <span key={t} className="badge badge-gray" style={{ fontSize: '0.65rem' }}>
                            {t}
                          </span>
                        ))}
                        {file.tags.length > 3 && (
                          <span className="badge badge-gray" style={{ fontSize: '0.65rem' }}>
                            +{file.tags.length - 3}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span style={{ fontSize: '0.75rem', color: 'var(--gray-300)' }}>—</span>
                    )}
                  </td>
                  <td data-label="Actions">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end' }}>
                      {canPreview(file.mimetype) && (
                        <button
                          className="btn-icon"
                          onClick={() => onPreview(file)}
                          title="Preview file"
                          style={{ color: 'var(--primary-light)' }}
                        >
                          <Eye size={16} />
                        </button>
                      )}
                      <button
                        className="btn-icon"
                        onClick={() => onDownload(file)}
                        title="Download"
                      >
                        <Download size={16} />
                      </button>
                      <button
                        className="btn-icon"
                        onClick={() => onShare(file)}
                        title="Share file"
                        style={{ color: 'var(--primary-light)' }}
                      >
                        <Share2 size={16} />
                      </button>
                      {file.versions && file.versions.length > 0 && (
                        <button
                          className="btn-icon"
                          onClick={() => onViewVersions(file)}
                          title="View version history"
                          style={{ color: 'var(--primary-light)' }}
                        >
                          <History size={16} />
                        </button>
                      )}
                      <button
                        className="btn-icon"
                        onClick={() => onRename(file)}
                        title="Rename file"
                        aria-label={`Rename ${file.originalName}`}
                        style={{ color: 'var(--primary-light)' }}
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        className="btn-icon"
                        onClick={() => onMove(file)}
                        title="Move to folder"
                        aria-label={`Move ${file.originalName}`}
                        style={{ color: 'var(--primary-light)' }}
                      >
                        <FolderInput size={16} />
                      </button>
                      <button
                        className="btn-icon"
                        onClick={() => onToggleStar(file)}
                        title={file.starred ? "Remove from favorites" : "Add to favorites"}
                        aria-label={`${file.starred ? 'Unstar' : 'Star'} ${file.originalName}`}
                        style={{ color: file.starred ? '#F59E0B' : 'var(--gray-400)' }}
                      >
                        <Star size={16} fill={file.starred ? '#F59E0B' : 'none'} />
                      </button>
                      <button
                        className="btn-icon"
                        onClick={() => onManageTags(file)}
                        title="Manage tags"
                        aria-label={`Manage tags for ${file.originalName}`}
                        style={{ color: 'var(--primary-light)' }}
                      >
                        <Tag size={16} />
                      </button>
                      <button
                        className="btn-icon"
                        onClick={() => onDelete(file)}
                        title="Move to trash"
                        style={{ color: 'var(--danger)' }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <Pagination
          page={page}
          setPage={setPage}
          totalPages={totalPages}
          totalFiles={totalFiles}
          limit={limit}
        />
      )}
    </>
  );
};

export default FileList;
