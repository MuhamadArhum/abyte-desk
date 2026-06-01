// emailService.js - Email notification service
// Requires: npm install nodemailer (in backend folder)
// Configure in .env: EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS, EMAIL_FROM

const logger = require('../config/logger');

let nodemailer;
try {
  nodemailer = require('nodemailer');
} catch {
  logger.warn('[EmailService] nodemailer not installed. Run: npm install nodemailer');
}

const getTransporter = () => {
  if (!nodemailer) return null;
  if (!process.env.EMAIL_HOST || !process.env.EMAIL_USER) return null;

  return nodemailer.createTransport({
    host:   process.env.EMAIL_HOST,
    port:   parseInt(process.env.EMAIL_PORT || '587'),
    secure: process.env.EMAIL_PORT === '465',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
};

const sendMail = async ({ to, subject, html, text }) => {
  const transporter = getTransporter();
  if (!transporter) {
    logger.warn('[EmailService] Email not configured — skipping send', { to, subject });
    return { skipped: true };
  }

  const info = await transporter.sendMail({
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
    to,
    subject,
    html,
    text,
  });

  logger.info('[EmailService] Email sent', { to, subject, messageId: info.messageId });
  return info;
};

// ── Notification templates ──────────────────────────────────────

exports.sendLowStockAlert = async ({ to, products }) => {
  const rows = products.map(p =>
    `<tr><td style="padding:6px 12px;border-bottom:1px solid #f0f0f0">${p.product_name}</td>
         <td style="padding:6px 12px;border-bottom:1px solid #f0f0f0;text-align:right;color:#dc2626">${p.available_stock}</td>
         <td style="padding:6px 12px;border-bottom:1px solid #f0f0f0;text-align:right">${p.reorder_level || 10}</td></tr>`
  ).join('');

  return sendMail({
    to,
    subject: `⚠️ Low Stock Alert — ${products.length} product(s) need reordering`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <div style="background:#10b981;padding:20px;border-radius:8px 8px 0 0">
          <h2 style="color:white;margin:0">Low Stock Alert</h2>
        </div>
        <div style="background:#f9fafb;padding:20px;border-radius:0 0 8px 8px">
          <p style="color:#374151">${products.length} product(s) have fallen below reorder level:</p>
          <table style="width:100%;border-collapse:collapse;background:white;border-radius:8px;overflow:hidden">
            <thead><tr style="background:#f3f4f6">
              <th style="padding:8px 12px;text-align:left;color:#6b7280">Product</th>
              <th style="padding:8px 12px;text-align:right;color:#6b7280">Current</th>
              <th style="padding:8px 12px;text-align:right;color:#6b7280">Reorder At</th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>
          <p style="color:#9ca3af;font-size:12px;margin-top:16px">AByte ERP — Automated Alert</p>
        </div>
      </div>`,
    text: `Low Stock Alert\n\n${products.map(p => `${p.product_name}: ${p.available_stock} units`).join('\n')}`,
  });
};

exports.sendSaleConfirmation = async ({ to, sale }) => {
  return sendMail({
    to,
    subject: `Sale Receipt — ${sale.sale_number || `#${sale.sale_id}`}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <div style="background:#10b981;padding:20px;border-radius:8px 8px 0 0">
          <h2 style="color:white;margin:0">Sale Confirmed</h2>
        </div>
        <div style="background:#f9fafb;padding:20px">
          <p><strong>Sale Number:</strong> ${sale.sale_number || sale.sale_id}</p>
          <p><strong>Amount:</strong> ${sale.net_amount}</p>
          <p><strong>Payment:</strong> ${sale.payment_method || 'Cash'}</p>
          <p><strong>Date:</strong> ${new Date(sale.sale_date).toLocaleString()}</p>
        </div>
      </div>`,
    text: `Sale Confirmed\nSale: ${sale.sale_number || sale.sale_id}\nAmount: ${sale.net_amount}`,
  });
};

exports.sendBackupNotification = async ({ to, filename, status, error }) => {
  const success = status === 'completed';
  return sendMail({
    to,
    subject: success ? `✅ Backup Created — ${filename}` : `❌ Backup Failed`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <div style="background:${success ? '#10b981' : '#ef4444'};padding:20px;border-radius:8px 8px 0 0">
          <h2 style="color:white;margin:0">${success ? 'Backup Successful' : 'Backup Failed'}</h2>
        </div>
        <div style="background:#f9fafb;padding:20px">
          ${success
            ? `<p>Database backup created successfully.</p><p><strong>File:</strong> ${filename}</p>`
            : `<p>Backup failed with error:</p><pre style="background:#fee2e2;padding:12px;border-radius:4px">${error}</pre>`
          }
          <p style="color:#9ca3af;font-size:12px">AByte ERP — Automated Backup</p>
        </div>
      </div>`,
    text: success ? `Backup created: ${filename}` : `Backup failed: ${error}`,
  });
};

exports.sendLoginAlert = async ({ to, name, ip, time }) => {
  return sendMail({
    to,
    subject: '🔐 New Login to AByte ERP',
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <div style="background:#3b82f6;padding:20px;border-radius:8px 8px 0 0">
          <h2 style="color:white;margin:0">Login Detected</h2>
        </div>
        <div style="background:#f9fafb;padding:20px">
          <p>User <strong>${name}</strong> logged in to AByte ERP.</p>
          <p><strong>IP:</strong> ${ip || 'Unknown'}</p>
          <p><strong>Time:</strong> ${time || new Date().toLocaleString()}</p>
          <p style="color:#9ca3af;font-size:12px">If this was not you, please change your password immediately.</p>
        </div>
      </div>`,
    text: `Login alert: ${name} logged in from ${ip} at ${time}`,
  });
};

exports.testConnection = async () => {
  const transporter = getTransporter();
  if (!transporter) throw new Error('Email not configured. Set EMAIL_HOST, EMAIL_USER, EMAIL_PASS in .env');
  await transporter.verify();
  return { ok: true };
};

exports.isConfigured = () => {
  return !!(process.env.EMAIL_HOST && process.env.EMAIL_USER);
};
