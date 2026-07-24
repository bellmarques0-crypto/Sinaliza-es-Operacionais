import React, { useState, useEffect, useRef } from 'react';
import {
  BookOpen,
  Plus,
  FileSpreadsheet,
  FileDown,
  Loader2,
  RotateCcw,
  Search,
  Filter,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  HelpCircle,
  XCircle,
  Eye,
  Edit2,
  Trash2,
  Upload,
  Image as ImageIcon,
  History,
  TrendingUp,
  BarChart2,
  PieChart as PieChartIcon,
  Check,
  ChevronRight,
  AlertCircle,
  FileText,
  User,
  Layers,
  ArrowRight
} from 'lucide-react';
import { exportDashboardToPDF } from '../utils/pdfExport';
import { getBrasiliaDateString, getBrasiliaTimeString } from '../utils/dateUtils';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
  AreaChart,
  Area
} from 'recharts';
import * as XLSX from 'xlsx';
import {
  DiarioBordoOcorrencia,
  DiarioBordoHistorico,
  DiarioBordoFiltros,
  DiarioBordoMetrics,
  UserSession,
  Produto,
  Usuario
} from '../types';
import { ImageModal } from './ImageModal';

interface DiarioBordoViewProps {
  user: UserSession;
  token: string;
}

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string; badge: string }> = {
  Aberto: {
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
    badge: 'bg-blue-100 text-blue-800'
  },
  'Em Andamento': {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
    badge: 'bg-amber-100 text-amber-800'
  },
  Resolvido: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    badge: 'bg-emerald-100 text-emerald-800'
  },
  Monitorando: {
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    border: 'border-purple-200',
    badge: 'bg-purple-100 text-purple-800'
  },
  Cancelado: {
    bg: 'bg-slate-100',
    text: 'text-slate-600',
    border: 'border-slate-200',
    badge: 'bg-slate-200 text-slate-700'
  }
};

const IMPACTO_COLORS: Record<string, { bg: string; text: string; badge: string }> = {
  Baixo: {
    bg: 'bg-sky-50',
    text: 'text-sky-700',
    badge: 'bg-sky-100 text-sky-800'
  },
  Médio: {
    bg: 'bg-yellow-50',
    text: 'text-yellow-700',
    badge: 'bg-yellow-100 text-yellow-800'
  },
  Alto: {
    bg: 'bg-orange-50',
    text: 'text-orange-700',
    badge: 'bg-orange-100 text-orange-800'
  },
  Crítico: {
    bg: 'bg-red-50',
    text: 'text-red-700',
    badge: 'bg-red-100 text-red-800'
  }
};

const CHART_PIE_COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#a855f7', '#64748b'];

