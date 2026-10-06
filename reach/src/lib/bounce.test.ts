import { describe, expect, it } from 'vitest';
import { bounceLooksAuthentic, isBounceSender, parseBounceRecipient } from './bounce';

describe('isBounceSender', () => {
  it('detects mailer-daemon / postmaster', () => {
    expect(isBounceSender('Mail Delivery Subsystem <mailer-daemon@googlemail.com>')).toBe(true);
    expect(isBounceSender('postmaster@utd.edu')).toBe(true);
    expect(isBounceSender('Jane <jane@utd.edu>')).toBe(false);
  });
});

describe('parseBounceRecipient', () => {
  it('reads X-Failed-Recipients', () => {
    expect(parseBounceRecipient('X-Failed-Recipients: Bob@Utd.edu\nfoo')).toBe('bob@utd.edu');
  });
  it('reads Final-Recipient (DSN)', () => {
    expect(parseBounceRecipient('Final-Recipient: rfc822; jane@x.edu\nAction: failed')).toBe('jane@x.edu');
  });
  it("reads Gmail's wasn't delivered text", () => {
    expect(parseBounceRecipient("Your message wasn't delivered to jane@x.edu because the address couldn't be found")).toBe('jane@x.edu');
  });
  it('reads <addr>: host said: 550', () => {
    expect(parseBounceRecipient('<jane@x.edu>: host mx.x.edu said: 550 5.1.1 User unknown')).toBe('jane@x.edu');
  });
  it('returns null when nothing is found', () => {
    expect(parseBounceRecipient('hello world')).toBeNull();
  });
  it('ignores the sender own address when given', () => {
    expect(parseBounceRecipient('From: me@hackutd.co\nFinal-Recipient: rfc822; jane@x.edu', 'me@hackutd.co')).toBe('jane@x.edu');
  });
});

describe('bounceLooksAuthentic', () => {
  it('accepts passing or missing auth results, rejects failing ones', () => {
    expect(bounceLooksAuthentic('mx.google.com; dkim=pass header.i=@googlemail.com; spf=pass')).toBe(true);
    expect(bounceLooksAuthentic('')).toBe(true);
    expect(bounceLooksAuthentic('mx.google.com; spf=fail; dkim=none')).toBe(false);
  });
});
