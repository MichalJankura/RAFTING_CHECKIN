import pg from 'pg';
import 'dotenv/config';
import { readSecret } from './secrets.js';

const { Pool } = pg;

// DB password is read from a Docker secret file, falling back to env var for dev.
const dbPassword = readSecret('db_password', 'DB_PASSWORD');

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME     || 'rafting_dunajec',
  user:     process.env.DB_USER     || 'rafting_app',
  password: dbPassword,
  // Enforce a connection limit — prevents runaway query storms
  max:      10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on('error', (err) => console.error('[db] PG pool error:', err));

export default pool;
