const { masterQuery } = require('../config/masterDatabase');

async function getMyTickets(req, res) {
  try {
    const tenantId = req.tenantId;
    const rows = await masterQuery(
      `SELECT ticket_id, subject, message, status, priority, admin_notes, created_at, updated_at, resolved_at
       FROM support_tickets WHERE tenant_id = ? ORDER BY created_at DESC`,
      [tenantId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch tickets' });
  }
}

async function createTicket(req, res) {
  try {
    const tenantId = req.tenantId;
    const { subject, message, priority = 'medium' } = req.body;
    if (!subject?.trim() || !message?.trim()) {
      return res.status(400).json({ error: 'Subject and message are required' });
    }
    const result = await masterQuery(
      `INSERT INTO support_tickets (tenant_id, subject, message, priority) VALUES (?, ?, ?, ?)`,
      [tenantId, subject.trim(), message.trim(), priority]
    );
    res.status(201).json({ ticket_id: result.insertId, message: 'Ticket submitted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create ticket' });
  }
}

module.exports = { getMyTickets, createTicket };
