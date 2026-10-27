// @ts-check
// AES-256-GCM encryption for API keys stored in center_secrets.
// SECRETS_ENCRYPTION_KEY: 32 random bytes, base64. Generate with:
//   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
// Losing this key makes stored secrets unreadable; admins then re-enter them.
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

function encryptionKey() {
  const raw = process.env.SECRETS_ENCRYPTION_KEY;
  if (!raw) return null;
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) throw new Error('SECRETS_ENCRYPTION_KEY must be 32 bytes, base64-encoded');
  return key;
}

export function canEncrypt() {
  try {
    return encryptionKey() !== null;
  } catch {
    return false;
  }
}

/** @param {string} text */
export function encryptSecret(text) {
  const key = encryptionKey();
  if (!key) throw new Error('SECRETS_ENCRYPTION_KEY is not set');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), data.toString('base64')].join(':');
}

/** @param {string|null|undefined} blob @returns {string|null} null if missing or unreadable */
export function decryptSecret(blob) {
  if (!blob) return null;
  try {
    const key = encryptionKey();
    if (!key) return null;
    const [version, iv, tag, data] = blob.split(':');
    if (version !== 'v1') return null;
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}
