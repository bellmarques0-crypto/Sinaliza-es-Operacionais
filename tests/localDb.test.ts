import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function createTempWorkspace() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'localdb-test-'));
  fs.mkdirSync(path.join(tempDir, 'data'), { recursive: true });
  return tempDir;
}

test('ensureSeedUser should not rewrite db.json when the seed user already exists', async () => {
  const tempDir = createTempWorkspace();
  const dbPath = path.join(tempDir, 'data', 'db.json');
  const previousCwd = process.cwd();

  fs.writeFileSync(
    dbPath,
    JSON.stringify(
      {
        usuarios: [
          {
            id: 1,
            nome: 'Administrador Geral',
            login: 'admin',
            senha: 'hashed',
            perfil: 'Administrador',
            status: 'Ativo',
            produto: 'Todos',
            supervisor: 'Todos'
          }
        ]
      },
      null,
      2
    )
  );

  process.chdir(tempDir);

  const originalWriteFileSync = fs.writeFileSync;
  let writeCalls = 0;

  fs.writeFileSync = ((file: any, data: any, ...rest: any[]) => {
    writeCalls += 1;
    return originalWriteFileSync(file, data, ...rest);
  }) as typeof fs.writeFileSync;

  try {
    const { ensureSeedUser } = await import('../src/server/localDb.ts');

    ensureSeedUser();

    assert.equal(writeCalls, 0, 'ensureSeedUser should not rewrite the database file when the seed user already exists');
  } finally {
    fs.writeFileSync = originalWriteFileSync;
    process.chdir(previousCwd);
  }
});
