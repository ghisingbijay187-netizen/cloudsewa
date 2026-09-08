const Notification = require('../models/Notification');

// Create one notification for a single recipient. Never throws — notification
// failures should never break the primary operation that triggered them.
const notify = async (recipientId, payload) => {
  if (!recipientId) return null;
  try {
    return await Notification.create({
      recipient: recipientId,
      type: payload.type || 'system',
      title: payload.title || 'Notification',
      message: payload.message || '',
      icon: payload.icon || null,
      link: payload.link || null,
      priority: payload.priority || 'low',
      metadata: payload.metadata || {}
    });
  } catch (err) {
    console.error('Notification create error:', err.message);
    return null;
  }
};

// Create a notification for many recipients at once (e.g. all admins).
const notifyMany = async (recipientIds, payload) => {
  const ids = Array.isArray(recipientIds) ? recipientIds : [recipientIds];
  const valid = ids.filter(Boolean);
  if (valid.length === 0) return;
  try {
    const docs = valid.map((id) => ({
      recipient: id,
      type: payload.type || 'system',
      title: payload.title || 'Notification',
      message: payload.message || '',
      icon: payload.icon || null,
      link: payload.link || null,
      priority: payload.priority || 'low',
      metadata: payload.metadata || {}
    }));
    await Notification.insertMany(docs);
  } catch (err) {
    console.error('Notification insertMany error:', err.message);
  }
};

module.exports = {
  notify,
  notifyMany
};
