import PostalMime from 'postal-mime';
import DOMPurify from 'dompurify';
import { parseMsgBuffer } from './MsgParser';
import { renderHtml as tplHtml, renderText as tplText } from './forwardTemplate';

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
      // CID auf data:-URL im Body ersetzen
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
  ALLOW_DATA_ATTR: false,
  ALLOW_UNKNOWN_PROTOCOLS: false,
  RETURN_TRUSTED_TYPE: false,
};

const URI_LOCAL = /^(?:(?:cid|data:image\/(?:png|gif|jpe?g|webp|svg\+xml);base64,):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i;
const URI_WITH_REMOTE = /^(?:(?:https?|mailto|tel|cid|data:image\/(?:png|gif|jpe?g|webp|svg\+xml);base64,):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i;

let hooksInstalled = false;
function installSanitizerHooks(allowExternalImages: boolean): void {
  // Hooks werden global installiert; bei Bedarf gegen den Flag gegated.
  if (hooksInstalled) {
    DOMPurify.removeAllHooks();
    hooksInstalled = false;
  }

  // 1) Outlook-/VML-/MathML-Reste entfernen.
  DOMPurify.addHook('uponSanitizeElement', (node, data) => {
    const name = (data.tagName || '').toLowerCase();
    // o:p (Outlook), v:* (VML), m:* (MathML aus Outlook)
    if (
      name.startsWith('o:') ||
      name.startsWith('v:') ||
      name.startsWith('m:') ||
      name.startsWith('w:') ||
      name === 'xml'
    ) {
      // Entferne den Tag, behalte aber den Text-Inhalt
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

  // 2) Gefährliche style-Inhalte filtern: url(http…) blockieren, wenn keine
  //    externen Bilder erlaubt sind.
  DOMPurify.addHook('uponSanitizeAttribute', (_node, data) => {
    if (data.attrName !== 'style' || !data.attrValue) return;
    const v = data.attrValue;
    if (!allowExternalImages && /url\s*\(\s*['"]?\s*https?:/i.test(v)) {
      // url(http://…) / url(https://…) entfernen
      data.attrValue = v.replace(/url\s*\(\s*['"]?\s*https?:[^)'"]+['"]?\s*\)/gi, 'none');
    }
    // Immer: javascript:- und expression(…) blockieren
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
  };
  return String(DOMPurify.sanitize(input, config));
}

function extractBody(html: string): string {
  const lower = html.toLowerCase();
  const bodyStart = lower.indexOf('<body');
  if (bodyStart < 0) return html;
  const bodyOpenEnd = html.indexOf('>', bodyStart);
  if (bodyOpenEnd < 0) return html;
  const bodyEnd = lower.lastIndexOf('</body>');
  return bodyEnd > bodyOpenEnd
    ? html.slice(bodyOpenEnd + 1, bodyEnd)
    : html.slice(bodyOpenEnd + 1);
}

export interface FormatOptions {
  templateText?: string | null;
  templateHtml?: string | null;
  allowExternalImages?: boolean;
}

export function formatForwardedEmail(
  data: EmailData,
  opts: FormatOptions = {},
): { text: string; html: string } {
  const dateStr = formatDate(data.date);
  const bodyText = data.body.trim();

  let bodyHtml: string;
  if (data.bodyHtml) {
    const inner = extractBody(data.bodyHtml);
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

export function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Verkettet mehrere Mails zu einem einzigen Forward-Block, getrennt durch eine
 * Trennlinie. Reihenfolge = Eingabe-Reihenfolge.
 */
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

/** Kurzes Text-Snippet fuer Listenansicht. */
export function snippet(data: EmailData, maxLen = 160): string {
  const raw = (data.body || '').replace(/\s+/g, ' ').trim();
  if (raw.length <= maxLen) return raw;
  return raw.slice(0, maxLen).trimEnd() + '…';
}
