import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import type {
  Usuario,
  Supervisor,
  Operador,
  Produto,
  Motivo,
  Canal,
  Sinalizacao,
  ConfiguracaoApi,
  DiarioBordoOcorrencia,
  DiarioBordoHistorico
} from '../types.js';

export interface LocalUser {
  id: number;
  nome: string;
  login: string;
  senha: string;
  perfil: 'Administrador' | 'Planejamento' | 'Operação' | 'Supervisor';
  status: 'Ativo' | 'Inativo';
  produto?: string;
  supervisor?: string;
}

const isVercelEnv = !!process.env.VERCEL || !!process.env.VERCEL_ENV;
const dbDir = isVercelEnv ? '/tmp/data' : path.resolve(process.cwd(), 'data');
const dbPath = path.join(dbDir, 'db.json');

function readDb() {
  try {
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    if (!fs.existsSync(dbPath)) {
      const rootDbPath = path.resolve(process.cwd(), 'data', 'db.json');
      if (fs.existsSync(rootDbPath)) {
        fs.copyFileSync(rootDbPath, dbPath);
      } else {
        return { usuarios: [] as LocalUser[] };
      }
    }

    const content = fs.readFileSync(dbPath, 'utf8');
    const parsed = JSON.parse(content);
    return {
      ...parsed,
      usuarios: (parsed.usuarios || []) as LocalUser[]
    };
  } catch (err) {
    console.warn('[localDb] Erro ao ler db.json:', err);
    return { usuarios: [] as LocalUser[] };
  }
}

function writeDb(data: any) {
  try {
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('[localDb] Erro ao gravar db.json:', err);
  }
}

export function ensureSeedUser() {
  const data = readDb();
  const existing = data.usuarios.find((user: LocalUser) => user.login.toLowerCase() === 'admin');

  if (existing) {
    return existing;
  }

  const seedUser: LocalUser = {
    id: 1,
    nome: 'Administrador Geral',
    login: 'admin',
    senha: bcrypt.hashSync('123', 10),
    perfil: 'Administrador',
    status: 'Ativo',
    produto: 'Todos',
    supervisor: 'Todos'
  };

  data.usuarios = [seedUser, ...data.usuarios];
  writeDb({ ...data, usuarios: data.usuarios });
  return seedUser;
}

export function findUserByLogin(login: string) {
  const data = readDb();
  const normalized = login.trim().toLowerCase();
  return data.usuarios.find((user: LocalUser) => user.login.toLowerCase() === normalized);
}

export function getLocalUsuarioByLogin(login: string) {
  ensureSeedUser();
  return findUserByLogin(login);
}

export function getLocalUsuarioById(id: number) {
  ensureSeedUser();
  const data = readDb();
  return data.usuarios.find((user: LocalUser) => user.id === id);
}

export function getLocalUsuarios(): Usuario[] {
  ensureSeedUser();
  const data = readDb();
  return data.usuarios as Usuario[];
}

export function getLocalSupervisores(): Supervisor[] {
  const data = readDb();
  return (data.supervisores || []) as Supervisor[];
}

export function getLocalOperadores(): Operador[] {
  const data = readDb();
  return (data.operadores || []) as Operador[];
}

export function saveLocalOperador(op: Omit<Operador, 'id'>): Operador {
  const data = readDb();
  if (!data.operadores) data.operadores = [];
  const nextId = (data.operadores.length > 0 ? Math.max(...data.operadores.map((o: any) => o.id || 0)) : 0) + 1;
  const newOp: Operador = { id: nextId, ...op };
  data.operadores.push(newOp);
  writeDb(data);
  return newOp;
}

export function updateLocalOperador(id: number, updates: Partial<Operador>): Operador | null {
  const data = readDb();
  if (!data.operadores) data.operadores = [];
  const idx = data.operadores.findIndex((o: any) => o.id === id);
  if (idx < 0) return null;
  data.operadores[idx] = { ...data.operadores[idx], ...updates };
  writeDb(data);
  return data.operadores[idx] as Operador;
}

export function getLocalProdutos(): Produto[] {
  const data = readDb();
  return (data.produtos || []) as Produto[];
}

