// electron/preload.cjs
// Runs in renderer context but has access to Node — exposes safe API via contextBridge
const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  setAlwaysOnTop: (value) => ipcRenderer.invoke('set-always-on-top', value),
  getAlwaysOnTop: ()      => ipcRenderer.invoke('get-always-on-top'),
  copyToClipboard: (data) => ipcRenderer.invoke('copy-to-clipboard', data),
  startDrag: (path) => ipcRenderer.send('start-drag', path),
  getPathForFile: (file) => webUtils.getPathForFile(file),
});
