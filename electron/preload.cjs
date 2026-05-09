const { contextBridge, ipcRenderer, webUtils } = require('electron');
const IPC = require('./ipc-channels.cjs');

const maximizeListeners = new Set();
ipcRenderer.on(IPC.Window.MaximizeChanged, (_e, isMax) => {
  for (const cb of maximizeListeners) {
    try { cb(!!isMax); } catch { /* ignore */ }
  }
});

contextBridge.exposeInMainWorld('electronAPI', {
  setAlwaysOnTop: (value) => ipcRenderer.invoke(IPC.Pin.Set, !!value),
  getAlwaysOnTop: () => ipcRenderer.invoke(IPC.Pin.Get),
  copyToClipboard: (data) => ipcRenderer.invoke(IPC.Clipboard.Copy, data),
  startDrag: (filePath) => ipcRenderer.send(IPC.Files.StartDrag, filePath),
  registerFile: (filePath) => ipcRenderer.invoke(IPC.Files.Register, filePath),
  getPathForFile: (file) => {
    try { return webUtils.getPathForFile(file); } catch { return ''; }
  },
  windowMinimize: () => ipcRenderer.invoke(IPC.Window.Minimize),
  windowToggleMaximize: () => ipcRenderer.invoke(IPC.Window.ToggleMaximize),
  windowClose: () => ipcRenderer.invoke(IPC.Window.Close),
  windowIsMaximized: () => ipcRenderer.invoke(IPC.Window.IsMaximized),
  windowFocus: () => ipcRenderer.invoke(IPC.Window.Focus),
  onMaximizeChanged: (cb) => {
    if (typeof cb !== 'function') return () => undefined;
    maximizeListeners.add(cb);
    return () => maximizeListeners.delete(cb);
  },
  loadSettings: () => ipcRenderer.invoke(IPC.Config.Load),
  saveSettings: (cfg) => ipcRenderer.invoke(IPC.Config.Save, cfg),
  configPath: () => ipcRenderer.invoke(IPC.Config.Path),
});
