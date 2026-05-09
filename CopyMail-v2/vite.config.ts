import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(resolve(here, 'package.json'), 'utf-8')) as { version: string };

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // base './' is required for Electron production builds (file:// protocol)
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
});
