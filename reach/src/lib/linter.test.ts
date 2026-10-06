import { describe, expect, it } from 'vitest';
import { lintTemplate } from './linter';

const codes = (s: string, b: string) => lintTemplate({ subject: s, body: b }).map((w) => w.code);

describe('lintTemplate', () => {
  it('passes a clean template', () => {
    expect(codes('Sponsoring HackUTD', 'Hi {{first_name}}, would you like to mentor? https://hackutd.co')).toEqual([]);
  });
  it('warns on more than one link', () => {
    expect(codes('Hi', 'https://a.com and https://b.com')).toContain('too_many_links');
  });
  it('warns on shorteners', () => {
    expect(codes('Hi', 'go bit.ly/abc')).toContain('link_shortener');
    expect(codes('Hi', 'https://tinyurl.com/x')).toContain('link_shortener');
  });
  it('warns on ALL CAPS subject', () => {
    expect(codes('BIG NEWS FOR YOU', 'x')).toContain('caps_subject');
    expect(codes('Big news', 'x')).not.toContain('caps_subject');
  });
  it('warns on spammy words', () => {
    expect(codes('Free swag', 'x')).toContain('spam_words');
    expect(codes('Hi', 'Guaranteed results, act now')).toContain('spam_words');
  });
  it('warns on attachments mention', () => {
    expect(codes('Hi', 'see attached flyer')).toContain('attachment');
  });
  it('warns on missing opt-out is not required (footer auto-added)', () => {
    expect(codes('Hi', 'hello')).not.toContain('no_optout');
  });
});
