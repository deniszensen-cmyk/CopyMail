// electron/main.cjs
// Electron main process — CJS required (Electron doesn't support ESM natively)
const { app, BrowserWindow, ipcMain, shell, clipboard, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');

const isDev = !app.isPackaged;

/** @type {BrowserWindow | null} */
let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 540,
    height: 720,
    minWidth: 420,
    minHeight: 500,
    title: 'CopyMail',
    backgroundColor: '#0a0f1e',
    show: false, // shown after ready-to-show to avoid flash
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5180');
    // mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  // Open external links in system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// ---- IPC Handlers ----

ipcMain.on('start-drag', (event, filePath) => {
  const absolutePath = path.resolve(filePath);
  console.log('IPC: start-drag ->', absolutePath);
  
  event.sender.startDrag({
    file: absolutePath,
    icon: nativeImage.createEmpty(),
  });
});

ipcMain.handle('copy-to-clipboard', async (_event, { text, html, filePath }) => {
  try {
    console.log('IPC: copy-to-clipboard', { hasText: !!text, hasFile: !!filePath });
    const data = {};
    if (text) data.text = text;
    if (html) data.html = html;
    
    // Clear and write basic text/HTML first
    clipboard.write(data); 

    if (filePath) {
      const absolutePath = path.resolve(filePath);
      
      // 1. Native Windows file format (FileNameW)
      const bufferW = Buffer.from(absolutePath + '\0', 'ucs2');
      clipboard.writeBuffer('FileNameW', bufferW);
      
      // 2. Browser/URI format (text/uri-list)
      const uri = `file:///${absolutePath.replace(/\\/g, '/')}`;
      const uriBuffer = Buffer.from(uri, 'utf8');
      clipboard.writeBuffer('text/uri-list', uriBuffer);
      
      // If we are in "File only" mode, text was empty, but some apps still want it
      if (!text) {
        clipboard.writeText(absolutePath);
      }
    }
    return true;
  } catch (err) {
    console.error('Failed to copy to clipboard:', err);
    return false;
  }
});

ipcMain.handle('set-always-on-top', (_event, value) => {
  if (mainWindow) {
    // 'screen-saver' level keeps it above most windows including taskbar popups
    mainWindow.setAlwaysOnTop(value, 'screen-saver');
  }
  return value;
});

ipcMain.handle('get-always-on-top', () => {
  return mainWindow ? mainWindow.isAlwaysOnTop() : false;
});
