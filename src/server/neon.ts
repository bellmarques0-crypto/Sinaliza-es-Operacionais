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
} from '../types.js';

const connectionString =
  process.env.DATABASE_URL ||
  process.env.NEON_DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_URL_NON_POOLING ||
  '';

export const isNeonEnabled = Boolean(connectionString && connectionString.trim().length > 0);

type NeonSql = ReturnType<typeof neon>;

let sqlQuery: NeonSql | null = null;

if (isNeonEnabled) {
  try {
    sqlQuery = neon(connectionString);
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
        await sql`
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
        `;
        await sql`
          CREATE TABLE IF NOT EXISTS supervisores (
            id SERIAL PRIMARY KEY,
            nome VARCHAR(255) NOT NULL,
            produto TEXT NOT NULL,
            status VARCHAR(50) NOT NULL
          );
        `;
        await sql`
          CREATE TABLE IF NOT EXISTS produtos (
            id SERIAL PRIMARY KEY,
            nome VARCHAR(255) UNIQUE NOT NULL
          );
        `;
        await sql`
          CREATE TABLE IF NOT EXISTS operadores (
            id SERIAL PRIMARY KEY,
            nome VARCHAR(255) NOT NULL,
            produto VARCHAR(255) NOT NULL,
            supervisor VARCHAR(255) NOT NULL,
            situacao VARCHAR(50) NOT NULL
          );
        `;
        await sql`
          CREATE TABLE IF NOT EXISTS motivos (
            id SERIAL PRIMARY KEY,
            descricao TEXT NOT NULL
          );
        `;
        await sql`
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
        `;
        await sql`
          CREATE TABLE IF NOT EXISTS configuracao_api (
            id SERIAL PRIMARY KEY,
            url_api TEXT,
            token TEXT,
            usuario VARCHAR(255),
            senha TEXT,
            ultima_sincronizacao VARCHAR(100)
          );
        `;

        // Check if admin user exists
        const adminRows = (await sql`SELECT id, senha FROM usuarios WHERE LOWER(login) = 'admin' LIMIT 1`) as any[];
        const salt = bcrypt.genSaltSync(10);
        const defaultPasswordHash = bcrypt.hashSync('123', salt);

        if (adminRows.length === 0) {
          console.log('[Neon] Initializing system administrator account...');
          await sql`
            INSERT INTO usuarios (id, nome, login, senha, perfil, status, produto, supervisor) VALUES
            (1, 'Administrador Geral', 'admin', ${defaultPasswordHash}, 'Administrador', 'Ativo', 'Todos', 'Todos')
            ON CONFLICT (id) DO NOTHING;
          `;
          await sql`SELECT setval('usuarios_id_seq', (SELECT MAX(id) FROM usuarios));`;
        } else if (adminRows[0] && (!adminRows[0].senha || !adminRows[0].senha.startsWith('$2'))) {
          // Fix unhashed password for admin if needed
          console.log('[Neon] Updating administrator password hash...');
          await sql`UPDATE usuarios SET senha = ${defaultPasswordHash} WHERE id = ${adminRows[0].id};`;
        }

        // Initialize API config if empty
        const configRows = (await sql`SELECT id FROM configuracao_api LIMIT 1`) as any[];
        if (configRows.length === 0) {
          await sql`
            INSERT INTO configuracao_api (id, url_api, token, usuario, senha, ultima_sincronizacao) VALUES
            (1, '', '', '', '', '')
            ON CONFLICT (id) DO NOTHING;
          `;
          await sql`SELECT setval('configuracao_api_id_seq', (SELECT MAX(id) FROM configuracao_api));`;
        }

        // Clean up legacy mock data
        await sql`
          DELETE FROM sinalizacoes WHERE operador IN ('Ana Oliveira', 'Bruno Souza', 'Carla Pereira', 'Diego Ferreira', 'Elena Rostova', 'Fábio Junior');
        `;
        await sql`
          DELETE FROM operadores WHERE nome IN ('Ana Oliveira', 'Bruno Souza', 'Carla Pereira', 'Diego Ferreira', 'Elena Rostova', 'Fábio Junior', 'Gisele Bund', 'Heitor Villa', 'Igor Rodrigues', 'João Pedro');
        `;
        await sql`
          DELETE FROM supervisores WHERE nome IN ('Carlos Silva', 'Mariana Santos', 'Roberto Lima', 'Fernanda Costa', 'Juliana Mendes');
        `;
        await sql`
          DELETE FROM produtos WHERE nome IN ('Atendimento Sac', 'Cartões de Crédito', 'Vendas B2B', 'Suporte Técnico', 'Retenção', 'Ouvidoria');
        `;
        await sql`
          DELETE FROM motivos WHERE descricao IN ('Uso de celular', 'Sem pausa', 'Atraso', 'Conduta inadequada', 'Ausência do posto', 'Descumprimento de procedimento', 'Outros');
        `;
        await sql`
          DELETE FROM usuarios WHERE login IN ('plan', 'oper');
        `;

        console.log('[Neon] Tables verified and initialized successfully.');
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
    try {
      const ok = await ensureNeonInitialized();
      if (!ok) return [];
      const rows = (await sqlQuery`SELECT * FROM usuarios ORDER BY id ASC`) as any[];
      return rows;
    } catch (err) {
      console.warn('[Neon] Error in getUsuarios:', err);
      return [];
    }
  },
  getUsuarioByLogin: async (login: string): Promise<Usuario | undefined> => {
    if (!sqlQuery) return undefined;
    try {
      const ok = await ensureNeonInitialized();
      if (!ok) return undefined;
      const lowerLogin = login.toLowerCase();
      const rows = (await sqlQuery`SELECT * FROM usuarios WHERE LOWER(login) = ${lowerLogin} LIMIT 1`) as any[];
      return rows[0];
    } catch (err) {
      console.warn('[Neon] Error in getUsuarioByLogin:', err);
      return undefined;
    }
  },
  getUsuarioById: async (id: number): Promise<Usuario | undefined> => {
    if (!sqlQuery) return undefined;
    try {
      const ok = await ensureNeonInitialized();
      if (!ok) return undefined;
      const rows = (await sqlQuery`SELECT * FROM usuarios WHERE id = ${id}`) as any[];
      return rows[0];
    } catch (err) {
      console.warn('[Neon] Error in getUsuarioById:', err);
      return undefined;
    }
  },
  addUsuario: async (data: Omit<Usuario, 'id'>): Promise<Usuario> => {
    if (!sqlQuery) throw new Error('Database not connected');
    const ok = await ensureNeonInitialized();
    if (!ok) throw new Error('Database initialization failed');
    const prod = data.produto || 'Todos';
    const sup = data.supervisor || 'Todos';
    const rows = (await sqlQuery`
      INSERT INTO usuarios (nome, login, senha, perfil, status, produto, supervisor)
      VALUES (${data.nome}, ${data.login}, ${data.senha}, ${data.perfil}, ${data.status}, ${prod}, ${sup})
      RETURNING *
    `) as any[];
    return rows[0];
  },
  updateUsuario: async (id: number, data: Partial<Usuario>): Promise<Usuario | null> => {
    if (!sqlQuery) return null;
    try {
      const ok = await ensureNeonInitialized();
      if (!ok) return null;
      const current = await neonDb.getUsuarioById(id);
      if (!current) return null;

      const nome = data.nome ?? current.nome;
      const login = data.login ?? current.login;
      const senha = data.senha ?? current.senha;
      const perfil = data.perfil ?? current.perfil;
      const status = data.status ?? current.status;
      const produto = data.produto ?? current.produto;
      const supervisor = data.supervisor ?? current.supervisor;

      const rows = (await sqlQuery`
        UPDATE usuarios 
        SET nome = ${nome}, login = ${login}, senha = ${senha}, perfil = ${perfil}, status = ${status}, produto = ${produto}, supervisor = ${supervisor}
        WHERE id = ${id}
        RETURNING *
      `) as any[];
      return rows[0] || null;
    } catch (err) {
      console.warn('[Neon] Error in updateUsuario:', err);
      return null;
    }
  },
  deleteUsuario: async (id: number): Promise<void> => {
    if (!sqlQuery) return;
    try {
      const ok = await ensureNeonInitialized();
      if (!ok) return;
      await sqlQuery`DELETE FROM usuarios WHERE id = ${id}`;
    } catch (err) {
      console.warn('[Neon] Error in deleteUsuario:', err);
    }
  },

  getSupervisores: async (): Promise<Supervisor[]> => {
    if (!sqlQuery) return [];
    try {
      const ok = await ensureNeonInitialized();
      if (!ok) return [];
      const rows = (await sqlQuery`SELECT * FROM supervisores ORDER BY id ASC`) as any[];
      return rows;
    } catch (err) {
      console.warn('[Neon] Error in getSupervisores:', err);
      return [];
    }
  },
  addSupervisor: async (data: Omit<Supervisor, 'id'>): Promise<Supervisor> => {
    if (!sqlQuery) throw new Error('Database not connected');
    const ok = await ensureNeonInitialized();
    if (!ok) throw new Error('Database initialization failed');
    const rows = (await sqlQuery`
      INSERT INTO supervisores (nome, produto, status) VALUES (${data.nome}, ${data.produto}, ${data.status}) RETURNING *
    `) as any[];
    return rows[0];
  },
  updateSupervisor: async (id: number, data: Partial<Supervisor>): Promise<Supervisor | null> => {
    if (!sqlQuery) return null;
    try {
      const ok = await ensureNeonInitialized();
      if (!ok) return null;
      const currentList = (await sqlQuery`SELECT * FROM supervisores WHERE id = ${id}`) as any[];
      if (!currentList[0]) return null;

      const nome = data.nome ?? currentList[0].nome;
      const produto = data.produto ?? currentList[0].produto;
      const status = data.status ?? currentList[0].status;

      const rows = (await sqlQuery`
        UPDATE supervisores SET nome = ${nome}, produto = ${produto}, status = ${status}
        WHERE id = ${id} RETURNING *
      `) as any[];
      return rows[0] || null;
    } catch (err) {
      console.warn('[Neon] Error in updateSupervisor:', err);
      return null;
    }
  },
  deleteSupervisor: async (id: number): Promise<void> => {
    if (!sqlQuery) return;
    try {
      const ok = await ensureNeonInitialized();
      if (!ok) return;
      await sqlQuery`DELETE FROM supervisores WHERE id = ${id}`;
    } catch (err) {
      console.warn('[Neon] Error in deleteSupervisor:', err);
    }
  },

  getOperadores: async (): Promise<Operador[]> => {
    if (!sqlQuery) return [];
    try {
      const ok = await ensureNeonInitialized();
      if (!ok) return [];
      const rows = (await sqlQuery`SELECT * FROM operadores ORDER BY id ASC`) as any[];
      return rows;
    } catch (err) {
      console.warn('[Neon] Error in getOperadores:', err);
      return [];
    }
  },
  addOperador: async (data: Omit<Operador, 'id'>): Promise<Operador> => {
    if (!sqlQuery) throw new Error('Database not connected');
    const ok = await ensureNeonInitialized();
    if (!ok) throw new Error('Database initialization failed');
    const rows = (await sqlQuery`
      INSERT INTO operadores (nome, produto, supervisor, situacao) VALUES (${data.nome}, ${data.produto}, ${data.supervisor}, ${data.situacao}) RETURNING *
    `) as any[];
    return rows[0];
  },

  getProdutos: async (): Promise<Produto[]> => {
    if (!sqlQuery) return [];
    try {
      const ok = await ensureNeonInitialized();
      if (!ok) return [];
      const rows = (await sqlQuery`SELECT * FROM produtos ORDER BY id ASC`) as any[];
      return rows;
    } catch (err) {
      console.warn('[Neon] Error in getProdutos:', err);
      return [];
    }
  },
  addProduto: async (nome: string): Promise<Produto> => {
    if (!sqlQuery) throw new Error('Database not connected');
    const ok = await ensureNeonInitialized();
    if (!ok) throw new Error('Database initialization failed');
    const lowerName = nome.toLowerCase();
    const existing = (await sqlQuery`SELECT * FROM produtos WHERE LOWER(nome) = ${lowerName} LIMIT 1`) as any[];
    if (existing.length > 0) return existing[0];

    const rows = (await sqlQuery`INSERT INTO produtos (nome) VALUES (${nome}) RETURNING *`) as any[];
    return rows[0];
  },
  updateProduto: async (id: number, nome: string): Promise<Produto | null> => {
    if (!sqlQuery) return null;
    try {
      const ok = await ensureNeonInitialized();
      if (!ok) return null;
      const rows = (await sqlQuery`UPDATE produtos SET nome = ${nome} WHERE id = ${id} RETURNING *`) as any[];
      return rows[0] || null;
    } catch (err) {
      console.warn('[Neon] Error in updateProduto:', err);
      return null;
    }
  },
  deleteProduto: async (id: number): Promise<void> => {
    if (!sqlQuery) return;
    try {
      const ok = await ensureNeonInitialized();
      if (!ok) return;
      await sqlQuery`DELETE FROM produtos WHERE id = ${id}`;
    } catch (err) {
      console.warn('[Neon] Error in deleteProduto:', err);
    }
  },

  getMotivos: async (): Promise<Motivo[]> => {
    if (!sqlQuery) return [];
    try {
      const ok = await ensureNeonInitialized();
      if (!ok) return [];
      const rows = (await sqlQuery`SELECT * FROM motivos ORDER BY id ASC`) as any[];
      return rows;
    } catch (err) {
      console.warn('[Neon] Error in getMotivos:', err);
      return [];
    }
  },
  addMotivo: async (descricao: string): Promise<Motivo> => {
    if (!sqlQuery) throw new Error('Database not connected');
    const ok = await ensureNeonInitialized();
    if (!ok) throw new Error('Database initialization failed');
    const rows = (await sqlQuery`INSERT INTO motivos (descricao) VALUES (${descricao}) RETURNING *`) as any[];
    return rows[0];
  },
  updateMotivo: async (id: number, descricao: string): Promise<Motivo | null> => {
    if (!sqlQuery) return null;
    try {
      const ok = await ensureNeonInitialized();
      if (!ok) return null;
      const rows = (await sqlQuery`UPDATE motivos SET descricao = ${descricao} WHERE id = ${id} RETURNING *`) as any[];
      return rows[0] || null;
    } catch (err) {
      console.warn('[Neon] Error in updateMotivo:', err);
      return null;
    }
  },
  deleteMotivo: async (id: number): Promise<void> => {
    if (!sqlQuery) return;
    try {
      const ok = await ensureNeonInitialized();
      if (!ok) return;
      await sqlQuery`DELETE FROM motivos WHERE id = ${id}`;
    } catch (err) {
      console.warn('[Neon] Error in deleteMotivo:', err);
    }
  },

  getSinalizacoes: async (): Promise<Sinalizacao[]> => {
    if (!sqlQuery) return [];
    try {
      const ok = await ensureNeonInitialized();
      if (!ok) return [];
      const rows = (await sqlQuery`SELECT * FROM sinalizacoes ORDER BY id DESC`) as any[];
      return rows;
    } catch (err) {
      console.warn('[Neon] Error in getSinalizacoes:', err);
      return [];
    }
  },
  addSinalizacao: async (data: Omit<Sinalizacao, 'id'>): Promise<Sinalizacao> => {
    if (!sqlQuery) throw new Error('Database not connected');
    const ok = await ensureNeonInitialized();
    if (!ok) throw new Error('Database initialization failed');
    const obs = data.observacao || '';
    const nomeEv = data.nome_evidencia || '';
    const camEv = data.caminho_evidencia || '';
    const rows = (await sqlQuery`
      INSERT INTO sinalizacoes (data, hora, operador, supervisor, produto, motivo, observacao, nome_evidencia, caminho_evidencia, usuario_responsavel, data_cadastro)
      VALUES (${data.data}, ${data.hora}, ${data.operador}, ${data.supervisor}, ${data.produto}, ${data.motivo}, ${obs}, ${nomeEv}, ${camEv}, ${data.usuario_responsavel}, ${data.data_cadastro})
      RETURNING *
    `) as any[];
    return rows[0];
  },
  deleteSinalizacao: async (id: number): Promise<void> => {
    if (!sqlQuery) return;
    try {
      const ok = await ensureNeonInitialized();
      if (!ok) return;
      await sqlQuery`DELETE FROM sinalizacoes WHERE id = ${id}`;
    } catch (err) {
      console.warn('[Neon] Error in deleteSinalizacao:', err);
    }
  },

  getConfigApi: async (): Promise<ConfiguracaoApi> => {
    const defaultConfig: ConfiguracaoApi = {
      id: 1,
      url_api: '',
      token: '',
      usuario: '',
      senha: '',
      ultima_sincronizacao: ''
    };
    if (!sqlQuery) return defaultConfig;
    try {
      const ok = await ensureNeonInitialized();
      if (!ok) return defaultConfig;
      const rows = (await sqlQuery`SELECT * FROM configuracao_api ORDER BY id ASC LIMIT 1`) as any[];
      if (rows.length === 0) {
        const inserted = (await sqlQuery`
          INSERT INTO configuracao_api (id, url_api, token, usuario, senha, ultima_sincronizacao)
          VALUES (1, '', '', '', '', '') RETURNING *
        `) as any[];
        return inserted[0] || defaultConfig;
      }
      return rows[0] || defaultConfig;
    } catch (err) {
      console.warn('[Neon] Error in getConfigApi:', err);
      return defaultConfig;
    }
  },
  updateConfigApi: async (data: Partial<ConfiguracaoApi>): Promise<ConfiguracaoApi> => {
    if (!sqlQuery) throw new Error('Database not connected');
    const ok = await ensureNeonInitialized();
    if (!ok) throw new Error('Database initialization failed');
    const current = await neonDb.getConfigApi();
    const url_api = data.url_api ?? current.url_api;
    const token = data.token ?? current.token;
    const usuario = data.usuario ?? current.usuario;
    const senha = data.senha ?? current.senha;
    const ultima_sincronizacao = data.ultima_sincronizacao ?? current.ultima_sincronizacao;

    const rows = (await sqlQuery`
      UPDATE configuracao_api
      SET url_api = ${url_api}, token = ${token}, usuario = ${usuario}, senha = ${senha}, ultima_sincronizacao = ${ultima_sincronizacao}
      WHERE id = ${current.id}
      RETURNING *
    `) as any[];
    return rows[0];
  }
};
