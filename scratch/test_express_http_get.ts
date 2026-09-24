import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'sinalizacoes_secret_key_2026_super_secure';

async function testExpressHttpGet() {
  console.log('--- TESTING HTTP GET /api/absenteismo?data=2026-09-11 ---');

  const token = jwt.sign(
    { id: 1, nome: 'VITORIA MARQUES CUNHA', login: 'vitoria.cunha', perfil: 'Supervisor' },
    JWT_SECRET,
    { expiresIn: '8h' }
  );

  console.log('Generated token for VITORIA MARQUES CUNHA');

  try {
    const res = await fetch('http://127.0.0.1:3001/api/absenteismo?data=2026-09-11', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('Response status:', res.status);
    console.log('Response ok:', res.ok);

    const text = await res.text();
    console.log('Response body:', text);
  } catch (err) {
    console.error('Fetch error (server running?):', err);
  }
}

testExpressHttpGet();
