// =============================================================
// tenantController.js - Tenant (Client) Management + Config API
//
// Two responsibilities:
//   A) Super-Admin tenant CRUD (list/create/update/delete tenants)
//   B) Per-tenant config API (GET/PUT /api/tenants/config)
//      → Returns branding, tax, receipt settings for the CURRENT tenant
// =============================================================

const logger = require('../config/logger');
const bcrypt = require('bcryptjs');
const fs     = require('fs');
const path   = require('path');
const { masterQuery, masterGetConnection } = require('../config/masterDatabase');
const { queryDb, getPool }                 = require('../config/database');
const { PLAN_MODULES }                     = require('../middleware/moduleGuard');

// ─── A. SUPER-ADMIN TENANT CRUD ──────────────────────────────

// GET /api/tenants — list all tenants with stats + configs
exports.getAll = async (req, res) => {
  try {
    const tenants = await masterQuery(`
      SELECT
        t.tenant_id, t.tenant_code, t.tenant_name, t.db_name,
        t.is_active, t.admin_email, t.plan, t.subdomain, t.trial_ends_at,
        t.created_at,
        c.company_name, c.logo_url, c.tax_rate, c.currency_symbol
      FROM tenants t
      LEFT JOIN tenant_configs c ON c.tenant_id = t.tenant_id
      ORDER BY t.created_at DESC
    `);

    const result = await Promise.all(tenants.map(async (t) => {
      try {
        const [users]    = await queryDb(t.db_name, 'SELECT COUNT(*) as cnt FROM users');
        const [products] = await queryDb(t.db_name, 'SELECT COUNT(*) as cnt FROM products');
        const [sales]    = await queryDb(t.db_name, 'SELECT COUNT(*) as cnt FROM sales');
        return { ...t, stats: { users: users.cnt, products: products.cnt, sales: sales.cnt } };
      } catch {
        return { ...t, stats: { users: 0, products: 0, sales: 0 } };
      }
    }));

    res.json({ data: result });
  } catch (err) {
    logger.error('getAll tenants error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/tenants/plans — return all available plans
exports.getPlans = async (req, res) => {
  try {
    const plans = await masterQuery('SELECT * FROM plans WHERE is_active = 1 ORDER BY monthly_price');
    res.json({ data: plans });
  } catch (err) {
    logger.error('getPlans error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/tenants — create new tenant
exports.create = async (req, res) => {
  const {
    tenant_code, tenant_name, admin_name, admin_email, admin_password,
    plan = 'basic',
    // Optional config
    company_name, logo_url, tax_name, tax_rate, ntn, strn,
    receipt_header, receipt_footer, currency_symbol,
  } = req.body;

  if (!tenant_code || !tenant_name || !admin_email || !admin_password) {
    return res.status(400).json({ message: 'tenant_code, tenant_name, admin_email, admin_password required' });
  }
  if (!/^[a-z0-9_]+$/.test(tenant_code)) {
    return res.status(400).json({ message: 'tenant_code must be lowercase letters, numbers, underscore only' });
  }
  if (!['basic', 'professional', 'enterprise'].includes(plan)) {
    return res.status(400).json({ message: 'plan must be basic, professional, or enterprise' });
  }

  const existing = await masterQuery('SELECT tenant_id FROM tenants WHERE tenant_code = ?', [tenant_code]);
  if (existing.length > 0) {
    return res.status(400).json({ message: 'Company code already exists' });
  }

  const dbName = `abyte_pos_${tenant_code}`;
  const conn   = await masterGetConnection();

  try {
    // Step 1: Create the new database
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);

    // Step 2: Run schema on new database
    const schemaPath = path.join(__dirname, '../../database/schema.sql');
    let schema = fs.readFileSync(schemaPath, 'utf8');

    schema = schema.replace(/CREATE DATABASE IF NOT EXISTS `abyte_pos`;/g, '');
    schema = schema.replace(/USE `abyte_pos`;/g, `USE \`${dbName}\`;`);
    schema = schema.replace(/USE abyte_pos;/g, `USE \`${dbName}\`;`);
    if (!schema.includes(`USE \`${dbName}\``)) {
      schema = `USE \`${dbName}\`;\n` + schema;
    }

    const statements = schema.split(';').map(s => s.trim()).filter(s => s.length > 0);
    for (const stmt of statements) {
      try {
        await conn.query(stmt);
      } catch (e) {
        if (!e.message.includes('already exists') && !e.message.includes('Duplicate')) {
          logger.warn('Schema stmt warning:', e.message.substring(0, 80));
        }
      }
    }

    // Step 3: Seed default role_permissions for the plan
    await conn.query(`USE \`${dbName}\``);
    await conn.query(`
      INSERT IGNORE INTO role_permissions (role_name, module_key, is_allowed)
      VALUES
        ('Manager','dashboard',1),('Manager','sales.pos',1),('Manager','sales.orders',1),
        ('Manager','inventory.products',1),('Manager','inventory.categories',1),
        ('Manager','reports.sales',1),('Manager','reports.inventory',1),
        ('Cashier','sales.pos',1),('Cashier','sales.orders',1)
    `);

    // Step 4: Create admin user in new tenant DB
    const passwordHash = await bcrypt.hash(admin_password, 10);
    await conn.query(
      `INSERT INTO users (username, name, email, password_hash, role_id, role_name)
       VALUES (?, ?, ?, ?, 1, 'Admin')`,
      ['admin', admin_name || 'Admin', admin_email, passwordHash]
    );

    // Step 5: Register tenant in master DB
    await conn.beginTransaction();
    const result = await conn.query(
      `INSERT INTO tenants (tenant_code, tenant_name, db_name, admin_email, is_active, plan, subdomain)
       VALUES (?, ?, ?, ?, 1, ?, ?)`,
      [tenant_code, tenant_name, dbName, admin_email, plan, tenant_code]
    );
    const tenantId = Number(result.insertId);

    // Step 6: Create tenant config
    await conn.query(
      `INSERT INTO tenant_configs
         (tenant_id, company_name, logo_url, tax_name, tax_rate, ntn, strn,
          receipt_header, receipt_footer, currency_symbol, modules_enabled)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tenantId,
        company_name || tenant_name,
        logo_url || null,
        tax_name || 'GST',
        tax_rate || 0,
        ntn || null,
        strn || null,
        receipt_header || null,
        receipt_footer || 'Thank you for shopping!',
        currency_symbol || 'Rs.',
        JSON.stringify(PLAN_MODULES[plan]),
      ]
    );

    await conn.commit();

    res.status(201).json({
      message: `Tenant created! Login at: ${tenant_code}.localhost:5173`,
      tenant: {
        tenant_id:   tenantId,
        tenant_code,
        tenant_name,
        db_name:     dbName,
        admin_email,
        plan,
        subdomain:   tenant_code,
        login_url:   `http://${tenant_code}.localhost:5173`,
      },
    });
  } catch (err) {
    try { await conn.rollback(); } catch {}
    logger.error('Create tenant error:', err);
    try { await conn.query(`DROP DATABASE IF EXISTS \`${dbName}\``); } catch {}
    res.status(500).json({ message: 'Failed to create tenant: ' + err.message });
  } finally {
    conn.release();
  }
};

// PUT /api/tenants/:id — update tenant name, status, plan
exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const { tenant_name, is_active, plan } = req.body;

    const updates = [];
    const params  = [];
    if (tenant_name !== undefined) { updates.push('tenant_name = ?'); params.push(tenant_name); }
    if (is_active   !== undefined) { updates.push('is_active = ?');   params.push(is_active ? 1 : 0); }
    if (plan        !== undefined) {
      if (!['basic', 'professional', 'enterprise'].includes(plan)) {
        return res.status(400).json({ message: 'Invalid plan' });
      }
      updates.push('plan = ?');
      params.push(plan);
    }

    if (updates.length === 0) return res.status(400).json({ message: 'Nothing to update' });

    params.push(id);
    await masterQuery(`UPDATE tenants SET ${updates.join(', ')} WHERE tenant_id = ?`, params);

    // Update modules_enabled in config to match new plan
    if (plan) {
      await masterQuery(
        `UPDATE tenant_configs SET modules_enabled = ? WHERE tenant_id = ?`,
        [JSON.stringify(PLAN_MODULES[plan]), id]
      );
    }

    res.json({ message: 'Tenant updated' });
  } catch (err) {
    logger.error('Update tenant error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// DELETE /api/tenants/:id — soft delete (deactivate)
exports.remove = async (req, res) => {
  try {
    const { id } = req.params;
    const tenants = await masterQuery('SELECT tenant_code FROM tenants WHERE tenant_id = ?', [id]);
    if (tenants.length === 0) return res.status(404).json({ message: 'Tenant not found' });
    if (tenants[0].tenant_code === 'default') {
      return res.status(400).json({ message: 'Cannot delete the default tenant' });
    }
    await masterQuery('UPDATE tenants SET is_active = 0 WHERE tenant_id = ?', [id]);
    res.json({ message: 'Tenant deactivated (database preserved)' });
  } catch (err) {
    logger.error('Delete tenant error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/tenants/:id/reset-password
exports.resetAdminPassword = async (req, res) => {
  try {
    const { id }          = req.params;
    const { new_password } = req.body;
    if (!new_password || new_password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters' });
    }
    const tenants = await masterQuery(
      'SELECT db_name, admin_email FROM tenants WHERE tenant_id = ?',
      [id]
    );
    if (tenants.length === 0) return res.status(404).json({ message: 'Tenant not found' });

    const { db_name, admin_email } = tenants[0];
    const hash = await bcrypt.hash(new_password, 10);
    await queryDb(db_name, 'UPDATE users SET password_hash = ? WHERE email = ?', [hash, admin_email]);
    res.json({ message: 'Admin password reset successfully' });
  } catch (err) {
    logger.error('Reset password error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── B. TENANT CONFIG API ─────────────────────────────────────

// GET /api/tenants/config
// Returns the current tenant's branding + tax + receipt config.
// This endpoint is used by the frontend on every app load.
// Also returns plan + allowed modules (avoids a second request).
exports.getConfig = async (req, res) => {
  try {
    const tenantId = req.user?.tenant_id;
    const plan     = req.user?.plan || 'basic';

    if (!tenantId) {
      // Default tenant — return minimal config
      return res.json({
        company_name:    'AByte ERP',
        logo_url:        null,
        primary_color:   '#10b981',
        currency_symbol: 'Rs.',
        currency_code:   'PKR',
        timezone:        'Asia/Karachi',
        tax_name:        'GST',
        tax_rate:        0,
        ntn:             null,
        strn:            null,
        is_tax_exempt:   false,
        receipt_header:  null,
        receipt_footer:  'Thank you for shopping!',
        show_tax_on_receipt:  true,
        show_logo_on_receipt: true,
        show_ntn_on_receipt:  true,
        plan,
        modules_allowed:  PLAN_MODULES[plan] || PLAN_MODULES.basic,
        modules_enabled:  PLAN_MODULES[plan] || PLAN_MODULES.basic,
      });
    }

    const rows = await masterQuery(
      `SELECT c.*, t.plan, t.tenant_name
       FROM tenant_configs c
       JOIN tenants t ON t.tenant_id = c.tenant_id
       WHERE c.tenant_id = ?
       LIMIT 1`,
      [tenantId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Tenant config not found' });
    }

    const cfg = rows[0];
    const modulesEnabled = cfg.modules_enabled
      ? (typeof cfg.modules_enabled === 'string' ? JSON.parse(cfg.modules_enabled) : cfg.modules_enabled)
      : PLAN_MODULES[cfg.plan] || PLAN_MODULES.basic;

    res.json({
      company_name:    cfg.company_name,
      logo_url:        cfg.logo_url,
      primary_color:   cfg.primary_color,
      currency_symbol: cfg.currency_symbol,
      currency_code:   cfg.currency_code,
      timezone:        cfg.timezone,
      tax_name:        cfg.tax_name,
      tax_rate:        Number(cfg.tax_rate),
      ntn:             cfg.ntn,
      strn:            cfg.strn,
      is_tax_exempt:   Boolean(cfg.is_tax_exempt),
      receipt_header:  cfg.receipt_header,
      receipt_footer:  cfg.receipt_footer,
      show_tax_on_receipt:  Boolean(cfg.show_tax_on_receipt),
      show_logo_on_receipt: Boolean(cfg.show_logo_on_receipt),
      show_ntn_on_receipt:  Boolean(cfg.show_ntn_on_receipt),
      plan:             cfg.plan,
      modules_allowed:  PLAN_MODULES[cfg.plan] || PLAN_MODULES.basic,
      modules_enabled:  modulesEnabled,
    });
  } catch (err) {
    logger.error('getConfig error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// PUT /api/tenants/config
// Update the current tenant's config.
// Tenant admin can update branding, tax, receipt settings.
// Super admin can also update modules_enabled override.
exports.updateConfig = async (req, res) => {
  try {
    const tenantId = req.user?.tenant_id;
    if (!tenantId) {
      return res.status(400).json({ message: 'No tenant context' });
    }

    const {
      company_name, logo_url, primary_color, currency_symbol, currency_code, timezone,
      tax_name, tax_rate, ntn, strn, is_tax_exempt,
      receipt_header, receipt_footer,
      show_tax_on_receipt, show_logo_on_receipt, show_ntn_on_receipt,
      modules_enabled,   // Admin only — override which modules are ON
    } = req.body;

    // Build dynamic update
    const fields = [];
    const vals   = [];

    const set = (col, val) => { if (val !== undefined) { fields.push(`${col} = ?`); vals.push(val); } };

    set('company_name',  company_name);
    set('logo_url',      logo_url);
    set('primary_color', primary_color);
    set('currency_symbol', currency_symbol);
    set('currency_code', currency_code);
    set('timezone',      timezone);
    set('tax_name',      tax_name);
    set('tax_rate',      tax_rate !== undefined ? Number(tax_rate) : undefined);
    set('ntn',           ntn);
    set('strn',          strn);
    set('is_tax_exempt', is_tax_exempt !== undefined ? (is_tax_exempt ? 1 : 0) : undefined);
    set('receipt_header',  receipt_header);
    set('receipt_footer',  receipt_footer);
    set('show_tax_on_receipt',  show_tax_on_receipt !== undefined ? (show_tax_on_receipt ? 1 : 0) : undefined);
    set('show_logo_on_receipt', show_logo_on_receipt !== undefined ? (show_logo_on_receipt ? 1 : 0) : undefined);
    set('show_ntn_on_receipt',  show_ntn_on_receipt !== undefined ? (show_ntn_on_receipt ? 1 : 0) : undefined);

    // Only Admin can change module overrides
    if (modules_enabled !== undefined && req.user.role_name === 'Admin') {
      set('modules_enabled', JSON.stringify(modules_enabled));
    }

    if (fields.length === 0) return res.status(400).json({ message: 'Nothing to update' });

    vals.push(tenantId);
    await masterQuery(
      `UPDATE tenant_configs SET ${fields.join(', ')} WHERE tenant_id = ?`,
      vals
    );

    res.json({ message: 'Config updated successfully' });
  } catch (err) {
    logger.error('updateConfig error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/tenants/config/public?subdomain=ahmed
// Public endpoint — returns minimal branding (company name, logo, colors) for login page.
// No auth required.
exports.getPublicConfig = async (req, res) => {
  try {
    const { subdomain } = req.query;
    if (!subdomain) {
      return res.json({ company_name: 'AByte ERP', primary_color: '#10b981' });
    }

    const rows = await masterQuery(
      `SELECT c.company_name, c.logo_url, c.primary_color, t.tenant_name, t.plan
       FROM tenants t
       LEFT JOIN tenant_configs c ON c.tenant_id = t.tenant_id
       WHERE t.subdomain = ? AND t.is_active = 1
       LIMIT 1`,
      [subdomain]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Tenant not found' });
    }

    const row = rows[0];
    res.json({
      company_name:  row.company_name || row.tenant_name,
      logo_url:      row.logo_url,
      primary_color: row.primary_color || '#10b981',
    });
  } catch (err) {
    logger.error('getPublicConfig error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};
