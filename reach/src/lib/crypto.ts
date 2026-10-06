import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const IV_LEN = 12;
const TAG_LEN = 16;

function keyBuf(keyB64: string): Buffer {
  const key = Buffer.from(keyB64, 'base64');
  if (key.length !== 32) throw new Error('ENCRYPTION_KEY must decode to 32 bytes (base64)');
  return key;
}

/** AES-256-GCM. Output: base64(iv | tag | ciphertext). */
export function encrypt(plain: string, keyB64: string): string {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv('aes-256-gcm', keyBuf(keyB64), iv);
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ct]).toString('base64');
}

export function decrypt(payload: string, keyB64: string): string {
  const buf = Buffer.from(payload, 'base64');
  const decipher = createDecipheriv('aes-256-gcm', keyBuf(keyB64), buf.subarray(0, IV_LEN));
  decipher.setAuthTag(buf.subarray(IV_LEN, IV_LEN + TAG_LEN));
  return Buffer.concat([decipher.update(buf.subarray(IV_LEN + TAG_LEN)), decipher.final()]).toString('utf8');
}

function envKey(): string {
  const k = process.env.ENCRYPTION_KEY;
  if (!k) throw new Error('ENCRYPTION_KEY not configured');
  return k;
}

export const encryptSecret = (plain: string) => encrypt(plain, envKey());
export const decryptSecret = (payload: string) => decrypt(payload, envKey());
