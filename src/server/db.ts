import fs from 'fs';
import path from 'path';
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
import { isNeonEnabled, initNeonTables, neonDb } from './neon';

// Initialize Neon PostgreSQL tables if Neon DATABASE_URL is present
if (isNeonEnabled) {
  initNeonTables().catch((err) => {
    console.error('[Neon] Table initialization failed:', err);
  });
}

interface DBData {
  usuarios: Usuario[];
  supervisores: Supervisor[];
  operadores: Operador[];
  produtos: Produto[];
  motivos: Motivo[];
  sinalizacoes: Sinalizacao[];
  configuracao_api: ConfiguracaoApi;
  nextIds: {
    usuarios: number;
    supervisores: number;
    operadores: number;
    produtos: number;
    motivos: number;
    sinalizacoes: number;
  };
}

const isVercel = !!process.env.VERCEL || !!process.env.VERCEL_ENV;
const DB_DIR = isVercel ? '/tmp/data' : path.join(process.cwd(), 'data');
const DB_FILE = path.join(DB_DIR, 'db.json');
const ROOT_DB_FILE = path.join(process.cwd(), 'data', 'db.json');

function ensureDirectoryExists(dirPath: string) {
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  } catch (err) {
    console.warn(`Could not create directory ${dirPath}:`, err);
  }
}

function getInitialData(): DBData {
  const salt = bcrypt.genSaltSync(10);
  const defaultPasswordHash = bcrypt.hashSync('123', salt);

  return {
    usuarios: [
      {
        id: 1,
        nome: 'Administrador Geral',
        login: 'admin',
        senha: defaultPasswordHash,
        perfil: 'Administrador',
        status: 'Ativo',
        produto: 'Todos',
        supervisor: 'Todos'
      }
    ],
    supervisores: [],
    produtos: [],
    operadores: [],
    motivos: [],
    sinalizacoes: [],
    configuracao_api: {
      id: 1,
      url_api: '',
      token: '',
      usuario: '',
      senha: '',
      ultima_sincronizacao: ''
    },
    nextIds: {
      usuarios: 2,
      supervisores: 1,
      operadores: 1,
      produtos: 1,
      motivos: 1,
      sinalizacoes: 1
    }
  };
}

let dbMemory: DBData | null = null;

export function loadDatabase(): DBData {
  if (!dbMemory) {
    ensureDirectoryExists(DB_DIR);
    if (fs.existsSync(DB_FILE)) {
      try {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        dbMemory = JSON.parse(raw);
      } catch (err) {
        console.error('Error reading database file:', err);
      }
    }

    if (!dbMemory && fs.existsSync(ROOT_DB_FILE)) {
      try {
        const raw = fs.readFileSync(ROOT_DB_FILE, 'utf-8');
        dbMemory = JSON.parse(raw);
      } catch (err) {
        console.error('Error reading root database file:', err);
      }
    }

    if (!dbMemory) {
      dbMemory = getInitialData();
    }

    // Sanitize in-memory database to strip any legacy mock data
    if (dbMemory) {
      dbMemory.sinalizacoes = (dbMemory.sinalizacoes || []).filter(
        (s) => s.operador !== 'Ana Oliveira' && s.operador !== 'Bruno Souza' && s.supervisor !== 'Carlos Silva'
      );
      dbMemory.supervisores = (dbMemory.supervisores || []).filter(
        (s) => s.nome !== 'Carlos Silva' && s.nome !== 'Mariana Santos' && s.nome !== 'Roberto Lima'
      );
      dbMemory.operadores = (dbMemory.operadores || []).filter(
        (o) => o.nome !== 'Ana Oliveira' && o.nome !== 'Bruno Souza' && o.nome !== 'Carla Pereira'
      );
      dbMemory.produtos = (dbMemory.produtos || []).filter(
        (p) => p.nome !== 'Atendimento Sac' && p.nome !== 'Cartões de Crédito'
      );
      dbMemory.motivos = (dbMemory.motivos || []).filter(
        (m) => m.descricao !== 'Uso de celular' && m.descricao !== 'Sem pausa' && m.descricao !== 'Atraso'
      );
      dbMemory.usuarios = (dbMemory.usuarios || []).filter(
        (u) => u.login !== 'plan' && u.login !== 'oper'
      );
    }

    saveDatabase();
  }
  return dbMemory!;
}

