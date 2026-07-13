// =============================================================
// database.js - Multi-Tenant MariaDB Connection Manager
//
// HOW MULTI-TENANCY WORKS:
// - Each client (tenant) has their own separate database
// - A single server handles ALL tenants
// - AsyncLocalStorage tracks which DB to use per HTTP request
// - query() and getConnection() automatically use the correct DB
// - NO controller code needs to change — it's fully transparent
//
// Flow:
//   Login (tenant_code) → JWT includes tenant_db
//   → auth middleware sets tenantStorage → query() uses correct DB
// =============================================================

const mariadb = require('mariadb');
const { AsyncLocalStorage } = require('async_hooks');
const fs = require('fs');
require('dotenv').config();

// AsyncLocalStorage: stores current tenant's DB name per async context
// Each HTTP request gets its own isolated storage slot
const tenantStorage = new AsyncLocalStorage();

// Shared pool options (same for all tenant DBs)
const isRemote = process.env.DB_HOST && process.env.DB_HOST !== 'localhost' && process.env.DB_HOST !== '127.0.0.1';

// Build SSL config: use CA cert file if provided, otherwise skip cert verification
let sslConfig = {};
if (isRemote) {
  if (process.env.DB_SSL_CA) {
    try {
      sslConfig = { ssl: { ca: fs.readFileSync(process.env.DB_SSL_CA), rejectUnauthorized: true } };
    } catch (e) {
      console.error('[DB SSL] CA cert file not found at:', process.env.DB_SSL_CA, '— SSL certificate verification DISABLED. Fix DB_SSL_CA path to secure the connection.');
      sslConfig = { ssl: { rejectUnauthorized: false } };
    }
  } else {
    console.warn('[DB SSL] DB_SSL_CA is not set for a remote database — SSL certificate verification is DISABLED. Set DB_SSL_CA to a valid CA cert path to prevent MITM attacks.');
    sslConfig = { ssl: { rejectUnauthorized: false } };
  }
}

const poolOptions = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  connectionLimit: 3,
  idleTimeout: 60000,
  acquireTimeout: 30000,
  connectTimeout: 10000,
  bigIntAsNumber: true,
  insertIdAsNumber: true,
  decimalAsNumber: true,
  ...sslConfig,
};

// Pool registry: dbName -> { pool, lastUsed } for LRU eviction
const pools = new Map();

// Evict pools idle for more than 10 minutes to reclaim MariaDB connections
const POOL_IDLE_MS = 10 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const [db, entry] of pools) {
    if (now - entry.lastUsed > POOL_IDLE_MS) {
      entry.pool.end().catch(() => {});
      pools.delete(db);
    }
  }
}, 60 * 1000).unref(); // .unref() so the timer doesn't keep the process alive

// --- getPool(dbName) ---
// Returns (or creates) a connection pool for a specific database.
function getPool(dbName) {
  if (!pools.has(dbName)) {
    pools.set(dbName, { pool: mariadb.createPool({ ...poolOptions, database: dbName }), lastUsed: Date.now() });
  } else {
    pools.get(dbName).lastUsed = Date.now();
  }
  return pools.get(dbName).pool;
}

// --- closeAllPools() ---
// Gracefully drains all tenant pools. Called during SIGTERM shutdown.
async function closeAllPools() {
  const closers = [];
  for (const [, entry] of pools) closers.push(entry.pool.end().catch(() => {}));
  pools.clear();
  await Promise.all(closers);
}

// --- getCurrentDb() ---
// Returns the current tenant's DB name from AsyncLocalStorage.
// Falls back to default DB if called outside a request context.
function getCurrentDb() {
  return tenantStorage.getStore() || process.env.DB_NAME || 'abyte_pos';
}

// --- queryDb(dbName, sql, params) ---
// Direct query to a SPECIFIC database (used by auth middleware before
// tenant context is set, and by setup scripts).
async function queryDb(dbName, sql, params) {
  const pool = getPool(dbName);
  let conn;
  try {
    conn = await pool.getConnection();
    return await conn.query(sql, params);
  } finally {
    if (conn) conn.release();
  }
}

// --- query(sql, params) ---
// Standard query function used by ALL controllers.
// Automatically routes to the current tenant's database.
// Controllers never need to know which DB they're using.
async function query(sql, params) {
  return queryDb(getCurrentDb(), sql, params);
}

// --- getConnection() ---
// Returns a raw connection for transactions (BEGIN/COMMIT/ROLLBACK).
// Automatically uses the current tenant's database pool.
async function getConnection() {
  return getPool(getCurrentDb()).getConnection();
}

module.exports = { query, queryDb, getConnection, tenantStorage, getPool, getCurrentDb, closeAllPools, pools };
