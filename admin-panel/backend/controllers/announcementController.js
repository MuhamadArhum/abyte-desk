const { query } = require('../config/database');

exports.getAll = async (req, res) => {
  try {
    const rows = await query(`SELECT * FROM announcements ORDER BY created_at DESC`);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getActive = async (req, res) => {
  try {
    const now = new Date();
    const rows = await query(`
      SELECT id, title, message, type FROM announcements
      WHERE is_active = 1
        AND (starts_at IS NULL OR starts_at <= ?)
        AND (ends_at   IS NULL OR ends_at   >= ?)
      ORDER BY created_at DESC
    `, [now, now]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.create = async (req, res) => {
  try {
    const { title, message, type = 'info', starts_at = null, ends_at = null } = req.body;
    if (!title?.trim() || !message?.trim()) return res.status(400).json({ message: 'Title and message required' });
    const result = await query(
      `INSERT INTO announcements (title, message, type, starts_at, ends_at) VALUES (?, ?, ?, ?, ?)`,
      [title.trim(), message.trim(), type, starts_at || null, ends_at || null]
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, message, type, is_active, starts_at, ends_at } = req.body;
    await query(
      `UPDATE announcements SET title=?, message=?, type=?, is_active=?, starts_at=?, ends_at=? WHERE id=?`,
      [title, message, type, is_active ? 1 : 0, starts_at || null, ends_at || null, id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.remove = async (req, res) => {
  try {
    await query(`DELETE FROM announcements WHERE id = ?`, [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};
