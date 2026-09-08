// CJS adapter for the ESM-only `file-type` v22 package. The backend is
// CommonJS (multer-s3 keeps an old nested v3.9.0 copy for its sync API), so
// this wrapper uses dynamic import() to reach v22's async API from CJS code
// on any Node version without relying on require(esm).
let cachedModule = null;

async function fileTypeFromBuffer(buffer) {
  if (!cachedModule) cachedModule = await import('file-type');
  return cachedModule.fileTypeFromBuffer(buffer);
}

module.exports = { fileTypeFromBuffer };