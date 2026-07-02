const express   = require('express');
const cors      = require('cors');
const helmet    = require('helmet');
const morgan    = require('morgan');
const rateLimit = require('express-rate-limit');
const path      = require('path');
const cron      = require('node-cron');
require('dotenv').config({
  path: path.join(__dirname, process.env.NODE_ENV === 'production' ? '.env.production' : '.env'),
});

const logger             = require('./config/logger');
const { query }          = require('./config/database');
const authRoutes         = require('./routes/authRoutes');
const tenantRoutes       = require('./routes/tenantRoutes');
const settingsRoutes     = require('./routes/settingsRoutes');
const auditRoutes        = require('./routes/auditRoutes');
const invoiceRoutes      = require('./routes/invoiceRoutes');
const ticketRoutes       = require('./routes/ticketRoutes');
const announcementRoutes = require('./routes/announcementRoutes');
const systemRoutes       = require('./routes/systemRoutes');

// ── Migrations ───────────────────────────────────────────────
async function runMigrations() {
  const migrations = [
    `CREATE TABLE IF NOT EXISTS admin_audit_logs (
      log_id INT AUTO_INCREMENT PRIMARY KEY,
      admin_id INT NOT NULL,
      action VARCHAR(100) NOT NULL,
      target_type VARCHAR(50),
      target_id INT,
      target_name VARCHAR(255),
      details TEXT,
      ip_address VARCHAR(45),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS invoices (
      invoice_id INT AUTO_INCREMENT PRIMARY KEY,
      tenant_id INT NOT NULL,
      invoice_number VARCHAR(50) UNIQUE NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      period_month VARCHAR(7) NOT NULL,
      status ENUM('draft','sent','paid') DEFAULT 'draft',
      notes TEXT,
      payment_method ENUM('cash','bank','online','other') NULL,
      payment_reference VARCHAR(255) NULL,
      payment_note TEXT NULL,
      payment_date DATE NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      paid_at TIMESTAMP NULL,
      FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id) ON DELETE CASCADE
    )`,

    // Add payment columns to existing invoices table if not present
    `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_method ENUM('cash','bank','online','other') NULL`,
    `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_reference VARCHAR(255) NULL`,
    `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_note TEXT NULL`,
    `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_date DATE NULL`,

    `CREATE TABLE IF NOT EXISTS support_tickets (
      ticket_id INT AUTO_INCREMENT PRIMARY KEY,
      tenant_id INT NOT NULL,
      subject VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      status ENUM('open','in_progress','resolved','closed') DEFAULT 'open',
      priority ENUM('low','medium','high','urgent') DEFAULT 'medium',
      admin_notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      resolved_at TIMESTAMP NULL,
      FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id) ON DELETE CASCADE
    )`,

    `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS subscription_ends_at DATE NULL`,
    `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS subscription_status ENUM('trial','active','expired','suspended') DEFAULT 'trial'`,

    `CREATE TABLE IF NOT EXISTS announcements (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      type ENUM('info','warning','maintenance','success') DEFAULT 'info',
      is_active TINYINT(1) DEFAULT 1,
      starts_at DATETIME NULL,
      ends_at DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS announcement_views (
      id INT AUTO_INCREMENT PRIMARY KEY,
      announcement_id INT NOT NULL,
      tenant_id INT NOT NULL,
      viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_view (announcement_id, tenant_id),
      FOREIGN KEY (announcement_id) REFERENCES announcements(id) ON DELETE CASCADE
    )`,

    `CREATE TABLE IF NOT EXISTS settings (
      key_name VARCHAR(100) PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`,
  ];

  for (const sql of migrations) {
    try { await query(sql); }
    catch (e) { logger.warn('Migration warning', { msg: e.message.substring(0, 120) }); }
  }
  logger.info('[Admin] Migrations applied');
}

// ── Scheduled Jobs ───────────────────────────────────────────

// Monthly auto-invoice — 1st of every month at 9:00 AM
async function runAutoInvoice() {
  try {
    const now         = new Date();
    const period_month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const tenants = await query(
      `SELECT t.tenant_id, tc.monthly_price
       FROM tenants t LEFT JOIN tenant_configs tc ON tc.tenant_id = t.tenant_id
       WHERE t.is_active = 1`
    );
    const existing = await query(`SELECT tenant_id FROM invoices WHERE period_month = ?`, [period_month]);
    const existingIds = new Set(existing.map(r => r.tenant_id));

    let created = 0;
    for (const t of tenants) {
      if (existingIds.has(t.tenant_id)) continue;
      const amount = Number(t.monthly_price) || 0;
      if (amount <= 0) continue;
      const [{ max_num }] = await query(
        `SELECT COALESCE(MAX(CAST(SUBSTRING_INDEX(invoice_number,'-',-1) AS UNSIGNED)),0) AS max_num FROM invoices WHERE invoice_number LIKE 'INV-%'`
      );
      const num = String(Number(max_num) + 1).padStart(4, '0');
      await query(
        `INSERT INTO invoices (tenant_id, invoice_number, amount, period_month, notes) VALUES (?,?,?,?,?)`,
        [t.tenant_id, `INV-${now.getFullYear()}-${num}`, amount, period_month, `Auto-generated for ${period_month}`]
      );
      created++;
    }
    logger.info(`[AutoInvoice] created=${created} for ${period_month}`);
  } catch (err) {
    logger.error('[AutoInvoice] failed', { error: err.message });
  }
}

