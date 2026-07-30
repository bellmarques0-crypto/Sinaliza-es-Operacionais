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
  ConfiguracaoApi,
  DiarioBordoOcorrencia,
  DiarioBordoHistorico
} from '../types.js';
import { db as postgresDb } from './neon.js';
import { getBrasiliaFullString } from '../utils/dateUtils.js';


interface DBData {
  usuarios: Usuario[];
  supervisores: Supervisor[];
  operadores: Operador[];
  produtos: Produto[];
  motivos: Motivo[];
  sinalizacoes: Sinalizacao[];
  diario_bordo: DiarioBordoOcorrencia[];
  diario_bordo_historico: DiarioBordoHistorico[];
  configuracao_api: ConfiguracaoApi;
  nextIds: {
    usuarios: number;
    supervisores: number;
    operadores: number;
    produtos: number;
    motivos: number;
    sinalizacoes: number;
    diario_bordo: number;
    diario_bordo_historico: number;
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
    diario_bordo: [],
    diario_bordo_historico: [],
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
      sinalizacoes: 1,
      diario_bordo: 1,
      diario_bordo_historico: 1
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
      if (!dbMemory.diario_bordo) dbMemory.diario_bordo = [];
      if (!dbMemory.diario_bordo_historico) dbMemory.diario_bordo_historico = [];
      if (!dbMemory.nextIds) {
        dbMemory.nextIds = {
          usuarios: 1,
          supervisores: 1,
          operadores: 1,
          produtos: 1,
          motivos: 1,
          sinalizacoes: 1,
          diario_bordo: 1,
          diario_bordo_historico: 1
        };
      }
      if (!dbMemory.nextIds.diario_bordo) {
        dbMemory.nextIds.diario_bordo = dbMemory.diario_bordo.length ? Math.max(...dbMemory.diario_bordo.map(d => d.id)) + 1 : 1;
      }
      if (!dbMemory.nextIds.diario_bordo_historico) {
        dbMemory.nextIds.diario_bordo_historico = dbMemory.diario_bordo_historico.length ? Math.max(...dbMemory.diario_bordo_historico.map(h => h.id)) + 1 : 1;
      }
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
    return await postgresDb.getUsuarios();
  },
  getUsuarioByLogin: async (login: string): Promise<Usuario | undefined> => {
    return await postgresDb.getUsuarioByLogin(login);
  },
  getUsuarioById: async (id: number): Promise<Usuario | undefined> => {
  return await postgresDb.getUsuarioById(id);
  },

  addUsuario: async (data: Omit<Usuario, 'id'>): Promise<Usuario> => {
    return await postgresDb.addUsuario(data);
  },

  updateUsuario: async (
    id: number,
    data: Partial<Usuario>
  ): Promise<Usuario | null> => {
    return await postgresDb.updateUsuario(id, data);
  },

  deleteUsuario: async (id: number): Promise<void> => {
    await postgresDb.deleteUsuario(id);
  },

  getSupervisores: async (): Promise<Supervisor[]> => {
    return await postgresDb.getSupervisores();
  },

  addSupervisor: async (
    data: Omit<Supervisor, 'id'>
  ): Promise<Supervisor> => {
    return await postgresDb.addSupervisor(data);
  },
  updateSupervisor: async (
  id: number,
  data: Partial<Supervisor>
): Promise<Supervisor | null> => {
  return await postgresDb.updateSupervisor(id, data);
},

  deleteSupervisor: async (id: number): Promise<void> => {
    await postgresDb.deleteSupervisor(id);
  },

  getOperadores: async (): Promise<Operador[]> => {
    return await postgresDb.getOperadores();
  },

  addOperador: async (
    data: Omit<Operador, 'id'>
  ): Promise<Operador> => {
    return await postgresDb.addOperador(data);
  },

  getProdutos: async (): Promise<Produto[]> => {
  return await db.getProdutos();
  },

  addProduto: async (nome: string): Promise<Produto> => {
    return await db.addProduto(nome);
  },
  updateProduto: async (id: number, nome: string): Promise<Produto |null> => {
      return await db.updateProduto(id, nome);
  },

  deleteProduto: async (id: number): Promise<void> => {
      await db.deleteProduto(id);
  },

  getMotivos: async (): Promise<Motivo[]> => {
      return await db.getMotivos();
  },

  addMotivo: async (descricao: string): Promise<Motivo> => {
      return await db.addMotivo(descricao);
  },

  updateMotivo: async (id: number, descricao: string): Promise<Motivo | null> => {
      return await db.updateMotivo(id, descricao);
  },

  deleteMotivo: async (id: number): Promise<void> => {
      await db.deleteMotivo(id);
  },

  getSinalizacoes: async (): Promise<Sinalizacao[]> => {
      return await db.getSinalizacoes();
  },

  addSinalizacao: async (data: Omit<Sinalizacao, 'id'>): Promise<Sinalizacao> => {
      return await db.addSinalizacao(data);
  },

  deleteSinalizacao: async (id: number): Promise<void> => {
      await db.deleteSinalizacao(id);
  },

  updateSinalizacao: async (
      id: number,
      data: Partial<Sinalizacao>
  ): Promise<Sinalizacao | null> => {
      return await db.updateSinalizacao(id, data);
  },

  confirmarSinalizacao: async (
      id: number,
      usuario_confirmacao: string
  ): Promise<Sinalizacao | null> => {
      return await db.confirmarSinalizacao(id, usuario_confirmacao);
  },

  getConfigApi: async (): Promise<ConfiguracaoApi> => {
      return await db.getConfigApi();
  },

  updateConfigApi: async (
      data: Partial<ConfiguracaoApi>
  ): Promise<ConfiguracaoApi> => {
      return await db.updateConfigApi(data);
  },

  // DIÁRIO DE BORDO METHODS

  getDiarioBordo: async (): Promise<DiarioBordoOcorrencia[]> => {
      return await db.getDiarioBordo();
  },

  getDiarioBordoById: async (
      id: number
  ): Promise<DiarioBordoOcorrencia | null> => {
      return await db.getDiarioBordoById(id);
  },

  addDiarioBordo: async (
      data: Omit<DiarioBordoOcorrencia, 'id'>
  ): Promise<DiarioBordoOcorrencia> => {
      return await db.addDiarioBordo(data);
  },

  // DIÁRIO DE BORDO METHODS

  getDiarioBordo: async (): Promise<DiarioBordoOcorrencia[]> => {
  return await db.getDiarioBordo();
  },

  getDiarioBordoById: async (
    id: number
  ): Promise<DiarioBordoOcorrencia | null> => {
    return await db.getDiarioBordoById(id);
  },

  addDiarioBordo: async (
    data: Omit<DiarioBordoOcorrencia, 'id'>
  ): Promise<DiarioBordoOcorrencia> => {
    return await db.addDiarioBordo(data);
  },

  updateDiarioBordo: async (
    id: number,
    data: Partial<DiarioBordoOcorrencia>,
    usuarioAtualizacao: string
  ): Promise<DiarioBordoOcorrencia | null> => {
    return await db.updateDiarioBordo(id, data, usuarioAtualizacao);
  },

  deleteDiarioBordo: async (id: number): Promise<void> => {
    return await db.deleteDiarioBordo(id);
  },

  getDiarioBordoHistorico: async (
    diario_bordo_id: number
  ): Promise<DiarioBordoHistorico[]> => {
    return await db.getDiarioBordoHistorico(diario_bordo_id);
  },
};