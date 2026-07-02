const express   = require('express');
const cors      = require('cors');
const helmet    = require('helmet');
const morgan    = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config({
  path: path.join(__dirname, process.env.NODE_ENV === 'production' ? '.env.production' : '.env'),
});

const logger       = require('./config/logger');
const { query }      = require('./config/database');
const authRoutes     = require('./routes/authRoutes');
const tenantRoutes   = require('./routes/tenantRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const auditRoutes    = require('./routes/auditRoutes');
const invoiceRoutes  = require('./routes/invoiceRoutes');
const ticketRoutes        = require('./routes/ticketRoutes');
const announcementRoutes  = require('./routes/announcementRoutes');

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
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      paid_at TIMESTAMP NULL,
      FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id) ON DELETE CASCADE
    )`,
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
  ];

  for (const sql of migrations) {
    try {
      await query(sql);
    } catch (e) {
      logger.warn('Migration warning', { msg: e.message.substring(0, 120) });
    }
  }
  logger.info('Migrations applied');
}

const app = express();

// Trust nginx reverse proxy (required for express-rate-limit behind nginx)
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
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(morgan('combined', { stream: { write: (msg) => logger.info(msg.trim()) } }));
app.use(express.json());

app.use('/api/', rateLimit({ windowMs: 15 * 60 * 1000, max: 500 }));
app.use('/api/auth/login', rateLimit({ windowMs: 15 * 60 * 1000, max: 10, skipSuccessfulRequests: true }));

app.get('/api/ping', (_req, res) => res.json({ ok: true }));
app.use('/api/auth',     authRoutes);
app.use('/api/tenants',  tenantRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/audit',    auditRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/tickets',        ticketRoutes);
app.use('/api/announcements',  announcementRoutes);

app.use((err, req, res, next) => {
  logger.error('Unhandled error', { error: err.message });
  res.status(500).json({ message: 'Internal server error' });
});

const PORT = process.env.PORT || 5001;
runMigrations().then(() => {
  app.listen(PORT, () => {
    logger.info(`Abyte ERP Admin Panel backend started on port ${PORT}`);
  });
}).catch(err => {
  logger.error('Migration failed, starting anyway', { error: err.message });
  app.listen(PORT, () => {
    logger.info(`Abyte ERP Admin Panel backend started on port ${PORT}`);
  });
});
