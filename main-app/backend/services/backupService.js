const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { query, queryDb } = require('../config/database');
const logger = require('../config/logger');

const MASTER_DB = process.env.MASTER_DB_NAME || 'abyte_master';

const BACKUP_DIR = path.join(__dirname, '..', 'backups');

if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

function getTimestamp() {
  const now = new Date();
  return now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0') + '_' +
    String(now.getHours()).padStart(2, '0') +
    String(now.getMinutes()).padStart(2, '0') +
    String(now.getSeconds()).padStart(2, '0');
}

// Validate filename: only allow safe backup filenames (no path traversal)
function validateFilename(filename) {
  if (!filename || typeof filename !== 'string') throw new Error('Invalid filename');
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    throw new Error('Invalid filename: path traversal detected');
  }
  if (!/^[\w\-\.]+\.sql$/.test(filename)) {
    throw new Error('Invalid filename: only alphanumeric, hyphens, underscores allowed');
  }
}

// Run a command safely using spawn (no shell interpolation)
function runCommand(executable, args, options = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(executable, args, { ...options, shell: false });
    let stderr = '';
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${executable} exited with code ${code}: ${stderr.slice(0, 200)}`));
    });
    proc.on('error', reject);
  });
}

async function getAllDatabaseNames() {
  try {
    const tenants = await queryDb(MASTER_DB, 'SELECT db_name FROM tenants WHERE is_active = 1');
    const tenantDbs = tenants.map(t => t.db_name).filter(Boolean);
    // Master DB first, then all tenant DBs (deduplicated)
    const all = [MASTER_DB, ...tenantDbs];
    return [...new Set(all)];
  } catch (err) {
    logger.warn('[Backup] Could not fetch tenant DB list, falling back to single DB', { error: err.message });
    return [process.env.DB_NAME || 'abyte_pos'];
  }
}

async function createBackup(userId, type = 'manual') {
  const filename = `abyte_all_backup_${getTimestamp()}.sql`;
  const filepath = path.join(BACKUP_DIR, filename);

  const dbHost = process.env.DB_HOST || 'localhost';
  const dbPort = process.env.DB_PORT || '3306';
  const dbUser = process.env.DB_USER || 'root';
  const dbPass = process.env.DB_PASSWORD || '';

  const allDbs = await getAllDatabaseNames();
  logger.info('[Backup] Dumping databases', { dbs: allDbs });

  // Use --databases flag so mysqldump includes CREATE DATABASE + USE statements
  const buildArgs = (dbs) => [
    `-h${dbHost}`,
    `-P${dbPort}`,
    `-u${dbUser}`,
    ...(dbPass ? [`-p${dbPass}`] : []),
    '--databases',
    ...dbs,
  ];

  const dumpPath = process.env.MARIADB_DUMP_PATH || 'mariadb-dump';

  const runDump = (executable) =>
    new Promise((resolve, reject) => {
      const args = buildArgs(allDbs);
      const proc = spawn(executable, args, { shell: false });
      const out = fs.createWriteStream(filepath);
      proc.stdout.pipe(out);
      let stderr = '';
      proc.stderr.on('data', (d) => { stderr += d.toString(); });
      proc.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`${executable} failed (code ${code}): ${stderr.slice(0, 200)}`));
      });
      proc.on('error', reject);
    });

  try {
    try {
      await runDump(dumpPath);
    } catch {
      await runDump('mysqldump');
    }
    await finishBackup(filename, filepath, userId, type);
    return { filename, filepath };
  } catch (err) {
    try {
      await query(
        'INSERT INTO backups (filename, file_size, created_by, type, status) VALUES (?, 0, ?, ?, ?)',
        [filename, userId, type, 'failed']
      );
    } catch (dbErr) {
      logger.error('Failed to log backup failure', { error: dbErr.message });
    }
    throw new Error('Backup failed. Ensure mariadb-dump or mysqldump is available in PATH.');
  }
}

async function finishBackup(filename, filepath, userId, type) {
  const stats = fs.statSync(filepath);
  await query(
    'INSERT INTO backups (filename, file_size, created_by, type, status) VALUES (?, ?, ?, ?, ?)',
    [filename, stats.size, userId, type, 'completed']
  );
}

async function restoreBackup(filename) {
  validateFilename(filename);

  const filepath = path.join(BACKUP_DIR, filename);
  if (!fs.existsSync(filepath)) throw new Error('Backup file not found');

  const dbHost = process.env.DB_HOST || 'localhost';
  const dbPort = process.env.DB_PORT || '3306';
  const dbUser = process.env.DB_USER || 'root';
  const dbPass = process.env.DB_PASSWORD || '';
  const dbName = process.env.DB_NAME || 'abyte_pos';

  const buildArgs = () => [
    `-h${dbHost}`,
    `-P${dbPort}`,
    `-u${dbUser}`,
    ...(dbPass ? [`-p${dbPass}`] : []),
    dbName,
  ];

  const runRestore = (executable) =>
    new Promise((resolve, reject) => {
      const proc = spawn(executable, buildArgs(), { shell: false });
      const inp = fs.createReadStream(filepath);
      inp.pipe(proc.stdin);
      let stderr = '';
      proc.stderr.on('data', (d) => { stderr += d.toString(); });
      proc.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`${executable} failed (code ${code}): ${stderr.slice(0, 200)}`));
      });
      proc.on('error', reject);
    });

  try {
    await runRestore('mysql');
  } catch {
    await runRestore('mariadb');
  }
}

function listBackupFiles() {
  if (!fs.existsSync(BACKUP_DIR)) return [];
  return fs.readdirSync(BACKUP_DIR)
    .filter(f => f.endsWith('.sql'))
    .map(f => {
      const stats = fs.statSync(path.join(BACKUP_DIR, f));
      return { filename: f, size: stats.size, created: stats.mtime };
    })
    .sort((a, b) => b.created - a.created);
}

function deleteBackupFile(filename) {
  validateFilename(filename);
  const filepath = path.join(BACKUP_DIR, filename);
  if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
}

function getBackupDir() {
  return BACKUP_DIR;
}

module.exports = { createBackup, restoreBackup, listBackupFiles, deleteBackupFile, getBackupDir };
