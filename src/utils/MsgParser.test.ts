import { describe, it, expect } from 'vitest';
import { parseMsgBuffer } from './MsgParser';

describe('parseMsgBuffer Eingangs-Validierung', () => {
  it('wirft bei zu kleiner Datei', async () => {
    const tiny = new ArrayBuffer(16);
    await expect(parseMsgBuffer(tiny)).rejects.toThrow(/zu klein/i);
  });

  it('wirft bei fehlendem OLE2-Magic', async () => {
    const buf = new ArrayBuffer(1024);
    const bytes = new Uint8Array(buf);
    bytes.fill(0x42);
    await expect(parseMsgBuffer(buf)).rejects.toThrow(/Magic/i);
  });

  it('wirft bei Magic, aber ansonsten unsinnigem Header', async () => {
    // Magic ist gesetzt, aber Sektor-Shift = 0 → ungültige Sektorgröße.
    // Der Parser darf hier *werfen*, soll aber nicht hängen oder OOM gehen.
    const buf = new ArrayBuffer(1024);
    const bytes = new Uint8Array(buf);
    const magic = [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1];
    for (let i = 0; i < magic.length; i++) bytes[i] = magic[i] ?? 0;
    await expect(parseMsgBuffer(buf)).rejects.toBeDefined();
  });

  // Ein vollständiger Round-Trip mit realen MAPI-Properties (Subject, Sender,
  // Body) erfordert eine echte .msg-Fixture-Datei. Sobald entsprechende
  // Test-Mails im Repo verfügbar sind (z.B. unter src/utils/__fixtures__/),
  // sollte hier ein parametrisierter Roundtrip-Test ergänzt werden.
  it.todo('parst eine echte .msg-Fixture korrekt (Subject + From + Body)');
});
