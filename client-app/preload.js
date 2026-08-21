const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('erpClient', {
  getConfig:            ()        => ipcRenderer.invoke('get-config'),
  saveConfig:           (cfg)     => ipcRenderer.invoke('save-config', cfg),
  connect:              ()        => ipcRenderer.invoke('connect'),
  retry:                ()        => ipcRenderer.invoke('retry'),
  openSettings:         ()        => ipcRenderer.invoke('open-settings'),
  getConnectionStatus:  ()        => ipcRenderer.invoke('get-connection-status'),
  pingServer:           (url)     => ipcRenderer.invoke('ping-server', url),
  getAutostart:         ()        => ipcRenderer.invoke('get-autostart'),
  setAutostart:         (enable)  => ipcRenderer.invoke('set-autostart', enable),

  onConnectionStatus: (cb) => {
    ipcRenderer.on('connection-status', (_, data) => cb(data));
  },
});