export const DiarioBordoView: React.FC<DiarioBordoViewProps> = ({ user, token }) => {
  // State
  const [ocorrencias, setOcorrencias] = useState<DiarioBordoOcorrencia[]>([]);
  const [metrics, setMetrics] = useState<DiarioBordoMetrics | null>(null);
  const [produtos, setProdutos] = useState<string[]>([]);
  const [usuariosList, setUsuariosList] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'lista' | 'dashboard' | 'timeline'>('lista');

  // Filters State
  const [filtros, setFiltros] = useState<DiarioBordoFiltros>({
    dataInicial: '',
    dataFinal: '',
    produto: 'Todos',
    status: 'Todos',
    responsavel: 'Todos',
    impacto: 'Todos',
    busca: ''
  });

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<DiarioBordoOcorrencia | null>(null);
  const [modalActiveTab, setModalActiveTab] = useState<'dados' | 'solucao' | 'historico'>('dados');
  const [itemHistorico, setItemHistorico] = useState<DiarioBordoHistorico[]>([]);

  // Form Fields State
  const [formData, setFormData] = useState({
    data_ocorrencia: getBrasiliaDateString(),
    hora_ocorrencia: getBrasiliaTimeString(new Date(), false),
    produto: '',
    ocorrencia: '',
    impacto: 'Médio',
    comentario: '',
    status: 'Aberto',
    responsavel: user.nome || '',
    caminho_evidencia: '',
    nome_evidencia: '',
    data_solucao: '',
    hora_solucao: '',
    solucao: '',
    responsavel_solucao: user.nome || ''
  });

  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [evidencePreview, setEvidencePreview] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Image viewer modal
  const [viewImageModal, setViewImageModal] = useState<{ isOpen: boolean; url: string; title: string }>({
    isOpen: false,
    url: '',
    title: ''
  });

  // Fetch data
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Build query string from filters
      const params = new URLSearchParams();
      if (filtros.dataInicial) params.append('dataInicial', filtros.dataInicial);
      if (filtros.dataFinal) params.append('dataFinal', filtros.dataFinal);
      if (filtros.produto !== 'Todos') params.append('produto', filtros.produto);
      if (filtros.status !== 'Todos') params.append('status', filtros.status);
      if (filtros.responsavel !== 'Todos') params.append('responsavel', filtros.responsavel);
      if (filtros.impacto !== 'Todos') params.append('impacto', filtros.impacto);
      if (filtros.busca) params.append('busca', filtros.busca);

      const [resOcorr, resMetrics, resProds, resUsers] = await Promise.all([
        fetch(`/api/diario-bordo?${params.toString()}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`/api/diario-bordo/metrics?${params.toString()}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/produtos', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/usuarios', { headers: { Authorization: `Bearer ${token}` } })
      ]);

      if (resOcorr.ok) {
        const data = await resOcorr.json();
        setOcorrencias(data);
      }
      if (resMetrics.ok) {
        const data = await resMetrics.json();
        setMetrics(data);
      }
      if (resProds.ok) {
        const data: Produto[] = await resProds.json();
        setProdutos(data.map((p) => p.nome));
      }
      if (resUsers.ok) {
        const data: Usuario[] = await resUsers.json();
        setUsuariosList(data.map((u) => u.nome));
      }
    } catch (err: any) {
      console.error('Error fetching Diario de Bordo data:', err);
      setError('Falha ao carregar os dados do Diário de Bordo.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [filtros, token]);

  // Load item history when editing
  const loadItemHistory = async (id: number) => {
    try {
      const res = await fetch(`/api/diario-bordo/${id}/historico`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const historyData = await res.json();
        setItemHistorico(historyData);
      }
    } catch (err) {
      console.error('Error loading history:', err);
    }
  };

  // Open Modal for Create or Edit
  const handleOpenModal = (item?: DiarioBordoOcorrencia, initialTab: 'dados' | 'solucao' | 'historico' = 'dados') => {
    if (item) {
      setEditingItem(item);
      setFormData({
        data_ocorrencia: item.data_ocorrencia || getBrasiliaDateString(),
        hora_ocorrencia: item.hora_ocorrencia || getBrasiliaTimeString(new Date(), false),
        produto: item.produto || (produtos[0] || ''),
        ocorrencia: item.ocorrencia || '',
        impacto: item.impacto || 'Médio',
        comentario: item.comentario || '',
        status: item.status || 'Aberto',
        responsavel: item.responsavel || user.nome,
        caminho_evidencia: item.caminho_evidencia || '',
        nome_evidencia: item.nome_evidencia || '',
        data_solucao: item.data_solucao || (item.status === 'Resolvido' ? getBrasiliaDateString() : ''),
        hora_solucao: item.hora_solucao || (item.status === 'Resolvido' ? getBrasiliaTimeString(new Date(), false) : ''),
        solucao: item.solucao || '',
        responsavel_solucao: item.responsavel_solucao || user.nome
      });
      setEvidencePreview(item.caminho_evidencia || '');
      loadItemHistory(item.id);
    } else {
      setEditingItem(null);
      setFormData({
        data_ocorrencia: getBrasiliaDateString(),
        hora_ocorrencia: getBrasiliaTimeString(new Date(), false),
        produto: produtos[0] || 'Cartões de Crédito',
        ocorrencia: '',
        impacto: 'Médio',
        comentario: '',
        status: 'Aberto',
        responsavel: user.nome || '',
        caminho_evidencia: '',
        nome_evidencia: '',
        data_solucao: '',
        hora_solucao: '',
        solucao: '',
        responsavel_solucao: user.nome || ''
      });
      setEvidencePreview('');
      setItemHistorico([]);
    }
    setEvidenceFile(null);
    setModalActiveTab(initialTab);
    setIsModalOpen(true);
  };

  // Handle Clipboard Paste for Evidence Image
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          setEvidenceFile(file);
          const reader = new FileReader();
          reader.onload = (event) => {
            if (event.target?.result) {
              setEvidencePreview(event.target.result as string);
              setFormData((prev) => ({
                ...prev,
                caminho_evidencia: event.target?.result as string,
                nome_evidencia: 'print_capturado.png'
              }));
            }
          };
          reader.readAsDataURL(file);
        }
      }
    }
  };

  // Handle File Upload Change
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setEvidenceFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setEvidencePreview(event.target.result as string);
          setFormData((prev) => ({
            ...prev,
            caminho_evidencia: event.target?.result as string,
            nome_evidencia: file.name
          }));
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle Form Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.produto || !formData.ocorrencia || !formData.responsavel) {
      alert('Por favor, preencha os campos obrigatórios: Produto, Ocorrência e Responsável.');
      return;
    }

    setSubmitting(true);
    try {
      const formPayload = new FormData();
      formPayload.append('data_ocorrencia', formData.data_ocorrencia);
      formPayload.append('hora_ocorrencia', formData.hora_ocorrencia);
      formPayload.append('produto', formData.produto);
      formPayload.append('ocorrencia', formData.ocorrencia);
      formPayload.append('impacto', formData.impacto);
      formPayload.append('comentario', formData.comentario);
      formPayload.append('status', formData.status);
      formPayload.append('responsavel', formData.responsavel);

      if (formData.data_solucao) formPayload.append('data_solucao', formData.data_solucao);
      if (formData.hora_solucao) formPayload.append('hora_solucao', formData.hora_solucao);
      if (formData.solucao) formPayload.append('solucao', formData.solucao);
      if (formData.responsavel_solucao) formPayload.append('responsavel_solucao', formData.responsavel_solucao);

      if (evidenceFile) {
        formPayload.append('evidencia', evidenceFile);
      } else if (evidencePreview) {
        formPayload.append('caminho_evidencia', evidencePreview);
        formPayload.append('nome_evidencia', formData.nome_evidencia || 'evidencia.png');
      }

      const url = editingItem ? `/api/diario-bordo/${editingItem.id}` : '/api/diario-bordo';
      const method = editingItem ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formPayload
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Erro ao salvar ocorrência.');
      }

      setIsModalOpen(false);
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Ocorreu um erro ao salvar o registro.');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Delete
  const handleDelete = async (id: number) => {
    if (!window.confirm('Tem certeza de que deseja excluir esta ocorrência do Diário de Bordo?')) {
      return;
    }
    try {
      const res = await fetch(`/api/diario-bordo/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        fetchData();
      } else {
        alert('Erro ao excluir ocorrência.');
      }
    } catch (err) {
      console.error('Error deleting item:', err);
    }
  };

  // Export to Excel
  const handleExportExcel = () => {
    if (ocorrencias.length === 0) {
      alert('Nenhum registro para exportar.');
      return;
    }

    const exportData = ocorrencias.map((item) => ({
      ID: item.id,
      'Data Ocorrência': item.data_ocorrencia,
      'Hora Ocorrência': item.hora_ocorrencia,
      Produto: item.produto,
      Ocorrência: item.ocorrencia,
      'Tipo de Impacto': item.impacto,
      Status: item.status,
      Responsável: item.responsavel,
      Comentários: item.comentario || '',
      'Data Solução': item.data_solucao || '-',
      'Hora Solução': item.hora_solucao || '-',
      'Responsável Solução': item.responsavel_solucao || '-',
      Solução: item.solucao || '-',
      'Usuário Registro': item.usuario_registro,
      'Data Cadastro': item.data_cadastro
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Diario_de_Bordo');
    XLSX.writeFile(workbook, `Diario_de_Bordo_${getBrasiliaDateString()}.xlsx`);
  };

  // Clear filters
  const handleClearFilters = () => {
    setFiltros({
      dataInicial: '',
      dataFinal: '',
      produto: 'Todos',
      status: 'Todos',
      responsavel: 'Todos',
      impacto: 'Todos',
      busca: ''
    });
  };

  // Export filtered charts to PDF
  const chartsContainerRef = useRef<HTMLDivElement>(null);
  const [isExportingPDF, setIsExportingPDF] = useState<boolean>(false);

  const handleExportPDF = async () => {
    if (!metrics) return;
    setIsExportingPDF(true);

    if (activeTab !== 'dashboard') {
      setActiveTab('dashboard');
      // Delay to allow React re-render & Recharts animations to finish painting
      await new Promise((resolve) => setTimeout(resolve, 600));
    }

    try {
      if (chartsContainerRef.current) {
        await exportDashboardToPDF(
          chartsContainerRef.current,
          'Diário de Bordo Operacional - Relatório de Gráficos',
          `Graficos_Diario_de_Bordo_${getBrasiliaDateString()}.pdf`,
          filtros
        );
      } else {
        alert('Contêiner dos gráficos não encontrado. Verifique se a aba de gráficos está visível.');
      }
    } catch (err) {
      console.error('Erro ao exportar PDF:', err);
      alert('Não foi possível gerar o PDF dos gráficos. Tente novamente.');
    } finally {
      setIsExportingPDF(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto font-sans text-slate-800">
      {/* Title & Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 rounded-2xl bg-white p-5 border border-slate-200/80 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-600 text-white rounded-xl shadow-md shadow-blue-600/20">
            <BookOpen className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Diário de Bordo Operacional
            </h1>
            <p className="text-xs text-slate-500">
              Registro, acompanhamento e solução de ocorrências que impactam a operação.
            </p>
          </div>
        </div>

        {/* View mode switcher */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
          <button
            onClick={() => setActiveTab('lista')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'lista'
                ? 'bg-white text-blue-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="h-4 w-4" />
            <span>Ocorrências ({ocorrencias.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'dashboard'
                ? 'bg-white text-blue-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BarChart2 className="h-4 w-4" />
            <span>Dashboard e Gráficos</span>
          </button>
        </div>
      </div>

      {/* FILTERS BAR */}
      <div className="rounded-2xl bg-white p-5 border border-slate-200/80 shadow-2xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2 text-slate-700 font-semibold text-sm">
            <Filter className="h-4 w-4 text-blue-600" />
            <span>Filtros de Consulta</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleOpenModal()}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-600/20 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Novo Registro</span>
            </button>
            <button
              onClick={handleExportExcel}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-600/20 cursor-pointer"
            >
              <FileSpreadsheet className="h-4 w-4" />
              <span className="hidden sm:inline">Exportar Excel</span>
            </button>
            <button
              onClick={handleExportPDF}
              disabled={isExportingPDF}
              className="flex items-center gap-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-md shadow-rose-600/20 cursor-pointer"
              title="Exportar gráficos e métricas filtradas em PDF"
            >
              {isExportingPDF ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileDown className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">
                {isExportingPDF ? 'Gerando PDF...' : 'Exportar PDF'}
              </span>
            </button>
            <button
              onClick={handleClearFilters}
              className="flex items-center gap-1.5 text-slate-600 hover:bg-slate-100 px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer"
              title="Limpar todos os filtros"
            >
              <RotateCcw className="h-4 w-4" />
              <span className="hidden sm:inline">Limpar</span>
            </button>
          </div>
        </div>

        {/* Filter Inputs Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Data Inicial */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
              Data Inicial
            </label>
            <input
              type="date"
              value={filtros.dataInicial}
              onChange={(e) => setFiltros((prev) => ({ ...prev, dataInicial: e.target.value }))}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
            />
          </div>

          {/* Data Final */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
              Data Final
            </label>
            <input
              type="date"
              value={filtros.dataFinal}
              onChange={(e) => setFiltros((prev) => ({ ...prev, dataFinal: e.target.value }))}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
            />
          </div>

          {/* Produto */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
              Produto
            </label>
            <select
              value={filtros.produto}
              onChange={(e) => setFiltros((prev) => ({ ...prev, produto: e.target.value }))}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
            >
              <option value="Todos">Todos os Produtos</option>
              {produtos.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
              Status
            </label>
            <select
              value={filtros.status}
              onChange={(e) => setFiltros((prev) => ({ ...prev, status: e.target.value }))}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
            >
              <option value="Todos">Todos os Status</option>
              <option value="Aberto">Aberto</option>
              <option value="Em Andamento">Em Andamento</option>
              <option value="Resolvido">Resolvido</option>
              <option value="Monitorando">Monitorando</option>
              <option value="Cancelado">Cancelado</option>
            </select>
          </div>

          {/* Responsável */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
              Responsável
            </label>
            <select
              value={filtros.responsavel}
              onChange={(e) => setFiltros((prev) => ({ ...prev, responsavel: e.target.value }))}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
            >
              <option value="Todos">Todos os Responsáveis</option>
              {usuariosList.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>

          {/* Tipo de Impacto */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
              Impacto
            </label>
            <select
              value={filtros.impacto}
              onChange={(e) => setFiltros((prev) => ({ ...prev, impacto: e.target.value }))}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
            >
              <option value="Todos">Todos os Impactos</option>
              <option value="Baixo">Baixo</option>
              <option value="Médio">Médio</option>
              <option value="Alto">Alto</option>
              <option value="Crítico">Crítico</option>
            </select>
          </div>
        </div>

        {/* Text Search Bar */}
        <div className="relative pt-1">
          <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por ocorrência, comentário, produto ou solução..."
            value={filtros.busca}
            onChange={(e) => setFiltros((prev) => ({ ...prev, busca: e.target.value }))}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
          />
        </div>
      </div>

      {/* CHARTS CONTAINER FOR PDF EXPORT */}
      <div ref={chartsContainerRef} className="space-y-6">
        {/* KPI SUMMARY METRICS CARDS */}
        {metrics && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
            <div className="rounded-2xl bg-white p-5 border border-slate-200/80 shadow-2xs flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Total Registros
                </p>
                <p className="text-2xl font-bold text-slate-900 mt-1">
                  {metrics.totalOcorrencias}
                </p>
              </div>
              <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                <Layers className="h-5 w-5" />
              </div>
            </div>

            <div className="rounded-2xl bg-white p-5 border border-slate-200/80 shadow-2xs flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Abertas / Andamento
                </p>
                <p className="text-2xl font-bold text-amber-600 mt-1">
                  {metrics.totalAbertas + metrics.totalEmAndamento}
                </p>
              </div>
              <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
                <Clock className="h-5 w-5" />
              </div>
            </div>

            <div className="rounded-2xl bg-white p-5 border border-slate-200/80 shadow-2xs flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Resolvidas
                </p>
                <p className="text-2xl font-bold text-emerald-600 mt-1">
                  {metrics.totalResolvidas}
                </p>
              </div>
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                <CheckCircle2 className="h-5 w-5" />
              </div>
            </div>

            <div className="rounded-2xl bg-white p-5 border border-slate-200/80 shadow-2xs flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Monitorando
                </p>
                <p className="text-2xl font-bold text-purple-600 mt-1">
                  {metrics.totalMonitorando}
                </p>
              </div>
              <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
                <Eye className="h-5 w-5" />
              </div>
            </div>

            <div className="rounded-2xl bg-white p-5 border border-slate-200/80 shadow-2xs flex items-center justify-between col-span-2 md:col-span-1">
              <div>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Tempo Médio Resolução
                </p>
                <p className="text-2xl font-bold text-blue-600 mt-1">
                  {metrics.tempoMedioResolucoesHoras} h
                </p>
              </div>
              <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                <TrendingUp className="h-5 w-5" />
              </div>
            </div>
          </div>
        )}

        {/* MAIN TAB CONTENT - CHARTS */}
        {activeTab === 'dashboard' && metrics && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Chart 1: Produtos Mais Impactados */}
              <div className="rounded-2xl bg-white p-5 border border-slate-200/80 shadow-2xs">
                <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <BarChart2 className="h-4 w-4 text-blue-600" />
                  <span>Produtos Mais Impactados</span>
                </h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={metrics.produtosMaisImpactados} layout="vertical" margin={{ left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis type="number" />
                      <YAxis dataKey="produto" type="category" width={110} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="quantidade" fill="#3b82f6" radius={[0, 8, 8, 0]} name="Ocorrências" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Chart 2: Ocorrências por Status */}
              <div className="rounded-2xl bg-white p-5 border border-slate-200/80 shadow-2xs">
                <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <PieChartIcon className="h-4 w-4 text-amber-500" />
                  <span>Distribuição por Status</span>
                </h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={metrics.ocorrenciasPorStatus}
                        dataKey="quantidade"
                        nameKey="status"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label={({ status, quantidade }) => `${status}: ${quantidade}`}
                      >
                        {metrics.ocorrenciasPorStatus.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={CHART_PIE_COLORS[index % CHART_PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Chart 3: Ocorrências por Impacto */}
              <div className="rounded-2xl bg-white p-5 border border-slate-200/80 shadow-2xs">
                <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                  <span>Gravidade / Tipo de Impacto</span>
                </h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={metrics.ocorrenciasPorImpacto}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis dataKey="impacto" tick={{ fontSize: 11 }} />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="quantidade" name="Ocorrências" radius={[8, 8, 0, 0]}>
                        {metrics.ocorrenciasPorImpacto.map((entry, index) => {
                          let color = '#3b82f6';
                          if (entry.impacto === 'Médio') color = '#eab308';
                          if (entry.impacto === 'Alto') color = '#f97316';
                          if (entry.impacto === 'Crítico') color = '#ef4444';
                          return <Cell key={`cell-imp-${index}`} fill={color} />;
                        })}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Chart 4: Evolução Mensal */}
              <div className="rounded-2xl bg-white p-5 border border-slate-200/80 shadow-2xs">
                <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-emerald-500" />
                  <span>Evolução por Mês</span>
                </h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={metrics.ocorrenciasPorMes}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                      <YAxis />
                      <Tooltip />
                      <Area type="monotone" dataKey="quantidade" stroke="#10b981" fill="#10b981" fillOpacity={0.2} name="Ocorrências" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Chart 5: Tempo Médio de Resolução por Produto */}
            <div className="rounded-2xl bg-white p-5 border border-slate-200/80 shadow-2xs">
              <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Clock className="h-4 w-4 text-purple-500" />
                <span>Tempo Médio de Resolução por Produto (Horas)</span>
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={metrics.tempoMedioPorProduto}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="produto" tick={{ fontSize: 11 }} />
                    <YAxis unit="h" />
                    <Tooltip formatter={(value) => [`${value} horas`, 'Tempo Médio']} />
                    <Bar dataKey="tempoMedioHoras" fill="#8b5cf6" radius={[8, 8, 0, 0]} name="Horas até Solução" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* TABLE VIEW */}
      {activeTab === 'lista' && (
        <div className="rounded-2xl bg-white border border-slate-200/80 shadow-2xs overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-slate-500">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent mb-3"></div>
              <p className="text-sm font-medium">Carregando Diário de Bordo...</p>
            </div>
          ) : error ? (
            <div className="p-8 text-center text-red-600 font-medium">
              {error}
            </div>
          ) : ocorrencias.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <BookOpen className="h-10 w-10 text-slate-300 mx-auto" />
              <p className="text-slate-600 font-medium text-sm">
                Nenhuma ocorrência encontrada para os filtros selecionados.
              </p>
              <button
                onClick={() => handleOpenModal()}
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>Registrar Nova Ocorrência</span>
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="p-3.5 pl-5">Data/Hora</th>
                    <th className="p-3.5">Produto</th>
                    <th className="p-3.5">Ocorrência</th>
                    <th className="p-3.5">Impacto</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5">Responsável</th>
                    <th className="p-3.5">Solução / Resolução</th>
                    <th className="p-3.5">Evidência</th>
                    <th className="p-3.5 text-center">Linha do Tempo</th>
                    <th className="p-3.5 pr-5 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {ocorrencias.map((item) => {
                    const statusConfig = STATUS_COLORS[item.status] || STATUS_COLORS['Aberto'];
                    const impactoConfig = IMPACTO_COLORS[item.impacto] || IMPACTO_COLORS['Médio'];

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                        {/* Data / Hora */}
                        <td className="p-3.5 pl-5 whitespace-nowrap">
                          <div className="font-semibold text-slate-900">
                            {item.data_ocorrencia}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            {item.hora_ocorrencia}
                          </div>
                        </td>

                        {/* Produto */}
                        <td className="p-3.5 font-medium text-slate-900 whitespace-nowrap">
                          {item.produto}
                        </td>

                        {/* Ocorrência & Comentários */}
                        <td className="p-3.5 max-w-xs">
                          <div className="font-semibold text-slate-900 line-clamp-1">
                            {item.ocorrencia}
                          </div>
                          {item.comentario && (
                            <div className="text-[11px] text-slate-500 line-clamp-1">
                              {item.comentario}
                            </div>
                          )}
                        </td>

                        {/* Impacto */}
                        <td className="p-3.5 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold ${impactoConfig.badge}`}>
                            {item.impacto}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="p-3.5 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold ${statusConfig.badge}`}>
                            {item.status}
                          </span>
                        </td>

                        {/* Responsável */}
                        <td className="p-3.5 font-medium text-slate-700 whitespace-nowrap">
                          {item.responsavel}
                        </td>

                        {/* Solução */}
                        <td className="p-3.5 max-w-xs">
                          {item.solucao ? (
                            <div>
                              <div className="text-slate-800 font-medium line-clamp-1">
                                {item.solucao}
                              </div>
                              <div className="text-[10px] text-emerald-600 font-semibold">
                                {item.responsavel_solucao} ({item.data_solucao})
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">Pendente</span>
                          )}
                        </td>

                        {/* Evidência */}
                        <td className="p-3.5 whitespace-nowrap">
                          {item.caminho_evidencia ? (
                            <button
                              onClick={() =>
                                setViewImageModal({
                                  isOpen: true,
                                  url: item.caminho_evidencia!,
                                  title: `Evidência - ${item.produto} (${item.data_ocorrencia})`
                                })
                              }
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer"
                            >
                              <ImageIcon className="h-3.5 w-3.5 text-blue-600" />
                              <span>Ver foto</span>
                            </button>
                          ) : (
                            <span className="text-slate-400 text-[11px]">Sem anexo</span>
                          )}
                        </td>

                        {/* Linha do Tempo */}
                        <td className="p-3.5 text-center whitespace-nowrap">
                          <button
                            onClick={() => handleOpenModal(item, 'historico')}
                            className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer inline-flex items-center justify-center"
                            title="Ver Linha do Tempo"
                          >
                            <Eye className="h-4 w-4 text-blue-600" />
                          </button>
                        </td>

                        {/* Actions */}
                        <td className="p-3.5 pr-5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenModal(item)}
                              className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                              title="Editar / Tratar Solução"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(item.id)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                              title="Excluir Ocorrência"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* MODAL NOVO REGISTRO / EDIÇÃO DE OCORRÊNCIA */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-2xl overflow-hidden my-8">
            {/* Modal Header */}
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-600 text-white rounded-xl">
                  {modalActiveTab === 'historico' ? (
                    <History className="h-5 w-5" />
                  ) : (
                    <BookOpen className="h-5 w-5" />
                  )}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {modalActiveTab === 'historico'
                      ? `Linha do Tempo - Ocorrência #${editingItem?.id}`
                      : editingItem
                      ? `Editar Ocorrência #${editingItem.id}`
                      : 'Novo Registro no Diário de Bordo'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {modalActiveTab === 'historico'
                      ? 'Histórico de alterações e eventos da ocorrência'
                      : 'Preencha as informações detalhadas da ocorrência operacional'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <XCircle className="h-6 w-6" />
              </button>
            </div>

            {/* Modal Tabs Navigation */}
            <div className="flex items-center border-b border-slate-200 px-6 bg-slate-50/50">
              {modalActiveTab === 'historico' ? (
                <button
                  type="button"
                  className="px-4 py-2.5 text-xs font-bold border-b-2 border-blue-600 text-blue-600 cursor-default"
                >
                  Linha do Tempo ({itemHistorico.length})
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setModalActiveTab('dados')}
                    className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                      modalActiveTab === 'dados'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    1. Dados da Ocorrência
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalActiveTab('solucao')}
                    className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                      modalActiveTab === 'solucao'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    2. Solução e Resolução
                  </button>
                </>
              )}
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {modalActiveTab === 'dados' && (
                <div className="space-y-4" onPaste={handlePaste}>
                  {/* Grid 1: Data & Hora */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Data da Ocorrência *
                      </label>
                      <input
                        type="date"
                        required
                        value={formData.data_ocorrencia}
                        onChange={(e) => setFormData((prev) => ({ ...prev, data_ocorrencia: e.target.value }))}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Hora da Ocorrência *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="HH:mm"
                        value={formData.hora_ocorrencia}
                        onChange={(e) => setFormData((prev) => ({ ...prev, hora_ocorrencia: e.target.value }))}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none font-mono"
                      />
                    </div>
                  </div>

                  {/* Grid 2: Produto & Impacto */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Produto *
                      </label>
                      <select
                        required
                        value={formData.produto}
                        onChange={(e) => setFormData((prev) => ({ ...prev, produto: e.target.value }))}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
                      >
                        <option value="">Selecione o produto...</option>
                        {produtos.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Tipo de Impacto *
                      </label>
                      <select
                        required
                        value={formData.impacto}
                        onChange={(e) => setFormData((prev) => ({ ...prev, impacto: e.target.value }))}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
                      >
                        <option value="Baixo">Baixo</option>
                        <option value="Médio">Médio</option>
                        <option value="Alto">Alto</option>
                        <option value="Crítico">Crítico</option>
                      </select>
                    </div>
                  </div>

                  {/* Ocorrência / Título */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Descrição da Ocorrência *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Instabilidade no sistema de autorização de cartões"
                      value={formData.ocorrencia}
                      onChange={(e) => setFormData((prev) => ({ ...prev, ocorrencia: e.target.value }))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
                    />
                  </div>

                  {/* Responsável & Status */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Responsável pela Ocorrência *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.responsavel}
                        onChange={(e) => setFormData((prev) => ({ ...prev, responsavel: e.target.value }))}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Status
                      </label>
                      <select
                        value={formData.status}
                        onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value }))}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none font-semibold"
                      >
                        <option value="Aberto">Aberto</option>
                        <option value="Em Andamento">Em Andamento</option>
                        <option value="Resolvido">Resolvido</option>
                        <option value="Monitorando">Monitorando</option>
                        <option value="Cancelado">Cancelado</option>
                      </select>
                    </div>
                  </div>

                  {/* Comentário Adicional (max 2000 chars) */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold text-slate-700">
                        Observações / Detalhes Adicionais
                      </label>
                      <span className="text-[11px] text-slate-400">
                        {formData.comentario.length}/2000 caracteres
                      </span>
                    </div>
                    <textarea
                      rows={3}
                      maxLength={2000}
                      placeholder="Descreva mais detalhes sobre o evento (opcional)..."
                      value={formData.comentario}
                      onChange={(e) => setFormData((prev) => ({ ...prev, comentario: e.target.value }))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none resize-none"
                    />
                  </div>

                  {/* Evidência (Anexo ou Print) */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Evidência de Print / Anexo (Cole Ctrl+V ou selecione o arquivo)
                    </label>

                    {evidencePreview ? (
                      <div className="relative group border border-slate-200 rounded-xl p-2 bg-slate-50 flex items-center gap-3">
                        <img
                          src={evidencePreview}
                          alt="Evidência"
                          className="h-16 w-24 object-cover rounded-lg border border-slate-200"
                        />
                        <div className="flex-1 overflow-hidden">
                          <p className="text-xs font-bold text-slate-800 truncate">
                            {formData.nome_evidencia || 'evidencia_anexada.png'}
                          </p>
                          <p className="text-[10px] text-emerald-600 font-semibold">
                            Imagem vinculada à ocorrência
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setEvidencePreview('');
                            setEvidenceFile(null);
                            setFormData((prev) => ({ ...prev, caminho_evidencia: '', nome_evidencia: '' }));
                          }}
                          className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs font-semibold cursor-pointer"
                        >
                          Remover
                        </button>
                      </div>
                    ) : (
                      <label className="border-2 border-dashed border-slate-200 hover:border-blue-500 rounded-xl p-4 flex flex-col items-center justify-center gap-2 cursor-pointer bg-slate-50/50 transition-colors">
                        <Upload className="h-6 w-6 text-slate-400" />
                        <span className="text-xs font-semibold text-slate-600">
                          Clique para selecionar arquivo ou cole com <kbd className="px-1.5 py-0.5 bg-slate-200 rounded text-[10px]">Ctrl + V</kbd>
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleFileChange}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>
                </div>
              )}

              {/* Tab Solução */}
              {modalActiveTab === 'solucao' && (
                <div className="space-y-4">
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800">
                    Registre a solução definitiva ou contorno para a ocorrência operacional. Ao salvar com a solução, altere o status para <strong>Resolvido</strong>.
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Data da Solução
                      </label>
                      <input
                        type="date"
                        value={formData.data_solucao}
                        onChange={(e) => setFormData((prev) => ({ ...prev, data_solucao: e.target.value }))}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Hora da Solução
                      </label>
                      <input
                        type="text"
                        placeholder="HH:mm"
                        value={formData.hora_solucao}
                        onChange={(e) => setFormData((prev) => ({ ...prev, hora_solucao: e.target.value }))}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Responsável pela Solução
                    </label>
                    <input
                      type="text"
                      placeholder="Nome do operador ou especialista que resolveu"
                      value={formData.responsavel_solucao}
                      onChange={(e) => setFormData((prev) => ({ ...prev, responsavel_solucao: e.target.value }))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Descrição da Solução Aplicada
                    </label>
                    <textarea
                      rows={4}
                      placeholder="Descreva detalhadamente a ação corretiva adotada..."
                      value={formData.solucao}
                      onChange={(e) => setFormData((prev) => ({ ...prev, solucao: e.target.value }))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none resize-none"
                    />
                  </div>
                </div>
              )}

              {/* Tab Histórico e Timeline */}
              {modalActiveTab === 'historico' && (
                <div className="space-y-4 max-h-96 overflow-y-auto pr-1">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-700 mb-2">
                    <History className="h-4 w-4 text-blue-600" />
                    <span>Linha do Tempo e Histórico de Alterações</span>
                  </div>

                  {itemHistorico.length === 0 ? (
                    <p className="text-xs text-slate-500 italic">Nenhum histórico registrado.</p>
                  ) : (
                    <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                      {itemHistorico.map((h) => (
                        <div key={h.id} className="relative bg-slate-50 p-3 rounded-xl border border-slate-200/80 text-xs space-y-1">
                          <span className="absolute -left-6 top-3 h-2.5 w-2.5 rounded-full bg-blue-600 ring-4 ring-white" />
                          <div className="flex items-center justify-between font-bold text-slate-900">
                            <span>{h.tipo_alteracao}</span>
                            <span className="text-[10px] text-slate-400 font-mono">{h.data_hora}</span>
                          </div>
                          <p className="text-slate-600">{h.descricao}</p>
                          <div className="text-[10px] text-slate-400 font-medium">
                            Por: <strong className="text-slate-700">{h.usuario}</strong>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                {modalActiveTab === 'historico' ? (
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
                  >
                    Fechar
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-600/20 disabled:opacity-50 cursor-pointer"
                    >
                      {submitting ? (
                        <span>Salvando...</span>
                      ) : (
                        <>
                          <Check className="h-4 w-4" />
                          <span>{editingItem ? 'Salvar Alterações' : 'Cadastrar Ocorrência'}</span>
                        </>
                      )}
                    </button>
                  </>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* IMAGE PREVIEW MODAL */}
      <ImageModal
        isOpen={viewImageModal.isOpen}
        onClose={() => setViewImageModal({ isOpen: false, url: '', title: '' })}
        imageUrl={viewImageModal.url}
        title={viewImageModal.title}
      />
    </div>
  );
};
