// =============================================================
// auth.js - Multi-Tenant Authentication & Authorization Middleware
// =============================================================

const jwt = require('jsonwebtoken');
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

    if (isBlacklisted(token)) {
      return res.status(401).json({ message: 'Token has been revoked. Please login again.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // tenant_db comes from JWT — set during login
    const tenantDb = decoded.tenant_db || process.env.DB_NAME || 'abyte_pos';

    const rows = await queryDb(
      tenantDb,
      'SELECT * FROM users WHERE user_id = ?',
      [decoded.user_id]
    );

    if (rows.length === 0) {
      return res.status(401).json({ message: 'User not found' });
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
const requirePermission = (moduleKey) => async (req, res, next) => {
  if (req.user.role_name === 'Admin') return next();
  try {
    // Match exact key OR any sub-key (e.g. 'sales' matches 'sales.pos', 'sales.orders', etc.)
    const rows = await queryDb(
      req.tenantDb,
      'SELECT 1 FROM role_permissions WHERE role_name = ? AND (module_key = ? OR module_key LIKE ?) AND is_allowed = 1 LIMIT 1',
      [req.user.role_name, moduleKey, `${moduleKey}.%`]
    );
    if (rows.length === 0) {
      return res.status(403).json({ message: 'Access denied' });
    }
    next();
  } catch (err) {
    console.error('Permission check error:', err.message);
    return res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { authenticate, authorize, requirePermission };