export function saveDatabase() {
  try {
    ensureDirectoryExists(DB_DIR);
    if (dbMemory) {
      fs.writeFileSync(DB_FILE, JSON.stringify(dbMemory, null, 2), 'utf-8');
    }
  } catch (err) {
    console.warn('Could not save database file to disk (retaining in-memory state):', err);
  }
}

// Helper query wrappers for full relational CRUD
export const db = {
  getUsuarios: async (): Promise<Usuario[]> => {
    if (isNeonEnabled) {
      try {
        const list = await neonDb.getUsuarios();
        if (list) return list;
      } catch (err) {
        console.warn('[Neon] getUsuarios failed, falling back to local database:', err);
      }
    }
    return loadDatabase().usuarios;
  },
  getUsuarioByLogin: async (login: string): Promise<Usuario | undefined> => {
    if (!login) return undefined;
    if (isNeonEnabled) {
      try {
        const u = await neonDb.getUsuarioByLogin(login);
        if (u) return u;
      } catch (err) {
        console.warn('[Neon] getUsuarioByLogin failed, falling back to local database:', err);
      }
    }
    const store = loadDatabase();
    return (store.usuarios || []).find(
      (u) => u && u.login && u.login.toLowerCase() === String(login).toLowerCase()
    );
  },
  getUsuarioById: async (id: number): Promise<Usuario | undefined> => {
    if (isNeonEnabled) {
      try {
        const u = await neonDb.getUsuarioById(id);
        if (u) return u;
      } catch (err) {
        console.warn('[Neon] getUsuarioById failed, falling back to local database:', err);
      }
    }
    return loadDatabase().usuarios.find((u) => u.id === id);
  },
  addUsuario: async (data: Omit<Usuario, 'id'>): Promise<Usuario> => {
    if (isNeonEnabled) {
      try {
        return await neonDb.addUsuario(data);
      } catch (err) {
        console.warn('[Neon] addUsuario failed, falling back to local database:', err);
      }
    }
    const dataStore = loadDatabase();
    const id = dataStore.nextIds.usuarios++;
    const newUser: Usuario = { id, ...data };
    dataStore.usuarios.push(newUser);
    saveDatabase();
    return newUser;
  },
  updateUsuario: async (id: number, data: Partial<Usuario>): Promise<Usuario | null> => {
    if (isNeonEnabled) {
      try {
        return await neonDb.updateUsuario(id, data);
      } catch (err) {
        console.warn('[Neon] updateUsuario failed, falling back to local database:', err);
      }
    }
    const dataStore = loadDatabase();
    const idx = dataStore.usuarios.findIndex((u) => u.id === id);
    if (idx !== -1) {
      dataStore.usuarios[idx] = { ...dataStore.usuarios[idx], ...data };
      saveDatabase();
      return dataStore.usuarios[idx];
    }
    return null;
  },
  deleteUsuario: async (id: number): Promise<void> => {
    if (isNeonEnabled) {
      try {
        return await neonDb.deleteUsuario(id);
      } catch (err) {
        console.warn('[Neon] deleteUsuario failed, falling back to local database:', err);
      }
    }
    const dataStore = loadDatabase();
    dataStore.usuarios = dataStore.usuarios.filter((u) => u.id !== id);
    saveDatabase();
  },

  getSupervisores: async (): Promise<Supervisor[]> => {
    if (isNeonEnabled) {
      try {
        return await neonDb.getSupervisores();
      } catch (err) {
        console.warn('[Neon] getSupervisores failed, falling back to local database:', err);
      }
    }
    return loadDatabase().supervisores;
  },
  addSupervisor: async (data: Omit<Supervisor, 'id'>): Promise<Supervisor> => {
    if (isNeonEnabled) {
      try {
        return await neonDb.addSupervisor(data);
      } catch (err) {
        console.warn('[Neon] addSupervisor failed, falling back to local database:', err);
      }
    }
    const dataStore = loadDatabase();
    const id = dataStore.nextIds.supervisores++;
    const newSup: Supervisor = { id, ...data };
    dataStore.supervisores.push(newSup);
    saveDatabase();
    return newSup;
  },
  updateSupervisor: async (id: number, data: Partial<Supervisor>): Promise<Supervisor | null> => {
    if (isNeonEnabled) {
      try {
        return await neonDb.updateSupervisor(id, data);
      } catch (err) {
        console.warn('[Neon] updateSupervisor failed, falling back to local database:', err);
      }
    }
    const dataStore = loadDatabase();
    const idx = dataStore.supervisores.findIndex((s) => s.id === id);
    if (idx !== -1) {
      dataStore.supervisores[idx] = { ...dataStore.supervisores[idx], ...data };
      saveDatabase();
      return dataStore.supervisores[idx];
    }
    return null;
  },
  deleteSupervisor: async (id: number): Promise<void> => {
    if (isNeonEnabled) {
      try {
        return await neonDb.deleteSupervisor(id);
      } catch (err) {
        console.warn('[Neon] deleteSupervisor failed, falling back to local database:', err);
      }
    }
    const dataStore = loadDatabase();
    dataStore.supervisores = dataStore.supervisores.filter((s) => s.id !== id);
    saveDatabase();
  },

  getOperadores: async (): Promise<Operador[]> => {
    if (isNeonEnabled) {
      try {
        return await neonDb.getOperadores();
      } catch (err) {
        console.warn('[Neon] getOperadores failed, falling back to local database:', err);
      }
    }
    return loadDatabase().operadores;
  },
  addOperador: async (data: Omit<Operador, 'id'>): Promise<Operador> => {
    if (isNeonEnabled) {
      try {
        return await neonDb.addOperador(data);
      } catch (err) {
        console.warn('[Neon] addOperador failed, falling back to local database:', err);
      }
    }
    const dataStore = loadDatabase();
    const id = dataStore.nextIds.operadores++;
    const newOp: Operador = { id, ...data };
    dataStore.operadores.push(newOp);
    saveDatabase();
    return newOp;
  },

  getProdutos: async (): Promise<Produto[]> => {
    if (isNeonEnabled) {
      try {
        return await neonDb.getProdutos();
      } catch (err) {
        console.warn('[Neon] getProdutos failed, falling back to local database:', err);
      }
    }
    return loadDatabase().produtos;
  },
  addProduto: async (nome: string): Promise<Produto> => {
    if (isNeonEnabled) {
      try {
        return await neonDb.addProduto(nome);
      } catch (err) {
        console.warn('[Neon] addProduto failed, falling back to local database:', err);
      }
    }
    const dataStore = loadDatabase();
    if (!dataStore.produtos.some((p) => p.nome.toLowerCase() === nome.toLowerCase())) {
      const id = dataStore.nextIds.produtos++;
      const newProd: Produto = { id, nome };
      dataStore.produtos.push(newProd);
      saveDatabase();
      return newProd;
    }
    return dataStore.produtos.find((p) => p.nome.toLowerCase() === nome.toLowerCase())!;
  },
  updateProduto: async (id: number, nome: string): Promise<Produto | null> => {
    if (isNeonEnabled) {
      try {
        return await neonDb.updateProduto(id, nome);
      } catch (err) {
        console.warn('[Neon] updateProduto failed, falling back to local database:', err);
      }
    }
    const dataStore = loadDatabase();
    const idx = dataStore.produtos.findIndex((p) => p.id === id);
    if (idx !== -1) {
      dataStore.produtos[idx].nome = nome;
      saveDatabase();
      return dataStore.produtos[idx];
    }
    return null;
  },
  deleteProduto: async (id: number): Promise<void> => {
    if (isNeonEnabled) {
      try {
        return await neonDb.deleteProduto(id);
      } catch (err) {
        console.warn('[Neon] deleteProduto failed, falling back to local database:', err);
      }
    }
    const dataStore = loadDatabase();
    dataStore.produtos = dataStore.produtos.filter((p) => p.id !== id);
    saveDatabase();
  },

  getMotivos: async (): Promise<Motivo[]> => {
    if (isNeonEnabled) {
      try {
        return await neonDb.getMotivos();
      } catch (err) {
        console.warn('[Neon] getMotivos failed, falling back to local database:', err);
      }
    }
    return loadDatabase().motivos;
  },
  addMotivo: async (descricao: string): Promise<Motivo> => {
    if (isNeonEnabled) {
      try {
        return await neonDb.addMotivo(descricao);
      } catch (err) {
        console.warn('[Neon] addMotivo failed, falling back to local database:', err);
      }
    }
    const dataStore = loadDatabase();
    const id = dataStore.nextIds.motivos++;
    const newMotivo: Motivo = { id, descricao };
    dataStore.motivos.push(newMotivo);
    saveDatabase();
    return newMotivo;
  },
  updateMotivo: async (id: number, descricao: string): Promise<Motivo | null> => {
    if (isNeonEnabled) {
      try {
        return await neonDb.updateMotivo(id, descricao);
      } catch (err) {
        console.warn('[Neon] updateMotivo failed, falling back to local database:', err);
      }
    }
    const dataStore = loadDatabase();
    const idx = dataStore.motivos.findIndex((m) => m.id === id);
    if (idx !== -1) {
      dataStore.motivos[idx].descricao = descricao;
      saveDatabase();
      return dataStore.motivos[idx];
    }
    return null;
  },
  deleteMotivo: async (id: number): Promise<void> => {
    if (isNeonEnabled) {
      try {
        return await neonDb.deleteMotivo(id);
      } catch (err) {
        console.warn('[Neon] deleteMotivo failed, falling back to local database:', err);
      }
    }
    const dataStore = loadDatabase();
    dataStore.motivos = dataStore.motivos.filter((m) => m.id !== id);
    saveDatabase();
  },

  getSinalizacoes: async (): Promise<Sinalizacao[]> => {
    if (isNeonEnabled) {
      try {
        return await neonDb.getSinalizacoes();
      } catch (err) {
        console.warn('[Neon] getSinalizacoes failed, falling back to local database:', err);
      }
    }
    return loadDatabase().sinalizacoes;
  },
  addSinalizacao: async (data: Omit<Sinalizacao, 'id'>): Promise<Sinalizacao> => {
    if (isNeonEnabled) {
      try {
        return await neonDb.addSinalizacao(data);
      } catch (err) {
        console.warn('[Neon] addSinalizacao failed, falling back to local database:', err);
      }
    }
    const dataStore = loadDatabase();
    const id = dataStore.nextIds.sinalizacoes++;
    const newSinalizacao: Sinalizacao = { id, ...data };
    dataStore.sinalizacoes.unshift(newSinalizacao); // latest first
    saveDatabase();
    return newSinalizacao;
  },
  deleteSinalizacao: async (id: number): Promise<void> => {
    if (isNeonEnabled) {
      try {
        return await neonDb.deleteSinalizacao(id);
      } catch (err) {
        console.warn('[Neon] deleteSinalizacao failed, falling back to local database:', err);
      }
    }
    const dataStore = loadDatabase();
    dataStore.sinalizacoes = dataStore.sinalizacoes.filter((s) => s.id !== id);
    saveDatabase();
  },

  getConfigApi: async (): Promise<ConfiguracaoApi> => {
    if (isNeonEnabled) {
      try {
        return await neonDb.getConfigApi();
      } catch (err) {
        console.warn('[Neon] getConfigApi failed, falling back to local database:', err);
      }
    }
    return loadDatabase().configuracao_api;
  },
  updateConfigApi: async (data: Partial<ConfiguracaoApi>): Promise<ConfiguracaoApi> => {
    if (isNeonEnabled) {
      try {
        return await neonDb.updateConfigApi(data);
      } catch (err) {
        console.warn('[Neon] updateConfigApi failed, falling back to local database:', err);
      }
    }
    const dataStore = loadDatabase();
    dataStore.configuracao_api = { ...dataStore.configuracao_api, ...data };
    saveDatabase();
    return dataStore.configuracao_api;
  }
};
