const { query } = require('../config/database');
const logger = require('../config/logger');

// GET /api/invoices
exports.getAll = async (req, res) => {
  try {
    const { status } = req.query;
    const conditions = [];
    const params = [];
    if (status) { conditions.push('i.status = ?'); params.push(status); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const rows = await query(
      `SELECT i.*, COALESCE(tc.company_name, t.tenant_name) AS tenant_name
       FROM invoices i
       JOIN tenants t ON t.tenant_id = i.tenant_id
       LEFT JOIN tenant_configs tc ON tc.tenant_id = i.tenant_id
       ${where}
       ORDER BY i.created_at DESC`,
      params
    );
    res.json({ data: rows });
  } catch (err) {
    logger.error('invoice getAll error', { error: err.message });
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/invoices/tenant/:tenantId
exports.getByTenant = async (req, res) => {
  try {
    const rows = await query(
      `SELECT i.*, COALESCE(tc.company_name, t.tenant_name) AS tenant_name
       FROM invoices i
       JOIN tenants t ON t.tenant_id = i.tenant_id
       LEFT JOIN tenant_configs tc ON tc.tenant_id = i.tenant_id
       WHERE i.tenant_id = ?
       ORDER BY i.created_at DESC`,
      [req.params.tenantId]
    );
    res.json({ data: rows });
  } catch (err) {
    logger.error('invoice getByTenant error', { error: err.message });
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/invoices
exports.create = async (req, res) => {
  try {
    const { tenant_id, amount, period_month, notes } = req.body;
    if (!tenant_id || !amount || !period_month) {
      return res.status(400).json({ message: 'tenant_id, amount, period_month required' });
    }

    // Auto-generate invoice number like INV-2026-0001
    const [{ max_num }] = await query(
      `SELECT COALESCE(MAX(CAST(SUBSTRING_INDEX(invoice_number, '-', -1) AS UNSIGNED)), 0) AS max_num
       FROM invoices WHERE invoice_number LIKE 'INV-%'`
    );
    const nextNum = String(Number(max_num) + 1).padStart(4, '0');
    const year = new Date().getFullYear();
    const invoice_number = `INV-${year}-${nextNum}`;

    const result = await query(
      `INSERT INTO invoices (tenant_id, invoice_number, amount, period_month, notes)
       VALUES (?, ?, ?, ?, ?)`,
      [tenant_id, invoice_number, amount, period_month, notes || null]
    );

    res.status(201).json({ message: 'Invoice created', invoice_id: result.insertId, invoice_number });
  } catch (err) {
    logger.error('invoice create error', { error: err.message });
    res.status(500).json({ message: 'Server error' });
  }
};

// PUT /api/invoices/:id/status
exports.updateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!['draft', 'sent', 'paid'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const paid_at = status === 'paid' ? new Date() : null;

    if (status === 'paid') {
      await query(
        'UPDATE invoices SET status = ?, paid_at = NOW() WHERE invoice_id = ?',
        [status, req.params.id]
      );
    } else {
      await query(
        'UPDATE invoices SET status = ?, paid_at = NULL WHERE invoice_id = ?',
        [status, req.params.id]
      );
    }

    res.json({ message: 'Status updated' });
  } catch (err) {
    logger.error('invoice updateStatus error', { error: err.message });
    res.status(500).json({ message: 'Server error' });
  }
};

// DELETE /api/invoices/:id
exports.delete = async (req, res) => {
  try {
    const rows = await query('SELECT status FROM invoices WHERE invoice_id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Invoice not found' });
    if (rows[0].status !== 'draft') {
      return res.status(400).json({ message: 'Only draft invoices can be deleted' });
    }
    await query('DELETE FROM invoices WHERE invoice_id = ?', [req.params.id]);
    res.json({ message: 'Invoice deleted' });
  } catch (err) {
    logger.error('invoice delete error', { error: err.message });
    res.status(500).json({ message: 'Server error' });
  }
};
