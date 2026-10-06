import { appendFooter, renderTemplate, textToHtml, type TemplateContact } from './template';

export interface CampaignContent {
  subject: string;
  body: string;
  mailingAddress: string;
}

export interface ComposedEmail {
  subject: string;
  text: string;
  html: string;
}

/** Render subject + body for one contact, append the opt-out footer, and produce the HTML twin. */
export function composeEmail(campaign: CampaignContent, contact: TemplateContact, senderName: string): ComposedEmail {
  const subject = renderTemplate(campaign.subject, contact, senderName).replace(/[\r\n]+/g, ' ').trim();
  const text = appendFooter(renderTemplate(campaign.body, contact, senderName), campaign.mailingAddress);
  return { subject, text, html: textToHtml(text) };
}
