const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');

// POST /api/coupons/validate
router.post('/validate', authenticate, (_req, res) => {
  res.status(404).json({ message: 'Coupon not found' });
});

module.exports = router;
