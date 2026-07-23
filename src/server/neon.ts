import { neon } from '@neondatabase/serverless';
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

const connectionString =
  process.env.DATABASE_URL ||
  process.env.NEON_DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_URL_NON_POOLING ||
  '';

export const isNeonEnabled = Boolean(connectionString && connectionString.trim().length > 0);

type SqlFn = (query: any, params?: any[]) => Promise<any>;

let sqlQuery: SqlFn | null = null;

if (isNeonEnabled) {
  try {
    sqlQuery = neon(connectionString) as unknown as SqlFn;
    console.log('[Neon] Configured Neon HTTP PostgreSQL database connection.');
  } catch (err) {
    console.error('[Neon] Error initializing Neon HTTP database connection:', err);
  }
}

let initPromise: Promise<void> | null = null;

export async function ensureNeonInitialized(): Promise<boolean> {
  if (!isNeonEnabled || !sqlQuery) return false;
  if (!initPromise) {
    initPromise = (async () => {
      try {
        const sql = sqlQuery!;
        await sql(`
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
        const rows = await sql('SELECT id FROM usuarios LIMIT 1');
        if (rows.length === 0) {
          console.log('[Neon] Initializing system administrator account...');
          const salt = bcrypt.genSaltSync(10);
          const defaultPasswordHash = bcrypt.hashSync('123', salt);

          // Create default Administrator user
          await sql(
            `INSERT INTO usuarios (id, nome, login, senha, perfil, status, produto, supervisor) VALUES
             (1, 'Administrador Geral', 'admin', $1, 'Administrador', 'Ativo', 'Todos', 'Todos')
             ON CONFLICT (id) DO NOTHING;`,
            [defaultPasswordHash]
          );
          await sql(`SELECT setval('usuarios_id_seq', (SELECT MAX(id) FROM usuarios));`);

          // Initialize blank API configuration
          await sql(`
            INSERT INTO configuracao_api (id, url_api, token, usuario, senha, ultima_sincronizacao) VALUES
            (1, '', '', '', '', '')
            ON CONFLICT (id) DO NOTHING;
          `);
          await sql(`SELECT setval('configuracao_api_id_seq', (SELECT MAX(id) FROM configuracao_api));`);
        }

        // Clean up legacy mock data
        await sql(`
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

// Neon CRUD implementation using HTTP serverless queries
export const neonDb = {
  getUsuarios: async (): Promise<Usuario[]> => {
    if (!sqlQuery) return [];
    await ensureNeonInitialized();
    const rows = (await sqlQuery('SELECT * FROM usuarios ORDER BY id ASC')) as any[];
    return rows;
  },
  getUsuarioByLogin: async (login: string): Promise<Usuario | undefined> => {
    if (!sqlQuery) return undefined;
    await ensureNeonInitialized();
    const rows = (await sqlQuery('SELECT * FROM usuarios WHERE LOWER(login) = LOWER($1) LIMIT 1', [login])) as any[];
    return rows[0];
  },
  getUsuarioById: async (id: number): Promise<Usuario | undefined> => {
    if (!sqlQuery) return undefined;
    await ensureNeonInitialized();
    const rows = (await sqlQuery('SELECT * FROM usuarios WHERE id = $1', [id])) as any[];
    return rows[0];
  },
  addUsuario: async (data: Omit<Usuario, 'id'>): Promise<Usuario> => {
    if (!sqlQuery) throw new Error('Database not connected');
    await ensureNeonInitialized();
    const rows = (await sqlQuery(
      `INSERT INTO usuarios (nome, login, senha, perfil, status, produto, supervisor)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [data.nome, data.login, data.senha, data.perfil, data.status, data.produto || 'Todos', data.supervisor || 'Todos']
    )) as any[];
    return rows[0];
  },
  updateUsuario: async (id: number, data: Partial<Usuario>): Promise<Usuario | null> => {
    if (!sqlQuery) return null;
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
    const rows = (await sqlQuery(
      `UPDATE usuarios SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    )) as any[];
    return rows[0] || null;
  },
  deleteUsuario: async (id: number): Promise<void> => {
    if (!sqlQuery) return;
    await ensureNeonInitialized();
    await sqlQuery('DELETE FROM usuarios WHERE id = $1', [id]);
  },

  getSupervisores: async (): Promise<Supervisor[]> => {
    if (!sqlQuery) return [];
    await ensureNeonInitialized();
    const rows = (await sqlQuery('SELECT * FROM supervisores ORDER BY id ASC')) as any[];
    return rows;
  },
  addSupervisor: async (data: Omit<Supervisor, 'id'>): Promise<Supervisor> => {
    if (!sqlQuery) throw new Error('Database not connected');
    await ensureNeonInitialized();
    const rows = (await sqlQuery(
      `INSERT INTO supervisores (nome, produto, status) VALUES ($1, $2, $3) RETURNING *`,
      [data.nome, data.produto, data.status]
    )) as any[];
    return rows[0];
  },
  updateSupervisor: async (id: number, data: Partial<Supervisor>): Promise<Supervisor | null> => {
    if (!sqlQuery) return null;
    await ensureNeonInitialized();
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (data.nome !== undefined) { fields.push(`nome = $${idx++}`); values.push(data.nome); }
    if (data.produto !== undefined) { fields.push(`produto = $${idx++}`); values.push(data.produto); }
    if (data.status !== undefined) { fields.push(`status = $${idx++}`); values.push(data.status); }

    if (fields.length === 0) return null;

    values.push(id);
    const rows = (await sqlQuery(
      `UPDATE supervisores SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    )) as any[];
    return rows[0] || null;
  },
  deleteSupervisor: async (id: number): Promise<void> => {
    if (!sqlQuery) return;
    await ensureNeonInitialized();
    await sqlQuery('DELETE FROM supervisores WHERE id = $1', [id]);
  },

  getOperadores: async (): Promise<Operador[]> => {
    if (!sqlQuery) return [];
    await ensureNeonInitialized();
    const rows = (await sqlQuery('SELECT * FROM operadores ORDER BY id ASC')) as any[];
    return rows;
  },
  addOperador: async (data: Omit<Operador, 'id'>): Promise<Operador> => {
    if (!sqlQuery) throw new Error('Database not connected');
    await ensureNeonInitialized();
    const rows = (await sqlQuery(
      `INSERT INTO operadores (nome, produto, supervisor, situacao) VALUES ($1, $2, $3, $4) RETURNING *`,
      [data.nome, data.produto, data.supervisor, data.situacao]
    )) as any[];
    return rows[0];
  },

  getProdutos: async (): Promise<Produto[]> => {
    if (!sqlQuery) return [];
    await ensureNeonInitialized();
    const rows = (await sqlQuery('SELECT * FROM produtos ORDER BY id ASC')) as any[];
    return rows;
  },
  addProduto: async (nome: string): Promise<Produto> => {
    if (!sqlQuery) throw new Error('Database not connected');
    await ensureNeonInitialized();
    const existing = (await sqlQuery('SELECT * FROM produtos WHERE LOWER(nome) = LOWER($1) LIMIT 1', [nome])) as any[];
    if (existing.length > 0) return existing[0];

    const rows = (await sqlQuery('INSERT INTO produtos (nome) VALUES ($1) RETURNING *', [nome])) as any[];
    return rows[0];
  },
  updateProduto: async (id: number, nome: string): Promise<Produto | null> => {
    if (!sqlQuery) return null;
    await ensureNeonInitialized();
    const rows = (await sqlQuery('UPDATE produtos SET nome = $1 WHERE id = $2 RETURNING *', [nome, id])) as any[];
    return rows[0] || null;
  },
  deleteProduto: async (id: number): Promise<void> => {
    if (!sqlQuery) return;
    await ensureNeonInitialized();
    await sqlQuery('DELETE FROM produtos WHERE id = $1', [id]);
  },

  getMotivos: async (): Promise<Motivo[]> => {
    if (!sqlQuery) return [];
    await ensureNeonInitialized();
    const rows = (await sqlQuery('SELECT * FROM motivos ORDER BY id ASC')) as any[];
    return rows;
  },
  addMotivo: async (descricao: string): Promise<Motivo> => {
    if (!sqlQuery) throw new Error('Database not connected');
    await ensureNeonInitialized();
    const rows = (await sqlQuery('INSERT INTO motivos (descricao) VALUES ($1) RETURNING *', [descricao])) as any[];
    return rows[0];
  },
  updateMotivo: async (id: number, descricao: string): Promise<Motivo | null> => {
    if (!sqlQuery) return null;
    await ensureNeonInitialized();
    const rows = (await sqlQuery('UPDATE motivos SET descricao = $1 WHERE id = $2 RETURNING *', [descricao, id])) as any[];
    return rows[0] || null;
  },
  deleteMotivo: async (id: number): Promise<void> => {
    if (!sqlQuery) return;
    await ensureNeonInitialized();
    await sqlQuery('DELETE FROM motivos WHERE id = $1', [id]);
  },

  getSinalizacoes: async (): Promise<Sinalizacao[]> => {
    if (!sqlQuery) return [];
    await ensureNeonInitialized();
    const rows = (await sqlQuery('SELECT * FROM sinalizacoes ORDER BY id DESC')) as any[];
    return rows;
  },
  addSinalizacao: async (data: Omit<Sinalizacao, 'id'>): Promise<Sinalizacao> => {
    if (!sqlQuery) throw new Error('Database not connected');
    await ensureNeonInitialized();
    const rows = (await sqlQuery(
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
    )) as any[];
    return rows[0];
  },
  deleteSinalizacao: async (id: number): Promise<void> => {
    if (!sqlQuery) return;
    await ensureNeonInitialized();
    await sqlQuery('DELETE FROM sinalizacoes WHERE id = $1', [id]);
  },

  getConfigApi: async (): Promise<ConfiguracaoApi> => {
    if (!sqlQuery) {
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
    const rows = (await sqlQuery('SELECT * FROM configuracao_api ORDER BY id ASC LIMIT 1')) as any[];
    if (rows.length === 0) {
      const inserted = (await sqlQuery(
        `INSERT INTO configuracao_api (id, url_api, token, usuario, senha, ultima_sincronizacao)
         VALUES (1, '', '', '', '', '') RETURNING *`
      )) as any[];
      return inserted[0];
    }
    return rows[0];
  },
  updateConfigApi: async (data: Partial<ConfiguracaoApi>): Promise<ConfiguracaoApi> => {
    if (!sqlQuery) throw new Error('Database not connected');
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
    const rows = (await sqlQuery(
      `UPDATE configuracao_api SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    )) as any[];
    return rows[0];
  }
};


