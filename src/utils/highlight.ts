/** Markiert Vorkommen von needle im sanitisierten HTML mit <mark class="cm-hl">. */
export function highlight(html: string, needle: string): string {
  if (!needle.trim()) return html;
  const re = new RegExp(escapeRegExp(needle), 'gi');
  return html.replace(/>([^<]+)</g, (_m, txt: string) => {
    const replaced = txt.replace(re, (match) => `<mark class="cm-hl">${match}</mark>`);
    return `>${replaced}<`;
  });
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
