const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
const fs = require('fs');
const cors = require('cors');
const helmet = require('helmet');
const connectDB = require('./config/db');
const { rateLimiter } = require('./middleware/rateLimiter');
const backupScheduler = require('./scheduler/backupScheduler');

// Fail fast on a misconfigured environment instead of failing confusingly later
// (e.g. mongo connect hang, silently-unsecured JWT). STORAGE_MODE=s3 additionally
// requires the AWS credentials/bucket used by multer-s3 and storageService.
const REQUIRED_ENV = ['MONGO_URI', 'JWT_SECRET', 'CLIENT_URL'];
const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
if (process.env.STORAGE_MODE === 's3') {
  if (!process.env.AWS_BUCKET_NAME) missing.push('AWS_BUCKET_NAME');
  if (!process.env.AWS_ACCESS_KEY_ID) missing.push('AWS_ACCESS_KEY_ID');
  if (!process.env.AWS_SECRET_ACCESS_KEY) missing.push('AWS_SECRET_ACCESS_KEY');
  if (!process.env.AWS_REGION) missing.push('AWS_REGION');
}
if (missing.length) {
  console.error(`FATAL: missing required environment variable(s): ${missing.join(', ')}`);
  console.error('Check backend/.env and restart.');
  process.exit(1);
}

// Storage directories: neither multer (uploads) nor the backup engine (backups)
// create these on their own, and a fresh deploy lacks them. Create both up front
// so local-mode uploads and the always-local backup zip path never fail with ENOENT.
['uploads', 'backups'].forEach((dir) => fs.mkdirSync(dir, { recursive: true }));


// Connect to MongoDB
connectDB();

const app = express();

// Security middleware
const isDev = process.env.NODE_ENV !== 'production';
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'blob:', ...(isDev ? ['http://localhost:5000'] : [])],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", 'https:', "'unsafe-inline'"],
      fontSrc: ["'self'", 'https:', 'data:'],
      frameAncestors: ["'self'"],
      formAction: ["'self'"],
      objectSrc: ["'none'"],
      frameSrc: ["'self'", ...(isDev ? ['http://localhost:5000', 'http://localhost:5173'] : [])],
      frameAncestors: ["'self'", ...(isDev ? ['http://localhost:5173'] : [])]
    }
  }
}));

// CORS
app.use(cors({
  origin: process.env.CLIENT_URL,
  credentials: true
}));

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Prevent NoSQL injection: strip MongoDB query operators ($...)
// from req.body, req.query and req.params before they reach any route.
const sanitizeObject = (obj) => {
  for (const key of Object.keys(obj)) {
    if (key.startsWith('$')) {
      delete obj[key];
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      sanitizeObject(obj[key]);
    }
  }
  return obj;
};

app.use((req, res, next) => {
  if (req.body && typeof req.body === 'object') sanitizeObject(req.body);
  if (req.query && typeof req.query === 'object') sanitizeObject(req.query);
  if (req.params && typeof req.params === 'object') sanitizeObject(req.params);
  next();
});

// Trust the nginx reverse proxy so req.ip and rate-limit keys see the real
// client instead of 127.0.0.1 (express-rate-limit keys on req.ip).
app.set('trust proxy', 1);

// Rate limiter
app.use('/api', rateLimiter);

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/files', require('./routes/fileRoutes'));
app.use('/api/backups', require('./routes/backupRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/dashboard', require('./routes/dashboardRoutes'));
app.use('/api/reset-requests', require('./routes/resetRequestRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));

// Health check route
app.get('/', (req, res) => {
  res.json({ message: 'CloudSewa API is running' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  // Do not leak internal error details to clients in production
  const isProd = process.env.NODE_ENV === 'production';
  res.status(err.statusCode || 500).json({
    success: false,
    message: isProd ? 'Internal Server Error' : (err.message || 'Internal Server Error')
  });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`CloudSewa server running on port ${PORT} in ${process.env.NODE_ENV} mode`);
});

// Start backup scheduler
backupScheduler();

module.exports = app;
