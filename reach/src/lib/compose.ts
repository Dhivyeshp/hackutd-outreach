import { htmlToText, injectOptOut } from './html';
import { appendFooter, OPT_OUT_LINE, renderHtmlTemplate, renderTemplate, textToHtml, type Sender, type TemplateContact } from './template';

export interface CampaignContent {
  subject: string;
  body: string;
  htmlBody?: string | null;
  mailingAddress: string;
  /** Add the STOP opt-out line (and the mailing address for plain text). Defaults to true. */
  footer?: boolean;
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

  const footer = campaign.footer !== false;
  if (campaign.htmlBody?.trim()) {
    const rendered = renderHtmlTemplate(campaign.htmlBody, contact, s);
    const html = footer ? injectOptOut(rendered) : rendered;
    return { subject, html, text: htmlToText(html), isHtmlTemplate: true };
  }
  const rendered = renderTemplate(campaign.body, contact, s);
  const text = footer ? appendFooter(rendered, campaign.mailingAddress) : rendered.trimEnd();
  return { subject, text, html: textToHtml(text), isHtmlTemplate: false };
}

export { OPT_OUT_LINE };
