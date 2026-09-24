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
  Sun,
  Check,
  ChevronRight,
  AlertCircle,
  FileText,
  User,
  Layers,
  Shield,
  ArrowRight,
  Mail,
  Copy,
  Send,
  UserPlus,
  AtSign,
  X
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
  Area,
  LabelList
} from 'recharts';
import * as XLSX from 'xlsx';
import {
  DiarioBordoOcorrencia,
  DiarioBordoHistorico,
  DiarioBordoStatus,
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

const CHART_PIE_COLORS = ['#6366f1', '#06b6d4', '#f59e0b', '#10b981', '#a855f7', '#ec4899', '#f97316', '#3b82f6'];

function formatFirstAndLastName(name?: string): string {
  if (!name) return '';
  const parts = name.trim().split(/\s+/);
  if (parts.length <= 2) return name.trim();
  return `${parts[0]} ${parts[parts.length - 1]}`;
}

function calculateMetrics(items: DiarioBordoOcorrencia[]): DiarioBordoMetrics {
  const totalOcorrencias = items.length;
  const totalAbertas = items.filter((i) => i.status === 'Aberto').length;
  const totalEmAndamento = items.filter((i) => i.status === 'Em Andamento').length;
  const totalResolvidas = items.filter((i) => i.status === 'Resolvido').length;
  const totalMonitorando = items.filter((i) => i.status === 'Monitorando').length;
  const totalCanceladas = items.filter((i) => i.status === 'Cancelado').length;

  let totalHorasResolucoes = 0;
  let countResolvidasComTempo = 0;
  const tempoPorProdutoMap: Record<string, { totalHoras: number; count: number }> = {};

  items.forEach((item) => {
    if (item.status === 'Resolvido' && item.data_solucao && item.hora_solucao) {
      try {
        const start = new Date(`${item.data_ocorrencia}T${item.hora_ocorrencia}:00`).getTime();
        const end = new Date(`${item.data_solucao}T${item.hora_solucao}:00`).getTime();
        if (!isNaN(start) && !isNaN(end) && end >= start) {
          const diffHours = (end - start) / (1000 * 60 * 60);
          totalHorasResolucoes += diffHours;
          countResolvidasComTempo++;

          if (!tempoPorProdutoMap[item.produto]) {
            tempoPorProdutoMap[item.produto] = { totalHoras: 0, count: 0 };
          }
          tempoPorProdutoMap[item.produto].totalHoras += diffHours;
          tempoPorProdutoMap[item.produto].count++;
        }
      } catch (e) {
        // ignore
      }
    }
  });

  const tempoMedioResolucoesHoras =
    countResolvidasComTempo > 0 ? parseFloat((totalHorasResolucoes / countResolvidasComTempo).toFixed(1)) : 0;

  const produtoCountMap: Record<string, number> = {};
  items.forEach((item) => {
    produtoCountMap[item.produto] = (produtoCountMap[item.produto] || 0) + 1;
  });
  const ocorrenciasPorProduto = Object.entries(produtoCountMap)
    .map(([produto, quantidade]) => ({ produto, quantidade }))
    .sort((a, b) => b.quantidade - a.quantidade);

  const produtosMaisImpactados = ocorrenciasPorProduto.slice(0, 5);

  const sistemaCountMap: Record<string, number> = {};
  items.forEach((item) => {
    const isOperacional = (item.tipo || 'Operacional') === 'Operacional';
    if (isOperacional && item.ocorrencia) {
      const raw = item.ocorrencia.trim();
      const firstLine = raw.split('\n')[0].trim().toUpperCase();
      const name = firstLine.length > 25 ? firstLine.substring(0, 25) + '...' : firstLine;
      sistemaCountMap[name] = (sistemaCountMap[name] || 0) + 1;
    }
  });
  const sistemasMaisImpactados = Object.entries(sistemaCountMap)
    .map(([sistema, quantidade]) => ({ sistema, quantidade }))
    .sort((a, b) => b.quantidade - a.quantidade)
    .slice(0, 6);

  const statusCountMap: Record<string, number> = {};
  items.forEach((item) => {
    statusCountMap[item.status] = (statusCountMap[item.status] || 0) + 1;
  });
  const ocorrenciasPorStatus = Object.entries(statusCountMap).map(([status, quantidade]) => ({
    status,
    quantidade
  }));

  const impactoCountMap: Record<string, number> = {};
  items.forEach((item) => {
    impactoCountMap[item.impacto] = (impactoCountMap[item.impacto] || 0) + 1;
  });
  const ocorrenciasPorImpacto = Object.entries(impactoCountMap).map(([impacto, quantidade]) => ({
    impacto,
    quantidade
  }));

  const mesCountMap: Record<string, number> = {};
  items.forEach((item) => {
    if (item.data_ocorrencia) {
      const [year, month] = item.data_ocorrencia.split('-');
      if (year && month) {
        const key = `${month}/${year}`;
        mesCountMap[key] = (mesCountMap[key] || 0) + 1;
      }
    }
  });
  const ocorrenciasPorMes = Object.entries(mesCountMap)
    .map(([mes, quantidade]) => ({ mes, quantidade }))
    .sort((a, b) => {
      const [mA, yA] = a.mes.split('/');
      const [mB, yB] = b.mes.split('/');
      return new Date(parseInt(yA), parseInt(mA) - 1).getTime() - new Date(parseInt(yB), parseInt(mB) - 1).getTime();
    });

  let manhaCount = 0;
  let tardeCount = 0;
  items.forEach((item) => {
    const hora = item.hora_ocorrencia ? item.hora_ocorrencia.trim() : '00:00';
    if (hora < '12:00') {
      manhaCount++;
    } else {
      tardeCount++;
    }
  });

  const ocorrenciasPorTurno = [
    { turno: 'Manhã (Até 11:59)', quantidade: manhaCount },
    { turno: 'Tarde (12:00 em diante)', quantidade: tardeCount }
  ];

  const tempoMedioPorProduto = Object.entries(tempoPorProdutoMap)
    .map(([produto, data]) => ({
      produto,
      tempoMedioHoras: parseFloat((data.totalHoras / data.count).toFixed(1))
    }))
    .sort((a, b) => b.tempoMedioHoras - a.tempoMedioHoras);

  return {
    totalOcorrencias,
    totalAbertas,
    totalEmAndamento,
    totalResolvidas,
    totalMonitorando,
    totalCanceladas,
    tempoMedioResolucoesHoras,
    produtosMaisImpactados,
    sistemasMaisImpactados,
    ocorrenciasPorProduto,
    ocorrenciasPorStatus,
    ocorrenciasPorImpacto,
    ocorrenciasPorMes,
    ocorrenciasPorTurno,
    tempoMedioPorProduto
  };
}

export const DiarioBordoView: React.FC<DiarioBordoViewProps> = ({ user, token }) => {
  // State
  const [ocorrencias, setOcorrencias] = useState<DiarioBordoOcorrencia[]>([]);
  const [produtos, setProdutos] = useState<string[]>([]);
  const [usuariosList, setUsuariosList] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'ocorrencias' | 'ocorrencias_internas' | 'dashboard'>('ocorrencias');

  // Derived filtered lists
  const ocorrenciasOperacionais = ocorrencias.filter((i) => (i.tipo || 'Operacional') === 'Operacional');
  const ocorrenciasInternas = ocorrencias.filter((i) => i.tipo === 'Interna');

  const displayedOcorrencias =
    activeTab === 'ocorrencias_internas'
      ? ocorrenciasInternas
      : activeTab === 'ocorrencias'
      ? ocorrenciasOperacionais
      : ocorrencias;

  const metrics = React.useMemo(() => {
    return calculateMetrics(displayedOcorrencias);
  }, [displayedOcorrencias]);

  // Filters State
  const [filtros, setFiltros] = useState<DiarioBordoFiltros>({
    dataInicial: '',
    dataFinal: '',
    produto: 'Todos',
    status: 'Todos',
    responsavel: 'Todos',
    impacto: 'Todos',
    tipo: 'Todos',
    busca: ''
  });

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<DiarioBordoOcorrencia | null>(null);
  const [modalActiveTab, setModalActiveTab] = useState<'dados' | 'solucao' | 'historico'>('dados');
  const [itemHistorico, setItemHistorico] = useState<DiarioBordoHistorico[]>([]);

  // Email Modal State
  const [isEmailModalOpen, setIsEmailModalOpen] = useState<boolean>(false);
  const [selectedEmailItemIds, setSelectedEmailItemIds] = useState<number[]>([]);
  const [copiedSnippet, setCopiedSnippet] = useState<boolean>(false);

  // Email Recipients State (persisted in localStorage)
  const [emailRecipients, setEmailRecipients] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('diario_bordo_email_recipients');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.warn('Erro ao carregar destinatários salvos:', e);
    }
    return [];
  });
  const [selectedEmailRecipients, setSelectedEmailRecipients] = useState<string[]>([]);
  const [newRecipientInput, setNewRecipientInput] = useState<string>('');
  const [isSendingEmail, setIsSendingEmail] = useState<boolean>(false);
  const [emailStatusFeedback, setEmailStatusFeedback] = useState<string | null>(null);

  // Auto select all saved recipients when modal opens
  useEffect(() => {
    if (isEmailModalOpen && selectedEmailRecipients.length === 0 && emailRecipients.length > 0) {
      setSelectedEmailRecipients([...emailRecipients]);
    }
  }, [isEmailModalOpen]);

  const handleAddRecipient = () => {
    const email = newRecipientInput.trim().toLowerCase();
    if (!email) return;
    if (!email.includes('@') || !email.includes('.')) {
      alert('Por favor, insira um endereço de e-mail válido.');
      return;
    }
    if (!emailRecipients.includes(email)) {
      const updated = [...emailRecipients, email];
      setEmailRecipients(updated);
      setSelectedEmailRecipients((prev) => [...prev, email]);
      try {
        localStorage.setItem('diario_bordo_email_recipients', JSON.stringify(updated));
      } catch (e) {
        console.warn('Erro ao salvar destinatários:', e);
      }
    }
    setNewRecipientInput('');
  };

  const handleRemoveRecipient = (emailToRemove: string) => {
    const updated = emailRecipients.filter((e) => e !== emailToRemove);
    setEmailRecipients(updated);
    setSelectedEmailRecipients((prev) => prev.filter((e) => e !== emailToRemove));
    try {
      localStorage.setItem('diario_bordo_email_recipients', JSON.stringify(updated));
    } catch (e) {
      console.warn('Erro ao salvar destinatários:', e);
    }
  };

  const toggleRecipientSelection = (email: string) => {
    setSelectedEmailRecipients((prev) =>
      prev.includes(email) ? prev.filter((e) => e !== email) : [...prev, email]
    );
  };

  const toggleSelectAllRecipients = () => {
    if (selectedEmailRecipients.length === emailRecipients.length) {
      setSelectedEmailRecipients([]);
    } else {
      setSelectedEmailRecipients([...emailRecipients]);
    }
  };

  const handleSendEmail = async () => {
    const { subject, body } = getEmailContent();
    if (selectedEmailItemIds.length === 0) {
      alert('Por favor, selecione ao menos uma ocorrência para incluir no e-mail.');
      return;
    }
    if (selectedEmailRecipients.length === 0) {
      alert('Por favor, cadastre ou selecione ao menos um e-mail destinatário.');
      return;
    }

    setIsSendingEmail(true);
    setEmailStatusFeedback(null);

    const to = selectedEmailRecipients.join(',');

    // Copia o resumo formatado para a área de transferência
    await copyToClipboard(`Para: ${to}\nAssunto: ${subject}\n\n${body}`);

    try {
      const res = await fetch('/api/email/enviar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          to: selectedEmailRecipients,
          subject,
          body
        })
      });

      const data = await res.json();
      setEmailStatusFeedback(data.message || (res.ok ? '✅ E-mail enviado com sucesso pelo servidor!' : '⚠️ Falha ao disparar e-mail.'));
    } catch (err: any) {
      console.error('Erro ao conectar com API de e-mail:', err);
      setEmailStatusFeedback('⚠️ Não foi possível conectar ao servidor de e-mail.');
    } finally {
      setIsSendingEmail(false);
    }
  };

  const toggleEmailItemSelection = (id: number) => {
    setSelectedEmailItemIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAllEmailItems = () => {
    if (selectedEmailItemIds.length === displayedOcorrencias.length) {
      setSelectedEmailItemIds([]);
    } else {
      setSelectedEmailItemIds(displayedOcorrencias.map((item) => item.id));
    }
  };

  const getEmailContent = () => {
    const dateStr = getBrasiliaDateString();
    const selectedItems = displayedOcorrencias.filter((item) =>
      selectedEmailItemIds.includes(item.id)
    );
    const count = selectedItems.length;
    const subject = `[Sinalizações Operacionais] Relatório de Ocorrências Operacionais - ${dateStr}`;

    let body = `Prezados,\n\nSegue o resumo das Ocorrências Operacionais:\n\n`;

    if (selectedItems.length === 0) {
      body += `Nenhuma ocorrência operacional selecionada.\n`;
    } else {
      const itemBlocks = selectedItems.map((item) => {
        let block = `${item.produto || 'Ocorrência'}\n`;
        block += `Data/Hora: ${item.data_ocorrencia}${item.hora_ocorrencia ? ' às ' + item.hora_ocorrencia : ''}\n`;
        block += `Impacto: ${item.impacto || 'Médio'} | Status: ${item.status}\n`;

        let desc = item.ocorrencia || '';
        if (item.comentario) {
          if (desc) {
            desc += desc.endsWith('.') || desc.endsWith(' ') ? ` ${item.comentario}` : `. ${item.comentario}`;
          } else {
            desc = item.comentario;
          }
        }
        block += `Descrição: ${desc}\n`;

        if (item.responsavel) {
          block += `Responsável: ${item.responsavel}\n`;
        }

        if (item.solucao) {
          block += `Solução: ${item.solucao}${item.responsavel_solucao ? ' (Por: ' + item.responsavel_solucao + ')' : ''}\n`;
        }

        return block.trimEnd();
      });

      body += itemBlocks.join('\n\n');
    }

    return { subject, body, selectedCount: count };
  };

  const copyToClipboard = async (text: string): Promise<boolean> => {
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (err) {
        console.warn('navigator.clipboard.writeText falhou, usando fallback execCommand:', err);
      }
    }

    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      return successful;
    } catch (err) {
      console.error('Fallback execCommand falhou:', err);
      return false;
    }
  };

  const handleOpenEmailModal = async () => {
    const allIds = displayedOcorrencias.map((item) => item.id);
    setSelectedEmailItemIds(allIds);
    setIsEmailModalOpen(true);
    setCopiedSnippet(false);

    const { subject, body } = getEmailContent();
    const success = await copyToClipboard(`Assunto: ${subject}\n\n${body}`);
    if (success) {
      setCopiedSnippet(true);
    }
  };


  const handleCopyEmailText = async () => {
    const { subject, body } = getEmailContent();
    const success = await copyToClipboard(`Assunto: ${subject}\n\n${body}`);
    if (success) {
      setCopiedSnippet(true);
      setTimeout(() => setCopiedSnippet(false), 3000);
    }
  };

  // Form Fields State
  const [formData, setFormData] = useState({
    data_ocorrencia: getBrasiliaDateString(),
    hora_ocorrencia: getBrasiliaTimeString(new Date(), false),
    produto: '',
    ocorrencia: '',
    impacto: 'Médio',
    tipo: 'Operacional' as 'Operacional' | 'Interna',
    comentario: '',
    status: 'Aberto' as DiarioBordoStatus,
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
      if (filtros.tipo && filtros.tipo !== 'Todos') params.append('tipo', filtros.tipo);
      if (filtros.busca) params.append('busca', filtros.busca);

      const [resOcorr, resProds, resUsers] = await Promise.all([
        fetch(`/api/diario-bordo?${params.toString()}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/produtos', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/usuarios', { headers: { Authorization: `Bearer ${token}` } })
      ]);

      if (resOcorr.ok) {
        const data = await resOcorr.json();
        setOcorrencias(data);
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
    const defaultTipo = activeTab === 'ocorrencias_internas' ? 'Interna' : 'Operacional';
    if (item) {
      setEditingItem(item);
      setFormData({
        data_ocorrencia: item.data_ocorrencia || getBrasiliaDateString(),
        hora_ocorrencia: item.hora_ocorrencia || getBrasiliaTimeString(new Date(), false),
        produto: item.produto || (produtos[0] || ''),
        ocorrencia: item.ocorrencia || '',
        impacto: item.impacto || 'Médio',
        tipo: item.tipo || 'Operacional',
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
        tipo: defaultTipo,
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
      formPayload.append('tipo', formData.tipo);
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
    if (displayedOcorrencias.length === 0) {
      alert('Nenhum registro para exportar.');
      return;
    }

    const exportData = displayedOcorrencias.map((item) => ({
      ID: item.id,
      Tipo: item.tipo || 'Operacional',
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
      tipo: 'Todos',
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
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto font-sans text-slate-800 dark:text-slate-100">
      {/* Title & Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 rounded-2xl bg-white dark:bg-slate-900 p-5 border border-slate-200/80 dark:border-slate-800 shadow-2xs dark:shadow-xl transition-colors duration-200">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-600 dark:bg-cyan-500 text-white dark:text-slate-950 rounded-xl shadow-md shadow-blue-600/20 dark:shadow-cyan-500/20">
            <BookOpen className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
              Diário de Bordo Operacional
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Registro, acompanhamento e solução de ocorrências que impactam a operação.
            </p>
          </div>
        </div>

        {/* View mode switcher */}
        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-950 p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 overflow-x-auto">
          <button
            onClick={() => setActiveTab('ocorrencias')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'ocorrencias'
                ? 'bg-white dark:bg-cyan-500 text-blue-600 dark:text-slate-950 shadow-xs font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <FileText className="h-4 w-4" />
            <span>Ocorrências</span>
          </button>
          <button
            onClick={() => setActiveTab('ocorrencias_internas')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'ocorrencias_internas'
                ? 'bg-purple-600 dark:bg-purple-500 text-white dark:text-slate-950 shadow-xs font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Shield className="h-4 w-4 text-purple-500 dark:text-purple-300" />
            <span>Ocorrências Internas</span>
          </button>
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'dashboard'
                ? 'bg-white dark:bg-cyan-500 text-blue-600 dark:text-slate-950 shadow-xs font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <BarChart2 className="h-4 w-4" />
            <span>Dashboard e Gráficos</span>
          </button>
        </div>
      </div>

      {/* CHARTS CONTAINER FOR PDF EXPORT */}
      <div ref={chartsContainerRef} className="space-y-6">
        {/* KPI SUMMARY METRICS CARDS */}
        {metrics && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
            <div className="rounded-2xl bg-white dark:bg-slate-900 p-5 border border-slate-200/80 dark:border-slate-800 shadow-2xs dark:shadow-xl flex items-center justify-between transition-colors duration-200">
              <div>
                <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Total Registros
                </p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                  {metrics.totalOcorrencias}
                </p>
              </div>
              <div className="p-3 bg-blue-50 dark:bg-cyan-500/10 text-blue-600 dark:text-cyan-400 border border-blue-100 dark:border-cyan-500/30 rounded-xl">
                <Layers className="h-5 w-5" />
              </div>
            </div>

            <div className="rounded-2xl bg-white dark:bg-slate-900 p-5 border border-slate-200/80 dark:border-slate-800 shadow-2xs dark:shadow-xl flex items-center justify-between transition-colors duration-200">
              <div>
                <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Abertas / Andamento
                </p>
                <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
                  {metrics.totalAbertas + metrics.totalEmAndamento}
                </p>
              </div>
              <div className="p-3 bg-amber-50 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800 rounded-xl">
                <Clock className="h-5 w-5" />
              </div>
            </div>

            <div className="rounded-2xl bg-white dark:bg-slate-900 p-5 border border-slate-200/80 dark:border-slate-800 shadow-2xs dark:shadow-xl flex items-center justify-between transition-colors duration-200">
              <div>
                <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Resolvidas
                </p>
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                  {metrics.totalResolvidas}
                </p>
              </div>
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 rounded-xl">
                <CheckCircle2 className="h-5 w-5" />
              </div>
            </div>

            <div className="rounded-2xl bg-white dark:bg-slate-900 p-5 border border-slate-200/80 dark:border-slate-800 shadow-2xs dark:shadow-xl flex items-center justify-between transition-colors duration-200">
              <div>
                <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Monitorando
                </p>
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-1">
                  {metrics.totalMonitorando}
                </p>
              </div>
              <div className="p-3 bg-purple-50 dark:bg-purple-950/80 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800 rounded-xl">
                <Eye className="h-5 w-5" />
              </div>
            </div>

            <div className="rounded-2xl bg-white dark:bg-slate-900 p-5 border border-slate-200/80 dark:border-slate-800 shadow-2xs dark:shadow-xl flex items-center justify-between col-span-2 md:col-span-1 transition-colors duration-200">
              <div>
                <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Tempo Médio Resolução
                </p>
                <p className="text-2xl font-bold text-blue-600 dark:text-cyan-400 mt-1">
                  {metrics.tempoMedioResolucoesHoras} h
                </p>
              </div>
              <div className="p-3 bg-blue-50 dark:bg-cyan-500/10 text-blue-600 dark:text-cyan-400 border border-blue-100 dark:border-cyan-500/30 rounded-xl">
                <TrendingUp className="h-5 w-5" />
              </div>
            </div>
          </div>
        )}

        {/* FILTERS BAR */}
        <div className="rounded-2xl bg-white dark:bg-slate-900 p-5 border border-slate-200/80 dark:border-slate-800 shadow-2xs dark:shadow-xl space-y-4 transition-colors duration-200">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-semibold text-sm">
              <Filter className="h-4 w-4 text-blue-600 dark:text-cyan-400" />
              <span>Filtros de Consulta</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleOpenModal()}
                className="flex items-center justify-center p-2.5 bg-blue-600 dark:bg-cyan-500 hover:bg-blue-700 dark:hover:bg-cyan-400 text-white dark:text-slate-950 rounded-xl transition-all shadow-md shadow-blue-600/20 dark:shadow-cyan-500/20 cursor-pointer active:scale-95"
                title="Novo Registro"
              >
                <Plus className="h-4.5 w-4.5" />
              </button>
              <button
                onClick={handleExportExcel}
                className="flex items-center justify-center p-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-all shadow-md shadow-emerald-600/20 cursor-pointer active:scale-95"
                title="Exportar Excel"
              >
                <FileSpreadsheet className="h-4.5 w-4.5" />
              </button>
              <button
                onClick={handleExportPDF}
                disabled={isExportingPDF}
                className="flex items-center justify-center p-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl transition-all shadow-md shadow-rose-600/20 cursor-pointer active:scale-95"
                title={isExportingPDF ? 'Gerando PDF...' : 'Exportar PDF'}
              >
                {isExportingPDF ? (
                  <Loader2 className="h-4.5 w-4.5 animate-spin" />
                ) : (
                  <FileDown className="h-4.5 w-4.5" />
                )}
              </button>
              {activeTab === 'ocorrencias' && (
                <button
                  onClick={handleOpenEmailModal}
                  className="flex items-center justify-center p-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl transition-all shadow-md shadow-purple-600/20 cursor-pointer active:scale-95"
                  title="Encaminhar E-mail"
                >
                  <Mail className="h-4.5 w-4.5" />
                </button>
              )}
              <button
                onClick={handleClearFilters}
                className="flex items-center justify-center p-2.5 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all cursor-pointer active:scale-95"
                title="Limpar todos os filtros"
              >
                <RotateCcw className="h-4.5 w-4.5" />
              </button>
            </div>
          </div>

          {/* Filter Inputs Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3">
            {/* Data Inicial */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                Data Inicial
              </label>
              <input
                type="date"
                value={filtros.dataInicial}
                onChange={(e) => setFiltros((prev) => ({ ...prev, dataInicial: e.target.value }))}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:border-blue-500 dark:focus:border-cyan-500 focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-cyan-500/30 outline-none transition"
              />
            </div>

            {/* Data Final */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                Data Final
              </label>
              <input
                type="date"
                value={filtros.dataFinal}
                onChange={(e) => setFiltros((prev) => ({ ...prev, dataFinal: e.target.value }))}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:border-blue-500 dark:focus:border-cyan-500 focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-cyan-500/30 outline-none transition"
              />
            </div>

            {/* Tipo de Ocorrência */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                Tipo
              </label>
              <select
                value={filtros.tipo || 'Todos'}
                onChange={(e) => setFiltros((prev) => ({ ...prev, tipo: e.target.value }))}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:border-blue-500 dark:focus:border-cyan-500 focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-cyan-500/30 outline-none transition"
              >
                <option value="Todos">Todos os Tipos</option>
                <option value="Operacional">Operacional</option>
                <option value="Interna">Interna</option>
              </select>
            </div>

            {/* Produto */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                Produto
              </label>
              <select
                value={filtros.produto}
                onChange={(e) => setFiltros((prev) => ({ ...prev, produto: e.target.value }))}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:border-blue-500 dark:focus:border-cyan-500 focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-cyan-500/30 outline-none transition"
              >
                <option value="Todos">Todos os Produtos</option>
                {produtos.map((p, idx) => (
                  <option key={`prod-${p}-${idx}`} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            {/* Status */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                Status
              </label>
              <select
                value={filtros.status}
                onChange={(e) => setFiltros((prev) => ({ ...prev, status: e.target.value }))}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:border-blue-500 dark:focus:border-cyan-500 focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-cyan-500/30 outline-none transition"
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
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                Responsável
              </label>
              <select
                value={filtros.responsavel}
                onChange={(e) => setFiltros((prev) => ({ ...prev, responsavel: e.target.value }))}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:border-blue-500 dark:focus:border-cyan-500 focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-cyan-500/30 outline-none transition"
              >
                <option value="Todos">Todos os Responsáveis</option>
                {usuariosList.map((u, idx) => (
                  <option key={`user-${u}-${idx}`} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>

            {/* Tipo de Impacto */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                Impacto
              </label>
              <select
                value={filtros.impacto}
                onChange={(e) => setFiltros((prev) => ({ ...prev, impacto: e.target.value }))}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:border-blue-500 dark:focus:border-cyan-500 focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-cyan-500/30 outline-none transition"
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
            <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400 dark:text-slate-500" />
            <input
              type="text"
              placeholder="Buscar por ocorrência, comentário, produto ou solução..."
              value={filtros.busca}
              onChange={(e) => setFiltros((prev) => ({ ...prev, busca: e.target.value }))}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
            />
          </div>
        </div>

        {/* MAIN TAB CONTENT - CHARTS */}
        {activeTab === 'dashboard' && metrics && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Chart 1: Produtos Mais Impactados */}
              <div className="rounded-2xl bg-white dark:bg-slate-900 p-5 border border-slate-200/80 dark:border-slate-800 shadow-2xs dark:shadow-xl">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <BarChart2 className="h-4 w-4 text-blue-600 dark:text-cyan-400" />
                  <span>Produtos Mais Impactados</span>
                </h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={metrics.produtosMaisImpactados} layout="vertical" margin={{ left: 20, right: 35 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} horizontal={false} />
                      <XAxis type="number" hide />
                      <YAxis dataKey="produto" type="category" width={110} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip />
                      <Bar dataKey="quantidade" fill="#06b6d4" radius={[0, 8, 8, 0]} name="Ocorrências">
                        <LabelList dataKey="quantidade" position="right" style={{ fontSize: '11px', fontWeight: 'bold', fill: '#0891b2' }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Chart 2: Sistemas Impactados (Pie Chart) */}
              <div className="rounded-2xl bg-white dark:bg-slate-900 p-5 border border-slate-200/80 dark:border-slate-800 shadow-2xs dark:shadow-xl">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <PieChartIcon className="h-4 w-4 text-indigo-500" />
                  <span>Sistemas Impactados</span>
                </h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={metrics.sistemasMaisImpactados}
                        dataKey="quantidade"
                        nameKey="sistema"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label={({ sistema, quantidade }) => `${sistema}: ${quantidade}`}
                      >
                        {metrics.sistemasMaisImpactados.map((entry, index) => (
                          <Cell key={`cell-sis-${index}`} fill={CHART_PIE_COLORS[index % CHART_PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value, name) => [`${value} ocorrências`, name]} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Chart 3: Ocorrências por Impacto */}
              <div className="rounded-2xl bg-white dark:bg-slate-900 p-5 border border-slate-200/80 dark:border-slate-800 shadow-2xs dark:shadow-xl">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                  <span>Gravidade / Tipo de Impacto</span>
                </h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={metrics.ocorrenciasPorImpacto} margin={{ top: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
                      <XAxis dataKey="impacto" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis hide />
                      <Tooltip />
                      <Bar dataKey="quantidade" name="Ocorrências" radius={[8, 8, 0, 0]}>
                        {metrics.ocorrenciasPorImpacto.map((entry, index) => {
                          let color = '#3b82f6';
                          if (entry.impacto === 'Médio') color = '#eab308';
                          if (entry.impacto === 'Alto') color = '#f97316';
                          if (entry.impacto === 'Crítico') color = '#ef4444';
                          return <Cell key={`cell-imp-${index}`} fill={color} />;
                        })}
                        <LabelList dataKey="quantidade" position="top" style={{ fontSize: '11px', fontWeight: 'bold', fill: '#475569' }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Chart 4: Evolução Mensal */}
              <div className="rounded-2xl bg-white dark:bg-slate-900 p-5 border border-slate-200/80 dark:border-slate-800 shadow-2xs dark:shadow-xl">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-emerald-500" />
                  <span>Evolução por Mês</span>
                </h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={metrics.ocorrenciasPorMes} margin={{ top: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
                      <XAxis dataKey="mes" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis hide />
                      <Tooltip />
                      <Area type="monotone" dataKey="quantidade" stroke="#10b981" fill="#10b981" fillOpacity={0.2} name="Ocorrências">
                        <LabelList dataKey="quantidade" position="top" style={{ fontSize: '11px', fontWeight: 'bold', fill: '#059669' }} />
                      </Area>
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Chart 5: Registros por Período (Manhã x Tarde) */}
              <div className="rounded-2xl bg-white dark:bg-slate-900 p-5 border border-slate-200/80 dark:border-slate-800 shadow-2xs dark:shadow-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-4">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Sun className="h-4 w-4 text-amber-500" />
                    <span>Registros por Turno (Manhã x Tarde)</span>
                  </h3>
                  <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full self-start sm:self-auto">
                    Manhã ≤ 11:59 | Tarde ≥ 12:00
                  </span>
                </div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={metrics.ocorrenciasPorTurno || []} margin={{ top: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
                      <XAxis dataKey="turno" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis hide />
                      <Tooltip formatter={(value) => [`${value} registros`, 'Quantidade']} />
                      <Bar dataKey="quantidade" name="Registros" radius={[8, 8, 0, 0]}>
                        {(metrics.ocorrenciasPorTurno || []).map((entry, index) => (
                          <Cell
                            key={`cell-turno-${index}`}
                            fill={entry.turno.toLowerCase().includes('manhã') ? '#0284c7' : '#f97316'}
                          />
                        ))}
                        <LabelList dataKey="quantidade" position="top" style={{ fontSize: '11px', fontWeight: 'bold', fill: '#475569' }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Chart 6: Tempo Médio de Resolução por Produto */}
              <div className="rounded-2xl bg-white dark:bg-slate-900 p-5 border border-slate-200/80 dark:border-slate-800 shadow-2xs dark:shadow-xl">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-purple-500" />
                  <span>Tempo Médio de Resolução por Produto (Horas)</span>
                </h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={metrics.tempoMedioPorProduto} margin={{ top: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
                      <XAxis dataKey="produto" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis hide />
                      <Tooltip formatter={(value) => [`${value} horas`, 'Tempo Médio']} />
                      <Bar dataKey="tempoMedioHoras" fill="#8b5cf6" radius={[8, 8, 0, 0]} name="Horas até Solução">
                        <LabelList dataKey="tempoMedioHoras" position="top" formatter={(val: any) => `${val}h`} style={{ fontSize: '11px', fontWeight: 'bold', fill: '#7c3aed' }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* TABLE VIEW */}
      {activeTab !== 'dashboard' && (
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs dark:shadow-xl overflow-hidden transition-colors duration-200">
          {loading ? (
            <div className="p-12 text-center text-slate-500 dark:text-slate-400">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-600 dark:border-cyan-400 border-t-transparent mb-3"></div>
              <p className="text-sm font-medium">Carregando Diário de Bordo...</p>
            </div>
          ) : error ? (
            <div className="p-8 text-center text-red-600 dark:text-red-400 font-medium">
              {error}
            </div>
          ) : displayedOcorrencias.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <BookOpen className="h-10 w-10 text-slate-300 dark:text-slate-600 mx-auto" />
              <p className="text-slate-600 dark:text-slate-400 font-medium text-sm">
                Nenhuma ocorrência encontrada nesta categoria ou com os filtros selecionados.
              </p>
              <button
                onClick={() => handleOpenModal()}
                className="inline-flex items-center gap-2 bg-blue-600 dark:bg-cyan-500 hover:bg-blue-700 dark:hover:bg-cyan-400 text-white dark:text-slate-950 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>Registrar Nova Ocorrência</span>
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="p-3.5 pl-5">Data/Hora</th>
                    <th className="p-3.5">Produto</th>
                    <th className="p-3.5">{activeTab === 'ocorrencias' ? 'Sistema Impactado' : 'Ocorrência'}</th>
                    <th className="p-3.5">Impacto</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5">Responsável</th>
                    <th className="p-3.5">Solução / Resolução</th>
                    <th className="p-3.5 text-center">Evidência</th>
                    <th className="p-3.5 text-center">Linha do Tempo</th>
                    <th className="p-3.5 pr-5 text-center sticky right-0 bg-slate-50 dark:bg-slate-950 border-l border-slate-200 dark:border-slate-800 shadow-2xs z-10">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                  {displayedOcorrencias.map((item) => {
                    const statusConfig = STATUS_COLORS[item.status] || STATUS_COLORS['Aberto'];
                    const impactoConfig = IMPACTO_COLORS[item.impacto] || IMPACTO_COLORS['Médio'];
                    const isInterna = (item.tipo || 'Operacional') === 'Interna';

                    return (
                      <tr
                        key={item.id}
                        onDoubleClick={() => handleOpenModal(item)}
                        className="group hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
                        title="Dê duplo clique para editar esta ocorrência"
                      >
                        {/* Data / Hora */}
                        <td className="p-3.5 pl-5 whitespace-nowrap">
                          <div className="font-semibold text-slate-900 dark:text-slate-200">
                            {item.data_ocorrencia}
                          </div>
                          <div className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">
                            {item.hora_ocorrencia}
                          </div>
                        </td>

                        {/* Produto */}
                        <td className="p-3.5 font-medium text-slate-900 dark:text-slate-200 whitespace-nowrap">
                          {item.produto}
                        </td>

                        {/* Ocorrência & Comentários */}
                        <td className="p-3.5 max-w-xs">
                          <div className="font-semibold text-slate-900 dark:text-slate-100 line-clamp-1">
                            {item.ocorrencia}
                          </div>
                          {item.comentario && (
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">
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
                        <td className="p-3.5 font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap" title={item.responsavel}>
                          {formatFirstAndLastName(item.responsavel)}
                        </td>

                        {/* Solução */}
                        <td className="p-3.5 max-w-xs">
                          {item.solucao ? (
                            <div>
                              <div className="text-slate-800 dark:text-slate-200 font-medium line-clamp-1">
                                {item.solucao}
                              </div>
                              <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold" title={item.responsavel_solucao}>
                                {formatFirstAndLastName(item.responsavel_solucao)} ({item.data_solucao})
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-400 dark:text-slate-500 italic text-[11px]">Pendente</span>
                          )}
                        </td>

                        {/* Evidência */}
                        <td className="p-3.5 text-center whitespace-nowrap">
                          {item.caminho_evidencia ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setViewImageModal({
                                  isOpen: true,
                                  url: item.caminho_evidencia!,
                                  title: `Evidência - ${item.produto} (${item.data_ocorrencia})`
                                });
                              }}
                              className="p-1.5 text-blue-600 dark:text-cyan-400 hover:bg-blue-50 dark:hover:bg-cyan-500/20 rounded-lg transition-colors cursor-pointer inline-flex items-center justify-center"
                              title="Ver foto da evidência"
                            >
                              <ImageIcon className="h-4 w-4" />
                            </button>
                          ) : (
                            <span className="text-slate-300 dark:text-slate-600 text-xs">-</span>
                          )}
                        </td>

                        {/* Linha do Tempo */}
                        <td className="p-3.5 text-center whitespace-nowrap">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenModal(item, 'historico');
                            }}
                            className="p-1.5 text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-cyan-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer inline-flex items-center justify-center"
                            title="Ver Linha do Tempo"
                          >
                            <Eye className="h-4 w-4 text-blue-600 dark:text-cyan-400" />
                          </button>
                        </td>

                        {/* Actions (Sticky Column on Right) */}
                        <td className="p-3.5 pr-5 text-center whitespace-nowrap sticky right-0 bg-white group-hover:bg-slate-50 dark:bg-slate-900 dark:group-hover:bg-slate-800 border-l border-slate-200 dark:border-slate-800 z-10">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenModal(item, 'dados');
                              }}
                              className="p-1.5 text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-cyan-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                              title="Editar Ocorrência"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(item.id);
                              }}
                              className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-lg transition-colors cursor-pointer"
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
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl overflow-hidden my-8">
            {/* Modal Header */}
            <div className="bg-slate-50 dark:bg-slate-950 px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-600 dark:bg-cyan-500 text-white dark:text-slate-950 rounded-xl">
                  {modalActiveTab === 'historico' ? (
                    <History className="h-5 w-5" />
                  ) : (
                    <BookOpen className="h-5 w-5" />
                  )}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {modalActiveTab === 'historico'
                      ? `Linha do Tempo - Ocorrência #${editingItem?.id}`
                      : editingItem
                      ? `Editar Ocorrência #${editingItem.id}`
                      : 'Novo Registro no Diário de Bordo'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {modalActiveTab === 'historico'
                      ? 'Histórico de alterações e eventos da ocorrência'
                      : 'Preencha as informações detalhadas da ocorrência operacional'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg cursor-pointer"
              >
                <XCircle className="h-6 w-6" />
              </button>
            </div>

            {/* Modal Tabs Navigation */}
            <div className="flex items-center border-b border-slate-200 dark:border-slate-800 px-6 bg-slate-50/50 dark:bg-slate-950/50">
              {modalActiveTab === 'historico' ? (
                <button
                  type="button"
                  className="px-4 py-2.5 text-xs font-bold border-b-2 border-blue-600 dark:border-cyan-400 text-blue-600 dark:text-cyan-400 cursor-default"
                >
                  Linha do Tempo
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setModalActiveTab('dados')}
                    className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                      modalActiveTab === 'dados'
                        ? 'border-blue-600 dark:border-cyan-400 text-blue-600 dark:text-cyan-400'
                        : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    1. Dados da Ocorrência
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalActiveTab('solucao')}
                    className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                      modalActiveTab === 'solucao'
                        ? 'border-blue-600 dark:border-cyan-400 text-blue-600 dark:text-cyan-400'
                        : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
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
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Data da Ocorrência *
                      </label>
                      <input
                        type="date"
                        required
                        value={formData.data_ocorrencia}
                        onChange={(e) => setFormData((prev) => ({ ...prev, data_ocorrencia: e.target.value }))}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-800 dark:text-slate-200 focus:border-blue-500 dark:focus:border-cyan-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Hora da Ocorrência *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="HH:mm"
                        value={formData.hora_ocorrencia}
                        onChange={(e) => setFormData((prev) => ({ ...prev, hora_ocorrencia: e.target.value }))}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-800 dark:text-slate-200 focus:border-blue-500 dark:focus:border-cyan-500 focus:ring-2 focus:ring-blue-500/20 outline-none font-mono"
                      />
                    </div>
                  </div>

                  {/* Grid 2: Produto, Tipo & Impacto */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Produto *
                      </label>
                      <select
                        required
                        value={formData.produto}
                        onChange={(e) => setFormData((prev) => ({ ...prev, produto: e.target.value }))}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-800 dark:text-slate-200 focus:border-blue-500 dark:focus:border-cyan-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
                      >
                        <option value="">Selecione o produto...</option>
                        {produtos.map((p, idx) => (
                          <option key={`modal-prod-${p}-${idx}`} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Tipo de Ocorrência *
                      </label>
                      <select
                        required
                        value={formData.tipo}
                        onChange={(e) => setFormData((prev) => ({ ...prev, tipo: e.target.value as 'Operacional' | 'Interna' }))}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-800 dark:text-slate-200 focus:border-blue-500 dark:focus:border-cyan-500 focus:ring-2 focus:ring-blue-500/20 outline-none font-semibold text-blue-600 dark:text-cyan-400"
                      >
                        <option value="Operacional">Operacional</option>
                        <option value="Interna">Interna</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Tipo de Impacto *
                      </label>
                      <select
                        required
                        value={formData.impacto}
                        onChange={(e) => setFormData((prev) => ({ ...prev, impacto: e.target.value }))}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-800 dark:text-slate-200 focus:border-blue-500 dark:focus:border-cyan-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
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
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {formData.tipo === 'Operacional' ? 'Sistema Impactado *' : 'Descrição da Ocorrência *'}
                    </label>
                    <input
                      type="text"
                      required
                      placeholder={formData.tipo === 'Operacional' ? 'Ex: INSTABILIDADE INTERGRALL, Telefonia...' : 'Ex: Descrição da ocorrência...'}
                      value={formData.ocorrencia}
                      onChange={(e) => setFormData((prev) => ({ ...prev, ocorrencia: e.target.value }))}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-800 dark:text-slate-200 focus:border-blue-500 dark:focus:border-cyan-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
                    />
                  </div>

                  {/* Responsável & Status */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Responsável pela Ocorrência *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.responsavel}
                        onChange={(e) => setFormData((prev) => ({ ...prev, responsavel: e.target.value }))}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-800 dark:text-slate-200 focus:border-blue-500 dark:focus:border-cyan-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Status
                      </label>
                      <select
                        value={formData.status}
                        onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value }))}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-800 dark:text-slate-200 focus:border-blue-500 dark:focus:border-cyan-500 focus:ring-2 focus:ring-blue-500/20 outline-none font-semibold"
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
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                        {formData.tipo === 'Operacional' ? 'Descrição da Ocorrência' : 'Observações / Detalhes Adicionais'}
                      </label>
                      <span className="text-[11px] text-slate-400 dark:text-slate-500">
                        {formData.comentario.length}/2000 caracteres
                      </span>
                    </div>
                    <textarea
                      rows={3}
                      maxLength={2000}
                      placeholder={formData.tipo === 'Operacional' ? 'Descreva os detalhes da ocorrência...' : 'Descreva mais detalhes sobre o evento (opcional)...'}
                      value={formData.comentario}
                      onChange={(e) => setFormData((prev) => ({ ...prev, comentario: e.target.value }))}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs text-slate-800 dark:text-slate-200 focus:border-blue-500 dark:focus:border-cyan-500 focus:ring-2 focus:ring-blue-500/20 outline-none resize-none"
                    />
                  </div>

                  {/* Evidência (Anexo ou Print) */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Evidência de Print / Anexo (Cole Ctrl+V ou selecione o arquivo)
                    </label>

                    {evidencePreview ? (
                      <div className="relative group border border-slate-200 dark:border-slate-800 rounded-xl p-2 bg-slate-50 dark:bg-slate-950 flex items-center gap-3">
                        <img
                          src={evidencePreview}
                          alt="Evidência"
                          className="h-16 w-24 object-cover rounded-lg border border-slate-200 dark:border-slate-800"
                        />
                        <div className="flex-1 overflow-hidden">
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                            {formData.nome_evidencia || 'evidencia_anexada.png'}
                          </p>
                          <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
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
                          className="p-1.5 bg-red-50 dark:bg-red-950/50 hover:bg-red-100 dark:hover:bg-red-900 text-red-600 dark:text-red-400 rounded-lg text-xs font-semibold cursor-pointer"
                        >
                          Remover
                        </button>
                      </div>
                    ) : (
                      <label className="border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-blue-500 dark:hover:border-cyan-500 rounded-xl p-4 flex flex-col items-center justify-center gap-2 cursor-pointer bg-slate-50/50 dark:bg-slate-950/50 transition-colors">
                        <Upload className="h-6 w-6 text-slate-400 dark:text-slate-500" />
                        <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                          Clique para selecionar arquivo ou cole com <kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-800 dark:text-slate-300 rounded text-[10px]">Ctrl + V</kbd>
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
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-800 dark:text-emerald-300">
                    Registre a solução definitiva ou contorno para a ocorrência operacional. Ao salvar com a solução, altere o status para <strong>Resolvido</strong>.
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Data da Solução
                      </label>
                      <input
                        type="date"
                        value={formData.data_solucao}
                        onChange={(e) => setFormData((prev) => ({ ...prev, data_solucao: e.target.value }))}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-800 dark:text-slate-200 focus:border-blue-500 dark:focus:border-cyan-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Hora da Solução
                      </label>
                      <input
                        type="text"
                        placeholder="HH:mm"
                        value={formData.hora_solucao}
                        onChange={(e) => setFormData((prev) => ({ ...prev, hora_solucao: e.target.value }))}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-800 dark:text-slate-200 focus:border-blue-500 dark:focus:border-cyan-500 focus:ring-2 focus:ring-blue-500/20 outline-none font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Responsável pela Solução
                    </label>
                    <input
                      type="text"
                      placeholder="Nome do operador ou especialista que resolveu"
                      value={formData.responsavel_solucao}
                      onChange={(e) => setFormData((prev) => ({ ...prev, responsavel_solucao: e.target.value }))}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-800 dark:text-slate-200 focus:border-blue-500 dark:focus:border-cyan-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Descrição da Solução Aplicada
                    </label>
                    <textarea
                      rows={4}
                      placeholder="Descreva detalhadamente a ação corretiva adotada..."
                      value={formData.solucao}
                      onChange={(e) => setFormData((prev) => ({ ...prev, solucao: e.target.value }))}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs text-slate-800 dark:text-slate-200 focus:border-blue-500 dark:focus:border-cyan-500 focus:ring-2 focus:ring-blue-500/20 outline-none resize-none"
                    />
                  </div>
                </div>
              )}

              {/* Tab Histórico e Timeline */}
              {modalActiveTab === 'historico' && (
                <div className="space-y-4 max-h-[28rem] overflow-y-auto pr-1">
                  {/* Quadro Resumo Elegante */}
                  {editingItem && (
                    <div className="bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 rounded-xl p-3.5 space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/60 dark:border-slate-800 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-cyan-400 border border-blue-200/60 dark:border-cyan-900/50">
                            {editingItem.tipo || 'Operacional'}
                          </span>
                          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                            {editingItem.data_ocorrencia} {editingItem.hora_ocorrencia && `às ${editingItem.hora_ocorrencia}`}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${IMPACTO_COLORS[editingItem.impacto]?.badge || 'bg-slate-100 text-slate-700'}`}>
                            Impacto: {editingItem.impacto || 'Médio'}
                          </span>
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${STATUS_COLORS[editingItem.status]?.badge || 'bg-slate-100 text-slate-700'}`}>
                            {editingItem.status}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-1.5 text-xs">
                        <div>
                          <span className="text-[10px] font-bold tracking-wider uppercase text-blue-600 dark:text-cyan-400 block mb-0.5">
                            {(editingItem.tipo || 'Operacional') === 'Operacional' ? 'Sistema Impactado' : 'Ocorrência'}
                          </span>
                          <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                            {editingItem.ocorrencia}
                          </h4>
                        </div>

                        {editingItem.comentario && (
                          <div className="pt-1">
                            <span className="text-[10px] font-bold tracking-wider uppercase text-slate-400 dark:text-slate-500 block mb-0.5">
                              {(editingItem.tipo || 'Operacional') === 'Operacional' ? 'Descrição da Ocorrência' : 'Observações / Detalhes Adicionais'}
                            </span>
                            <p className="text-slate-700 dark:text-slate-300 text-xs leading-relaxed">
                              {editingItem.comentario}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 pt-1">
                    <History className="h-4 w-4 text-blue-600 dark:text-cyan-400" />
                    <span>Linha do Tempo e Histórico de Alterações</span>
                  </div>

                  {itemHistorico.length === 0 ? (
                    <p className="text-xs text-slate-500 dark:text-slate-400 italic">Nenhum histórico registrado.</p>
                  ) : (
                    <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
                      {itemHistorico.map((h) => (
                        <div key={h.id} className="relative bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 text-xs space-y-1.5">
                          <span className="absolute -left-6 top-3 h-2.5 w-2.5 rounded-full bg-blue-600 dark:bg-cyan-400 ring-4 ring-white dark:ring-slate-900" />
                          <div className="flex items-center justify-between font-bold text-slate-900 dark:text-white">
                            <span>{h.tipo_alteracao}</span>
                            <span className="text-[10px] text-slate-400 font-mono">{h.data_hora}</span>
                          </div>
                          <p className="text-slate-600 dark:text-slate-300">{h.descricao}</p>
                          {h.tipo_alteracao === 'Criação' && editingItem && !h.descricao.includes('Ocorrência:') && (
                            <div className="mt-1.5 p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 shadow-2xs space-y-1">
                              <div className="text-xs font-semibold text-slate-900 dark:text-white">
                                <span className="text-blue-600 dark:text-cyan-400 font-bold">
                                  {(editingItem.tipo || 'Operacional') === 'Operacional' ? 'Sistema Impactado:' : 'Ocorrência:'}
                                </span> {editingItem.ocorrencia}
                              </div>
                              {editingItem.comentario && (
                                <div className="text-[11px] text-slate-600 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800">
                                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                                    {(editingItem.tipo || 'Operacional') === 'Operacional' ? 'Descrição:' : 'Obs:'}
                                  </span> {editingItem.comentario}
                                </div>
                              )}
                            </div>
                          )}
                          <div className="text-[10px] text-slate-400 dark:text-slate-500 font-medium pt-0.5">
                            Por: <strong className="text-slate-700 dark:text-slate-300" title={h.usuario}>{formatFirstAndLastName(h.usuario)}</strong>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                {modalActiveTab === 'historico' ? (
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-5 py-2 bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 dark:hover:bg-slate-600 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
                  >
                    Fechar
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="flex items-center gap-2 bg-blue-600 dark:bg-cyan-500 hover:bg-blue-700 dark:hover:bg-cyan-400 text-white dark:text-slate-950 px-5 py-2 rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-600/20 dark:shadow-cyan-500/20 disabled:opacity-50 cursor-pointer"
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

      {/* MODAL ENCAMINHAR E-MAIL */}
      {isEmailModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl overflow-hidden">
            <div className="bg-slate-50 dark:bg-slate-950 px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-purple-100 dark:bg-purple-950/80 text-purple-600 dark:text-purple-400 rounded-xl">
                  <Mail className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Encaminhar Relatório por E-mail
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Copie o resumo formatado das ocorrências selecionadas para a área de transferência
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyEmailText}
                  title={copiedSnippet ? 'Copiado!' : 'Copiar resumo para área de transferência'}
                  className={`p-2 rounded-xl border flex items-center justify-center transition-all cursor-pointer ${
                    copiedSnippet
                      ? 'bg-emerald-100 dark:bg-emerald-950/80 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 ring-2 ring-emerald-500/20'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600 shadow-xs active:scale-95'
                  }`}
                >
                  {copiedSnippet ? (
                    <Check className="h-5 w-5 text-emerald-600 dark:text-emerald-300" />
                  ) : (
                    <Copy className="h-5 w-5" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setIsEmailModalOpen(false)}
                  className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-200/50 dark:hover:bg-slate-800 transition cursor-pointer"
                  title="Fechar"
                >
                  <XCircle className="h-6 w-6" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {/* Feedback Alert quando enviado / processado */}
              {emailStatusFeedback && (
                <div className="bg-blue-50 dark:bg-cyan-950/60 border border-blue-200 dark:border-cyan-800 p-3 rounded-xl flex items-center justify-between gap-2.5 text-xs font-bold text-blue-800 dark:text-cyan-300 animate-in fade-in">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4.5 w-4.5 text-blue-600 dark:text-cyan-400 shrink-0" />
                    <span>{emailStatusFeedback}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEmailStatusFeedback(null)}
                    className="text-blue-500 hover:text-blue-700 dark:text-cyan-400 p-0.5 rounded cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}

              {/* Cadastrar e Gerenciar Destinatários (Para:) */}
              <div className="space-y-2 bg-slate-50 dark:bg-slate-950/60 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <AtSign className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                    <span>Destinatários do E-mail (Para:)</span>
                  </label>
                  {emailRecipients.length > 0 && (
                    <button
                      type="button"
                      onClick={toggleSelectAllRecipients}
                      className="text-[11px] font-bold text-blue-600 dark:text-cyan-400 hover:underline cursor-pointer"
                    >
                      {selectedEmailRecipients.length === emailRecipients.length
                        ? 'Desmarcar Todos'
                        : `Selecionar Todos (${emailRecipients.length})`}
                    </button>
                  )}
                </div>

                {/* Campo para Cadastrar Novo Destinatário */}
                <div className="flex items-center gap-2">
                  <input
                    type="email"
                    placeholder="Cadastrar novo e-mail (ex: gestao@empresa.com.br)..."
                    value={newRecipientInput}
                    onChange={(e) => setNewRecipientInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddRecipient();
                      }
                    }}
                    className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-purple-500 font-medium transition"
                  />
                  <button
                    type="button"
                    onClick={handleAddRecipient}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer shrink-0"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    <span>Adicionar</span>
                  </button>
                </div>

                {/* Lista de Destinatários Cadastrados */}
                {emailRecipients.length > 0 ? (
                  <div className="flex flex-wrap gap-2 max-h-28 overflow-y-auto p-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                    {emailRecipients.map((email) => {
                      const isSelected = selectedEmailRecipients.includes(email);
                      return (
                        <div
                          key={`recipient-item-${email}`}
                          className={`flex items-center gap-2 px-2.5 py-1 rounded-lg text-xs transition border ${
                            isSelected
                              ? 'bg-purple-50 dark:bg-purple-950/80 border-purple-300 dark:border-purple-700 text-purple-900 dark:text-purple-200 font-semibold'
                              : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 opacity-60'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleRecipientSelection(email)}
                            className="h-3.5 w-3.5 rounded border-slate-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
                          />
                          <span>{email}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveRecipient(email)}
                            className="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 p-0.5 rounded cursor-pointer ml-1"
                            title="Remover destinatário"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-400 italic">Nenhum destinatário cadastrado. Adicione e-mails acima para salvar na lista.</p>
                )}
              </div>

              {/* Seleção de Ocorrências */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Selecione as Ocorrências a Incluir no E-mail
                  </label>
                  <button
                    type="button"
                    onClick={toggleSelectAllEmailItems}
                    className="text-[11px] font-bold text-blue-600 dark:text-cyan-400 hover:underline cursor-pointer"
                  >
                    {selectedEmailItemIds.length === displayedOcorrencias.length
                      ? 'Desmarcar Todos'
                      : `Selecionar Todos (${displayedOcorrencias.length})`}
                  </button>
                </div>

                <div className="max-h-36 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-2 divide-y divide-slate-100 dark:divide-slate-800/80">
                  {displayedOcorrencias.length === 0 ? (
                    <p className="text-xs text-slate-500 italic p-2">Nenhuma ocorrência disponível.</p>
                  ) : (
                    displayedOcorrencias.map((item) => {
                      const isSelected = selectedEmailItemIds.includes(item.id);
                      return (
                        <label
                          key={`select-email-item-${item.id}`}
                          className={`flex items-center gap-3 p-2 rounded-lg text-xs transition cursor-pointer ${
                            isSelected
                              ? 'bg-blue-50/70 dark:bg-slate-900/80 font-medium text-slate-900 dark:text-white'
                              : 'hover:bg-slate-100/70 dark:hover:bg-slate-900/40 text-slate-500 dark:text-slate-400 opacity-60'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleEmailItemSelection(item.id)}
                            className="h-4 w-4 rounded-md border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:focus:ring-cyan-500 cursor-pointer"
                          />
                          <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
                            <span className="truncate font-semibold text-xs text-slate-800 dark:text-slate-200">
                              {item.ocorrencia}
                            </span>
                            <div className="flex items-center gap-1.5 shrink-0 text-[10px]">
                              <span className="text-slate-400 dark:text-slate-500 font-mono">
                                {item.data_ocorrencia}
                              </span>
                              <span className={`px-1.5 py-0.5 rounded-md font-bold ${IMPACTO_COLORS[item.impacto]?.badge || 'bg-slate-100 text-slate-700'}`}>
                                {item.impacto || 'Médio'}
                              </span>
                            </div>
                          </div>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Assunto */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Assunto do E-mail
                </label>
                <input
                  type="text"
                  readOnly
                  value={getEmailContent().subject}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-800 dark:text-slate-200 outline-none font-medium"
                />
              </div>

              {/* Corpo */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Corpo da Mensagem ({getEmailContent().selectedCount} de {displayedOcorrencias.length} selecionado(s))
                  </label>
                </div>
                <textarea
                  rows={5}
                  readOnly
                  value={getEmailContent().body}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs text-slate-800 dark:text-slate-200 outline-none font-mono resize-none"
                />
              </div>

              {/* Rodapé com botões de Ação */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsEmailModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Fechar
                </button>
                <button
                  type="button"
                  onClick={handleSendEmail}
                  disabled={isSendingEmail}
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-purple-600 hover:bg-purple-700 active:scale-98 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition shadow-md shadow-purple-600/20 cursor-pointer"
                >
                  {isSendingEmail ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  <span>{isSendingEmail ? 'Enviando...' : 'Enviar E-mail'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
