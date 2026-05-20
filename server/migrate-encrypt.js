/**
 * migrate-encrypt.js
 *
 * One-shot migration: encrypts all existing plaintext PII rows in the orders table.
 *
 * Safe to re-run: already-encrypted rows (containing ':') are detected and skipped.
 * Run BEFORE deploying the new server code that expects encrypted values.
 *
 * Usage:
 *   node server/migrate-encrypt.js
 *
 * Or inside the container:
 *   docker exec rafting-dunajec node /app/server/migrate-encrypt.js
 *
 * The script processes rows in batches of 100 and uses a DB transaction per batch
 * so that a crash mid-run leaves the DB in a consistent (partially migrated) state
 * and re-running resumes safely.
 */

import 'dotenv/config';
import pg from 'pg';
import { encrypt } from './crypto-fields.js';
import { readSecret } from './secrets.js';

const { Pool } = pg;

const BATCH_SIZE = 100;
const FIELDS = ['cust_name', 'cust_surname', 'cust_id_code', 'cust_address', 'cust_phone'];

function isEncrypted(value) {
  // Encrypted format: "ivHex:tagHex:cipherHex" — always contains exactly 2 colons.
  if (!value) return true; // empty string — nothing to encrypt
  return (value.match(/:/g) || []).length === 2;
}

async function run() {
  const pool = new Pool({
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME     || 'rafting_dunajec',
    user:     process.env.DB_USER     || 'postgres',   // superuser for migration
    password: readSecret('db_password', 'DB_PASSWORD'),
    max: 2,
  });

  let offset = 0;
  let totalMigrated = 0;
  let totalSkipped  = 0;

  console.log('[migrate] Starting PII encryption migration...');

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { rows } = await pool.query(
      'SELECT id, cust_name, cust_surname, cust_id_code, cust_address, cust_phone FROM orders ORDER BY number ASC LIMIT $1 OFFSET $2',
      [BATCH_SIZE, offset]
    );

    if (rows.length === 0) break;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const row of rows) {
        // Check if any field needs migration
        const needsMigration = FIELDS.some(f => !isEncrypted(row[f]));
        if (!needsMigration) {
          totalSkipped++;
          continue;
        }

        const updates = {};
        for (const field of FIELDS) {
          updates[field] = isEncrypted(row[field]) ? row[field] : encrypt(row[field]);
        }

        await client.query(
          `UPDATE orders SET
             cust_name=$1, cust_surname=$2, cust_id_code=$3,
             cust_address=$4, cust_phone=$5
           WHERE id=$6`,
          [
            updates.cust_name,
            updates.cust_surname,
            updates.cust_id_code,
            updates.cust_address,
            updates.cust_phone,
            row.id,
          ]
        );
        totalMigrated++;
      }

      await client.query('COMMIT');
      console.log(`[migrate] Batch offset=${offset}: migrated=${totalMigrated} skipped=${totalSkipped}`);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('[migrate] Batch failed, rolled back:', err.message);
      await pool.end();
      process.exit(1);
    } finally {
      client.release();
    }

    offset += BATCH_SIZE;
  }

  console.log(`[migrate] Done. Total migrated: ${totalMigrated}, already encrypted (skipped): ${totalSkipped}`);
  await pool.end();
}

run().catch(err => {
  console.error('[migrate] Fatal error:', err);
  process.exit(1);
});
