const mariadb = require('mariadb');
const path = require('path');
require('dotenv').config({
  path: path.join(__dirname, '..', process.env.NODE_ENV === 'production' ? '.env.production' : '.env'),
});

const MASTER_DB = process.env.MASTER_DB || 'abyte_master';

const pool = mariadb.createPool({
  host:             process.env.DB_HOST || 'localhost',
  port:             parseInt(process.env.DB_PORT) || 3306,
  user:             process.env.DB_USER || 'root',
  password:         process.env.DB_PASSWORD || '',
  database:         MASTER_DB,
  connectionLimit:  10,
  bigIntAsNumber:   true,
  insertIdAsNumber: true,
  decimalAsNumber:  true,
});

async function query(sql, params) {
  let conn;
  try {
    conn = await pool.getConnection();
    return await conn.query(sql, params);
  } finally {
    if (conn) conn.release();
  }
}

async function getConnection() {
  return pool.getConnection();
}

// Direct query to any DB (for tenant DB operations)
const pools = new Map();
function getTenantPool(dbName) {
  if (!pools.has(dbName)) {
    pools.set(dbName, mariadb.createPool({
      host:             process.env.TENANT_DB_HOST || process.env.DB_HOST || 'localhost',
      port:             parseInt(process.env.DB_PORT) || 3306,
      user:             process.env.TENANT_DB_USER || process.env.DB_USER || 'root',
      password:         process.env.TENANT_DB_PASSWORD || process.env.DB_PASSWORD || '',
      connectionLimit:  10,
      bigIntAsNumber:   true,
      insertIdAsNumber: true,
      decimalAsNumber:  true,
    }));
  }
  return pools.get(dbName);
}

async function tenantQuery(dbName, sql, params) {
  const p = getTenantPool(dbName);
  let conn;
  try {
    conn = await p.getConnection();
    return await conn.query(sql, params);
  } finally {
    if (conn) conn.release();
  }
}

async function getTenantConnection(dbName) {
  return getTenantPool(dbName).getConnection();
}

module.exports = { query, getConnection, tenantQuery, getTenantConnection };
