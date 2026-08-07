import 'dotenv/config';

async function fetchJson(url, options = {}) {
  try {
    const res = await fetch(url, options);
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = text;
    }
    return { status: res.status, ok: res.ok, body: json };
  } catch (err) {
    return { error: String(err) };
  }
}

(async () => {
  const base = 'http://127.0.0.1:3001';
  console.log('BASE', base);

  const health = await fetchJson(`${base}/api/health`);
  console.log('HEALTH', health);

  const login = await fetchJson(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: 'admin', senha: 'admin' })
  });
  console.log('LOGIN', login);

  if (login.ok && login.body.token) {
    const token = login.body.token;
    for (const path of ['/api/usuarios', '/api/produtos', '/api/motivos', '/api/supervisores', '/api/operadores', '/api/sinalizacoes']) {
      const result = await fetchJson(`${base}${path}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log(path, result.status, result.ok, Array.isArray(result.body) ? result.body.length : result.body);
      if (Array.isArray(result.body)) {
        console.log(JSON.stringify(result.body.slice(0, 5), null, 2));
      } else {
        console.log(result.body);
      }
    }
  }
})();