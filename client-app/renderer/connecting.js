// ── Connecting Page Renderer ──────────────────────────────────

const urlLabel = document.getElementById('url-label');

async function init() {
  const status = await window.erpClient.getConnectionStatus();
  if (status.url) urlLabel.textContent = status.url;
}

init();
