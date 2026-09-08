// Version labels are STABLE identities: a version's number never changes or
// recycles. Restoring a version keeps its number (the tick lands on it, e.g.
// restore v2 -> current is v2). New uploads take the next unused number.
// Gaps after restore/delete are intentional.

// The number the NEXT version will take: one above every number in use
// (both the live file's currentVersion and all saved versions).
const nextVersionNumber = (file) => {
  const numbers = (file.versions || []).map(v => Number(v.versionNumber) || 0);
  numbers.push(Number(file.currentVersion) || 0);
  return Math.max(...numbers) + 1;
};

// The oldest saved snapshot by capture time (the one trimmed first at cap).
const oldestVersion = (file) => {
  const versions = (file.versions || []).slice();
  if (versions.length === 0) return null;
  return versions.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))[0];
};

// Size of the snapshot that will be freed by the next cap-trim (nil-safe).
const oldestVersionSize = (file) => {
  const v = oldestVersion(file);
  return v ? Number(v.size) || 0 : 0;
};

// Remove oldest snapshot(s) beyond `cap`. Each removed blob is physically
// deleted ONLY if nothing else (another version or the live file) still
// references the same storagePath. `deleteBlob(path, storageMode)` is the
// storage back-end deletion function.
const trimToCap = async (file, cap, deleteBlob) => {
  while ((file.versions || []).length > cap) {
    const oldest = oldestVersion(file);
    if (!oldest) break;
    file.versions = file.versions.filter(v => v !== oldest);
    const stillReferenced = (file.versions || []).some(v => v.storagePath === oldest.storagePath)
      || file.storagePath === oldest.storagePath;
    if (!stillReferenced) {
      try {
        await deleteBlob(oldest.storagePath, file.storageMode);
      } catch (err) {
        console.error(`Error cleaning up old version: ${err.message}`);
      }
    }
  }
};

// Total storage accounted for by this file: the live blob plus every distinct
// version blob (same physical path is only counted once). NaN-safe.
const distinctBlobSize = (file) => {
  if (!file) return 0;
  const seen = new Set();
  let total = 0;
  if (file.storagePath && !seen.has(file.storagePath)) {
    seen.add(file.storagePath);
    total += Number(file.size) || 0;
  }
  for (const v of file.versions || []) {
    if (!seen.has(v.storagePath)) {
      seen.add(v.storagePath);
      total += Number(v.size) || 0;
    }
  }
  return total;
};

module.exports = { nextVersionNumber, oldestVersionSize, trimToCap, distinctBlobSize };