const express = require('express');
const router  = express.Router();
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/systemController');

router.get('/health', authenticate, ctrl.getHealth);

module.exports = router;
