import { describe, it, expect } from 'vitest';
import {
  escHtml,
  formatForwardedEmail,
  isSupportedFile,
  getExtension,
  sanitizeMailHtml,
  type EmailData,
} from './EmailProcessor';

function fakeFile(name: string, size = 1024): File {
  const blob = new Blob([new Uint8Array(size)]);
  return new File([blob], name);
}

describe('escHtml', () => {
  it('escapes HTML metacharacters including quotes', () => {
    const out = escHtml(`<a href="x" onclick='alert(1)'>&copy;</a>`);
    expect(out).toBe('&lt;a href=&quot;x&quot; onclick=&#39;alert(1)&#39;&gt;&amp;copy;&lt;/a&gt;');
  });

  it('returns empty string unchanged', () => {
    expect(escHtml('')).toBe('');
  });
});

describe('getExtension / isSupportedFile', () => {
  it('handles common extensions', () => {
    expect(getExtension('mail.MSG')).toBe('msg');
    expect(getExtension('mail.eml')).toBe('eml');
    expect(getExtension('foo.bar.txt')).toBe('txt');
    expect(getExtension('noext')).toBe('');
  });

  it('accepts only supported files', () => {
    expect(isSupportedFile(fakeFile('a.msg'))).toBe(true);
    expect(isSupportedFile(fakeFile('a.eml'))).toBe(true);
    expect(isSupportedFile(fakeFile('a.txt'))).toBe(false);
    expect(isSupportedFile(fakeFile('a'))).toBe(false);
  });
});

describe('sanitizeMailHtml', () => {
  it('removes <script> tags', () => {
    const out = sanitizeMailHtml('<div>ok<script>alert(1)</script></div>');
    expect(out).not.toContain('<script');
    expect(out).toContain('ok');
  });

  it('strips event handler attributes', () => {
    const out = sanitizeMailHtml('<img src="x" onerror="alert(1)">');
    expect(out).not.toContain('onerror');
  });

  it('strips javascript: URLs', () => {
    const out = sanitizeMailHtml('<a href="javascript:alert(1)">x</a>');
    expect(out).not.toContain('javascript:');
  });

  it('keeps cid: image URLs', () => {
    const out = sanitizeMailHtml('<img src="cid:logo">');
    expect(out).toContain('cid:logo');
  });
});

describe('formatForwardedEmail', () => {
  const base: EmailData = {
    from: 'A <a@b.de>',
    to: 'C <c@d.de>',
    date: '2026-01-02T10:30:00.000Z',
    subject: 'Hallo & Tschüss <Test>',
    body: 'Zeile 1\nZeile 2\n\nNeuer Absatz',
  };

  it('escapes header fields', () => {
    const { html } = formatForwardedEmail(base);
    expect(html).toContain('Hallo &amp; Tsch');
    expect(html).toContain('&lt;Test&gt;');
  });

  it('produces both text and html', () => {
    const out = formatForwardedEmail(base);
    expect(out.text).toContain('Von: A <a@b.de>');
    expect(out.text).toContain('Betreff: Hallo & Tschüss <Test>');
    expect(out.html.length).toBeGreaterThan(out.text.length);
  });

  it('omits An-Zeile bei leerem Empfänger', () => {
    const out = formatForwardedEmail({ ...base, to: '' });
    expect(out.text).not.toContain('An:');
    expect(out.html).not.toContain('<b>An:</b>');
  });

  it('sanitisiert HTML-Body', () => {
    const out = formatForwardedEmail({
      ...base,
      bodyHtml: '<html><body><p>ok</p><script>alert(1)</script></body></html>',
    });
    expect(out.html).toContain('ok');
    expect(out.html).not.toContain('<script');
  });

  it('escapt Plain-Text-Body', () => {
    const out = formatForwardedEmail({
      ...base,
      body: '<script>alert(1)</script>',
    });
    expect(out.html).not.toContain('<script>alert');
    expect(out.html).toContain('&lt;script&gt;');
  });
});

