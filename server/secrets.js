/**
 * secrets.js
 *
 * Reads runtime secrets from Docker secret files (/run/secrets/<name>).
 * Falls back to environment variables for local development.
 *
 * Docker secrets are mounted as tmpfs files — they do not appear in
 * `docker inspect`, image layers, or environment variable listings.
 *
 * Usage:
 *   import { readSecret } from './secrets.js';
 *   const key = readSecret('app_encryption_key', 'ENCRYPTION_KEY');
 */

import { readFileSync } from 'node:fs';

/**
 * @param {string} secretName  - filename under /run/secrets/
 * @param {string} [envVar]    - env var name to fall back to in dev
 * @returns {string}
 */
export function readSecret(secretName, envVar) {
  const secretPath = `/run/secrets/${secretName}`;
  try {
    return readFileSync(secretPath, 'utf8').trim();
  } catch {
    // Not running in Docker or secret not mounted — try env var
    if (envVar && process.env[envVar]) {
      return process.env[envVar].trim();
    }
    throw new Error(
      `Secret '${secretName}' not found at ${secretPath}` +
      (envVar ? ` and env var '${envVar}' is not set.` : '.') +
      ' See secrets/ directory setup in README.'
    );
  }
}
