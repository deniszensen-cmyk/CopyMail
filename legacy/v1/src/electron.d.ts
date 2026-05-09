// src/electron.d.ts
// Type definitions for the Electron contextBridge API

interface ElectronAPI {
  setAlwaysOnTop: (value: boolean) => Promise<boolean>;
  getAlwaysOnTop: () => Promise<boolean>;
  copyToClipboard: (data: { text?: string; html?: string; filePath?: string }) => Promise<boolean>;
  startDrag: (path: string) => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
