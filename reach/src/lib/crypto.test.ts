import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { decrypt, encrypt } from './crypto';

const key = randomBytes(32).toString('base64');

describe('crypto', () => {
  it('round-trips', () => {
    expect(decrypt(encrypt('refresh-token', key), key)).toBe('refresh-token');
  });
  it('uses a random iv', () => {
    expect(encrypt('x', key)).not.toBe(encrypt('x', key));
  });
  it('fails on tampering', () => {
    const c = encrypt('secret', key);
    const bad = c.slice(0, -2) + (c.endsWith('A') ? 'B' : 'A') + c.slice(-1);
    expect(() => decrypt(bad, key)).toThrow();
  });
  it('fails with the wrong key', () => {
    expect(() => decrypt(encrypt('x', key), randomBytes(32).toString('base64'))).toThrow();
  });
  it('rejects bad key length', () => {
    expect(() => encrypt('x', 'short')).toThrow(/32/);
  });
});
