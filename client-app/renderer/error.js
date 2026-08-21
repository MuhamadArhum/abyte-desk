// ── Error Page Renderer ───────────────────────────────────────

const urlText    = document.getElementById('url-text');
const btnRetry   = document.getElementById('btn-retry');
const btnSettings = document.getElementById('btn-settings');

btnRetry.addEventListener('click', () => {
  btnRetry.disabled    = true;
  btnRetry.textContent = 'Retrying…';
  window.erpClient.retry();
});

btnSettings.addEventListener('click', () => {
  window.erpClient.openSettings();
});

async function init() {
  const status = await window.erpClient.getConnectionStatus();
  if (status.url) urlText.textContent = status.url;
}

// Re-enable retry button if we're still on error page after a moment
window.erpClient.onConnectionStatus((data) => {
  if (data.status === 'connecting') {
    btnRetry.textContent = 'Retrying…';
    btnRetry.disabled = true;
  } else if (data.status === 'error') {
    btnRetry.textContent = 'Retry';
    btnRetry.disabled = false;
    if (data.url) urlText.textContent = data.url;
  }
});

init();
