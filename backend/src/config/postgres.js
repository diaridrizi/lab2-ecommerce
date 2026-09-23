// PostgreSQL connection pool (SQL database: users, products, categories, orders)
import pg from 'pg';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from './env.js';

// Return NUMERIC columns (prices) as JS numbers instead of strings
pg.types.setTypeParser(1700, (val) => parseFloat(val));

export const pool = new pg.Pool({ connectionString: env.databaseUrl });

// Shortcut: await query('SELECT ... WHERE id = $1', [id])
export const query = (text, params) => pool.query(text, params);

// Run a function inside a transaction. Used by checkout so that
// stock updates and order creation succeed or fail together.
export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Creates tables if they don't exist yet (runs every time the server starts)
export async function connectPostgres() {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const schema = await fs.readFile(path.join(__dirname, '../db/schema.sql'), 'utf8');
  await pool.query(schema);
  console.log('✔ PostgreSQL connected, schema ready');
}
