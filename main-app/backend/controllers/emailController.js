// =============================================================
// emailController.js - Email Service Controller
// Manages SMTP connection status, connection testing, and sending
// alerts/notifications.
// Used by: /api/email routes
// =============================================================

const logger = require('../config/logger');
const emailService = require('../services/emailService');

exports.getStatus = async (req, res) => {
  res.json({
    configured: emailService.isConfigured(),
    host: process.env.EMAIL_HOST || null,
    user: process.env.EMAIL_USER ? process.env.EMAIL_USER.replace(/(.{2})(.+)(@.+)/, '$1***$3') : null,
  });
};

exports.testConnection = async (req, res) => {
  try {
    await emailService.testConnection();
    res.json({ ok: true, message: 'Email connection successful' });
  } catch (err) {
    res.status(400).json({ ok: false, message: err.message });
  }
};

exports.sendTest = async (req, res) => {
  try {
    const { to } = req.body;
    if (!to) return res.status(400).json({ message: 'to email is required' });

    const { sendMail } = require('../services/emailService');
    await require('../services/emailService').sendLoginAlert({
      to,
      name: req.user.name,
      ip: req.ip,
      time: new Date().toLocaleString(),
    });

    res.json({ message: `Test email sent to ${to}` });
  } catch (err) {
    logger.error('Test email error:', err);
    res.status(500).json({ message: err.message });
  }
};

exports.sendLowStockAlert = async (req, res) => {
  try {
    const { to } = req.body;
    const { query } = require('../config/database');

    const products = await query(`
      SELECT p.product_name, i.available_stock, p.reorder_level
      FROM inventory i
      JOIN products p ON i.product_id = p.product_id
      WHERE p.is_active = 1
        AND COALESCE(i.available_stock, 0) <= COALESCE(p.reorder_level, 10)
      ORDER BY i.available_stock ASC
      LIMIT 20
    `);

    if (products.length === 0) {
      return res.json({ message: 'No low stock products found' });
    }

    const adminEmail = to || req.user.email;
    await emailService.sendLowStockAlert({ to: adminEmail, products });
    res.json({ message: `Low stock alert sent to ${adminEmail} for ${products.length} products` });
  } catch (err) {
    logger.error('Low stock alert error:', err);
    res.status(500).json({ message: err.message });
  }
};
