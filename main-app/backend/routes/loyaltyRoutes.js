const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { requireModule } = require('../middleware/moduleGuard');

// GET /api/loyalty/config
// Returns 501 until loyalty tables are provisioned
router.get('/config', authenticate, requireModule('sales.loyalty'), (_req, res) => {
  res.status(501).json({ message: 'Loyalty program feature is not yet enabled' });
});

// GET /api/loyalty/customer/:id
router.get('/customer/:id', authenticate, requireModule('sales'), (_req, res) => {
  res.status(501).json({ message: 'Loyalty program feature is not yet enabled' });
});

module.exports = router;
