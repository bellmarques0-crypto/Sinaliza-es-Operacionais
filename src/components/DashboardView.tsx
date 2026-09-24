import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Filter,
  FileSpreadsheet,
  FileDown,
  Loader2,
  Users,
  UserX,
  UserCheck,
  AlertTriangle,
  RotateCcw,
  Search,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Clock,
  Sparkles,
  CheckCircle2,
  Repeat,
  ListFilter,
  LayoutDashboard,
  Eye,
  Flame,
  ShieldAlert,
  Copy,
  Check,
  FileText
} from 'lucide-react';
import {
  AreaChart,
  Area,
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
  Legend,
  LabelList
} from 'recharts';
import { api } from '../services/api';
import { DashboardMetrics, Supervisor, Produto, Operador, Sinalizacao, UserSession } from '../types';
import { exportDashboardToExcel } from '../utils/excelExport';
import { exportDashboardToPDF } from '../utils/pdfExport';
import { getBrasiliaDateString, getBrasiliaDateParts, getSinalizacaoStartMs, getSinalizacaoEndMs, formatTempoMedioDisplay, isSupervisorMatch } from '../utils/dateUtils';

const PIE_COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

const formatSupervisorName = (fullName: string) => {
  if (!fullName) return '';
  const parts = fullName.trim().split(/\s+/);
  if (parts.length <= 2) return fullName;
  const cleanParts = parts.filter(
    (p) => !['DE', 'DA', 'DO', 'DOS', 'DAS'].includes(p.toUpperCase())
  );
  if (cleanParts.length >= 2) {
    return `${cleanParts[0]} ${cleanParts[cleanParts.length - 1]}`;
  }
  return parts.slice(0, 2).join(' ');
};

const renderBoldText = (text: string) => {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="font-black text-slate-900 dark:text-slate-100">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
};

const renderFormattedMarkdown = (content: string) => {
  if (!content) return null;
  const lines = content.split('\n');

  return (
    <div className="space-y-3 text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-sans">
      {lines.map((line, idx) => {
        const trimmed = line.trim();

        if (trimmed.startsWith('### ')) {
          return (
            <h3 key={idx} className="text-sm sm:text-base font-black text-slate-900 dark:text-slate-100 mt-4 mb-2 flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-1.5 uppercase tracking-wide">
              {trimmed.replace('### ', '')}
            </h3>
          );
        }

        if (trimmed.startsWith('#### ')) {
          return (
            <h4 key={idx} className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-blue-600 dark:text-cyan-400 mt-3 mb-1">
              {trimmed.replace('#### ', '')}
            </h4>
          );
        }

        if (trimmed.startsWith('- ') || trimmed.startsWith('• ') || trimmed.startsWith('  • ')) {
          const bulletText = trimmed.replace(/^(\s*[-•]\s*)/, '');
          return (
            <div key={idx} className="flex items-start gap-2 pl-3">
              <span className="text-amber-500 font-bold">•</span>
              <span>{renderBoldText(bulletText)}</span>
            </div>
          );
        }

        if (/^\d+\.\s/.test(trimmed)) {
          const num = trimmed.match(/^(\d+)\.\s/)?.[1];
          const textWithoutNum = trimmed.replace(/^\d+\.\s/, '');
          return (
            <div key={idx} className="flex items-start gap-2.5 pl-3 py-0.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-blue-600 dark:text-cyan-400 text-[10px] font-black border border-blue-500/20">
                {num}
              </span>
              <span className="pt-0.5">{renderBoldText(textWithoutNum)}</span>
            </div>
          );
        }

        if (!trimmed) {
          return <div key={idx} className="h-1" />;
        }

        return (
          <p key={idx} className="text-xs sm:text-sm text-slate-700 dark:text-slate-300">
            {renderBoldText(trimmed)}
          </p>
        );
      })}
    </div>
  );
};

