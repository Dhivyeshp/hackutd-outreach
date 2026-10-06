import { OPT_OUT_LINE } from './template';

const ENTITIES: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ', '&apos;': "'" };
const decode = (s: string) => s.replace(/&(?:amp|lt|gt|quot|#39|nbsp|apos);/g, (m) => ENTITIES[m] ?? m);

/** Plain-text twin of an HTML email (for the text/plain alternative part). */
export function htmlToText(html: string): string {
  const withLinks = html
    .replace(/<(head|style|script)[\s\S]*?<\/\1>/gi, '')
    .replace(/<img[^>]*\balt="([^"]*)"[^>]*>/gi, (_, alt: string) => (alt ? `[${alt}]\n` : ''))
    .replace(/<a\b[^>]*\bhref="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href: string, inner: string) => {
      const label = inner.replace(/<[^>]+>/g, '').trim();
      const url = href.replace(/^mailto:/i, '');
      return !label || label === url || label === href ? url : `${label} (${url})`;
    });
  const text = withLinks
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(tr|p|div|h[1-6]|table)>/gi, '\n')
    .replace(/<\/td>/gi, '  ')
    .replace(/<[^>]+>/g, '');
  return decode(text)
    .split('\n')
    .map((l) => l.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Insert the reply-STOP opt-out line just before </body> (or at the end when there is no body tag). */
export function injectOptOut(html: string): string {
  const block = `<div style="font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:18px;color:#9ca3af;text-align:center;padding:0 12px 24px 12px;">${OPT_OUT_LINE}</div>`;
  return /<\/body>/i.test(html) ? html.replace(/<\/body>/i, `${block}</body>`) : html + block;
}
