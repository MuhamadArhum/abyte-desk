// =============================================================
// tokenBlacklist.js - Database-backed Token Revocation
// Tokens added on logout are stored in DB with expiry.
// Survives server restarts. Works across multiple instances.
// Falls back to in-memory if DB is unavailable.
// =============================================================

const { query } = require('../config/database');
const logger    = require('../config/logger');

// Phase 4: single-tenant — token_blacklist is in the single DB.
const q = (sql, params) => query(sql, params);

// In-memory fallback (used if DB table not ready yet)
const memoryFallback = new Set();

// BUG-038: short-lived positive cache ("confirmed NOT blacklisted") so a
// burst of requests on the same token doesn't hit the DB pool once per
// request, and so a transient pool-exhaustion/timeout on isBlacklisted()
// doesn't immediately fail-closed and log out a session that was verified
// clean moments ago. cleared for a hash the instant it's blacklisted, so
// logout still takes effect immediately for anyone hitting this instance.
const CLEAN_CACHE_TTL_MS  = 15000; // how long a "clean" result is trusted outright
const STALE_GRACE_MS      = 60000; // how long a stale "clean" result is reused if the DB check errors
const cleanCache = new Map(); // hash -> verifiedAt (ms)

// Ensure the blacklist table exists (called once at startup)
async function ensureTable() {
  try {
    await q(`
      CREATE TABLE IF NOT EXISTS token_blacklist (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        token_hash  VARCHAR(64)  NOT NULL UNIQUE,
        expires_at  DATETIME     NOT NULL,
        created_at  DATETIME     DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_expires (expires_at),
        INDEX idx_hash    (token_hash)
      )
    `);
    await q('DELETE FROM token_blacklist WHERE expires_at < NOW()');
  } catch (err) {
    logger.warn('[TokenBlacklist] Could not create/clean table, using memory fallback', { error: err.message });
  }
}

// SHA-256 hash of token so we don't store raw JWTs in DB
function hashToken(token) {
  const { createHash } = require('crypto');
  return createHash('sha256').update(token).digest('hex');
}

// Parse JWT expiry without verifying (token already verified by auth middleware)
function getTokenExpiry(token) {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
    if (payload.exp) return new Date(payload.exp * 1000);
  } catch {}
  // Default: expire 24h from now if we can't parse
  return new Date(Date.now() + 24 * 60 * 60 * 1000);
}

async function blacklistToken(token) {
  const hash      = hashToken(token);
  const expiresAt = getTokenExpiry(token);
  cleanCache.delete(hash); // don't let a cached "clean" result mask this logout

  try {
    await q(
      'INSERT IGNORE INTO token_blacklist (token_hash, expires_at) VALUES (?, ?)',
      [hash, expiresAt]
    );
  } catch (err) {
    logger.warn('[TokenBlacklist] DB insert failed, using memory fallback', { error: err.message });
    memoryFallback.add(hash);
  }
}

async function isBlacklisted(token) {
  const hash = hashToken(token);

  // Check memory fallback first (fast) — tokens blacklisted while the DB was down
  if (memoryFallback.has(hash)) return true;

  const verifiedAt = cleanCache.get(hash);
  if (verifiedAt !== undefined && Date.now() - verifiedAt < CLEAN_CACHE_TTL_MS) {
    return false; // verified clean recently enough to trust without a DB round-trip
  }

  try {
    const rows = await q(
      'SELECT 1 FROM token_blacklist WHERE token_hash = ? AND expires_at > NOW() LIMIT 1',
      [hash]
    );
    if (rows.length > 0) {
      cleanCache.delete(hash);
      return true;
    }
    cleanCache.set(hash, Date.now());
    return false;
  } catch (err) {
    // BUG-038: a saturated connection pool used to fail every in-flight
    // request closed (logged out) the moment isBlacklisted() couldn't get a
    // connection. If we verified this token clean within the last minute,
    // trust that instead of punishing the user for a pool hiccup.
    if (verifiedAt !== undefined && Date.now() - verifiedAt < STALE_GRACE_MS) {
      logger.warn('[TokenBlacklist] DB check failed, reusing recent clean result', { error: err.message });
      return false;
    }
    logger.warn('[TokenBlacklist] DB check failed, treating as blacklisted for safety', { error: err.message });
    // Fail-closed: on DB error with no recent clean result, deny the request
    // to prevent revoked tokens from slipping through
    return true;
  }
}

// Periodic cleanup — call from server startup (every 1 hour)
async function cleanExpired() {
  // Prune stale cleanCache entries so the map doesn't grow unbounded
  const cutoff = Date.now() - STALE_GRACE_MS;
  for (const [hash, verifiedAt] of cleanCache) {
    if (verifiedAt < cutoff) cleanCache.delete(hash);
  }

  try {
    const result = await q('DELETE FROM token_blacklist WHERE expires_at < NOW()');
    if (result.affectedRows > 0) {
      logger.info('[TokenBlacklist] Cleaned expired tokens', { count: result.affectedRows });
    }
  } catch (err) {
    logger.warn('[TokenBlacklist] Cleanup failed', { error: err.message });
  }
}

module.exports = { blacklistToken, isBlacklisted, ensureTable, cleanExpired };