// Helper function to compute complete executive metrics directly from the sinalizações list
function computeMetricsFromSinalizacoes(
  rawList: Sinalizacao[],
  totalMotivosCadastrados: number,
  dataInicial?: string,
  dataFinal?: string
): DashboardMetrics {
  // Helper functions for date & hour parsing (handles JS Date objects & ISO/string formats)
  const parseSinalizacaoDate = (s: any): { dateKey: string; displayLabel: string } | null => {
    if (!s) return null;
    const val = s.data || s.data_cadastro;
    if (!val) return null;

    let d: Date | null = null;
    if (val instanceof Date) {
      d = val;
    } else {
      const str = String(val).trim();
      if (!str) return null;

      if (str.includes('T')) {
        const isoPart = str.split('T')[0];
        const p = isoPart.split('-');
        if (p.length === 3) {
          return { dateKey: isoPart, displayLabel: `${p[2]}/${p[1]}` };
        }
      }
      if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
        const datePart = str.substring(0, 10);
        const p = datePart.split('-');
        return { dateKey: datePart, displayLabel: `${p[2]}/${p[1]}` };
      }
      if (/^\d{2}\/\d{2}\/\d{4}/.test(str)) {
        const p = str.substring(0, 10).split('/');
        return { dateKey: `${p[2]}-${p[1]}-${p[0]}`, displayLabel: `${p[0]}/${p[1]}` };
      }

      const p = new Date(str);
      if (!isNaN(p.getTime())) {
        d = p;
      }
    }

    if (d && !isNaN(d.getTime())) {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return { dateKey: `${yyyy}-${mm}-${dd}`, displayLabel: `${dd}/${mm}` };
    }

    return null;
  };

  const parseSinalizacaoHour = (s: any): string | null => {
    if (!s) return null;

    if (s.hora !== undefined && s.hora !== null) {
      const rawHora = String(s.hora).trim();
      if (rawHora) {
        const matchColon = rawHora.match(/^(\d{1,2}):/);
        if (matchColon) {
          const hNum = parseInt(matchColon[1], 10);
          if (!isNaN(hNum) && hNum >= 0 && hNum <= 23) {
            return `${String(hNum).padStart(2, '0')}h`;
          }
        }
        const matchH = rawHora.match(/^(\d{1,2})/);
        if (matchH) {
          const hNum = parseInt(matchH[1], 10);
          if (!isNaN(hNum) && hNum >= 0 && hNum <= 23) {
            return `${String(hNum).padStart(2, '0')}h`;
          }
        }
      }
    }

    const val = s.data_cadastro || s.data;
    if (!val) return null;

    let d: Date | null = null;
    if (val instanceof Date) {
      d = val;
    } else {
      const str = String(val).trim();
      if (str.includes('T') || str.includes(' ') || str.includes(':')) {
        const p = new Date(str);
        if (!isNaN(p.getTime())) {
          d = p;
        }
      }
    }

    if (d && !isNaN(d.getTime())) {
      const hNum = d.getHours();
      return `${String(hNum).padStart(2, '0')}h`;
    }

    return null;
  };

  // If user did NOT specify date filters: metrics use current month (YYYY-MM), table summary uses current day (YYYY-MM-DD)
  let list = rawList;
  let tabelaList = rawList;

  if (!dataInicial && !dataFinal) {
    const { year, month } = getBrasiliaDateParts();
    const currentMonthPrefix = `${year}-${month}`;
    const todayKey = getBrasiliaDateString();

    list = rawList.filter((s) => {
      const parsed = parseSinalizacaoDate(s);
      return parsed ? parsed.dateKey.startsWith(currentMonthPrefix) : false;
    });

    tabelaList = rawList.filter((s) => {
      const parsed = parseSinalizacaoDate(s);
      return parsed ? parsed.dateKey === todayKey : false;
    });
  }

  const totalSinalizacoes = list.length;

  const operadoresSet = new Set(list.map((s) => (s.operador || '').trim()).filter(Boolean));
  const totalOperadoresSinalizados = operadoresSet.size;

  const supervisoresSet = new Set(list.map((s) => (s.supervisor || '').trim()).filter(Boolean));
  const totalSupervisoresComSinalizacoes = supervisoresSet.size;

  // Confirmados e % Tratados real
  const confirmadosCount = list.filter((s: any) =>
    s.confirmado === true ||
    String(s.confirmado) === 'true' ||
    s.confirmado === 1 ||
    !!s.data_confirmacao ||
    (s.status && String(s.status).toLowerCase().includes('confirmad'))
  ).length;
  const percentualTratados = totalSinalizacoes > 0 ? Math.round((confirmadosCount / totalSinalizacoes) * 100) : 0;

  // Tempo médio real em minutos
  let totalMinutosConfirmados = 0;
  let countComTempo = 0;
  list.forEach((s: any) => {
    const isConfirmado =
      s.confirmado === true ||
      String(s.confirmado) === 'true' ||
      s.confirmado === 1 ||
      !!s.data_confirmacao ||
      (s.status && String(s.status).toLowerCase().includes('confirmad'));

    if (isConfirmado && s.data_confirmacao) {
      try {
        const startMs = getSinalizacaoStartMs(s);
        const endMs = getSinalizacaoEndMs(s);
        if (startMs !== null && endMs !== null && endMs >= startMs) {
          totalMinutosConfirmados += (endMs - startMs) / (1000 * 60);
          countComTempo++;
        }
      } catch (e) {}
    }
  });
  const tempoMedioMinutos = countComTempo > 0 ? Math.round(totalMinutosConfirmados / countComTempo) : 0;

  // Operator counts & Reincidentes (operadores com >= 2 sinalizações)
  const opCounts: Record<string, number> = {};
  const opRawNameMap: Record<string, string> = {};

  list.forEach((s: any) => {
    const rawOp = (s.operador || '').trim();
    if (rawOp) {
      const key = rawOp.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      opCounts[key] = (opCounts[key] || 0) + 1;
      if (!opRawNameMap[key]) {
        opRawNameMap[key] = rawOp;
      }
    }
  });

  const totalReincidentes = Object.values(opCounts).filter((c) => c >= 2).length;
  const reincidentes5plus = Object.values(opCounts).filter((c) => c >= 5).length;

  // Evolução das sinalizações por data (Dia/Mês)
  const dateMap: Record<string, { label: string; count: number }> = {};
  list.forEach((s) => {
    const parsed = parseSinalizacaoDate(s);
    if (parsed) {
      if (!dateMap[parsed.dateKey]) {
        dateMap[parsed.dateKey] = { label: parsed.displayLabel, count: 0 };
      }
      dateMap[parsed.dateKey].count++;
    }
  });

  const sortedDates = Object.keys(dateMap).sort();
  const evolucaoSinalizacoes = sortedDates.map((dKey) => ({
    data: dKey,
    label: dateMap[dKey].label,
    quantidade: dateMap[dKey].count
  }));

  // Sinalizações por Horário (00h, 01h ... 23h)
  const horaMap: Record<string, number> = {};
  list.forEach((s) => {
    const hourKey = parseSinalizacaoHour(s);
    if (hourKey) {
      horaMap[hourKey] = (horaMap[hourKey] || 0) + 1;
    }
  });

  const sortedHours = Object.keys(horaMap).sort();
  const sinalizacoesPorHorario = sortedHours.map((h) => ({
    hora: h,
    quantidade: horaMap[h]
  }));

  // Sinalizações por Supervisor
  const supCounts: Record<string, number> = {};
  const supDisplayNameMap: Record<string, string> = {};
  list.forEach((s) => {
    const rawName = (s.supervisor || '').trim();
    if (!rawName) return;
    const key = rawName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/z/g, 's').trim();
    supCounts[key] = (supCounts[key] || 0) + 1;
    if (!supDisplayNameMap[key] || rawName.includes('SOUSA')) {
      supDisplayNameMap[key] = rawName;
    }
  });
  const sinalizacoesPorSupervisor = Object.entries(supCounts).map(([key, count]) => ({
    supervisor: supDisplayNameMap[key] || key,
    quantidade: count
  })).sort((a, b) => b.quantidade - a.quantidade);

  // Maiores Motivos
  const motivoCounts: Record<string, number> = {};
  list.forEach((s) => {
    const m = (s.motivo || 'Outros').trim();
    if (m) {
      motivoCounts[m] = (motivoCounts[m] || 0) + 1;
    }
  });
  const maioresMotivos = Object.entries(motivoCounts).map(([motivo, count]) => ({
    motivo,
    quantidade: count,
    percentual: totalSinalizacoes > 0 ? Math.round((count / totalSinalizacoes) * 100) : 0
  })).sort((a, b) => b.quantidade - a.quantidade);

  // Top 5 Operadores
  const topOperadores = Object.entries(opCounts).map(([opKey, count]) => {
    const opName = opRawNameMap[opKey] || opKey;
    const parts = opName.split(/\s+/);
    const apelido = parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1]}` : opName;
    return {
      operador: opName,
      label: apelido,
      quantidade: count
    };
  }).sort((a, b) => b.quantidade - a.quantidade).slice(0, 5);

  // Sinalizações por Produto
  const prodCounts: Record<string, number> = {};
  list.forEach((s) => {
    const p = (s.produto || 'Outros').trim();
    if (p) {
      prodCounts[p] = (prodCounts[p] || 0) + 1;
    }
  });
  const sinalizacoesPorProduto = Object.entries(prodCounts).map(([prod, count]) => ({
    produto: prod,
    quantidade: count
  })).sort((a, b) => b.quantidade - a.quantidade);

  // Insights gerados dinamicamente com dados reais DO DIA (tabelaList)
  const insightsTotal = tabelaList.length;
  const insightsMotivoCounts: Record<string, number> = {};
  const insightsHoraMap: Record<string, number> = {};
  const insightsOpCounts: Record<string, number> = {};
  let insightsConfirmadosCount = 0;

  tabelaList.forEach((s: any) => {
    const m = (s.motivo || 'Outros').trim();
    if (m) insightsMotivoCounts[m] = (insightsMotivoCounts[m] || 0) + 1;

    const hourKey = parseSinalizacaoHour(s);
    if (hourKey) insightsHoraMap[hourKey] = (insightsHoraMap[hourKey] || 0) + 1;

    const rawOp = (s.operador || '').trim();
    if (rawOp) {
      const key = rawOp.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      insightsOpCounts[key] = (insightsOpCounts[key] || 0) + 1;
    }

    const isConfirmado =
      s.confirmado === true ||
      String(s.confirmado) === 'true' ||
      s.confirmado === 1 ||
      !!s.data_confirmacao ||
      (s.status && String(s.status).toLowerCase().includes('confirmad'));
    if (isConfirmado) insightsConfirmadosCount++;
  });

  const topMotivoInsight = Object.entries(insightsMotivoCounts).sort((a, b) => b[1] - a[1])[0];
  const peakHoraInsight = Object.entries(insightsHoraMap).sort((a, b) => b[1] - a[1])[0];
  const insightsTotalReincidentes = Object.values(insightsOpCounts).filter((c) => c >= 2).length;
  const insightsReincidentes5plus = Object.values(insightsOpCounts).filter((c) => c >= 5).length;
  const insightsPercentualTratados = insightsTotal > 0 ? Math.round((insightsConfirmadosCount / insightsTotal) * 100) : 0;

  const insights: string[] = [];
  if (insightsTotal === 0) {
    insights.push('Nenhuma sinalização registrada no dia atual.');
  } else {
    if (topMotivoInsight) {
      const pct = Math.round((topMotivoInsight[1] / insightsTotal) * 100);
      insights.push(`Motivo "${topMotivoInsight[0]}" lidera hoje com ${topMotivoInsight[1]} sinalizações (${pct}% do dia)`);
    }
    if (peakHoraInsight) {
      insights.push(`Maior concentração de sinalizações hoje no horário das ${peakHoraInsight[0]} (${peakHoraInsight[1]} ocorrências)`);
    }
    if (insightsReincidentes5plus > 0) {
      insights.push(`${insightsReincidentes5plus} operador(es) possuem 5+ reincidências no dia`);
    } else if (insightsTotalReincidentes > 0) {
      insights.push(`${insightsTotalReincidentes} operador(es) possuem reincidências no dia`);
    }
    insights.push(`${insightsPercentualTratados}% dos sinais do dia foram devidamente tratados (${insightsConfirmadosCount} de ${insightsTotal})`);
  }

  return {
    totalSinalizacoes,
    percentualTratados,
    tempoMedioMinutos,
    totalReincidentes,
    totalOperadoresSinalizados,
    totalSupervisoresComSinalizacoes,
    totalMotivosCadastrados,
    evolucaoSinalizacoes,
    sinalizacoesPorHorario,
    sinalizacoesPorSupervisor,
    maioresMotivos,
    topOperadores,
    sinalizacoesPorProduto,
    insights,
    resumoTabela: tabelaList
  };
}

interface DashboardViewProps {
  user?: UserSession | null;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ user }) => {
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
  const [viewMode, setViewMode] = useState<'controldesk' | 'detalhado' | 'relatorios'>('controldesk');
  const [rawSinalizacoes, setRawSinalizacoes] = useState<Sinalizacao[]>([]);
  const [relatorioPeriodo, setRelatorioPeriodo] = useState<'dia' | 'semana' | 'mes' | 'tudo'>('semana');
  const [aiDiagnosis, setAiDiagnosis] = useState<string | null>(null);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [copiedDiagnosis, setCopiedDiagnosis] = useState(false);
  const fetchInFlightRef = useRef(false);

  // Access control for AI Diagnosis generator card: Only 'Planejamento' and 'Administrador' profiles
  const canAccessAiDiagnosis =
    !user || user.perfil === 'Planejamento' || user.perfil === 'Administrador';

  // Compute reincidências data for Relatórios view Mode
  const reincidenciaData = useMemo(() => {
    const list = rawSinalizacoes.length > 0 ? rawSinalizacoes : (metrics?.resumoTabela || []);
    const now = Date.now();

    // Map of inactive operators names and operator-to-supervisor mapping
    const inactiveOpsSet = new Set<string>();
    const opSupMap = new Map<string, string>();
    operadoresList.forEach((op) => {
      const normKey = op.nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
      if (op.supervisor) {
        opSupMap.set(normKey, op.supervisor);
      }
      const sit = (op.situacao || '').toLowerCase().trim();
      if (
        sit.includes('inat') ||
        sit === 'i' ||
        sit === 'inativo' ||
        sit === 'desligado' ||
        sit === 'demitido' ||
        sit === '0' ||
        sit === 'false'
      ) {
        inactiveOpsSet.add(normKey);
      }
    });

    const filteredList = list.filter((s: any) => {
      // Supervisor-level restriction: Supervisor / Operação profile sees ONLY their operators
      if (user && (user.perfil === 'Supervisor' || user.perfil === 'Operação')) {
        const sSup = (s.supervisor || '').trim();
        const opNameKey = (s.operador || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
        const opSupFromList = opSupMap.get(opNameKey) || '';

        const matchesSinalizacaoSup = isSupervisorMatch(user.nome, user.login, sSup);
        const matchesOperatorSup = isSupervisorMatch(user.nome, user.login, opSupFromList);

        if (!matchesSinalizacaoSup && !matchesOperatorSup) {
          return false;
        }
      }

      if (relatorioPeriodo === 'tudo') return true;
      const startMs = getSinalizacaoStartMs(s);
      if (startMs === null) return true;

      if (relatorioPeriodo === 'dia') {
        return startMs >= now - 24 * 60 * 60 * 1000;
      }
      if (relatorioPeriodo === 'semana') {
        return startMs >= now - 7 * 24 * 60 * 60 * 1000;
      }
      if (relatorioPeriodo === 'mes') {
        return startMs >= now - 30 * 24 * 60 * 60 * 1000;
      }
      return true;
    });

    const opMap: Record<
      string,
      {
        operador: string;
        supervisor: string;
        total: number;
        motivosMap: Record<string, number>;
      }
    > = {};

    filteredList.forEach((s: any) => {
      const opRaw = (s.operador || '').trim();
      if (!opRaw) return;

      const key = opRaw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

      // Exclude inactive operators (status from 1st column of API)
      if (inactiveOpsSet.has(key)) return;

      const motivo = (s.motivo || s.motivo_sinalizacao || s.descricao || 'Outros').trim();
      const supervisor = (s.supervisor || '').trim();

      if (!opMap[key]) {
        opMap[key] = {
          operador: opRaw,
          supervisor,
          total: 0,
          motivosMap: {}
        };
      }

      opMap[key].total++;
      opMap[key].motivosMap[motivo] = (opMap[key].motivosMap[motivo] || 0) + 1;
    });

    const reincidentesList = Object.values(opMap)
      .filter((op) => op.total >= 2)
      .map((op) => {
        const criticalMotives: { motivo: string; count: number }[] = [];
        let topMotivo = { motivo: '-', count: 0 };

        Object.entries(op.motivosMap).forEach(([m, count]) => {
          if (count >= 3) {
            criticalMotives.push({ motivo: m, count });
          }
          if (count > topMotivo.count) {
            topMotivo = { motivo: m, count };
          }
        });

        return {
          ...op,
          topMotivo,
          criticalMotives,
          isCritical: criticalMotives.length > 0
        };
      });

    reincidentesList.sort((a, b) => {
      if (a.isCritical && !b.isCritical) return -1;
      if (!a.isCritical && b.isCritical) return 1;
      return b.total - a.total;
    });

    const totalReincidentes = reincidentesList.length;
    const totalCriticos = reincidentesList.filter((r) => r.isCritical).length;

    const globalMotivos: Record<string, number> = {};
    reincidentesList.forEach((r) => {
      Object.entries(r.motivosMap).forEach(([m, c]) => {
        globalMotivos[m] = (globalMotivos[m] || 0) + c;
      });
    });

    const topGlobalArr = Object.entries(globalMotivos).sort((a, b) => b[1] - a[1])[0];

    return {
      filteredCount: filteredList.length,
      reincidentes: reincidentesList,
      totalReincidentes,
      totalCriticos,
      topGlobalMotivo: {
        motivo: topGlobalArr ? topGlobalArr[0] : '-',
        count: topGlobalArr ? topGlobalArr[1] : 0
      }
    };
  }, [rawSinalizacoes, metrics, relatorioPeriodo, operadoresList, user]);

  const handleGenerateAiReport = async () => {
    setIsGeneratingAi(true);

    const periodoLabel =
      relatorioPeriodo === 'dia'
        ? 'Hoje (últimas 24h)'
        : relatorioPeriodo === 'semana'
        ? 'Últimos 7 Dias'
        : relatorioPeriodo === 'mes'
        ? 'Últimos 30 Dias'
        : 'Filtro Atual do Dashboard';

    const generateLocalFallback = () => {
      const criticosList = reincidenciaData.reincidentes.filter((r) => r.isCritical);
      let text = `### 📊 Diagnóstico Executivo de Reincidência (IA)\n`;
      text += `**Período Analisado:** ${periodoLabel} | **Status Operacional:** Consolidado\n\n`;
      text += `#### 🚨 Sumário de Riscos e Casos Críticos (≥ 3x no mesmo motivo)\n`;
      text += `- **Total de Reincidentes:** ${reincidenciaData.totalReincidentes} operador(es).\n`;
      text += `- **Casos de Alerta Crítico:** ${reincidenciaData.totalCriticos} operador(es).\n`;

      if (criticosList.length > 0) {
        criticosList.forEach((c) => {
          text += `  • **${c.operador}** (Supervisor: ${c.supervisor || 'Não informado'}): **${c.criticalMotives
            .map((m) => `${m.count}x "${m.motivo}"`)
            .join(', ')}**\n`;
        });
      } else {
        text += `  • Nenhum operador atingiu o gatilho crítico (3x no mesmo motivo) no período.\n`;
      }

      text += `\n#### 🔍 Gargalo Operacional Dominante\n`;
      if (reincidenciaData.topGlobalMotivo.count > 0) {
        text += `- O motivo com maior reincidência acumulada é **"${reincidenciaData.topGlobalMotivo.motivo}"** com **${reincidenciaData.topGlobalMotivo.count} ocorrências**.\n`;
      } else {
        text += `- Reincidências distribuídas sem concentração atípica de motivos.\n`;
      }

      text += `\n#### 🛠️ Diretrizes Recomendadas para Supervisores\n`;
      text += `1. **Feedback e Alinhamento Imediato**: Orientar prioritariamente os operadores em Alerta Crítico em até 24 horas.\n`;
      text += `2. **Checagem de Processo / Sistema**: Investigar as causas raízes do motivo "${reincidenciaData.topGlobalMotivo.motivo || 'recorrente'}" junto à operação.\n`;
      text += `3. **Acompanhamento Control Desk**: Monitorar a evolução da curva de sinalizações dos reincidentes no próximo plantão.`;

      return text;
    };

    try {
      const res = await api.gerarRelatorioReincidenciasIa({
        periodo: relatorioPeriodo,
        totalReincidentes: reincidenciaData.totalReincidentes,
        totalCriticos: reincidenciaData.totalCriticos,
        reincidentes: reincidenciaData.reincidentes
      });
      if (res && res.diagnosis) {
        setAiDiagnosis(res.diagnosis);
      } else {
        setAiDiagnosis(generateLocalFallback());
      }
    } catch (err: any) {
      console.warn('Conexão remota de IA não disponível, gerando parecer inteligente local:', err);
      setAiDiagnosis(generateLocalFallback());
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const handleCopyDiagnosis = () => {
    if (aiDiagnosis) {
      navigator.clipboard.writeText(aiDiagnosis);
      setCopiedDiagnosis(true);
      setTimeout(() => setCopiedDiagnosis(false), 2000);
    }
  };

  // Track theme mutation on <html> tag to update Recharts dynamically
  const [isDarkTheme, setIsDarkTheme] = useState(() =>
    document.documentElement.classList.contains('dark')
  );

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDarkTheme(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });
    return () => observer.disconnect();
  }, []);

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
  const [itemsPerPage, setItemsPerPage] = useState(50);

  useEffect(() => {
    let cancelled = false;

    const loadDropdownData = async () => {
      try {
        const [sups, prods, ops] = await Promise.all([
          api.getSupervisores(),
          api.getProdutos(),
          api.getOperadores()
        ]);
        if (!cancelled) {
          setSupervisoresList(sups);
          setProdutosList(prods);
          setOperadoresList(ops);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Erro ao carregar opções dos filtros:', err);
        }
      }
    };

    void loadDropdownData();

    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch metrics automatically whenever filters change using api.getSinalizacoes
  useEffect(() => {
    let cancelled = false;

    const loadMetrics = async () => {
      if (cancelled) return;

      fetchInFlightRef.current = true;
      setIsLoading(true);
      setError(null);
      try {
        const [sinalizacoes, mots] = await Promise.all([
          api.getSinalizacoes({
            dataInicial,
            dataFinal,
            produto,
            supervisor,
            operador
          }),
          api.getMotivos().catch(() => [])
        ]);

        if (!cancelled) {
          let list = sinalizacoes;
          if (user && (user.perfil === 'Supervisor' || user.perfil === 'Operação')) {
            const opSupMap = new Map<string, string>();
            operadoresList.forEach((op) => {
              if (op.nome && op.supervisor) {
                const k = op.nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
                opSupMap.set(k, op.supervisor);
              }
            });
            list = sinalizacoes.filter((s: any) => {
              const sSup = (s.supervisor || '').trim();
              const opNameKey = (s.operador || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
              const opSupFromList = opSupMap.get(opNameKey) || '';

              return (
                isSupervisorMatch(user.nome, user.login, sSup) ||
                isSupervisorMatch(user.nome, user.login, opSupFromList)
              );
            });
          }
          setRawSinalizacoes(list);
          const computed = computeMetricsFromSinalizacoes(list, mots.length, dataInicial, dataFinal);
          setMetrics(computed);
          setCurrentPage(1);
        }
      } catch (err: any) {
        if (!cancelled) {
          try {
            const data = await api.getDashboard({
              dataInicial,
              dataFinal,
              produto,
              supervisor,
              operador
            });
            setMetrics(data);
          } catch (e) {
            setError(err.message || 'Erro ao carregar os dados do dashboard.');
          }
        }
      } finally {
        if (!cancelled) {
          fetchInFlightRef.current = false;
          setIsLoading(false);
        }
      }
    };

    void loadMetrics();

    return () => {
      cancelled = true;
    };
  }, [dataInicial, dataFinal, produto, supervisor, operador]);

  const handleResetFilters = () => {
    setDataInicial('');
    setDataFinal('');
    setProduto('Todos');
    if (user && (user.perfil === 'Supervisor' || user.perfil === 'Operação') && supervisoresList.length > 0) {
      const matchedSup = supervisoresList.find((s) => isSupervisorMatch(user.nome, user.login, s.nome));
      setSupervisor(matchedSup ? matchedSup.nome : 'Todos');
    } else {
      setSupervisor('Todos');
    }
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

  const dashboardChartsRef = useRef<HTMLDivElement>(null);
  const [isExportingPDF, setIsExportingPDF] = useState(false);

  const handleExportPDF = async () => {
    if (!metrics) return;
    setIsExportingPDF(true);
    try {
      if (dashboardChartsRef.current) {
        await exportDashboardToPDF(
          dashboardChartsRef.current,
          'Control Desk - Visão Gerencial de Sinalizações',
          `ControlDesk_Dashboard_${getBrasiliaDateString()}.pdf`,
          {
            dataInicial,
            dataFinal,
            produto,
            supervisor,
            operador
          }
        );
      }
    } catch (err) {
      console.error('Erro ao exportar PDF do dashboard:', err);
      alert('Não foi possível gerar o arquivo PDF.');
    } finally {
      setIsExportingPDF(false);
    }
  };

  if (isLoading && !metrics) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 border-4 border-blue-600 dark:border-cyan-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Carregando dados do Control Desk...</p>
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

  // Month label calculation
  const getMonthLabel = () => {
    const monthNames = [
      'JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO',
      'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'
    ];

    if (dataInicial) {
      const parts = dataInicial.split('-');
      if (parts.length === 3) {
        const monthIdx = parseInt(parts[1], 10) - 1;
        return `${monthNames[monthIdx] || 'AGOSTO'} / ${parts[0]}`;
      }
    }

    const { year, month } = getBrasiliaDateParts();
    const monthIdx = parseInt(month, 10) - 1;
    return `${monthNames[monthIdx] || 'AGOSTO'} / ${year}`;
  };

  // Dynamic Chart Theme variables
  const chartGridStroke = isDarkTheme ? '#1e293b' : '#f1f5f9';
  const chartTickFill = isDarkTheme ? '#94a3b8' : '#475569';
  const chartPrimaryColor = isDarkTheme ? '#06b6d4' : '#2563eb';
  const tooltipStyle = {
    backgroundColor: isDarkTheme ? '#0f172a' : '#ffffff',
    borderColor: isDarkTheme ? '#334155' : '#cbd5e1',
    borderRadius: '12px',
    color: isDarkTheme ? '#f8fafc' : '#0f172a',
    fontSize: '12px',
    fontWeight: '600',
    boxShadow: isDarkTheme ? '0 10px 25px -5px rgba(0, 0, 0, 0.5)' : '0 10px 25px -5px rgba(0, 0, 0, 0.1)'
  };

  return (
    <div className="space-y-6 pb-12 transition-colors duration-200">
      {/* Top Header & View Mode Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 p-4 sm:p-5 rounded-2xl shadow-xs dark:shadow-xl transition-colors duration-200">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-blue-50 dark:bg-cyan-500/10 border border-blue-200 dark:border-cyan-500/30 flex items-center justify-center text-blue-600 dark:text-cyan-400 shadow-xs">
            <LayoutDashboard className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              VISÃO GERENCIAL
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Painel executivo de monitoramento operacional</p>
          </div>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800 self-start sm:self-auto flex-wrap">
          <button
            type="button"
            onClick={() => setViewMode('controldesk')}
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              viewMode === 'controldesk'
                ? 'bg-blue-600 dark:bg-cyan-500 text-white dark:text-slate-950 shadow-md shadow-blue-600/20 dark:shadow-cyan-500/20'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <LayoutDashboard className="h-3.5 w-3.5" />
            Control Desk
          </button>
          <button
            type="button"
            onClick={() => setViewMode('detalhado')}
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              viewMode === 'detalhado'
                ? 'bg-blue-600 dark:bg-cyan-500 text-white dark:text-slate-950 shadow-md shadow-blue-600/20 dark:shadow-cyan-500/20'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Eye className="h-3.5 w-3.5" />
            Visão Detalhada
          </button>
          <button
            type="button"
            onClick={() => setViewMode('relatorios')}
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              viewMode === 'relatorios'
                ? 'bg-blue-600 dark:bg-cyan-500 text-white dark:text-slate-950 shadow-md shadow-blue-600/20 dark:shadow-cyan-500/20'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5 text-amber-400 dark:text-amber-300" />
            Relatórios IA
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="rounded-2xl bg-white dark:bg-slate-900/90 p-5 border border-slate-200/80 dark:border-slate-800 shadow-2xs dark:shadow-xl transition-colors duration-200">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-blue-600 dark:text-cyan-400" />
            <h2 className="text-xs font-bold text-slate-800 dark:text-slate-300 uppercase tracking-wider">
              Filtros de Pesquisa & Análise
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Limpar Filtros
            </button>
            <button
              onClick={handleExportExcel}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-emerald-600/20 hover:bg-emerald-700 transition cursor-pointer"
            >
              <FileSpreadsheet className="h-4 w-4" />
              <span className="hidden sm:inline">Exportar Excel</span>
            </button>
            <button
              onClick={handleExportPDF}
              disabled={isExportingPDF}
              className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-rose-600/20 hover:bg-rose-700 disabled:opacity-50 transition cursor-pointer"
              title="Exportar gráficos e métricas do dashboard em PDF"
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
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
          {/* Data Inicial */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
              Data Inicial
            </label>
            <input
              type="date"
              value={dataInicial}
              onChange={(e) => setDataInicial(e.target.value)}
              className="w-full rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:border-blue-500 dark:focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-blue-500/20 dark:focus:ring-cyan-500/30 transition"
            />
          </div>

          {/* Data Final */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
              Data Final
            </label>
            <input
              type="date"
              value={dataFinal}
              onChange={(e) => setDataFinal(e.target.value)}
              className="w-full rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:border-blue-500 dark:focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-blue-500/20 dark:focus:ring-cyan-500/30 transition"
            />
          </div>

          {/* Operador */}
          <div className="relative" ref={operadorRef}>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
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
                className="w-full rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:border-blue-500 dark:focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-blue-500/20 dark:focus:ring-cyan-500/30 transition pr-7"
              />
              {operador && (
                <button
                  type="button"
                  onClick={() => {
                    setOperador('');
                    setShowOperadorDropdown(false);
                  }}
                  className="absolute right-2.5 top-2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 text-xs font-bold"
                  title="Limpar operador"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Dropdown Suggestions */}
            {showOperadorDropdown && operador.trim().length > 0 && (
              <div className="absolute z-30 left-0 right-0 mt-1 max-h-48 overflow-y-auto rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl divide-y divide-slate-100 dark:divide-slate-800">
                {operadoresList.filter((op) => {
                  const matchesText = op.nome.toLowerCase().includes(operador.toLowerCase().trim());
                  if (user && (user.perfil === 'Supervisor' || user.perfil === 'Operação')) {
                    return matchesText && isSupervisorMatch(user.nome, user.login, op.supervisor);
                  }
                  return matchesText;
                }).length > 0 ? (
                  operadoresList
                    .filter((op) => {
                      const matchesText = op.nome.toLowerCase().includes(operador.toLowerCase().trim());
                      if (user && (user.perfil === 'Supervisor' || user.perfil === 'Operação')) {
                        return matchesText && isSupervisorMatch(user.nome, user.login, op.supervisor);
                      }
                      return matchesText;
                    })
                    .map((op) => (
                      <button
                        key={op.id}
                        type="button"
                        onClick={() => {
                          setOperador(op.nome);
                          setShowOperadorDropdown(false);
                        }}
                        className="w-full text-left px-3.5 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs transition flex flex-col"
                      >
                        <span className="font-semibold text-slate-800 dark:text-slate-200">{op.nome}</span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400">
                          Sup: {op.supervisor} • Prod: {op.produto}
                        </span>
                      </button>
                    ))
                ) : (
                  <div className="px-3.5 py-2 text-xs text-slate-400 dark:text-slate-500 italic">
                    Nenhum operador encontrado.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Produto */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
              Produto
            </label>
            <select
              value={produto}
              onChange={(e) => setProduto(e.target.value)}
              className="w-full rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:border-blue-500 dark:focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-blue-500/20 dark:focus:ring-cyan-500/30 transition"
            >
              <option value="Todos">Todos os Produtos</option>
              {produtosList.map((p, idx) => (
                <option key={`dash-prod-${p.id}-${p.nome}-${idx}`} value={p.nome}>
                  {p.nome}
                </option>
              ))}
            </select>
          </div>

          {/* Supervisor */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
              Supervisor {user && (user.perfil === 'Supervisor' || user.perfil === 'Operação') && <span className="text-[10px] text-blue-500 dark:text-cyan-400 font-normal">(Equipes autorizadas)</span>}
            </label>
            <select
              value={supervisor}
              onChange={(e) => setSupervisor(e.target.value)}
              className="w-full rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:border-blue-500 dark:focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-blue-500/20 dark:focus:ring-cyan-500/30 transition"
            >
              <option value="Todos">Todos os Supervisores</option>
              {supervisoresList
                .filter((s) => {
                  if (user && (user.perfil === 'Supervisor' || user.perfil === 'Operação')) {
                    return isSupervisorMatch(user.nome, user.login, s.nome);
                  }
                  return true;
                })
                .map((s, idx) => (
                  <option key={`dash-sup-${s.id}-${s.nome}-${idx}`} value={s.nome}>
                    {s.nome}
                  </option>
                ))}
            </select>
          </div>
        </div>
      </div>

      {/* Printable Dashboard Container for PDF Export */}
      <div ref={dashboardChartsRef} className="space-y-6">
        {viewMode === 'controldesk' ? (
          /* ======================================================== */
          /*  CONTROL DESK - VISÃO GERENCIAL EXECUTIVE DASHBOARD     */
          /* ======================================================== */
          <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800/90 shadow-lg dark:shadow-2xl p-6 sm:p-8 space-y-6 transition-colors duration-200">
            {/* Header Title Box */}
            <div className="border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/80 rounded-2xl p-4 sm:p-6 text-center space-y-1 relative overflow-hidden transition-colors duration-200">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-1 bg-gradient-to-r from-transparent via-blue-500 dark:via-cyan-500 to-transparent shadow-[0_0_12px_#3b82f6] dark:shadow-[0_0_12px_#06b6d4]" />
              <h2 className="text-xl sm:text-2xl font-black tracking-widest text-slate-900 dark:text-slate-100 uppercase">
                VISÃO GERENCIAL
              </h2>
              <p className="text-xs sm:text-sm font-bold tracking-wider text-blue-600 dark:text-cyan-400 uppercase">
                {getMonthLabel()}
              </p>
            </div>

            {/* Top 4 KPI Metrics Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 divide-y md:divide-y-0 md:divide-x divide-slate-200 dark:divide-slate-800 bg-slate-50/80 dark:bg-slate-950/60 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 transition-colors duration-200">
              {/* Metric 1 */}
              <div className="flex flex-col items-center justify-center p-3 text-center">
                <span className="text-2xl sm:text-4xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
                  {metrics?.totalSinalizacoes ?? 0}
                </span>
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mt-1 flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5 text-blue-600 dark:text-cyan-400" /> Sinais
                </span>
              </div>

              {/* Metric 2 */}
              <div className="flex flex-col items-center justify-center p-3 text-center">
                <span className="text-2xl sm:text-4xl font-extrabold text-emerald-600 dark:text-emerald-400 tracking-tight">
                  {metrics?.percentualTratados ?? 0}%
                </span>
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mt-1 flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> Tratados
                </span>
              </div>

              {/* Metric 3 */}
              <div className="flex flex-col items-center justify-center p-3 text-center">
                <span className="text-2xl sm:text-4xl font-extrabold text-blue-600 dark:text-cyan-300 tracking-tight">
                  {formatTempoMedioDisplay(metrics?.tempoMedioMinutos ?? 0)}
                </span>
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mt-1 flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-blue-600 dark:text-cyan-300" /> T. médio
                </span>
              </div>

              {/* Metric 4 */}
              <div className="flex flex-col items-center justify-center p-3 text-center">
                <span className="text-2xl sm:text-4xl font-extrabold text-amber-600 dark:text-amber-400 tracking-tight">
                  {metrics?.totalReincidentes ?? 0}
                </span>
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mt-1 flex items-center gap-1">
                  <Repeat className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" /> Reincidentes
                </span>
              </div>
            </div>

            {/* Middle Section: EVOLUÇÃO DAS SINALIZAÇÕES */}
            <div className="rounded-2xl bg-slate-50/80 dark:bg-slate-950/60 p-5 sm:p-6 border border-slate-200 dark:border-slate-800 space-y-4 transition-colors duration-200">
              <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
                <TrendingUp className="h-4 w-4 text-blue-600 dark:text-cyan-400" />
                <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  EVOLUÇÃO DAS SINALIZAÇÕES
                </h3>
              </div>

              <div className="h-64 sm:h-72 w-full">
                {metrics?.evolucaoSinalizacoes && metrics.evolucaoSinalizacoes.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={metrics.evolucaoSinalizacoes}
                      margin={{ top: 15, right: 20, left: 0, bottom: 5 }}
                    >
                      <defs>
                        <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={chartPrimaryColor} stopOpacity={0.4} />
                          <stop offset="95%" stopColor={chartPrimaryColor} stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartGridStroke} />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 11, fill: chartTickFill, fontWeight: 600 }}
                        axisLine={{ stroke: isDarkTheme ? '#334155' : '#cbd5e1' }}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: chartTickFill }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        formatter={(value: any) => [`${value} ocorrências`, 'Sinalizações']}
                        labelFormatter={(label: any) => `Data: ${label}`}
                        contentStyle={tooltipStyle}
                      />
                      <Area
                        type="monotone"
                        dataKey="quantidade"
                        stroke={chartPrimaryColor}
                        strokeWidth={3}
                        fillOpacity={1}
                        fill="url(#chartGradient)"
                        dot={{ r: 4, fill: chartPrimaryColor, stroke: isDarkTheme ? '#0f172a' : '#ffffff', strokeWidth: 2 }}
                        activeDot={{ r: 6, fill: chartPrimaryColor, stroke: '#fff', strokeWidth: 2 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-slate-400 dark:text-slate-500 italic">
                    Sem dados históricos suficientes para exibir a curva de evolução.
                  </div>
                )}
              </div>
            </div>

            {/* Lower Grid (2 Columns) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column: PRINCIPAIS MOTIVOS */}
              <div className="rounded-2xl bg-slate-50/80 dark:bg-slate-950/60 p-5 sm:p-6 border border-slate-200 dark:border-slate-800 space-y-4 transition-colors duration-200">
                <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
                  <ListFilter className="h-4 w-4 text-blue-600 dark:text-cyan-400" />
                  <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                    PRINCIPAIS MOTIVOS
                  </h3>
                </div>

                <div className="space-y-3.5">
                  {metrics?.maioresMotivos && metrics.maioresMotivos.length > 0 ? (
                    metrics.maioresMotivos.slice(0, 6).map((item, idx) => {
                      const maxVal = metrics.maioresMotivos[0].quantidade || 1;
                      const percent = Math.round((item.quantidade / maxVal) * 100);
                      return (
                        <div key={idx} className="space-y-1">
                          <div className="flex items-center justify-between text-xs font-semibold">
                            <span className="text-slate-700 dark:text-slate-300 truncate max-w-[180px] sm:max-w-[240px]">
                              {item.motivo}
                            </span>
                            <span className="text-blue-600 dark:text-cyan-400 font-extrabold ml-2">
                              {item.quantidade}
                            </span>
                          </div>
                          <div className="h-2 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-blue-600 to-cyan-500 dark:from-cyan-500 dark:to-blue-500 rounded-full transition-all duration-500"
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="py-8 text-center text-xs text-slate-400 dark:text-slate-500 italic">
                      Nenhum motivo registrado no período.
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: SINALIZAÇÕES POR HORÁRIO */}
              <div className="rounded-2xl bg-slate-50/80 dark:bg-slate-950/60 p-5 sm:p-6 border border-slate-200 dark:border-slate-800 space-y-4 transition-colors duration-200">
                <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
                  <Clock className="h-4 w-4 text-blue-600 dark:text-cyan-400" />
                  <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                    SINALIZAÇÕES POR HORÁRIO
                  </h3>
                </div>

                <div className="h-60 sm:h-64 w-full">
                  {metrics?.sinalizacoesPorHorario && metrics.sinalizacoesPorHorario.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={metrics.sinalizacoesPorHorario}
                        margin={{ top: 15, right: 10, left: 10, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartGridStroke} />
                        <XAxis
                          dataKey="hora"
                          tick={{ fontSize: 11, fill: chartTickFill, fontWeight: 600 }}
                          axisLine={{ stroke: isDarkTheme ? '#334155' : '#cbd5e1' }}
                          tickLine={false}
                        />
                        <YAxis hide />
                        <Tooltip
                          formatter={(value: any) => [`${value} ocorrências`, 'Volume']}
                          labelFormatter={(label: any) => `Horário: ${label}`}
                          contentStyle={tooltipStyle}
                        />
                        <Bar dataKey="quantidade" fill={chartPrimaryColor} radius={[6, 6, 0, 0]}>
                          <LabelList
                            dataKey="quantidade"
                            position="top"
                            offset={6}
                            style={{ fontSize: '10px', fontWeight: 700, fill: chartTickFill }}
                          />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-xs text-slate-400 dark:text-slate-500 italic">
                      Nenhum dado por horário disponível.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Bottom Panel: INSIGHTS */}
            <div className="rounded-2xl bg-slate-50/90 dark:bg-slate-950/80 p-5 sm:p-6 border border-slate-200/90 dark:border-slate-800/90 space-y-3 transition-colors duration-200">
              <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3 text-blue-600 dark:text-cyan-400">
                <Sparkles className="h-4 w-4" />
                <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-900 dark:text-slate-100">
                  INSIGHTS & DESTAQUES OPERACIONAIS
                </h3>
              </div>

              <ul className="space-y-2 text-xs sm:text-sm text-slate-700 dark:text-slate-300 font-medium">
                {metrics?.insights && metrics.insights.length > 0 ? (
                  metrics.insights.map((insight, idx) => (
                    <li key={idx} className="flex items-start gap-2.5">
                      <span className="text-blue-600 dark:text-cyan-400 font-bold text-base leading-none">•</span>
                      <span>{insight}</span>
                    </li>
                  ))
                ) : (
                  <>
                    <li className="flex items-start gap-2.5">
                      <span className="text-blue-600 dark:text-cyan-400 font-bold text-base leading-none">•</span>
                      <span>Pausa excedida apresentou maior participação com volume significativo no período.</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="text-blue-600 dark:text-cyan-400 font-bold text-base leading-none">•</span>
                      <span>Maior concentração de sinalizações ocorreu na faixa horária entre 10h–11h.</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="text-blue-600 dark:text-cyan-400 font-bold text-base leading-none">•</span>
                      <span>Operadores reincidentes mapeados para acompanhamento da supervisão direta.</span>
                    </li>
                  </>
                )}
              </ul>
            </div>
          </div>
        ) : viewMode === 'detalhado' ? (
          /* ======================================================== */
          /*  VISÃO DETALHADA - DETAILED ANALYTICAL CHARTS & CARDS   */
          /* ======================================================== */
          <div className="space-y-6">
            {/* Metrics Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <div className="rounded-2xl bg-white dark:bg-slate-900 p-5 border border-slate-200/80 dark:border-slate-800 shadow-2xs transition-colors duration-200 flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-500/20">
                  <AlertTriangle className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Total de Sinalizações
                  </p>
                  <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                    {metrics?.totalSinalizacoes ?? 0}
                  </h3>
                </div>
              </div>

              <div className="rounded-2xl bg-white dark:bg-slate-900 p-5 border border-slate-200/80 dark:border-slate-800 shadow-2xs transition-colors duration-200 flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-500/20">
                  <UserX className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Operadores Sinalizados
                  </p>
                  <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                    {metrics?.totalOperadoresSinalizados ?? 0}
                  </h3>
                </div>
              </div>

              <div className="rounded-2xl bg-white dark:bg-slate-900 p-5 border border-slate-200/80 dark:border-slate-800 shadow-2xs transition-colors duration-200 flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-500/20">
                  <UserCheck className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Supervisores Impactados
                  </p>
                  <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                    {metrics?.totalSupervisoresComSinalizacoes ?? 0}
                  </h3>
                </div>
              </div>

              <div className="rounded-2xl bg-white dark:bg-slate-900 p-5 border border-slate-200/80 dark:border-slate-800 shadow-2xs transition-colors duration-200 flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-500/20">
                  <Users className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Motivos Cadastrados
                  </p>
                  <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                    {metrics?.totalMotivosCadastrados ?? 0}
                  </h3>
                </div>
              </div>
            </div>

            {/* Detailed Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Gráfico 1: Sinalizações por Supervisor */}
              <div className="rounded-2xl bg-white dark:bg-slate-900 p-6 border border-slate-200/80 dark:border-slate-800 shadow-2xs flex flex-col justify-between transition-colors duration-200">
                <div className="mb-4">
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Sinalizações por Supervisor</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Distribuição total por liderança direta</p>
                </div>
                <div className="w-full max-h-[380px] overflow-y-auto pr-1">
                  {metrics?.sinalizacoesPorSupervisor && metrics.sinalizacoesPorSupervisor.length > 0 ? (
                    <div style={{ height: `${Math.max(280, metrics.sinalizacoesPorSupervisor.length * 40)}px`, width: '100%' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          layout="vertical"
                          data={metrics.sinalizacoesPorSupervisor}
                          margin={{ top: 10, right: 30, left: 10, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={chartGridStroke} />
                          <XAxis type="number" hide />
                          <YAxis
                            dataKey="supervisor"
                            type="category"
                            tickLine={false}
                            axisLine={false}
                            tick={{ fontSize: 11, fontWeight: 500, fill: chartTickFill }}
                            tickFormatter={formatSupervisorName}
                            width={140}
                            interval={0}
                          />
                          <Tooltip
                            formatter={(value: any) => [`${value} sinalizações`, 'Quantidade']}
                            labelFormatter={(label: any) => `Supervisor: ${label}`}
                            contentStyle={tooltipStyle}
                          />
                          <Bar dataKey="quantidade" fill="#2563eb" radius={[0, 6, 6, 0]} name="Sinalizações" barSize={20}>
                            <LabelList dataKey="quantidade" position="right" offset={8} style={{ fontSize: '11px', fontWeight: 600, fill: chartTickFill }} />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-64 flex items-center justify-center text-xs text-slate-400 dark:text-slate-500">
                      Nenhum dado encontrado com os filtros selecionados.
                    </div>
                  )}
                </div>
              </div>

              {/* Gráfico 2: Maiores Motivos de Sinalização */}
              <div className="rounded-2xl bg-white dark:bg-slate-900 p-6 border border-slate-200/80 dark:border-slate-800 shadow-2xs flex flex-col justify-between transition-colors duration-200">
                <div className="mb-4">
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Maiores Motivos de Sinalização</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Proporção por categoria de ocorrência</p>
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
                        <Tooltip contentStyle={tooltipStyle} />
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
                    <div className="h-full flex items-center justify-center text-xs text-slate-400 dark:text-slate-500">
                      Nenhum dado encontrado com os filtros selecionados.
                    </div>
                  )}
                </div>
              </div>

              {/* Gráfico 3: Top 5 Operadores Mais Sinalizados */}
              <div className="rounded-2xl bg-white dark:bg-slate-900 p-6 border border-slate-200/80 dark:border-slate-800 shadow-2xs flex flex-col justify-between transition-colors duration-200">
                <div className="mb-4">
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Top 5 Operadores mais Sinalizados</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Operadores com maior reincidência de ocorrências</p>
                </div>
                <div className="h-64 w-full">
                  {metrics?.topOperadores && metrics.topOperadores.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={metrics.topOperadores} margin={{ top: 20, right: 15, left: 15, bottom: 25 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartGridStroke} />
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 11, fontWeight: 600, fill: chartTickFill }}
                          interval={0}
                          angle={-10}
                          textAnchor="end"
                        />
                        <YAxis hide />
                        <Tooltip
                          formatter={(value: any) => [`${value} sinalizações`, 'Quantidade']}
                          labelFormatter={(_, payload) => {
                            if (payload && payload[0]) {
                              const item = payload[0].payload;
                              return `${item.operador} (${item.intergrall || item.label})`;
                            }
                            return '';
                          }}
                          contentStyle={tooltipStyle}
                        />
                        <Bar dataKey="quantidade" fill="#f59e0b" radius={[6, 6, 0, 0]} name="Sinalizações">
                          <LabelList dataKey="quantidade" position="top" offset={6} style={{ fontSize: '11px', fontWeight: 600, fill: chartTickFill }} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-xs text-slate-400 dark:text-slate-500">
                      Nenhum dado encontrado com os filtros selecionados.
                    </div>
                  )}
                </div>
              </div>

              {/* Gráfico 4: Quantidade por Produto */}
              <div className="rounded-2xl bg-white dark:bg-slate-900 p-6 border border-slate-200/80 dark:border-slate-800 shadow-2xs flex flex-col justify-between transition-colors duration-200">
                <div className="mb-4">
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Sinalizações por Produto</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Volume de ocorrências registradas por produto/operação</p>
                </div>
                <div className="h-64 w-full">
                  {metrics?.sinalizacoesPorProduto && metrics.sinalizacoesPorProduto.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={metrics.sinalizacoesPorProduto} margin={{ top: 20, right: 15, left: 15, bottom: 25 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartGridStroke} />
                        <XAxis
                          dataKey="produto"
                          tick={{ fontSize: 11, fill: chartTickFill }}
                          interval={0}
                          angle={-15}
                          textAnchor="end"
                        />
                        <YAxis hide />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Bar dataKey="quantidade" fill="#10b981" radius={[6, 6, 0, 0]} name="Sinalizações">
                          <LabelList dataKey="quantidade" position="top" offset={6} style={{ fontSize: '11px', fontWeight: 600, fill: chartTickFill }} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-xs text-slate-400 dark:text-slate-500">
                      Nenhum dado encontrado com os filtros selecionados.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* ======================================================== */
          /*  RELATÓRIOS DE REINCIDÊNCIA (IA) VIEW                  */
          /* ======================================================== */
          <div className="space-y-6">
            {/* Header Card */}
            <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800/90 shadow-lg p-6 sm:p-8 space-y-6 transition-colors duration-200">
              <div className="border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/80 rounded-2xl p-5 text-center relative overflow-hidden">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-1 bg-gradient-to-r from-transparent via-amber-500 dark:via-amber-400 to-transparent shadow-[0_0_12px_#f59e0b]" />
                <div className="flex items-center justify-center gap-2 mb-1">
                  <Sparkles className="h-5 w-5 text-amber-500 dark:text-amber-400 animate-pulse" />
                  <h2 className="text-xl sm:text-2xl font-black tracking-widest text-slate-900 dark:text-slate-100 uppercase">
                    RELATÓRIO DE REINCIDÊNCIAS
                  </h2>
                </div>
                <p className="text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400">
                  Mapeamento inteligente de operadores reincidentes, causas raízes e alertas de risco recorrente
                </p>
              </div>

              {/* Quick Period Filter Tabs */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-100 dark:bg-slate-950 p-2 rounded-2xl border border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-slate-500 dark:text-slate-400 ml-2" />
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">Período de Análise:</span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setRelatorioPeriodo('dia')}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                      relatorioPeriodo === 'dia'
                        ? 'bg-blue-600 dark:bg-cyan-500 text-white dark:text-slate-950 shadow-xs'
                        : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Hoje (24h)
                  </button>
                  <button
                    type="button"
                    onClick={() => setRelatorioPeriodo('semana')}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                      relatorioPeriodo === 'semana'
                        ? 'bg-blue-600 dark:bg-cyan-500 text-white dark:text-slate-950 shadow-xs'
                        : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Últimos 7 dias
                  </button>
                  <button
                    type="button"
                    onClick={() => setRelatorioPeriodo('mes')}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                      relatorioPeriodo === 'mes'
                        ? 'bg-blue-600 dark:bg-cyan-500 text-white dark:text-slate-950 shadow-xs'
                        : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Últimos 30 dias
                  </button>
                  <button
                    type="button"
                    onClick={() => setRelatorioPeriodo('tudo')}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                      relatorioPeriodo === 'tudo'
                        ? 'bg-blue-600 dark:bg-cyan-500 text-white dark:text-slate-950 shadow-xs'
                        : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Filtro do Dashboard
                  </button>
                </div>
              </div>

              {/* 4 KPI Metric Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* KPI 1 */}
                <div className="rounded-2xl bg-slate-50 dark:bg-slate-950/60 p-4 border border-slate-200 dark:border-slate-800 flex items-center gap-3.5">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                    <Repeat className="h-5.5 w-5.5" />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Reincidentes
                    </p>
                    <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100">
                      {reincidenciaData.totalReincidentes} <span className="text-xs font-medium text-slate-400">op(s)</span>
                    </h3>
                  </div>
                </div>

                {/* KPI 2 (Critical Alert) */}
                <div className={`rounded-2xl p-4 border transition-all flex items-center gap-3.5 ${
                  reincidenciaData.totalCriticos > 0
                    ? 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300 shadow-md shadow-rose-500/10'
                    : 'bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800'
                }`}>
                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${
                    reincidenciaData.totalCriticos > 0
                      ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400 border-rose-500/40 animate-bounce'
                      : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                  }`}>
                    <ShieldAlert className="h-5.5 w-5.5" />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Alertas Críticos (≥3x Motivo)
                    </p>
                    <h3 className="text-2xl font-black">
                      {reincidenciaData.totalCriticos}
                    </h3>
                  </div>
                </div>

                {/* KPI 3 */}
                <div className="rounded-2xl bg-slate-50 dark:bg-slate-950/60 p-4 border border-slate-200 dark:border-slate-800 flex items-center gap-3.5">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                    <AlertTriangle className="h-5.5 w-5.5" />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Total Sinalizações
                    </p>
                    <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100">
                      {reincidenciaData.filteredCount}
                    </h3>
                  </div>
                </div>

                {/* KPI 4 */}
                <div className="rounded-2xl bg-slate-50 dark:bg-slate-950/60 p-4 border border-slate-200 dark:border-slate-800 flex items-center gap-3.5">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                    <Flame className="h-5.5 w-5.5" />
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">
                      Top Motivo Recorrente
                    </p>
                    <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 truncate" title={reincidenciaData.topGlobalMotivo.motivo}>
                      {reincidenciaData.topGlobalMotivo.motivo} ({reincidenciaData.topGlobalMotivo.count}x)
                    </h3>
                  </div>
                </div>
              </div>

              {/* RED ALERT BANNER (If any critical reincidência >= 3x same motive) */}
              {reincidenciaData.totalCriticos > 0 && (
                <div className="rounded-2xl bg-gradient-to-r from-rose-500/20 via-red-500/15 to-rose-500/20 border-2 border-rose-500/50 p-4 sm:p-5 shadow-lg relative overflow-hidden flex items-start gap-4">
                  <div className="p-2 bg-rose-500 text-white rounded-xl shadow-md shrink-0 mt-0.5">
                    <ShieldAlert className="h-6 w-6 animate-pulse" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-rose-500 text-white tracking-widest shadow-2xs">
                        🚨 ALERTA CRÍTICO DE RISCO
                      </span>
                      <span className="text-xs font-bold text-rose-700 dark:text-rose-300">
                        {reincidenciaData.totalCriticos} operador(es) com 3 ou mais ocorrências DO MESMO MOTIVO
                      </span>
                    </div>
                    <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                      Foram identificadas reincidências repetidas na mesma causa raiz. É recomendado ação corretiva direta da supervisão para evitar degradação do SLA.
                    </p>
                  </div>
                </div>
              )}

              {/* AI DIAGNOSIS GENERATOR SECTION (Only visible to Planejamento and Administrador) */}
              {canAccessAiDiagnosis && (
                <div className="rounded-2xl bg-gradient-to-br from-blue-900/10 via-slate-900/5 to-cyan-900/10 dark:from-slate-950 dark:to-cyan-950/30 p-5 sm:p-6 border border-blue-200 dark:border-cyan-500/30 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-blue-600 dark:bg-cyan-500 text-white dark:text-slate-950">
                        <Sparkles className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-slate-100">
                          DIAGNÓSTICO INTELIGENTE COM IA (GEMINI)
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Gere um parecer executivo consolidado com diretrizes para supervisores
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={isGeneratingAi}
                      onClick={handleGenerateAiReport}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 text-white shadow-md hover:opacity-95 transition cursor-pointer disabled:opacity-50"
                    >
                      {isGeneratingAi ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Analisando com IA...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4" />
                          {aiDiagnosis ? 'Atualizar Diagnóstico IA' : 'Gerar Diagnóstico IA'}
                        </>
                      )}
                    </button>
                  </div>

                  {aiDiagnosis && (
                    <div className="rounded-xl bg-white dark:bg-slate-900 p-5 border border-slate-200 dark:border-slate-800 space-y-3 relative">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                        <span className="text-xs font-bold text-blue-600 dark:text-cyan-400 uppercase flex items-center gap-1.5">
                          <CheckCircle2 className="h-4 w-4" /> Parecer Emitido pela IA
                        </span>
                        <button
                          type="button"
                          onClick={handleCopyDiagnosis}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                        >
                          {copiedDiagnosis ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                          {copiedDiagnosis ? 'Copiado!' : 'Copiar'}
                        </button>
                      </div>
                      <div>
                        {renderFormattedMarkdown(aiDiagnosis)}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* LIST OF REINCIDENTES */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <Users className="h-4 w-4 text-blue-600 dark:text-cyan-400" />
                    Operadores Reincidentes ({reincidenciaData.totalReincidentes})
                  </h3>
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    Ordenado por Alerta Crítico (≥3x) e quantidade de ocorrências
                  </span>
                </div>

                {reincidenciaData.reincidentes.length === 0 ? (
                  <div className="rounded-2xl bg-slate-50 dark:bg-slate-950 p-8 text-center border border-slate-200 dark:border-slate-800 space-y-2">
                    <UserCheck className="h-10 w-10 text-emerald-500 mx-auto" />
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                      Nenhuma reincidência registrada no período selecionado!
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Todos os operadores do período possuem no máximo 1 ocorrência.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {reincidenciaData.reincidentes.map((op, idx) => (
                      <div
                        key={idx}
                        className={`rounded-2xl p-5 border transition-all space-y-3.5 ${
                          op.isCritical
                            ? 'bg-rose-500/5 dark:bg-rose-950/20 border-rose-500/40 shadow-md shadow-rose-500/5'
                            : 'bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800'
                        }`}
                      >
                        {/* Card Header */}
                        <div className="flex items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-black text-slate-900 dark:text-slate-100">
                                {op.operador}
                              </h4>
                              {op.isCritical && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-500 text-white animate-pulse">
                                  🚨 3x+ MESMO MOTIVO
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                              Supervisor: <span className="font-bold text-slate-700 dark:text-slate-300">{op.supervisor || 'Não informado'}</span>
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="px-2.5 py-1 rounded-xl text-xs font-black bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                              {op.total} reincidências
                            </span>
                          </div>
                        </div>

                        {/* Critical Warning inside card if applicable */}
                        {op.isCritical && op.criticalMotives.length > 0 && (
                          <div className="rounded-xl bg-rose-500/10 p-2.5 border border-rose-500/20 space-y-1">
                            <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1">
                              <ShieldAlert className="h-3.5 w-3.5" /> Reincidência Crítica no Mesmo Motivo:
                            </span>
                            <ul className="space-y-0.5 pl-4 text-xs font-semibold text-rose-700 dark:text-rose-300 list-disc">
                              {op.criticalMotives.map((cm, cIdx) => (
                                <li key={cIdx}>
                                  <strong>{cm.count}x</strong> &quot;{cm.motivo}&quot;
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Motivos Breakdown */}
                        <div className="space-y-2">
                          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                            Detalhamento de Motivos:
                          </p>
                          <div className="space-y-1.5">
                            {Object.entries(op.motivosMap).map(([motivo, countVal], mIdx) => {
                              const cnt = Number(countVal) || 0;
                              const isMotivoCritico = cnt >= 3;
                              const percent = Math.min(100, Math.round((cnt / op.total) * 100));
                              return (
                                <div key={mIdx} className="space-y-0.5">
                                  <div className="flex items-center justify-between text-xs font-semibold">
                                    <span className={isMotivoCritico ? 'text-rose-600 dark:text-rose-400 font-bold' : 'text-slate-700 dark:text-slate-300'}>
                                      {motivo}
                                    </span>
                                    <span className={isMotivoCritico ? 'text-rose-600 dark:text-rose-400 font-black' : 'text-slate-500 dark:text-slate-400'}>
                                      {cnt}x ({percent}%)
                                    </span>
                                  </div>
                                  <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                    <div
                                      className={`h-full rounded-full transition-all ${
                                        isMotivoCritico
                                          ? 'bg-rose-500'
                                          : 'bg-blue-600 dark:bg-cyan-500'
                                      }`}
                                      style={{ width: `${percent}%` }}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tabela Resumo */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 p-6 border border-slate-200/80 dark:border-slate-800 shadow-2xs transition-colors duration-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">Tabela Resumo das Sinalizações</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Registros consolidados conforme os filtros executivos selecionados
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 dark:text-slate-500" />
            <input
              type="text"
              placeholder="Pesquisar registro..."
              value={tableSearch}
              onChange={(e) => {
                setTableSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 pl-9 pr-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:border-blue-500 dark:focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-cyan-500/30 transition"
            />
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-950 font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Operador</th>
                <th className="px-4 py-3">Supervisor</th>
                <th className="px-4 py-3">Produto</th>
                <th className="px-4 py-3">Motivo</th>
                <th className="px-4 py-3">Usuário Registro</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 bg-white dark:bg-slate-900">
              {paginatedTable.length > 0 ? (
                paginatedTable.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition">
                    <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200 whitespace-nowrap">
                      {item.data} <span className="text-slate-400 dark:text-slate-500 text-[10px]">({item.hora})</span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                      {item.operador}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">{item.supervisor}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-md bg-blue-50 dark:bg-blue-500/10 px-2 py-1 text-[11px] font-medium text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-500/20">
                        {item.produto}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200 whitespace-nowrap">
                      {item.motivo}
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {item.usuario_responsavel}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                    Nenhum registro de sinalização encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-3">
            <div>
              Mostrando <span className="font-semibold text-slate-800 dark:text-slate-200">{paginatedTable.length}</span> de{' '}
              <span className="font-semibold text-slate-800 dark:text-slate-200">{filteredTable.length}</span> registros
            </div>
            <div className="flex items-center gap-1.5 ml-2">
              <span className="text-slate-400 dark:text-slate-500 font-medium">Exibir:</span>
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-2 py-1 font-semibold text-slate-700 dark:text-slate-300 focus:outline-none focus:border-blue-500"
              >
                <option value={10}>10 por página</option>
                <option value={25}>25 por página</option>
                <option value={50}>50 por página</option>
                <option value={100}>100 por página</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 py-1.5 font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </button>
            <span className="font-semibold text-slate-700 dark:text-slate-300 px-2">
              Página {currentPage} de {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 py-1.5 font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition cursor-pointer"
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
