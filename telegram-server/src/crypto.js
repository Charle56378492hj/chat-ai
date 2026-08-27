import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { env } from './env.js';

export function encryptSession(value) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', env.sessionEncryptionKey, iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, ciphertext].map((part) => part.toString('base64url')).join('.');
}

export function decryptSession(value) {
  const [ivPart, tagPart, ciphertextPart] = String(value).split('.');
  if (!ivPart || !tagPart || !ciphertextPart) throw new Error('جلسة تيليغرام المشفّرة غير صالحة');
  const decipher = createDecipheriv('aes-256-gcm', env.sessionEncryptionKey, Buffer.from(ivPart, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagPart, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextPart, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}