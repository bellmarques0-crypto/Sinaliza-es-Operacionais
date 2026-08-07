import jwt from 'jsonwebtoken';
import fetch from 'node-fetch';

const token = jwt.sign({ id: 1, nome: 'Administrador Geral', login: 'admin', perfil: 'Administrador' }, 'sinalizacoes_secret_key_2026_super_secure', { expiresIn: '8h' });
console.log('token', token);

const base = 'http://127.0.0.1:3001';
for (const path of ['/api/usuarios', '/api/produtos', '/api/motivos', '/api/supervisores', '/api/operadores', '/api/sinalizacoes']) {
  const res = await fetch(`${base}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  const body = await res.text();
  console.log('path', path, 'status', res.status, 'body', body.slice(0, 500));
}
