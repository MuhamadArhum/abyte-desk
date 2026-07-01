const { query } = require('../config/database');
const logger = require('../config/logger');

/**
 * Fire-and-forget audit log insertion.
 * Does NOT throw — never slows down the response.
 */
function logAction(adminId, action, targetType, targetId, targetName, details, ip) {
  setImmediate(async () => {
    try {
      await query(
        `INSERT INTO admin_audit_logs
           (admin_id, action, target_type, target_id, target_name, details, ip_address)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          adminId   || null,
          action    || '',
          targetType || null,
          targetId  || null,
          targetName || null,
          details   ? (typeof details === 'object' ? JSON.stringify(details) : String(details)) : null,
          ip        || null,
        ]
      );
    } catch (e) {
      logger.warn('auditLogger insert failed', { error: e.message });
    }
  });
}

module.exports = { logAction };
