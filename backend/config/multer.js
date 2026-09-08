const multer = require('multer');
const multerS3 = require('multer-s3');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const s3Client = require('./s3');

// File filter — allowlist of safe file types
// Only extensions in this list may be uploaded. Dangerous types
// (.html, .svg, .php, .exe, macro docs, scripts, etc.) are rejected.
const allowedExtensions = new Set([
  // Documents
  '.pdf', '.txt', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.csv', '.md', '.rtf', '.odt', '.ods', '.odp',
  // Images
  '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tiff', '.ico', '.heic',
  // Audio
  '.mp3', '.wav', '.ogg', '.flac', '.aac', '.m4a', '.wma',
  // Video
  '.mp4', '.mov', '.avi', '.mkv', '.webm', '.flv', '.wmv', '.m4v',
  // Archives
  '.zip', '.rar', '.7z', '.tar', '.gz'
]);

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();

  // Stash the in-flight file's info so the middleware can audit rejections
  // (oversize files abort mid-stream; the filter runs before the size check).
  req.rejectedUpload = {
    originalname: file.originalname,
    mimetype: file.mimetype,
    extension: ext || '(none)'
  };

  if (!allowedExtensions.has(ext)) {
    return cb(new Error(`File type ${ext || '(none)'} is not allowed for security reasons`), false);
  }
  cb(null, true);
};

// Local storage (development)
const localStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

// S3 storage (production) — constructed LAZILY so a local-mode deployment with
// no AWS vars can boot. multerS3 throws "bucket is required" at construction
// time when AWS_BUCKET_NAME is unset, so it must not run on module load.
const createS3Storage = () => {
  const s3Client = require('./s3');
  return multerS3({
    s3: s3Client,
    bucket: process.env.AWS_BUCKET_NAME,
    metadata: (req, file, cb) => {
      cb(null, { fieldName: file.fieldname });
    },
    key: (req, file, cb) => {
      const uniqueName = `uploads/${req.user.id}/${uuidv4()}${path.extname(file.originalname)}`;
      cb(null, uniqueName);
    }
  });
};

// Choose storage based on environment
// (server.js fail-fasts on missing AWS vars when STORAGE_MODE=s3, so by the
// time this runs in s3 mode AWS_BUCKET_NAME is guaranteed to be set).
const storage = process.env.STORAGE_MODE === 's3' ? createS3Storage() : localStorage;

// Export upload middleware
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB max
  }
});

module.exports = upload;