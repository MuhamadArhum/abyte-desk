const express = require('express');
const router  = express.Router();
const { authenticate }  = require('../middleware/auth');
const ctrl = require('../controllers/invoiceController');

router.use(authenticate);

router.get('/stats',                ctrl.getStats);
router.get('/',                     ctrl.getAll);
router.get('/tenant/:tenantId',     ctrl.getByTenant);
router.post('/',                    ctrl.create);
router.post('/auto-generate',       ctrl.autoGenerate);
router.put('/:id/status',           ctrl.updateStatus);
router.put('/:id/payment',          ctrl.recordPayment);
router.delete('/:id',               ctrl.delete);

module.exports = router;
