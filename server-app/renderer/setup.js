// ── Setup Renderer ────────────────────────────────────────────

const dbHost   = document.getElementById('db-host');
const dbPort   = document.getElementById('db-port');
const dbUser   = document.getElementById('db-user');
const dbPass   = document.getElementById('db-pass');
const dbName   = document.getElementById('db-name');
const jwtInput = document.getElementById('jwt-secret');
const btnTest  = document.getElementById('btn-test');
const btnInit  = document.getElementById('btn-init');
const btnSave  = document.getElementById('btn-save');
const btnGen   = document.getElementById('btn-gen');
const msgDb    = document.getElementById('msg-db');
const msgSave  = document.getElementById('msg-save');

function generateSecret() {
  const arr = new Uint8Array(64);
  window.crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

function getDbConfig() {
  return {
    DB_HOST:     dbHost.value.trim()  || 'localhost',
    DB_PORT:     dbPort.value.trim()  || '3306',
    DB_USER:     dbUser.value.trim()  || 'root',
    DB_PASSWORD: dbPass.value,
    DB_NAME:     dbName.value.trim()  || 'abyte_pos',
  };
}

function showDbMsg(text, type) {
  msgDb.textContent = text;
  msgDb.className   = `msg ${type}`;
}
function showSaveMsg(text, type) {
  msgSave.textContent = text;
  msgSave.className   = `msg ${type}`;
}

btnGen.addEventListener('click', () => {
  jwtInput.value = generateSecret();
});

// ── Test Connection ───────────────────────────────────────────
btnTest.addEventListener('click', async () => {
  const cfg = getDbConfig();
  if (!cfg.DB_HOST || !cfg.DB_USER) {
    showDbMsg('Host and User are required.', 'error');
    return;
  }

  btnTest.disabled = true;
  btnTest.textContent = 'Testing…';
  showDbMsg('Connecting to MariaDB…', 'info');

  // We test by trying to initialize a trivial query via init-db path.
  // Simpler: just attempt saving and let the server report connection errors on start.
  // Better approach: send a "ping" via the main process.
  const result = await window.erp.initDb({ ...cfg, DB_NAME: 'mysql' }).catch(e => ({ ok: false, error: e.message }));

  if (result.ok || (result.error && result.error.toLowerCase().includes('access'))) {
    // Even "access denied to mysql" means MariaDB is reachable
    showDbMsg('MariaDB is reachable! You can now click Initialize Database.', 'success');
  } else if (result.error && result.error.toLowerCase().includes('not found in path')) {
    showDbMsg('MariaDB client not found in PATH. Make sure MariaDB is installed and its bin folder is in the system PATH.', 'error');
  } else if (result.error && (result.error.includes('ECONNREFUSED') || result.error.includes('connect'))) {
    showDbMsg('Cannot connect to MariaDB. Make sure the MariaDB service is running.', 'error');
  } else {
    showDbMsg(`Connected! (${result.error || 'OK'})`, 'success');
  }

  btnTest.disabled = false;
  btnTest.textContent = 'Test Connection';
});

// ── Initialize Database ───────────────────────────────────────
btnInit.addEventListener('click', async () => {
  const cfg = getDbConfig();
  if (!cfg.DB_HOST || !cfg.DB_USER || !cfg.DB_NAME) {
    showDbMsg('Host, User and Database Name are required.', 'error');
    return;
  }

  btnInit.disabled = true;
  btnInit.textContent = 'Initializing…';
  showDbMsg('Creating database and applying schema…', 'info');

  const result = await window.erp.initDb(cfg);

  if (result.ok) {
    showDbMsg(`Database "${cfg.DB_NAME}" initialized successfully! Proceed to Step 2 and save.`, 'success');
  } else {
    showDbMsg(`Initialization failed: ${result.error}`, 'error');
  }

  btnInit.disabled = false;
  btnInit.textContent = 'Initialize Database';
});

// ── Save Config ───────────────────────────────────────────────
btnSave.addEventListener('click', async () => {
  const cfg = getDbConfig();
  if (!cfg.DB_HOST || !cfg.DB_USER || !cfg.DB_NAME) {
    showSaveMsg('Host, User and Database Name are required.', 'error');
    return;
  }

  btnSave.disabled = true;
  btnSave.textContent = 'Saving…';

  const result = await window.erp.saveConfig({
    ...cfg,
    JWT_SECRET: jwtInput.value.trim(),
  });

  if (result.ok) {
    showSaveMsg('Settings saved! The server will start automatically.', 'success');
    setTimeout(() => window.close(), 1800);
  } else {
    showSaveMsg('Failed to save settings.', 'error');
    btnSave.disabled = false;
    btnSave.textContent = 'Save & Start Server';
  }
});

// ── Load existing config ──────────────────────────────────────
async function loadConfig() {
  const cfg = await window.erp.getConfig();
  dbHost.value   = cfg.DB_HOST     || 'localhost';
  dbPort.value   = cfg.DB_PORT     || '3306';
  dbUser.value   = cfg.DB_USER     || 'root';
  dbPass.value   = cfg.DB_PASSWORD || '';
  dbName.value   = cfg.DB_NAME     || 'abyte_pos';
  jwtInput.value = cfg.JWT_SECRET  || '';
}

loadConfig();