// Daily expiry check — 1:00 AM every day
async function runExpiryCheck() {
  try {
    const today = new Date().toISOString().split('T')[0];

    // Suspend expired active tenants
    const expired = await query(
      `SELECT tenant_id, tenant_name, subscription_ends_at FROM tenants
       WHERE is_active = 1 AND subscription_ends_at IS NOT NULL AND subscription_ends_at < ?
         AND subscription_status != 'suspended'`,
      [today]
    );

    for (const t of expired) {
      await query(
        `UPDATE tenants SET is_active = 0, subscription_status = 'suspended' WHERE tenant_id = ?`,
        [t.tenant_id]
      );
      logger.warn(`[ExpiryCheck] Suspended tenant: ${t.tenant_name} (expired ${t.subscription_ends_at})`);
    }

    // Warn tenants expiring in 7 days
    const soonDate = new Date();
    soonDate.setDate(soonDate.getDate() + 7);
    const soon = soonDate.toISOString().split('T')[0];
    const expiringSoon = await query(
      `SELECT tenant_id, tenant_name, subscription_ends_at FROM tenants
       WHERE is_active = 1 AND subscription_ends_at IS NOT NULL
         AND subscription_ends_at BETWEEN ? AND ?`,
      [today, soon]
    );
    if (expiringSoon.length) {
      logger.info(`[ExpiryCheck] ${expiringSoon.length} tenant(s) expiring within 7 days`, {
        tenants: expiringSoon.map(t => `${t.tenant_name} (${t.subscription_ends_at})`),
      });
    }

    logger.info(`[ExpiryCheck] done — suspended=${expired.length} expiring_soon=${expiringSoon.length}`);
  } catch (err) {
    logger.error('[ExpiryCheck] failed', { error: err.message });
  }
}

// ── App ──────────────────────────────────────────────────────
const app = express();
app.set('trust proxy', 1);

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : ['http://localhost:5174'];

app.use(helmet());
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: Origin '${origin}' not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-ID'],
}));

app.use(morgan('combined', { stream: { write: (msg) => logger.info(msg.trim()) } }));
app.use(express.json());
app.use('/api/', rateLimit({ windowMs: 15 * 60 * 1000, max: 500 }));
app.use('/api/auth/login', rateLimit({ windowMs: 15 * 60 * 1000, max: 10, skipSuccessfulRequests: true }));

app.get('/api/ping', (_req, res) => res.json({ ok: true }));
app.use('/api/auth',          authRoutes);
app.use('/api/tenants',       tenantRoutes);
app.use('/api/settings',      settingsRoutes);
app.use('/api/audit',         auditRoutes);
app.use('/api/invoices',      invoiceRoutes);
app.use('/api/tickets',       ticketRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/system',        systemRoutes);

app.use((err, req, res, _next) => {
  logger.error('Unhandled error', { error: err.message });
  res.status(500).json({ message: 'Internal server error' });
});

// ── Start ────────────────────────────────────────────────────
if (!process.env.JWT_SECRET) {
  logger.error('FATAL: JWT_SECRET environment variable is not set. Exiting.');
  process.exit(1);
}

const PORT = process.env.PORT || 5001;
runMigrations().then(() => {
  app.listen(PORT, () => {
    logger.info(`AByte ERP Admin Panel backend started on port ${PORT}`);

    // Monthly auto-invoice: 1st of each month at 9:00 AM
    cron.schedule('0 9 1 * *', runAutoInvoice);

    // Daily expiry check: 1:00 AM every day
    cron.schedule('0 1 * * *', runExpiryCheck);

    logger.info('[Cron] Auto-invoice (monthly) and expiry-check (daily) scheduled');
  });
}).catch(err => {
  logger.error('Migration failed, starting anyway', { error: err.message });
  app.listen(PORT, () => logger.info(`AByte ERP Admin Panel backend started on port ${PORT}`));
});
