// ── Setup Renderer ────────────────────────────────────────────

const ipInput      = document.getElementById('server-ip');
const portInput    = document.getElementById('server-port');
const btnTest      = document.getElementById('btn-test');
const btnConnect   = document.getElementById('btn-connect');
const msgEl        = document.getElementById('msg');
const autostartChk = document.getElementById('autostart-check');

function showMsg(text, type) {
  msgEl.textContent = text;
  msgEl.className   = `msg ${type}`;
}

function hideMsg() {
  msgEl.className = 'msg';
}

function getInputUrl() {
  const ip   = ipInput.value.trim();
  const port = portInput.value.trim() || '5000';
  if (!ip) return null;
  return `http://${ip}:${port}`;
}

btnTest.addEventListener('click', async () => {
  const url = getInputUrl();
  if (!url) { showMsg('Please enter a server IP address.', 'error'); return; }

  btnTest.disabled    = true;
  btnTest.textContent = 'Testing…';
  showMsg('Pinging server…', 'info');

  const ok = await window.erpClient.pingServer(url);

  btnTest.disabled    = false;
  btnTest.textContent = 'Test Connection';

  if (ok) {
    showMsg(`Connected! Server is reachable at ${url}`, 'success');
  } else {
    showMsg(`Cannot reach server at ${url}. Check the IP address and make sure the server is running.`, 'error');
  }
});

btnConnect.addEventListener('click', async () => {
  const ip   = ipInput.value.trim();
  const port = Number(portInput.value.trim()) || 5000;

  if (!ip) { showMsg('Please enter a server IP address.', 'error'); return; }

  btnConnect.disabled    = true;
  btnConnect.textContent = 'Connecting…';

  await window.erpClient.saveConfig({ server_ip: ip, server_port: port });
  await window.erpClient.connect();
  // Setup window closes automatically after connect IPC
});

autostartChk.addEventListener('change', () => {
  window.erpClient.setAutostart(autostartChk.checked);
});

async function init() {
  const cfg = await window.erpClient.getConfig();
  if (cfg.server_ip)   ipInput.value   = cfg.server_ip;
  if (cfg.server_port) portInput.value  = cfg.server_port;

  const autostart = await window.erpClient.getAutostart();
  autostartChk.checked = autostart;
}

init();
