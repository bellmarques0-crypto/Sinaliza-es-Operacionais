import { Pool, neon, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import bcrypt from 'bcryptjs';
import {
  Usuario,
  Supervisor,
  Operador,
  Produto,
  Motivo,
  Sinalizacao,
  ConfiguracaoApi
} from '../types';

// Configure WebSocket for Node environment / Vercel Serverless
neonConfig.webSocketConstructor = ws;

const connectionString =
  process.env.DATABASE_URL ||
  process.env.NEON_DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_URL_NON_POOLING ||
  '';

export const isNeonEnabled = Boolean(connectionString && connectionString.trim().length > 0);

let pool: Pool | null = null;
let sqlQuery: ReturnType<typeof neon> | null = null;

if (isNeonEnabled) {
  try {
    pool = new Pool({ connectionString });
    sqlQuery = neon(connectionString);
    console.log('[Neon] Configured Neon PostgreSQL database connection.');
  } catch (err) {
    console.error('[Neon] Error initializing Neon database connection:', err);
  }
}

let initPromise: Promise<void> | null = null;

export async function ensureNeonInitialized(): Promise<boolean> {
  if (!isNeonEnabled || !pool) return false;
  if (!initPromise) {
    initPromise = (async () => {
      const client = await pool.connect();
      try {
        await client.query(`
          CREATE TABLE IF NOT EXISTS usuarios (
            id SERIAL PRIMARY KEY,
            nome VARCHAR(255) NOT NULL,
            login VARCHAR(255) UNIQUE NOT NULL,
            senha TEXT NOT NULL,
            perfil VARCHAR(100) NOT NULL,
            status VARCHAR(50) NOT NULL,
            produto VARCHAR(255) DEFAULT 'Todos',
            supervisor VARCHAR(255) DEFAULT 'Todos'
          );

          CREATE TABLE IF NOT EXISTS supervisores (
            id SERIAL PRIMARY KEY,
            nome VARCHAR(255) NOT NULL,
            produto TEXT NOT NULL,
            status VARCHAR(50) NOT NULL
          );

          CREATE TABLE IF NOT EXISTS produtos (
            id SERIAL PRIMARY KEY,
            nome VARCHAR(255) UNIQUE NOT NULL
          );

          CREATE TABLE IF NOT EXISTS operadores (
            id SERIAL PRIMARY KEY,
            nome VARCHAR(255) NOT NULL,
            produto VARCHAR(255) NOT NULL,
            supervisor VARCHAR(255) NOT NULL,
            situacao VARCHAR(50) NOT NULL
          );

          CREATE TABLE IF NOT EXISTS motivos (
            id SERIAL PRIMARY KEY,
            descricao TEXT NOT NULL
          );

          CREATE TABLE IF NOT EXISTS sinalizacoes (
            id SERIAL PRIMARY KEY,
            data VARCHAR(50) NOT NULL,
            hora VARCHAR(50) NOT NULL,
            operador VARCHAR(255) NOT NULL,
            supervisor VARCHAR(255) NOT NULL,
            produto VARCHAR(255) NOT NULL,
            motivo VARCHAR(255) NOT NULL,
            observacao TEXT,
            nome_evidencia VARCHAR(255),
            caminho_evidencia TEXT,
            usuario_responsavel VARCHAR(255) NOT NULL,
            data_cadastro VARCHAR(100) NOT NULL
          );

          CREATE TABLE IF NOT EXISTS configuracao_api (
            id SERIAL PRIMARY KEY,
            url_api TEXT,
            token TEXT,
            usuario VARCHAR(255),
            senha TEXT,
            ultima_sincronizacao VARCHAR(100)
          );
        `);

        // Check if initial users exist
        const { rowCount } = await client.query('SELECT id FROM usuarios LIMIT 1');
        if (rowCount === 0) {
          console.log('[Neon] Initializing system administrator account...');
          const salt = bcrypt.genSaltSync(10);
          const defaultPasswordHash = bcrypt.hashSync('123', salt);

          // Create default Administrator user
          await client.query(`
            INSERT INTO usuarios (id, nome, login, senha, perfil, status, produto, supervisor) VALUES
            (1, 'Administrador Geral', 'admin', '${defaultPasswordHash}', 'Administrador', 'Ativo', 'Todos', 'Todos')
            ON CONFLICT (id) DO NOTHING;
          `);
          await client.query(`SELECT setval('usuarios_id_seq', (SELECT MAX(id) FROM usuarios));`);

          // Initialize blank API configuration
          await client.query(`
            INSERT INTO configuracao_api (id, url_api, token, usuario, senha, ultima_sincronizacao) VALUES
            (1, '', '', '', '', '')
            ON CONFLICT (id) DO NOTHING;
          `);
          await client.query(`SELECT setval('configuracao_api_id_seq', (SELECT MAX(id) FROM configuracao_api));`);
        }

        // Clean up legacy mock data
        await client.query(`
          DELETE FROM sinalizacoes WHERE operador IN ('Ana Oliveira', 'Bruno Souza', 'Carla Pereira', 'Diego Ferreira', 'Elena Rostova', 'Fábio Junior');
          DELETE FROM operadores WHERE nome IN ('Ana Oliveira', 'Bruno Souza', 'Carla Pereira', 'Diego Ferreira', 'Elena Rostova', 'Fábio Junior', 'Gisele Bund', 'Heitor Villa', 'Igor Rodrigues', 'João Pedro');
          DELETE FROM supervisores WHERE nome IN ('Carlos Silva', 'Mariana Santos', 'Roberto Lima', 'Fernanda Costa', 'Juliana Mendes');
          DELETE FROM produtos WHERE nome IN ('Atendimento Sac', 'Cartões de Crédito', 'Vendas B2B', 'Suporte Técnico', 'Retenção', 'Ouvidoria');
          DELETE FROM motivos WHERE descricao IN ('Uso de celular', 'Sem pausa', 'Atraso', 'Conduta inadequada', 'Ausência do posto', 'Descumprimento de procedimento', 'Outros');
          DELETE FROM usuarios WHERE login IN ('plan', 'oper');
        `);
      } catch (err) {
        console.error('[Neon] Failed to initialize tables in Neon database:', err);
        initPromise = null;
        throw err;
      } finally {
        client.release();
      }
    })();
  }
  try {
    await initPromise;
    return true;
  } catch (err) {
    return false;
  }
}

export async function initNeonTables() {
  await ensureNeonInitialized();
}

// Neon CRUD implementation
export const neonDb = {
  getUsuarios: async (): Promise<Usuario[]> => {
    if (!pool) return [];
    await ensureNeonInitialized();
    const res = await pool.query('SELECT * FROM usuarios ORDER BY id ASC');
    return res.rows;
  },
  getUsuarioByLogin: async (login: string): Promise<Usuario | undefined> => {
    if (!pool) return undefined;
    await ensureNeonInitialized();
    const res = await pool.query('SELECT * FROM usuarios WHERE LOWER(login) = LOWER($1) LIMIT 1', [login]);
    return res.rows[0];
  },
  getUsuarioById: async (id: number): Promise<Usuario | undefined> => {
    if (!pool) return undefined;
    await ensureNeonInitialized();
    const res = await pool.query('SELECT * FROM usuarios WHERE id = $1', [id]);
    return res.rows[0];
  },
  addUsuario: async (data: Omit<Usuario, 'id'>): Promise<Usuario> => {
    if (!pool) throw new Error('Database not connected');
    await ensureNeonInitialized();
    const res = await pool.query(
      `INSERT INTO usuarios (nome, login, senha, perfil, status, produto, supervisor)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [data.nome, data.login, data.senha, data.perfil, data.status, data.produto || 'Todos', data.supervisor || 'Todos']
    );
    return res.rows[0];
  },
  updateUsuario: async (id: number, data: Partial<Usuario>): Promise<Usuario | null> => {
    if (!pool) return null;
    await ensureNeonInitialized();
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (data.nome !== undefined) { fields.push(`nome = $${idx++}`); values.push(data.nome); }
    if (data.login !== undefined) { fields.push(`login = $${idx++}`); values.push(data.login); }
    if (data.senha !== undefined) { fields.push(`senha = $${idx++}`); values.push(data.senha); }
    if (data.perfil !== undefined) { fields.push(`perfil = $${idx++}`); values.push(data.perfil); }
    if (data.status !== undefined) { fields.push(`status = $${idx++}`); values.push(data.status); }
    if (data.produto !== undefined) { fields.push(`produto = $${idx++}`); values.push(data.produto); }
    if (data.supervisor !== undefined) { fields.push(`supervisor = $${idx++}`); values.push(data.supervisor); }

    if (fields.length === 0) return (await neonDb.getUsuarioById(id)) || null;

    values.push(id);
    const res = await pool.query(
      `UPDATE usuarios SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    return res.rows[0] || null;
  },
  deleteUsuario: async (id: number): Promise<void> => {
    if (!pool) return;
    await ensureNeonInitialized();
    await pool.query('DELETE FROM usuarios WHERE id = $1', [id]);
  },

  getSupervisores: async (): Promise<Supervisor[]> => {
    if (!pool) return [];
    await ensureNeonInitialized();
    const res = await pool.query('SELECT * FROM supervisores ORDER BY id ASC');
    return res.rows;
  },
  addSupervisor: async (data: Omit<Supervisor, 'id'>): Promise<Supervisor> => {
    if (!pool) throw new Error('Database not connected');
    await ensureNeonInitialized();
    const res = await pool.query(
      `INSERT INTO supervisores (nome, produto, status) VALUES ($1, $2, $3) RETURNING *`,
      [data.nome, data.produto, data.status]
    );
    return res.rows[0];
  },
  updateSupervisor: async (id: number, data: Partial<Supervisor>): Promise<Supervisor | null> => {
    if (!pool) return null;
    await ensureNeonInitialized();
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (data.nome !== undefined) { fields.push(`nome = $${idx++}`); values.push(data.nome); }
    if (data.produto !== undefined) { fields.push(`produto = $${idx++}`); values.push(data.produto); }
    if (data.status !== undefined) { fields.push(`status = $${idx++}`); values.push(data.status); }

    if (fields.length === 0) return null;

    values.push(id);
    const res = await pool.query(
      `UPDATE supervisores SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    return res.rows[0] || null;
  },
  deleteSupervisor: async (id: number): Promise<void> => {
    if (!pool) return;
    await ensureNeonInitialized();
    await pool.query('DELETE FROM supervisores WHERE id = $1', [id]);
  },

  getOperadores: async (): Promise<Operador[]> => {
    if (!pool) return [];
    await ensureNeonInitialized();
    const res = await pool.query('SELECT * FROM operadores ORDER BY id ASC');
    return res.rows;
  },
  addOperador: async (data: Omit<Operador, 'id'>): Promise<Operador> => {
    if (!pool) throw new Error('Database not connected');
    await ensureNeonInitialized();
    const res = await pool.query(
      `INSERT INTO operadores (nome, produto, supervisor, situacao) VALUES ($1, $2, $3, $4) RETURNING *`,
      [data.nome, data.produto, data.supervisor, data.situacao]
    );
    return res.rows[0];
  },

  getProdutos: async (): Promise<Produto[]> => {
    if (!pool) return [];
    await ensureNeonInitialized();
    const res = await pool.query('SELECT * FROM produtos ORDER BY id ASC');
    return res.rows;
  },
  addProduto: async (nome: string): Promise<Produto> => {
    if (!pool) throw new Error('Database not connected');
    await ensureNeonInitialized();
    const existing = await pool.query('SELECT * FROM produtos WHERE LOWER(nome) = LOWER($1) LIMIT 1', [nome]);
    if (existing.rows.length > 0) return existing.rows[0];

    const res = await pool.query('INSERT INTO produtos (nome) VALUES ($1) RETURNING *', [nome]);
    return res.rows[0];
  },
  updateProduto: async (id: number, nome: string): Promise<Produto | null> => {
    if (!pool) return null;
    await ensureNeonInitialized();
    const res = await pool.query('UPDATE produtos SET nome = $1 WHERE id = $2 RETURNING *', [nome, id]);
    return res.rows[0] || null;
  },
  deleteProduto: async (id: number): Promise<void> => {
    if (!pool) return;
    await ensureNeonInitialized();
    await pool.query('DELETE FROM produtos WHERE id = $1', [id]);
  },

  getMotivos: async (): Promise<Motivo[]> => {
    if (!pool) return [];
    await ensureNeonInitialized();
    const res = await pool.query('SELECT * FROM motivos ORDER BY id ASC');
    return res.rows;
  },
  addMotivo: async (descricao: string): Promise<Motivo> => {
    if (!pool) throw new Error('Database not connected');
    await ensureNeonInitialized();
    const res = await pool.query('INSERT INTO motivos (descricao) VALUES ($1) RETURNING *', [descricao]);
    return res.rows[0];
  },
  updateMotivo: async (id: number, descricao: string): Promise<Motivo | null> => {
    if (!pool) return null;
    await ensureNeonInitialized();
    const res = await pool.query('UPDATE motivos SET descricao = $1 WHERE id = $2 RETURNING *', [descricao, id]);
    return res.rows[0] || null;
  },
  deleteMotivo: async (id: number): Promise<void> => {
    if (!pool) return;
    await ensureNeonInitialized();
    await pool.query('DELETE FROM motivos WHERE id = $1', [id]);
  },

  getSinalizacoes: async (): Promise<Sinalizacao[]> => {
    if (!pool) return [];
    await ensureNeonInitialized();
    const res = await pool.query('SELECT * FROM sinalizacoes ORDER BY id DESC');
    return res.rows;
  },
  addSinalizacao: async (data: Omit<Sinalizacao, 'id'>): Promise<Sinalizacao> => {
    if (!pool) throw new Error('Database not connected');
    await ensureNeonInitialized();
    const res = await pool.query(
      `INSERT INTO sinalizacoes (data, hora, operador, supervisor, produto, motivo, observacao, nome_evidencia, caminho_evidencia, usuario_responsavel, data_cadastro)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [
        data.data,
        data.hora,
        data.operador,
        data.supervisor,
        data.produto,
        data.motivo,
        data.observacao || '',
        data.nome_evidencia || '',
        data.caminho_evidencia || '',
        data.usuario_responsavel,
        data.data_cadastro
      ]
    );
    return res.rows[0];
  },
  deleteSinalizacao: async (id: number): Promise<void> => {
    if (!pool) return;
    await ensureNeonInitialized();
    await pool.query('DELETE FROM sinalizacoes WHERE id = $1', [id]);
  },

  getConfigApi: async (): Promise<ConfiguracaoApi> => {
    if (!pool) {
      return {
        id: 1,
        url_api: '',
        token: '',
        usuario: '',
        senha: '',
        ultima_sincronizacao: ''
      };
    }
    await ensureNeonInitialized();
    const res = await pool.query('SELECT * FROM configuracao_api ORDER BY id ASC LIMIT 1');
    if (res.rows.length === 0) {
      const inserted = await pool.query(
        `INSERT INTO configuracao_api (id, url_api, token, usuario, senha, ultima_sincronizacao)
         VALUES (1, '', '', '', '', '') RETURNING *`
      );
      return inserted.rows[0];
    }
    return res.rows[0];
  },
  updateConfigApi: async (data: Partial<ConfiguracaoApi>): Promise<ConfiguracaoApi> => {
    if (!pool) throw new Error('Database not connected');
    await ensureNeonInitialized();
    const current = await neonDb.getConfigApi();
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (data.url_api !== undefined) { fields.push(`url_api = $${idx++}`); values.push(data.url_api); }
    if (data.token !== undefined) { fields.push(`token = $${idx++}`); values.push(data.token); }
    if (data.usuario !== undefined) { fields.push(`usuario = $${idx++}`); values.push(data.usuario); }
    if (data.senha !== undefined) { fields.push(`senha = $${idx++}`); values.push(data.senha); }
    if (data.ultima_sincronizacao !== undefined) { fields.push(`ultima_sincronizacao = $${idx++}`); values.push(data.ultima_sincronizacao); }

    if (fields.length === 0) return current;

    values.push(current.id);
    const res = await pool.query(
      `UPDATE configuracao_api SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    return res.rows[0];
  }
};

