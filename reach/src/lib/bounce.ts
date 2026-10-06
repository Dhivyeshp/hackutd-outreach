const ADDR = '([^\\s<>,;"\']+@[^\\s<>,;"\']+)';
const PATTERNS = [
  new RegExp(`X-Failed-Recipients:\\s*<?${ADDR}`, 'gi'),
  new RegExp(`Final-Recipient:\\s*rfc822;\\s*<?${ADDR}`, 'gi'),
  new RegExp(`Original-Recipient:\\s*rfc822;\\s*<?${ADDR}`, 'gi'),
  new RegExp(`wasn['’]t delivered to\\s+<?${ADDR}`, 'gi'),
  new RegExp(`<${ADDR}>:\\s*host`, 'gi'),
];

export const isBounceSender = (from: string) => /mailer-daemon|postmaster/i.test(from);

/** Pull the failed recipient out of a bounce/DSN message body+headers. */
export function parseBounceRecipient(text: string, ownEmail?: string): string | null {
  const own = ownEmail?.toLowerCase();
  for (const re of PATTERNS) {
    for (const m of text.matchAll(re)) {
      const email = m[1].replace(/[.,;:)]+$/, '').toLowerCase();
      if (email.includes('@') && email !== own) return email;
    }
  }
  return null;
}

/** Real DSNs pass SPF/DKIM. If the receiving server recorded auth results and none passed, treat it as forged. */
export function bounceLooksAuthentic(authResults: string): boolean {
  if (!authResults.trim()) return true;
  return /\b(spf|dkim|dmarc)=pass\b/i.test(authResults);
}
