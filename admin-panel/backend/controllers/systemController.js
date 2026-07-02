const os     = require('os');
const { exec } = require('child_process');
const { query }  = require('../config/database');
const logger     = require('../config/logger');

exports.getHealth = async (req, res) => {
  try {
    // ── RAM ──────────────────────────────────────────────────
    const totalMem = os.totalmem();
    const freeMem  = os.freemem();
    const usedMem  = totalMem - freeMem;

    // ── CPU (1-min load avg normalised to %) ─────────────────
    const loadAvg    = os.loadavg()[0];
    const cpuCount   = os.cpus().length;
    const cpuPercent = Math.min(Math.round((loadAvg / cpuCount) * 100), 100);

    // ── Disk via df ──────────────────────────────────────────
    let disk = { used_gb: 0, total_gb: 0, percent: 0 };
    await new Promise(resolve => {
      exec("df -k / 2>/dev/null | tail -1 | awk '{print $2,$3}'", (err, stdout) => {
        if (!err && stdout.trim()) {
          const [total, used] = stdout.trim().split(' ').map(Number);
          if (total > 0) {
            disk = {
              total_gb: +(total / 1024 / 1024).toFixed(1),
              used_gb:  +(used  / 1024 / 1024).toFixed(1),
              percent:  Math.round((used / total) * 100),
            };
          }
        }
        resolve(null);
      });
    });

    // ── DB connections ───────────────────────────────────────
    let dbConnections = 0;
    try {
      const rows = await query("SHOW STATUS LIKE 'Threads_connected'");
      dbConnections = parseInt(rows[0]?.Value || '0', 10);
    } catch {}

    // ── Tenant counts ────────────────────────────────────────
    const [{ active_tenants }] = await query(
      `SELECT COUNT(*) AS active_tenants FROM tenants WHERE is_active = 1`
    );

    // ── Open tickets & unread ────────────────────────────────
    const [{ open_tickets }] = await query(
      `SELECT COUNT(*) AS open_tickets FROM support_tickets WHERE status IN ('open','in_progress')`
    );

    // ── Unpaid invoice total ─────────────────────────────────
    const [{ unpaid_amount }] = await query(
      `SELECT COALESCE(SUM(amount), 0) AS unpaid_amount FROM invoices WHERE status != 'paid'`
    );

    res.json({
      cpu: {
        percent: cpuPercent,
        load_1m: +loadAvg.toFixed(2),
        cores:   cpuCount,
      },
      ram: {
        total_mb: Math.round(totalMem / 1024 / 1024),
        used_mb:  Math.round(usedMem  / 1024 / 1024),
        free_mb:  Math.round(freeMem  / 1024 / 1024),
        percent:  Math.round((usedMem / totalMem) * 100),
      },
      disk,
      db_connections: dbConnections,
      uptime_hours:   Math.round(os.uptime() / 3600),
      node_version:   process.version,
      platform:       os.platform(),
      active_tenants,
      open_tickets,
      unpaid_amount,
    });
  } catch (err) {
    logger.error('systemHealth error', { error: err.message });
    res.status(500).json({ message: 'Server error' });
  }
};
