const cron = require('node-cron');
const { performBackup, applyRetentionPolicy } = require('../controllers/backupController');
const { cleanExpiredTrash } = require('../controllers/fileController');
const { recomputeStorageUsed } = require('../utils/quotaUtil');
const User = require('../models/User');

// Re-sync every user's storageUsed from their actual files on a schedule.
const recomputeAllUsersStorage = async () => {
  try {
    const users = await User.find({}).select('_id');
    let changed = 0;
    for (const u of users) {
      try {
        await recomputeStorageUsed(u._id, { onlyActive: true });
        changed++;
      } catch (e) {
        console.error(`recomputeStorageUsed failed for user ${u._id}:`, e.message);
      }
    }
    console.log(`Storage recompute complete — ${changed}/${users.length} users reconciled`);
  } catch (error) {
    console.error('Storage recompute sweep failed:', error.message);
  }
};

const backupScheduler = () => {

  // Trim over-limit backups right after a restart, before the next nightly sweep.
  console.log('Running startup backup retention sweep...');
  (async () => {
    try {
      const { config, totalDeleted } = await applyRetentionPolicy();
      console.log(totalDeleted > 0
        ? `Startup retention sweep removed ${totalDeleted} over-limit backup(s)`
        : `Startup retention sweep complete — all types within limits (${JSON.stringify(config)})`);
    } catch (error) {
      console.error('Startup backup retention sweep failed:', error.message);
    }
  })();

  // Cleanup job — runs daily at 03:00 to rotate over-limit backups (retention
  // policy), purge trash past retention, and reconcile per-user storage.
  cron.schedule('0 3 * * *', async () => {
    console.log('Running backup retention sweep...');
    try {
      const { config, totalDeleted } = await applyRetentionPolicy();
      if (totalDeleted > 0) {
        console.log(`Retention sweep removed ${totalDeleted} over-limit backup(s)`);
      } else {
        console.log(`Retention sweep complete — all types within limits (${JSON.stringify(config)})`);
      }
    } catch (error) {
      console.error('Backup retention sweep failed:', error.message);
    }
    console.log('Running expired trash cleanup...');
    try {
      await cleanExpiredTrash(30);
    } catch (error) {
      console.error('Trash cleanup failed:', error.message);
    }
    console.log('Running storage recompute...');
    await recomputeAllUsersStorage();
  });

  // Hourly backup — runs at minute 0 of every hour
  cron.schedule('0 * * * *', async () => {
    console.log('Running hourly backup...');
    try {
      await performBackup('hourly');
      console.log('Hourly backup completed successfully');
    } catch (error) {
      console.error('Hourly backup failed:', error.message);
    }
  });

  // Daily backup — runs at midnight every day
  cron.schedule('0 0 * * *', async () => {
    console.log('Running daily backup...');
    try {
      await performBackup('daily');
      console.log('Daily backup completed successfully');
    } catch (error) {
      console.error('Daily backup failed:', error.message);
    }
  });

  // Weekly backup — runs at midnight every Sunday
  cron.schedule('0 0 * * 0', async () => {
    console.log('Running weekly backup...');
    try {
      await performBackup('weekly');
      console.log('Weekly backup completed successfully');
    } catch (error) {
      console.error('Weekly backup failed:', error.message);
    }
  });

  // Monthly backup — runs at midnight on the 1st of every month
  cron.schedule('0 0 1 * *', async () => {
    console.log('Running monthly backup...');
    try {
      await performBackup('monthly');
      console.log('Monthly backup completed successfully');
    } catch (error) {
      console.error('Monthly backup failed:', error.message);
    }
  });

  console.log('CloudSewa backup scheduler started');
  console.log('  - Hourly backup: every hour at :00');
  console.log('  - Daily backup: every day at midnight');
  console.log('  - Weekly backup: every Sunday at midnight');
  console.log('  - Monthly backup: 1st of every month at midnight');
};

module.exports = backupScheduler;