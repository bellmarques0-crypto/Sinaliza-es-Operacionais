import { db } from '../src/server/db.js';

async function testGetSinalizacoes() {
  console.log('--- TESTING db.getSinalizacoes() ---');
  try {
    const list = await db.getSinalizacoes();
    console.log('Result length:', list.length);
    console.log('Sample (first 3):', JSON.stringify(list.slice(0, 3), null, 2));
  } catch (e: any) {
    console.error('Error fetching sinalizacoes:', e);
  }
}

testGetSinalizacoes();
