const logger = require('../config/logger');

let nodemailer;
try {
  nodemailer = require('nodemailer');
} catch {
  logger.warn('[EmailService] nodemailer not installed. Run: npm install nodemailer');
}

function getTransporter() {
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
}

async function sendMail({ to, subject, html, text }) {
  const transporter = getTransporter();
  if (!transporter) {
    logger.warn('[EmailService] Not configured — skipping email', { to, subject });
    return { skipped: true };
  }
  const info = await transporter.sendMail({
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
    to, subject, html, text,
  });
  logger.info('[EmailService] Email sent', { to, subject, messageId: info.messageId });
  return info;
}

exports.sendPasswordReset = async ({ to, name, resetLink }) => {
  return sendMail({
    to,
    subject: 'Password Reset — AByte ERP',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08)">
        <div style="background:linear-gradient(135deg,#0f172a,#1e293b);padding:28px 32px;text-align:center">
          <img src="https://erp.abytesol.com/logo.png" alt="AByte ERP" style="width:56px;height:56px;object-fit:contain;background:#fff;border-radius:12px;padding:4px;margin-bottom:12px" />
          <h1 style="color:#10b981;margin:0;font-size:22px;font-weight:800;letter-spacing:-0.5px">AByte ERP</h1>
          <p style="color:#94a3b8;margin:4px 0 0;font-size:13px">Admin Password Reset</p>
        </div>
        <div style="padding:32px">
          <p style="color:#1e293b;font-size:15px;margin:0 0 8px">Hi <strong>${name || 'Admin'}</strong>,</p>
          <p style="color:#475569;font-size:14px;margin:0 0 24px;line-height:1.6">
            We received a request to reset your AByte ERP admin password.
            Click the button below to set a new password. This link will expire in <strong>1 hour</strong>.
          </p>
          <div style="text-align:center;margin:28px 0">
            <a href="${resetLink}" style="display:inline-block;background:#10b981;color:#ffffff;text-decoration:none;padding:13px 32px;border-radius:8px;font-weight:700;font-size:14px;letter-spacing:0.3px">
              Reset Password
            </a>
          </div>
          <p style="color:#94a3b8;font-size:12px;text-align:center;margin:20px 0 0;line-height:1.6">
            If you did not request this, you can safely ignore this email.<br/>
            Your password will not be changed.
          </p>
          <hr style="border:none;border-top:1px solid #f1f5f9;margin:24px 0" />
          <p style="color:#cbd5e1;font-size:11px;text-align:center;margin:0">
            Or copy this link: <span style="color:#64748b;word-break:break-all">${resetLink}</span>
          </p>
        </div>
        <div style="background:#f8fafc;padding:16px 32px;text-align:center">
          <p style="color:#94a3b8;font-size:11px;margin:0">AByte ERP &nbsp;|&nbsp; Powered by AbyteSol</p>
        </div>
      </div>`,
    text: `Hi ${name || 'Admin'},\n\nReset your AByte ERP password:\n${resetLink}\n\nExpires in 1 hour. If you didn't request this, ignore this email.\n\nPowered by AbyteSol`,
  });
};

exports.sendInvoiceEmail = async ({ to, clientName, invoiceNo, amount, period, dueDate, notes }) => {
  return sendMail({
    to,
    subject: `Invoice ${invoiceNo} — AByte ERP`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08)">
        <div style="background:linear-gradient(135deg,#0f172a,#1e293b);padding:28px 32px;text-align:center">
          <img src="https://erp.abytesol.com/logo.png" alt="AByte ERP" style="width:56px;height:56px;object-fit:contain;background:#fff;border-radius:12px;padding:4px;margin-bottom:12px" />
          <h1 style="color:#10b981;margin:0;font-size:22px;font-weight:800;letter-spacing:-0.5px">AByte ERP</h1>
          <p style="color:#94a3b8;margin:4px 0 0;font-size:13px">Invoice</p>
        </div>
        <div style="padding:32px">
          <p style="color:#1e293b;font-size:15px;margin:0 0 8px">Hi <strong>${clientName}</strong>,</p>
          <p style="color:#475569;font-size:14px;margin:0 0 24px;line-height:1.6">
            Please find your invoice details below for the period <strong>${period || ''}</strong>.
          </p>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:20px;margin-bottom:24px">
            <table style="width:100%;border-collapse:collapse;font-size:13px">
              <tr><td style="color:#64748b;padding:6px 0">Invoice No</td><td style="color:#1e293b;font-weight:700;text-align:right">${invoiceNo}</td></tr>
              <tr><td style="color:#64748b;padding:6px 0">Period</td><td style="color:#1e293b;text-align:right">${period || '—'}</td></tr>
              ${dueDate ? `<tr><td style="color:#64748b;padding:6px 0">Due Date</td><td style="color:#1e293b;text-align:right">${dueDate}</td></tr>` : ''}
              <tr style="border-top:1px solid #e2e8f0"><td style="color:#1e293b;font-weight:700;padding:10px 0 6px">Amount Due</td><td style="color:#10b981;font-weight:800;font-size:16px;text-align:right">Rs. ${Number(amount || 0).toLocaleString()}</td></tr>
            </table>
          </div>
          ${notes ? `<p style="color:#64748b;font-size:13px;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:12px;margin-bottom:20px">${notes}</p>` : ''}
          <p style="color:#94a3b8;font-size:12px;text-align:center;margin:20px 0 0">
            For any queries please contact us at ${process.env.EMAIL_USER || 'contact@abytesol.com'}
          </p>
        </div>
        <div style="background:#f8fafc;padding:16px 32px;text-align:center">
          <p style="color:#94a3b8;font-size:11px;margin:0">AByte ERP &nbsp;|&nbsp; Powered by AbyteSol</p>
        </div>
      </div>`,
    text: `Hi ${clientName},\n\nInvoice: ${invoiceNo}\nPeriod: ${period || '—'}\nAmount Due: Rs. ${Number(amount || 0).toLocaleString()}\n${notes ? `\nNote: ${notes}` : ''}\n\nPowered by AbyteSol`,
  });
};

exports.isConfigured = () => !!(process.env.EMAIL_HOST && process.env.EMAIL_USER);
