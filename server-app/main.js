// =============================================================
// main.js - AByte ERP Server App (Electron Main Process)
// Manages the Node.js backend process and system tray
// =============================================================

const { app, BrowserWindow, Tray, Menu, ipcMain, dialog, shell } = require('electron');
const path   = require('path');
const os     = require('os');
const fs     = require('fs');
const { spawn } = require('child_process');

// ── Constants ─────────────────────────────────────────────────
const IS_DEV      = process.argv.includes('--dev') || !app.isPackaged;
const USER_DATA   = app.getPath('userData');
const ENV_FILE    = path.join(USER_DATA, 'server.env');
const CONFIG_FILE = path.join(USER_DATA, 'config.json');
const PORT        = 5000;

// Backend path: dev = relative, production = extraResources
const BACKEND_DIR = IS_DEV
  ? path.join(__dirname, '../main-app/backend')
  : path.join(process.resourcesPath, 'backend');

const SERVER_JS = path.join(BACKEND_DIR, 'server.js');

// ── State ──────────────────────────────────────────────────────
let mainWindow   = null;
let tray         = null;
let serverProcess = null;
let serverStatus = 'stopped'; // 'stopped' | 'starting' | 'running' | 'error'
let logBuffer    = [];        // last 200 log lines
const MAX_LOGS   = 200;

// ── Helpers ───────────────────────────────────────────────────

function getLanIPs() {
  const interfaces = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push({ name, address: iface.address });
      }
    }
  }
  return ips;
}

function addLog(line, level = 'info') {
  const entry = { time: new Date().toLocaleTimeString(), text: line.trim(), level };
  logBuffer.push(entry);
  if (logBuffer.length > MAX_LOGS) logBuffer.shift();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('log', entry);
  }
}

function setStatus(status) {
  serverStatus = status;
  updateTray();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('status', { status, ips: getLanIPs(), port: PORT });
  }
}

function loadEnv() {
  if (!fs.existsSync(ENV_FILE)) return {};
  const content = fs.readFileSync(ENV_FILE, 'utf-8');
  const env = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx > 0) {
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
      env[key] = val;
    }
  }
  return env;
}

function saveEnv(envVars) {
  const lines = Object.entries(envVars).map(([k, v]) => `${k}=${v}`);
  fs.writeFileSync(ENV_FILE, lines.join('\n') + '\n', 'utf-8');
}

function isSetupComplete() {
  if (!fs.existsSync(ENV_FILE)) return false;
  const env = loadEnv();
  return !!(env.DB_HOST && env.DB_USER && env.DB_PASSWORD !== undefined && env.JWT_SECRET && env.DB_NAME);
}

// ── Server Process Management ─────────────────────────────────

function startServer() {
  if (serverProcess) return;
  if (!isSetupComplete()) {
    addLog('Setup required. Please configure database settings.', 'warn');
    setStatus('error');
    openSetupWindow();
    return;
  }

  const envVars = loadEnv();
  addLog('Starting AByte ERP backend...', 'info');
  setStatus('starting');

  // Find node executable
  const nodeExe = process.platform === 'win32' ? 'node.exe' : 'node';

  const logDir     = path.join(USER_DATA, 'logs');
  const uploadsDir = path.join(USER_DATA, 'uploads');
  const backupsDir = path.join(USER_DATA, 'backups');

  serverProcess = spawn(nodeExe, [SERVER_JS], {
    cwd:   BACKEND_DIR,
    env:   { ...process.env, ...envVars, PORT: String(PORT), LOG_DIR: logDir, UPLOADS_DIR: uploadsDir, BACKUPS_DIR: backupsDir },
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
  });

  serverProcess.stdout.on('data', (data) => {
    const lines = data.toString().split('\n').filter(l => l.trim());
    lines.forEach(l => addLog(l, 'info'));
    // Detect when server is ready
    if (serverStatus === 'starting' && (data.toString().includes('started') || data.toString().includes(`${PORT}`))) {
      setStatus('running');
      addLog(`Server running on port ${PORT}`, 'success');
    }
  });

  serverProcess.stderr.on('data', (data) => {
    const lines = data.toString().split('\n').filter(l => l.trim());
    // Log stderr as warnings — many libraries write non-fatal warnings to stderr.
    // Only the process exit handler should determine actual error state.
    lines.forEach(l => addLog(l, 'warn'));
  });

  serverProcess.on('exit', (code) => {
    addLog(`Server process exited (code: ${code})`, code === 0 ? 'info' : 'error');
    serverProcess = null;
    setStatus('stopped');
  });

  serverProcess.on('error', (err) => {
    addLog(`Failed to start server: ${err.message}`, 'error');
    serverProcess = null;
    setStatus('error');
  });

  // After 8 seconds, if still 'starting', assume it's running (some setups don't log the ready line)
  setTimeout(() => {
    if (serverStatus === 'starting') setStatus('running');
  }, 8000);
}

