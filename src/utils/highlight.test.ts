import { describe, it, expect } from 'vitest';
import { highlight } from './highlight';

describe('highlight', () => {
  it('lässt HTML ohne Treffer unverändert', () => {
    expect(highlight('<p>nichts</p>', 'xyz')).toBe('<p>nichts</p>');
  });

  it('markiert Text-Treffer', () => {
    const out = highlight('<p>Hello world</p>', 'world');
    expect(out).toContain('<mark class="cm-hl">world</mark>');
  });

  it('ignoriert Treffer in Tag-Namen / Attributen', () => {
    const out = highlight('<a href="world">x</a>', 'world');
    // Treffer im Attribut soll NICHT markiert werden (>...< basiert)
    expect(out).not.toContain('<mark class="cm-hl">world</mark>');
  });

  it('ist case-insensitive', () => {
    const out = highlight('<p>Welt</p>', 'WELT');
    expect(out).toContain('<mark class="cm-hl">Welt</mark>');
  });

  it('ignoriert leere Suche', () => {
    expect(highlight('<p>text</p>', '   ')).toBe('<p>text</p>');
  });
});
