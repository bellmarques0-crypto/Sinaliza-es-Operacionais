import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import type {
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

const dbPath = path.resolve(process.cwd(), 'data', 'db.json');

function readDb() {
  if (!fs.existsSync(dbPath)) {
    return { usuarios: [] as LocalUser[] };
  }

  const content = fs.readFileSync(dbPath, 'utf8');
  const parsed = JSON.parse(content);
  return {
    ...parsed,
    usuarios: (parsed.usuarios || []) as LocalUser[]
  };
}

function writeDb(data: any) {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
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

export function getLocalProdutos(): Produto[] {
  const data = readDb();
  return (data.produtos || []) as Produto[];
}

export function getLocalMotivos(): Motivo[] {
  const data = readDb();
  return (data.motivos || []) as Motivo[];
}

export function getLocalSinalizacoes(): Sinalizacao[] {
  const data = readDb();
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
