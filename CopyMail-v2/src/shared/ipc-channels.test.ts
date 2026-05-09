import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { IPC } from './ipc-channels';

describe('IPC-Konstanten', () => {
  it('TS- und CJS-Variante haben die gleichen Werte', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const cjsPath = resolve(here, '../../electron/ipc-channels.cjs');
    const cjsSrc = readFileSync(cjsPath, 'utf8');

    // Alle einfach-quoted Strings extrahieren, die wie ein Channel aussehen:
    // klein, mit Bindestrichen oder Doppelpunkten.
    const cjsValues = new Set(
      Array.from(cjsSrc.matchAll(/'([a-z][a-z:-]+)'/g))
        .map((m) => m[1])
        .filter((v): v is string => !!v && v.length >= 4 && /[a-z]/.test(v)),
    );

    const tsValues = new Set<string>();
    for (const group of Object.values(IPC)) {
      for (const v of Object.values(group)) tsValues.add(v as string);
    }

    expect([...tsValues].sort()).toEqual([...cjsValues].sort());
  });
});
