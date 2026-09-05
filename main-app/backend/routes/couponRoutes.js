const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { requireModule } = require('../middleware/moduleGuard');

// POST /api/coupons/validate
router.post('/validate', authenticate, requireModule('sales.loyalty'), (_req, res) => {
  res.status(501).json({ message: 'Coupon feature is not yet implemented' });
});

module.exports = router;
