// ── Setup Renderer ────────────────────────────────────────────

// ── MariaDB Detection & Install ───────────────────────────────

const mariaDbStatusRow   = document.getElementById('mariadb-status-row');
const mariaDbDot         = document.getElementById('mariadb-dot');
const mariaDbStatusText  = document.getElementById('mariadb-status-text');
const btnInstallMariaDB  = document.getElementById('btn-install-mariadb');
const mariaDbProgressWrap = document.getElementById('mariadb-progress-wrap');
const mariaDbProgressFill = document.getElementById('mariadb-progress-fill');
const mariaDbProgressLabel = document.getElementById('mariadb-progress-label');
const msgMariaDb         = document.getElementById('msg-mariadb');
const dbForm             = document.getElementById('db-form');

function setMariaDbStatus(state, text) {
  mariaDbStatusRow.className = `mariadb-status-row ${state}`;
  mariaDbDot.className       = `dot dot-${state}`;
  mariaDbStatusText.textContent = text;
}

function showMariaDbMsg(text, type) {
  msgMariaDb.textContent = text;
  msgMariaDb.className   = `msg ${type}`;
}

function revealDbForm() {
  dbForm.style.display = 'block';
}

async function detectMariaDB() {
  setMariaDbStatus('checking', 'Checking for MariaDB...');
  btnInstallMariaDB.style.display = 'none';

  const result = await window.erp.checkMariaDB().catch(() => ({ installed: false }));

  if (result.installed) {
    setMariaDbStatus('installed', `MariaDB / MySQL detected (${result.service}). Ready to configure.`);
    revealDbForm();
  } else {
    setMariaDbStatus('missing', 'MariaDB not found. Please install it to continue.');
    btnInstallMariaDB.style.display = 'block';
  }
}

btnInstallMariaDB.addEventListener('click', async () => {
  btnInstallMariaDB.disabled = true;
  mariaDbProgressWrap.style.display = 'block';
  showMariaDbMsg('', '');

  // Listen for progress updates
  window.erp.onMariaDbProgress(({ pct, msg }) => {
    mariaDbProgressFill.style.width = `${pct}%`;
    mariaDbProgressLabel.textContent = msg;
  });

  const result = await window.erp.installMariaDB();

  if (result.ok) {
    mariaDbProgressFill.style.width = '100%';
    mariaDbProgressLabel.textContent = 'Installation complete!';
    showMariaDbMsg('MariaDB installed successfully. You can now configure the database below.', 'success');
    setMariaDbStatus('installed', 'MariaDB installed and ready.');
    btnInstallMariaDB.style.display = 'none';
    revealDbForm();
  } else {
    mariaDbProgressWrap.style.display = 'none';
    showMariaDbMsg(`Installation failed: ${result.error}\n\nPlease install MariaDB manually from mariadb.org`, 'error');
    btnInstallMariaDB.disabled = false;
    setMariaDbStatus('missing', 'Installation failed. Please install MariaDB manually.');
  }
});

// Auto-detect on page load
detectMariaDB();

// ── DB Config ─────────────────────────────────────────────────

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

  const result = await window.erp.testConnection(cfg).catch(e => ({ ok: false, error: e.message }));

  if (result.ok) {
    showDbMsg('Connected to MariaDB successfully! You can now click Initialize Database.', 'success');
  } else if (result.error && (result.error.includes('ECONNREFUSED') || result.error.includes('connect'))) {
    showDbMsg('Cannot connect to MariaDB. Make sure the MariaDB service is running.', 'error');
  } else if (result.error && result.error.includes('Access denied')) {
    showDbMsg('Wrong username or password. Please check your credentials.', 'error');
  } else {
    showDbMsg(`Connection failed: ${result.error}`, 'error');
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