function stopServer() {
  if (!serverProcess) return;
  addLog('Stopping server...', 'info');
  serverProcess.kill('SIGTERM');
  const killTimer = setTimeout(() => {
    if (serverProcess) {
      serverProcess.kill('SIGKILL');
      serverProcess = null;
      setStatus('stopped');
    }
  }, 5000);
  serverProcess.once('exit', () => clearTimeout(killTimer));
}

// ── Setup Window ──────────────────────────────────────────────

let setupWindow = null;

function openSetupWindow() {
  if (setupWindow && !setupWindow.isDestroyed()) {
    setupWindow.focus();
    return;
  }
  setupWindow = new BrowserWindow({
    width:  500,
    height: 620,
    title:  'AByte ERP Server — Setup',
    resizable: false,
    autoHideMenuBar: true,
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  setupWindow.loadFile(path.join(__dirname, 'renderer', 'setup.html'));
  setupWindow.on('closed', () => { setupWindow = null; });
}

// ── Main Window ───────────────────────────────────────────────

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width:  780,
    height: 560,
    title:  'AByte ERP Server',
    autoHideMenuBar: true,
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // Minimize to tray instead of closing
  mainWindow.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

// ── System Tray ───────────────────────────────────────────────

function getIconPath() {
  const candidates = ['icon.ico', 'icon.png'];
  for (const f of candidates) {
    const p = path.join(__dirname, 'assets', f);
    if (fs.existsSync(p)) return p;
  }
  return undefined;
}

function updateTray() {
  if (!tray) return;
  const statusLabel = {
    running:  '● Running',
    starting: '◌ Starting...',
    stopped:  '○ Stopped',
    error:    '✕ Error',
  }[serverStatus] || '○ Stopped';

  tray.setToolTip(`AByte ERP Server — ${statusLabel}`);
  tray.setImage(getIconPath());

  const menu = Menu.buildFromTemplate([
    { label: 'AByte ERP Server', enabled: false },
    { label: statusLabel, enabled: false },
    { type: 'separator' },
    {
      label: serverStatus === 'running' ? 'Stop Server' : 'Start Server',
      click: () => serverStatus === 'running' ? stopServer() : startServer(),
    },
    { label: 'Open Dashboard', click: () => { mainWindow?.show(); mainWindow?.focus(); } },
    { type: 'separator' },
    { label: 'Settings', click: () => openSetupWindow() },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.isQuitting = true;
        stopServer();
        app.quit();
      },
    },
  ]);
  tray.setContextMenu(menu);
}

function createTray() {
  const iconPath = getIconPath();
  tray = iconPath ? new Tray(iconPath) : new Tray(path.join(__dirname, 'assets', 'icon.png'));
  tray.on('double-click', () => { mainWindow?.show(); mainWindow?.focus(); });
  updateTray();
}

// ── IPC Handlers ──────────────────────────────────────────────

ipcMain.handle('get-status', () => ({
  status: serverStatus,
  ips:    getLanIPs(),
  port:   PORT,
  logs:   logBuffer,
}));

ipcMain.handle('server-start',  () => startServer());
ipcMain.handle('server-stop',   () => stopServer());
ipcMain.handle('open-setup',    () => openSetupWindow());
ipcMain.handle('open-browser',  (_, url) => shell.openExternal(url));

