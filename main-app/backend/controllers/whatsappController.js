// =============================================================
// whatsappController.js - WhatsApp Invoice Sending via Meta Cloud API
// Manages WhatsApp settings, connection testing, and sending invoices
// via WhatsApp Business API (Meta Graph API v19.0).
// Used by: /api/whatsapp routes
// =============================================================

const https = require('https');
const { query } = require('../config/database');
const logger = require('../config/logger');
const { logAction } = require('../services/auditService');

// ----------------------------------------------------------------
// Internal helpers
// ----------------------------------------------------------------

/**
 * Ensure all WhatsApp-related columns exist in store_settings and
 * the whatsapp_logs table exists. Idempotent — safe to call on every request.
 */
let _schemaDone = false;
async function ensureWhatsAppSchema() {
  if (_schemaDone) return;
  _schemaDone = true;
  const alters = [
    `ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS whatsapp_enabled TINYINT(1) DEFAULT 0`,
    `ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS whatsapp_phone_number_id VARCHAR(100) NULL`,
    `ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS whatsapp_access_token TEXT NULL`,
    `ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS whatsapp_template_name VARCHAR(100) NULL`,
  ];
  for (const sql of alters) {
    try { await query(sql); } catch (e) {
      if (!e.message?.includes('Duplicate column') && !e.message?.includes('already exists')) {
        logger.warn('[whatsappController] schema alter warning:', e.message);
      }
    }
  }

  try {
    await query(`
      CREATE TABLE IF NOT EXISTS whatsapp_logs (
        log_id     INT PRIMARY KEY AUTO_INCREMENT,
        sale_id    INT NULL,
        phone      VARCHAR(30) NOT NULL,
        status     ENUM('sent','failed') NOT NULL,
        error_msg  TEXT NULL,
        sent_at    DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  } catch (e) {
    logger.warn('[whatsappController] whatsapp_logs table warning:', e.message);
  }
}

/**
 * Normalise a phone number to Pakistani international format (no + prefix).
 * Rules:
 *   - Strip all non-digit characters
 *   - Starts with 0  → replace leading 0 with 92
 *   - Starts with 92 → keep as-is
 *   - Otherwise      → prepend 92
 */
function normalisePhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('0'))  return '92' + digits.slice(1);
  if (digits.startsWith('92')) return digits;
  return '92' + digits;
}

/**
 * Generic HTTPS request helper (returns { statusCode, body }).
 * body is parsed as JSON when possible, otherwise returned as string.
 */
function httpsRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let raw = '';
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        let body;
        try { body = JSON.parse(raw); } catch { body = raw; }
        resolve({ statusCode: res.statusCode, body });
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Request timed out after 15 s')); });
    if (postData) req.write(postData);
    req.end();
  });
}

// ----------------------------------------------------------------
// Controller functions
// ----------------------------------------------------------------

/**
 * GET /api/whatsapp/settings
 * Returns WhatsApp settings from store_settings (access token masked).
 */
exports.getSettings = async (req, res) => {
  try {
    await ensureWhatsAppSchema();

    const rows = await query(
      `SELECT whatsapp_enabled, whatsapp_phone_number_id,
              whatsapp_access_token, whatsapp_template_name
       FROM store_settings WHERE setting_id = 1`
    );

    if (!rows.length) {
      return res.json({
        whatsapp_enabled: false,
        whatsapp_phone_number_id: '',
        whatsapp_access_token: '',
        whatsapp_template_name: '',
      });
    }

    const row = rows[0];

    // Mask access token: show first 3 and last 3 chars with *** in the middle
    let maskedToken = '';
    if (row.whatsapp_access_token) {
      const t = row.whatsapp_access_token;
      if (t.length > 6) {
        maskedToken = t.slice(0, 3) + '***...' + t.slice(-3);
      } else {
        maskedToken = '***';
      }
    }

    res.json({
      whatsapp_enabled:        !!row.whatsapp_enabled,
      whatsapp_phone_number_id: row.whatsapp_phone_number_id || '',
      whatsapp_access_token:    maskedToken,
      whatsapp_template_name:   row.whatsapp_template_name || '',
    });
  } catch (err) {
    logger.error('[whatsappController] getSettings error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * PUT /api/whatsapp/settings
 * Saves WhatsApp settings. Skips access_token update if the value is a masked placeholder.
 */
exports.saveSettings = async (req, res) => {
  try {
    await ensureWhatsAppSchema();

    const {
      whatsapp_enabled,
      whatsapp_phone_number_id,
      whatsapp_access_token,
      whatsapp_template_name,
    } = req.body;

    // Always update the non-sensitive fields
    await query(
      `UPDATE store_settings
          SET whatsapp_enabled = ?,
              whatsapp_phone_number_id = ?,
              whatsapp_template_name = ?
        WHERE setting_id = 1`,
      [
        whatsapp_enabled ? 1 : 0,
        whatsapp_phone_number_id || null,
        whatsapp_template_name || null,
      ]
    );

    // Only update access token if a real (non-masked) value was supplied
    if (whatsapp_access_token && !whatsapp_access_token.includes('***')) {
      await query(
        `UPDATE store_settings SET whatsapp_access_token = ? WHERE setting_id = 1`,
        [whatsapp_access_token]
      );
    }

    await logAction(
      req.user.user_id, req.user.name,
      'WHATSAPP_SETTINGS_UPDATED', 'store_settings', 1,
      { whatsapp_enabled, whatsapp_phone_number_id, whatsapp_template_name },
      req.ip
    );

    res.json({ message: 'WhatsApp settings saved successfully' });
  } catch (err) {
    logger.error('[whatsappController] saveSettings error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * POST /api/whatsapp/test
 * Verifies the stored phone number ID and access token against Meta Graph API.
 * Returns { ok, phone_number, verified_name } or { ok: false, message }.
 */
exports.testConnection = async (req, res) => {
  try {
    await ensureWhatsAppSchema();

    const rows = await query(
      `SELECT whatsapp_phone_number_id, whatsapp_access_token
         FROM store_settings WHERE setting_id = 1`
    );

    if (!rows.length || !rows[0].whatsapp_phone_number_id || !rows[0].whatsapp_access_token) {
      return res.status(400).json({ ok: false, message: 'WhatsApp phone number ID and access token are required. Save settings first.' });
    }

    const { whatsapp_phone_number_id: phoneNumberId, whatsapp_access_token: accessToken } = rows[0];

    const options = {
      hostname: 'graph.facebook.com',
      port: 443,
      path: `/v19.0/${encodeURIComponent(phoneNumberId)}?fields=display_phone_number,verified_name&access_token=${encodeURIComponent(accessToken)}`,
      method: 'GET',
    };

    const { statusCode, body } = await httpsRequest(options);

    if (statusCode === 200 && body && body.display_phone_number) {
      return res.json({
        ok: true,
        phone_number: body.display_phone_number,
        verified_name: body.verified_name || '',
      });
    }

    const errMsg = body?.error?.message || 'Unknown error from Meta API';
    logger.warn('[whatsappController] testConnection Meta API error:', body);
    res.status(400).json({ ok: false, message: errMsg });
  } catch (err) {
    logger.error('[whatsappController] testConnection error:', err);
    res.status(500).json({ ok: false, message: err.message || 'Connection test failed' });
  }
};

/**
 * POST /api/whatsapp/send-invoice
 * Body: { sale_id, phone }
 * Fetches sale data, builds a WhatsApp template message, sends it via Meta Cloud API,
 * and logs the result in whatsapp_logs.
 */
exports.sendInvoice = async (req, res) => {
  try {
    await ensureWhatsAppSchema();

    const { sale_id, phone } = req.body;

    if (!sale_id) return res.status(400).json({ message: 'sale_id is required' });
    if (!phone)   return res.status(400).json({ message: 'phone is required' });

    // --- 1. Fetch WhatsApp settings ---
    const settingsRows = await query(
      `SELECT whatsapp_enabled, whatsapp_phone_number_id,
              whatsapp_access_token, whatsapp_template_name
         FROM store_settings WHERE setting_id = 1`
    );

    if (!settingsRows.length) {
      return res.status(500).json({ message: 'Store settings not found' });
    }

    const settings = settingsRows[0];

    if (!settings.whatsapp_enabled) {
      return res.status(400).json({ message: 'WhatsApp is not enabled. Enable it in Settings.' });
    }
    if (!settings.whatsapp_phone_number_id || !settings.whatsapp_access_token || !settings.whatsapp_template_name) {
      return res.status(400).json({ message: 'WhatsApp is not fully configured. Set phone number ID, access token, and template name.' });
    }

    // --- 2. Fetch store name (for template parameters) ---
    let storeName = 'AByte POS';
    try {
      const storeRows = await query(`SELECT store_name FROM store_settings WHERE setting_id = 1`);
      if (storeRows.length) storeName = storeRows[0].store_name || storeName;
    } catch {}

    // --- 3. Fetch sale ---
    const saleRows = await query(
      `SELECT s.*, u.name AS cashier_name
         FROM sales s
         LEFT JOIN users u ON s.user_id = u.user_id
        WHERE s.sale_id = ?`,
      [sale_id]
    );

    if (!saleRows.length) {
      return res.status(404).json({ message: `Sale #${sale_id} not found` });
    }
    const sale = saleRows[0];

    // --- 4. Fetch sale items ---
    const saleItems = await query(
      `SELECT sd.*, p.product_name
         FROM sale_details sd
         LEFT JOIN products p ON sd.product_id = p.product_id
        WHERE sd.sale_id = ?`,
      [sale_id]
    );

    // --- 5. Build template parameters ---
    const invoiceNo  = sale.invoice_number || String(sale_id);
    const total      = parseFloat(sale.total_amount || 0).toFixed(2);
    const saleDate   = sale.created_at
      ? new Date(sale.created_at).toLocaleDateString('en-PK')
      : new Date().toLocaleDateString('en-PK');
    const itemCount  = String(saleItems.length);

    // --- 6. Normalise phone number ---
    const normalisedPhone = normalisePhone(phone);
    if (!normalisedPhone) {
      return res.status(400).json({ message: 'Invalid phone number' });
    }

    // --- 7. Build Meta Cloud API payload ---
    const payload = JSON.stringify({
      messaging_product: 'whatsapp',
      to: normalisedPhone,
      type: 'template',
      template: {
        name: settings.whatsapp_template_name,
        language: { code: 'en' },
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: storeName   },
              { type: 'text', text: invoiceNo   },
              { type: 'text', text: total        },
              { type: 'text', text: saleDate     },
              { type: 'text', text: itemCount    },
            ],
          },
        ],
      },
    });

    // --- 8. POST to Meta Graph API ---
    const postOptions = {
      hostname: 'graph.facebook.com',
      port: 443,
      path: `/v19.0/${encodeURIComponent(settings.whatsapp_phone_number_id)}/messages`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${settings.whatsapp_access_token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    };

    let sendStatus = 'failed';
    let errorMsg   = null;
    let apiResponse;

    try {
      const { statusCode, body } = await httpsRequest(postOptions, payload);
      apiResponse = body;

      if (statusCode >= 200 && statusCode < 300 && body?.messages?.length) {
        sendStatus = 'sent';
      } else {
        errorMsg = (body?.error?.message) || `HTTP ${statusCode}`;
        logger.warn('[whatsappController] sendInvoice Meta API error:', body);
      }
    } catch (apiErr) {
      errorMsg = apiErr.message;
      logger.error('[whatsappController] sendInvoice API call failed:', apiErr);
    }

    // --- 9. Log to whatsapp_logs ---
    try {
      await query(
        `INSERT INTO whatsapp_logs (sale_id, phone, status, error_msg, sent_at)
         VALUES (?, ?, ?, ?, NOW())`,
        [sale_id, normalisedPhone, sendStatus, errorMsg]
      );
    } catch (logErr) {
      logger.warn('[whatsappController] Failed to insert whatsapp_logs:', logErr.message);
    }

    // --- 10. Audit log ---
    await logAction(
      req.user.user_id, req.user.name,
      'WHATSAPP_INVOICE_SENT', 'sales', sale_id,
      { phone: normalisedPhone, status: sendStatus, invoice_no: invoiceNo },
      req.ip
    );

    if (sendStatus === 'sent') {
      return res.json({ ok: true, message: `WhatsApp invoice sent to ${normalisedPhone}` });
    }

    res.status(502).json({ ok: false, message: errorMsg || 'Failed to send WhatsApp message' });
  } catch (err) {
    logger.error('[whatsappController] sendInvoice error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};
