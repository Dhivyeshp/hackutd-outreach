import type { CampaignContent } from './compose';

export type Variant = 'A' | 'B';

/** The campaign fields an A/B test needs. Version A is the normal subject/body/htmlBody. */
export interface AbCampaign extends CampaignContent {
  abEnabled: boolean;
  abPercentB: number;
  bSubject: string | null;
  bBody: string | null;
  bHtmlBody: string | null;
}

/** FNV-1a: a small stable string hash, so a contact always lands in the same version. */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Which version a contact gets. Depends only on the contact id and the split, so previews match what is sent. */
export const pickVariant = (contactId: string, percentB: number): Variant => (hash(contactId) % 100 < percentB ? 'B' : 'A');

/** Version B needs its own subject and text. If it is missing, everyone gets A rather than a broken email. */
export const hasVersionB = (c: AbCampaign): boolean => !!c.bSubject?.trim() && !!c.bBody?.trim();

/** True when the test is on and B is ready, i.e. results are being collected. */
export const abActive = (c: AbCampaign): boolean => c.abEnabled && hasVersionB(c);

export const variantFor = (c: AbCampaign, contactId: string): Variant => (abActive(c) ? pickVariant(contactId, c.abPercentB) : 'A');

/** The subject/body/HTML to render for a version. B with no HTML is a plain-text email. */
export function contentFor(c: AbCampaign, variant: Variant): CampaignContent {
  if (variant === 'A') return c;
  return { subject: c.bSubject ?? c.subject, body: c.bBody ?? c.body, htmlBody: c.bHtmlBody?.trim() ? c.bHtmlBody : null, mailingAddress: c.mailingAddress, footer: c.footer };
}

export interface RateInput {
  sent: number;
  replied: number;
}
export type Verdict = 'A' | 'B' | 'tie' | 'too_early';

/** Each version needs at least this many sends before we say anything about a winner. */
export const MIN_SENDS_PER_VERSION = 100;

/** Two-proportion z-test on reply rate, 95% confidence. Deliberately cautious: small samples say "too early". */
export function compareReplyRates(a: RateInput, b: RateInput): { verdict: Verdict; z: number } {
  if (a.sent < MIN_SENDS_PER_VERSION || b.sent < MIN_SENDS_PER_VERSION) return { verdict: 'too_early', z: 0 };
  const pa = a.replied / a.sent;
  const pb = b.replied / b.sent;
  const pooled = (a.replied + b.replied) / (a.sent + b.sent);
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / a.sent + 1 / b.sent));
  if (se === 0) return { verdict: 'tie', z: 0 };
  const z = (pb - pa) / se;
  if (z >= 1.96) return { verdict: 'B', z };
  if (z <= -1.96) return { verdict: 'A', z };
  return { verdict: 'tie', z };
}
