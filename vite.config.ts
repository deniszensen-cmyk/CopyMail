import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(resolve(here, 'package.json'), 'utf-8')) as { version: string };

// Drei Modi:
//   default     -> dist/ mit assets/ Unterordner (Electron-Build, Web-Hosting)
//   web         -> dist-web/ wie default, aber separate Build-Outputs ohne Electron-Spezifika
//   singlefile  -> dist-single/copymail.html (alles inline, eine Datei, Doppelklick)
export default defineConfig(({ mode }) => {
  const isSingle = mode === 'singlefile';
  const isWeb = mode === 'web' || isSingle;
  return {
    plugins: [
      react(),
      ...(isSingle ? [viteSingleFile()] : []),
    ],
    base: './',
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
    },
    build: {
      outDir: isSingle ? 'dist-single' : (isWeb ? 'dist-web' : 'dist'),
      emptyOutDir: true,
    },
  };
});
