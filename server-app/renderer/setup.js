// ── Setup Renderer ────────────────────────────────────────────

const dbHost   = document.getElementById('db-host');
const dbPort   = document.getElementById('db-port');
const dbUser   = document.getElementById('db-user');
const dbPass   = document.getElementById('db-pass');
const dbName   = document.getElementById('db-name');
const dbMaster = document.getElementById('db-master');
const jwtInput = document.getElementById('jwt-secret');
const btnSave  = document.getElementById('btn-save');
const btnGen   = document.getElementById('btn-gen');
const msg      = document.getElementById('msg');

// Simple random hex generator for renderer (no crypto module available)
function generateSecret() {
  const arr = new Uint8Array(64);
  window.crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

btnGen.addEventListener('click', () => {
  jwtInput.value = generateSecret();
});

async function loadConfig() {
  const cfg = await window.erp.getConfig();
  dbHost.value   = cfg.DB_HOST        || 'localhost';
  dbUser.value   = cfg.DB_USER        || 'root';
  dbPass.value   = cfg.DB_PASSWORD    || '';
  dbName.value   = cfg.DB_NAME        || 'abyte_pos';
  dbMaster.value = cfg.MASTER_DB_NAME || 'abyte_master';
  jwtInput.value = cfg.JWT_SECRET     || '';
}

btnSave.addEventListener('click', async () => {
  const host = dbHost.value.trim();
  const user = dbUser.value.trim();
  const name = dbName.value.trim();

  if (!host || !user || !name) {
    showMsg('Host, User and Database Name are required.', 'error');
    return;
  }

  btnSave.disabled = true;
  btnSave.textContent = 'Saving…';

  const result = await window.erp.saveConfig({
    DB_HOST:        host,
    DB_USER:        user,
    DB_PASSWORD:    dbPass.value,
    DB_NAME:        name,
    MASTER_DB_NAME: dbMaster.value.trim() || 'abyte_master',
    JWT_SECRET:     jwtInput.value.trim(),
  });

  if (result.ok) {
    showMsg('Settings saved! Restart the server from the dashboard.', 'success');
  } else {
    showMsg('Failed to save settings.', 'error');
  }

  btnSave.disabled = false;
  btnSave.textContent = 'Save & Restart Server';
});

function showMsg(text, type) {
  msg.textContent  = text;
  msg.className    = `msg ${type}`;
}

loadConfig();