describe('stripSignature (Strikt-Modus für Bitrix/Confluence)', () => {
  const base: EmailData = {
    from: 'Christoph Drube <christoph@example.de>',
    to: '',
    date: '2026-06-01T08:00:00.000Z',
    subject: 'Test',
    body: '',
  };

  it('schneidet Signatur ab "Mit freundlichen Grüßen", behaelt Name', () => {
    const body = [
      'Sehr geehrte Damen und Herren,',
      '',
      'anbei die gewünschte Auskunft.',
      '',
      'Mit freundlichen Grüßen',
      '',
      'Christoph Drube',
      'Chief of Staff',
      'office people Personalmanagement GmbH',
      'Tel: +49 251 ...',
    ].join('\n');
    const out = formatForwardedEmail({ ...base, body }, { stripSignature: true });
    expect(out.text).toContain('anbei die gewünschte Auskunft.');
    expect(out.text).toContain('Mit freundlichen Grüßen');
    expect(out.text).toContain('Christoph Drube');
    expect(out.text).not.toContain('Tel:');
    expect(out.text).not.toContain('Chief of Staff');
  });

  it('haengt MfG + Name selbst an wenn keine Grußformel im Body', () => {
    const body = 'Kurze Antwort ohne Schluss.';
    const out = formatForwardedEmail(
      { ...base, body, from: 'Max Mustermann <max@firma.de>' },
      { stripSignature: true },
    );
    expect(out.text).toContain('Kurze Antwort ohne Schluss.');
    expect(out.text).toContain('Mit freundlichen Grüßen');
    expect(out.text).toContain('Max Mustermann');
  });

  it('verwirft HTML-Body komplett (keine Tabellen im Output)', () => {
    const out = formatForwardedEmail(
      {
        ...base,
        body: 'Inhalt.\n\nMit freundlichen Grüßen\nChristoph',
        bodyHtml: '<html><body><p>Inhalt.</p><table><tr><td>X</td></tr></table></body></html>',
      },
      { stripSignature: true },
    );
    expect(out.html).not.toMatch(/<table\b/);
    expect(out.html).toContain('Inhalt.');
  });

  it('faellt auf Local-Part der Mail-Adresse zurueck wenn kein Name im From', () => {
    const out = formatForwardedEmail(
      { ...base, from: 'max.mustermann@firma.de', body: '' },
      { stripSignature: true },
    );
    expect(out.text).toContain('Max Mustermann');
  });

  it('erkennt "Beste Grüße" / "Kind regards" / "MfG"', () => {
    const cases = [
      'Inhalt.\n\nBeste Grüße\nA. Person',
      'Content.\n\nKind regards\nP. Erson',
      'Kurz.\n\nMfG\nName',
    ];
    for (const body of cases) {
      const out = formatForwardedEmail({ ...base, body }, { stripSignature: true });
      const trimmed = out.text;
      expect(trimmed.toLowerCase()).toMatch(/grüße|regards|mfg/);
    }
  });
});

describe('Tabellen-Rahmen-Neutralisierung (Signatur-Fix)', () => {
  const base: EmailData = {
    from: 'A <a@b.de>',
    to: '',
    date: '2026-06-01T08:00:00.000Z',
    subject: 'Sig-Test',
    body: 'irgendwas',
  };

  it('setzt border="0" auf Outlook-Signatur-Tabelle ohne border-Attribut', () => {
    const out = formatForwardedEmail({
      ...base,
      bodyHtml: '<html><body><table class="MsoNormalTable"><tr><td>Logo</td></tr></table></body></html>',
    });
    expect(out.html).toMatch(/<table\b[^>]*border="0"/);
  });

  it('ergaenzt Inline-style border:none auf table/tr/td', () => {
    const out = formatForwardedEmail({
      ...base,
      bodyHtml: '<table><tr><td>x</td></tr></table>',
    });
    // Inline-Style mit border:none erscheint mindestens auf der table und der Zelle
    expect(out.html).toMatch(/<table\b[^>]*style\s*=\s*["'][^"']*border\s*:\s*none/i);
    expect(out.html).toMatch(/<td\b[^>]*style\s*=\s*["'][^"']*border\s*:\s*none/i);
  });

  it('respektiert explizit gesetzte Rahmen (Sender will Rahmen)', () => {
    const out = formatForwardedEmail({
      ...base,
      bodyHtml: '<table><tr><td style="border:1px solid #abc">Box</td></tr></table>',
    });
    // unsere border:none darf hier NICHT die explizite Border ueberschreiben
    expect(out.html).toContain('border:1px solid #abc');
  });

  it('behaelt <style>-Bloecke aus dem head (DOMPurify-Allow)', () => {
    const out = formatForwardedEmail({
      ...base,
      bodyHtml:
        '<html><head><style>.MsoNormalTable{font-family:Calibri;}</style></head>' +
        '<body><table class="MsoNormalTable"><tr><td>Sig</td></tr></table></body></html>',
    });
    expect(out.html).toContain('MsoNormalTable{font-family:Calibri');
  });

  it('schreibt den !important-Reset in den Output', () => {
    const out = formatForwardedEmail({
      ...base,
      bodyHtml: '<table><tr><td>x</td></tr></table>',
    });
    expect(out.html).toContain('border:none !important');
    expect(out.html).toContain('border-collapse:collapse !important');
  });
});
