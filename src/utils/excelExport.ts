import * as XLSX from 'xlsx';
import { DashboardMetrics, Sinalizacao } from '../types';

export function exportDashboardToExcel(
  metrics: DashboardMetrics,
  filters: { dataInicial: string; dataFinal: string; produto: string; supervisor: string }
) {
  const wb = XLSX.utils.book_new();

  // Tab 1: Resumo Executivo
  const resumoData = [
    ['SISTEMA DE SINALIZAÇÕES DE COLABORADORES - RELATÓRIO EXECUTIVO'],
    ['Data do Relatório:', new Date().toLocaleString('pt-BR')],
    [''],
    ['FILTROS APLICADOS'],
    ['Data Inicial:', filters.dataInicial || 'Todas'],
    ['Data Final:', filters.dataFinal || 'Todas'],
    ['Produto:', filters.produto || 'Todos'],
    ['Supervisor:', filters.supervisor || 'Todos'],
    [''],
    ['INDICADORES GERAIS (CARDS)'],
    ['Total de Sinalizações:', metrics.totalSinalizacoes],
    ['Total de Operadores Sinalizados:', metrics.totalOperadoresSinalizados],
    ['Total de Supervisores com Sinalizações:', metrics.totalSupervisoresComSinalizacoes],
    ['Quantidade de Motivos Cadastrados:', metrics.totalMotivosCadastrados]
  ];
  const wsResumo = XLSX.utils.aoa_to_sheet(resumoData);
  XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo Executivo');

  // Tab 2: Gráficos & Distribuições (Summary Datasets for Charts)
  const graficosData: any[] = [
    ['1. SINALIZAÇÕES POR SUPERVISOR'],
    ['Supervisor', 'Quantidade de Sinalizações'],
    ...metrics.sinalizacoesPorSupervisor.map((s) => [s.supervisor, s.quantidade]),
    [''],
    ['2. MAIORES MOTIVOS DE SINALIZAÇÃO'],
    ['Motivo', 'Quantidade'],
    ...metrics.maioresMotivos.map((m) => [m.motivo, m.quantidade]),
    [''],
    ['3. TOP 5 OPERADORES MAIS SINALIZADOS'],
    ['Operador', 'Quantidade'],
    ...metrics.topOperadores.map((o) => [o.operador, o.quantidade]),
    [''],
    ['4. SINALIZAÇÕES POR PRODUTO'],
    ['Produto', 'Quantidade'],
    ...metrics.sinalizacoesPorProduto.map((p) => [p.produto, p.quantidade])
  ];
  const wsGraficos = XLSX.utils.aoa_to_sheet(graficosData);
  XLSX.utils.book_append_sheet(wb, wsGraficos, 'Resumo Graficos');

  // Tab 3: Tabela de Sinalizações Registradas
  const tabelaHead = [
    [
      'ID',
      'Data',
      'Hora',
      'Operador',
      'Supervisor',
      'Produto',
      'Motivo',
      'Observação',
      'Evidência',
      'Usuário Responsável',
      'Data Cadastro'
    ]
  ];
  const tabelaRows = metrics.resumoTabela.map((s) => [
    s.id,
    s.data,
    s.hora,
    s.operador,
    s.supervisor,
    s.produto,
    s.motivo,
    s.observacao,
    s.nome_evidencia ? `Sim (${s.nome_evidencia})` : 'Não',
    s.usuario_responsavel,
    s.data_cadastro
  ]);
  const wsTabela = XLSX.utils.aoa_to_sheet([...tabelaHead, ...tabelaRows]);
  XLSX.utils.book_append_sheet(wb, wsTabela, 'Tabela Detalhada');

  // Trigger download
  const dateStr = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `Relatorio_Dashboard_Sinalizacoes_${dateStr}.xlsx`);
}

export function exportHistoryToExcel(
  sinalizacoes: Sinalizacao[],
  filters: {
    dataInicial?: string;
    dataFinal?: string;
    supervisor?: string;
    operador?: string;
    produto?: string;
    motivo?: string;
  }
) {
  const wb = XLSX.utils.book_new();

  const head = [
    [
      'ID',
      'Data',
      'Hora',
      'Operador',
      'Supervisor',
      'Produto',
      'Motivo',
      'Observação',
      'Possui Evidência',
      'Nome da Evidência',
      'Usuário Responsável',
      'Data Registro'
    ]
  ];

  const rows = sinalizacoes.map((s) => [
    s.id,
    s.data,
    s.hora,
    s.operador,
    s.supervisor,
    s.produto,
    s.motivo,
    s.observacao,
    s.nome_evidencia ? 'SIM' : 'NÃO',
    s.nome_evidencia || '-',
    s.usuario_responsavel,
    s.data_cadastro
  ]);

  const filterSummary = [
    ['HISTÓRICO DE SINALIZAÇÕES REGISTRADAS'],
    ['Filtros aplicados:', JSON.stringify(filters)],
    ['Total de Registros:', sinalizacoes.length],
    ['Data de Exportação:', new Date().toLocaleString('pt-BR')],
    ['']
  ];

  const ws = XLSX.utils.aoa_to_sheet([...filterSummary, ...head, ...rows]);
  XLSX.utils.book_append_sheet(wb, ws, 'Historico_Sinalizacoes');

  const dateStr = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `Historico_Sinalizacoes_${dateStr}.xlsx`);
}
