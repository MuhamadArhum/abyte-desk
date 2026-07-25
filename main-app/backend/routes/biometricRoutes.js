// =============================================================
// biometricRoutes.js — Routes for biometric device & attendance integration
// =============================================================

const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const bc = require('../controllers/biometricController');
const { authenticate, requirePermission } = require('../middleware/auth');
const { requireModule }                   = require('../middleware/moduleGuard');

router.use(authenticate);
router.use(requireModule('hr'));

// Device management
router.get('/devices',           bc.getDevices);
router.post('/devices',          requirePermission('hr.attendance'), bc.createDevice);
router.put('/devices/:id',       requirePermission('hr.attendance'), bc.updateDevice);
router.delete('/devices/:id',    requirePermission('hr.attendance'), bc.deleteDevice);

// Staff code mappings
router.get('/mappings',              bc.getMappings);
router.post('/mappings',             requirePermission('hr.attendance'), bc.saveMapping);
router.delete('/mappings/:code',     requirePermission('hr.attendance'), bc.deleteMapping);

// Log upload & retrieval
router.get('/logs',              bc.getLogs);
router.post('/upload',           requirePermission('hr.attendance'), upload.single('file'), bc.uploadLogs);
router.post('/process',          requirePermission('hr.attendance'), bc.processLogs);

module.exports = router;
