import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/utils/**/*.ts', 'src/shared/**/*.ts'],
      exclude: ['src/utils/MsgParser.ts', 'src/**/*.test.ts'],
      // Pragmatische Schwellen: settings.ts und der Fetch-Pfad in
      // updateCheck.ts sind ohne ausgewachsene UI/IPC-Mocks schwer
      // testbar – wir messen primär die Kernlogik (Parser, Sanitizer,
      // Templates, Highlight, Semver).
      thresholds: {
        lines: 45,
        functions: 60,
        branches: 60,
        statements: 45,
      },
    },
  },
});
