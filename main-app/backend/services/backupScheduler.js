// backupScheduler.js — Dynamic cron job for daily backup
// Call rescheduleBackup(enabled, hour, minute) to change schedule at runtime.

const cron = require('node-cron');
const logger = require('../config/logger');
const emailService = require('./emailService');

let currentTask = null;

function rescheduleBackup(enabled, hour, minute) {
  // Destroy existing task
  if (currentTask) {
    currentTask.stop();
    currentTask = null;
  }

  if (!enabled) {
    logger.info(`[Backup] Scheduled backup disabled`);
    return;
  }

  const cronExpr = `${minute} ${hour} * * *`;

  currentTask = cron.schedule(cronExpr, async () => {
    try {
      logger.info('[Backup] Running scheduled daily backup...');
      const backupService = require('./backupService');
      const result = await backupService.createBackup(null, 'scheduled');
      logger.info('[Backup] Scheduled backup completed', { filename: result.filename });

      // Upload to Google Drive if configured
      try {
        const gdriveService = require('./googleDriveService');
        const fileId = await gdriveService.uploadBackup(result.filepath, result.filename);
        if (fileId) {
          logger.info('[GDrive] Backup uploaded to Google Drive', { fileId, filename: result.filename });
        }
      } catch (driveErr) {
        logger.error('[GDrive] Drive upload failed', { error: driveErr.message });
        try {
          const gdriveService = require('./googleDriveService');
          await gdriveService.recordUploadFailure(result.filename, driveErr.message);
        } catch (_e) { /* silent */ }
      }

      try {
        if (emailService.isConfigured() && process.env.BACKUP_NOTIFY_EMAIL) {
          await emailService.sendBackupNotification({
            to: process.env.BACKUP_NOTIFY_EMAIL,
            filename: result.filename,
            status: 'completed',
          });
        }
      } catch (_e) { /* silent — email optional */ }
    } catch (err) {
      logger.error('[Backup] Scheduled backup failed', { error: err.message });
    }
  });

  logger.info(`[Backup] Scheduled daily backup at ${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`);
}

module.exports = { rescheduleBackup };
