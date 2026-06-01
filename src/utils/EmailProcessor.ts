import PostalMime from 'postal-mime';
import DOMPurify from 'dompurify';
import { parseMsgBuffer } from './MsgParser';
import { renderHtml as tplHtml, renderText as tplText } from './forwardTemplate';
import { stripQuotedReplyText, stripQuotedReplyHtml } from './quotedReply';

export interface EmailAttachment {
  name: string;
  contentType: string;
  size: number;
  cid?: string;
  dataUrl?: string;
  inline: boolean;
}

export interface EmailData {
  from: string;
  to: string;
  date: string;
  subject: string;
  body: string;
  bodyHtml?: string;
  attachments?: EmailAttachment[];
}

export const MAX_FILE_SIZE = 100 * 1024 * 1024;
const SUPPORTED_EXTENSIONS = new Set(['msg', 'eml']);

export function getExtension(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : '';
}

export function isSupportedFile(file: File): boolean {
  return SUPPORTED_EXTENSIONS.has(getExtension(file.name));
}

export async function processEmailFile(file: File, maxSize = MAX_FILE_SIZE): Promise<EmailData> {
  const extension = getExtension(file.name);
  if (!SUPPORTED_EXTENSIONS.has(extension)) {
    throw new Error('Nicht unterstütztes Format. Bitte .msg oder .eml verwenden.');
  }
  if (file.size > maxSize) {
    const mb = Math.round(maxSize / 1024 / 1024);
    throw new Error(`Datei ist zu groß (über ${mb} MB).`);
  }
  const buf = await file.arrayBuffer();
  if (extension === 'msg') return parseMsgBuffer(buf);
  return processEmlFile(buf);
}

async function processEmlFile(buffer: ArrayBuffer): Promise<EmailData> {
  const parser = new PostalMime();
  const email = await parser.parse(buffer);

  const from = email.from
    ? (email.from.name
        ? `${email.from.name} <${email.from.address ?? ''}>`
        : email.from.address ?? 'Unbekannt')
    : 'Unbekannt';
  const to = email.to && email.to.length > 0
    ? email.to
        .map((rec) => (rec.name ? `${rec.name} <${rec.address ?? ''}>` : rec.address ?? ''))
        .filter(Boolean)
        .join('; ')
    : '';

  const attachments: EmailAttachment[] = [];
  let bodyHtml = email.html ?? undefined;

  if (Array.isArray(email.attachments)) {
    for (const a of email.attachments) {
      const inline = a.disposition === 'inline' || !!a.contentId;
      const contentBytes = a.content instanceof ArrayBuffer
        ? new Uint8Array(a.content)
        : a.content instanceof Uint8Array
          ? a.content
          : null;
      const size = contentBytes ? contentBytes.byteLength : 0;
      let dataUrl: string | undefined;
      if (inline && contentBytes && /^image\//.test(a.mimeType ?? '')) {
        dataUrl = `data:${a.mimeType};base64,${bytesToBase64(contentBytes)}`;
      }
      const cid = (a.contentId ?? '').replace(/^<|>$/g, '');
      attachments.push({
        name: a.filename ?? '(unbenannt)',
        contentType: a.mimeType ?? 'application/octet-stream',
        size,
        cid: cid || undefined,
        dataUrl,
        inline,
      });
      if (bodyHtml && cid && dataUrl) {
        const re = new RegExp('cid:' + escapeRegExp(cid), 'gi');
        bodyHtml = bodyHtml.replace(re, dataUrl);
      }
    }
  }

  return {
    from,
    to,
    date: email.date ?? new Date().toISOString(),
    subject: email.subject ?? '(Kein Betreff)',
    body: email.text ?? '',
    bodyHtml,
    attachments,
  };
}

function bytesToBase64(bytes: Uint8Array): string {
  let s = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    s += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }
  return btoa(s);
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const SANITIZE_BASE = {
  FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'meta', 'link', 'base'],
  FORBID_ATTR: ['srcset', 'formaction'],
  ADD_TAGS: ['style'],
  ADD_ATTR: ['bordercolor', 'cellspacing', 'cellpadding'],
  ALLOW_DATA_ATTR: false,
  ALLOW_UNKNOWN_PROTOCOLS: false,
  RETURN_TRUSTED_TYPE: false,
};

