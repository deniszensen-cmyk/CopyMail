/**
 * Forward-Header-Templates mit Variablen-Ersetzung.
 * Variablen: {from}, {to}, {date}, {subject}, {body}.
 * Optional-Block: {?to=An: {to}\n} – Block bleibt nur, wenn `to` nicht-leer ist.
 *   Innerhalb des Blocks dürfen weitere {var} stehen; Curly-Braces müssen
 *   balanciert sein.
 */
import type { EmailData } from './EmailProcessor';
import { escHtml } from './EmailProcessor';

export const DEFAULT_TEXT_TEMPLATE =
  'Von: {from}\nGesendet: {date}\n{?to=An: {to}\n}Betreff: {subject}\n\n{body}';

export const DEFAULT_HTML_TEMPLATE = `
<div style="font-family:Calibri,sans-serif;font-size:12pt;color:black;">
  <div style="padding:3pt 0 0 0;border-top:solid #E1E1E1 1pt;">
    <b>Von:</b> {from}<br>
    <b>Gesendet:</b> {date}<br>
    {?to=<b>An:</b> {to}<br>}
    <b>Betreff:</b> {subject}<br>
  </div>
  <br>
</div>
{body}`;

interface RenderInput {
  data: EmailData;
  bodyText: string;
  bodyHtml: string;
  dateStr: string;
}

export function renderText(template: string | null, input: RenderInput): string {
  const tpl = template ?? DEFAULT_TEXT_TEMPLATE;
  return substitute(tpl, {
    from: input.data.from,
    to: input.data.to,
    date: input.dateStr,
    subject: input.data.subject,
    body: input.bodyText,
  });
}

export function renderHtml(template: string | null, input: RenderInput): string {
  const tpl = template ?? DEFAULT_HTML_TEMPLATE;
  return substitute(tpl, {
    from: escHtml(input.data.from),
    to: escHtml(input.data.to),
    date: escHtml(input.dateStr),
    subject: escHtml(input.data.subject),
    body: input.bodyHtml,
  });
}

function substitute(template: string, vars: Record<string, string>): string {
  // 1) Optional-Blöcke balanciert auflösen.
  const out: string[] = [];
  let i = 0;
  while (i < template.length) {
    if (template[i] === '{' && template[i + 1] === '?') {
      const eq = template.indexOf('=', i + 2);
      if (eq < 0) { out.push(template[i]!); i++; continue; }
      const key = template.slice(i + 2, eq);
      // balanced } finden
      let depth = 1;
      let j = eq + 1;
      while (j < template.length && depth > 0) {
        const ch = template[j];
        if (ch === '{') depth++;
        else if (ch === '}') {
          depth--;
          if (depth === 0) break;
        }
        j++;
      }
      if (depth !== 0) { out.push(template[i]!); i++; continue; }
      const body = template.slice(eq + 1, j);
      const v = vars[key];
      if (v) out.push(body);
      i = j + 1;
    } else {
      out.push(template[i]!);
      i++;
    }
  }
  // 2) Variablen einsetzen.
  return out.join('').replace(/\{([a-zA-Z]+)\}/g, (_m, key: string) => vars[key] ?? '');
}
