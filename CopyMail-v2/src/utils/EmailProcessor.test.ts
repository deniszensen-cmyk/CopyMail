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
