import { describe, expect, it } from 'vitest';
import { buildMime, toBase64Url } from './mime';

const base = {
  fromName: 'Sam Organizer',
  fromEmail: 'sam@hackutd.co',
  to: 'jane@utd.edu',
  subject: 'Hello',
  text: 'Hi Jane',
  html: '<p>Hi Jane</p>',
};

describe('buildMime', () => {
  const raw = buildMime(base);
  it('has single recipient, no bcc/cc', () => {
    expect(raw).toMatch(/^To: jane@utd\.edu$/m);
    expect(raw).not.toMatch(/^(Bcc|Cc):/im);
  });
  it('sets From display name', () => {
    expect(raw).toMatch(/^From: "Sam Organizer" <sam@hackutd\.co>$/m);
  });
  it('is multipart/alternative with plain then html', () => {
    expect(raw).toMatch(/Content-Type: multipart\/alternative; boundary=/);
    expect(raw.indexOf('text/plain')).toBeLessThan(raw.indexOf('text/html'));
  });
  it('encodes non-ascii subject (RFC 2047)', () => {
    expect(buildMime({ ...base, subject: 'Café' })).toMatch(/^Subject: =\?UTF-8\?B\?/m);
  });
  it('uses CRLF', () => {
    expect(raw).toContain('\r\n');
  });
  it('rejects header injection', () => {
    expect(() => buildMime({ ...base, subject: 'a\r\nBcc: x@y.com' })).toThrow();
    expect(() => buildMime({ ...base, to: 'a@b.com\r\nBcc: x@y.com' })).toThrow();
    expect(() => buildMime({ ...base, to: 'a@b.com, c@d.com' })).toThrow(/one recipient/i);
  });
  it('base64url has no padding or unsafe chars', () => {
    expect(toBase64Url(raw)).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});
