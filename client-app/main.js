// =============================================================
// main.js - AByte ERP Client App (Electron Main Process)
// Connects to AByte ERP Server on local LAN
// =============================================================

const { app, BrowserWindow, Tray, Menu, ipcMain, shell } = require('electron');
const path   = require('path');
const fs     = require('fs');
const http   = require('http');

// ── Constants ─────────────────────────────────────────────────
const IS_DEV      = process.argv.includes('--dev') || !app.isPackaged;
const USER_DATA   = app.getPath('userData');
const CONFIG_FILE = path.join(USER_DATA, 'config.json');

// ── State ──────────────────────────────────────────────────────
let mainWindow        = null;
let setupWindow       = null;
let tray              = null;
let connectionStatus  = 'disconnected'; // 'disconnected' | 'connecting' | 'connected' | 'error'

// ── Config Helpers ────────────────────────────────────────────

function loadConfig() {
  if (!fs.existsSync(CONFIG_FILE)) return null;
  try { return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8')); } catch { return null; }
}

function saveConfig(cfg) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf-8');
}

function isConfigured() {
  const cfg = loadConfig();
  return !!(cfg && cfg.server_ip && cfg.server_ip.trim());
}

function getErpUrl(cfg) {
  const c = cfg || loadConfig();
  if (!c || !c.server_ip) return null;
  const port = c.server_port || 5000;
  return `http://${c.server_ip.trim()}:${port}`;
}

// ── Connection Status ─────────────────────────────────────────

function setConnectionStatus(status) {
  connectionStatus = status;
  updateTray();
  // Notify renderer pages that listen (error.html, connecting.html)
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('connection-status', {
      status,
      url: getErpUrl(),
    });
  }
}

// ── Ping server (HTTP GET /api/ping) ─────────────────────────

function pingServer(url) {
  return new Promise((resolve) => {
    const pingUrl = `${url}/api/ping`;
    const req = http.get(pingUrl, { timeout: 5000 }, (res) => {
      resolve(res.statusCode >= 200 && res.statusCode < 500);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

// ── Main Window ───────────────────────────────────────────────

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width:  1366,
    height: 768,
    title:  'AByte ERP',
    autoHideMenuBar: true,
    backgroundColor: '#f9fafb',
    webPreferences: {
      preload:          path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration:  false,
    },
  });

  // Show connecting page immediately
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'connecting.html'));
  setConnectionStatus('connecting');

  // Attempt to load the ERP URL
  const url = getErpUrl();
  if (url) {
    // Small delay so connecting.html renders before we navigate away
    setTimeout(() => loadErpUrl(url), 400);
  }

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    // Ignore failures from local file:// pages (connecting.html / error.html)
    if (!validatedURL || validatedURL.startsWith('file://')) return;
    setConnectionStatus('error');
    mainWindow.loadFile(path.join(__dirname, 'renderer', 'error.html'));
  });

  mainWindow.webContents.on('did-finish-load', () => {
    const currentUrl = mainWindow.webContents.getURL();
    if (currentUrl && !currentUrl.startsWith('file://')) {
      setConnectionStatus('connected');
      mainWindow.setTitle('AByte ERP');
    }
  });

  // Minimize to tray instead of closing
  mainWindow.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

function loadErpUrl(url) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (!url) { openSetupWindow(); return; }
  setConnectionStatus('connecting');
  mainWindow.webContents.loadURL(url);
}

function retryConnection() {
  const url = getErpUrl();
  if (!url) { openSetupWindow(); return; }
  if (!mainWindow || mainWindow.isDestroyed()) {
    createMainWindow();
    return;
  }
  mainWindow.show();
  mainWindow.focus();
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'connecting.html'));
  setTimeout(() => loadErpUrl(url), 400);
}

// ── Setup Window ──────────────────────────────────────────────

