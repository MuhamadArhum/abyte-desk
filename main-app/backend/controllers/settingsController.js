const { query } = require('../config/database');
const logger = require('../config/logger');
const { logAction } = require('../services/auditService');
const bcrypt = require('bcryptjs');
const net = require('net');
const https = require('https');
const http = require('http');

// --- Get Store Settings ---
exports.getSettings = async (req, res) => {
  try {
    // Ensure payment-method tax columns exist (idempotent)
    await query(`ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS tax_on_cash DECIMAL(5,2) DEFAULT 16`).catch(() => {});
    await query(`ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS tax_on_card DECIMAL(5,2) DEFAULT 5`).catch(() => {});
    await query(`ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS tax_on_online DECIMAL(5,2) DEFAULT 5`).catch(() => {});

    const rows = await query('SELECT * FROM store_settings WHERE setting_id = 1');
    if (rows.length === 0) {
      return res.json({
        store_name: 'AByte ERP',
        address: '', phone: '', receipt_footer: 'Thank you!',
        tax_rate: 0, tax_on_cash: 0, tax_on_card: 0, tax_on_online: 0,
        pos_mode: 'simple', pos_tax_config: null,
      });
    }
    const row = rows[0];

    // Fill NULL tax columns with their intended defaults
    if (row.tax_on_cash  == null) row.tax_on_cash  = parseFloat(row.tax_rate || 0);
    if (row.tax_on_card  == null) row.tax_on_card  = parseFloat(row.tax_rate || 0);
    if (row.tax_on_online== null) row.tax_on_online= parseFloat(row.tax_rate || 0);
    if (row.pos_mode     == null) row.pos_mode     = 'simple';

    // Parse pos_tax_config JSON
    if (row.pos_tax_config && typeof row.pos_tax_config === 'string') {
      try { row.pos_tax_config = JSON.parse(row.pos_tax_config); } catch { row.pos_tax_config = null; }
    }
    res.json(row);
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// --- Update Store Settings (all fields) ---
exports.updateSettings = async (req, res) => {
  try {
    const {
      store_name, address, phone, email, website,
      receipt_header, receipt_footer, receipt_logo,
      tax_rate, currency_symbol,
      low_stock_threshold, default_payment_method, auto_print_receipt,
      barcode_prefix, invoice_prefix, date_format, timezone,
      business_hours_open, business_hours_close,
      allow_negative_stock, discount_requires_approval, max_cashier_discount,
      session_timeout_minutes,
      receipt_show_store_name, receipt_show_address, receipt_show_phone, receipt_show_tax,
      receipt_paper_width,
      printer_type, printer_ip, printer_port, printer_name, printer_paper_width,
      view_completed_orders_password, refund_password, reports_password,
      jv_delete_password,
      default_delivery_charges,
      pos_mode, pos_tax_config
    } = req.body;

    // Build dynamic SET clause to handle optional columns gracefully
    const baseParams = [
      store_name, address, phone, email, website,
      receipt_header || null, receipt_footer, receipt_logo || null,
      tax_rate || 0, currency_symbol || 'Rs.',
      low_stock_threshold || 10, default_payment_method || 'cash', auto_print_receipt ? 1 : 0,
      barcode_prefix || '', invoice_prefix || 'INV-', date_format || 'DD/MM/YYYY', timezone || 'Asia/Karachi',
      business_hours_open || '09:00:00', business_hours_close || '21:00:00',
      allow_negative_stock ? 1 : 0, discount_requires_approval ? 1 : 0, max_cashier_discount || 50,
      session_timeout_minutes || 480,
      receipt_show_store_name !== false ? 1 : 0, receipt_show_address !== false ? 1 : 0,
      receipt_show_phone !== false ? 1 : 0, receipt_show_tax !== false ? 1 : 0,
      receipt_paper_width || '80mm',
      printer_type || 'none', printer_ip || null, printer_port || 9100, printer_name || null, printer_paper_width || 80
    ];

    await query(
      `UPDATE store_settings SET
        store_name=?, address=?, phone=?, email=?, website=?,
        receipt_header=?, receipt_footer=?, receipt_logo=?,
        tax_rate=?, currency_symbol=?,
        low_stock_threshold=?, default_payment_method=?, auto_print_receipt=?,
        barcode_prefix=?, invoice_prefix=?, date_format=?, timezone=?,
        business_hours_open=?, business_hours_close=?,
        allow_negative_stock=?, discount_requires_approval=?, max_cashier_discount=?,
        session_timeout_minutes=?,
        receipt_show_store_name=?, receipt_show_address=?, receipt_show_phone=?, receipt_show_tax=?,
        receipt_paper_width=?,
        printer_type=?, printer_ip=?, printer_port=?, printer_name=?, printer_paper_width=?
      WHERE setting_id=1`,
      baseParams
    );

    // Update POS security passwords separately (columns may not exist on older DBs)
    try {
      await query(
        `UPDATE store_settings SET
          view_completed_orders_password=?, refund_password=?, reports_password=?
        WHERE setting_id=1`,
        [view_completed_orders_password || null, refund_password || null, reports_password || null]
      );
    } catch (pwErr) {
      logger.warn('POS security password columns not found. Run migrate_pos_security.js');
    }

    // Update accounts security password
    try {
      await query(`ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS jv_delete_password VARCHAR(255) NULL`);
      await query(`UPDATE store_settings SET jv_delete_password=? WHERE setting_id=1`,
        [jv_delete_password || null]);
    } catch (jvErr) {
      logger.warn('jv_delete_password column error:', jvErr.message);
    }

    // Update default delivery charges (column may not exist on older DBs)
    try {
      await query(
        `UPDATE store_settings SET default_delivery_charges=? WHERE setting_id=1`,
        [parseFloat(default_delivery_charges) || 0]
      );
    } catch (dcErr) {
      logger.warn('default_delivery_charges column not found. Run migrate_delivery_charges_setting.js');
    }

    // Update POS mode and per-category tax configuration
    try {
      await query(`ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS pos_mode VARCHAR(10) DEFAULT 'simple'`);
      await query(`ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS pos_tax_config TEXT NULL`);
      await query(
        `UPDATE store_settings SET pos_mode=?, pos_tax_config=? WHERE setting_id=1`,
        [pos_mode || 'simple', pos_tax_config ? JSON.stringify(pos_tax_config) : null]
      );
    } catch (pmErr) {
      logger.warn('pos_mode/pos_tax_config column error:', pmErr.message);
    }

    // Update payment-method-specific tax rates
    try {
      const { tax_on_cash, tax_on_card, tax_on_online } = req.body;
      await query(`ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS tax_on_cash DECIMAL(5,2) DEFAULT 16`);
      await query(`ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS tax_on_card DECIMAL(5,2) DEFAULT 5`);
      await query(`ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS tax_on_online DECIMAL(5,2) DEFAULT 5`);
      await query(
        `UPDATE store_settings SET tax_on_cash=?, tax_on_card=?, tax_on_online=? WHERE setting_id=1`,
        [parseFloat(tax_on_cash) || 0, parseFloat(tax_on_card) || 0, parseFloat(tax_on_online) || 0]
      );
    } catch (txErr) {
      logger.warn('tax_on_cash/card/online column error:', txErr.message);
    }

    // Update printer agent URL and agent token
    try {
      const { printer_agent_url, agent_token } = req.body;
      await query(
        `UPDATE store_settings SET printer_agent_url=?, agent_token=? WHERE setting_id=1`,
        [printer_agent_url || null, agent_token || null]
      );
    } catch (paErr) {
      logger.warn('printer_agent_url/agent_token column error:', paErr.message);
    }

    await logAction(req.user.user_id, req.user.name, 'SETTINGS_UPDATED', 'settings', 1, { store_name }, req.ip);
    res.json({ message: 'Settings updated successfully' });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// --- Change Own Password ---
exports.changePassword = async (req, res) => {
  try {
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      return res.status(400).json({ message: 'Current password and new password are required' });
    }
    if (new_password.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters' });
    }

    // Verify current password
    const [user] = await query('SELECT password_hash FROM users WHERE user_id = ?', [req.user.user_id]);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const isMatch = await bcrypt.compare(current_password, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    // Hash and update
    const hashedPassword = await bcrypt.hash(new_password, 10);
    await query('UPDATE users SET password_hash = ? WHERE user_id = ?', [hashedPassword, req.user.user_id]);

    await logAction(req.user.user_id, req.user.name, 'PASSWORD_CHANGED', 'users', req.user.user_id, {}, req.ip);
    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// --- Print Receipt via configured printer ---
exports.printReceipt = async (req, res) => {
  try {
    // First try printers table (new multi-printer system)
    let printer = null;
    try {
      const printers = await query("SELECT * FROM printers WHERE purpose = 'receipt' AND is_active = 1 ORDER BY printer_id LIMIT 1");
      printer = printers[0] || null;
    } catch (_) { /* table may not exist yet */ }

    // Fallback to legacy store_settings
    if (!printer) {
      const rows = await query('SELECT printer_type, printer_ip, printer_port, printer_name, printer_paper_width FROM store_settings WHERE setting_id = 1');
      const s = rows[0];
      if (!s || s.printer_type === 'none') {
        return res.status(400).json({ message: 'No receipt printer configured. Go to Settings > Printers to add one.' });
      }
      printer = { type: s.printer_type, ip_address: s.printer_ip, port: s.printer_port || 9100, printer_share_name: s.printer_name, paper_width: s.printer_paper_width || 80 };
    }

    const { receiptData } = req.body;
    if (!receiptData) return res.status(400).json({ message: 'Receipt data is required' });

    const escposBuffer = buildEscPosReceipt(receiptData, printer.paper_width || 80);

    if (printer.type === 'network') {
      if (!printer.ip_address) return res.status(400).json({ message: 'Printer IP address not configured' });
      await sendToNetworkPrinter(printer.ip_address, printer.port || 9100, escposBuffer);
    } else if (printer.type === 'usb') {
      if (!printer.printer_share_name) return res.status(400).json({ message: 'USB printer name not configured' });
      await sendToUsbPrinter(printer.printer_share_name, escposBuffer);
    } else {
      return res.status(400).json({ message: 'Unknown printer type' });
    }

    res.json({ success: true, message: 'Receipt sent to printer' });
  } catch (err) {
    logger.error('Print error:', err);
    res.status(500).json({ message: err.message || 'Failed to print receipt' });
  }
};

// --- Proxy print request to Printer Agent running on cashier PC ---
exports.printViaAgent = async (req, res) => {
  try {
    const rows = await query('SELECT printer_agent_url FROM store_settings WHERE setting_id = 1');
    const agentUrl = (rows[0]?.printer_agent_url || '').trim();
    if (!agentUrl) {
      return res.status(400).json({ message: 'Printer Agent URL not configured. Go to Settings and set the Agent URL (e.g. http://192.168.1.10:3001).' });
    }

    const { type = 'invoice', receiptData, kotData } = req.body;
    const endpoint = type === 'kot' ? '/print/kot' : '/print/invoice';
    const payload  = type === 'kot' ? { kotData } : { receiptData };

    const targetUrl = agentUrl.replace(/\/$/, '') + endpoint;
    const body = JSON.stringify(payload);
    const urlObj = new URL(targetUrl);
    const lib = urlObj.protocol === 'https:' ? https : http;

    const result = await new Promise((resolve, reject) => {
      const options = {
        hostname: urlObj.hostname,
        port:     urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
        path:     urlObj.pathname,
        method:   'POST',
        headers:  { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
        timeout:  8000,
      };
      const req2 = lib.request(options, (r) => {
        let data = '';
        r.on('data', d => data += d);
        r.on('end', () => {
          try { resolve({ status: r.statusCode, body: JSON.parse(data) }); }
          catch { resolve({ status: r.statusCode, body: { error: data } }); }
        });
      });
      req2.on('timeout', () => { req2.destroy(); reject(new Error('Agent not reachable (timeout). Is it running?')); });
      req2.on('error', reject);
      req2.write(body);
      req2.end();
    });

    res.status(result.status).json(result.body);
  } catch (err) {
    logger.error('Agent proxy error:', err);
    res.status(500).json({ message: err.message || 'Failed to reach printer agent' });
  }
};

// --- Print invoice/quotation to thermal printer ---
exports.printThermalDocument = async (req, res) => {
  try {
    const { purpose, documentData } = req.body;
    if (!purpose || !documentData) return res.status(400).json({ message: 'Purpose and document data are required' });

    const printers = await query('SELECT * FROM printers WHERE purpose = ? AND is_active = 1 ORDER BY printer_id LIMIT 1', [purpose]);
    if (!printers[0]) return res.status(404).json({ message: `No ${purpose} printer configured. Add one in Settings > Printers.` });

    const printer = printers[0];
    const escposBuffer = buildEscPosDocument(documentData, printer.paper_width || 80, purpose);

    if (printer.type === 'network') {
      await sendToNetworkPrinter(printer.ip_address, printer.port || 9100, escposBuffer);
    } else {
      await sendToUsbPrinter(printer.printer_share_name, escposBuffer);
    }

    res.json({ success: true, message: `${purpose} sent to ${printer.name}` });
  } catch (err) {
    logger.error('Thermal doc print error:', err);
    res.status(500).json({ message: err.message || 'Failed to print' });
  }
};

// --- Check if printer exists for a purpose ---
exports.checkPrinter = async (req, res) => {
  try {
    const { purpose } = req.query;
    if (!purpose) return res.status(400).json({ message: 'Purpose required' });
    const printers = await query('SELECT printer_id, name, type, paper_width FROM printers WHERE purpose = ? AND is_active = 1 LIMIT 1', [purpose]);
    res.json({ available: printers.length > 0, printer: printers[0] || null });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// ===================== PRINTER CRUD =====================

// Migrate printers table to new schema on first use
let printerSchemaMigrated = false;
async function ensurePrinterSchema() {
  if (printerSchemaMigrated) return;
  printerSchemaMigrated = true;
  try {
    await query(`ALTER TABLE printers ADD COLUMN IF NOT EXISTS printer_type ENUM('invoice','kot') NOT NULL DEFAULT 'invoice'`);
    await query(`ALTER TABLE printers ADD COLUMN IF NOT EXISTS branch_id INT NULL`);
    await query(`ALTER TABLE printers ADD COLUMN IF NOT EXISTS is_master TINYINT(1) DEFAULT 0`);
    await query(`
      CREATE TABLE IF NOT EXISTS printer_category_mappings (
        id INT PRIMARY KEY AUTO_INCREMENT,
        printer_id INT NOT NULL,
        category_id INT NOT NULL,
        UNIQUE KEY uq_printer_cat (printer_id, category_id),
        FOREIGN KEY (printer_id) REFERENCES printers(printer_id) ON DELETE CASCADE
      )
    `);
  } catch (e) { /* ignore — columns may already exist */ }
}

// --- Get all printers (with category mappings) ---
exports.getPrinters = async (req, res) => {
  try {
    await ensurePrinterSchema();
    const printers = await query(
      `SELECT p.*, s.store_name AS branch_name
       FROM printers p
       LEFT JOIN stores s ON p.branch_id = s.store_id
       ORDER BY p.printer_type, p.created_at`
    );
    // Attach category mappings
    const mappings = await query(`
      SELECT m.printer_id, m.category_id, c.category_name
      FROM printer_category_mappings m
      LEFT JOIN categories c ON m.category_id = c.category_id
    `).catch(() => []);

    const mappingMap = {};
    for (const row of mappings) {
      if (!mappingMap[row.printer_id]) mappingMap[row.printer_id] = [];
      mappingMap[row.printer_id].push({ category_id: row.category_id, category_name: row.category_name });
    }
    for (const p of printers) {
      p.categories = mappingMap[p.printer_id] || [];
    }
    res.json(printers);
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// --- Create printer ---
exports.createPrinter = async (req, res) => {
  try {
    await ensurePrinterSchema();
    const { name, type, ip_address, port, printer_share_name, paper_width, printer_type, branch_id, category_ids, is_master } = req.body;
    if (!name || !type) return res.status(400).json({ message: 'Name and type are required' });
    if (!['network', 'usb'].includes(type)) return res.status(400).json({ message: 'type must be network or usb' });
    const pType = ['invoice', 'kot'].includes(printer_type) ? printer_type : 'invoice';
    const masterFlag = pType === 'kot' && is_master ? 1 : 0;

    const result = await query(
      'INSERT INTO printers (name, type, ip_address, port, printer_share_name, paper_width, printer_type, branch_id, is_master, purpose, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)',
      [name, type, ip_address || null, port || 9100, printer_share_name || null, paper_width || 80, pType, branch_id || null, masterFlag, pType]
    );
    const printerId = result.insertId;

    // Save category mappings for KOT printers
    if (pType === 'kot' && Array.isArray(category_ids) && category_ids.length > 0) {
      for (const catId of category_ids) {
        await query('INSERT IGNORE INTO printer_category_mappings (printer_id, category_id) VALUES (?, ?)', [printerId, catId]);
      }
    }

    await logAction(req.user.user_id, req.user.name, 'PRINTER_ADDED', 'printers', printerId, { name, type, printer_type: pType }, req.ip);
    res.status(201).json({ message: 'Printer added successfully', printer_id: printerId });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// --- Update printer ---
exports.updatePrinter = async (req, res) => {
  try {
    await ensurePrinterSchema();
    const { id } = req.params;
    const { name, type, ip_address, port, printer_share_name, paper_width, printer_type, branch_id, is_active, category_ids, is_master } = req.body;
    const pType = ['invoice', 'kot'].includes(printer_type) ? printer_type : 'invoice';
    const masterFlag = pType === 'kot' && is_master ? 1 : 0;

    await query(
      'UPDATE printers SET name=?, type=?, ip_address=?, port=?, printer_share_name=?, paper_width=?, printer_type=?, branch_id=?, is_master=?, purpose=?, is_active=? WHERE printer_id=?',
      [name, type, ip_address || null, port || 9100, printer_share_name || null, paper_width || 80, pType, branch_id || null, masterFlag, pType, is_active ? 1 : 0, id]
    );

    // Replace category mappings
    await query('DELETE FROM printer_category_mappings WHERE printer_id = ?', [id]).catch(() => {});
    if (pType === 'kot' && Array.isArray(category_ids) && category_ids.length > 0) {
      for (const catId of category_ids) {
        await query('INSERT IGNORE INTO printer_category_mappings (printer_id, category_id) VALUES (?, ?)', [id, catId]);
      }
    }

    await logAction(req.user.user_id, req.user.name, 'PRINTER_UPDATED', 'printers', id, { name, type, printer_type: pType }, req.ip);
    res.json({ message: 'Printer updated successfully' });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// --- Delete printer ---
exports.deletePrinter = async (req, res) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM printer_category_mappings WHERE printer_id = ?', [id]).catch(() => {});
    await query('DELETE FROM printers WHERE printer_id = ?', [id]);
    await logAction(req.user.user_id, req.user.name, 'PRINTER_DELETED', 'printers', id, {}, req.ip);
    res.json({ message: 'Printer deleted successfully' });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// --- Test specific printer by ID ---
exports.testPrinterById = async (req, res) => {
  try {
    const { id } = req.params;
    const [printer] = await query('SELECT * FROM printers WHERE printer_id = ?', [id]);
    if (!printer) return res.status(404).json({ message: 'Printer not found' });

    const ESC = '\x1B'; const GS = '\x1D';
    const testData = Buffer.from(
      ESC + '@' + ESC + 'a\x01' + ESC + '!\x10' + ESC + 'E\x01' +
      'PRINTER TEST\n' + ESC + '!\x00' + ESC + 'E\x00' +
      printer.name + '\n' +
      'Role: ' + (printer.printer_type || printer.purpose || 'invoice').toUpperCase() + '\n' +
      'Connection: ' + printer.type.toUpperCase() + '\n' +
      'Connection OK!\n' + new Date().toLocaleString() + '\n\n\n' +
      GS + 'V\x01',
      'binary'
    );

    if (printer.type === 'network') {
      await sendToNetworkPrinter(printer.ip_address, printer.port || 9100, testData);
    } else {
      await sendToUsbPrinter(printer.printer_share_name, testData);
    }
    res.json({ success: true, message: `Test page sent to ${printer.name}` });
  } catch (err) {
    logger.error('Printer test error:', err);
    res.status(500).json({ message: `Test failed: ${err.message}` });
  }
};

// --- Test printer connection ---
exports.testPrinter = async (req, res) => {
  try {
    const { printer_type, printer_ip, printer_port, printer_name } = req.body;

    if (printer_type === 'network') {
      if (!printer_ip) return res.status(400).json({ message: 'IP address is required' });
      // Send a test page
      const ESC = '\x1B';
      const GS = '\x1D';
      const testData = Buffer.from(
        ESC + '@' +                              // Init
        ESC + 'a\x01' +                          // Center
        ESC + '!\x10' +                          // Double height
        'PRINTER TEST\n' +
        ESC + '!\x00' +                          // Normal
        'Connection OK!\n' +
        new Date().toLocaleString() + '\n' +
        '\n\n\n' +
        GS + 'V\x01',                           // Cut
        'binary'
      );
      await sendToNetworkPrinter(printer_ip, printer_port || 9100, testData);
      return res.json({ success: true, message: 'Test page sent successfully!' });
    }

    if (printer_type === 'usb') {
      if (!printer_name) return res.status(400).json({ message: 'Printer name is required' });
      const ESC = '\x1B';
      const GS = '\x1D';
      const testData = Buffer.from(
        ESC + '@' + ESC + 'a\x01' + ESC + '!\x10' +
        'PRINTER TEST\n' + ESC + '!\x00' +
        'USB Connection OK!\n' + new Date().toLocaleString() + '\n\n\n\n' +
        GS + 'V\x01',
        'binary'
      );
      await sendToUsbPrinter(printer_name, testData);
      return res.json({ success: true, message: 'Test page sent to USB printer!' });
    }

    return res.status(400).json({ message: 'Select a printer type first' });
  } catch (err) {
    logger.error('Printer test error:', err);
    res.status(500).json({ message: `Printer test failed: ${err.message}` });
  }
};

// Build ESC/POS receipt from structured data
function buildEscPosReceipt(data, paperWidth) {
  const width = paperWidth === 58 ? 32 : 42; // chars per line
  const ESC = '\x1B';
  const GS = '\x1D';

  let r = '';
  r += ESC + '@';                               // Init printer

  // Header - centered, bold, double height
  r += ESC + 'a\x01';                           // Center
  r += ESC + '!\x10';                           // Double height
  r += ESC + 'E\x01';                           // Bold on
  r += (data.storeName || 'AByte ERP') + '\n';
  r += ESC + '!\x00';                           // Normal size
  r += ESC + 'E\x00';                           // Bold off
  if (data.storeAddress) r += data.storeAddress + '\n';
  if (data.storePhone) r += 'Tel: ' + data.storePhone + '\n';
  if (data.storeEmail) r += data.storeEmail + '\n';
  r += '\n';

  // Receipt info - left aligned
  r += ESC + 'a\x00';                           // Left
  r += '='.repeat(width) + '\n';
  r += 'Receipt #: ' + (data.saleId || '') + '\n';
  r += 'Date: ' + (data.date || new Date().toLocaleString()) + '\n';
  r += 'Cashier: ' + (data.cashierName || '') + '\n';
  if (data.customerName) r += 'Customer: ' + data.customerName + '\n';
  r += '='.repeat(width) + '\n';

  // Column headers
  r += ESC + 'E\x01';
  r += padLine('Item', 'Amount', width) + '\n';
  r += ESC + 'E\x00';
  r += '-'.repeat(width) + '\n';

  // Items
  const cs = data.currencySymbol || 'Rs.';
  if (data.items && data.items.length > 0) {
    for (const item of data.items) {
      const name = item.name.length > (width - 2) ? item.name.substring(0, width - 5) + '...' : item.name;
      const lineTotal = (item.quantity * item.price).toFixed(2);
      r += name + '\n';
      r += `  ${item.quantity} x ${cs} ${item.price.toFixed(2)}`;
      const totalStr = `${cs} ${lineTotal}`;
      const spaces = width - `  ${item.quantity} x ${cs} ${item.price.toFixed(2)}`.length - totalStr.length;
      r += ' '.repeat(Math.max(1, spaces)) + totalStr + '\n';
    }
  }

  r += '-'.repeat(width) + '\n';

  // Totals
  if (data.discount > 0) r += padLine('Discount:', `-${cs} ${data.discount.toFixed(2)}`, width) + '\n';
  if (data.taxAmount > 0) r += padLine('Tax:', `${cs} ${data.taxAmount.toFixed(2)}`, width) + '\n';

  r += ESC + 'E\x01';
  r += padLine('TOTAL:', `${cs} ${(data.totalAmount || 0).toFixed(2)}`, width) + '\n';
  r += ESC + 'E\x00';
  r += padLine('Paid:', `${cs} ${(data.amountPaid || 0).toFixed(2)}`, width) + '\n';
  if (data.changeDue > 0) r += padLine('Change:', `${cs} ${data.changeDue.toFixed(2)}`, width) + '\n';
  r += padLine('Method:', (data.paymentMethod || '').toUpperCase(), width) + '\n';

  // Footer
  r += '\n';
  r += ESC + 'a\x01';                           // Center
  r += (data.footer || 'Thank you for shopping!') + '\n';
  r += '\n\n\n';
  r += GS + 'V\x01';                            // Paper cut

  return Buffer.from(r, 'binary');
}

// Build ESC/POS for invoice/quotation (simplified thermal format)
function buildEscPosDocument(data, paperWidth, docType) {
  const width = paperWidth === 58 ? 32 : 42;
  const ESC = '\x1B'; const GS = '\x1D';
  const cs = data.currencySymbol || 'Rs.';
  let r = '';
  r += ESC + '@';
  r += ESC + 'a\x01'; // Center
  r += ESC + '!\x10'; r += ESC + 'E\x01';
  r += (data.storeName || 'AByte ERP') + '\n';
  r += ESC + '!\x00'; r += ESC + 'E\x00';
  if (data.storeAddress) r += data.storeAddress + '\n';
  if (data.storePhone) r += 'Tel: ' + data.storePhone + '\n';
  r += '\n' + ESC + 'a\x00'; // Left
  r += '='.repeat(width) + '\n';
  r += ESC + 'E\x01';
  r += (docType === 'invoice' ? 'INVOICE' : 'QUOTATION') + '\n';
  r += ESC + 'E\x00';
  r += '#: ' + (data.number || '') + '\n';
  r += 'Date: ' + (data.date || new Date().toLocaleDateString()) + '\n';
  if (data.customerName) r += 'Customer: ' + data.customerName + '\n';
  r += '='.repeat(width) + '\n';
  r += ESC + 'E\x01';
  r += padLine('Item', 'Total', width) + '\n';
  r += ESC + 'E\x00';
  r += '-'.repeat(width) + '\n';
  if (data.items && data.items.length > 0) {
    for (const item of data.items) {
      const maxLen = width - 2;
      const rawName = item.name || item.description || 'Item';
      const name = rawName.length > maxLen ? rawName.substring(0, maxLen - 3) + '...' : rawName;
      r += name + '\n';
      const lineTotal = (Number(item.quantity) * Number(item.unit_price)).toFixed(2);
      const qtyPrice = `  ${item.quantity} x ${cs} ${Number(item.unit_price).toFixed(2)}`;
      const totalStr = `${cs} ${lineTotal}`;
      r += qtyPrice + ' '.repeat(Math.max(1, width - qtyPrice.length - totalStr.length)) + totalStr + '\n';
    }
  }
  r += '-'.repeat(width) + '\n';
  if (data.subtotal !== undefined) r += padLine('Subtotal:', `${cs} ${Number(data.subtotal).toFixed(2)}`, width) + '\n';
  if (Number(data.tax_amount) > 0) r += padLine('Tax:', `${cs} ${Number(data.tax_amount).toFixed(2)}`, width) + '\n';
  if (Number(data.discount) > 0) r += padLine('Discount:', `-${cs} ${Number(data.discount).toFixed(2)}`, width) + '\n';
  r += ESC + 'E\x01';
  r += padLine('TOTAL:', `${cs} ${Number(data.total_amount).toFixed(2)}`, width) + '\n';
  r += ESC + 'E\x00';
  r += '\n' + ESC + 'a\x01';
  r += 'Thank you!\n\n\n';
  r += GS + 'V\x01';
  return Buffer.from(r, 'binary');
}

function padLine(label, value, width) {
  const space = width - label.length - value.length;
  return label + ' '.repeat(Math.max(1, space)) + value;
}

// Send data to network thermal printer via TCP
function sendToNetworkPrinter(ip, port, data) {
  return new Promise((resolve, reject) => {
    const client = new net.Socket();
    const timeout = setTimeout(() => {
      client.destroy();
      reject(new Error(`Connection to ${ip}:${port} timed out`));
    }, 5000);

    client.connect(port, ip, () => {
      clearTimeout(timeout);
      client.write(data, () => {
        client.end();
        resolve();
      });
    });

    client.on('error', (err) => {
      clearTimeout(timeout);
      reject(new Error(`Cannot connect to printer at ${ip}:${port} - ${err.message}`));
    });
  });
}

// Send data to USB printer (Windows: writes via shared printer or LPT)
function sendToUsbPrinter(printerName, data) {
  return new Promise((resolve, reject) => {
    const fs = require('fs');
    const { execSync } = require('child_process');
    const path = require('path');
    const os = require('os');

    // Write to temp file then copy to printer
    const tmpFile = path.join(os.tmpdir(), `receipt_${Date.now()}.bin`);
    fs.writeFileSync(tmpFile, data);

    try {
      if (process.platform === 'win32') {
        // Windows: use "copy /b" to send raw data to printer share
        execSync(`copy /b "${tmpFile}" "${printerName}"`, { timeout: 10000 });
      } else {
        // Linux/Mac: use lp command
        execSync(`lp -d "${printerName}" -o raw "${tmpFile}"`, { timeout: 10000 });
      }
      fs.unlinkSync(tmpFile);
      resolve();
    } catch (err) {
      fs.unlinkSync(tmpFile);
      reject(new Error(`USB print failed: ${err.message}`));
    }
  });
}

// --- Get categories (for KOT printer mapping) ---
exports.getCategories = async (req, res) => {
  try {
    const categories = await query('SELECT category_id, category_name FROM categories WHERE is_active = 1 ORDER BY category_name');
    res.json({ data: categories });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// --- Get System Info ---
exports.getSystemInfo = async (req, res) => {
  try {
    const [userCount] = await query('SELECT COUNT(*) as total FROM users');
    const [productCount] = await query('SELECT COUNT(*) as total FROM products');
    const [orderCount] = await query('SELECT COUNT(*) as total FROM sales');
    const [customerCount] = await query('SELECT COUNT(*) as total FROM customers');

    res.json({
      users: userCount.total,
      products: productCount.total,
      orders: orderCount.total,
      customers: customerCount.total,
      node_version: process.version,
      platform: process.platform,
      uptime: Math.floor(process.uptime()),
      memory: Math.round(process.memoryUsage().heapUsed / 1024 / 1024)
    });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// --- Add Print Job to Queue ---
exports.addPrintJob = async (req, res) => {
  try {
    const { type = 'invoice', receiptData, kotData } = req.body;
    if (!receiptData && !kotData) {
      return res.status(400).json({ message: 'receiptData or kotData is required' });
    }
    const payload = JSON.stringify(receiptData ? { receiptData } : { kotData });
    const result = await query(
      'INSERT INTO print_queue (type, payload, status) VALUES (?, ?, ?)',
      [type, payload, 'pending']
    );
    res.json({ success: true, job_id: result.insertId });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// --- Get Pending Print Jobs (browser polls this) ---
exports.getPendingPrintJobs = async (req, res) => {
  try {
    const jobs = await query(
      `SELECT id, type, payload, created_at
       FROM print_queue
       WHERE status = 'pending'
       ORDER BY created_at ASC
       LIMIT 5`
    );

    if (jobs.length > 0) {
      const ids = jobs.map(j => j.id);
      await query(
        `UPDATE print_queue SET status = 'printing' WHERE id IN (${ids.map(() => '?').join(',')})`,
        ids
      );
    }

    const parsed = jobs.map(j => ({
      id:      j.id,
      type:    j.type,
      payload: typeof j.payload === 'string' ? JSON.parse(j.payload) : j.payload,
    }));

    res.json({ jobs: parsed });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// --- Update Print Job Status (browser reports result) ---
exports.updatePrintJobStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, error_message } = req.body;
    if (!['done', 'failed'].includes(status)) {
      return res.status(400).json({ message: 'status must be done or failed' });
    }
    await query(
      `UPDATE print_queue SET status = ?, error_message = ?, processed_at = NOW() WHERE id = ?`,
      [status, error_message || null, id]
    );
    res.json({ success: true });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};
