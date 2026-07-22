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
      },
      {
        id: 2,
        nome: 'Analista de Planejamento',
        login: 'plan',
        senha: defaultPasswordHash,
        perfil: 'Planejamento',
        status: 'Ativo',
        produto: 'Atendimento Sac',
        supervisor: 'Carlos Silva'
      },
      {
        id: 3,
        nome: 'Operador Supervisor',
        login: 'oper',
        senha: defaultPasswordHash,
        perfil: 'Operação',
        status: 'Ativo',
        produto: 'Suporte Técnico',
        supervisor: 'Fernanda Costa'
      }
    ],
    supervisores: [
      { id: 1, nome: 'Carlos Silva', produto: 'Atendimento Sac, Ouvidoria', status: 'Ativo' },
      { id: 2, nome: 'Mariana Santos', produto: 'Cartões de Crédito, Suporte Técnico', status: 'Ativo' },
      { id: 3, nome: 'Roberto Lima', produto: 'Vendas B2B', status: 'Ativo' },
      { id: 4, nome: 'Fernanda Costa', produto: 'Suporte Técnico, Retenção', status: 'Ativo' },
      { id: 5, nome: 'Juliana Mendes', produto: 'Retenção', status: 'Ativo' }
    ],
    produtos: [
      { id: 1, nome: 'Atendimento Sac' },
      { id: 2, nome: 'Cartões de Crédito' },
      { id: 3, nome: 'Vendas B2B' },
      { id: 4, nome: 'Suporte Técnico' },
      { id: 5, nome: 'Retenção' },
      { id: 6, nome: 'Ouvidoria' }
    ],
    operadores: [
      { id: 1, nome: 'Ana Oliveira', produto: 'Atendimento Sac', supervisor: 'Carlos Silva', situacao: 'Ativo' },
      { id: 2, nome: 'Bruno Souza', produto: 'Cartões de Crédito', supervisor: 'Mariana Santos', situacao: 'Ativo' },
      { id: 3, nome: 'Carla Pereira', produto: 'Vendas B2B', supervisor: 'Roberto Lima', situacao: 'Ativo' },
      { id: 4, nome: 'Diego Ferreira', produto: 'Suporte Técnico', supervisor: 'Fernanda Costa', situacao: 'Ativo' },
      { id: 5, nome: 'Elena Rostova', produto: 'Retenção', supervisor: 'Juliana Mendes', situacao: 'Ativo' },
      { id: 6, nome: 'Fábio Junior', produto: 'Atendimento Sac', supervisor: 'Carlos Silva', situacao: 'Ativo' },
      { id: 7, nome: 'Gisele Bund', produto: 'Cartões de Crédito', supervisor: 'Mariana Santos', situacao: 'Ativo' },
      { id: 8, nome: 'Heitor Villa', produto: 'Vendas B2B', supervisor: 'Roberto Lima', situacao: 'Ativo' },
      { id: 9, nome: 'Igor Rodrigues', produto: 'Ouvidoria', supervisor: 'Carlos Silva', situacao: 'Ativo' },
      { id: 10, nome: 'João Pedro', produto: 'Suporte Técnico', supervisor: 'Fernanda Costa', situacao: 'Ativo' }
    ],
    motivos: [
      { id: 1, descricao: 'Uso de celular' },
      { id: 2, descricao: 'Sem pausa' },
      { id: 3, descricao: 'Atraso' },
      { id: 4, descricao: 'Conduta inadequada' },
      { id: 5, descricao: 'Ausência do posto' },
      { id: 6, descricao: 'Descumprimento de procedimento' },
      { id: 7, descricao: 'Outros' }
    ],
    sinalizacoes: [
      {
        id: 1,
        data: '2026-07-20',
        hora: '09:15:00',
        operador: 'Ana Oliveira',
        supervisor: 'Carlos Silva',
        produto: 'Atendimento Sac',
        motivo: 'Atraso',
        observacao: 'Atraso de 25 minutos na entrada do turno matutino sem justificativa prévia.',
        nome_evidencia: 'ponto_atraso.png',
        caminho_evidencia: '',
        usuario_responsavel: 'Administrador Geral',
        data_cadastro: '2026-07-20T09:15:00.000Z'
      },
      {
        id: 2,
        data: '2026-07-20',
        hora: '11:40:00',
        operador: 'Bruno Souza',
        supervisor: 'Mariana Santos',
        produto: 'Cartões de Crédito',
        motivo: 'Uso de celular',
        observacao: 'Uso reiterado de aparelho celular pessoal na baia de atendimento durante chamada.',
        nome_evidencia: '',
        caminho_evidencia: '',
        usuario_responsavel: 'Analista de Planejamento',
        data_cadastro: '2026-07-20T11:40:00.000Z'
      },
      {
        id: 3,
        data: '2026-07-21',
        hora: '14:10:00',
        operador: 'Ana Oliveira',
        supervisor: 'Carlos Silva',
        produto: 'Atendimento Sac',
        motivo: 'Sem pausa',
        observacao: 'Não realizou a pausa regulamentar NR17 no horário pré-agendado.',
        nome_evidencia: '',
        caminho_evidencia: '',
        usuario_responsavel: 'Administrador Geral',
        data_cadastro: '2026-07-21T14:10:00.000Z'
      },
      {
        id: 4,
        data: '2026-07-21',
        hora: '16:05:00',
        operador: 'Diego Ferreira',
        supervisor: 'Fernanda Costa',
        produto: 'Suporte Técnico',
        motivo: 'Ausência do posto',
        observacao: 'Ausência não autorizada da posição de atendimento por mais de 30 minutos.',
        nome_evidencia: '',
        caminho_evidencia: '',
        usuario_responsavel: 'Analista de Planejamento',
        data_cadastro: '2026-07-21T16:05:00.000Z'
      },
      {
        id: 5,
        data: '2026-07-22',
        hora: '08:30:00',
        operador: 'Carla Pereira',
        supervisor: 'Roberto Lima',
        produto: 'Vendas B2B',
        motivo: 'Conduta inadequada',
        observacao: 'Tom alterado durante atendimento com cliente interno e postura inadequada com a equipe.',
        nome_evidencia: '',
        caminho_evidencia: '',
        usuario_responsavel: 'Administrador Geral',
        data_cadastro: '2026-07-22T08:30:00.000Z'
      },
      {
        id: 6,
        data: '2026-07-22',
        hora: '10:15:00',
        operador: 'Elena Rostova',
        supervisor: 'Juliana Mendes',
        produto: 'Retenção',
        motivo: 'Descumprimento de procedimento',
        observacao: 'Encerramento indevido da chamada sem registrar a tabulação correta no CRM.',
        nome_evidencia: '',
        caminho_evidencia: '',
        usuario_responsavel: 'Analista de Planejamento',
        data_cadastro: '2026-07-22T10:15:00.000Z'
      }
    ],
    configuracao_api: {
      id: 1,
      url_api: 'https://api.empresa.com.br/v1/rh-sincronizacao',
      token: 'bearer_token_corp_8839210293',
      usuario: 'api_sinalizacoes_user',
      senha: '••••••••••••',
      ultima_sincronizacao: '2026-07-22 08:00:00'
    },
    nextIds: {
      usuarios: 4,
      supervisores: 6,
      operadores: 11,
      produtos: 7,
      motivos: 8,
      sinalizacoes: 7
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
  getUsuarios: () => loadDatabase().usuarios,
  getUsuarioByLogin: (login: string) =>
    loadDatabase().usuarios.find((u) => u.login.toLowerCase() === login.toLowerCase()),
  getUsuarioById: (id: number) => loadDatabase().usuarios.find((u) => u.id === id),
  addUsuario: (data: Omit<Usuario, 'id'>) => {
    const dataStore = loadDatabase();
    const id = dataStore.nextIds.usuarios++;
    const newUser: Usuario = { id, ...data };
    dataStore.usuarios.push(newUser);
    saveDatabase();
    return newUser;
  },
  updateUsuario: (id: number, data: Partial<Usuario>) => {
    const dataStore = loadDatabase();
    const idx = dataStore.usuarios.findIndex((u) => u.id === id);
    if (idx !== -1) {
      dataStore.usuarios[idx] = { ...dataStore.usuarios[idx], ...data };
      saveDatabase();
      return dataStore.usuarios[idx];
    }
    return null;
  },
  deleteUsuario: (id: number) => {
    const dataStore = loadDatabase();
    dataStore.usuarios = dataStore.usuarios.filter((u) => u.id !== id);
    saveDatabase();
  },

  getSupervisores: () => loadDatabase().supervisores,
  addSupervisor: (data: Omit<Supervisor, 'id'>) => {
    const dataStore = loadDatabase();
    const id = dataStore.nextIds.supervisores++;
    const newSup: Supervisor = { id, ...data };
    dataStore.supervisores.push(newSup);
    saveDatabase();
    return newSup;
  },
  updateSupervisor: (id: number, data: Partial<Supervisor>) => {
    const dataStore = loadDatabase();
    const idx = dataStore.supervisores.findIndex((s) => s.id === id);
    if (idx !== -1) {
      dataStore.supervisores[idx] = { ...dataStore.supervisores[idx], ...data };
      saveDatabase();
      return dataStore.supervisores[idx];
    }
    return null;
  },
  deleteSupervisor: (id: number) => {
    const dataStore = loadDatabase();
    dataStore.supervisores = dataStore.supervisores.filter((s) => s.id !== id);
    saveDatabase();
  },

  getOperadores: () => loadDatabase().operadores,
  addOperador: (data: Omit<Operador, 'id'>) => {
    const dataStore = loadDatabase();
    const id = dataStore.nextIds.operadores++;
    const newOp: Operador = { id, ...data };
    dataStore.operadores.push(newOp);
    saveDatabase();
    return newOp;
  },

  getProdutos: () => loadDatabase().produtos,
  addProduto: (nome: string) => {
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
  updateProduto: (id: number, nome: string) => {
    const dataStore = loadDatabase();
    const idx = dataStore.produtos.findIndex((p) => p.id === id);
    if (idx !== -1) {
      dataStore.produtos[idx].nome = nome;
      saveDatabase();
      return dataStore.produtos[idx];
    }
    return null;
  },
  deleteProduto: (id: number) => {
    const dataStore = loadDatabase();
    dataStore.produtos = dataStore.produtos.filter((p) => p.id !== id);
    saveDatabase();
  },

  getMotivos: () => loadDatabase().motivos,
  addMotivo: (descricao: string) => {
    const dataStore = loadDatabase();
    const id = dataStore.nextIds.motivos++;
    const newMotivo: Motivo = { id, descricao };
    dataStore.motivos.push(newMotivo);
    saveDatabase();
    return newMotivo;
  },
  updateMotivo: (id: number, descricao: string) => {
    const dataStore = loadDatabase();
    const idx = dataStore.motivos.findIndex((m) => m.id === id);
    if (idx !== -1) {
      dataStore.motivos[idx].descricao = descricao;
      saveDatabase();
      return dataStore.motivos[idx];
    }
    return null;
  },
  deleteMotivo: (id: number) => {
    const dataStore = loadDatabase();
    dataStore.motivos = dataStore.motivos.filter((m) => m.id !== id);
    saveDatabase();
  },

  getSinalizacoes: () => loadDatabase().sinalizacoes,
  addSinalizacao: (data: Omit<Sinalizacao, 'id'>) => {
    const dataStore = loadDatabase();
    const id = dataStore.nextIds.sinalizacoes++;
    const newSinalizacao: Sinalizacao = { id, ...data };
    dataStore.sinalizacoes.unshift(newSinalizacao); // latest first
    saveDatabase();
    return newSinalizacao;
  },
  deleteSinalizacao: (id: number) => {
    const dataStore = loadDatabase();
    dataStore.sinalizacoes = dataStore.sinalizacoes.filter((s) => s.id !== id);
    saveDatabase();
  },

  getConfigApi: () => loadDatabase().configuracao_api,
  updateConfigApi: (data: Partial<ConfiguracaoApi>) => {
    const dataStore = loadDatabase();
    dataStore.configuracao_api = { ...dataStore.configuracao_api, ...data };
    saveDatabase();
    return dataStore.configuracao_api;
  }
};
