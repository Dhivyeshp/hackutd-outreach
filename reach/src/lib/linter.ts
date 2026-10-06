export interface LintWarning {
  code: 'too_many_links' | 'link_shortener' | 'caps_subject' | 'spam_words' | 'attachment';
  message: string;
}

const SHORTENERS = ['bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'ow.ly', 'is.gd', 'buff.ly', 'rebrand.ly', 'cutt.ly', 'tiny.cc', 'shorturl.at'];
const SPAM = [
  'free', 'guaranteed', 'act now', 'winner', '100%', 'urgent', 'risk-free', 'no obligation',
  'click here', 'buy now', 'limited time', 'cash', 'earn \\$',
];

export function lintTemplate({ subject, body }: { subject: string; body: string }): LintWarning[] {
  const warnings: LintWarning[] = [];
  const links = body.match(/\b(?:https?:\/\/|www\.)[^\s)]+/gi) ?? [];
  const shortenerHit = SHORTENERS.some((d) => new RegExp(`(^|[\\s/.])${d.replace('.', '\\.')}/`, 'i').test(body));
  const linkCount = links.length + (shortenerHit && !links.length ? 1 : 0);

  if (linkCount > 1) warnings.push({ code: 'too_many_links', message: 'More than one link raises spam-filter risk. Keep it to one.' });
  if (shortenerHit) warnings.push({ code: 'link_shortener', message: 'Link shorteners are flagged as spam. Use the full URL.' });

  const letters = subject.replace(/\{\{.*?\}\}/g, '').replace(/[^a-z]/gi, '');
  if (letters.length >= 4 && letters === letters.toUpperCase()) {
    warnings.push({ code: 'caps_subject', message: 'ALL CAPS subject lines look like spam.' });
  }

  const spamRe = new RegExp(`(^|\\W)(${SPAM.join('|')})(\\W|$)`, 'i');
  if (spamRe.test(subject) || spamRe.test(body)) {
    warnings.push({ code: 'spam_words', message: 'Contains spammy words (e.g. free, guaranteed, act now).' });
  }
  if (/\battach(?:ed|ment|ments|ing)?\b/i.test(body)) {
    warnings.push({ code: 'attachment', message: 'Reach cannot send attachments. Link to a page instead.' });
  }
  return warnings;
}
