const { query } = require('../config/database');
const logger    = require('../config/logger');

// ── helper: next invoice number ──────────────────────────────
async function nextInvoiceNumber() {
  const [{ max_num }] = await query(
    `SELECT COALESCE(MAX(CAST(SUBSTRING_INDEX(invoice_number, '-', -1) AS UNSIGNED)), 0) AS max_num
     FROM invoices WHERE invoice_number LIKE 'INV-%'`
  );
  const num  = String(Number(max_num) + 1).padStart(4, '0');
  const year = new Date().getFullYear();
  return `INV-${year}-${num}`;
}

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

// GET /api/invoices/stats
exports.getStats = async (req, res) => {
  try {
    const [totals] = await query(`
      SELECT
        COUNT(*)                                          AS total,
        SUM(CASE WHEN status='paid'  THEN 1 ELSE 0 END) AS paid_count,
        SUM(CASE WHEN status='sent'  THEN 1 ELSE 0 END) AS sent_count,
        SUM(CASE WHEN status='draft' THEN 1 ELSE 0 END) AS draft_count,
        COALESCE(SUM(CASE WHEN status='paid'  THEN amount ELSE 0 END), 0) AS paid_revenue,
        COALESCE(SUM(CASE WHEN status!='paid' THEN amount ELSE 0 END), 0) AS pending_amount
      FROM invoices
    `);
    res.json(totals);
  } catch (err) {
    logger.error('invoice getStats error', { error: err.message });
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
    const invoice_number = await nextInvoiceNumber();
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

// POST /api/invoices/auto-generate  — generate for all active tenants for current month
exports.autoGenerate = async (req, res) => {
  try {
    const now          = new Date();
    const period_month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Load per-module prices (mirrors tenantController pattern)
    const MODULE_DEFAULTS = { sales: 2250, inventory: 2250, accounts: 2999, hr: 2999 };
    let customPrices = {};
    try {
      const priceRows = await query("SELECT `key`, value FROM settings WHERE `key` LIKE 'price_%'");
      priceRows.forEach(r => { customPrices[r.key.replace('price_', '')] = Number(r.value); });
    } catch { /* use defaults */ }
    const priceOf = (mod) => customPrices[mod] !== undefined ? customPrices[mod] : (MODULE_DEFAULTS[mod] || 0);

    const tenants = await query(
      `SELECT t.tenant_id, COALESCE(tc.company_name, t.tenant_name) AS tenant_name,
              tc.modules_enabled
       FROM tenants t
       LEFT JOIN tenant_configs tc ON tc.tenant_id = t.tenant_id
       WHERE t.is_active = 1`,
    );

    const existing = await query(
      `SELECT tenant_id FROM invoices WHERE period_month = ?`,
      [period_month]
    );
    const existingIds = new Set(existing.map(r => r.tenant_id));

    let created = 0;
    let skipped = 0;
    for (const t of tenants) {
      if (existingIds.has(t.tenant_id)) { skipped++; continue; }
      const modules = typeof t.modules_enabled === 'string'
        ? JSON.parse(t.modules_enabled || '[]')
        : (t.modules_enabled || []);
      const amount = modules.reduce((sum, m) => sum + priceOf(m), 0);
      if (amount <= 0) { skipped++; continue; }
      const invoice_number = await nextInvoiceNumber();
      await query(
        `INSERT INTO invoices (tenant_id, invoice_number, amount, period_month, notes)
         VALUES (?, ?, ?, ?, ?)`,
        [t.tenant_id, invoice_number, amount, period_month, `Auto-generated for ${period_month}`]
      );
      created++;
    }

    logger.info(`[InvoiceAutoGen] period=${period_month} created=${created} skipped=${skipped}`);
    res.json({ message: `Generated ${created} invoice(s)`, created, skipped, period_month });
  } catch (err) {
    logger.error('invoice autoGenerate error', { error: err.message });
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
    if (status === 'paid') {
      await query('UPDATE invoices SET status = ?, paid_at = NOW() WHERE invoice_id = ?', [status, req.params.id]);
    } else {
      await query('UPDATE invoices SET status = ?, paid_at = NULL WHERE invoice_id = ?', [status, req.params.id]);
    }
    res.json({ message: 'Status updated' });
  } catch (err) {
    logger.error('invoice updateStatus error', { error: err.message });
    res.status(500).json({ message: 'Server error' });
  }
};

// PUT /api/invoices/:id/payment  — record payment details
exports.recordPayment = async (req, res) => {
  try {
    const { payment_method, payment_reference, payment_note, payment_date } = req.body;
    if (!payment_method) return res.status(400).json({ message: 'payment_method required' });

    await query(
      `UPDATE invoices
       SET status = 'paid', paid_at = NOW(),
           payment_method = ?, payment_reference = ?, payment_note = ?,
           payment_date = ?
       WHERE invoice_id = ?`,
      [
        payment_method,
        payment_reference || null,
        payment_note      || null,
        payment_date      || null,
        req.params.id,
      ]
    );
    res.json({ message: 'Payment recorded' });
  } catch (err) {
    logger.error('invoice recordPayment error', { error: err.message });
    res.status(500).json({ message: 'Server error' });
  }
};

// DELETE /api/invoices/:id
exports.delete = async (req, res) => {
  try {
    const rows = await query('SELECT status FROM invoices WHERE invoice_id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Invoice not found' });
    if (rows[0].status !== 'draft') return res.status(400).json({ message: 'Only draft invoices can be deleted' });
    await query('DELETE FROM invoices WHERE invoice_id = ?', [req.params.id]);
    res.json({ message: 'Invoice deleted' });
  } catch (err) {
    logger.error('invoice delete error', { error: err.message });
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/invoices/:id/send-email
exports.sendEmail = async (req, res) => {
  try {
    const { to } = req.body;
    if (!to || !Array.isArray(to) || to.length === 0) {
      return res.status(400).json({ message: 'At least one recipient required' });
    }
    const rows = await query(
      `SELECT i.*, COALESCE(tc.company_name, t.tenant_name) AS tenant_name
       FROM invoices i
       JOIN tenants t ON t.tenant_id = i.tenant_id
       LEFT JOIN tenant_configs tc ON tc.tenant_id = i.tenant_id
       WHERE i.invoice_id = ?`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Invoice not found' });
    const inv = rows[0];

    const emailService = require('../services/emailService');
    for (const email of to) {
      await emailService.sendInvoiceEmail({
        to:         email,
        clientName: inv.tenant_name,
        invoiceNo:  inv.invoice_number,
        amount:     inv.amount,
        period:     inv.period_month,
        notes:      inv.notes,
      });
    }

    logger.info('[Invoice] Email sent', { invoice_id: req.params.id, to });
    res.json({ message: `Email sent to ${to.length} recipient(s)` });
  } catch (err) {
    logger.error('invoice sendEmail error', { error: err.message });
    res.status(500).json({ message: 'Server error' });
  }
};
