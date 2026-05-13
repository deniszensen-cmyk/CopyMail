// src/electron.d.ts
import type { Settings } from './utils/settings';

export interface ClipboardPayload {
  text?: string;
  html?: string;
  filePath?: string;
  filePaths?: string[];
}

export interface ClipboardResult {
  success: boolean;
  partial?: boolean;
  message?: string;
}

export interface ElectronAPI {
  setAlwaysOnTop: (value: boolean) => Promise<boolean>;
  getAlwaysOnTop: () => Promise<boolean>;
  copyToClipboard: (data: ClipboardPayload) => Promise<ClipboardResult>;
  startDrag: (path: string | string[]) => void;
  registerFile: (path: string) => Promise<string | null>;
  getPathForFile: (file: File) => string;
  windowMinimize: () => Promise<void>;
  windowToggleMaximize: () => Promise<boolean>;
  windowClose: () => Promise<void>;
  windowIsMaximized: () => Promise<boolean>;
  windowFocus: () => Promise<void>;
  onMaximizeChanged: (cb: (isMaximized: boolean) => void) => () => void;
  loadSettings: () => Promise<Partial<Settings> | null>;
  saveSettings: (cfg: Settings) => Promise<boolean>;
  configPath: () => Promise<string>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
