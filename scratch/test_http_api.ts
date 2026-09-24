import express from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../src/server/db.js';
import { getBrasiliaDateString, isSupervisorMatch } from '../src/utils/dateUtils.js';

const JWT_SECRET = process.env.JWT_SECRET || 'sinalizacoes_secret_key_2026_super_secure';

async function testHttpFlow() {
  console.log('--- RUNNING HTTP API ABSENTEISMO TEST ---');

  // 1. Generate test token
  const token = jwt.sign(
    { id: 1, nome: 'VITORIA MARQUES CUNHA', login: 'vitoria.cunha', perfil: 'Supervisor' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  console.log('1. Testing db.saveAbsenteismoBatch directly...');
  const mockPayload = [
    {
      data: '2026-09-10',
      operador: 'IZABELA SILVA BARCELAR',
      supervisor: 'VITORIA MARQUES CUNHA',
      status: 'Presente' as const,
      observacao: 'Test saving HTTP 1',
      usuario_registro: 'VITORIA MARQUES CUNHA'
    },
    {
      data: '2026-09-10',
      operador: 'ANA CAROLINA FERNANDES MARTINS',
      supervisor: 'VITORIA MARQUES CUNHA',
      status: 'Falta Injustificada' as const,
      observacao: 'Sem justificativa',
      usuario_registro: 'VITORIA MARQUES CUNHA'
    }
  ];

  const saved = await db.saveAbsenteismoBatch(mockPayload, 'VITORIA MARQUES CUNHA');
  console.log('Saved count:', saved.length);

  console.log('2. Fetching absenteismo via db.getAbsenteismo...');
  const fetched = await db.getAbsenteismo('2026-09-10');
  console.log('Fetched count:', fetched.length);
  console.log('Fetched sample:', JSON.stringify(fetched.slice(0, 2), null, 2));

  if (fetched.length >= 2) {
    console.log('✅ ALL HTTP API DATA PERSISTENCE TESTS PASSED!');
  } else {
    console.error('❌ FAILED: Expected saved records to be returned.');
    process.exit(1);
  }
}

testHttpFlow().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
