import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';
import {
  Usuario,
  Supervisor,
  Operador,
  Produto,
  Motivo,
  Sinalizacao,
  ConfiguracaoApi,
  DiarioBordoOcorrencia,
  DiarioBordoHistorico
} from '../types.js';
import { getBrasiliaFullString } from '../utils/dateUtils.js';

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
            data_cadastro VARCHAR(100) NOT NULL,
            confirmado BOOLEAN DEFAULT FALSE,
            data_confirmacao VARCHAR(100),
            usuario_confirmacao VARCHAR(255)
          );
        `;
        await sql`ALTER TABLE sinalizacoes ADD COLUMN IF NOT EXISTS confirmado BOOLEAN DEFAULT FALSE;`;
        await sql`ALTER TABLE sinalizacoes ADD COLUMN IF NOT EXISTS data_confirmacao VARCHAR(100);`;
        await sql`ALTER TABLE sinalizacoes ADD COLUMN IF NOT EXISTS usuario_confirmacao VARCHAR(255);`;
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
        await sql`
          CREATE TABLE IF NOT EXISTS diario_bordo (
            id SERIAL PRIMARY KEY,
            data_ocorrencia VARCHAR(50) NOT NULL,
            hora_ocorrencia VARCHAR(50) NOT NULL,
            produto VARCHAR(255) NOT NULL,
            ocorrencia VARCHAR(255) NOT NULL,
            impacto VARCHAR(255) NOT NULL,
            comentario TEXT,
            status VARCHAR(50) NOT NULL DEFAULT 'Aberto',
            responsavel VARCHAR(255) NOT NULL,
            nome_evidencia VARCHAR(255),
            caminho_evidencia TEXT,
            data_solucao VARCHAR(50),
            hora_solucao VARCHAR(50),
            solucao TEXT,
            responsavel_solucao VARCHAR(255),
            usuario_registro VARCHAR(255) NOT NULL,
            data_cadastro VARCHAR(100) NOT NULL,
            data_atualizacao VARCHAR(100) NOT NULL
          );
        `;
        await sql`
          CREATE TABLE IF NOT EXISTS diario_bordo_historico (
            id SERIAL PRIMARY KEY,
            diario_bordo_id INTEGER NOT NULL REFERENCES diario_bordo(id) ON DELETE CASCADE,
            data_hora VARCHAR(100) NOT NULL,
            usuario VARCHAR(255) NOT NULL,
            tipo_alteracao VARCHAR(100) NOT NULL,
            status_anterior VARCHAR(50),
            status_novo VARCHAR(50),
            descricao TEXT NOT NULL
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
  updateSinalizacao: async (id: number, data: Partial<Sinalizacao>): Promise<Sinalizacao | null> => {
    if (!sqlQuery) return null;
    try {
      const ok = await ensureNeonInitialized();
      if (!ok) return null;
      const currentRows = (await sqlQuery`SELECT * FROM sinalizacoes WHERE id = ${id}`) as any[];
      if (currentRows.length === 0) return null;
      const current = currentRows[0];

      const operador = data.operador ?? current.operador;
      const supervisor = data.supervisor ?? current.supervisor;
      const produto = data.produto ?? current.produto;
      const motivo = data.motivo ?? current.motivo;
      const observacao = data.observacao ?? current.observacao;
      const nome_evidencia = data.nome_evidencia ?? current.nome_evidencia;
      const caminho_evidencia = data.caminho_evidencia ?? current.caminho_evidencia;

      const rows = (await sqlQuery`
        UPDATE sinalizacoes
        SET operador = ${operador}, supervisor = ${supervisor}, produto = ${produto}, motivo = ${motivo}, observacao = ${observacao}, nome_evidencia = ${nome_evidencia}, caminho_evidencia = ${caminho_evidencia}
        WHERE id = ${id}
        RETURNING *
      `) as any[];
      return rows[0] || null;
    } catch (err) {
      console.warn('[Neon] Error in updateSinalizacao:', err);
      return null;
    }
  },
  confirmarSinalizacao: async (id: number, usuario_confirmacao: string): Promise<Sinalizacao | null> => {
    if (!sqlQuery) return null;
    try {
      const ok = await ensureNeonInitialized();
      if (!ok) return null;
      const now = new Date();
      const data_confirmacao = getBrasiliaFullString(now);
      const rows = (await sqlQuery`
        UPDATE sinalizacoes
        SET confirmado = TRUE, data_confirmacao = ${data_confirmacao}, usuario_confirmacao = ${usuario_confirmacao}
        WHERE id = ${id}
        RETURNING *
      `) as any[];
      return rows[0] || null;
    } catch (err) {
      console.warn('[Neon] Error in confirmarSinalizacao:', err);
      return null;
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
  },

  // DIÁRIO DE BORDO METHODS
  getDiarioBordo: async (): Promise<DiarioBordoOcorrencia[]> => {
    if (!sqlQuery) return [];
    try {
      const ok = await ensureNeonInitialized();
      if (!ok) return [];
      const rows = (await sqlQuery`SELECT * FROM diario_bordo ORDER BY id DESC`) as any[];
      return rows;
    } catch (err) {
      console.warn('[Neon] Error in getDiarioBordo:', err);
      return [];
    }
  },

  getDiarioBordoById: async (id: number): Promise<DiarioBordoOcorrencia | null> => {
    if (!sqlQuery) return null;
    try {
      const ok = await ensureNeonInitialized();
      if (!ok) return null;
      const rows = (await sqlQuery`SELECT * FROM diario_bordo WHERE id = ${id} LIMIT 1`) as any[];
      return rows[0] || null;
    } catch (err) {
      console.warn('[Neon] Error in getDiarioBordoById:', err);
      return null;
    }
  },

  addDiarioBordo: async (data: Omit<DiarioBordoOcorrencia, 'id'>): Promise<DiarioBordoOcorrencia> => {
    if (!sqlQuery) throw new Error('Database not connected');
    const ok = await ensureNeonInitialized();
    if (!ok) throw new Error('Database initialization failed');
    const com = data.comentario || '';
    const nomeEv = data.nome_evidencia || '';
    const camEv = data.caminho_evidencia || '';
    const dataSol = data.data_solucao || '';
    const horaSol = data.hora_solucao || '';
    const sol = data.solucao || '';
    const respSol = data.responsavel_solucao || '';

    const rows = (await sqlQuery`
      INSERT INTO diario_bordo (
        data_ocorrencia, hora_ocorrencia, produto, ocorrencia, impacto,
        comentario, status, responsavel, nome_evidencia, caminho_evidencia,
        data_solucao, hora_solucao, solucao, responsavel_solucao,
        usuario_registro, data_cadastro, data_atualizacao
      )
      VALUES (
        ${data.data_ocorrencia}, ${data.hora_ocorrencia}, ${data.produto}, ${data.ocorrencia}, ${data.impacto},
        ${com}, ${data.status}, ${data.responsavel}, ${nomeEv}, ${camEv},
        ${dataSol}, ${horaSol}, ${sol}, ${respSol},
        ${data.usuario_registro}, ${data.data_cadastro}, ${data.data_atualizacao}
      )
      RETURNING *
    `) as any[];

    const newRecord = rows[0];

    // Auto record initial history log
    await neonDb.addDiarioBordoHistorico({
      diario_bordo_id: newRecord.id,
      data_hora: newRecord.data_cadastro,
      usuario: newRecord.usuario_registro,
      tipo_alteracao: 'Criação',
      status_anterior: undefined,
      status_novo: newRecord.status,
      descricao: `Ocorrência iniciada por ${newRecord.usuario_registro} - Status: ${newRecord.status}`
    });

    return newRecord;
  },

  updateDiarioBordo: async (
    id: number,
    data: Partial<DiarioBordoOcorrencia>,
    usuarioAtualizacao: string
  ): Promise<DiarioBordoOcorrencia | null> => {
    if (!sqlQuery) return null;
    const ok = await ensureNeonInitialized();
    if (!ok) return null;

    const current = await neonDb.getDiarioBordoById(id);
    if (!current) return null;

    const nowStr = getBrasiliaFullString(new Date());

    const data_ocorrencia = data.data_ocorrencia ?? current.data_ocorrencia;
    const hora_ocorrencia = data.hora_ocorrencia ?? current.hora_ocorrencia;
    const produto = data.produto ?? current.produto;
    const ocorrencia = data.ocorrencia ?? current.ocorrencia;
    const impacto = data.impacto ?? current.impacto;
    const comentario = data.comentario ?? current.comentario;
    const status = data.status ?? current.status;
    const responsavel = data.responsavel ?? current.responsavel;
    const nome_evidencia = data.nome_evidencia ?? current.nome_evidencia ?? '';
    const caminho_evidencia = data.caminho_evidencia ?? current.caminho_evidencia ?? '';
    const data_solucao = data.data_solucao ?? current.data_solucao ?? '';
    const hora_solucao = data.hora_solucao ?? current.hora_solucao ?? '';
    const solucao = data.solucao ?? current.solucao ?? '';
    const responsavel_solucao = data.responsavel_solucao ?? current.responsavel_solucao ?? '';

    const rows = (await sqlQuery`
      UPDATE diario_bordo
      SET
        data_ocorrencia = ${data_ocorrencia},
        hora_ocorrencia = ${hora_ocorrencia},
        produto = ${produto},
        ocorrencia = ${ocorrencia},
        impacto = ${impacto},
        comentario = ${comentario},
        status = ${status},
        responsavel = ${responsavel},
        nome_evidencia = ${nome_evidencia},
        caminho_evidencia = ${caminho_evidencia},
        data_solucao = ${data_solucao},
        hora_solucao = ${hora_solucao},
        solucao = ${solucao},
        responsavel_solucao = ${responsavel_solucao},
        data_atualizacao = ${nowStr}
      WHERE id = ${id}
      RETURNING *
    `) as any[];

    const updated = rows[0];

    // Detect changes for history log
    let desc = `Atualização realizada por ${usuarioAtualizacao}.`;
    let tipo = 'Atualização';

    if (current.status !== status) {
      desc = `Status alterado de "${current.status}" para "${status}" por ${usuarioAtualizacao}.`;
      tipo = 'Mudança de Status';
    }
    if (!current.solucao && solucao) {
      desc += ` Solução registrada: "${solucao.slice(0, 80)}${solucao.length > 80 ? '...' : ''}".`;
      tipo = 'Solução Registrada';
    }

    await neonDb.addDiarioBordoHistorico({
      diario_bordo_id: id,
      data_hora: nowStr,
      usuario: usuarioAtualizacao,
      tipo_alteracao: tipo,
      status_anterior: current.status,
      status_novo: status,
      descricao: desc
    });

    return updated;
  },

  deleteDiarioBordo: async (id: number): Promise<void> => {
    if (!sqlQuery) return;
    try {
      const ok = await ensureNeonInitialized();
      if (!ok) return;
      await sqlQuery`DELETE FROM diario_bordo WHERE id = ${id}`;
    } catch (err) {
      console.warn('[Neon] Error in deleteDiarioBordo:', err);
    }
  },

  getDiarioBordoHistorico: async (diario_bordo_id: number): Promise<DiarioBordoHistorico[]> => {
    if (!sqlQuery) return [];
    try {
      const ok = await ensureNeonInitialized();
      if (!ok) return [];
      const rows = (await sqlQuery`
        SELECT * FROM diario_bordo_historico
        WHERE diario_bordo_id = ${diario_bordo_id}
        ORDER BY id ASC
      `) as any[];
      return rows;
    } catch (err) {
      console.warn('[Neon] Error in getDiarioBordoHistorico:', err);
      return [];
    }
  },

  addDiarioBordoHistorico: async (data: Omit<DiarioBordoHistorico, 'id'>): Promise<DiarioBordoHistorico> => {
    if (!sqlQuery) throw new Error('Database not connected');
    const ok = await ensureNeonInitialized();
    if (!ok) throw new Error('Database initialization failed');
    const statusAnt = data.status_anterior || '';
    const statusNov = data.status_novo || '';
    const rows = (await sqlQuery`
      INSERT INTO diario_bordo_historico (
        diario_bordo_id, data_hora, usuario, tipo_alteracao, status_anterior, status_novo, descricao
      )
      VALUES (
        ${data.diario_bordo_id}, ${data.data_hora}, ${data.usuario}, ${data.tipo_alteracao}, ${statusAnt}, ${statusNov}, ${data.descricao}
      )
      RETURNING *
    `) as any[];
    return rows[0];
  }
};