ipcMain.handle('get-config', () => {
  const env = loadEnv();
  return {
    DB_HOST:       env.DB_HOST     || 'localhost',
    DB_PORT:       env.DB_PORT     || '3306',
    DB_USER:       env.DB_USER     || 'root',
    DB_PASSWORD:   env.DB_PASSWORD || '',
    DB_NAME:       env.DB_NAME     || 'abyte_pos',
    PORT:          env.PORT        || '5000',
    JWT_SECRET:    env.JWT_SECRET  || '',
    setupComplete: isSetupComplete(),
  };
});

ipcMain.handle('save-config', (_, config) => {
  const crypto = require('crypto');
  const jwtSecret = config.JWT_SECRET || crypto.randomBytes(64).toString('hex');

  saveEnv({
    DB_HOST:         config.DB_HOST     || 'localhost',
    DB_PORT:         config.DB_PORT     || '3306',
    DB_USER:         config.DB_USER     || 'root',
    DB_PASSWORD:     config.DB_PASSWORD || '',
    DB_NAME:         config.DB_NAME     || 'abyte_pos',
    JWT_SECRET:      jwtSecret,
    PORT:            String(PORT),
    NODE_ENV:        'production',
    ALLOWED_ORIGINS: '*',
  });

  addLog('Configuration saved.', 'success');

  // Auto-start server after config is saved
  if (setupWindow && !setupWindow.isDestroyed()) {
    setupWindow.close();
  }
  setTimeout(() => startServer(), 500);

  return { ok: true };
});

// ── DB Initialization ─────────────────────────────────────────
// Uses mariadb npm package — no CLI required.

function createDbConnection(config, database) {
  const mysql = require('mysql2/promise');
  return mysql.createConnection({
    host:               config.DB_HOST     || '127.0.0.1',
    port:               parseInt(config.DB_PORT || '3306'),
    user:               config.DB_USER     || 'root',
    password:           config.DB_PASSWORD || '',
    database:           database || undefined,
    connectTimeout:     10000,
    multipleStatements: true,
  });
}

ipcMain.handle('test-connection', async (_, config) => {
  let conn;
  try {
    conn = await createDbConnection(config);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  } finally {
    if (conn) await conn.end().catch(() => {});
  }
});

ipcMain.handle('init-db', async (_, config) => {
  const { DB_NAME } = config;

  const schemaPath = IS_DEV
    ? path.join(__dirname, '../database/schema.sql')
    : path.join(process.resourcesPath, 'schema.sql');

  if (!fs.existsSync(schemaPath)) {
    return { ok: false, error: `schema.sql not found at: ${schemaPath}` };
  }

  let conn;
  try {
    conn = await createDbConnection(config);

    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\`;`);
    addLog(`[DB Init] Database '${DB_NAME}' created/verified.`, 'success');

    await conn.query(`USE \`${DB_NAME}\`;`);

    const schema = fs.readFileSync(schemaPath, 'utf-8');
    await conn.query(schema);
    addLog(`[DB Init] Schema applied to '${DB_NAME}'.`, 'success');

    return { ok: true };
  } catch (err) {
    addLog(`[DB Init] Failed: ${err.message}`, 'error');
    return { ok: false, error: err.message };
  } finally {
    if (conn) await conn.end().catch(() => {});
  }
});

ipcMain.handle('get-autostart', () => {
  return app.getLoginItemSettings().openAtLogin;
});

ipcMain.handle('set-autostart', (_, enable) => {
  app.setLoginItemSettings({ openAtLogin: enable });
  return { ok: true };
});

// ── MariaDB Detection & Installation ──────────────────────────

function checkMariaDBInstalled() {
  const { execFileSync } = require('child_process');
  const services = ['MariaDB', 'MySQL', 'MySQL80', 'MySQL57', 'MySQL56'];
  for (const svc of services) {
    try {
      execFileSync('sc', ['query', svc], {
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'ignore'],
        timeout: 5000,
      });
      return { installed: true, service: svc };
    } catch { /* try next */ }
  }
  // Fallback: check registry
  try {
    const result = execFileSync(
      'reg', ['query', 'HKLM\\SOFTWARE\\MariaDB Corporation', '/s'],
      { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 5000 }
    );
    if (result && result.trim()) return { installed: true, service: 'registry' };
  } catch { /* not found */ }
  return { installed: false, service: null };
}

