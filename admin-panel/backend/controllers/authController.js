const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const crypto  = require('crypto');
const { query }      = require('../config/database');
const logger         = require('../config/logger');
const { logAction }  = require('../middleware/auditLogger');
const emailService   = require('../services/emailService');

// POST /api/auth/login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password required' });
    }

    const rows = await query(
      'SELECT * FROM super_admins WHERE email = ? AND is_active = 1',
      [email]
    );

    if (rows.length === 0) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const admin = rows[0];
    const isMatch = await bcrypt.compare(password, admin.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { admin_id: admin.admin_id, email: admin.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '12h' }
    );

    res.json({
      token,
      admin: {
        admin_id: admin.admin_id,
        name:     admin.name,
        email:    admin.email,
      },
    });
  } catch (err) {
    logger.error('Admin login error', { error: err.message });
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/auth/me
exports.me = async (req, res) => {
  res.json({ admin: req.admin });
};

// PUT /api/auth/profile
exports.updateProfile = async (req, res) => {
  try {
    const { name, email } = req.body;
    if (!name && !email) {
      return res.status(400).json({ message: 'name or email required' });
    }
    if (email && email !== req.admin.email) {
      const existing = await query(
        'SELECT admin_id FROM super_admins WHERE email = ? AND admin_id != ?',
        [email, req.admin.admin_id]
      );
      if (existing.length > 0) return res.status(400).json({ message: 'Email already in use' });
    }
    const fields = [], params = [];
    if (name)  { fields.push('name = ?');  params.push(name); }
    if (email) { fields.push('email = ?'); params.push(email); }
    params.push(req.admin.admin_id);
    await query(`UPDATE super_admins SET ${fields.join(', ')} WHERE admin_id = ?`, params);
    const rows = await query('SELECT admin_id, name, email FROM super_admins WHERE admin_id = ?', [req.admin.admin_id]);
    logAction(req.admin?.admin_id, 'UPDATE_PROFILE', 'super_admin', req.admin?.admin_id, req.admin?.email, { name, email }, req.ip);
    res.json({ message: 'Profile updated', admin: rows[0] });
  } catch (err) {
    logger.error('updateProfile error', { error: err.message });
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/auth/forgot-password
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });

    const rows = await query(
      'SELECT admin_id, name FROM super_admins WHERE email = ? AND is_active = 1',
      [email.trim().toLowerCase()]
    );

    if (rows.length > 0) {
      const admin = rows[0];
      const rawToken  = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const expires   = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await query(
        'UPDATE super_admins SET reset_token = ?, reset_token_expires = ? WHERE admin_id = ?',
        [tokenHash, expires, admin.admin_id]
      );

      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5174';
      const resetLink = `${frontendUrl}/reset-password?token=${rawToken}`;

      await emailService.sendPasswordReset({ to: email.trim(), name: admin.name, resetLink });
    }

    // Always return success — never reveal whether email exists
    res.json({ message: 'If that email is registered, a reset link has been sent.' });
  } catch (err) {
    logger.error('forgotPassword error', { error: err.message });
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/auth/reset-password
exports.resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      return res.status(400).json({ message: 'Token and password are required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters' });
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const rows = await query(
      'SELECT admin_id FROM super_admins WHERE reset_token = ? AND reset_token_expires > NOW()',
      [tokenHash]
    );

    if (rows.length === 0) {
      return res.status(400).json({ message: 'Invalid or expired reset link. Please request a new one.' });
    }

    const hash = await bcrypt.hash(password, 10);
    await query(
      'UPDATE super_admins SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL WHERE admin_id = ?',
      [hash, rows[0].admin_id]
    );

    res.json({ message: 'Password reset successfully. You can now sign in.' });
  } catch (err) {
    logger.error('resetPassword error', { error: err.message });
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/auth/change-password
exports.changePassword = async (req, res) => {
  try {
    const { current_password, new_password } = req.body;

    if (!current_password) {
      return res.status(400).json({ message: 'Current password is required' });
    }
    if (!new_password || new_password.length < 8) {
      return res.status(400).json({ message: 'New password must be at least 8 characters' });
    }

    // Verify current password
    const rows = await query(
      'SELECT password_hash FROM super_admins WHERE admin_id = ?',
      [req.admin.admin_id]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Admin not found' });

    const isMatch = await bcrypt.compare(current_password, rows[0].password_hash);
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    const hash = await bcrypt.hash(new_password, 10);
    await query('UPDATE super_admins SET password_hash = ? WHERE admin_id = ?', [hash, req.admin.admin_id]);
    logAction(req.admin?.admin_id, 'CHANGE_PASSWORD', 'super_admin', req.admin?.admin_id, req.admin?.email, null, req.ip);
    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    logger.error('Change password error', { error: err.message });
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/auth/admins
exports.getAdmins = async (req, res) => {
  try {
    const rows = await query(
      'SELECT admin_id, name, email FROM super_admins WHERE is_active = 1 ORDER BY name'
    );
    res.json({ data: rows });
  } catch (err) {
    logger.error('getAdmins error', { error: err.message });
    res.status(500).json({ message: 'Server error' });
  }
};
