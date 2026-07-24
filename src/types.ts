export type PerfilAcesso = 'Administrador' | 'Planejamento' | 'Operação' | 'Supervisor';

export interface Usuario {
  id: number;
  nome: string;
  login: string;
  senha?: string;
  perfil: PerfilAcesso;
  status: 'Ativo' | 'Inativo';
  produto?: string;
  supervisor?: string;
}

export interface Supervisor {
  id: number;
  nome: string;
  produto: string;
  status: 'Ativo' | 'Inativo';
}

export interface Operador {
  id: number;
  nome: string;
  produto: string;
  supervisor: string;
  situacao: string;
}

export interface Produto {
  id: number;
  nome: string;
}

export interface Motivo {
  id: number;
  descricao: string;
}

export interface Sinalizacao {
  id: number;
  data: string; // YYYY-MM-DD
  hora: string; // HH:mm:ss
  operador: string;
  supervisor: string;
  produto: string;
  motivo: string;
  observacao: string;
  nome_evidencia?: string;
  caminho_evidencia?: string;
  usuario_responsavel: string;
  data_cadastro: string;
  confirmado?: boolean;
  data_confirmacao?: string;
  usuario_confirmacao?: string;
}

export interface ConfiguracaoApi {
  id: number;
  url_api: string;
  token: string;
  usuario: string;
  senha?: string;
  ultima_sincronizacao?: string;
}

export interface DashboardFiltros {
  dataInicial: string;
  dataFinal: string;
  produto: string;
  supervisor: string;
}

export interface DashboardMetrics {
  totalSinalizacoes: number;
  totalOperadoresSinalizados: number;
  totalSupervisoresComSinalizacoes: number;
  totalMotivosCadastrados: number;
  sinalizacoesPorSupervisor: { supervisor: string; quantidade: number }[];
  maioresMotivos: { motivo: string; quantidade: number }[];
  topOperadores: { operador: string; quantidade: number }[];
  sinalizacoesPorProduto: { produto: string; quantidade: number }[];
  resumoTabela: Sinalizacao[];
}

export interface UserSession {
  id: number;
  nome: string;
  login: string;
  perfil: PerfilAcesso;
  status: 'Ativo' | 'Inativo';
  token: string;
}

// --- DIÁRIO DE BORDO TYPES ---
export type DiarioBordoStatus = 'Aberto' | 'Em Andamento' | 'Monitorando' | 'Resolvido' | 'Cancelado';

export interface DiarioBordoOcorrencia {
  id: number;
  data_ocorrencia: string; // YYYY-MM-DD
  hora_ocorrencia: string; // HH:mm
  produto: string;
  ocorrencia: string;
  impacto: string;
  comentario: string;
  status: DiarioBordoStatus;
  responsavel: string;
  nome_evidencia?: string;
  caminho_evidencia?: string;
  data_solucao?: string;
  hora_solucao?: string;
  solucao?: string;
  responsavel_solucao?: string;
  usuario_registro: string;
  data_cadastro: string;
  data_atualizacao: string;
}

export interface DiarioBordoHistorico {
  id: number;
  diario_bordo_id: number;
  data_hora: string;
  usuario: string;
  tipo_alteracao: string;
  status_anterior?: string;
  status_novo?: string;
  descricao: string;
}

export interface DiarioBordoFiltros {
  dataInicial?: string;
  dataFinal?: string;
  produto?: string;
  status?: string;
  responsavel?: string;
  impacto?: string;
  busca?: string;
}

export interface DiarioBordoMetrics {
  totalOcorrencias: number;
  totalAbertas: number;
  totalEmAndamento: number;
  totalResolvidas: number;
  totalMonitorando: number;
  totalCanceladas: number;
  tempoMedioResolucoesHoras: number;
  produtosMaisImpactados: { produto: string; quantidade: number }[];
  ocorrenciasPorProduto: { produto: string; quantidade: number }[];
  ocorrenciasPorStatus: { status: string; quantidade: number }[];
  ocorrenciasPorImpacto: { impacto: string; quantidade: number }[];
  ocorrenciasPorMes: { mes: string; quantidade: number }[];
  tempoMedioPorProduto: { produto: string; tempoMedioHoras: number }[];
}
