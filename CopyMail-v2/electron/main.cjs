// electron/main.cjs
const {
  app, BrowserWindow, ipcMain, shell, clipboard, nativeImage, session,
  Tray, Menu, globalShortcut,
} = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const IPC = require('./ipc-channels.cjs');
const log = require('electron-log/main');

// Logger: Datei-Rotation in userData/logs, Konsole nur warnings+ aufwärts.
log.transports.file.maxSize = 1024 * 1024; // 1 MB pro Datei
log.transports.file.level = process.env.COPYMAIL_LOG_LEVEL || 'info';
log.transports.console.level = 'warn';
log.initialize();
log.info(`CopyMail starting (dev=${!app.isPackaged})`);
process.on('uncaughtException', (err) => log.error('uncaughtException:', err));
process.on('unhandledRejection', (err) => log.error('unhandledRejection:', err));

const isDev = !app.isPackaged;
let mainWindow = null;
let tray = null;

const allowedFilePaths = new Set();

function registerFile(filePath) {
  if (typeof filePath !== 'string' || !filePath) return null;
  const absolute = path.resolve(filePath);
  if (!fs.existsSync(absolute)) return null;
  if (allowedFilePaths.size > 50) {
    const first = allowedFilePaths.values().next().value;
    if (first) allowedFilePaths.delete(first);
  }
  allowedFilePaths.add(absolute);
  return absolute;
}

function isAllowedPath(candidate) {
  if (typeof candidate !== 'string' || !candidate) return false;
  return allowedFilePaths.has(path.resolve(candidate));
}

function configPath() {
  return path.join(app.getPath('userData'), 'config.json');
}

function loadConfig() {
  try {
    const raw = fs.readFileSync(configPath(), 'utf8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function saveConfig(cfg) {
  try {
    fs.mkdirSync(path.dirname(configPath()), { recursive: true });
    fs.writeFileSync(configPath(), JSON.stringify(cfg, null, 2), 'utf8');
    return true;
  } catch (err) {
    log.error('saveConfig failed:', err);
    return false;
  }
}

function installCsp() {
  const cspProd =
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; " +
    "font-src 'self' data:; img-src 'self' data: blob: cid: https:; " +
    "connect-src 'self' https:; " +
    "frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none';";
  const cspDev =
    "default-src 'self' http://localhost:* ws://localhost:*; " +
    "script-src 'self' 'unsafe-eval' 'unsafe-inline' http://localhost:*; " +
    "style-src 'self' 'unsafe-inline' http://localhost:*; " +
    "font-src 'self' data: http://localhost:*; " +
    "img-src 'self' data: blob: cid: https: http://localhost:*; " +
    "connect-src 'self' ws://localhost:* http://localhost:* https:; " +
    "frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none';";
  const csp = isDev ? cspDev : cspProd;
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [csp],
        'X-Content-Type-Options': ['nosniff'],
      },
    });
  });
}

function safeUrl(value) {
  try { return new URL(value); } catch { return null; }
}

function hardenWebContents(wc) {
  wc.on('will-navigate', (event, url) => {
    const target = safeUrl(url);
    const current = safeUrl(wc.getURL());
    if (!target || !current) { event.preventDefault(); return; }
    if (target.origin !== current.origin) {
      event.preventDefault();
      if (target.protocol === 'http:' || target.protocol === 'https:') {
        shell.openExternal(target.href);
      }
    }
  });
  wc.on('will-attach-webview', (e) => e.preventDefault());
  wc.setWindowOpenHandler(({ url }) => {
    const target = safeUrl(url);
    if (target && (target.protocol === 'http:' || target.protocol === 'https:')) {
      shell.openExternal(target.href);
    }
    return { action: 'deny' };
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 540, height: 720, minWidth: 420, minHeight: 500,
    title: 'CopyMail v2', backgroundColor: '#0a0f1e', show: false,
    frame: false, titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true, nodeIntegration: false, sandbox: true,
      webSecurity: true, allowRunningInsecureContent: false,
      disableBlinkFeatures: 'Auxclick',
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5180');
    if (process.env.COPYMAIL_DEVTOOLS === '1') {
      mainWindow.webContents.openDevTools({ mode: 'detach' });
    }
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  hardenWebContents(mainWindow.webContents);

  mainWindow.once('ready-to-show', () => {
    if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
  });

  const sendMaximize = () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IPC.Window.MaximizeChanged, mainWindow.isMaximized());
    }
  };
  mainWindow.on('maximize', sendMaximize);
  mainWindow.on('unmaximize', sendMaximize);

  // Schließen → Tray, App bleibt im Hintergrund
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
}

function createTray() {
  const iconPath = getMailIconPath();
  const trayIcon = iconPath ? nativeImage.createFromPath(iconPath) : nativeImage.createEmpty();
  tray = new Tray(trayIcon.isEmpty() ? nativeImage.createEmpty() : trayIcon);
  tray.setToolTip('CopyMail');

  const updateMenu = () => {
    const menu = Menu.buildFromTemplate([
      { label: 'CopyMail anzeigen', click: () => bringToFront() },
      { type: 'separator' },
      {
        label: 'Always on Top',
        type: 'checkbox',
        checked: mainWindow ? mainWindow.isAlwaysOnTop() : false,
        click: (item) => {
          if (mainWindow) mainWindow.setAlwaysOnTop(item.checked, 'screen-saver');
        },
      },
      { type: 'separator' },
      { label: 'Beenden', click: () => { app.isQuitting = true; app.quit(); } },
    ]);
    tray.setContextMenu(menu);
  };
  updateMenu();

  tray.on('double-click', () => bringToFront());
}

