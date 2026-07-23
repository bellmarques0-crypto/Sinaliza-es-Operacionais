import { createClient } from '@supabase/supabase-js';
import {
  Usuario,
  Supervisor,
  Operador,
  Produto,
  Motivo,
  Sinalizacao,
  ConfiguracaoApi
} from '../types';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase credentials not configured!');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Helper para converter dados do Supabase para os tipos
const toUsuario = (data: any): Usuario => ({
  id: data.id,
  nome: data.nome,
  login: data.login,
  senha: data.senha,
  perfil: data.perfil,
  status: data.status || 'Ativo',
  produto: data.produto || 'Todos',
  supervisor: data.supervisor || 'Todos'
});

const toSupervisor = (data: any): Supervisor => ({
  id: data.id,
  nome: data.nome,
  produto: data.produto || '',
  status: data.status || 'Ativo'
});

const toOperador = (data: any): Operador => ({
  id: data.id,
  nome: data.nome,
  produto: data.produto || '',
  supervisor: data.supervisor || '',
  situacao: data.situacao || 'Ativo'
});

const toProduto = (data: any): Produto => ({
  id: data.id,
  nome: data.nome
});

const toMotivo = (data: any): Motivo => ({
  id: data.id,
  descricao: data.descricao
});

const toSinalizacao = (data: any): Sinalizacao => ({
  id: data.id,
  data: data.data,
  hora: data.hora,
  operador: data.operador,
  supervisor: data.supervisor,
  produto: data.produto,
  motivo: data.motivo,
  observacao: data.observacao || '',
  nome_evidencia: data.nome_evidencia || '',
  caminho_evidencia: data.caminho_evidencia || '',
  usuario_responsavel: data.usuario_responsavel,
  data_cadastro: data.data_cadastro
});

