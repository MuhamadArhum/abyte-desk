// =============================================================
// biometricController.js — Biometric device, log upload & attendance processing
// =============================================================

const { query, getConnection } = require('../config/database');
const { logAction } = require('../services/auditService');
const logger = require('../config/logger');

// ─── Ensure tables exist at module load ──────────────────────────────────────

async function ensureTables() {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS biometric_devices (
        device_id     INT PRIMARY KEY AUTO_INCREMENT,
        device_name   VARCHAR(100) NOT NULL,
        ip_address    VARCHAR(45)  NOT NULL,
        port          INT          DEFAULT 80,
        serial_number VARCHAR(100) NULL,
        model         VARCHAR(100) NULL,
        last_sync     DATETIME     NULL,
        is_active     TINYINT(1)   DEFAULT 1,
        created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS biometric_logs (
        log_id        INT PRIMARY KEY AUTO_INCREMENT,
        device_id     INT          NULL,
        employee_code VARCHAR(50)  NOT NULL,
        punch_time    DATETIME     NOT NULL,
        punch_type    ENUM('in','out','auto') DEFAULT 'auto',
        raw_data      TEXT         NULL,
        processed     TINYINT(1)   DEFAULT 0,
        attendance_id INT          NULL,
        created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_bio_employee (employee_code),
        INDEX idx_bio_punch (punch_time),
        INDEX idx_bio_processed (processed),
        UNIQUE KEY unique_punch (employee_code, punch_time)
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS biometric_staff_mapping (
        mapping_id    INT PRIMARY KEY AUTO_INCREMENT,
        employee_code VARCHAR(50)  NOT NULL UNIQUE,
        staff_id      INT          NOT NULL,
        created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
      )
    `);
  } catch (err) {
    logger.warn('[Biometric] ensureTables failed', { error: err.message });
  }
}

ensureTables();

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Normalize a datetime string from ZKTeco or CSV.
 * Accepts: 'YYYY-MM-DD HH:MM:SS', 'YYYY/MM/DD HH:MM:SS'
 * Returns a MySQL-compatible 'YYYY-MM-DD HH:MM:SS' string or null.
 */
function normalizeDateTime(raw) {
  if (!raw) return null;
  const s = raw.trim().replace(/\//g, '-');
  // Basic validation: must look like a datetime
  if (!/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?/.test(s)) return null;
  // Ensure seconds are present
  const parts = s.split(/[ T]/);
  const datePart = parts[0];
  let timePart = parts[1] || '00:00:00';
  if (timePart.split(':').length === 2) timePart += ':00';
  return `${datePart} ${timePart}`;
}

/**
 * Parse CSV/TSV buffer to array of { employee_code, punch_time }.
 * Supports:
 *   1. Tab-separated (ZKTeco raw): employee_code\tYYYY-MM-DD HH:MM:SS
 *   2. Comma-separated with optional header row
 */
function parseBiometricCsv(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
  const records = [];

  const HEADER_MARKERS = ['no.', 'name', 'id', 'employee', 'emp', 'date', 'time', 'punch'];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const isTabLine = line.includes('\t');
    const cols = isTabLine ? line.split('\t') : line.split(',');

    if (cols.length < 2) continue;

    const firstColLower = cols[0].trim().toLowerCase();

    // Skip header rows
    if (HEADER_MARKERS.some(m => firstColLower.startsWith(m))) continue;

    // Also skip if first col is purely alphabetic (header label)
    if (/^[a-z ._#/-]+$/i.test(cols[0].trim()) && isNaN(Number(cols[0].trim()))) continue;

    const employee_code = cols[0].trim();
    // For tab format: col[1] is full datetime
    // For CSV format: col[1] may be date, col[2] may be time — combine if needed
    let datetimeRaw = cols[1] ? cols[1].trim() : '';

    if (!isTabLine && cols.length >= 3) {
      // Check if col[1] looks like a date-only and col[2] looks like time
      const col1 = cols[1].trim();
      const col2 = cols[2] ? cols[2].trim() : '';
      if (/^\d{4}[-/]\d{2}[-/]\d{2}$/.test(col1) && /^\d{2}:\d{2}/.test(col2)) {
        datetimeRaw = `${col1} ${col2}`;
      }
    }

    const punch_time = normalizeDateTime(datetimeRaw);
    if (!employee_code || !punch_time) continue;

    records.push({ employee_code, punch_time, raw_data: line });
  }

  return records;
}

// ─── Device Management ────────────────────────────────────────────────────────

exports.getDevices = async (req, res) => {
  try {
    const devices = await query(
      `SELECT * FROM biometric_devices ORDER BY device_name`
    );
    res.json({ data: devices });
  } catch (err) {
    logger.error('[Biometric] getDevices error', { error: err.message });
    res.status(500).json({ message: 'Server error' });
  }
};

exports.createDevice = async (req, res) => {
  try {
    const { device_name, ip_address, port = 80, serial_number, model } = req.body;
    if (!device_name || !ip_address) {
      return res.status(400).json({ message: 'device_name and ip_address are required' });
    }

    const result = await query(
      `INSERT INTO biometric_devices (device_name, ip_address, port, serial_number, model)
       VALUES (?, ?, ?, ?, ?)`,
      [device_name, ip_address, port, serial_number || null, model || null]
    );

    const [device] = await query(
      `SELECT * FROM biometric_devices WHERE device_id = ?`,
      [result.insertId]
    );

    await logAction(
      req.user?.user_id, req.user?.username, 'CREATE', 'biometric_device',
      result.insertId, { device_name, ip_address }, req.ip
    );

    res.status(201).json({ message: 'Device created', device });
  } catch (err) {
    logger.error('[Biometric] createDevice error', { error: err.message });
    res.status(500).json({ message: 'Server error' });
  }
};

exports.updateDevice = async (req, res) => {
  try {
    const { id } = req.params;
    const { device_name, ip_address, port, serial_number, model, is_active } = req.body;

    await query(
      `UPDATE biometric_devices
       SET device_name = COALESCE(?, device_name),
           ip_address  = COALESCE(?, ip_address),
           port        = COALESCE(?, port),
           serial_number = COALESCE(?, serial_number),
           model       = COALESCE(?, model),
           is_active   = COALESCE(?, is_active)
       WHERE device_id = ?`,
      [device_name, ip_address, port, serial_number, model, is_active, id]
    );

    const [device] = await query(
      `SELECT * FROM biometric_devices WHERE device_id = ?`,
      [id]
    );

    if (!device) return res.status(404).json({ message: 'Device not found' });

    await logAction(
      req.user?.user_id, req.user?.username, 'UPDATE', 'biometric_device',
      id, req.body, req.ip
    );

    res.json({ message: 'Device updated', device });
  } catch (err) {
    logger.error('[Biometric] updateDevice error', { error: err.message });
    res.status(500).json({ message: 'Server error' });
  }
};

exports.deleteDevice = async (req, res) => {
  try {
    const { id } = req.params;

    const [device] = await query(
      `SELECT * FROM biometric_devices WHERE device_id = ?`,
      [id]
    );
    if (!device) return res.status(404).json({ message: 'Device not found' });

    await query(`DELETE FROM biometric_devices WHERE device_id = ?`, [id]);

    await logAction(
      req.user?.user_id, req.user?.username, 'DELETE', 'biometric_device',
      id, { device_name: device.device_name }, req.ip
    );

    res.json({ message: 'Device deleted' });
  } catch (err) {
    logger.error('[Biometric] deleteDevice error', { error: err.message });
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Staff Code Mapping ───────────────────────────────────────────────────────

exports.getMappings = async (req, res) => {
  try {
    const mappings = await query(
      `SELECT bsm.*, s.full_name AS staff_name
       FROM biometric_staff_mapping bsm
       JOIN staff s ON bsm.staff_id = s.staff_id
       ORDER BY bsm.employee_code`
    );
    res.json({ data: mappings });
  } catch (err) {
    logger.error('[Biometric] getMappings error', { error: err.message });
    res.status(500).json({ message: 'Server error' });
  }
};

exports.saveMapping = async (req, res) => {
  try {
    const { employee_code, staff_id } = req.body;
    if (!employee_code || !staff_id) {
      return res.status(400).json({ message: 'employee_code and staff_id are required' });
    }

    await query(
      `INSERT INTO biometric_staff_mapping (employee_code, staff_id)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE staff_id = VALUES(staff_id)`,
      [employee_code, staff_id]
    );

    const [mapping] = await query(
      `SELECT bsm.*, s.full_name AS staff_name
       FROM biometric_staff_mapping bsm
       JOIN staff s ON bsm.staff_id = s.staff_id
       WHERE bsm.employee_code = ?`,
      [employee_code]
    );

    await logAction(
      req.user?.user_id, req.user?.username, 'UPSERT', 'biometric_staff_mapping',
      employee_code, { employee_code, staff_id }, req.ip
    );

    res.json({ message: 'Mapping saved', mapping });
  } catch (err) {
    logger.error('[Biometric] saveMapping error', { error: err.message });
    res.status(500).json({ message: 'Server error' });
  }
};

exports.deleteMapping = async (req, res) => {
  try {
    const { code } = req.params;

    const [mapping] = await query(
      `SELECT * FROM biometric_staff_mapping WHERE employee_code = ?`,
      [code]
    );
    if (!mapping) return res.status(404).json({ message: 'Mapping not found' });

    await query(
      `DELETE FROM biometric_staff_mapping WHERE employee_code = ?`,
      [code]
    );

    await logAction(
      req.user?.user_id, req.user?.username, 'DELETE', 'biometric_staff_mapping',
      code, { employee_code: code }, req.ip
    );

    res.json({ message: 'Mapping deleted' });
  } catch (err) {
    logger.error('[Biometric] deleteMapping error', { error: err.message });
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Log Upload (CSV) ─────────────────────────────────────────────────────────

exports.uploadLogs = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded. Use multipart field name "file".' });
    }

    const text = req.file.buffer.toString('utf8');
    const records = parseBiometricCsv(text);

    if (records.length === 0) {
      return res.status(400).json({ message: 'No valid records found in file', total: 0, inserted: 0, skipped: 0 });
    }

    const device_id = req.body.device_id ? parseInt(req.body.device_id, 10) : null;

    let inserted = 0;
    let skipped = 0;

    for (const rec of records) {
      try {
        const result = await query(
          `INSERT IGNORE INTO biometric_logs (device_id, employee_code, punch_time, punch_type, raw_data)
           VALUES (?, ?, ?, 'auto', ?)`,
          [device_id, rec.employee_code, rec.punch_time, rec.raw_data]
        );
        if (result.affectedRows > 0) {
          inserted++;
        } else {
          skipped++;
        }
      } catch (rowErr) {
        logger.warn('[Biometric] uploadLogs row insert error', { error: rowErr.message, rec });
        skipped++;
      }
    }

    await logAction(
      req.user?.user_id, req.user?.username, 'UPLOAD', 'biometric_logs',
      null, { total: records.length, inserted, skipped }, req.ip
    );

    res.json({ message: 'Upload complete', total: records.length, inserted, skipped });
  } catch (err) {
    logger.error('[Biometric] uploadLogs error', { error: err.message });
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Log Retrieval ────────────────────────────────────────────────────────────

exports.getLogs = async (req, res) => {
  try {
    const {
      processed,
      date_from,
      date_to,
      employee_code,
      page = 1,
      limit = 50,
    } = req.query;

    const conditions = [];
    const params = [];

    if (processed !== undefined && processed !== '') {
      conditions.push('bl.processed = ?');
      params.push(parseInt(processed, 10));
    }
    if (date_from) {
      conditions.push('DATE(bl.punch_time) >= ?');
      params.push(date_from);
    }
    if (date_to) {
      conditions.push('DATE(bl.punch_time) <= ?');
      params.push(date_to);
    }
    if (employee_code) {
      conditions.push('bl.employee_code = ?');
      params.push(employee_code);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const [{ total }] = await query(
      `SELECT COUNT(*) AS total FROM biometric_logs bl ${where}`,
      params
    );

    const logs = await query(
      `SELECT bl.*, bsm.staff_id, s.full_name AS staff_name
       FROM biometric_logs bl
       LEFT JOIN biometric_staff_mapping bsm ON bl.employee_code = bsm.employee_code
       LEFT JOIN staff s ON bsm.staff_id = s.staff_id
       ${where}
       ORDER BY bl.punch_time DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit, 10), offset]
    );

    res.json({ data: logs, total, page: parseInt(page, 10), limit: parseInt(limit, 10) });
  } catch (err) {
    logger.error('[Biometric] getLogs error', { error: err.message });
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Log Processing → Attendance ──────────────────────────────────────────────

exports.processLogs = async (req, res) => {
  try {
    const { date_from, date_to } = req.body;
    if (!date_from || !date_to) {
      return res.status(400).json({ message: 'date_from and date_to are required' });
    }

    // 1. Fetch all unprocessed logs in range that have a staff mapping
    const logs = await query(
      `SELECT bl.log_id, bl.employee_code, bl.punch_time,
              bsm.staff_id
       FROM biometric_logs bl
       INNER JOIN biometric_staff_mapping bsm ON bl.employee_code = bsm.employee_code
       WHERE bl.processed = 0
         AND DATE(bl.punch_time) >= ?
         AND DATE(bl.punch_time) <= ?
       ORDER BY bl.punch_time ASC`,
      [date_from, date_to]
    );

    // Count logs without mapping (for reporting)
    const [{ skipped_no_mapping }] = await query(
      `SELECT COUNT(*) AS skipped_no_mapping
       FROM biometric_logs bl
       LEFT JOIN biometric_staff_mapping bsm ON bl.employee_code = bsm.employee_code
       WHERE bl.processed = 0
         AND DATE(bl.punch_time) >= ?
         AND DATE(bl.punch_time) <= ?
         AND bsm.staff_id IS NULL`,
      [date_from, date_to]
    );

    if (logs.length === 0) {
      return res.json({
        message: 'No unprocessed logs found in range',
        processed_count: 0,
        attendance_created: 0,
        attendance_updated: 0,
        skipped: parseInt(skipped_no_mapping, 10) || 0,
      });
    }

    // 2. Group by (employee_code, date)
    const groups = new Map(); // key: `${employee_code}|${date}` → { staff_id, punches: [] }

    for (const log of logs) {
      const dateStr = log.punch_time.toISOString
        ? log.punch_time.toISOString().slice(0, 10)
        : String(log.punch_time).slice(0, 10);
      const key = `${log.employee_code}|${dateStr}`;

      if (!groups.has(key)) {
        groups.set(key, { staff_id: log.staff_id, date: dateStr, punches: [], log_ids: [] });
      }
      const group = groups.get(key);
      group.punches.push(log.punch_time);
      group.log_ids.push(log.log_id);
    }

    // 3. For each group: determine check_in / check_out, upsert attendance
    let attendance_created = 0;
    let attendance_updated = 0;
    const processedLogIds = [];

    for (const [, group] of groups) {
      const sorted = [...group.punches].sort();
      const firstPunch = sorted[0];
      const lastPunch = sorted[sorted.length - 1];

      // Extract TIME portion
      const toTime = (dt) => {
        const s = dt.toISOString
          ? dt.toISOString().slice(11, 19)   // 'HH:MM:SS' from ISO
          : String(dt).slice(11, 19);
        return s;
      };

      const check_in = toTime(firstPunch);
      const check_out = sorted.length > 1 ? toTime(lastPunch) : null;

      // 4. Upsert attendance (staff_id, attendance_date UNIQUE)
      const result = await query(
        `INSERT INTO attendance (staff_id, attendance_date, check_in, check_out, status, notes)
         VALUES (?, ?, ?, ?, 'present', 'Biometric')
         ON DUPLICATE KEY UPDATE
           check_in   = VALUES(check_in),
           check_out  = VALUES(check_out),
           status     = 'present',
           notes      = 'Biometric'`,
        [group.staff_id, group.date, check_in, check_out]
      );

      if (result.insertId && result.affectedRows === 1) {
        attendance_created++;
      } else {
        attendance_updated++;
      }

      processedLogIds.push(...group.log_ids);
    }

    // 5. Mark logs as processed in batches
    if (processedLogIds.length > 0) {
      const placeholders = processedLogIds.map(() => '?').join(',');
      await query(
        `UPDATE biometric_logs SET processed = 1 WHERE log_id IN (${placeholders})`,
        processedLogIds
      );
    }

    await logAction(
      req.user?.user_id, req.user?.username, 'PROCESS', 'biometric_logs',
      null,
      {
        date_from, date_to,
        processed_count: processedLogIds.length,
        attendance_created,
        attendance_updated,
      },
      req.ip
    );

    res.json({
      message: 'Processing complete',
      processed_count: processedLogIds.length,
      attendance_created,
      attendance_updated,
      skipped: parseInt(skipped_no_mapping, 10) || 0,
    });
  } catch (err) {
    logger.error('[Biometric] processLogs error', { error: err.message });
    res.status(500).json({ message: 'Server error' });
  }
};
