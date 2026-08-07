import 'dotenv/config';
import pkg from 'pg';
const { Pool } = pkg;
const connectionString = process.env.DATABASE_URL || 'postgresql://proativa:Crystall%25%26Gas@10.8.1.85:5432/DB_SINALIZACOES';
console.log('using DATABASE_URL:', connectionString);
const pool = new Pool({ connectionString, ssl: false });

(async () => {
  try {
    const user = await pool.query(
      `SELECT id, login, nome, senha, perfil, status
       FROM schema_sinal_operacao.usuarios
       WHERE login = $1
       LIMIT 1`,
      ['admin']
    );
    console.log('admin user row:', JSON.stringify(user.rows, null, 2));
  } catch (err) {
    console.error('error', err);
  } finally {
    await pool.end();
  }
})();
