const express = require('express');
const router  = express.Router();
const { masterQuery } = require('../config/masterDatabase');
const { authenticate } = require('../middleware/auth');

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
  } catch (err) {
    console.error('[announcements/active]', err.message);
    res.json([]);
  }
});

// POST /api/announcements/:id/view — record that this tenant viewed the announcement
router.post('/:id/view', authenticate, async (req, res) => {
  try {
    await masterQuery(
      `INSERT IGNORE INTO announcement_views (announcement_id, tenant_id) VALUES (?, ?)`,
      [req.params.id, req.tenantId]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('[announcements/view]', err.message);
    res.json({ ok: false });
  }
});

module.exports = router;
