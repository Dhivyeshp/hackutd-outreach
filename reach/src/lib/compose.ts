import { htmlToText, injectOptOut } from './html';
import { appendFooter, OPT_OUT_LINE, renderHtmlTemplate, renderTemplate, textToHtml, type Sender, type TemplateContact } from './template';

export interface CampaignContent {
  subject: string;
  body: string;
  htmlBody?: string | null;
  mailingAddress: string;
}

export interface ComposedEmail {
  subject: string;
  text: string;
  html: string;
  /** True when the email came from an uploaded HTML template (vs. plain text). */
  isHtmlTemplate: boolean;
}

/**
 * Render subject + body for one contact. With an HTML template the HTML is used as designed
 * (its own footer/address) plus an injected opt-out line, and the text part is derived from it.
 * Otherwise the plain-text body gets the opt-out + address footer and an HTML twin.
 */
export function composeEmail(campaign: CampaignContent, contact: TemplateContact, sender: Sender | string): ComposedEmail {
  const s: Sender = typeof sender === 'string' ? { name: sender } : sender;
  const subject = renderTemplate(campaign.subject, contact, s).replace(/[\r\n]+/g, ' ').trim();

  if (campaign.htmlBody?.trim()) {
    const html = injectOptOut(renderHtmlTemplate(campaign.htmlBody, contact, s));
    return { subject, html, text: htmlToText(html), isHtmlTemplate: true };
  }
  const text = appendFooter(renderTemplate(campaign.body, contact, s), campaign.mailingAddress);
  return { subject, text, html: textToHtml(text), isHtmlTemplate: false };
}

export { OPT_OUT_LINE };
