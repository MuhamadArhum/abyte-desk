const { query } = require('../config/database');
const logger = require('../config/logger');

// GET /api/audit
exports.getLogs = async (req, res) => {
  try {
    const { action, from, to, page = 1 } = req.query;
    const limit  = 50;
    const offset = (Math.max(1, Number(page)) - 1) * limit;

    const conditions = [];
    const params     = [];

    if (action) {
      conditions.push('l.action LIKE ?');
      params.push(`%${action}%`);
    }
    if (from) {
      conditions.push('l.created_at >= ?');
      params.push(from);
    }
    if (to) {
      conditions.push('l.created_at <= ?');
      params.push(to + ' 23:59:59');
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRows = await query(
      `SELECT COUNT(*) as total FROM admin_audit_logs l ${where}`,
      params
    );
    const total = countRows[0]?.total || 0;

    const logs = await query(
      `SELECT l.log_id, l.action, l.target_type, l.target_id, l.target_name,
              l.details, l.ip_address, l.created_at,
              a.name AS admin_name, a.email AS admin_email
       FROM admin_audit_logs l
       LEFT JOIN super_admins a ON a.admin_id = l.admin_id
       ${where}
       ORDER BY l.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    res.json({ data: logs, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    logger.error('getLogs error', { error: err.message });
    res.status(500).json({ message: 'Server error' });
  }
};
