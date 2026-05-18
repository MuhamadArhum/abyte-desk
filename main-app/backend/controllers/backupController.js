// =============================================================
// backupController.js - Database Backup & Restore Controller
// Creates, lists, downloads, restores, and deletes database backups
// via backupService. Admin only.
// Used by: /api/backup routes
// =============================================================

const logger = require('../config/logger');
const path = require('path');
const { query } = require('../config/database');
const { logAction } = require('../services/auditService');
const backupService = require('../services/backupService');

exports.createBackup = async (req, res) => {
  try {
    const result = await backupService.createBackup(req.user.user_id, 'manual');

    await logAction(req.user.user_id, req.user.name, 'BACKUP_CREATED', 'backup', null,
      { filename: result.filename }, req.ip);

    res.status(201).json({ message: 'Backup created successfully', filename: result.filename });
  } catch (error) {
    logger.error('Create backup error:', error);
    res.status(500).json({ message: error.message || 'Failed to create backup' });
  }
};

exports.listBackups = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const countResult = await query('SELECT COUNT(*) as total FROM backups');
    const total = Number(countResult[0].total);

    const backups = await query(
      'SELECT b.*, u.name as created_by_name FROM backups b JOIN users u ON b.created_by = u.user_id ORDER BY b.created_at DESC LIMIT ? OFFSET ?',
      [parseInt(limit), offset]
    );
    const sanitized = backups.map(b => Object.fromEntries(Object.entries(b).map(([k, v]) => [k, typeof v === 'bigint' ? Number(v) : v])));
    
    res.json({
      data: sanitized,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    logger.error('List backups error:', error);
    res.status(500).json({ message: 'Failed to list backups' });
  }
};

exports.restoreBackup = async (req, res) => {
  try {
    const { filename } = req.body;
    if (!filename) {
      return res.status(400).json({ message: 'Filename is required' });
    }

    // Create a backup before restoring
    try {
      await backupService.createBackup(req.user.user_id, 'manual');
    } catch (preBackupErr) {
      logger.error('Pre-restore backup failed:', preBackupErr);
    }

    await backupService.restoreBackup(filename);

    await logAction(req.user.user_id, req.user.name, 'BACKUP_RESTORED', 'backup', null,
      { filename }, req.ip);

    res.json({ message: 'Backup restored successfully' });
  } catch (error) {
    logger.error('Restore backup error:', error);
    res.status(500).json({ message: error.message || 'Failed to restore backup' });
  }
};

exports.downloadBackup = async (req, res) => {
  try {
    const { filename } = req.params;

    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({ message: 'Invalid filename' });
    }

    const filepath = path.join(backupService.getBackupDir(), filename);
    res.download(filepath, filename, (err) => {
      if (err) {
        if (!res.headersSent) {
          res.status(404).json({ message: 'Backup file not found' });
        }
      }
    });
  } catch (error) {
    logger.error('Download backup error:', error);
    res.status(500).json({ message: 'Failed to download backup' });
  }
};

exports.deleteBackup = async (req, res) => {
  try {
    const { filename } = req.params;

    backupService.deleteBackupFile(filename);
    await query('DELETE FROM backups WHERE filename = ?', [filename]);

    await logAction(req.user.user_id, req.user.name, 'BACKUP_DELETED', 'backup', null,
      { filename }, req.ip);

    res.json({ message: 'Backup deleted' });
  } catch (error) {
    logger.error('Delete backup error:', error);
    res.status(500).json({ message: error.message || 'Failed to delete backup' });
  }
};