function openSetupWindow() {
  if (setupWindow && !setupWindow.isDestroyed()) {
    setupWindow.focus();
    return;
  }
  setupWindow = new BrowserWindow({
    width:    460,
    height:   480,
    title:    'AByte ERP Client — Setup',
    resizable: false,
    autoHideMenuBar: true,
    backgroundColor: '#0f172a',
    webPreferences: {
      preload:          path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration:  false,
    },
  });
  setupWindow.loadFile(path.join(__dirname, 'renderer', 'setup.html'));
  setupWindow.on('closed', () => { setupWindow = null; });
}

// ── System Tray ───────────────────────────────────────────────

function getIconPath() {
  for (const f of ['icon.ico', 'icon.png']) {
    const p = path.join(__dirname, 'assets', f);
    if (fs.existsSync(p)) return p;
  }
  return undefined;
}

function updateTray() {
  if (!tray) return;
  const statusLabel = {
    connected:    '● Connected',
    connecting:   '◌ Connecting...',
    disconnected: '○ Disconnected',
    error:        '✕ Connection Failed',
  }[connectionStatus] || '○ Disconnected';

  tray.setToolTip(`AByte ERP — ${statusLabel}`);

  const menu = Menu.buildFromTemplate([
    { label: 'AByte ERP Client', enabled: false },
    { label: statusLabel,        enabled: false },
    { type: 'separator' },
    {
      label: 'Open',
      click: () => {
        if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
        else createMainWindow();
      },
    },
    { label: 'Settings', click: () => openSetupWindow() },
    { type: 'separator' },
    { label: 'Retry Connection', click: () => retryConnection() },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => { app.isQuitting = true; app.quit(); },
    },
  ]);
  tray.setContextMenu(menu);
}

function createTray() {
  const iconPath = getIconPath();
  tray = iconPath ? new Tray(iconPath) : new Tray(path.join(__dirname, 'assets', 'icon.png'));
  tray.on('double-click', () => {
    if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
    else createMainWindow();
  });
  updateTray();
}

// ── IPC Handlers ──────────────────────────────────────────────

ipcMain.handle('get-config', () => {
  const cfg = loadConfig();
  return {
    server_ip:   cfg?.server_ip   || '',
    server_port: cfg?.server_port || 5000,
    configured:  isConfigured(),
  };
});

ipcMain.handle('save-config', (_, cfg) => {
  saveConfig({
    server_ip:   cfg.server_ip.trim(),
    server_port: Number(cfg.server_port) || 5000,
  });
  return { ok: true };
});

ipcMain.handle('connect', () => {
  const url = getErpUrl();
  if (!mainWindow || mainWindow.isDestroyed()) {
    createMainWindow();
  } else {
    mainWindow.show();
    mainWindow.focus();
    mainWindow.loadFile(path.join(__dirname, 'renderer', 'connecting.html'));
    setTimeout(() => loadErpUrl(url), 400);
  }
  if (setupWindow && !setupWindow.isDestroyed()) setupWindow.close();
});

ipcMain.handle('retry',         ()          => retryConnection());
ipcMain.handle('open-settings', ()          => openSetupWindow());

ipcMain.handle('get-connection-status', () => ({
  status: connectionStatus,
  url:    getErpUrl(),
}));

ipcMain.handle('get-autostart', ()          => app.getLoginItemSettings().openAtLogin);
ipcMain.handle('set-autostart', (_, enable) => {
  app.setLoginItemSettings({ openAtLogin: enable });
  return { ok: true };
});

ipcMain.handle('ping-server', async (_, url) => {
  const target = url || getErpUrl();
  if (!target) return false;
  return await pingServer(target);
});

// ── App Lifecycle ─────────────────────────────────────────────

app.whenReady().then(() => {
  createTray();

  if (!isConfigured()) {
    // First run — show only setup window
    openSetupWindow();
  } else {
    createMainWindow();
  }
});

// Keep app running in tray when all windows are closed
app.on('window-all-closed', (e) => e.preventDefault());

app.on('before-quit', () => { app.isQuitting = true; });

// Single instance lock
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
  });
}
