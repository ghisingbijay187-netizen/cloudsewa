import { Upload } from 'lucide-react';

const DragOverlay = () => (
  <div style={{
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(31, 56, 100, 0.15)',
    border: '3px dashed var(--primary-light)',
    borderRadius: 'var(--radius-xl)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 500,
    backdropFilter: 'blur(2px)'
  }}>
    <div style={{ textAlign: 'center', color: 'var(--primary)' }}>
      <Upload size={64} style={{ marginBottom: '16px', opacity: 0.7 }} />
      <h2>Drop files to upload</h2>
    </div>
  </div>
);

const UploadHint = () => (
  <div style={{
    padding: '12px 16px',
    backgroundColor: 'var(--accent)',
    borderRadius: 'var(--radius)',
    marginBottom: '20px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    fontSize: '0.8rem',
    color: 'var(--primary)'
  }}>
    <Upload size={14} />
    Drag and drop files anywhere on this page to upload, or click "Upload Files"
  </div>
);

const FileUpload = ({ isDragActive, getInputProps }) => (
  <>
    <input {...getInputProps()} />
    {isDragActive && <DragOverlay />}
    <UploadHint />
  </>
);

export default FileUpload;
