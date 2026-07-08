// =============================================================
// auth.js - Multi-Tenant Authentication & Authorization Middleware
// =============================================================

const jwt    = require('jsonwebtoken');
const logger = require('../config/logger');
const { queryDb, tenantStorage } = require('../config/database');
const { isBlacklisted } = require('../services/tokenBlacklist');

// --- authenticate ---
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const token = authHeader.split(' ')[1];

    if (await isBlacklisted(token)) {
      return res.status(401).json({ message: 'Token has been revoked. Please login again.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // tenant_db comes from JWT — set during login
    const tenantDb = decoded.tenant_db || process.env.DB_NAME || 'abyte_pos';

    const rows = await queryDb(
      tenantDb,
      'SELECT user_id, username, name, email, role_id, role_name, branch_id, is_active FROM users WHERE user_id = ?',
      [decoded.user_id]
    );

    if (rows.length === 0) {
      return res.status(401).json({ message: 'User not found' });
    }

    if (rows[0].is_active === 0) {
      return res.status(401).json({ message: 'Account has been deactivated. Please contact your administrator.' });
    }

    req.user      = rows[0]; // includes branch_id
    req.tenantDb  = tenantDb;
    req.tenantId  = decoded.tenant_id;
    req.modules   = decoded.modules || [];
    req.branchId  = rows[0].branch_id || null; // null = Admin (sees all branches)

    // Run inside tenant storage context so query() works in all controllers
    tenantStorage.run(tenantDb, next);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired' });
    }
    return res.status(401).json({ message: 'Invalid token' });
  }
};

// --- authorize ---
// Hardcoded role check — kept for truly admin-only routes (user mgmt, tenant mgmt, system settings)
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role_name)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    next();
  };
};

// --- requirePermission ---
// Dynamic permission check from role_permissions table.
// Admin always passes. All other roles checked against DB.
//
// For 2-part module keys (e.g. 'inventory.products', 'sales.pos'):
//   GET/HEAD  → checks base key (view)
//   POST      → checks moduleKey.create
//   PUT/PATCH → checks moduleKey.update
//   DELETE    → checks moduleKey.delete
//
// For 1-part parent keys (e.g. 'sales', 'inventory'):
//   any method → checks base key OR any sub-key (legacy behaviour)
//
// For explicit 3-part sub-keys (e.g. 'sales.pos.create'):
//   exact match only
const METHOD_ACTION = { POST: 'create', PUT: 'update', PATCH: 'update', DELETE: 'delete' };

const requirePermission = (moduleKey) => async (req, res, next) => {
  if (req.user.role_name === 'Admin') return next();
  try {
    const parts  = moduleKey.split('.');
    const action = METHOD_ACTION[req.method];

    // 2-part module key + write method → enforce CRUD sub-key
    if (parts.length === 2 && action) {
      const subKey = `${moduleKey}.${action}`;
      const rows = await queryDb(
        req.tenantDb,
        'SELECT 1 FROM role_permissions WHERE role_name = ? AND module_key = ? AND is_allowed = 1 LIMIT 1',
        [req.user.role_name, subKey]
      );
      if (rows.length === 0) return res.status(403).json({ message: 'Access denied' });
      return next();
    }

    // 3-part explicit sub-key → exact match only
    if (parts.length >= 3) {
      const rows = await queryDb(
        req.tenantDb,
        'SELECT 1 FROM role_permissions WHERE role_name = ? AND module_key = ? AND is_allowed = 1 LIMIT 1',
        [req.user.role_name, moduleKey]
      );
      if (rows.length === 0) return res.status(403).json({ message: 'Access denied' });
      return next();
    }

    // 1-part parent key OR GET on 2-part key → base key or any sub-key
    const rows = await queryDb(
      req.tenantDb,
      'SELECT 1 FROM role_permissions WHERE role_name = ? AND (module_key = ? OR module_key LIKE ?) AND is_allowed = 1 LIMIT 1',
      [req.user.role_name, moduleKey, `${moduleKey}.%`]
    );
    if (rows.length === 0) return res.status(403).json({ message: 'Access denied' });
    next();
  } catch (err) {
    logger.error('Permission check error', { error: err.message });
    return res.status(500).json({ message: 'Server error' });
  }
};

// --- requireSuperAdmin ---
// Cross-checks the master DB's super_admins table.
// Prevents tenant-level Admin users from accessing cross-tenant management routes.
const requireSuperAdmin = async (req, res, next) => {
  try {
    const MASTER_DB = process.env.MASTER_DB_NAME || 'abyte_master';
    const rows = await queryDb(
      MASTER_DB,
      'SELECT admin_id FROM super_admins WHERE email = ? AND is_active = 1',
      [req.user.email]
    );
    if (rows.length === 0) {
      return res.status(403).json({ message: 'Super admin access required' });
    }
    next();
  } catch (err) {
    logger.error('requireSuperAdmin check error', { error: err.message });
    return res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { authenticate, authorize, requirePermission, requireSuperAdmin };
