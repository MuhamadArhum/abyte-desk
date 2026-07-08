// =============================================================
// tenantRoutes.js
//
// Public (no auth):
//   GET  /api/tenants/config/public?subdomain=ahmed  — login page branding
//
// Authenticated:
//   GET  /api/tenants/config      — current tenant's full config
//   PUT  /api/tenants/config      — update current tenant's config
//
// Admin only (Super-Admin tenant management):
//   GET  /api/tenants             — list all tenants
//   POST /api/tenants             — create new tenant
//   PUT  /api/tenants/:id         — update tenant
//   DEL  /api/tenants/:id         — deactivate tenant
//   POST /api/tenants/:id/reset-password
//   GET  /api/tenants/plans       — list available plans
// =============================================================

const express = require('express');
const router  = express.Router();
const { authenticate, authorize, requireSuperAdmin } = require('../middleware/auth');
const tenantController            = require('../controllers/tenantController');

// ── Public (no auth) ──────────────────────────────────────────
router.get('/config/public', tenantController.getPublicConfig);

// ── Authenticated ─────────────────────────────────────────────
router.get('/config',  authenticate, tenantController.getConfig);
router.put('/config',  authenticate, authorize('Admin'), tenantController.updateConfig);

// ── Super-admin only (cross-tenant operations) ───────────────
router.get('/plans',   authenticate, requireSuperAdmin, tenantController.getPlans);
router.get('/',        authenticate, requireSuperAdmin, tenantController.getAll);
router.post('/',       authenticate, requireSuperAdmin, tenantController.create);
router.put('/:id',     authenticate, requireSuperAdmin, tenantController.update);
router.delete('/:id',  authenticate, requireSuperAdmin, tenantController.remove);
router.post('/:id/reset-password', authenticate, requireSuperAdmin, tenantController.resetAdminPassword);

module.exports = router;
