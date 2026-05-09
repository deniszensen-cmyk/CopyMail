import { describe, it, expect } from 'vitest';
import { renderText, renderHtml, DEFAULT_TEXT_TEMPLATE, DEFAULT_HTML_TEMPLATE } from './forwardTemplate';
import type { EmailData } from './EmailProcessor';

const data: EmailData = {
  from: 'A <a@b.de>',
  to: '',
  date: '2026-01-02T10:30:00.000Z',
  subject: 'Hi <Test>',
  body: 'Zeile 1',
};

const ctx = {
  data,
  bodyText: 'Zeile 1',
  bodyHtml: '<p>Zeile 1</p>',
  dateStr: '02.01.2026, 10:30',
};

describe('forwardTemplate', () => {
  it('uses default templates when null is passed', () => {
    const t = renderText(null, ctx);
    expect(t).toContain('Von: A <a@b.de>');
    expect(t).toContain('Betreff: Hi <Test>');
  });

  it('omits An-Block bei leerem Empfänger im Default-Text-Template', () => {
    const t = renderText(null, ctx);
    expect(t).not.toContain('An:');
  });

  it('rendert An-Block nur, wenn to nicht leer', () => {
    const ctx2 = { ...ctx, data: { ...data, to: 'C <c@d.de>' } };
    const t = renderText(null, ctx2);
    expect(t).toContain('An: C <c@d.de>');
  });

  it('escapt HTML im HTML-Template', () => {
    const h = renderHtml(null, ctx);
    expect(h).toContain('Hi &lt;Test&gt;');
    expect(h).not.toContain('Hi <Test>');
  });

  it('akzeptiert eigene Templates', () => {
    const own = 'X={subject} Y={from}';
    const out = renderText(own, ctx);
    expect(out).toBe('X=Hi <Test> Y=A <a@b.de>');
  });

  it('Default-Konstanten existieren', () => {
    expect(DEFAULT_TEXT_TEMPLATE.length).toBeGreaterThan(0);
    expect(DEFAULT_HTML_TEMPLATE.length).toBeGreaterThan(0);
  });
});