export function getLocalMotivos(): Motivo[] {
  const data = readDb();
  return (data.motivos || []) as Motivo[];
}

export function getLocalCanais(): Canal[] {
  const data = readDb();
  if (!data.canais) {
    data.canais = [
      { id: 1, nome: 'WhatsApp' },
      { id: 2, nome: 'Telefonia' },
      { id: 3, nome: 'Chat' },
      { id: 4, nome: 'E-mail' },
      { id: 5, nome: 'Presencial' },
      { id: 6, nome: 'Redes Sociais' }
    ];
    writeDb(data);
  }
  return (data.canais || []) as Canal[];
}

export function saveLocalCanal(nome: string): Canal {
  const data = readDb();
  if (!data.canais) data.canais = [];
  const existing = data.canais.find((c: any) => c.nome.toLowerCase() === nome.toLowerCase());
  if (existing) return existing;
  const nextId = (data.canais.length > 0 ? Math.max(...data.canais.map((c: any) => c.id || 0)) : 0) + 1;
  const newCanal: Canal = { id: nextId, nome };
  data.canais.push(newCanal);
  writeDb(data);
  return newCanal;
}

export function updateLocalCanal(id: number, nome: string): Canal | null {
  const data = readDb();
  if (!data.canais) data.canais = [];
  const idx = data.canais.findIndex((c: any) => c.id === id);
  if (idx < 0) return null;
  data.canais[idx] = { ...data.canais[idx], nome };
  writeDb(data);
  return data.canais[idx];
}

export function deleteLocalCanal(id: number): void {
  const data = readDb();
  if (!data.canais) return;
  data.canais = data.canais.filter((c: any) => c.id !== id);
  writeDb(data);
}

export function getLocalSinalizacoes(): Sinalizacao[] {
  const data = readDb();
  if (!data.sinalizacoes || data.sinalizacoes.length === 0) {
    const today = new Date().toISOString().split('T')[0];
    data.sinalizacoes = [
      {
        id: 1,
        data: today,
        hora: '09:30:00',
        operador: 'IZABELA SILVA BARCELAR',
        supervisor: 'VITORIA MARQUES CUNHA',
        produto: 'CARTAO DE CREDITO',
        motivo: 'Pausa estendida sem justificativa',
        gravidade: 'Médio',
        observacao: 'Operador ultrapassou tempo de pausa em 15 minutos.',
        nome_evidencia: '',
        caminho_evidencia: '',
        usuario_responsavel: 'Administrador Geral',
        data_cadastro: new Date().toISOString(),
        confirmado: false
      },
      {
        id: 2,
        data: today,
        hora: '10:15:00',
        operador: 'ANA CAROLINA FERNANDES MARTINS',
        supervisor: 'VITORIA MARQUES CUNHA',
        produto: 'CONSIGNADO',
        motivo: 'Uso de celular na operação',
        gravidade: 'Alto',
        observacao: 'Identificado em auditoria operacional.',
        nome_evidencia: '',
        caminho_evidencia: '',
        usuario_responsavel: 'Administrador Geral',
        data_cadastro: new Date().toISOString(),
        confirmado: true
      }
    ];
    writeDb(data);
  }
  return (data.sinalizacoes || []) as Sinalizacao[];
}

export function getLocalConfigApi(): ConfiguracaoApi {
  const data = readDb();
  return (data.configuracao_api || {
    id: 1,
    url_api: '',
    token: '',
    usuario: '',
    senha: '',
    ultima_sincronizacao: ''
  }) as ConfiguracaoApi;
}

export function saveLocalConfigApi(config: Partial<ConfiguracaoApi>) {
  const data = readDb();
  data.configuracao_api = {
    ...(data.configuracao_api || { id: 1, url_api: '', token: '', usuario: '', senha: '', ultima_sincronizacao: '' }),
    ...config
  };
  writeDb(data);
  return data.configuracao_api as ConfiguracaoApi;
}

export function saveLocalSinalizacao(sinalizacao: Sinalizacao) {
  const data = readDb();
  data.sinalizacoes = [sinalizacao, ...(data.sinalizacoes || [])];
  writeDb(data);
  return sinalizacao;
}