function bringToFront() {
  if (!mainWindow) { createWindow(); return; }
  if (mainWindow.isMinimized()) mainWindow.restore();
  if (!mainWindow.isVisible()) mainWindow.show();
  mainWindow.focus();
}

function getMailIconPath() {
  const candidates = [
    path.join(__dirname, '..', 'public', 'mail-icon.png'),
    path.join(__dirname, '..', 'dist', 'mail-icon.png'),
    path.join(process.resourcesPath || '', 'app.asar.unpacked', 'public', 'mail-icon.png'),
    path.join(process.resourcesPath || '', 'mail-icon.png'),
  ];
  return candidates.find((c) => fs.existsSync(c)) || null;
}

app.whenReady().then(() => {
  installCsp();
  createWindow();
  try { createTray(); } catch { /* tray ist nice-to-have */ }
  // Globaler Hotkey: Strg+Alt+M holt CopyMail in den Vordergrund
  try {
    globalShortcut.register('Control+Alt+M', () => bringToFront());
  } catch { /* ignore */ }
});

app.on('window-all-closed', (e) => {
  // App bleibt im Hintergrund (Tray) – nur Quit-Flag beendet sie wirklich.
  if (process.platform === 'darwin') return;
  if (!app.isQuitting) e?.preventDefault?.();
});

app.on('before-quit', () => { app.isQuitting = true; });
app.on('will-quit', () => { try { globalShortcut.unregisterAll(); } catch { /* ignore */ } });

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on('web-contents-created', (_event, contents) => hardenWebContents(contents));

// ---- IPC ----

ipcMain.handle(IPC.Window.Minimize, () => { if (mainWindow) mainWindow.minimize(); });
ipcMain.handle(IPC.Window.ToggleMaximize, () => {
  if (!mainWindow) return false;
  if (mainWindow.isMaximized()) mainWindow.unmaximize(); else mainWindow.maximize();
  return mainWindow.isMaximized();
});
ipcMain.handle(IPC.Window.Close, () => { if (mainWindow) mainWindow.close(); });
ipcMain.handle(IPC.Window.IsMaximized, () => mainWindow ? mainWindow.isMaximized() : false);
ipcMain.handle(IPC.Window.Focus, () => bringToFront());

ipcMain.handle(IPC.Config.Load, () => loadConfig());
ipcMain.handle(IPC.Config.Save, (_e, cfg) => saveConfig(cfg ?? {}));
ipcMain.handle(IPC.Config.Path, () => configPath());

ipcMain.handle(IPC.Files.Register, (_e, filePath) => registerFile(filePath));

ipcMain.on(IPC.Files.StartDrag, (event, filePath) => {
  if (!isAllowedPath(filePath)) return;
  const absolute = path.resolve(filePath);
  const iconPath = getMailIconPath();
  const icon = iconPath ? nativeImage.createFromPath(iconPath) : nativeImage.createEmpty();
  event.sender.startDrag({ file: absolute, icon });
});

ipcMain.handle(IPC.Clipboard.Copy, async (_event, payload) => {
  try {
    const { text, html } = payload || {};
    let { filePath, filePaths } = payload || {};
    if (filePath && !filePaths) filePaths = [filePath];
    filePaths = Array.isArray(filePaths) ? filePaths.filter((p) => typeof p === 'string' && p) : [];

    if (filePaths.length > 0) {
      const valid = filePaths.filter(isAllowedPath).map((p) => path.resolve(p));
      if (valid.length === 0) return { success: false, message: 'Dateipfade sind nicht freigegeben.' };

      const helperResult = await writeNativeClipboard({
        text: typeof text === 'string' ? text : '',
        html: typeof html === 'string' ? html : '',
        filePaths: valid,
      });
      if (helperResult.success) return { success: true };
      if (text || html) {
        clipboard.write({
          text: typeof text === 'string' ? text : '',
          html: typeof html === 'string' && html ? html : undefined,
        });
        return {
          success: true, partial: true,
          message: `Text wurde kopiert, Datei konnte nicht angehängt werden: ${helperResult.message}`,
        };
      }
      return helperResult;
    }

    const data = {};
    if (typeof text === 'string' && text) data.text = text;
    if (typeof html === 'string' && html) data.html = html;
    clipboard.write(data);
    return { success: true };
  } catch (err) {
    return { success: false, message: err && err.message ? err.message : 'Kopieren fehlgeschlagen.' };
  }
});

function getClipboardHelperCommand() {
  const packagedExe = path.join(process.resourcesPath || '', 'clipboard-helper', 'CopyMailClipboard.exe');
  const devExe = path.join(__dirname, '..', 'native', 'ClipboardHelper', 'publish', 'CopyMailClipboard.exe');
  if (fs.existsSync(packagedExe)) return { command: packagedExe, args: [] };
  if (fs.existsSync(devExe)) return { command: devExe, args: [] };
  return null;
}

function writeNativeClipboard(payload) {
  return new Promise((resolve) => {
    const helper = getClipboardHelperCommand();
    if (!helper) return resolve({ success: false, message: 'Clipboard-Helper fehlt.' });
    const child = spawn(helper.command, helper.args, { windowsHide: true, stdio: ['pipe', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('error', (err) => resolve({ success: false, message: err.message }));
    child.on('close', (code) => {
      if (code === 0) resolve({ success: true });
      else resolve({ success: false, message: stderr.trim() || `Clipboard-Helper beendet mit Code ${code}.` });
    });
    child.stdin.end(JSON.stringify(payload));
  });
}

ipcMain.handle(IPC.Pin.Set, (_e, value) => {
  if (mainWindow) mainWindow.setAlwaysOnTop(!!value, 'screen-saver');
  return !!value;
});
ipcMain.handle(IPC.Pin.Get, () => mainWindow ? mainWindow.isAlwaysOnTop() : false);
