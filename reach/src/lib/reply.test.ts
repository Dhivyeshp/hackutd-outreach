import { describe, expect, it } from 'vitest';
import { detectOptOut, stripQuoted } from './reply';

describe('stripQuoted', () => {
  it('removes quoted lines and "On ... wrote:" tails', () => {
    const t = 'Thanks!\n\nOn Mon, Jan 1, 2026 at 9:00 AM Sam <sam@hackutd.co> wrote:\n> please unsubscribe me\n> stop';
    expect(stripQuoted(t).trim()).toBe('Thanks!');
  });
});

describe('detectOptOut', () => {
  it.each(['Please unsubscribe me', 'REMOVE me from your list', 'stop', 'Please stop emailing me', 'Not interested, thanks', 'not  interested', 'Take me off this list'])(
    'flags %s',
    (t) => expect(detectOptOut(t)).toBe(true),
  );
  it('does not flag normal replies', () => {
    expect(detectOptOut('Sure, happy to help!')).toBe(false);
    expect(detectOptOut('That bus stopping at noon works')).toBe(false);
    expect(detectOptOut('Stop by my office on Tuesday')).toBe(false);
    expect(detectOptOut('Could we remove the deadline?')).toBe(false);
  });
  it('ignores our own footer and Outlook-style quoted blocks', () => {
    expect(detectOptOut("Happy to chat!\n\n--\nIf you'd rather not hear from us, just reply STOP")).toBe(false);
    expect(detectOptOut('Sounds good\n\nFrom: Sam <sam@hackutd.co>\nSent: Monday\nplease unsubscribe')).toBe(false);
  });
  it('ignores keywords only present in quoted text', () => {
    expect(detectOptOut('Sounds great\n> reply STOP to opt out')).toBe(false);
  });
});
