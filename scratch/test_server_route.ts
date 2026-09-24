import jwt from 'jsonwebtoken';
import { db } from '../src/server/db.js';

async function runTest() {
  console.log('Testing db.getAbsenteismo("2026-09-11")...');
  try {
    const records = await db.getAbsenteismo('2026-09-11');
    console.log('SUCCESS db.getAbsenteismo:', Array.isArray(records), records.length);
  } catch (e: any) {
    console.error('ERROR db.getAbsenteismo:', e);
  }

  console.log('Testing db.saveAbsenteismoBatch...');
  try {
    const saved = await db.saveAbsenteismoBatch([
      {
        data: '2026-09-11',
        operador: 'IZABELA SILVA BARCELAR',
        supervisor: 'VITORIA MARQUES CUNHA',
        status: 'Presente' as const,
        observacao: 'Test 2026-09-11',
        usuario_registro: 'VITORIA MARQUES CUNHA'
      }
    ], 'VITORIA MARQUES CUNHA');
    console.log('SUCCESS db.saveAbsenteismoBatch:', Array.isArray(saved), saved.length);
  } catch (e: any) {
    console.error('ERROR db.saveAbsenteismoBatch:', e);
  }
}

runTest();
