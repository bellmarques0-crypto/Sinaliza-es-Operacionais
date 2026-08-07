import pkg from 'pg';
import bcrypt from 'bcryptjs';
const { Pool } = pkg;
const pool = new Pool({ connectionString: 'postgresql://proativa:Crystall%25%26Gas@10.8.1.85:5432/DB_SINALIZACOES', ssl: false });
const candidates = ['admin', 'Admin123', '123456', 'senha', 'password', 'Admin@123', 'admin123', 'P@ssw0rd', 'admin2024', 'senha123'];
(async () => {
  try {
    const res = await pool.query('SELECT id, login, nome, senha, perfil, status FROM schema_sinal_operacao.usuarios WHERE login = $1 LIMIT 1', ['admin']);
    const row = res.rows[0];
    if (!row) {
      console.log('admin not found');
      return;
    }
    console.log('hash:', row.senha);
    for (const pwd of candidates) {
      const match = bcrypt.compareSync(pwd, row.senha);
      console.log(pwd, match);
    }
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
})();