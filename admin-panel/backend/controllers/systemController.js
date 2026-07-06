const os     = require('os');
const { exec } = require('child_process');
const { query }  = require('../config/database');
const logger     = require('../config/logger');

const isWindows = os.platform() === 'win32';

// CPU % — platform-aware
function getCpuPercent() {
  if (!isWindows) {
    const load = os.loadavg()[0];
    const cores = os.cpus().length;
    return Promise.resolve(Math.min(Math.round((load / cores) * 100), 100));
  }
  return new Promise(resolve => {
    exec('wmic cpu get loadpercentage /value', (err, stdout) => {
      if (err) return resolve(0);
      const match = stdout.match(/LoadPercentage=(\d+)/i);
      resolve(match ? parseInt(match[1], 10) : 0);
    });
  });
}

// Disk — platform-aware (C: on Windows, / on Linux)
function getDisk() {
  if (!isWindows) {
    return new Promise(resolve => {
      exec("df -k / 2>/dev/null | tail -1 | awk '{print $2,$3}'", (err, stdout) => {
        if (err || !stdout.trim()) return resolve({ used_gb: 0, total_gb: 0, disk_percent: 0 });
        const [total, used] = stdout.trim().split(' ').map(Number);
        if (!total) return resolve({ used_gb: 0, total_gb: 0, disk_percent: 0 });
        resolve({
          total_gb:     +(total / 1024 / 1024).toFixed(1),
          used_gb:      +(used  / 1024 / 1024).toFixed(1),
          disk_percent: Math.round((used / total) * 100),
        });
      });
    });
  }
  return new Promise(resolve => {
    exec('wmic logicaldisk where "DeviceID=\'C:\'" get size,freespace /value', (err, stdout) => {
      if (err) return resolve({ used_gb: 0, total_gb: 0, disk_percent: 0 });
      const freeMatch  = stdout.match(/FreeSpace=(\d+)/i);
      const sizeMatch  = stdout.match(/Size=(\d+)/i);
      if (!freeMatch || !sizeMatch) return resolve({ used_gb: 0, total_gb: 0, disk_percent: 0 });
      const total = parseInt(sizeMatch[1], 10);
      const free  = parseInt(freeMatch[1], 10);
      const used  = total - free;
      resolve({
        total_gb:     +(total / 1024 / 1024 / 1024).toFixed(1),
        used_gb:      +(used  / 1024 / 1024 / 1024).toFixed(1),
        disk_percent: Math.round((used / total) * 100),
      });
    });
  });
}

exports.getHealth = async (req, res) => {
  try {
    const totalMem   = os.totalmem();
    const freeMem    = os.freemem();
    const usedMem    = totalMem - freeMem;
    const ramPercent = Math.round((usedMem / totalMem) * 100);

    const [cpuPercent, disk] = await Promise.all([getCpuPercent(), getDisk()]);

    let dbConnections = 0;
    try {
      const rows = await query("SHOW STATUS LIKE 'Threads_connected'");
      dbConnections = parseInt(rows[0]?.Value || '0', 10);
    } catch (e) {
      logger.warn('Could not fetch DB connections', { error: e.message });
    }

    const [{ active_tenants }] = await query(
      `SELECT COUNT(*) AS active_tenants FROM tenants WHERE is_active = 1`
    );
    const [{ open_tickets }] = await query(
      `SELECT COUNT(*) AS open_tickets FROM support_tickets WHERE status IN ('open','in_progress')`
    );
    const [{ unpaid_amount }] = await query(
      `SELECT COALESCE(SUM(amount), 0) AS unpaid_amount FROM invoices WHERE status != 'paid'`
    );

    res.json({
      cpu_percent:  cpuPercent,
      ram_percent:  ramPercent,
      ram_used_gb:  +(usedMem  / 1024 / 1024 / 1024).toFixed(1),
      ram_total_gb: +(totalMem / 1024 / 1024 / 1024).toFixed(1),
      disk_percent: disk.disk_percent,
      disk_used_gb: disk.used_gb,
      disk_total_gb: disk.total_gb,
      db_connections: dbConnections,
      uptime_hours: +(os.uptime() / 3600).toFixed(2),
      platform:     os.platform(),
      node_version: process.version,
      active_tenants,
      open_tickets,
      unpaid_amount,
    });
  } catch (err) {
    logger.error('systemHealth error', { error: err.message });
    res.status(500).json({ message: 'Server error' });
  }
};
