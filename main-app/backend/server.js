// =============================================================
// server.js - Main Entry Point for AByte ERP Backend
//
// Multi-tenant SaaS flow:
//   1. Frontend sends X-Tenant-Subdomain header (set from window.location.hostname)
//   2. authController reads subdomain → looks up tenant in abyte_master
//   3. JWT includes { tenant_db, tenant_id, plan }
//   4. authenticate middleware routes all queries to correct tenant DB
//   5. requireModule middleware guards plan-based features
// =============================================================

const express   = require('express');
const cors      = require('cors');
const helmet    = require('helmet');
const morgan    = require('morgan');
const path      = require('path');
const rateLimit = require('express-rate-limit');
require('dotenv').config({
  path: path.join(__dirname, process.env.NODE_ENV === 'production' ? '.env.production' : '.env'),
});

const logger = require('./config/logger');
const { validateEnv } = require('./config/validateEnv');
validateEnv();

// ── JWT Secret Safety Check ──────────────────────────────────
const INSECURE_JWT_DEFAULTS = [
  'your-super-secret-jwt-key-change-in-production',
  'secret',
  'changeme',
  'jwt_secret',
];
if (!process.env.JWT_SECRET || INSECURE_JWT_DEFAULTS.includes(process.env.JWT_SECRET)) {
  if (process.env.NODE_ENV === 'production') {
    logger.error('FATAL: JWT_SECRET is not set or is using a default insecure value. Set a strong random secret in .env.production and restart.');
    process.exit(1);
  } else {
    logger.warn('WARNING: JWT_SECRET is insecure. Generate one with: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"');
  }
}

// ── Global Process Error Handlers ────────────────────────────
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Promise Rejection', {
    reason: reason instanceof Error ? reason.message : String(reason),
    stack:  reason instanceof Error ? reason.stack : undefined,
  });
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception — shutting down', { error: err.message, stack: err.stack });
  process.exit(1);
});

// --- Import Route Files ---
const authRoutes            = require('./routes/authRoutes');
const userRoutes            = require('./routes/userRoutes');
const productRoutes         = require('./routes/productRoutes');
const inventoryRoutes       = require('./routes/inventoryRoutes');
const salesRoutes           = require('./routes/salesRoutes');
const customerRoutes        = require('./routes/customerRoutes');
const reportRoutes          = require('./routes/reportRoutes');
const settingsRoutes        = require('./routes/settingsRoutes');
const aiRoutes              = require('./routes/aiRoutes');
const auditRoutes           = require('./routes/auditRoutes');
const registerRoutes        = require('./routes/registerRoutes');
const returnRoutes          = require('./routes/returnRoutes');
const backupRoutes          = require('./routes/backupRoutes');
const variantRoutes         = require('./routes/variantRoutes');
const bundleRoutes          = require('./routes/bundleRoutes');
const supplierRoutes        = require('./routes/supplierRoutes');
const staffRoutes           = require('./routes/staffRoutes');
const purchaseOrderRoutes   = require('./routes/purchaseOrderRoutes');
const storeRoutes           = require('./routes/storeRoutes');
const analyticsRoutes       = require('./routes/analyticsRoutes');
const accountingRoutes      = require('./routes/accountingRoutes');
const stockAdjustmentRoutes = require('./routes/stockAdjustmentRoutes');
const stockTransferRoutes   = require('./routes/stockTransferRoutes');
const inventoryReportRoutes = require('./routes/inventoryReportRoutes');
const salesReportRoutes     = require('./routes/salesReportRoutes');
const sectionsRoutes        = require('./routes/sectionsRoutes');
const issuanceRoutes        = require('./routes/issuanceRoutes');
const purchaseVoucherRoutes = require('./routes/purchaseVoucherRoutes');
const purchaseReturnRoutes  = require('./routes/purchaseReturnRoutes');
const openingStockRoutes    = require('./routes/openingStockRoutes');
const creditSaleRoutes      = require('./routes/creditSaleRoutes');
const quotationRoutes       = require('./routes/quotationRoutes');
const priceRuleRoutes       = require('./routes/priceRuleRoutes');
const salesTargetRoutes     = require('./routes/salesTargetRoutes');
const deliveryRoutes        = require('./routes/deliveryRoutes');
const permissionRoutes      = require('./routes/permissionRoutes');
const tenantRoutes          = require('./routes/tenantRoutes');
const emailRoutes           = require('./routes/emailRoutes');
const restaurantRoutes      = require('./routes/restaurantRoutes');
const recipeRoutes          = require('./routes/recipeRoutes');
const productionRoutes      = require('./routes/productionRoutes');
const biometricRoutes       = require('./routes/biometricRoutes');
const agentRoutes           = require('./routes/agentRoutes');

