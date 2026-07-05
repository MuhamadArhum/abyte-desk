const express = require('express');
const router = express.Router();
const controller = require('../controllers/stockTransferController');
const { authenticate, requirePermission } = require('../middleware/auth');
const { requireModule } = require('../middleware/moduleGuard');

router.use(authenticate);
router.use(requireModule('inventory.adjustments'));

router.get('/stats', controller.getStats);
router.get('/', controller.getAll);
router.get('/:id', controller.getById);
router.post('/', requirePermission('inventory.transfers'), controller.create);
router.put('/:id/approve', requirePermission('inventory.transfers'), controller.approve);
router.put('/:id/cancel', requirePermission('inventory.transfers'), controller.cancel);

module.exports = router;
