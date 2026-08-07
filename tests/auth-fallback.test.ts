import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ensureSeedUser, findUserByLogin } from '../src/server/localDb.js';

test('seed user fallback keeps an admin user available for login', () => {
  const dbPath = path.resolve(process.cwd(), 'data', 'db.json');
  const original = fs.readFileSync(dbPath, 'utf8');

  try {
    const parsed = JSON.parse(original);
    parsed.usuarios = [];
    fs.writeFileSync(dbPath, JSON.stringify(parsed, null, 2));

    ensureSeedUser();
    const user = findUserByLogin('admin');

    assert.ok(user, 'admin user should be created in local fallback data');
    assert.equal(user?.login, 'admin');
    assert.equal(user?.perfil, 'Administrador');
    assert.equal(user?.status, 'Ativo');
  } finally {
    fs.writeFileSync(dbPath, original);
  }
});