// --- Module Guard (plan-based access) ---
const { requireModule } = require('./middleware/moduleGuard');

const app = express();

// Trust nginx reverse proxy (required for express-rate-limit behind nginx)
app.set('trust proxy', 1);

// ── CORS Configuration ───────────────────────────────────────
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : ['http://localhost:5173', 'http://localhost:3000'];

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. same-origin, mobile apps, curl)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: Origin '${origin}' not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-Subdomain', 'X-Tenant-Code', 'X-Agent-Token'],
};

// ── Rate Limiters ────────────────────────────────────────────
// General API limiter: 2000 requests per 15 minutes per IP
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 2000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests. Please try again later.' },
});

// Strict limiter for login: 10 attempts per 15 minutes per IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many login attempts. Please wait 15 minutes.' },
});

// Heavy endpoint limiter: 60 requests per 15 minutes per IP
const heavyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests to this endpoint. Please slow down.' },
});

// AI limiter: 30 requests per 15 minutes (expensive AI calls)
const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'AI request limit reached. Please wait before asking again.' },
});

// Agent endpoint limiter: 300 requests per 15 minutes per IP
const agentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many agent requests. Please wait.' },
});

// ── Global Middleware ────────────────────────────────────────
app.use(helmet());
app.use(cors(corsOptions));

app.use(morgan('combined', {
  stream: { write: (msg) => logger.info(msg.trim()) },
}));
app.use(express.json({ limit: '10mb' }));

// Apply rate limiting
app.use('/api/', apiLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/reports',           heavyLimiter);
app.use('/api/sales-reports',     heavyLimiter);
app.use('/api/inventory-reports', heavyLimiter);
app.use('/api/analytics',         heavyLimiter);
app.use('/api/accounting',        heavyLimiter);
app.use('/api/ai',                aiLimiter);

// ── API Routes ───────────────────────────────────────────────

// Health check — public, no auth (used to wake up Render free tier)
app.get('/api/ping',    (_req, res) => res.json({ ok: true }));
app.get('/api/v1/ping', (_req, res) => res.json({ ok: true, version: 'v1' }));


// Auth (no tenant guard needed — login resolves tenant itself)
app.use('/api/auth',    authRoutes);

// Tenant management (Admin-only, uses master DB)
app.use('/api/tenants', tenantRoutes);

// Core routes (available on all plans)
app.use('/api/users',           userRoutes);
app.use('/api/customers',       customerRoutes);
app.use('/api/settings',        settingsRoutes);
app.use('/api/ai',              aiRoutes);
app.use('/api/audit',           auditRoutes);
app.use('/api/backup',          backupRoutes);
app.use('/api/permissions',     permissionRoutes);
app.use('/api/stores',          storeRoutes);
app.use('/api/analytics',       analyticsRoutes);
app.use('/api/email',           emailRoutes);

// Restaurant module
app.use('/api/restaurant/tables', restaurantRoutes);

// Sales module (basic+)
app.use('/api/sales',           salesRoutes);
app.use('/api/register',        registerRoutes);
app.use('/api/returns',         returnRoutes);
app.use('/api/credit-sales',    creditSaleRoutes);
app.use('/api/quotations',      quotationRoutes);
app.use('/api/price-rules',     priceRuleRoutes);
app.use('/api/sales-targets',   salesTargetRoutes);
app.use('/api/deliveries',      deliveryRoutes);

// Manufacturing / Recipe module
app.use('/api/recipes',             recipeRoutes);
app.use('/api/production-orders',   productionRoutes);

// Inventory module (basic+)
app.use('/api/products',            productRoutes);
app.use('/api/variants',            variantRoutes);
app.use('/api/bundles',             bundleRoutes);
app.use('/api/inventory',           inventoryRoutes);
app.use('/api/suppliers',           supplierRoutes);
app.use('/api/purchase-orders',     purchaseOrderRoutes);
app.use('/api/stock-adjustments',   stockAdjustmentRoutes);
app.use('/api/stock-transfers',     stockTransferRoutes);
app.use('/api/sections',            sectionsRoutes);
app.use('/api/issuance',            issuanceRoutes);
app.use('/api/purchase-vouchers',   purchaseVoucherRoutes);
app.use('/api/purchase-returns',    purchaseReturnRoutes);
app.use('/api/opening-stock',       openingStockRoutes);

// Reports module (basic+)
app.use('/api/reports',             reportRoutes);
app.use('/api/sales-reports',       salesReportRoutes);
app.use('/api/inventory-reports',   inventoryReportRoutes);

// Accounting module — PROFESSIONAL+ only
// requireModule is applied INSIDE accountingRoutes (see Step 4 note)
app.use('/api/accounting',          accountingRoutes);

// HR/Payroll module — PROFESSIONAL+ only
app.use('/api/staff',               staffRoutes);
app.use('/api/biometric',           biometricRoutes);
app.use('/api/agent', agentLimiter);
app.use('/api/agent',               agentRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', ts: new Date().toISOString() });
});

