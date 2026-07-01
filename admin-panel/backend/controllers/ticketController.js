const { query } = require('../config/database');
const logger = require('../config/logger');

// GET /api/tickets
exports.getAll = async (req, res) => {
  try {
    const { status } = req.query;
    const conditions = [];
    const params = [];
    if (status) { conditions.push('tk.status = ?'); params.push(status); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const rows = await query(
      `SELECT tk.*, COALESCE(tc.company_name, t.tenant_name) AS tenant_name
       FROM support_tickets tk
       JOIN tenants t ON t.tenant_id = tk.tenant_id
       LEFT JOIN tenant_configs tc ON tc.tenant_id = tk.tenant_id
       ${where}
       ORDER BY
         FIELD(tk.priority, 'urgent', 'high', 'medium', 'low'),
         tk.created_at DESC`,
      params
    );
    res.json({ data: rows });
  } catch (err) {
    logger.error('ticket getAll error', { error: err.message });
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/tickets/tenant/:tenantId
exports.getByTenant = async (req, res) => {
  try {
    const rows = await query(
      `SELECT tk.*, COALESCE(tc.company_name, t.tenant_name) AS tenant_name
       FROM support_tickets tk
       JOIN tenants t ON t.tenant_id = tk.tenant_id
       LEFT JOIN tenant_configs tc ON tc.tenant_id = tk.tenant_id
       WHERE tk.tenant_id = ?
       ORDER BY tk.created_at DESC`,
      [req.params.tenantId]
    );
    res.json({ data: rows });
  } catch (err) {
    logger.error('ticket getByTenant error', { error: err.message });
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/tickets
exports.create = async (req, res) => {
  try {
    const { tenant_id, subject, message, priority = 'medium' } = req.body;
    if (!tenant_id || !subject || !message) {
      return res.status(400).json({ message: 'tenant_id, subject, message required' });
    }

    const result = await query(
      `INSERT INTO support_tickets (tenant_id, subject, message, priority)
       VALUES (?, ?, ?, ?)`,
      [tenant_id, subject, message, priority]
    );

    res.status(201).json({ message: 'Ticket created', ticket_id: result.insertId });
  } catch (err) {
    logger.error('ticket create error', { error: err.message });
    res.status(500).json({ message: 'Server error' });
  }
};

// PUT /api/tickets/:id
exports.update = async (req, res) => {
  try {
    const { status, priority, admin_notes } = req.body;
    const fields = [];
    const params = [];

    if (status) {
      fields.push('status = ?');
      params.push(status);

      if (status === 'resolved' || status === 'closed') {
        fields.push('resolved_at = NOW()');
      } else {
        fields.push('resolved_at = NULL');
      }
    }
    if (priority) { fields.push('priority = ?'); params.push(priority); }
    if (admin_notes !== undefined) { fields.push('admin_notes = ?'); params.push(admin_notes); }

    if (fields.length === 0) return res.status(400).json({ message: 'Nothing to update' });

    params.push(req.params.id);
    await query(`UPDATE support_tickets SET ${fields.join(', ')} WHERE ticket_id = ?`, params);

    res.json({ message: 'Ticket updated' });
  } catch (err) {
    logger.error('ticket update error', { error: err.message });
    res.status(500).json({ message: 'Server error' });
  }
};

// DELETE /api/tickets/:id
exports.delete = async (req, res) => {
  try {
    const rows = await query('SELECT ticket_id FROM support_tickets WHERE ticket_id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Ticket not found' });
    await query('DELETE FROM support_tickets WHERE ticket_id = ?', [req.params.id]);
    res.json({ message: 'Ticket deleted' });
  } catch (err) {
    logger.error('ticket delete error', { error: err.message });
    res.status(500).json({ message: 'Server error' });
  }
};
