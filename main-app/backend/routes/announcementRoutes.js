const express = require('express');
const router  = express.Router();
const { masterQuery } = require('../config/masterDatabase');

// GET /api/announcements/active — no auth needed, public
router.get('/active', async (req, res) => {
  try {
    const now = new Date();
    const rows = await masterQuery(`
      SELECT id, title, message, type FROM announcements
      WHERE is_active = 1
        AND (starts_at IS NULL OR starts_at <= ?)
        AND (ends_at   IS NULL OR ends_at   >= ?)
      ORDER BY created_at DESC
    `, [now, now]);
    res.json(rows);
  } catch {
    res.json([]);
  }
});

module.exports = router;