const URI_LOCAL = /^(?:(?:cid|data:image\/(?:png|gif|jpe?g|webp|svg\+xml);base64,):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i;
const URI_WITH_REMOTE = /^(?:(?:https?|mailto|tel|cid|data:image\/(?:png|gif|jpe?g|webp|svg\+xml);base64,):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i;

let hooksInstalled = false;
function installSanitizerHooks(allowExternalImages: boolean): void {
  if (hooksInstalled) {
    DOMPurify.removeAllHooks();
    hooksInstalled = false;
  }

  DOMPurify.addHook('uponSanitizeElement', (node, data) => {
    const name = (data.tagName || '').toLowerCase();
    if (
      name.startsWith('o:') ||
      name.startsWith('v:') ||
      name.startsWith('m:') ||
      name.startsWith('w:') ||
      name === 'xml'
    ) {
      const parent = node.parentNode;
      if (parent && node.textContent) {
        const text = node.ownerDocument?.createTextNode(node.textContent);
        if (text) parent.replaceChild(text, node);
        else parent.removeChild(node);
      } else if (parent) {
        parent.removeChild(node);
      }
    }
  });

  DOMPurify.addHook('uponSanitizeAttribute', (_node, data) => {
    if (data.attrName !== 'style' || !data.attrValue) return;
    const v = data.attrValue;
    if (!allowExternalImages && /url\s*\(\s*['"]?\s*https?:/i.test(v)) {
      data.attrValue = v.replace(/url\s*\(\s*['"]?\s*https?:[^)'"]+['"]?\s*\)/gi, 'none');
    }
    if (/javascript\s*:/i.test(data.attrValue) || /expression\s*\(/i.test(data.attrValue)) {
      data.attrValue = '';
    }
  });

  hooksInstalled = true;
}

export function sanitizeMailHtml(input: string, allowExternalImages = false): string {
  installSanitizerHooks(allowExternalImages);
  const config = {
    ...SANITIZE_BASE,
    ALLOWED_URI_REGEXP: allowExternalImages ? URI_WITH_REMOTE : URI_LOCAL,
    // FORCE_BODY: damit <style>-Bloecke (Signatur-CSS + unser Reset) im Body
    // erhalten bleiben; ohne diese Option verschiebt der HTML-Parser sie in
    // den <head>, den DOMPurify dann verwirft.
    FORCE_BODY: true,
  };
  return String(DOMPurify.sanitize(input, config));
}

function extractBody(html: string): string {
  const styles: string[] = [];
  const styleRe = /<style\b[^>]*>[\s\S]*?<\/style>/gi;
  let m: RegExpExecArray | null;
  while ((m = styleRe.exec(html)) !== null) styles.push(m[0]);

  const lower = html.toLowerCase();
  const bodyStart = lower.indexOf('<body');
  let bodyInner: string;
  if (bodyStart < 0) {
    bodyInner = html;
  } else {
    const bodyOpenEnd = html.indexOf('>', bodyStart);
    if (bodyOpenEnd < 0) {
      bodyInner = html;
    } else {
      const bodyEnd = lower.lastIndexOf('</body>');
      bodyInner = bodyEnd > bodyOpenEnd
        ? html.slice(bodyOpenEnd + 1, bodyEnd)
        : html.slice(bodyOpenEnd + 1);
    }
  }

  bodyInner = neutralizeTableBorders(bodyInner);

  const defaultReset =
    '<style>' +
    'table,table tr,table td,table th{' +
    'border:none !important;' +
    'border-collapse:collapse !important;' +
    'mso-table-lspace:0pt;mso-table-rspace:0pt;' +
    '}' +
    '</style>';

  return defaultReset + styles.join('') + bodyInner;
}

function neutralizeTableBorders(html: string): string {
  html = html.replace(/<table\b([^>]*)>/gi, (_full, attrs: string) => {
    let next = attrs;
    // HTML-Attribute fuer Programme, die style="..." beim Paste strippen
    // (Bitrix, Confluence, viele Wikis). Diese alten HTML4-Attribute werden
    // von praktisch allen Sanitizern als harmlos durchgelassen und vom
    // Browser respektiert.
    if (!/\bborder\s*=/i.test(next)) next = ` border="0"` + next;
    if (!/\bframe\s*=/i.test(next)) next = ` frame="void"` + next;
    if (!/\brules\s*=/i.test(next)) next = ` rules="none"` + next;
    if (!/\bbordercolor\s*=/i.test(next)) next = ` bordercolor="white"` + next;
    if (!/\bcellspacing\s*=/i.test(next)) next = ` cellspacing="0"` + next;
    next = stripMsoTableClass(next);
    next = mergeStyleNoBorder(next, 'border:none;border-collapse:collapse;');
    return `<table${next}>`;
  });

  for (const tag of ['tr', 'td', 'th']) {
    const re = new RegExp(`<${tag}\\b([^>]*)>`, 'gi');
    html = html.replace(re, (_f, attrs: string) => {
      let next = attrs;
      if (!/\bbordercolor\s*=/i.test(next)) next = ` bordercolor="white"` + next;
      next = stripMsoTableClass(next);
      next = mergeStyleNoBorder(next, 'border:none;');
      return `<${tag}${next}>`;
    });
  }

  return html;
}

/**
 * Entfernt Word-spezifische MSO-Tabellen-Klassen. Diese Klassen
 * (MsoNormalTable, MsoTableGrid, ...) triggern in Outlook/Word/eM Client
 * beim Paste die Word-HTML->RTF-Pipeline, die ihre eigenen 1pt-Default-
 * Rahmen rendert - und dabei unsere inline border:none-Styles ignoriert,
 * weil sie aus der Class-Definition kommen, nicht aus dem HTML.
 *
 * Andere CSS-Klassen (z.B. fuer Schriftarten) bleiben erhalten.
 */
function stripMsoTableClass(attrs: string): string {
  const classRe = /\bclass\s*=\s*(["'])([\s\S]*?)\1/i;
  const m = classRe.exec(attrs);
  if (!m) return attrs;
  const quote = m[1] ?? '"';
  const existing = m[2] ?? '';
  const cleaned = existing
    .split(/\s+/)
    .filter((c) => !/^Mso(?:NormalTable|TableGrid|TableLightShading|Table[A-Za-z]*)$/i.test(c))
    .join(' ');
  if (cleaned === existing) return attrs;
  if (cleaned === '') {
    // ganzes class-Attribut weg
    return attrs.replace(classRe, '').replace(/\s{2,}/g, ' ');
  }
  return attrs.replace(classRe, `class=${quote}${cleaned}${quote}`);
}

function mergeStyleNoBorder(attrs: string, css: string): string {
  const styleRe = /\bstyle\s*=\s*(["'])([\s\S]*?)\1/i;
  const m = styleRe.exec(attrs);
  if (!m) {
    return ` style="${css}"${attrs}`;
  }
  const quote = m[1] ?? '"';
  const existing = m[2] ?? '';
  if (/\bborder\s*:/.test(existing)) return attrs;
  const merged = `style=${quote}${css}${existing}${quote}`;
  return attrs.replace(styleRe, merged);
}

export interface FormatOptions {
  templateText?: string | null;
  templateHtml?: string | null;
  allowExternalImages?: boolean;
  stripQuotedHistory?: boolean;
}

export function formatForwardedEmail(
  data: EmailData,
  opts: FormatOptions = {},
): { text: string; html: string } {
  const dateStr = formatDate(data.date);
  let bodyText = decodeBasicEntities(data.body.trim());
  let sourceHtml = data.bodyHtml;
  if (opts.stripQuotedHistory) {
    bodyText = stripQuotedReplyText(bodyText);
    if (sourceHtml) sourceHtml = stripQuotedReplyHtml(sourceHtml);
  }

  let bodyHtml: string;
  if (sourceHtml) {
    const inner = extractBody(sourceHtml);
    bodyHtml = `<div style="font-family:Calibri,sans-serif;font-size:12pt;">${sanitizeMailHtml(inner, !!opts.allowExternalImages)}</div>`;
  } else {
    const paragraphs = bodyText.split(/\r?\n\s*\r?\n/);
    bodyHtml = paragraphs
      .map((para) =>
        `<p style="margin:0;font-family:Calibri,sans-serif;font-size:12pt;">${escHtml(para).replace(/\r?\n/g, '<br>')}</p>`,
      )
      .join('');
  }

  const text = tplText(opts.templateText ?? null, { data, bodyText, bodyHtml, dateStr });
  const html = tplHtml(opts.templateHtml ?? null, { data, bodyText, bodyHtml, dateStr });
  return { text, html };
}

function formatDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value || '';
  return d.toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

/**
 * Decodet die wichtigsten HTML-Entities im Plain-Text-Body. Mail-Clients
 * generieren den text/plain-Teil manchmal aus dem HTML-Body und lassen
 * dabei einzelne Entities (&gt;, &amp;) un-decoded zurueck, die dann beim
 * Paste in Plain-Text-Editoren (Bitrix, Slack) als Roh-Zeichen auftauchen.
 *
 * Reihenfolge: &amp; ZULETZT, sonst werden bereits decodete Entities
 * (z.B. &amp;gt;) doppelt aufgeloest.
 */
function decodeBasicEntities(s: string): string {
  if (!s || !s.includes('&')) return s;
  return s
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&');
}

export function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatCombinedEmails(
  emails: EmailData[],
  opts: FormatOptions = {},
): { text: string; html: string } {
  if (emails.length === 0) return { text: '', html: '' };
  if (emails.length === 1) return formatForwardedEmail(emails[0]!, opts);

  const parts = emails.map((e) => formatForwardedEmail(e, opts));
  const textSeparator = '\n\n---\n\n';
  const htmlSeparator =
    '<hr style="border:none;border-top:1px solid #cbd5e1;margin:18pt 0;">';

  return {
    text: parts.map((p) => p.text.trim()).join(textSeparator),
    html: parts.map((p) => p.html).join(htmlSeparator),
  };
}

export function snippet(data: EmailData, maxLen = 160): string {
  const raw = (data.body || '').replace(/\s+/g, ' ').trim();
  if (raw.length <= maxLen) return raw;
  return raw.slice(0, maxLen).trimEnd() + '…';
}
