// =============================================================
// agentController.js — Printer Agent polling endpoints
//
// No JWT required. Auth uses:
//   X-Tenant-Code: tenant_code (e.g. "khayyam")
//   X-Agent-Token: token stored in store_settings.agent_token
//
// Flow:
//   Agent polls GET /api/agent/print-queue/pending every 3s
//   Backend returns pending jobs (marks them 'printing')
//   Agent prints, then PATCH /api/agent/print-queue/:id → done|failed
// =============================================================

const crypto         = require('crypto');
const { queryDb, getPool } = require('../config/database');
const { masterQuery } = require('../config/masterDatabase');
const logger         = require('../config/logger');

async function resolveAndAuth(req, res) {
  const tenantCode = req.headers['x-tenant-code'];
  const agentToken = req.headers['x-agent-token'];

  if (!tenantCode || !agentToken) {
    res.status(401).json({ message: 'X-Tenant-Code and X-Agent-Token headers required' });
    return null;
  }

  // Look up tenant DB name from master
  const tenants = await masterQuery(
    'SELECT db_name FROM tenants WHERE tenant_code = ? AND is_active = 1',
    [tenantCode]
  );
  if (!tenants || tenants.length === 0) {
    res.status(401).json({ message: 'Tenant not found or inactive' });
    return null;
  }

  const tenantDb = tenants[0].db_name;

  // Validate agent_token
  const settings = await queryDb(tenantDb, 'SELECT agent_token FROM store_settings WHERE setting_id = 1');
  const stored = settings && settings[0] ? settings[0].agent_token : null;

  if (!stored) {
    res.status(401).json({ message: 'Invalid agent token' });
    return null;
  }
  const storedBuf = Buffer.from(stored, 'utf8');
  const tokenBuf  = Buffer.from(agentToken, 'utf8');
  if (storedBuf.length !== tokenBuf.length ||
      !crypto.timingSafeEqual(storedBuf, tokenBuf)) {
    res.status(401).json({ message: 'Invalid agent token' });
    return null;
  }

  return tenantDb;
}

// GET /api/agent/print-queue/pending
exports.getPendingJobs = async (req, res) => {
  try {
    const tenantDb = await resolveAndAuth(req, res);
    if (!tenantDb) return;

    // Fetch and lock pending jobs atomically to prevent duplicate delivery
    const conn = await getPool(tenantDb).getConnection();
    let jobs = [];
    try {
      await conn.beginTransaction();
      jobs = await conn.query(
        `SELECT id, type, payload, created_at FROM print_queue WHERE status = 'pending' ORDER BY created_at ASC LIMIT 5 FOR UPDATE`
      );
      if (jobs.length > 0) {
        const ids = jobs.map(j => j.id);
        await conn.query(
          `UPDATE print_queue SET status = 'printing' WHERE id IN (${ids.map(() => '?').join(',')})`,
          ids
        );
      }
      await conn.commit();
    } catch (txErr) {
      await conn.rollback();
      throw txErr;
    } finally {
      conn.release();
    }

    // Parse payload JSON
    const parsed = jobs.map(j => ({
      id:         j.id,
      type:       j.type,
      payload:    typeof j.payload === 'string' ? JSON.parse(j.payload) : j.payload,
      created_at: j.created_at,
    }));

    res.json({ jobs: parsed });
  } catch (err) {
    logger.error('[agentController] getPendingJobs:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// PATCH /api/agent/print-queue/:id
exports.updateJobStatus = async (req, res) => {
  try {
    const tenantDb = await resolveAndAuth(req, res);
    if (!tenantDb) return;

    const { id } = req.params;
    const { status, error_message } = req.body;

    if (!['done', 'failed'].includes(status)) {
      return res.status(400).json({ message: 'status must be done or failed' });
    }

    await queryDb(
      tenantDb,
      `UPDATE print_queue SET status = ?, error_message = ?, processed_at = NOW() WHERE id = ?`,
      [status, error_message || null, id]
    );

    res.json({ success: true });
  } catch (err) {
    logger.error('[agentController] updateJobStatus:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};
