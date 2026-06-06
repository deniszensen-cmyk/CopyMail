import { describe, it, expect } from 'vitest';
import {
  addEntry,
  togglePin,
  removeEntry,
  clearUnpinned,
  rotateHistory,
  makeEntry,
  makeSystemEntry,
  MAX_HISTORY_ENTRIES,
  type ClipboardEntry,
} from './clipboardHistory';

function fixture(overrides: Partial<ClipboardEntry> = {}): ClipboardEntry {
  return {
    id: overrides.id ?? Math.random().toString(36).slice(2),
    capturedAt: overrides.capturedAt ?? Date.now(),
    subject: overrides.subject ?? 'Test-Subject',
    from: overrides.from ?? 'Max <max@x.de>',
    date: overrides.date ?? '2026-06-01T08:00:00.000Z',
    snippet: overrides.snippet ?? 'Snippet',
    text: overrides.text ?? 'Text-Body',
    html: overrides.html ?? '<p>Html</p>',
    filePaths: overrides.filePaths ?? [],
    fileCount: overrides.fileCount ?? 0,
    pinned: overrides.pinned ?? false,
    origin: overrides.origin ?? 'single',
    source: overrides.source ?? 'mail',
  };
}

describe('makeEntry', () => {
  it('erzeugt einen Eintrag mit eindeutiger ID und Snippet', () => {
    const e = makeEntry({
      subject: 'Re: Test',
      from: 'a@b.de',
      date: '',
      text: '   Foo   bar   baz   '.repeat(20),
      html: '<p>x</p>',
      filePaths: ['/tmp/a.eml'],
      origin: 'single',
    });
    expect(e.id).toBeTruthy();
    expect(e.fileCount).toBe(1);
    expect(e.snippet.length).toBeLessThanOrEqual(161);
    expect(e.pinned).toBe(false);
  });

  it('faellt auf (Kein Betreff) bei leerem subject', () => {
    const e = makeEntry({ subject: '', from: '', date: '', text: 't', html: '', filePaths: [], origin: 'single' });
    expect(e.subject).toBe('(Kein Betreff)');
  });
});

describe('makeSystemEntry', () => {
  it('nimmt die erste Zeile des Texts als Headline', () => {
    const e = makeSystemEntry({ text: 'Hallo Welt\nzweite Zeile\n' });
    expect(e.subject).toBe('Hallo Welt');
    expect(e.source).toBe('system');
    expect(e.from).toBe('');
  });

  it('kürzt lange erste Zeile auf 60 Zeichen', () => {
    const longLine = 'A'.repeat(120);
    const e = makeSystemEntry({ text: longLine });
    expect(e.subject.length).toBeLessThanOrEqual(60);
    expect(e.subject.endsWith('…')).toBe(true);
  });

  it('fängt leeren Inhalt mit (Zwischenablage) ab', () => {
    const e = makeSystemEntry({ text: '   \n   ' });
    expect(e.subject).toBe('(Zwischenablage)');
  });

  it('source ist immer "system"', () => {
    const e = makeSystemEntry({ text: 'x' });
    expect(e.source).toBe('system');
  });
});

describe('addEntry', () => {
  it('fuegt neuen Eintrag vorn ein', () => {
    const list = [fixture({ id: 'a', text: 'A' })];
    const next = addEntry(fixture({ id: 'b', text: 'B' }), list);
    expect(next[0]?.id).toBe('b');
    expect(next[1]?.id).toBe('a');
  });

  it('dedupliziert identischen Inhalt mit aktuellem Top-Eintrag', () => {
    const a = fixture({ id: 'a', subject: 'S', text: 'X', filePaths: [], capturedAt: 1000 });
    const next = addEntry(
      fixture({ id: 'b', subject: 'S', text: 'X', filePaths: [], capturedAt: 2000 }),
      [a],
    );
    expect(next).toHaveLength(1);
    expect(next[0]?.id).toBe('a'); // alte ID behalten
    expect(next[0]?.capturedAt).toBe(2000); // aber Zeitstempel aktualisiert
  });

  it('rotiert ungepinnte ab MAX_HISTORY_ENTRIES weg, gepinnte bleiben', () => {
    const pinned = fixture({ id: 'pinned', pinned: true, capturedAt: 1, text: 'P' });
    const many: ClipboardEntry[] = [];
    for (let i = 0; i < MAX_HISTORY_ENTRIES + 5; i++) {
      many.push(fixture({ id: `e${i}`, text: `T${i}`, capturedAt: 100 + i }));
    }
    const list = [...many, pinned];
    const next = rotateHistory(list);
    expect(next.some((e) => e.id === 'pinned')).toBe(true);
    expect(next.filter((e) => !e.pinned)).toHaveLength(MAX_HISTORY_ENTRIES);
  });
});

describe('togglePin / removeEntry / clearUnpinned', () => {
  it('togglePin schaltet pinned um', () => {
    const list = [fixture({ id: 'a', pinned: false })];
    const next = togglePin('a', list);
    expect(next[0]?.pinned).toBe(true);
    const back = togglePin('a', next);
    expect(back[0]?.pinned).toBe(false);
  });

  it('removeEntry entfernt nur den passenden Eintrag', () => {
    const list = [fixture({ id: 'a' }), fixture({ id: 'b' }), fixture({ id: 'c' })];
    const next = removeEntry('b', list);
    expect(next.map((e) => e.id)).toEqual(['a', 'c']);
  });

  it('clearUnpinned behaelt nur gepinnte', () => {
    const list = [
      fixture({ id: 'a', pinned: true }),
      fixture({ id: 'b', pinned: false }),
      fixture({ id: 'c', pinned: true }),
      fixture({ id: 'd', pinned: false }),
    ];
    const next = clearUnpinned(list);
    expect(next.map((e) => e.id).sort()).toEqual(['a', 'c']);
  });
});
