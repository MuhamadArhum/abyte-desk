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

exports.sendInvoiceEmail = async ({ to, clientName, invoiceNo, amount, period, status, invoiceDate, notes }) => {
  function formatPeriod(p) {
    if (!p) return p || '';
    const [y, m] = p.split('-');
    const d = new Date(Number(y), Number(m) - 1, 1);
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }
  const periodLabel   = formatPeriod(period);
  const amountFmt     = Number(amount || 0).toLocaleString();
  const statusLabel   = (status || 'draft').toUpperCase();
  const dateFmt       = invoiceDate
    ? new Date(invoiceDate).toLocaleDateString('en-US', { day: '2-digit', month: 'long', year: 'numeric' })
    : '';

  return sendMail({
    to,
    subject: `Invoice ${invoiceNo} — AByte ERP`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,sans-serif;">
<div style="max-width:640px;margin:32px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.08);">

  <!-- Header -->
  <div style="padding:32px 40px 24px;border-bottom:2px solid #e2e8f0;display:flex;justify-content:space-between;align-items:flex-start;">
    <div>
      <h1 style="color:#059669;font-size:26px;margin:0;font-weight:800;">AByte ERP</h1>
      <p style="color:#94a3b8;font-size:12px;margin:4px 0 0;">Powered by AbyteSol</p>
    </div>
    <div style="text-align:right;">
      <p style="font-size:22px;font-weight:800;color:#1e293b;margin:0;">${invoiceNo}</p>
      <p style="color:#94a3b8;font-size:12px;margin:4px 0 0;">Status: <strong style="color:#059669;">${statusLabel}</strong></p>
    </div>
  </div>

  <!-- Bill To / Dates -->
  <div style="padding:24px 40px;display:flex;justify-content:space-between;border-bottom:1px solid #f1f5f9;">
    <div>
      <p style="font-size:10px;font-weight:800;text-transform:uppercase;color:#94a3b8;margin:0 0 4px;">Bill To</p>
      <p style="font-weight:700;color:#1e293b;margin:0;font-size:15px;">${clientName}</p>
    </div>
    <div style="text-align:right;">
      ${dateFmt ? `<p style="font-size:10px;font-weight:800;text-transform:uppercase;color:#94a3b8;margin:0 0 2px;">Invoice Date</p><p style="color:#1e293b;margin:0 0 10px;font-size:13px;">${dateFmt}</p>` : ''}
      <p style="font-size:10px;font-weight:800;text-transform:uppercase;color:#94a3b8;margin:0 0 2px;">Billing Period</p>
      <p style="color:#1e293b;margin:0;font-size:13px;">${periodLabel}</p>
    </div>
  </div>

  <!-- Line Items Table -->
  <div style="padding:24px 40px;">
    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr style="border-bottom:2px solid #e2e8f0;">
          <th style="text-align:left;padding:8px 0;font-size:11px;text-transform:uppercase;color:#94a3b8;font-weight:700;">Description</th>
          <th style="text-align:right;padding:8px 0;font-size:11px;text-transform:uppercase;color:#94a3b8;font-weight:700;">Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="padding:14px 0;color:#1e293b;font-size:14px;">ERP Subscription — ${periodLabel}</td>
          <td style="padding:14px 0;text-align:right;color:#1e293b;font-size:14px;">Rs. ${amountFmt}</td>
        </tr>
      </tbody>
      <tfoot>
        <tr style="border-top:2px solid #e2e8f0;">
          <td style="padding:12px 0 0;font-weight:700;font-size:16px;color:#1e293b;">Total</td>
          <td style="padding:12px 0 0;text-align:right;font-weight:800;font-size:18px;color:#059669;">Rs. ${amountFmt}</td>
        </tr>
      </tfoot>
    </table>
  </div>

  <!-- Notes -->
  ${notes ? `<div style="padding:0 40px 24px;"><p style="font-size:12px;color:#64748b;border-top:1px solid #e2e8f0;padding-top:16px;margin:0;">Notes: ${notes}</p></div>` : ''}

  <!-- Footer -->
  <div style="background:#f8fafc;padding:16px 40px;text-align:center;border-top:1px solid #e2e8f0;">
    <p style="color:#94a3b8;font-size:11px;margin:0;">Thank you for your business — AByte ERP &nbsp;|&nbsp; Powered by AbyteSol</p>
    <p style="color:#cbd5e1;font-size:10px;margin:6px 0 0;">Queries: ${process.env.EMAIL_USER || 'contact@abytesol.com'}</p>
  </div>

</div>
</body>
</html>`,
    text: `AByte ERP — Invoice ${invoiceNo}\n\nBill To: ${clientName}\nPeriod: ${periodLabel}\nDate: ${dateFmt}\nStatus: ${statusLabel}\n\nERP Subscription — ${periodLabel}: Rs. ${amountFmt}\nTotal: Rs. ${amountFmt}\n${notes ? `\nNotes: ${notes}` : ''}\n\nThank you for your business.\nPowered by AbyteSol`,
  });
};

exports.isConfigured = () => !!(process.env.EMAIL_HOST && process.env.EMAIL_USER);
