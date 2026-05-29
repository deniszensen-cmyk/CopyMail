/**
 * Erkennung & Abschneiden von zitierten Mail-Verlaeufen
 * (Outlook Forward-Header, Antwort-Zitate, "Original Message"-Markierungen).
 *
 * Liefert pro Plain-Text-Body und HTML-Body eine "gekuerzte" Variante,
 * wenn ein typischer Zitat-/Forward-Marker gefunden wurde.
 */

/* ---------------- Plain-Text ---------------- */

const TEXT_MARKERS: RegExp[] = [
  /^[\s>]*-{3,}\s*(Original Message|Original-Nachricht|Urspr(?:ü|ue)ngliche Nachricht|Weitergeleitete Nachricht|Forwarded Message|Forwarded message)\s*-{3,}\s*$/im,
  // Outlook DE: 4 Headerzeilen in Folge
  /^[\s>]*Von:\s.+\n[\s>]*Gesendet:\s.+\n[\s>]*An:\s.+\n[\s>]*Betreff:/im,
  // Outlook DE ohne "An:"
  /^[\s>]*Von:\s.+\n[\s>]*Gesendet:\s.+\n[\s>]*Betreff:/im,
  // Outlook EN
  /^[\s>]*From:\s.+\n[\s>]*Sent:\s.+\n[\s>]*To:\s.+\n[\s>]*Subject:/im,
  /^[\s>]*From:\s.+\n[\s>]*Sent:\s.+\n[\s>]*Subject:/im,
  // Antwort-Zitate (Thunderbird/Gmail-Stil)
  /^[\s>]*Am\s.+\sschrieb\s.+:\s*$/im,
  /^[\s>]*On\s.+\swrote:\s*$/im,
  // "Begin forwarded message:" Apple Mail
  /^[\s>]*Begin forwarded message:\s*$/im,
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

const HTML_MARKERS: Array<RegExp> = [
  // Outlook Forward-Header-Container (typische Inline-Styles)
  /<div\b[^>]*style="[^"]*border-top\s*:\s*solid[^"]*"/i,
  /<div\b[^>]*class\s*=\s*"[^"]*OutlookMessageHeader[^"]*"/i,
  // "From: ... Sent:" - HTML-Variante
  /<b>\s*From:\s*<\/b>/i,
  /<b>\s*Von:\s*<\/b>/i,
  // Apple-Mail / generischer hr
  /<hr\b[^>]*id\s*=\s*"[^"]*reply[^"]*"/i,
  // gmail_quote-Container
  /<(?:div|blockquote)\b[^>]*class\s*=\s*"[^"]*(?:gmail_quote|gmail_attr)[^"]*"/i,
  // Outlook-Antwort-Container
  /<div\b[^>]*id\s*=\s*"divRplyFwdMsg"/i,
  /<div\b[^>]*id\s*=\s*"appendonsend"/i,
  // Generisches blockquote als letztes Mittel
  /<blockquote\b/i,
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
    if (m && m.index >= 0) {
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
