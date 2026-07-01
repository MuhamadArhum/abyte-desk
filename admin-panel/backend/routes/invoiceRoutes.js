const express = require('express');
const router  = express.Router();
const { authenticate }    = require('../middleware/auth');
const invoiceController   = require('../controllers/invoiceController');

router.use(authenticate);

router.get('/',                         invoiceController.getAll);
router.get('/tenant/:tenantId',         invoiceController.getByTenant);
router.post('/',                        invoiceController.create);
router.put('/:id/status',              invoiceController.updateStatus);
router.delete('/:id',                  invoiceController.delete);

module.exports = router;
