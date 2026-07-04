// backupScheduler.js — Per-tenant daily backup scheduler
// Each tenant gets their own backup file uploaded to their own Google Drive.

const cron = require('node-cron');
const logger = require('../config/logger');

const MASTER_DB = process.env.MASTER_DB_NAME || 'abyte_master';

let currentTask = null;

async function runPerTenantBackups() {
  const { queryDb } = require('../config/database');
  const backupService = require('./backupService');
  const gdriveService = require('./googleDriveService');

  let tenants = [];
  try {
    tenants = await queryDb(MASTER_DB, 'SELECT db_name, subdomain FROM tenants WHERE is_active = 1');
  } catch (err) {
    logger.error('[Backup] Could not fetch tenant list', { error: err.message });
    return;
  }

  logger.info(`[Backup] Starting per-tenant backup for ${tenants.length} tenant(s)`);

  for (const tenant of tenants) {
    const dbName = tenant.db_name;
    if (!dbName) continue;

    try {
      // Check if this tenant has backup enabled
      const schedRows = await queryDb(dbName,
        'SELECT backup_schedule_enabled FROM store_settings WHERE setting_id = 1'
      ).catch(() => []);

      const enabled = schedRows.length ? !!schedRows[0].backup_schedule_enabled : true;
      if (!enabled) {
        logger.info(`[Backup] Skipping ${dbName} — backup disabled by tenant`);
        continue;
      }

      // Create backup for this tenant only
      logger.info(`[Backup] Backing up tenant: ${dbName}`);
      const result = await backupService.createTenantBackup(dbName, 'scheduled');
      logger.info(`[Backup] Backup done: ${result.filename}`);

      // Upload to this tenant's Google Drive
      const driveSettings = await gdriveService.getTenantDriveSettings(dbName);
      if (driveSettings) {
        try {
          const fileId = await gdriveService.uploadBackupWithSettings(
            result.filepath, result.filename, driveSettings
          );
          logger.info(`[GDrive] Uploaded for ${dbName}`, { fileId, file: result.filename });
          await gdriveService.recordTenantUploadStatus(dbName, result.filename, 'success');
        } catch (driveErr) {
          logger.error(`[GDrive] Upload failed for ${dbName}`, { error: driveErr.message });
          await gdriveService.recordTenantUploadStatus(dbName, result.filename, `failed: ${driveErr.message.slice(0, 80)}`);
        }
      } else {
        logger.info(`[GDrive] No Drive config for ${dbName} — skipping upload`);
      }

    } catch (err) {
      logger.error(`[Backup] Failed for tenant ${dbName}`, { error: err.message });
    }
  }

  logger.info('[Backup] Per-tenant backup run complete');
}

function rescheduleBackup(enabled, hour, minute) {
  if (currentTask) {
    currentTask.stop();
    currentTask = null;
  }

  if (!enabled) {
    logger.info('[Backup] Scheduled backup disabled');
    return;
  }

  const cronExpr = `${minute} ${hour} * * *`;

  currentTask = cron.schedule(cronExpr, async () => {
    try {
      await runPerTenantBackups();
    } catch (err) {
      logger.error('[Backup] Scheduler error', { error: err.message });
    }
  });

  logger.info(`[Backup] Scheduled daily backup at ${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`);
}

module.exports = { rescheduleBackup };