ipcMain.handle('check-mariadb', () => checkMariaDBInstalled());

ipcMain.handle('install-mariadb', async (event) => {
  const https  = require('https');
  const tmpDir = require('os').tmpdir();
  const msiPath = path.join(tmpDir, 'mariadb-installer.msi');

  const MARIADB_MSI_URL =
    'https://downloads.mariadb.com/MariaDB/mariadb-10.11.10/winx64-packages/mariadb-10.11.10-winx64.msi';

  const sendProgress = (pct, msg) => {
    try { event.sender.send('mariadb-progress', { pct, msg }); } catch { /* window closed */ }
    addLog(`[MariaDB] ${msg}`, 'info');
  };

  function httpsGet(url) {
    return new Promise((resolve, reject) => {
      https.get(url, { timeout: 30000 }, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          httpsGet(res.headers.location).then(resolve).catch(reject);
        } else {
          resolve(res);
        }
      }).on('error', reject).on('timeout', () => reject(new Error('Request timed out')));
    });
  }

  try {
    sendProgress(5, 'Connecting to download server...');
    const res = await httpsGet(MARIADB_MSI_URL);
    const total = parseInt(res.headers['content-length'] || '0', 10);
    let downloaded = 0;

    await new Promise((resolve, reject) => {
      const file = fs.createWriteStream(msiPath);
      res.on('data', (chunk) => {
        downloaded += chunk.length;
        file.write(chunk);
        if (total > 0) {
          const pct = Math.min(5 + Math.round((downloaded / total) * 60), 65);
          const mb  = Math.round(downloaded / 1024 / 1024);
          const tot = Math.round(total / 1024 / 1024);
          sendProgress(pct, `Downloading MariaDB... ${mb} MB / ${tot} MB`);
        }
      });
      res.on('end', () => { file.end(); resolve(); });
      res.on('error', (e) => { file.destroy(); reject(e); });
    });

    sendProgress(67, 'Starting MariaDB installation (this may take a few minutes)...');

    await new Promise((resolve, reject) => {
      const proc = spawn('msiexec', [
        '/i', msiPath,
        '/quiet', '/norestart',
        'SERVICENAME=MariaDB',
        'PORT=3306',
        'ALLOWREMOTEROOTACCESS=YES',
        'BUFFERPOOLSIZE=64',
      ], { windowsHide: true, detached: false });

      proc.on('exit', (code) => {
        // 0 = success, 3010 = success + reboot suggested
        if (code === 0 || code === 3010) resolve();
        else reject(new Error(`Installer exited with code ${code}`));
      });
      proc.on('error', reject);
    });

    sendProgress(90, 'Waiting for MariaDB service to start...');
    // Give the service time to register and start
    await new Promise(r => setTimeout(r, 4000));

    fs.unlink(msiPath, () => {});

    sendProgress(100, 'MariaDB installed successfully!');
    return { ok: true };
  } catch (err) {
    addLog(`[MariaDB] Install failed: ${err.message}`, 'error');
    try { fs.unlink(msiPath, () => {}); } catch { /* ignore */ }
    return { ok: false, error: err.message };
  }
});

// ── App Lifecycle ─────────────────────────────────────────────

// Single instance lock — must be checked before whenReady to prevent
// a second instance from spawning windows/server before quitting.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
  });

  app.whenReady().then(() => {
    createTray();
    createMainWindow();

    if (!isSetupComplete()) {
      addLog('First run detected — please complete setup.', 'warn');
      openSetupWindow();
    } else {
      startServer();
    }
  });

  app.on('window-all-closed', (e) => {
    // Keep app running in tray even when all windows are closed
    e.preventDefault();
  });

  app.on('before-quit', () => {
    app.isQuitting = true;
    stopServer();
  });
}
