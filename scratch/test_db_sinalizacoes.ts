import { db } from '../src/server/db.js';
import { pool } from '../src/server/neon.js';

async function run() {
  console.log('--- DB SINALIZACOES TEST ---');

  if (process.env.DATABASE_URL) {
    try {
      const pgRes = await pool.query('SELECT COUNT(*) FROM sinalizacoes');
      console.log('PostgreSQL sinalizacoes count:', pgRes.rows[0]);
    } catch (e: any) {
      console.error('PostgreSQL query error:', e.message);
    }
  } else {
    console.log('DATABASE_URL is not set.');
  }

  const list = await db.getSinalizacoes();
  console.log('db.getSinalizacoes() count:', list.length);
  console.log('Content:', JSON.stringify(list, null, 2));
}

run();
