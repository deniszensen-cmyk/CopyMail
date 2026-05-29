import { describe, it, expect } from 'vitest';
import {
  hasQuotedReplyText, stripQuotedReplyText,
  hasQuotedReplyHtml, stripQuotedReplyHtml,
  detectQuote,
} from './quotedReply';

describe('Quoted-Reply Erkennung (Text)', () => {
  it('erkennt Outlook-DE-Header', () => {
    const body = [
      'Meine Antwort hier.',
      '',
      'Von: Max <max@x.de>',
      'Gesendet: Freitag, 10. Februar 2026 14:30',
      'An: Anna <anna@y.de>',
      'Betreff: Re: Projekt',
      '',
      'Hallo Anna,',
      '',
      'das hier ist die alte Mail.',
    ].join('\n');
    expect(hasQuotedReplyText(body)).toBe(true);
    expect(stripQuotedReplyText(body)).toBe('Meine Antwort hier.');
  });

  it('erkennt Outlook-EN-Header', () => {
    const body = 'Reply on top.\n\nFrom: a\nSent: x\nTo: b\nSubject: y\n\nold body';
    expect(hasQuotedReplyText(body)).toBe(true);
    expect(stripQuotedReplyText(body)).toBe('Reply on top.');
  });

  it('erkennt -----Original Message-----', () => {
    const body = 'New text.\n\n-----Original Message-----\nFrom: a\n';
    expect(stripQuotedReplyText(body)).toBe('New text.');
  });

  it('erkennt "Am ... schrieb ...:"', () => {
    const body = 'Antwort\n\nAm 12.02.2026 um 09:15 schrieb Max <max@y.de>:\n> alter Inhalt';
    expect(stripQuotedReplyText(body)).toBe('Antwort');
  });

  it('erkennt "On ... wrote:"', () => {
    const body = 'Reply\n\nOn Friday, 10 Feb, Anna wrote:\n> old';
    expect(stripQuotedReplyText(body)).toBe('Reply');
  });

  it('laesst Mails ohne Zitat unveraendert', () => {
    const body = 'Nur eine normale Mail ohne Zitate.';
    expect(hasQuotedReplyText(body)).toBe(false);
    expect(stripQuotedReplyText(body)).toBe(body);
  });
});

describe('Quoted-Reply Erkennung (HTML)', () => {
  it('erkennt Outlook-Forward-Container per border-top:solid', () => {
    const html = '<p>Antwort</p><div style="border:none;border-top:solid #E1E1E1 1pt"><b>Von:</b> X</div>';
    expect(hasQuotedReplyHtml(html)).toBe(true);
    expect(stripQuotedReplyHtml(html)).toBe('<p>Antwort</p>');
  });

  it('erkennt gmail_quote', () => {
    const html = '<div>Hello</div><blockquote class="gmail_quote">old</blockquote>';
    expect(hasQuotedReplyHtml(html)).toBe(true);
    const stripped = stripQuotedReplyHtml(html);
    expect(stripped).toContain('Hello');
    expect(stripped).not.toContain('gmail_quote');
  });

  it('erkennt blockquote als Fallback', () => {
    const html = '<p>Reply</p><blockquote>old</blockquote>';
    expect(hasQuotedReplyHtml(html)).toBe(true);
    expect(stripQuotedReplyHtml(html)).toBe('<p>Reply</p>');
  });

  it('laesst harmlose Mails unveraendert', () => {
    const html = '<p>Hello world</p>';
    expect(hasQuotedReplyHtml(html)).toBe(false);
    expect(stripQuotedReplyHtml(html)).toBe(html);
  });
});

describe('detectQuote', () => {
  it('zaehlt abgeschnittene Zeichen', () => {
    const body = 'A\n\nVon: x\nGesendet: y\nBetreff: z\n\nOld old old';
    const info = detectQuote(body);
    expect(info.hasQuote).toBe(true);
    expect(info.cutTextChars).toBeGreaterThan(0);
  });
});
