const { contextBridge, ipcRenderer, webUtils } = require('electron');
const IPC = require('./ipc-channels.cjs');

const maximizeListeners = new Set();
ipcRenderer.on(IPC.Window.MaximizeChanged, (_e, isMax) => {
  for (const cb of maximizeListeners) {
    try { cb(!!isMax); } catch { /* ignore */ }
  }
});

const watcherListeners = new Set();
ipcRenderer.on(IPC.Watcher.Changed, (_e, payload) => {
  for (const cb of watcherListeners) {
    try { cb(payload); } catch { /* ignore */ }
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
  loadClipboardHistory: () => ipcRenderer.invoke(IPC.History.Load),
  saveClipboardHistory: (entries) => ipcRenderer.invoke(IPC.History.Save, entries),
  clearClipboardHistory: () => ipcRenderer.invoke(IPC.History.Clear),
  startWatcher: () => ipcRenderer.invoke(IPC.Watcher.Start),
  stopWatcher: () => ipcRenderer.invoke(IPC.Watcher.Stop),
  suspendWatcher: (text) => ipcRenderer.invoke(IPC.Watcher.Suspend, text),
  onClipboardChange: (cb) => {
    if (typeof cb !== 'function') return () => undefined;
    watcherListeners.add(cb);
    return () => watcherListeners.delete(cb);
  },
});
