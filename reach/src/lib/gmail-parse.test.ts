import { describe, expect, it } from 'vitest';
import { addressOf, extractText, headerValue } from './gmail-parse';

const b64 = (s: string) => Buffer.from(s).toString('base64url');

describe('gmail-parse', () => {
  it('reads headers case-insensitively', () => {
    expect(headerValue({ headers: [{ name: 'From', value: 'a@b.com' }] }, 'from')).toBe('a@b.com');
    expect(headerValue({ headers: [] }, 'from')).toBe('');
    expect(headerValue(undefined, 'from')).toBe('');
  });
  it('extracts nested text/plain', () => {
    const payload = {
      mimeType: 'multipart/alternative',
      parts: [
        { mimeType: 'text/plain', body: { data: b64('hello') } },
        { mimeType: 'text/html', body: { data: b64('<p>hello</p>') } },
      ],
    };
    expect(extractText(payload)).toBe('hello');
  });
  it('falls back to body data when single-part', () => {
    expect(extractText({ mimeType: 'text/html', body: { data: b64('x') } })).toBe('x');
    expect(extractText(null)).toBe('');
  });
  it('addressOf', () => {
    expect(addressOf('Jane <Jane@X.edu>')).toBe('jane@x.edu');
    expect(addressOf('jane@x.edu')).toBe('jane@x.edu');
  });
});
