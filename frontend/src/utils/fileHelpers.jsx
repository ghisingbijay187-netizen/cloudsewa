import { File, FileText, FileImage, FileVideo, FileAudio } from 'lucide-react';

export const getFileIcon = (mimetype) => {
  if (!mimetype) return <File size={32} color="var(--gray-400)" />;
  if (mimetype.startsWith('image/')) return <FileImage size={32} color="var(--file-image)" />;
  if (mimetype.startsWith('video/')) return <FileVideo size={32} color="var(--file-video)" />;
  if (mimetype.startsWith('audio/')) return <FileAudio size={32} color="var(--file-audio)" />;
  if (mimetype.includes('pdf')) return <FileText size={32} color="var(--file-pdf)" />;
  if (mimetype.includes('word') || mimetype.includes('document')) return <FileText size={32} color="var(--file-doc)" />;
  if (mimetype.includes('sheet') || mimetype.includes('excel')) return <FileText size={32} color="var(--file-sheet)" />;
  return <File size={32} color="var(--gray-400)" />;
};

export const canPreview = (mimetype) => {
  if (!mimetype) return false;
  return (
    mimetype.startsWith('image/') ||
    mimetype === 'application/pdf' ||
    mimetype.startsWith('text/')
  );
};

export const getFileTypeLabel = (mimetype) => {
  if (!mimetype) return 'FILE';
  const sub = mimetype.split('/')[1]?.toUpperCase() || 'FILE';
  const map = {
    'VND.OPENXMLFORMATS-OFFICEDOCUMENT.WORDPROCESSINGML.DOCUMENT': 'DOCX',
    'VND.OPENXMLFORMATS-OFFICEDOCUMENT.SPREADSHEETML.SHEET': 'XLSX',
    'VND.OPENXMLFORMATS-OFFICEDOCUMENT.PRESENTATIONML.PRESENTATION': 'PPTX',
    'VND.MS-EXCEL': 'XLS',
    'VND.MS-POWERPOINT': 'PPT',
    'MSWORD': 'DOC',
    'JPEG': 'JPG',
    'OCTET-STREAM': 'FILE',
    'PLAIN': 'TXT',
    'WEBP': 'WEBP'
  };
  return map[sub] || sub.slice(0, 6);
};
