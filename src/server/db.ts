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

  updateOperador: async (
    id: number,
    data: Partial<Operador>
  ): Promise<Operador | null> => {
    return await postgresDb.updateOperador(id, data);
  },

  deleteOperador: async (id: number): Promise<void> => {
    await postgresDb.deleteOperador(id);
  },

  getProdutos: async (): Promise<Produto[]> => {
  return await postgresDb.getProdutos();
  },

  addProduto: async (nome: string): Promise<Produto> => {
    return await postgresDb.addProduto(nome);
  },
  updateProduto: async (id: number, nome: string): Promise<Produto |null> => {
      return await postgresDb.updateProduto(id, nome);
  },

  deleteProduto: async (id: number): Promise<void> => {
      await postgresDb.deleteProduto(id);
  },

  getMotivos: async (): Promise<Motivo[]> => {
      return await postgresDb.getMotivos();
  },

  addMotivo: async (descricao: string): Promise<Motivo> => {
      return await postgresDb.addMotivo(descricao);
  },

  updateMotivo: async (id: number, descricao: string): Promise<Motivo | null> => {
      return await postgresDb.updateMotivo(id, descricao);
  },

  deleteMotivo: async (id: number): Promise<void> => {
      await postgresDb.deleteMotivo(id);
  },

  getSinalizacoes: async (): Promise<Sinalizacao[]> => {
      return await postgresDb.getSinalizacoes();
  },

  addSinalizacao: async (data: Omit<Sinalizacao, 'id'>): Promise<Sinalizacao> => {
      return await postgresDb.addSinalizacao(data);
  },

  deleteSinalizacao: async (id: number): Promise<void> => {
      await postgresDb.deleteSinalizacao(id);
  },

  updateSinalizacao: async (
      id: number,
      data: Partial<Sinalizacao>
  ): Promise<Sinalizacao | null> => {
      return await postgresDb.updateSinalizacao(id, data);
  },

  confirmarSinalizacao: async (
      id: number,
      usuario_confirmacao: string
  ): Promise<Sinalizacao | null> => {
      return await postgresDb.confirmarSinalizacao(id, usuario_confirmacao);
  },

  getConfigApi: async (): Promise<ConfiguracaoApi> => {
      return await postgresDb.getConfigApi();
  },

  updateConfigApi: async (
      data: Partial<ConfiguracaoApi>
  ): Promise<ConfiguracaoApi> => {
      return await postgresDb.updateConfigApi(data);
  },

  // DIÁRIO DE BORDO METHODS

  getDiarioBordo: async (): Promise<DiarioBordoOcorrencia[]> => {
      return await postgresDb.getDiarioBordo();
  },

  getDiarioBordoById: async (
      id: number
  ): Promise<DiarioBordoOcorrencia | null> => {
      return await postgresDb.getDiarioBordoById(id);
  },

  addDiarioBordo: async (
      data: Omit<DiarioBordoOcorrencia, 'id'>
  ): Promise<DiarioBordoOcorrencia> => {
      return await postgresDb.addDiarioBordo(data);
  },

  updateDiarioBordo: async (
    id: number,
    data: Partial<DiarioBordoOcorrencia>,
    usuarioAtualizacao: string
  ): Promise<DiarioBordoOcorrencia | null> => {
    return await postgresDb.updateDiarioBordo(id, data, usuarioAtualizacao);
  },

  deleteDiarioBordo: async (id: number): Promise<void> => {
    return await postgresDb.deleteDiarioBordo(id);
  },

  getDiarioBordoHistorico: async (
    diario_bordo_id: number
  ): Promise<DiarioBordoHistorico[]> => {
    return await postgresDb.getDiarioBordoHistorico(diario_bordo_id);
  },
};