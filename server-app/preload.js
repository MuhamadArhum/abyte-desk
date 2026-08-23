const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('erp', {
  getStatus:     ()       => ipcRenderer.invoke('get-status'),
  startServer:   ()       => ipcRenderer.invoke('server-start'),
  stopServer:    ()       => ipcRenderer.invoke('server-stop'),
  openSetup:     ()       => ipcRenderer.invoke('open-setup'),
  openBrowser:   (url)    => ipcRenderer.invoke('open-browser', url),
  getConfig:     ()       => ipcRenderer.invoke('get-config'),
  saveConfig:    (cfg)    => ipcRenderer.invoke('save-config', cfg),
  testConnection: (cfg)   => ipcRenderer.invoke('test-connection', cfg),
  initDb:        (cfg)    => ipcRenderer.invoke('init-db', cfg),
  getAutostart:  ()       => ipcRenderer.invoke('get-autostart'),
  setAutostart:  (enable) => ipcRenderer.invoke('set-autostart', enable),

  checkMariaDB:   ()      => ipcRenderer.invoke('check-mariadb'),
  installMariaDB: ()      => ipcRenderer.invoke('install-mariadb'),

  onStatus: (cb) => {
    ipcRenderer.on('status', (_, data) => cb(data));
  },
  onLog: (cb) => {
    ipcRenderer.on('log',    (_, entry) => cb(entry));
  },
  onMariaDbProgress: (cb) => {
    ipcRenderer.on('mariadb-progress', (_, data) => cb(data));
  },
});
