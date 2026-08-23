// ── Dashboard Renderer ────────────────────────────────────────

const btnToggle    = document.getElementById('btn-toggle');
const btnOpen      = document.getElementById('btn-open');
const btnSetup     = document.getElementById('btn-setup');
const btnClear     = document.getElementById('btn-clear');
const statusDot    = document.getElementById('status-dot');
const statusLabel  = document.getElementById('status-label');
const statusSub    = document.getElementById('status-sub');
const ipList       = document.getElementById('ip-list');
const logList      = document.getElementById('log-list');
const emptyLog     = document.getElementById('empty-log');
const autostartChk = document.getElementById('autostart-check');

let currentStatus = 'stopped';
let primaryIp     = null;

// ── Status Rendering ──────────────────────────────────────────

const STATUS_CONFIG = {
  running:  { dot: 'dot-running',  label: 'Running',    sub: 'Server is accepting connections', btn: 'Stop Server',  btnClass: 'btn-stop'  },
  starting: { dot: 'dot-starting', label: 'Starting…',  sub: 'Please wait…',                   btn: 'Starting…',    btnClass: 'btn-stop'  },
  stopped:  { dot: 'dot-stopped',  label: 'Stopped',    sub: 'Server is not running',           btn: 'Start Server', btnClass: 'btn-start' },
  error:    { dot: 'dot-error',    label: 'Error',       sub: 'Check logs for details',         btn: 'Retry Start',  btnClass: 'btn-start' },
};

function applyStatus({ status, ips, port }) {
  currentStatus = status;
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.stopped;

  statusDot.className = `status-dot ${cfg.dot}`;
  statusLabel.textContent = cfg.label;
  statusSub.textContent   = cfg.sub;

  btnToggle.textContent = cfg.btn;
  btnToggle.className   = `btn ${cfg.btnClass}`;
  btnToggle.disabled    = status === 'starting';

  btnOpen.disabled = status !== 'running';

  renderIPs(ips, port);
}

function renderIPs(ips, port) {
  if (!ips || ips.length === 0) {
    ipList.innerHTML = '<div class="no-ip">No LAN network detected</div>';
    primaryIp = null;
    return;
  }

  primaryIp = ips[0].address;
  ipList.innerHTML = ips.map(({ address }) => `
    <div class="ip-row" onclick="copyIP('${address}', ${port})">
      <div>
        <span class="ip-addr">${address}</span>
        <span class="ip-port">:${port}</span>
      </div>
      <span class="ip-copy">Click to copy</span>
    </div>
  `).join('');
}

window.copyIP = function(ip, port) {
  const url = `http://${ip}:${port}`;
  const row = event.currentTarget;
  navigator.clipboard.writeText(url).then(() => {
    if (row) {
      const copySpan = row.querySelector('.ip-copy');
      if (copySpan) { copySpan.textContent = 'Copied!'; setTimeout(() => { copySpan.textContent = 'Click to copy'; }, 1500); }
    }
  }).catch(() => {});
};

// ── Log Rendering ─────────────────────────────────────────────

function appendLog(entry) {
  if (emptyLog) emptyLog.remove();

  const div = document.createElement('div');
  div.className = 'log-entry';
  div.innerHTML = `<span class="log-time">${entry.time}</span><span class="log-${entry.level}">${escapeHtml(entry.text)}</span>`;
  logList.appendChild(div);

  // Auto-scroll only if near bottom
  const distFromBottom = logList.scrollHeight - logList.scrollTop - logList.clientHeight;
  if (distFromBottom < 80) logList.scrollTop = logList.scrollHeight;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ── Button Handlers ───────────────────────────────────────────

btnToggle.addEventListener('click', () => {
  if (currentStatus === 'running' || currentStatus === 'starting') {
    window.erp.stopServer();
  } else {
    window.erp.startServer();
  }
});

btnOpen.addEventListener('click', () => {
  if (primaryIp) window.erp.openBrowser(`http://${primaryIp}:5000`);
});

btnSetup.addEventListener('click', () => window.erp.openSetup());

btnClear.addEventListener('click', () => {
  logList.innerHTML = '<div class="empty-log" id="empty-log">Logs cleared.</div>';
});

autostartChk.addEventListener('change', () => {
  window.erp.setAutostart(autostartChk.checked);
});

// ── IPC Listeners ─────────────────────────────────────────────

window.erp.onStatus((data) => applyStatus(data));
window.erp.onLog((entry) => appendLog(entry));

// ── Init ──────────────────────────────────────────────────────

async function init() {
  const state = await window.erp.getStatus();
  applyStatus(state);

  // Render existing logs
  if (state.logs && state.logs.length > 0) {
    state.logs.forEach(appendLog);
  }

  const autostart = await window.erp.getAutostart();
  autostartChk.checked = autostart;
}

init();