// ── Serve Uploaded Files (logos, etc.) ───────────────────────
const uploadsDir = path.join(__dirname, 'uploads');
if (!require('fs').existsSync(uploadsDir)) require('fs').mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));

// ── Serve React Frontend ──────────────────────────────────────
// Must be AFTER all /api routes so API calls are not intercepted.
const frontendDist = path.join(__dirname, '../frontend/dist');
app.use(express.static(frontendDist));

// Catch-all: any non-API route returns index.html (SPA routing)
app.use((req, res) => {
  res.sendFile(path.join(frontendDist, 'index.html'));
});

// ── Global Error Handler ─────────────────────────────────────
app.use((err, req, res, next) => {
  if (err.message && err.message.startsWith('CORS')) {
    return res.status(403).json({ message: err.message });
  }
  logger.error('Unhandled route error', {
    error:  err.message,
    stack:  err.stack,
    method: req.method,
    url:    req.originalUrl,
  });
  res.status(500).json({ message: 'Internal server error' });
});

// ── Scheduled Backup (daily at 2:00 AM) ─────────────────────
const cron = require('node-cron');
cron.schedule('0 2 * * *', async () => {
  try {
    logger.info('[Backup] Running scheduled daily backup...');
    const backupService = require('./services/backupService');
    const result = await backupService.createBackup(null, 'scheduled');
    logger.info('[Backup] Scheduled backup completed', { filename: result.filename });

    // Send email notification if configured
    try {
      const emailService = require('./services/emailService');
      if (emailService.isConfigured() && process.env.BACKUP_NOTIFY_EMAIL) {
        await emailService.sendBackupNotification({
          to: process.env.BACKUP_NOTIFY_EMAIL,
          filename: result.filename,
          status: 'completed',
        });
      }
    } catch {}
  } catch (err) {
    logger.error('[Backup] Scheduled backup failed', { error: err.message });
  }
});

// ── Startup Migration: run numbered migrations on all tenant DBs ──
const { queryDb } = require('./config/database');
const { runMigrationsForDb } = require('./services/migrationService');
const MASTER_DB = process.env.MASTER_DB_NAME || 'abyte_master';

async function runStartupMigrations() {
  try {
    const tenants = await queryDb(MASTER_DB, 'SELECT db_name FROM tenants WHERE is_active = 1');
    for (const t of tenants) {
      await runMigrationsForDb(t.db_name);
    }
    logger.info('[Migration] All tenant migrations complete');
  } catch (e) {
    logger.warn('[Migration] Startup migration skipped', { error: e.message });
  }
}

// ── Start Server ─────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, async () => {
  logger.info(`AByte ERP backend started`, {
    port:    PORT,
    db:      process.env.DB_NAME || 'abyte_pos',
    origins: allowedOrigins,
  });
  // Run after server is accepting requests so DB pool is ready
  runStartupMigrations();

  // Initialize DB-backed token blacklist table
  const { ensureTable, cleanExpired } = require('./services/tokenBlacklist');
  await ensureTable();

  // Clean expired blacklisted tokens every hour
  cron.schedule('0 * * * *', () => {
    cleanExpired().catch(() => {});
  });
});