export const db = {
  // USUÁRIOS
  getUsuarios: async (): Promise<Usuario[]> => {
    const { data, error } = await supabase
      .from('usuarios')
      .select('*');
    if (error) throw error;
    return data.map(toUsuario);
  },

  getUsuarioByLogin: async (login: string): Promise<Usuario | null> => {
  console.log('🔎 getUsuarioByLogin chamado com:', login);
  try {
    const { data, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('login', login); // 👈 removi o .single() para testar
      
    console.log('📦 Dados retornados:', data);
    console.log('❌ Erro:', error);
    
    if (error) {
      console.error('Erro no Supabase:', error);
      return null;
    }
    
    if (!data || data.length === 0) {
      console.log('❌ Nenhum usuário encontrado com login:', login);
      return null;
    }
    
    // Pega o primeiro resultado
    const userData = data[0];
    console.log('✅ Usuário encontrado:', userData);
    
    return toUsuario(userData);
  } catch (err) {
    console.error('❌ Exceção em getUsuarioByLogin:', err);
    return null;
  }
},

  getUsuarioById: async (id: number): Promise<Usuario | null> => {
    const { data, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('id', id)
      .single();
    if (error || !data) return null;
    return toUsuario(data);
  },

  addUsuario: async (data: Omit<Usuario, 'id'>): Promise<Usuario> => {
    const { data: result, error } = await supabase
      .from('usuarios')
      .insert([{
        nome: data.nome,
        login: data.login,
        senha: data.senha,
        perfil: data.perfil,
        status: data.status,
        produto: data.produto,
        supervisor: data.supervisor
      }])
      .select()
      .single();
    if (error) throw error;
    return toUsuario(result);
  },

  updateUsuario: async (id: number, data: Partial<Usuario>): Promise<Usuario | null> => {
    const { data: result, error } = await supabase
      .from('usuarios')
      .update(data)
      .eq('id', id)
      .select()
      .single();
    if (error || !result) return null;
    return toUsuario(result);
  },

  deleteUsuario: async (id: number): Promise<void> => {
    await supabase
      .from('usuarios')
      .delete()
      .eq('id', id);
  },

  // SUPERVISORES
  getSupervisores: async (): Promise<Supervisor[]> => {
    const { data, error } = await supabase
      .from('supervisores')
      .select('*');
    if (error) throw error;
    return data.map(toSupervisor);
  },

  addSupervisor: async (data: Omit<Supervisor, 'id'>): Promise<Supervisor> => {
    const { data: result, error } = await supabase
      .from('supervisores')
      .insert([data])
      .select()
      .single();
    if (error) throw error;
    return toSupervisor(result);
  },

  updateSupervisor: async (id: number, data: Partial<Supervisor>): Promise<Supervisor | null> => {
    const { data: result, error } = await supabase
      .from('supervisores')
      .update(data)
      .eq('id', id)
      .select()
      .single();
    if (error || !result) return null;
    return toSupervisor(result);
  },

  deleteSupervisor: async (id: number): Promise<void> => {
    await supabase
      .from('supervisores')
      .delete()
      .eq('id', id);
  },

  // OPERADORES
  getOperadores: async (): Promise<Operador[]> => {
    const { data, error } = await supabase
      .from('operadores')
      .select('*');
    if (error) throw error;
    return data.map(toOperador);
  },

  addOperador: async (data: Omit<Operador, 'id'>): Promise<Operador> => {
    const { data: result, error } = await supabase
      .from('operadores')
      .insert([data])
      .select()
      .single();
    if (error) throw error;
    return toOperador(result);
  },

  // PRODUTOS
  getProdutos: async (): Promise<Produto[]> => {
    const { data, error } = await supabase
      .from('produtos')
      .select('*');
    if (error) throw error;
    return data.map(toProduto);
  },

  addProduto: async (nome: string): Promise<Produto> => {
    const { data: result, error } = await supabase
      .from('produtos')
      .insert([{ nome }])
      .select()
      .single();
    if (error) throw error;
    return toProduto(result);
  },

  updateProduto: async (id: number, nome: string): Promise<Produto | null> => {
    const { data: result, error } = await supabase
      .from('produtos')
      .update({ nome })
      .eq('id', id)
      .select()
      .single();
    if (error || !result) return null;
    return toProduto(result);
  },

  deleteProduto: async (id: number): Promise<void> => {
    await supabase
      .from('produtos')
      .delete()
      .eq('id', id);
  },

  // MOTIVOS
  getMotivos: async (): Promise<Motivo[]> => {
    const { data, error } = await supabase
      .from('motivos')
      .select('*');
    if (error) throw error;
    return data.map(toMotivo);
  },

  addMotivo: async (descricao: string): Promise<Motivo> => {
    const { data: result, error } = await supabase
      .from('motivos')
      .insert([{ descricao }])
      .select()
      .single();
    if (error) throw error;
    return toMotivo(result);
  },

  updateMotivo: async (id: number, descricao: string): Promise<Motivo | null> => {
    const { data: result, error } = await supabase
      .from('motivos')
      .update({ descricao })
      .eq('id', id)
      .select()
      .single();
    if (error || !result) return null;
    return toMotivo(result);
  },

  deleteMotivo: async (id: number): Promise<void> => {
    await supabase
      .from('motivos')
      .delete()
      .eq('id', id);
  },

  // SINALIZAÇÕES
  getSinalizacoes: async (): Promise<Sinalizacao[]> => {
    const { data, error } = await supabase
      .from('sinalizacoes')
      .select('*')
      .order('id', { ascending: false });
    if (error) throw error;
    return data.map(toSinalizacao);
  },

  addSinalizacao: async (data: Omit<Sinalizacao, 'id'>): Promise<Sinalizacao> => {
    const { data: result, error } = await supabase
      .from('sinalizacoes')
      .insert([data])
      .select()
      .single();
    if (error) throw error;
    return toSinalizacao(result);
  },

  deleteSinalizacao: async (id: number): Promise<void> => {
    await supabase
      .from('sinalizacoes')
      .delete()
      .eq('id', id);
  },

  // CONFIGURAÇÃO API
  getConfigApi: async (): Promise<ConfiguracaoApi> => {
    const { data, error } = await supabase
      .from('configuracao_api')
      .select('*')
      .limit(1)
      .single();
    if (error || !data) {
      return { id: 1, url_api: '', token: '', usuario: '', senha: '', ultima_sincronizacao: '' };
    }
    return data;
  },

  updateConfigApi: async (data: Partial<ConfiguracaoApi>): Promise<ConfiguracaoApi> => {
    const { data: result, error } = await supabase
      .from('configuracao_api')
      .update(data)
      .eq('id', 1)
      .select()
      .single();
    if (error) throw error;
    return result;
  }
};
