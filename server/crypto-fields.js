/**
 * crypto-fields.js
 *
 * AES-256-GCM field-level encryption for PII columns.
 *
 * Stored format (single TEXT column value):
 *   <iv_hex>:<authTag_hex>:<ciphertext_hex>
 *
 * - IV  : 12 bytes random per encryption (GCM standard)
 * - Tag : 16 bytes authentication tag
 *
 * The key is a 32-byte value read from /run/secrets/app_encryption_key
 * (64 hex characters). In development it falls back to ENCRYPTION_KEY env var.
 *
 * IMPORTANT: Never log, serialize, or transmit the raw key.
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { readSecret } from './secrets.js';

const ALGORITHM  = 'aes-256-gcm';
const IV_BYTES   = 12;  // 96-bit IV — GCM recommended length
const TAG_BYTES  = 16;

// Key is loaded once at module initialisation — fail fast if missing.
const KEY_HEX = readSecret('app_encryption_key', 'ENCRYPTION_KEY');
if (!KEY_HEX || KEY_HEX.length !== 64) {
  throw new Error(
    'app_encryption_key must be exactly 64 hex characters (32 bytes). ' +
    'Generate one with: openssl rand -hex 32'
  );
}
const KEY = Buffer.from(KEY_HEX, 'hex');

/**
 * Encrypt a plaintext string.
 * Returns a string in the format "iv:authTag:ciphertext" (all hex).
 * Returns null if the input is null or undefined (preserves DB nullability).
 *
 * @param {string|null} plaintext
 * @returns {string|null}
 */
export function encrypt(plaintext) {
  if (plaintext == null) return null;
  const iv     = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, KEY, iv);
  const enc    = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag    = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`;
}

/**
 * Decrypt a value produced by encrypt().
 * Returns the original plaintext string.
 * Returns null if the input is null or undefined.
 * Throws if the ciphertext has been tampered with (GCM auth tag mismatch).
 *
 * @param {string|null} stored
 * @returns {string|null}
 */
export function decrypt(stored) {
  if (stored == null) return null;

  // Graceful handling for legacy plaintext rows (no colons = not encrypted).
  // These will appear during the migration window. After migration is complete
  // you can remove this branch.
  const parts = stored.split(':');
  if (parts.length !== 3) {
    // Legacy plaintext — return as-is. Log so you can track migration progress.
    console.warn('[crypto-fields] decrypt: plaintext value encountered — run migration');
    return stored;
  }

  const [ivHex, tagHex, ctHex] = parts;
  const iv       = Buffer.from(ivHex,  'hex');
  const tag      = Buffer.from(tagHex, 'hex');
  const ct       = Buffer.from(ctHex,  'hex');
  const decipher = createDecipheriv(ALGORITHM, KEY, iv);
  decipher.setAuthTag(tag);
  try {
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
  } catch {
    throw new Error('[crypto-fields] Decryption failed — ciphertext may be corrupted or key is wrong');
  }
}

/**
 * The set of column names that are encrypted.
 * Used by encryptRow() / decryptRow() for consistent mapping.
 */
export const ENCRYPTED_FIELDS = [
  'cust_name',
  'cust_surname',
  'cust_id_code',
  'cust_address',
  'cust_phone',
];

/**
 * Encrypt all PII fields in a flat row object before writing to DB.
 * Returns a new object (does not mutate the input).
 *
 * @param {object} row
 * @returns {object}
 */
export function encryptRow(row) {
  const out = { ...row };
  for (const field of ENCRYPTED_FIELDS) {
    if (field in out) out[field] = encrypt(out[field]);
  }
  return out;
}

/**
 * Decrypt all PII fields in a row returned from the DB.
 * Returns a new object (does not mutate the input).
 *
 * @param {object} row
 * @returns {object}
 */
export function decryptRow(row) {
  const out = { ...row };
  for (const field of ENCRYPTED_FIELDS) {
    if (field in out) out[field] = decrypt(out[field]);
  }
  return out;
}
