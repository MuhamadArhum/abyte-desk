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
const { authenticate, authorize } = require('../middleware/auth');
const tenantController            = require('../controllers/tenantController');

// ── Public (no auth) ──────────────────────────────────────────
router.get('/config/public', tenantController.getPublicConfig);

// ── Authenticated ─────────────────────────────────────────────
router.get('/config',  authenticate, tenantController.getConfig);
router.put('/config',  authenticate, authorize('Admin'), tenantController.updateConfig);

// ── Admin only ────────────────────────────────────────────────
router.get('/plans',   authenticate, authorize('Admin'), tenantController.getPlans);
router.get('/',        authenticate, authorize('Admin'), tenantController.getAll);
router.post('/',       authenticate, authorize('Admin'), tenantController.create);
router.put('/:id',     authenticate, authorize('Admin'), tenantController.update);
router.delete('/:id',  authenticate, authorize('Admin'), tenantController.remove);
router.post('/:id/reset-password', authenticate, authorize('Admin'), tenantController.resetAdminPassword);

module.exports = router;
