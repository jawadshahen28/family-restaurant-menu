import { scrypt, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);

/**
 * Hashes a plaintext password with a random cryptographically secure salt using scrypt.
 * Format: `<saltHex>:<derivedKeyHex>`
 */
export async function hashPassword(password) {
  if (typeof password !== 'string' || password.length < 6) {
    throw new Error('كلمة المرور يجب أن تتكون من 6 أحرف على الأقل.');
  }
  const salt = randomBytes(16).toString('hex');
  const derivedKey = await scryptAsync(password, salt, 64);
  return `${salt}:${derivedKey.toString('hex')}`;
}

/**
 * Constant-time verification of a plaintext password against a stored scrypt hash.
 */
export async function verifyPassword(password, storedHash) {
  if (!password || !storedHash || typeof storedHash !== 'string') return false;
  const [salt, key] = storedHash.split(':');
  if (!salt || !key) return false;
  try {
    const derivedKey = await scryptAsync(password, salt, 64);
    const keyBuffer = Buffer.from(key, 'hex');
    if (derivedKey.length !== keyBuffer.length) return false;
    return timingSafeEqual(derivedKey, keyBuffer);
  } catch {
    return false;
  }
}

/**
 * Generates a high-entropy URL-safe session identifier (32 bytes = 256 bits).
 */
export function generateSessionId() {
  return randomBytes(32).toString('base64url');
}

/**
 * Generates a high-entropy URL-safe CSRF token (32 bytes = 256 bits).
 */
export function generateCsrfToken() {
  return randomBytes(32).toString('base64url');
}

/**
 * Compares two CSRF tokens in constant time to prevent timing attacks.
 */
export function timingSafeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
