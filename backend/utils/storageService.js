const fs = require('fs');
const path = require('path');
const { DeleteObjectCommand, GetObjectCommand, CopyObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const s3Client = require('../config/s3');

// Read the full byte contents of a stored file (local or S3)
const readFileBuffer = async (storagePath, storageMode) => {
  if (storageMode === 's3') {
    const command = new GetObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: storagePath
    });
    const data = await s3Client.send(command);
    const chunks = [];
    for await (const chunk of data.Body) chunks.push(chunk);
    return Buffer.concat(chunks);
  } else {
    const fullPath = path.join(__dirname, '..', storagePath);
    if (!fs.existsSync(fullPath)) return null;
    return fs.readFileSync(fullPath);
  }
};

// Write the full byte contents of a stored file (local or S3)
const writeFileBuffer = async (storagePath, storageMode, buffer) => {
  if (storageMode === 's3') {
    const command = new PutObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: storagePath,
      Body: buffer
    });
    await s3Client.send(command);
  } else {
    const fullPath = path.join(__dirname, '..', storagePath);
    fs.writeFileSync(fullPath, buffer);
  }
};

// Delete a file from storage (local or S3)
const deleteFile = async (storagePath, storageMode) => {
  if (storageMode === 's3') {
    const command = new DeleteObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: storagePath
    });
    await s3Client.send(command);
  } else {
    // Local storage
    const fullPath = path.join(__dirname, '..', storagePath);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  }
};

// Get a signed URL for S3 file download
const getSignedDownloadUrl = async (storagePath) => {
  const command = new GetObjectCommand({
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: storagePath
  });
  const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 }); // 1 hour
  return url;
};

// Get file download URL based on storage mode
const getFileUrl = async (storagePath, storageMode) => {
  if (storageMode === 's3') {
    return await getSignedDownloadUrl(storagePath);
  } else {
    // Local storage — return relative URL
    return `/${storagePath}`;
  }
};

// Upload a local file to S3; used to mirror backup archives.
const uploadLocalFileToS3 = async (localFullPath, key) => {
  const data = await fs.promises.readFile(localFullPath);
  const command = new PutObjectCommand({
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: key,
    Body: data
  });
  await s3Client.send(command);
  return key;
};

// Download an S3 object to a local file path. Ensures the parent directory
// exists. Returns the local path.
const downloadS3ToLocalFile = async (key, localFullPath) => {
  const command = new GetObjectCommand({
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: key
  });
  const data = await s3Client.send(command);
  const dir = path.dirname(localFullPath);
  if (dir) await fs.promises.mkdir(dir, { recursive: true });
  await fs.promises.writeFile(localFullPath, Buffer.concat(
    await (async () => { const chunks = []; for await (const c of data.Body) chunks.push(c); return chunks; })()
  ));
  return localFullPath;
};

// Copy file in S3 (used for versioning)
const copyS3File = async (sourceKey, destinationKey) => {
  const command = new CopyObjectCommand({
    Bucket: process.env.AWS_BUCKET_NAME,
    CopySource: `${process.env.AWS_BUCKET_NAME}/${sourceKey}`,
    Key: destinationKey
  });
  await s3Client.send(command);
};

// Copy file locally (used for versioning)
const copyLocalFile = (sourcePath, destinationPath) => {
  const fullSource = path.join(__dirname, '..', sourcePath);
  const fullDest = path.join(__dirname, '..', destinationPath);

  // Create directory if it does not exist
  const destDir = path.dirname(fullDest);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  fs.copyFileSync(fullSource, fullDest);
};

// Get file size from local storage
const getLocalFileSize = (storagePath) => {
  const fullPath = path.join(__dirname, '..', storagePath);
  if (fs.existsSync(fullPath)) {
    const stats = fs.statSync(fullPath);
    return stats.size;
  }
  return 0;
};

// Format bytes to human readable
const formatBytes = (bytes, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

module.exports = {
  deleteFile,
  getSignedDownloadUrl,
  getFileUrl,
  copyS3File,
  copyLocalFile,
  getLocalFileSize,
  formatBytes,
  readFileBuffer,
  writeFileBuffer,
  uploadLocalFileToS3,
  downloadS3ToLocalFile
};