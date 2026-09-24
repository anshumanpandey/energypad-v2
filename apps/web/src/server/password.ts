import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

export const passwordInput = z.string().min(12).max(128);
// OWASP scrypt profile: N=2^15, r=8, p=3 (32 MiB).
const options = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
const derive = (password: string, salt: Buffer) =>
  new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, 64, options, (error, key) => (error ? reject(error) : resolve(key)));
  });

export async function hashPassword(password: string) {
  passwordInput.parse(password);
  const salt = randomBytes(16);
  const key = await derive(password, salt);
  return `scrypt-v1$${salt.toString('hex')}$${key.toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string | null | undefined) {
  if (!passwordInput.safeParse(password).success) return false;
  const match = /^scrypt-v1\$([a-f0-9]{32})\$([a-f0-9]{128})$/.exec(stored ?? '');
  // Missing users still pay the same hashing cost; never log passwords or hashes.
  const salt = match ? Buffer.from(match[1], 'hex') : Buffer.alloc(16);
  const expected = match ? Buffer.from(match[2], 'hex') : Buffer.alloc(64);
  const actual = await derive(password, salt);
  return timingSafeEqual(actual, expected) && !!match;
}
