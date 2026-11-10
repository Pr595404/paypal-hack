/**
 * db/pool.js — Postgres connection pool and helpers
 */
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' || process.env.DATABASE_URL?.includes('neon')
    ? { rejectUnauthorized: false }
    : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected pool error:', err.message);
});

/**
 * Execute a parameterized query.
 * @param {string} text - SQL query with $1, $2, ... placeholders
 * @param {Array} params - Parameter values
 * @returns {Promise<import('pg').QueryResult>}
 */
async function query(text, params) {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    if (process.env.NODE_ENV !== 'production') {
      console.log('[DB]', { text: text.substring(0, 80), duration: `${duration}ms`, rows: result.rowCount });
    }
    return result;
  } catch (err) {
    console.error('[DB] Query error:', { text: text.substring(0, 80), error: err.message });
    throw err;
  }
}

/**
 * Run schema.sql to create tables.
 */
async function initSchema() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');
  await pool.query(sql);
  console.log('[DB] Schema initialized successfully.');
}

/**
 * Run seed.sql to insert demo data.
 */
async function seed() {
  const seedPath = path.join(__dirname, 'seed.sql');
  const sql = fs.readFileSync(seedPath, 'utf8');
  await pool.query(sql);
  console.log('[DB] Seed data inserted successfully.');
}

module.exports = { query, pool, initSchema, seed };
