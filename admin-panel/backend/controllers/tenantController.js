const bcrypt  = require('bcryptjs');
const fs      = require('fs');
const path    = require('path');
const { query, getConnection, tenantQuery, getTenantConnection } = require('../config/database');
const logger  = require('../config/logger');
const { logAction } = require('../middleware/auditLogger');

const MODULES = {
  sales:     { name: 'Sale',        price: 2250 },
  inventory: { name: 'Inventory',   price: 2250 },
  accounts:  { name: 'Accounts',    price: 2999 },
  hr:        { name: 'HR & Payroll',price: 2999 },
};

async function getModulePrices() {
  try {
    const rows = await query("SELECT `key`, value FROM settings WHERE `key` LIKE 'price_%'");
    if (rows.length === 0) return null;
    const prices = {};
    rows.forEach(r => { prices[r.key.replace('price_', '')] = Number(r.value); });
    return prices;
  } catch { return null; }
}

function priceOf(mod, prices) {
  if (prices && prices[mod] !== undefined) return prices[mod];
  return MODULES[mod]?.price || 0;
}

// GET /api/tenants
exports.getAll = async (req, res) => {
  try {
    const tenants = await query(`
      SELECT t.*, tc.company_name, tc.logo_url, tc.modules_enabled
      FROM tenants t
      LEFT JOIN tenant_configs tc ON tc.tenant_id = t.tenant_id
      ORDER BY t.created_at DESC
    `);

    const result = await Promise.all(tenants.map(async (t) => {
      try {
        const [users] = await tenantQuery(t.db_name, `SELECT COUNT(*) as cnt FROM \`${t.db_name}\`.users`);
        const [sales] = await tenantQuery(t.db_name, `SELECT COUNT(*) as cnt FROM \`${t.db_name}\`.sales`);
        const [dbSize] = await query(
          `SELECT ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) as size_mb
           FROM information_schema.tables WHERE table_schema = ? GROUP BY table_schema`,
          [t.db_name]
        );
        return { ...t, stats: { users: users?.cnt || 0, sales: sales?.cnt || 0 }, db_size_mb: dbSize?.size_mb || 0 };
      } catch {
        return { ...t, stats: { users: 0, sales: 0 }, db_size_mb: 0 };
      }
    }));

    res.json({ data: result });
  } catch (err) {
    logger.error('getAll tenants error', { error: err.message });
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/tenants/:id
exports.getOne = async (req, res) => {
  try {
    const rows = await query(`
      SELECT t.*, tc.company_name, tc.logo_url, tc.modules_enabled,
             tc.currency_symbol, tc.tax_rate, tc.receipt_footer
      FROM tenants t
      LEFT JOIN tenant_configs tc ON tc.tenant_id = t.tenant_id
      WHERE t.tenant_id = ?
    `, [req.params.id]);

    if (rows.length === 0) return res.status(404).json({ message: 'Tenant not found' });
    res.json({ data: rows[0] });
  } catch (err) {
    logger.error('getOne error', { error: err.message });
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/tenants — Create new client
exports.create = async (req, res) => {
  const {
    tenant_code, tenant_name, admin_name, admin_email, admin_password,
    modules = [], company_name,
  } = req.body;

  if (!tenant_code || !tenant_name || !admin_email || !admin_password) {
    return res.status(400).json({ message: 'tenant_code, tenant_name, admin_email, admin_password required' });
  }
  if (!/^[a-z0-9_]+$/.test(tenant_code)) {
    return res.status(400).json({ message: 'tenant_code: lowercase letters, numbers, underscore only' });
  }
  if (modules.length === 0) {
    return res.status(400).json({ message: 'At least one module required' });
  }

  const existing = await query('SELECT tenant_id FROM tenants WHERE tenant_code = ?', [tenant_code]);
  if (existing.length > 0) {
    return res.status(400).json({ message: 'Company code already exists' });
  }

  const dbName = `abyte_${tenant_code}`;
  const conn   = await getConnection();

  try {
    // Step 1: Create DB
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);

    // Step 2: Apply schema
    const schemaPath = path.resolve(__dirname, process.env.SCHEMA_PATH || '../../database/schema.sql');
    let schema = fs.readFileSync(schemaPath, 'utf8');
    schema = schema
      .replace(/CREATE DATABASE IF NOT EXISTS `abyte_pos`;/g, '')
      .replace(/USE `abyte_pos`;/g, `USE \`${dbName}\`;`)
      .replace(/USE abyte_pos;/g, `USE \`${dbName}\`;`);

    if (!schema.includes(`USE \`${dbName}\``)) {
      schema = `USE \`${dbName}\`;\n` + schema;
    }

    const statements = schema.split(';').map(s => s.trim()).filter(s => s.length > 0);
    for (const stmt of statements) {
      try { await conn.query(stmt); } catch (e) {
        if (!e.message.includes('already exists') && !e.message.includes('Duplicate')) {
          logger.warn('Schema stmt warning', { msg: e.message.substring(0, 80) });
        }
      }
    }

    // Step 3: Create admin user in tenant DB
    const passwordHash = await bcrypt.hash(admin_password, 10);
    await conn.query(`USE \`${dbName}\``);
    await conn.query(
      `INSERT INTO users (username, name, email, password_hash, role_id, role_name)
       VALUES (?, ?, ?, ?, 1, 'Admin')`,
      ['admin', admin_name || 'Admin', admin_email, passwordHash]
    );

    // Step 4: Switch back to master DB and register tenant
    await conn.query(`USE \`${process.env.MASTER_DB || 'abyte_master'}\``);
    await conn.beginTransaction();
    const result = await conn.query(
      `INSERT INTO tenants (tenant_code, tenant_name, db_name, admin_email, is_active, subdomain)
       VALUES (?, ?, ?, ?, 1, ?)`,
      [tenant_code, tenant_name, dbName, admin_email, tenant_code]
    );
    const tenantId = Number(result.insertId);

    await conn.query(
      `INSERT INTO tenant_configs (tenant_id, company_name, modules_enabled)
       VALUES (?, ?, ?)`,
      [tenantId, company_name || tenant_name, JSON.stringify(modules)]
    );

    await conn.commit();

    // Calculate monthly price
    const prices = await getModulePrices();
    const monthly = modules.reduce((sum, m) => sum + priceOf(m, prices), 0);

    logAction(req.admin?.admin_id, 'CREATE_TENANT', 'tenant', tenantId, tenant_name, { tenant_code, modules }, req.ip);

    res.status(201).json({
      message: 'Client created successfully',
      tenant: { tenant_id: tenantId, tenant_code, tenant_name, db_name: dbName, modules, monthly_price: monthly },
    });
  } catch (err) {
    try { await conn.rollback(); } catch {}
    try { await conn.query(`DROP DATABASE IF EXISTS \`${dbName}\``); } catch {}
    logger.error('Create tenant error', { error: err.message });
    res.status(500).json({ message: 'Failed to create client: ' + err.message });
  } finally {
    conn.release();
  }
};

// PUT /api/tenants/:id — Update modules, status, subscription
exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const { tenant_name, is_active, modules, subscription_ends_at, subscription_status } = req.body;

    const tenantFields = [];
    const tenantParams = [];

    if (tenant_name !== undefined) {
      tenantFields.push('tenant_name = ?');
      tenantParams.push(tenant_name);
    }
    if (is_active !== undefined) {
      tenantFields.push('is_active = ?');
      tenantParams.push(is_active ? 1 : 0);
    }
    if (subscription_ends_at !== undefined) {
      tenantFields.push('subscription_ends_at = ?');
      tenantParams.push(subscription_ends_at || null);
    }
    if (subscription_status !== undefined) {
      tenantFields.push('subscription_status = ?');
      tenantParams.push(subscription_status);
    }

    if (tenantFields.length > 0) {
      tenantParams.push(id);
      await query(`UPDATE tenants SET ${tenantFields.join(', ')} WHERE tenant_id = ?`, tenantParams);
    }

    if (modules !== undefined) {
      await query('UPDATE tenant_configs SET modules_enabled = ? WHERE tenant_id = ?', [JSON.stringify(modules), id]);
    }

    // Build audit detail
    const changes = {};
    if (tenant_name !== undefined) changes.tenant_name = tenant_name;
    if (is_active !== undefined) changes.is_active = is_active;
    if (modules !== undefined) changes.modules = modules;
    if (subscription_ends_at !== undefined) changes.subscription_ends_at = subscription_ends_at;
    if (subscription_status !== undefined) changes.subscription_status = subscription_status;

    logAction(req.admin?.admin_id, 'UPDATE_TENANT', 'tenant', Number(id), null, changes, req.ip);

    res.json({ message: 'Client updated' });
  } catch (err) {
    logger.error('Update tenant error', { error: err.message });
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/tenants/:id/renew — extend subscription by N months
exports.renew = async (req, res) => {
  try {
    const { id } = req.params;
    const months = Math.max(1, Math.min(24, parseInt(req.body.months) || 1));

    const tenants = await query('SELECT * FROM tenants WHERE tenant_id = ?', [id]);
    if (tenants.length === 0) return res.status(404).json({ message: 'Client not found' });

    const t = tenants[0];
    // Extend from current end date if it's still in the future, otherwise from today
    const base = (t.subscription_ends_at && new Date(t.subscription_ends_at) > new Date())
      ? new Date(t.subscription_ends_at)
      : new Date();
    base.setMonth(base.getMonth() + months);
    const newEndsAt = base.toISOString().split('T')[0];

    await query(
      `UPDATE tenants SET is_active = 1, subscription_status = 'active', subscription_ends_at = ? WHERE tenant_id = ?`,
      [newEndsAt, id]
    );

    logAction(req.admin?.admin_id, 'RENEW_SUBSCRIPTION', 'tenant', Number(id), null, { months, ends_at: newEndsAt }, req.ip);

    res.json({ message: 'Subscription renewed', ends_at: newEndsAt, months });
  } catch (err) {
    logger.error('Renew subscription error', { error: err.message });
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/tenants/:id/reset-password
exports.resetPassword = async (req, res) => {
  try {
    const { new_password } = req.body;
    if (!new_password || new_password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const tenants = await query('SELECT db_name, admin_email FROM tenants WHERE tenant_id = ?', [req.params.id]);
    if (tenants.length === 0) return res.status(404).json({ message: 'Client not found' });

    const { db_name, admin_email } = tenants[0];
    const hash = await bcrypt.hash(new_password, 10);
    await tenantQuery(db_name, `UPDATE \`${db_name}\`.users SET password_hash = ? WHERE email = ?`, [hash, admin_email]);

    logAction(req.admin?.admin_id, 'RESET_PASSWORD', 'tenant', Number(req.params.id), admin_email, null, req.ip);

    res.json({ message: 'Password reset successfully' });
  } catch (err) {
    logger.error('Reset password error', { error: err.message });
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/tenants/stats — Dashboard stats
exports.getStats = async (req, res) => {
  try {
    const [{ total }]  = await query('SELECT COUNT(*) as total FROM tenants');
    const [{ active }] = await query('SELECT COUNT(*) as active FROM tenants WHERE is_active = 1');

    const tenants = await query('SELECT db_name, modules_enabled FROM tenants t JOIN tenant_configs tc ON tc.tenant_id = t.tenant_id WHERE t.is_active = 1');
    const prices = await getModulePrices();

    let monthlyRevenue = 0;
    tenants.forEach(t => {
      const mods = typeof t.modules_enabled === 'string' ? JSON.parse(t.modules_enabled || '[]') : (t.modules_enabled || []);
      mods.forEach(m => { monthlyRevenue += priceOf(m, prices); });
    });

    let expiring_soon = 0, expired = 0;
    try {
      const [es] = await query(
        `SELECT COUNT(*) AS expiring_soon FROM tenants
         WHERE subscription_ends_at IS NOT NULL
           AND subscription_ends_at <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)
           AND subscription_ends_at > CURDATE()`
      );
      const [ex] = await query(
        `SELECT COUNT(*) AS expired FROM tenants
         WHERE subscription_ends_at IS NOT NULL AND subscription_ends_at <= CURDATE()`
      );
      expiring_soon = es.expiring_soon || 0;
      expired = ex.expired || 0;
    } catch { /* columns may not exist yet — safe default */ }

    res.json({ total, active, inactive: total - active, monthly_revenue: monthlyRevenue, expiring_soon, expired });
  } catch (err) {
    logger.error('getStats error', { error: err.message });
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/modules — Available modules list
exports.getModules = async (_req, res) => {
  res.json({
    data: Object.entries(MODULES).map(([key, m]) => ({ key, ...m }))
  });
};

// GET /api/tenants/:id/details — Full client detail
exports.getDetails = async (req, res) => {
  try {
    const rows = await query(`
      SELECT t.*, tc.company_name, tc.modules_enabled, tc.currency_symbol
      FROM tenants t
      LEFT JOIN tenant_configs tc ON tc.tenant_id = t.tenant_id
      WHERE t.tenant_id = ?
    `, [req.params.id]);

    if (rows.length === 0) return res.status(404).json({ message: 'Client not found' });
    const tenant = rows[0];
    const db = tenant.db_name;

    const safe = async (fn) => { try { return await fn(); } catch { return null; } };

    const [userRows, salesRow, revenueRow, dbSizeRow, recentLogins] = await Promise.all([
      safe(() => tenantQuery(db, `SELECT u.user_id, u.username, u.name, u.email, u.role_name, u.branch_id, u.created_at, s.store_name AS branch_name FROM \`${db}\`.users u LEFT JOIN \`${db}\`.stores s ON s.store_id = u.branch_id ORDER BY u.role_name ASC, u.created_at DESC`)),
      safe(() => tenantQuery(db, `SELECT COUNT(*) as cnt FROM \`${db}\`.sales`)),
      safe(() => tenantQuery(db, `SELECT COALESCE(SUM(net_amount),0) as total FROM \`${db}\`.sales WHERE status='completed'`)),
      safe(() => tenantQuery(db, `SELECT ROUND(SUM(data_length+index_length)/1024/1024,2) as mb FROM information_schema.tables WHERE table_schema=?`, [db])),
      safe(() => tenantQuery(db, `SELECT user_name, ip_address, created_at FROM \`${db}\`.audit_logs WHERE action='USER_LOGIN' ORDER BY created_at DESC LIMIT 10`)),
    ]);

    const mods = typeof tenant.modules_enabled === 'string'
      ? JSON.parse(tenant.modules_enabled || '[]')
      : (tenant.modules_enabled || []);

    res.json({
      tenant: { ...tenant, modules_enabled: mods },
      users:        userRows || [],
      sales_count:  salesRow?.[0]?.cnt || 0,
      total_revenue: Number(revenueRow?.[0]?.total || 0),
      db_size_mb:   Number(dbSizeRow?.[0]?.mb || 0),
      recent_logins: recentLogins || [],
      monthly_price: await getModulePrices().then(p => mods.reduce((s, m) => s + priceOf(m, p), 0)),
    });
  } catch (err) {
    logger.error('getDetails error', { error: err.message });
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/tenants/revenue — Revenue dashboard data
exports.getRevenue = async (req, res) => {
  try {
    const tenants = await query(`
      SELECT t.tenant_id, t.tenant_code, t.is_active, t.created_at,
             COALESCE(tc.company_name, t.tenant_name) AS display_name,
             tc.modules_enabled
      FROM tenants t
      LEFT JOIN tenant_configs tc ON tc.tenant_id = t.tenant_id
      ORDER BY t.created_at ASC
    `);

    const dbPrices = await getModulePrices();
    const getPrice = (mods) => mods.reduce((s, m) => s + priceOf(m, dbPrices), 0);
    const parseMods = (m) => {
      if (!m) return [];
      if (Array.isArray(m)) return m;
      try { return JSON.parse(m); } catch { return []; }
    };

    // Per-client breakdown
    const clientBreakdown = tenants.map(t => {
      const mods = parseMods(t.modules_enabled);
      return {
        tenant_id:    t.tenant_id,
        display_name: t.display_name,
        tenant_code:  t.tenant_code,
        is_active:    t.is_active,
        modules:      mods,
        monthly_price: getPrice(mods),
        joined_at:    t.created_at,
      };
    });

    // Monthly MRR chart — last 12 months
    const monthlyChart = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - i);
      const label = d.toLocaleDateString('en-PK', { month: 'short', year: '2-digit' });
      const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);

      // MRR = sum of prices of all active tenants created before this month end
      const mrr = tenants
        .filter(t => t.is_active && new Date(t.created_at) <= monthEnd)
        .reduce((s, t) => s + getPrice(parseMods(t.modules_enabled)), 0);

      // New clients this month
      const newClients = tenants.filter(t => {
        const cd = new Date(t.created_at);
        return cd.getMonth() === d.getMonth() && cd.getFullYear() === d.getFullYear();
      }).length;

      monthlyChart.push({ month: label, mrr, new_clients: newClients });
    }

    const activeTenants = tenants.filter(t => t.is_active);
    const currentMrr   = activeTenants.reduce((s, t) => s + getPrice(parseMods(t.modules_enabled)), 0);

    res.json({
      current_mrr:      currentMrr,
      annual_projection: currentMrr * 12,
      active_clients:   activeTenants.length,
      total_clients:    tenants.length,
      avg_per_client:   activeTenants.length ? Math.round(currentMrr / activeTenants.length) : 0,
      monthly_chart:    monthlyChart,
      client_breakdown: clientBreakdown,
    });
  } catch (err) {
    logger.error('getRevenue error', { error: err.message });
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/tenants/activity — Login activity summary for all tenants
exports.getActivity = async (req, res) => {
  try {
    const tenants = await query(`
      SELECT t.tenant_id, t.tenant_code, t.db_name, t.is_active,
             COALESCE(tc.company_name, t.tenant_name) AS display_name
      FROM tenants t
      LEFT JOIN tenant_configs tc ON tc.tenant_id = t.tenant_id
      ORDER BY t.created_at DESC
    `);

    const results = await Promise.all(tenants.map(async (t) => {
      try {
        const [todayCount] = await tenantQuery(t.db_name,
          `SELECT COUNT(*) AS cnt FROM \`${t.db_name}\`.audit_logs
           WHERE action = 'USER_LOGIN' AND DATE(created_at) = CURDATE()`
        );
        const [weekCount] = await tenantQuery(t.db_name,
          `SELECT COUNT(*) AS cnt FROM \`${t.db_name}\`.audit_logs
           WHERE action = 'USER_LOGIN' AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`
        );
        const [lastLogin] = await tenantQuery(t.db_name,
          `SELECT user_name, ip_address, created_at
           FROM \`${t.db_name}\`.audit_logs
           WHERE action = 'USER_LOGIN'
           ORDER BY created_at DESC LIMIT 1`
        );
        const [totalLogins] = await tenantQuery(t.db_name,
          `SELECT COUNT(*) AS cnt FROM \`${t.db_name}\`.audit_logs WHERE action = 'USER_LOGIN'`
        );

        return {
          tenant_id:    t.tenant_id,
          tenant_code:  t.tenant_code,
          display_name: t.display_name,
          is_active:    t.is_active,
          today_logins: todayCount?.cnt || 0,
          week_logins:  weekCount?.cnt  || 0,
          total_logins: totalLogins?.cnt || 0,
          last_login:   lastLogin || null,
        };
      } catch {
        return {
          tenant_id:    t.tenant_id,
          tenant_code:  t.tenant_code,
          display_name: t.display_name,
          is_active:    t.is_active,
          today_logins: 0,
          week_logins:  0,
          total_logins: 0,
          last_login:   null,
        };
      }
    }));

    res.json({ data: results });
  } catch (err) {
    logger.error('getActivity error', { error: err.message });
    res.status(500).json({ message: 'Server error' });
  }
};

// Ensure stores table exists in tenant DB (older tenants may not have it)
async function ensureStoresTable(db_name) {
  try {
    await tenantQuery(db_name, `
      CREATE TABLE IF NOT EXISTS \`${db_name}\`.stores (
        store_id   INT PRIMARY KEY AUTO_INCREMENT,
        store_name VARCHAR(200) NOT NULL,
        store_code VARCHAR(20)  NOT NULL UNIQUE,
        address    TEXT,
        phone      VARCHAR(20),
        email      VARCHAR(100),
        manager_id INT,
        monthly_charge DECIMAL(10,2) DEFAULT 0.00,
        is_active  TINYINT(1) DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_store_active (is_active),
        INDEX idx_store_code   (store_code)
      )
    `);
    // Seed default store if table is empty
    await tenantQuery(db_name, `
      INSERT IGNORE INTO \`${db_name}\`.stores (store_id, store_name, store_code, is_active)
      VALUES (1, 'Main Store', 'MAIN', 1)
    `);
    // Ensure columns added in later schema versions
    await tenantQuery(db_name, `ALTER TABLE \`${db_name}\`.stores ADD COLUMN IF NOT EXISTS monthly_charge DECIMAL(10,2) DEFAULT 0.00`);
    await tenantQuery(db_name, `ALTER TABLE \`${db_name}\`.users  ADD COLUMN IF NOT EXISTS branch_id INT NULL`);
    await tenantQuery(db_name, `ALTER TABLE \`${db_name}\`.staff  ADD COLUMN IF NOT EXISTS branch_id INT NULL`);
    await tenantQuery(db_name, `ALTER TABLE \`${db_name}\`.sales  ADD COLUMN IF NOT EXISTS branch_id INT NULL`);
  } catch (e) { /* ignore — columns/table already exist */ }
}

// GET /api/tenants/:id/branches — List all branches in tenant DB
exports.getBranches = async (req, res) => {
  try {
    const tenants = await query('SELECT db_name FROM tenants WHERE tenant_id = ?', [req.params.id]);
    if (tenants.length === 0) return res.status(404).json({ message: 'Client not found' });
    const { db_name } = tenants[0];

    await ensureStoresTable(db_name);

    const branches = await tenantQuery(db_name, `
      SELECT s.store_id, s.store_name, s.store_code, s.address, s.phone, s.email,
             s.is_active, s.monthly_charge,
             u.name AS manager_name,
             (SELECT COUNT(*) FROM \`${db_name}\`.staff st WHERE st.branch_id = s.store_id) AS total_staff,
             (SELECT COUNT(*) FROM \`${db_name}\`.sales sa WHERE sa.branch_id = s.store_id AND DATE(sa.sale_date) = CURDATE()) AS today_sales,
             (SELECT COALESCE(SUM(sa.net_amount),0) FROM \`${db_name}\`.sales sa WHERE sa.branch_id = s.store_id AND MONTH(sa.sale_date) = MONTH(CURDATE()) AND YEAR(sa.sale_date) = YEAR(CURDATE())) AS month_revenue
      FROM \`${db_name}\`.stores s
      LEFT JOIN \`${db_name}\`.users u ON u.user_id = s.manager_id
      ORDER BY s.store_id ASC
    `);

    res.json({ data: branches || [] });
  } catch (err) {
    logger.error('getBranches error', { error: err.message });
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/tenants/:id/branches — Create branch in tenant DB
exports.createBranch = async (req, res) => {
  try {
    const tenants = await query('SELECT db_name FROM tenants WHERE tenant_id = ?', [req.params.id]);
    if (tenants.length === 0) return res.status(404).json({ message: 'Client not found' });
    const { db_name } = tenants[0];

    const { store_name, store_code, address, phone, email, monthly_charge = 0 } = req.body;
    if (!store_name || !store_code) {
      return res.status(400).json({ message: 'store_name and store_code are required' });
    }

    await ensureStoresTable(db_name);

    const existing = await tenantQuery(db_name, `SELECT store_id FROM \`${db_name}\`.stores WHERE store_code = ?`, [store_code.toUpperCase()]);
    if (existing.length > 0) {
      return res.status(400).json({ message: 'Store code already exists for this client' });
    }

    await tenantQuery(db_name, `
      INSERT INTO \`${db_name}\`.stores (store_name, store_code, address, phone, email, monthly_charge, is_active)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `, [store_name, store_code.toUpperCase(), address || null, phone || null, email || null, monthly_charge]);

    res.status(201).json({ message: 'Branch created successfully' });
  } catch (err) {
    logger.error('createBranch error', { error: err.message });
    res.status(500).json({ message: 'Failed to create branch: ' + err.message });
  }
};

// PUT /api/tenants/:id/branches/:branchId — Update branch in tenant DB
exports.updateBranch = async (req, res) => {
  try {
    const tenants = await query('SELECT db_name FROM tenants WHERE tenant_id = ?', [req.params.id]);
    if (tenants.length === 0) return res.status(404).json({ message: 'Client not found' });
    const { db_name } = tenants[0];

    await ensureStoresTable(db_name);
    const { store_name, store_code, address, phone, email, monthly_charge, is_active } = req.body;
    if (!store_name || !store_code) {
      return res.status(400).json({ message: 'store_name and store_code are required' });
    }

    await tenantQuery(db_name, `
      UPDATE \`${db_name}\`.stores
      SET store_name = ?, store_code = ?, address = ?, phone = ?, email = ?, monthly_charge = ?, is_active = ?
      WHERE store_id = ?
    `, [store_name, store_code.toUpperCase(), address || null, phone || null, email || null, monthly_charge ?? 0, is_active ?? 1, req.params.branchId]);

    res.json({ message: 'Branch updated successfully' });
  } catch (err) {
    logger.error('updateBranch error', { error: err.message });
    res.status(500).json({ message: 'Server error' });
  }
};

// DELETE /api/tenants/:id/branches/:branchId — Delete branch from tenant DB
exports.deleteBranch = async (req, res) => {
  try {
    const tenants = await query('SELECT db_name FROM tenants WHERE tenant_id = ?', [req.params.id]);
    if (tenants.length === 0) return res.status(404).json({ message: 'Client not found' });
    const { db_name } = tenants[0];

    await ensureStoresTable(db_name);
    const countRows = await tenantQuery(db_name, `SELECT COUNT(*) as cnt FROM \`${db_name}\`.stores`);
    if ((countRows[0]?.cnt || 0) <= 1) {
      return res.status(400).json({ message: 'Cannot delete the only branch. A client must have at least one branch.' });
    }

    await tenantQuery(db_name, `DELETE FROM \`${db_name}\`.stores WHERE store_id = ?`, [req.params.branchId]);
    res.json({ message: 'Branch deleted successfully' });
  } catch (err) {
    logger.error('deleteBranch error', { error: err.message });
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/tenants/:id/users — List all users for a client with branch info
exports.getUsers = async (req, res) => {
  try {
    const tenants = await query('SELECT db_name FROM tenants WHERE tenant_id = ?', [req.params.id]);
    if (tenants.length === 0) return res.status(404).json({ message: 'Client not found' });
    const { db_name } = tenants[0];

    try {
      await tenantQuery(db_name, `ALTER TABLE \`${db_name}\`.users ADD COLUMN IF NOT EXISTS branch_id INT NULL`);
    } catch {}

    const users = await tenantQuery(db_name, `
      SELECT u.user_id, u.username, u.name, u.email, u.role_name, u.branch_id, u.created_at,
             s.store_name AS branch_name
      FROM \`${db_name}\`.users u
      LEFT JOIN \`${db_name}\`.stores s ON s.store_id = u.branch_id
      ORDER BY u.role_name ASC, u.name ASC
    `);

    res.json({ data: users || [] });
  } catch (err) {
    logger.error('getUsers error', { error: err.message });
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/tenants/:id/users — Create user for a client
exports.createUser = async (req, res) => {
  try {
    const tenants = await query('SELECT db_name FROM tenants WHERE tenant_id = ?', [req.params.id]);
    if (tenants.length === 0) return res.status(404).json({ message: 'Client not found' });
    const { db_name } = tenants[0];

    const { username, name, email, password, role_name, branch_id } = req.body;
    if (!username || !name || !email || !password) {
      return res.status(400).json({ message: 'username, name, email, password are required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters' });
    }

    try {
      await tenantQuery(db_name, `ALTER TABLE \`${db_name}\`.users ADD COLUMN IF NOT EXISTS branch_id INT NULL`);
    } catch {}

    // Check unique username
    const existUname = await tenantQuery(db_name, `SELECT user_id FROM \`${db_name}\`.users WHERE username = ?`, [username.trim()]);
    if (existUname.length > 0) return res.status(400).json({ message: 'Username already exists' });

    // Check unique email
    const existEmail = await tenantQuery(db_name, `SELECT user_id FROM \`${db_name}\`.users WHERE email = ?`, [email.trim().toLowerCase()]);
    if (existEmail.length > 0) return res.status(400).json({ message: 'Email already exists' });

    const hash = await bcrypt.hash(password, 10);
    const roleMap = { Admin: 1, Manager: 2, Cashier: 3, Accountant: 4 };
    const role_id = roleMap[role_name] || 3;
    const assignedBranch = role_name === 'Admin' ? null : (branch_id || null);

    const result = await tenantQuery(db_name,
      `INSERT INTO \`${db_name}\`.users (username, name, email, password_hash, role_id, role_name, branch_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [username.trim(), name.trim(), email.trim().toLowerCase(), hash, role_id, role_name || 'Cashier', assignedBranch]
    );

    res.status(201).json({ message: 'User created', user_id: result.insertId });
  } catch (err) {
    logger.error('createUser error', { error: err.message });
    res.status(500).json({ message: 'Server error' });
  }
};

// PUT /api/tenants/:id/users/:userId — Update user (role, branch, name, email, password)
exports.updateUser = async (req, res) => {
  try {
    const tenants = await query('SELECT db_name FROM tenants WHERE tenant_id = ?', [req.params.id]);
    if (tenants.length === 0) return res.status(404).json({ message: 'Client not found' });
    const { db_name } = tenants[0];

    const { userId } = req.params;
    const { name, email, role_name, branch_id, password } = req.body;

    const existing = await tenantQuery(db_name, `SELECT * FROM \`${db_name}\`.users WHERE user_id = ?`, [userId]);
    if (existing.length === 0) return res.status(404).json({ message: 'User not found' });

    if (email) {
      const emailCheck = await tenantQuery(db_name,
        `SELECT user_id FROM \`${db_name}\`.users WHERE email = ? AND user_id != ?`,
        [email.trim().toLowerCase(), userId]
      );
      if (emailCheck.length > 0) return res.status(400).json({ message: 'Email already in use' });
    }

    const roleMap = { Admin: 1, Manager: 2, Cashier: 3, Accountant: 4 };
    const role_id = roleMap[role_name] || existing[0].role_id;
    const assignedBranch = role_name === 'Admin' ? null : (branch_id !== undefined ? branch_id : existing[0].branch_id);

    await tenantQuery(db_name,
      `UPDATE \`${db_name}\`.users SET name=?, email=?, role_id=?, role_name=?, branch_id=? WHERE user_id=?`,
      [name || existing[0].name, email ? email.trim().toLowerCase() : existing[0].email,
       role_id, role_name || existing[0].role_name, assignedBranch, userId]
    );

    if (password && password.length >= 8) {
      const hash = await bcrypt.hash(password, 10);
      await tenantQuery(db_name, `UPDATE \`${db_name}\`.users SET password_hash=? WHERE user_id=?`, [hash, userId]);
    }

    res.json({ message: 'User updated' });
  } catch (err) {
    logger.error('updateUser error', { error: err.message });
    res.status(500).json({ message: 'Server error' });
  }
};

// DELETE /api/tenants/:id/users/:userId — Delete user
exports.deleteUser = async (req, res) => {
  try {
    const tenants = await query('SELECT db_name FROM tenants WHERE tenant_id = ?', [req.params.id]);
    if (tenants.length === 0) return res.status(404).json({ message: 'Client not found' });
    const { db_name } = tenants[0];

    const { userId } = req.params;
    const existing = await tenantQuery(db_name, `SELECT * FROM \`${db_name}\`.users WHERE user_id = ?`, [userId]);
    if (existing.length === 0) return res.status(404).json({ message: 'User not found' });

    // Prevent deleting last admin
    if (existing[0].role_name === 'Admin') {
      const adminCount = await tenantQuery(db_name,
        `SELECT COUNT(*) as cnt FROM \`${db_name}\`.users WHERE role_name = 'Admin'`
      );
      if ((adminCount[0]?.cnt || 0) <= 1) {
        return res.status(400).json({ message: 'Cannot delete the last admin user' });
      }
    }

    await tenantQuery(db_name, `DELETE FROM \`${db_name}\`.users WHERE user_id = ?`, [userId]);
    res.json({ message: 'User deleted' });
  } catch (err) {
    logger.error('deleteUser error', { error: err.message });
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/tenants/:id/activity — Detailed login history for one tenant
exports.getTenantActivity = async (req, res) => {
  try {
    const tenants = await query(
      `SELECT t.tenant_id, t.db_name, t.is_active,
              COALESCE(tc.company_name, t.tenant_name) AS display_name
       FROM tenants t LEFT JOIN tenant_configs tc ON tc.tenant_id = t.tenant_id
       WHERE t.tenant_id = ?`,
      [req.params.id]
    );
    if (tenants.length === 0) return res.status(404).json({ message: 'Tenant not found' });

    const { db_name } = tenants[0];

    const logs = await tenantQuery(db_name,
      `SELECT log_id, user_name, ip_address, created_at
       FROM \`${db_name}\`.audit_logs
       WHERE action = 'USER_LOGIN'
       ORDER BY created_at DESC
       LIMIT 100`
    );

    const [todayCount] = await tenantQuery(db_name,
      `SELECT COUNT(*) AS cnt FROM \`${db_name}\`.audit_logs
       WHERE action = 'USER_LOGIN' AND DATE(created_at) = CURDATE()`
    );
    const [weekCount] = await tenantQuery(db_name,
      `SELECT COUNT(*) AS cnt FROM \`${db_name}\`.audit_logs
       WHERE action = 'USER_LOGIN' AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`
    );

    // Daily breakdown for last 7 days
    const daily = await tenantQuery(db_name,
      `SELECT DATE(created_at) AS day, COUNT(*) AS cnt
       FROM \`${db_name}\`.audit_logs
       WHERE action = 'USER_LOGIN' AND created_at >= DATE_SUB(NOW(), INTERVAL 6 DAY)
       GROUP BY DATE(created_at)
       ORDER BY day ASC`
    );

    res.json({
      tenant:       tenants[0],
      today_logins: todayCount?.cnt || 0,
      week_logins:  weekCount?.cnt  || 0,
      daily_chart:  daily,
      logs,
    });
  } catch (err) {
    logger.error('getTenantActivity error', { error: err.message });
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/tenants/bulk — Bulk activate/deactivate
exports.bulkUpdate = async (req, res) => {
  try {
    const { ids, action } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'ids array required' });
    }
    if (!['activate', 'deactivate'].includes(action)) {
      return res.status(400).json({ message: 'action must be activate or deactivate' });
    }

    const is_active = action === 'activate' ? 1 : 0;
    const placeholders = ids.map(() => '?').join(',');
    await query(
      `UPDATE tenants SET is_active = ? WHERE tenant_id IN (${placeholders})`,
      [is_active, ...ids]
    );

    logAction(req.admin?.admin_id, `BULK_${action.toUpperCase()}`, 'tenants', null, null, { ids, count: ids.length }, req.ip);

    res.json({ message: `${ids.length} client(s) ${action}d` });
  } catch (err) {
    logger.error('bulkUpdate error', { error: err.message });
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/tenants/recent-activity — Last 20 login events across all tenant DBs
exports.getRecentActivity = async (req, res) => {
  try {
    const tenants = await query(
      `SELECT t.tenant_id, t.db_name, COALESCE(tc.company_name, t.tenant_name) AS tenant_name
       FROM tenants t
       LEFT JOIN tenant_configs tc ON tc.tenant_id = t.tenant_id
       WHERE t.is_active = 1`
    );

    const allLogins = [];

    await Promise.all(tenants.map(async (t) => {
      try {
        const logs = await tenantQuery(t.db_name,
          `SELECT user_name, ip_address, created_at
           FROM \`${t.db_name}\`.audit_logs
           WHERE action = 'USER_LOGIN' AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
           ORDER BY created_at DESC LIMIT 5`
        );
        if (logs && logs.length > 0) {
          logs.forEach(l => {
            allLogins.push({
              tenant_name: t.tenant_name,
              user_name:   l.user_name,
              ip_address:  l.ip_address,
              created_at:  l.created_at,
            });
          });
        }
      } catch { /* skip tenant if query fails */ }
    }));

    // Sort by created_at desc, take top 20
    allLogins.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const recent = allLogins.slice(0, 20);

    res.json({ data: recent });
  } catch (err) {
    logger.error('getRecentActivity error', { error: err.message });
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/tenants/expiring — Tenants with subscription_ends_at within 30 days
exports.getExpiring = async (req, res) => {
  try {
    const rows = await query(
      `SELECT t.tenant_id, t.tenant_name, t.is_active, t.subscription_ends_at, t.subscription_status,
              COALESCE(tc.company_name, t.tenant_name) AS display_name,
              DATEDIFF(t.subscription_ends_at, CURDATE()) AS days_remaining
       FROM tenants t
       LEFT JOIN tenant_configs tc ON tc.tenant_id = t.tenant_id
       WHERE t.subscription_ends_at IS NOT NULL
         AND t.subscription_ends_at <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)
       ORDER BY t.subscription_ends_at ASC`
    );
    res.json({ data: rows });
  } catch (err) {
    logger.error('getExpiring error', { error: err.message });
    res.status(500).json({ message: 'Server error' });
  }
};