export function updateLocalSinalizacao(id: number, updates: Partial<Sinalizacao>) {
  const data = readDb();
  const index = (data.sinalizacoes || []).findIndex((item: Sinalizacao) => item.id === id);
  if (index < 0) return null;
  data.sinalizacoes[index] = { ...data.sinalizacoes[index], ...updates };
  writeDb(data);
  return data.sinalizacoes[index] as Sinalizacao;
}

export function getLocalAbsenteismo(dataFilter?: string) {
  const data = readDb();
  let list = (data.absenteismo || []) as any[];
  if (dataFilter) {
    list = list.filter((r) => r.data === dataFilter);
  }
  return list;
}

export function saveLocalAbsenteismoBatch(records: any[]) {
  const data = readDb();
  if (!data.absenteismo) data.absenteismo = [];

  records.forEach((rec) => {
    const idx = data.absenteismo.findIndex(
      (r: any) => r.data === rec.data && (r.operador || '').toLowerCase().trim() === (rec.operador || '').toLowerCase().trim()
    );
    if (idx >= 0) {
      data.absenteismo[idx] = { ...data.absenteismo[idx], ...rec };
    } else {
      const nextId = (data.absenteismo.length > 0 ? Math.max(...data.absenteismo.map((r: any) => r.id || 0)) : 0) + 1;
      data.absenteismo.push({ ...rec, id: nextId });
    }
  });

  writeDb(data);
  return data.absenteismo;
}

export const DEFAULT_PERFIS_CONFIG = [
  {
    nome: 'Administrador',
    descricao: 'Acesso total a todas as configurações, cadastros, relatórios e parâmetros do sistema.',
    permissoes: {
      sinalizacoes_ver: true,
      sinalizacoes_dashboard: true,
      sinalizacoes_criar: true,
      sinalizacoes_confirmar: true,
      sinalizacoes_editar: true,
      sinalizacoes_excluir: true,
      sinalizacoes_exportar: true,
      diario_bordo_ver: true,
      absenteismo_ver: true,
      diario_bordo_dashboard: true,
      diario_bordo_ver_internas: true,
      diario_bordo_ver_externas: true,
      diario_bordo_criar: true,
      diario_bordo_editar: true,
      diario_bordo_excluir: true,
      diario_bordo_exportar: true,
      diario_bordo_gerenciar: true,
      dashboard_ver: true,
      dashboard_todos: true,
      admin_acesso: true,
      admin_usuarios: true,
      admin_perfis: true,
      admin_api: true
    },
    is_custom: false
  },
  {
    nome: 'Planejamento',
    descricao: 'Acesso a relatórios globais, criação de sinalizações, diário de bordo e exportação.',
    permissoes: {
      sinalizacoes_ver: true,
      sinalizacoes_dashboard: true,
      sinalizacoes_criar: true,
      sinalizacoes_confirmar: true,
      sinalizacoes_editar: true,
      sinalizacoes_excluir: true,
      sinalizacoes_exportar: true,
      diario_bordo_ver: true,
      absenteismo_ver: true,
      diario_bordo_dashboard: true,
      diario_bordo_ver_internas: true,
      diario_bordo_ver_externas: true,
      diario_bordo_criar: true,
      diario_bordo_editar: true,
      diario_bordo_excluir: true,
      diario_bordo_exportar: true,
      diario_bordo_gerenciar: true,
      dashboard_ver: true,
      dashboard_todos: true,
      admin_acesso: false,
      admin_usuarios: false,
      admin_perfis: false,
      admin_api: false
    },
    is_custom: false
  },
  {
    nome: 'Supervisor',
    descricao: 'Gestão da equipe direta: tratar sinalizações, controlar ausências e visualizar dashboard filtrado.',
    permissoes: {
      sinalizacoes_ver: true,
      sinalizacoes_dashboard: true,
      sinalizacoes_criar: false,
      sinalizacoes_confirmar: true,
      sinalizacoes_editar: false,
      sinalizacoes_excluir: false,
      sinalizacoes_exportar: true,
      diario_bordo_ver: true,
      absenteismo_ver: true,
      diario_bordo_dashboard: true,
      diario_bordo_ver_internas: false,
      diario_bordo_ver_externas: true,
      diario_bordo_criar: true,
      diario_bordo_editar: true,
      diario_bordo_excluir: false,
      diario_bordo_exportar: true,
      diario_bordo_gerenciar: true,
      dashboard_ver: true,
      dashboard_todos: false,
      admin_acesso: false,
      admin_usuarios: false,
      admin_perfis: false,
      admin_api: false
    },
    is_custom: false
  },
  {
    nome: 'Operação',
    descricao: 'Acompanhamento e consulta de ocorrências e indicadores da sua célula/supervisão.',
    permissoes: {
      sinalizacoes_ver: true,
      sinalizacoes_dashboard: true,
      sinalizacoes_criar: false,
      sinalizacoes_confirmar: true,
      sinalizacoes_editar: false,
      sinalizacoes_excluir: false,
      sinalizacoes_exportar: false,
      diario_bordo_ver: true,
      absenteismo_ver: true,
      diario_bordo_dashboard: true,
      diario_bordo_ver_internas: false,
      diario_bordo_ver_externas: true,
      diario_bordo_criar: false,
      diario_bordo_editar: false,
      diario_bordo_excluir: false,
      diario_bordo_exportar: false,
      diario_bordo_gerenciar: false,
      dashboard_ver: true,
      dashboard_todos: false,
      admin_acesso: false,
      admin_usuarios: false,
      admin_perfis: false,
      admin_api: false
    },
    is_custom: false
  },
  {
    nome: 'Visualizador',
    descricao: 'Acesso restrito de leitura para sinalizações e diário de bordo.',
    permissoes: {
      sinalizacoes_ver: true,
      sinalizacoes_dashboard: false,
      sinalizacoes_criar: false,
      sinalizacoes_confirmar: false,
      sinalizacoes_editar: false,
      sinalizacoes_excluir: false,
      sinalizacoes_exportar: false,
      diario_bordo_ver: true,
      absenteismo_ver: false,
      diario_bordo_dashboard: false,
      diario_bordo_ver_internas: false,
      diario_bordo_ver_externas: true,
      diario_bordo_criar: false,
      diario_bordo_editar: false,
      diario_bordo_excluir: false,
      diario_bordo_exportar: false,
      diario_bordo_gerenciar: false,
      dashboard_ver: false,
      dashboard_todos: false,
      admin_acesso: false,
      admin_usuarios: false,
      admin_perfis: false,
      admin_api: false
    },
    is_custom: false
  }
];

