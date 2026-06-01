/**
 * Erkennung & Abschneiden von zitierten Mail-Verlaeufen.
 * Deckt Outlook (alle Versionen, DE/EN), eM Client, Thunderbird, Gmail,
 * Apple Mail ab. Behandelt single- und double-quoted Style-Attribute.
 */

/* ---------------- Plain-Text ---------------- */

const TEXT_MARKERS: RegExp[] = [
  // -----Original Message----- / Ursprueng / Weitergeleitet
  /^[\s>]*-{3,}\s*(Original Message|Original-Nachricht|Urspr(?:ü|ue)ngliche Nachricht|Weitergeleitete Nachricht|Forwarded Message|Forwarded message|Reply|Antwort)\s*-{3,}\s*$/im,
  // Outlook DE / EN: 4 Headerzeilen mit "An:/To:" - CRLF und LF
  /^[\s>]*(?:Von|From):\s.+\r?\n[\s>]*(?:Gesendet|Sent):\s.+\r?\n[\s>]*(?:An|To):\s.+\r?\n[\s>]*(?:Betreff|Subject):/im,
  // Outlook DE / EN ohne "An:/To:"
  /^[\s>]*(?:Von|From):\s.+\r?\n[\s>]*(?:Gesendet|Sent):\s.+\r?\n[\s>]*(?:Betreff|Subject):/im,
  // 2-Zeilen-Variante (manche eM-Client-Mails)
  /^[\s>]*(?:Von|From):\s.+\r?\n[\s>]*(?:Gesendet|Sent):\s/im,
  // Antwort-Zitate (Thunderbird/Gmail/eM Client)
  /^[\s>]*Am\s.+\sschrieb\s.+:\s*$/im,
  /^[\s>]*On\s.+\swrote:\s*$/im,
  /^[\s>]*Am\s.+,\s\d{1,2}[.:]\d{2}\s.+(?:schrieb|wrote)/im,
  // Apple Mail
  /^[\s>]*Begin forwarded message:\s*$/im,
  // Generisches Outlook-Header-Pattern: standalone "Von: name@domain.tld"-Zeile
  // gefolgt einer Zeile mit "Gesendet:/Sent:" innerhalb der naechsten Zeile
  /\n\s*(?:Von|From):\s+.+\n\s*(?:Gesendet|Sent):\s/i,
];

export function hasQuotedReplyText(body: string): boolean {
  if (!body) return false;
  return TEXT_MARKERS.some((re) => re.test(body));
}

export function stripQuotedReplyText(body: string): string {
  if (!body) return body;
  let earliest = -1;
  for (const re of TEXT_MARKERS) {
    const m = re.exec(body);
    if (m && m.index !== undefined) {
      if (earliest === -1 || m.index < earliest) earliest = m.index;
    }
  }
  if (earliest <= 0) return body;
  return body.slice(0, earliest).trimEnd();
}

/* ---------------- HTML ---------------- */
// Wichtig: Outlook benutzt manchmal single-quoted (style='...'), manchmal
// double-quoted (style="..."). Beide muessen matchen.

const HTML_MARKERS: Array<RegExp> = [
  // Outlook Forward-Container: border-top:solid / dotted / dashed
  /<div\b[^>]*style\s*=\s*["'][^"']*border-top\s*:\s*(?:solid|dotted|dashed|none|1px|1pt|2pt)/i,
  // Outlook neuer (Edge-basiert)
  /<div\b[^>]*style\s*=\s*["'][^"']*border\s*:\s*none\s*;\s*border-top/i,
  // Outlook Message-Header Klasse
  /<div\b[^>]*class\s*=\s*["'][^"']*(?:OutlookMessageHeader|MessageHeader)/i,
  // Outlook Reply-Container
  /<div\b[^>]*id\s*=\s*["']?(?:divRplyFwdMsg|appendonsend|x_divRplyFwdMsg)/i,
  // Generic "From:/Von:" Bold-Tag
  /<b[^>]*>\s*(?:From|Von|Sent|Gesendet|Subject|Betreff):\s*<\/b>/i,
  /<strong[^>]*>\s*(?:From|Von|Sent|Gesendet|Subject|Betreff):\s*<\/strong>/i,
  // Apple Mail
  /<hr\b[^>]*id\s*=\s*["']?(?:reply|stopSpelling)/i,
  // gmail_quote / gmail_attr / gmail_extra
  /<(?:div|blockquote|span)\b[^>]*class\s*=\s*["'][^"']*gmail_(?:quote|attr|extra)/i,
  // eM Client: Antwort-Quote-Box (border und padding)
  /<div\b[^>]*style\s*=\s*["'][^"']*(?:padding-left|margin-left)\s*:\s*1em[^"']*border-left/i,
  // Yahoo Mail
  /<div\b[^>]*class\s*=\s*["'][^"']*(?:yahoo_quoted|yahoo_compose_quote)/i,
  // generischer <blockquote> als letztes Mittel
  /<blockquote\b/i,
  // letzter Fallback: das erste <hr> ist oft der Trenner
  /<hr\b/i,
];

export function hasQuotedReplyHtml(html: string): boolean {
  if (!html) return false;
  return HTML_MARKERS.some((re) => re.test(html));
}

export function stripQuotedReplyHtml(html: string): string {
  if (!html) return html;
  let earliest = -1;
  for (const re of HTML_MARKERS) {
    const m = re.exec(html);
    if (m && m.index !== undefined && m.index >= 0) {
      if (earliest === -1 || m.index < earliest) earliest = m.index;
    }
  }
  if (earliest <= 0) return html;
  return html.slice(0, earliest).trimEnd();
}

/* ---------------- Kombiniert ---------------- */

export interface QuoteInfo {
  hasQuote: boolean;
  /** Wie viele Zeichen Text-Body wuerden abgeschnitten */
  cutTextChars: number;
}

export function detectQuote(body: string, bodyHtml?: string): QuoteInfo {
  const has = hasQuotedReplyText(body) || (!!bodyHtml && hasQuotedReplyHtml(bodyHtml));
  if (!has) return { hasQuote: false, cutTextChars: 0 };
  const stripped = stripQuotedReplyText(body);
  return { hasQuote: true, cutTextChars: Math.max(0, (body?.length ?? 0) - stripped.length) };
}
