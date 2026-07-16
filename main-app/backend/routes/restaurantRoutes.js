const express = require('express');
const router = express.Router();
const { authenticate, requirePermission } = require('../middleware/auth');
const ctrl = require('../controllers/restaurantController');

router.use(authenticate);

router.get('/', ctrl.getTables);
router.post('/', requirePermission('restaurant.tables'), ctrl.createTable);
router.patch('/:id/status', ctrl.updateStatus);
router.put('/:id', requirePermission('restaurant.tables'), ctrl.updateTable);
router.delete('/:id', requirePermission('restaurant.tables'), ctrl.deleteTable);

module.exports = router;
