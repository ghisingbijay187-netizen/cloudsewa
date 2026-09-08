const User = require('../models/User');
const File = require('../models/File');

// Decrement storageUsed but never below 0.
const decrementStorageUsed = async (userId, amount) => {
  const num = Number(amount);
  if (!num || num <= 0) return 0;

  const user = await User.findById(userId).select('storageUsed');
  if (!user) return 0;

  const current = Number(user.storageUsed) || 0;
  const next = Math.max(0, current - num);

  await User.updateOne(
    { _id: userId },
    { $set: { storageUsed: next } }
  );

  return current - next;
};

// Apply a signed delta, keeping the result at or above 0.
const adjustStorageUsed = async (userId, delta) => {
  const num = Number(delta);
  if (!num || num === 0) return 0;

  const user = await User.findById(userId).select('storageUsed');
  if (!user) return 0;

  const next = Math.max(0, (Number(user.storageUsed) || 0) + num);

  await User.updateOne(
    { _id: userId },
    { $set: { storageUsed: next } }
  );

  return next;
};

// Recompute storageUsed from actual file blobs; onlyActive excludes trash.
// Returns the recomputed total (bytes).
const recomputeStorageUsed = async (userId, options = {}) => {
  const query = { owner: userId };
  if (options.onlyActive) query.isDeleted = false;
  const files = await File.find(query).select('size storagePath versions');

  const distinct = new Set();
  let total = 0;

  for (const file of files) {
    const live = String(file.storagePath);
    if (!distinct.has(live)) {
      distinct.add(live);
      total += Number(file.size) || 0;
    }
    for (const v of file.versions || []) {
      const p = String(v.storagePath);
      if (!distinct.has(p)) {
        distinct.add(p);
        total += Number(v.size) || 0;
      }
    }
  }

  const safeTotal = Math.max(0, total);

  await User.updateOne(
    { _id: userId },
    { $set: { storageUsed: safeTotal } }
  );

  return safeTotal;
};

module.exports = { decrementStorageUsed, adjustStorageUsed, recomputeStorageUsed };
