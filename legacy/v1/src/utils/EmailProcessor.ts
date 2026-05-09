import PostalMime from 'postal-mime';
import { parseMsgBuffer } from './MsgParser';

export interface EmailData {
  from: string;
  to: string;
  date: string;
  subject: string;
  body: string;
  bodyHtml?: string;
}

export async function processEmailFile(file: File): Promise<EmailData> {
  const extension = file.name.split('.').pop()?.toLowerCase();
  const arrayBuffer = await file.arrayBuffer();

  if (extension === 'msg') {
    return parseMsgBuffer(arrayBuffer);
  } else if (extension === 'eml') {
    return processEmlFile(arrayBuffer);
  } else {
    throw new Error('Nicht unterstütztes Format. Bitte .msg oder .eml verwenden.');
  }
}

async function processEmlFile(buffer: ArrayBuffer): Promise<EmailData> {
  const parser = new PostalMime();
  const email = await parser.parse(buffer);

  const from = email.from
    ? (email.from.name
        ? `${email.from.name} <${email.from.address}>`
        : email.from.address ?? 'Unbekannt')
    : 'Unbekannt';

  const to = email.to
    ? email.to.map(rec => rec.name ? `${rec.name} <${rec.address}>` : rec.address).join('; ')
    : 'Unbekannt';

  return {
    from,
    to,
    date: email.date ?? new Date().toISOString(),
    subject: email.subject ?? '(Kein Betreff)',
    body: email.text ?? '',
    bodyHtml: email.html ?? undefined,
  };
}

export function formatForwardedEmail(data: EmailData): { text: string; html: string } {
  const dateStr = new Date(data.date).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const headerText =
    `Von: ${data.from}\n` +
    `Gesendet: ${dateStr}\n` +
    `An: ${data.to}\n` +
    `Betreff: ${data.subject}\n\n`;

  const headerHtml = `
<div style="font-family:Calibri,sans-serif;font-size:12pt;color:black;">
  <div style="border-top:none;border-right:none;border-bottom:none;border-left:none;padding:3.0pt 0in 0in 0in;border-top:solid #E1E1E1 1.0pt;">
    <b>Von:</b> ${escHtml(data.from)}<br>
    <b>Gesendet:</b> ${escHtml(dateStr)}<br>
    <b>An:</b> ${escHtml(data.to)}<br>
    <b>Betreff:</b> ${escHtml(data.subject)}<br>
  </div>
  <br>
</div>`;

  let bodyHtml = data.bodyHtml;
  if (!bodyHtml) {
    // Convert plain text to HTML properly
    const paragraphs = data.body.trim().split(/\r?\n\s*\r?\n/);
    bodyHtml = paragraphs
      .map(p => `<p style="margin:0in;margin-bottom:.0001pt;font-family:Calibri,sans-serif;font-size:12pt;">${escHtml(p).replace(/\r?\n/g, '<br>')}</p>`)
      .join('<br>');
  } else {
    // Ensure the external HTML body is wrapped in a div with proper font
    bodyHtml = `<div style="font-family:Calibri,sans-serif;font-size:12pt;">${bodyHtml}</div>`;
  }

  return {
    text: headerText + data.body.trim(),
    html: headerHtml + bodyHtml,
  };
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
