const express = require('express');
const router  = express.Router();
const { authenticate }   = require('../middleware/auth');
const ticketController   = require('../controllers/ticketController');

router.use(authenticate);

router.get('/',                     ticketController.getAll);
router.get('/tenant/:tenantId',     ticketController.getByTenant);
router.post('/',                    ticketController.create);
router.put('/:id',                  ticketController.update);
router.delete('/:id',               ticketController.delete);

module.exports = router;