export function getLocalPerfisConfig() {
  const data = readDb();
  if (!data.perfis || data.perfis.length === 0) {
    data.perfis = DEFAULT_PERFIS_CONFIG;
    writeDb(data);
  } else {
    // Ensure any default profile missing in stored data is added
    let updated = false;
    DEFAULT_PERFIS_CONFIG.forEach((def) => {
      const exists = data.perfis.some(
        (p: any) => p.nome.toLowerCase().trim() === def.nome.toLowerCase().trim()
      );
      if (!exists) {
        data.perfis.push(def);
        updated = true;
      }
    });
    if (updated) {
      writeDb(data);
    }
  }
  return data.perfis;
}

export function saveLocalPerfilConfig(perfil: any) {
  const data = readDb();
  if (!data.perfis) data.perfis = DEFAULT_PERFIS_CONFIG;
  const idx = data.perfis.findIndex((p: any) => p.nome.toLowerCase().trim() === perfil.nome.toLowerCase().trim());
  if (idx >= 0) {
    data.perfis[idx] = { ...data.perfis[idx], ...perfil };
  } else {
    data.perfis.push({ ...perfil, is_custom: true });
  }
  writeDb(data);
  return perfil;
}

export function deleteLocalPerfilConfig(nome: string) {
  const data = readDb();
  if (!data.perfis) return false;
  const initialLen = data.perfis.length;
  data.perfis = data.perfis.filter((p: any) => p.nome.toLowerCase().trim() !== nome.toLowerCase().trim());
  writeDb(data);
  return data.perfis.length < initialLen;
}
