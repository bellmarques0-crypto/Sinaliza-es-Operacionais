import React, { useState, useEffect, useRef } from 'react';
import {
  Filter,
  FileSpreadsheet,
  Users,
  UserX,
  UserCheck,
  AlertTriangle,
  RotateCcw,
  Search,
  Calendar,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  PieChart as PieIcon
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import { api } from '../services/api';
import { DashboardMetrics, Supervisor, Produto, Operador } from '../types';
import { exportDashboardToExcel } from '../utils/excelExport';

const PIE_COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

export const DashboardView: React.FC = () => {
  const [dataInicial, setDataInicial] = useState('');
  const [dataFinal, setDataFinal] = useState('');
  const [produto, setProduto] = useState('Todos');
  const [supervisor, setSupervisor] = useState('Todos');
  const [operador, setOperador] = useState('');
  const [showOperadorDropdown, setShowOperadorDropdown] = useState(false);
  const operadorRef = useRef<HTMLDivElement>(null);

  const [supervisoresList, setSupervisoresList] = useState<Supervisor[]>([]);
  const [produtosList, setProdutosList] = useState<Produto[]>([]);
  const [operadoresList, setOperadoresList] = useState<Operador[]>([]);

  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Close operador dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (operadorRef.current && !operadorRef.current.contains(event.target as Node)) {
        setShowOperadorDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Table local search & pagination
  const [tableSearch, setTableSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  useEffect(() => {
    // Load dropdown options
    Promise.all([api.getSupervisores(), api.getProdutos(), api.getOperadores()])
      .then(([sups, prods, ops]) => {
        setSupervisoresList(sups);
        setProdutosList(prods);
        setOperadoresList(ops);
      })
      .catch((err) => console.error('Erro ao carregar opções dos filtros:', err));
  }, []);

  // Fetch metrics automatically whenever filters change
  useEffect(() => {
    fetchMetrics();
  }, [dataInicial, dataFinal, produto, supervisor, operador]);

  const fetchMetrics = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.getDashboard({
        dataInicial,
        dataFinal,
        produto,
        supervisor,
        operador
      });
      setMetrics(data);
      setCurrentPage(1);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar os dados do dashboard.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetFilters = () => {
    setDataInicial('');
    setDataFinal('');
    setProduto('Todos');
    setSupervisor('Todos');
    setOperador('');
    setTableSearch('');
  };

  const handleExportExcel = () => {
    if (metrics) {
      exportDashboardToExcel(metrics, {
        dataInicial,
        dataFinal,
        produto,
        supervisor,
        operador
      });
    }
  };

  if (isLoading && !metrics) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-500 font-medium">Carregando métricas executivas...</p>
        </div>
      </div>
    );
  }

  // Filter summary table locally by tableSearch
  const summaryTable = metrics?.resumoTabela || [];
  const filteredTable = summaryTable.filter((item) => {
    if (!tableSearch) return true;
    const term = tableSearch.toLowerCase();
    return (
      item.operador.toLowerCase().includes(term) ||
      item.supervisor.toLowerCase().includes(term) ||
      item.produto.toLowerCase().includes(term) ||
      item.motivo.toLowerCase().includes(term) ||
      item.usuario_responsavel.toLowerCase().includes(term)
    );
  });

  const totalPages = Math.ceil(filteredTable.length / itemsPerPage) || 1;
  const paginatedTable = filteredTable.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="space-y-6 pb-12">
      {/* Filters Bar */}
      <div className="rounded-2xl bg-white p-5 border border-slate-200/80 shadow-2xs">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-blue-600" />
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
              Filtros de Pesquisa & Análise
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Limpar Filtros
            </button>
            <button
              onClick={handleExportExcel}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-emerald-600/20 hover:bg-emerald-700 transition"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Exportar Dashboard para Excel
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
          {/* Data Inicial */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Data Inicial
            </label>
            <div className="relative">
              <input
                type="date"
                value={dataInicial}
                onChange={(e) => setDataInicial(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition"
              />
            </div>
          </div>

          {/* Data Final */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Data Final
            </label>
            <div className="relative">
              <input
                type="date"
                value={dataFinal}
                onChange={(e) => setDataFinal(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition"
              />
            </div>
          </div>

          {/* Operador */}
          <div className="relative" ref={operadorRef}>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Operador
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Nome..."
                value={operador}
                onChange={(e) => {
                  setOperador(e.target.value);
                  setShowOperadorDropdown(true);
                }}
                onFocus={() => setShowOperadorDropdown(true)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition pr-7"
              />
              {operador && (
                <button
                  type="button"
                  onClick={() => {
                    setOperador('');
                    setShowOperadorDropdown(false);
                  }}
                  className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                  title="Limpar operador"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Dropdown Suggestions */}
            {showOperadorDropdown && operador.trim().length > 0 && (
              <div className="absolute z-30 left-0 right-0 mt-1 max-h-48 overflow-y-auto rounded-xl bg-white border border-slate-200 shadow-lg divide-y divide-slate-100">
                {operadoresList.filter((op) =>
                  op.nome.toLowerCase().includes(operador.toLowerCase().trim())
                ).length > 0 ? (
                  operadoresList
                    .filter((op) =>
                      op.nome.toLowerCase().includes(operador.toLowerCase().trim())
                    )
                    .map((op) => (
                      <button
                        key={op.id}
                        type="button"
                        onClick={() => {
                          setOperador(op.nome);
                          setShowOperadorDropdown(false);
                        }}
                        className="w-full text-left px-3.5 py-2 hover:bg-blue-50 text-xs transition flex flex-col"
                      >
                        <span className="font-semibold text-slate-800">{op.nome}</span>
                        <span className="text-[10px] text-slate-500">
                          Sup: {op.supervisor} • Prod: {op.produto}
                        </span>
                      </button>
                    ))
                ) : (
                  <div className="px-3.5 py-2 text-xs text-slate-400 italic">
                    Nenhum operador encontrado.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Produto */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Produto
            </label>
            <select
              value={produto}
              onChange={(e) => setProduto(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition"
            >
              <option value="Todos">Todos os Produtos</option>
              {produtosList.map((p) => (
                <option key={p.id} value={p.nome}>
                  {p.nome}
                </option>
              ))}
            </select>
          </div>

          {/* Supervisor */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Supervisor
            </label>
            <select
              value={supervisor}
              onChange={(e) => setSupervisor(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition"
            >
              <option value="Todos">Todos os Supervisores</option>
              {supervisoresList.map((s) => (
                <option key={s.id} value={s.nome}>
                  {s.nome}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Card 1 */}
        <div className="rounded-2xl bg-white p-5 border border-slate-200/80 shadow-2xs flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 border border-blue-100">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total de Sinalizações
            </p>
            <h3 className="text-2xl font-bold text-slate-900 mt-0.5">
              {metrics?.totalSinalizacoes ?? 0}
            </h3>
          </div>
        </div>

        {/* Card 2 */}
        <div className="rounded-2xl bg-white p-5 border border-slate-200/80 shadow-2xs flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 border border-amber-100">
            <UserX className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Operadores Sinalizados
            </p>
            <h3 className="text-2xl font-bold text-slate-900 mt-0.5">
              {metrics?.totalOperadoresSinalizados ?? 0}
            </h3>
          </div>
        </div>

        {/* Card 3 */}
        <div className="rounded-2xl bg-white p-5 border border-slate-200/80 shadow-2xs flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100">
            <UserCheck className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Supervisores Impactados
            </p>
            <h3 className="text-2xl font-bold text-slate-900 mt-0.5">
              {metrics?.totalSupervisoresComSinalizacoes ?? 0}
            </h3>
          </div>
        </div>

        {/* Card 4 */}
        <div className="rounded-2xl bg-white p-5 border border-slate-200/80 shadow-2xs flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Motivos Cadastrados
            </p>
            <h3 className="text-2xl font-bold text-slate-900 mt-0.5">
              {metrics?.totalMotivosCadastrados ?? 0}
            </h3>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico 1: Sinalizações por Supervisor (Barra Horizontal) */}
        <div className="rounded-2xl bg-white p-6 border border-slate-200/80 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Sinalizações por Supervisor</h3>
              <p className="text-xs text-slate-500">Distribuição total por liderança direta</p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700">
              Barra Horizontal
            </span>
          </div>
          <div className="h-64 w-full">
            {metrics?.sinalizacoesPorSupervisor && metrics.sinalizacoesPorSupervisor.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={metrics.sinalizacoesPorSupervisor}
                  margin={{ top: 10, right: 30, left: 40, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                  <YAxis
                    dataKey="supervisor"
                    type="category"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11 }}
                    width={110}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '12px'
                    }}
                  />
                  <Bar dataKey="quantidade" fill="#2563eb" radius={[0, 6, 6, 0]} name="Sinalizações" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                Nenhum dado encontrado com os filtros selecionados.
              </div>
            )}
          </div>
        </div>

        {/* Gráfico 2: Maiores Motivos de Sinalização (Donut / Pie) */}
        <div className="rounded-2xl bg-white p-6 border border-slate-200/80 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Maiores Motivos de Sinalização</h3>
              <p className="text-xs text-slate-500">Proporção por categoria de ocorrência</p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700">
              Gráfico Donut
            </span>
          </div>
          <div className="h-64 w-full">
            {metrics?.maioresMotivos && metrics.maioresMotivos.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={metrics.maioresMotivos}
                    dataKey="quantidade"
                    nameKey="motivo"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                  >
                    {metrics.maioresMotivos.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '12px'
                    }}
                  />
                  <Legend
                    layout="horizontal"
                    verticalAlign="bottom"
                    align="center"
                    iconType="circle"
                    wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                Nenhum dado encontrado com os filtros selecionados.
              </div>
            )}
          </div>
        </div>

        {/* Gráfico 3: Top 5 Operadores Mais Sinalizados (Barra Vertical) */}
        <div className="rounded-2xl bg-white p-6 border border-slate-200/80 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Top 5 Operadores mais Sinalizados</h3>
              <p className="text-xs text-slate-500">Operadores com maior reincidência de ocorrências</p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700">
              Barra Vertical
            </span>
          </div>
          <div className="h-64 w-full">
            {metrics?.topOperadores && metrics.topOperadores.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metrics.topOperadores} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="operador"
                    tick={{ fontSize: 11 }}
                    interval={0}
                    angle={-15}
                    textAnchor="end"
                  />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '12px'
                    }}
                  />
                  <Bar dataKey="quantidade" fill="#f59e0b" radius={[6, 6, 0, 0]} name="Sinalizações" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                Nenhum dado encontrado com os filtros selecionados.
              </div>
            )}
          </div>
        </div>

        {/* Gráfico 4: Quantidade por Produto (Colunas) */}
        <div className="rounded-2xl bg-white p-6 border border-slate-200/80 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Sinalizações por Produto</h3>
              <p className="text-xs text-slate-500">Volume de ocorrências registradas por produto/operação</p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700">
              Colunas
            </span>
          </div>
          <div className="h-64 w-full">
            {metrics?.sinalizacoesPorProduto && metrics.sinalizacoesPorProduto.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metrics.sinalizacoesPorProduto} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="produto"
                    tick={{ fontSize: 11 }}
                    interval={0}
                    angle={-15}
                    textAnchor="end"
                  />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '12px'
                    }}
                  />
                  <Bar dataKey="quantidade" fill="#10b981" radius={[6, 6, 0, 0]} name="Sinalizações" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                Nenhum dado encontrado com os filtros selecionados.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabela Resumo */}
      <div className="rounded-2xl bg-white p-6 border border-slate-200/80 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-800">Tabela Resumo das Sinalizações</h3>
            <p className="text-xs text-slate-500">
              Registros consolidados conforme os filtros executivos selecionados
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Pesquisar registro..."
              value={tableSearch}
              onChange={(e) => {
                setTableSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full rounded-xl border border-slate-300 pl-9 pr-3 py-1.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition"
            />
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 font-semibold text-slate-700 uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Operador</th>
                <th className="px-4 py-3">Supervisor</th>
                <th className="px-4 py-3">Produto</th>
                <th className="px-4 py-3">Motivo</th>
                <th className="px-4 py-3">Usuário Registro</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {paginatedTable.length > 0 ? (
                paginatedTable.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition">
                    <td className="px-4 py-3 font-medium text-slate-800 whitespace-nowrap">
                      {item.data} <span className="text-slate-400 text-[10px]">({item.hora})</span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-900 whitespace-nowrap">
                      {item.operador}
                    </td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{item.supervisor}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-[11px] font-medium text-blue-700">
                        {item.produto}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800 whitespace-nowrap">
                      {item.motivo}
                    </td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                      {item.usuario_responsavel}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    Nenhum registro de sinalização encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
          <div>
            Mostrando <span className="font-semibold text-slate-800">{paginatedTable.length}</span> de{' '}
            <span className="font-semibold text-slate-800">{filteredTable.length}</span> registros
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-40 transition"
            >
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </button>
            <span className="font-semibold text-slate-700 px-2">
              Página {currentPage} de {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-40 transition"
            >
              Próximo
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
