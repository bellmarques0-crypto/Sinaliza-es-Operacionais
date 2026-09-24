import React, { useState, useEffect, useMemo } from 'react';
import {
  UserCheck,
  UserX,
  AlertCircle,
  Calendar,
  Search,
  Save,
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  Loader2,
  Users,
  ChevronLeft,
  ChevronRight,
  UserMinus,
  Sparkles,
  Copy,
  Check,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  ClipboardList
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { api } from '../services/api';
import { UserSession, Operador, Supervisor, RegistroAbsenteismo, AbsenteismoStatus } from '../types';
import { getBrasiliaDateParts, isSupervisorMatch } from '../utils/dateUtils';

interface AbsenteismoViewProps {
  user: UserSession;
}

// Helper to identify Desligado operators
const isDesligado = (situacao?: string) => {
  const s = (situacao || '').toLowerCase().trim();
  return s.includes('desligad') || s.includes('demitid');
};

// Helper to identify Afastado, Abandono, Inativo, Férias operators
const isIndisponivelSituacao = (situacao?: string) => {
  const s = (situacao || '').toLowerCase().trim();
  return (
    s.includes('afastad') ||
    s.includes('abandon') ||
    s.includes('inativ') ||
    s.includes('feria') ||
    s.includes('férias')
  );
};

// Helper to determine default status for an operator based on situation
const getDefaultStatus = (op: Operador): AbsenteismoStatus => {
  if (isIndisponivelSituacao(op.situacao)) {
    return 'Indisponível';
  }
  return 'Presente';
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
            <h3
              key={idx}
              className="text-sm sm:text-base font-black text-slate-900 dark:text-slate-100 mt-4 mb-2 flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-1.5 uppercase tracking-wide"
            >
              {trimmed.replace('### ', '')}
            </h3>
          );
        }

        if (trimmed.startsWith('#### ')) {
          return (
            <h4
              key={idx}
              className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-blue-600 dark:text-cyan-400 mt-3 mb-1"
            >
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

        return <p key={idx}>{renderBoldText(trimmed)}</p>;
      })}
    </div>
  );
};

export const AbsenteismoView: React.FC<AbsenteismoViewProps> = ({ user }) => {
  // Top Navigation mode toggle: 'controle' vs 'relatorios_ia'
  const [viewMode, setViewMode] = useState<'controle' | 'relatorios_ia'>('controle');

  // Date state (defaults to today's date YYYY-MM-DD in Brasilia time)
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const { year, month, day } = getBrasiliaDateParts();
    return `${year}-${month}-${day}`;
  });

  // Search & Filter states for daily control
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSupervisor, setSelectedSupervisor] = useState<string>('Todos');
  const [statusFilter, setStatusFilter] = useState<string>('Todos');

  // Data states
  const [operadoresList, setOperadoresList] = useState<Operador[]>([]);
  const [supervisoresList, setSupervisoresList] = useState<Supervisor[]>([]);
  const [recordsMap, setRecordsMap] = useState<Record<string, RegistroAbsenteismo>>({});

  // UI states
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  // States for AI Absence Reports ('relatorios_ia')
  const [allAbsenceRecords, setAllAbsenceRecords] = useState<RegistroAbsenteismo[]>([]);
  const [isLoadingAll, setIsLoadingAll] = useState(false);
  const [relatorioPeriodo, setRelatorioPeriodo] = useState<'dia' | 'semana' | 'mes' | 'tudo' | 'custom'>('semana');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [reportSupFilter, setReportSupFilter] = useState<string>('Todos');
  const [reportTypeFilter, setReportTypeFilter] = useState<string>('Todos');
  const [reportSearchOp, setReportSearchOp] = useState<string>('');
  const [expandedOp, setExpandedOp] = useState<string | null>(null);

  // AI Diagnosis state
  const [aiDiagnosis, setAiDiagnosis] = useState<string>('');
  const [isGeneratingAi, setIsGeneratingAi] = useState<boolean>(false);
  const [copiedDiagnosis, setCopiedDiagnosis] = useState<boolean>(false);

  // Load operators & supervisors dropdown options
  useEffect(() => {
    let isCancelled = false;

    const loadInitialData = async () => {
      try {
        const [ops, sups] = await Promise.all([
          api.getOperadores(),
          api.getSupervisores()
        ]);
        if (!isCancelled) {
          setOperadoresList(ops);
          setSupervisoresList(sups);
        }
      } catch (err: any) {
        if (!isCancelled) {
          console.error('Erro ao carregar lista de operadores:', err);
        }
      }
    };

    void loadInitialData();

    return () => {
      isCancelled = true;
    };
  }, []);

  // Fetch absenteísmo records whenever selectedDate changes
  useEffect(() => {
    let isCancelled = false;

    const fetchRecords = async () => {
      setIsLoading(true);
      setErrorMsg(null);
      try {
        const fetched = await api.getAbsenteismo(selectedDate);
        if (!isCancelled) {
          const map: Record<string, RegistroAbsenteismo> = {};
          if (Array.isArray(fetched)) {
            fetched.forEach((rec) => {
              if (rec && rec.operador) {
                const key = rec.operador.toLowerCase().trim();
                map[key] = rec;
              }
            });
          }
          setRecordsMap(map);
          setIsDirty(false);
        }
      } catch (err: any) {
        if (!isCancelled) {
          console.error('Erro ao buscar registros de absenteísmo:', err);
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    void fetchRecords();

    return () => {
      isCancelled = true;
    };
  }, [selectedDate]);

  // Load all absence records when switching to AI Absence Reports view
  const loadAllAbsenceRecords = async () => {
    setIsLoadingAll(true);
    try {
      const records = await api.getAbsenteismo(undefined, true);
      if (Array.isArray(records)) {
        setAllAbsenceRecords(records);
      }
    } catch (err) {
      console.error('Erro ao carregar histórico completo de absenteísmo:', err);
    } finally {
      setIsLoadingAll(false);
    }
  };

  useEffect(() => {
    if (viewMode === 'relatorios_ia') {
      void loadAllAbsenceRecords();
    }
  }, [viewMode]);

  // Helper to check if operator cargo is Operador/ Atendente
  const isOperadorAtendenteCargo = (cargo?: string) => {
    if (!cargo) return true;
    const c = cargo.toLowerCase().trim();
    return c.includes('operador') || c.includes('atendente');
  };

  // Filter operators by user profile access, cargo ("Operador/ Atendente"), desligado status (except history), and search filters
  const filteredOperadores = useMemo(() => {
    return operadoresList.filter((op) => {
      if (!isOperadorAtendenteCargo(op.cargo)) {
        return false;
      }

      const key = op.nome.toLowerCase().trim();
      const hasSavedRecord = !!recordsMap[key];

      if (isDesligado(op.situacao) && !hasSavedRecord) {
        return false;
      }

      if (user.perfil === 'Supervisor' || user.perfil === 'Operação') {
        const matchesSup = isSupervisorMatch(user.nome, user.login, op.supervisor);
        if (!matchesSup) return false;
      }

      if (selectedSupervisor !== 'Todos') {
        if (op.supervisor.toLowerCase().trim() !== selectedSupervisor.toLowerCase().trim()) {
          return false;
        }
      }

      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim();
        const matchesOp = op.nome.toLowerCase().includes(term);
        const matchesSup = op.supervisor.toLowerCase().includes(term);
        if (!matchesOp && !matchesSup) return false;
      }

      if (statusFilter !== 'Todos') {
        const currentRec = recordsMap[key];
        const defaultStatus = getDefaultStatus(op);
        const currentStatus = currentRec?.status || defaultStatus;
        if (currentStatus !== statusFilter) return false;
      }

      return true;
    });
  }, [operadoresList, user, selectedSupervisor, searchTerm, statusFilter, recordsMap]);

  // All operators accessible to the current user (ignoring search text & status dropdown filters)
  const accessibleOperadores = useMemo(() => {
    return operadoresList.filter((op) => {
      if (!isOperadorAtendenteCargo(op.cargo)) return false;
      const key = op.nome.toLowerCase().trim();
      const hasSavedRecord = !!recordsMap[key];
      if (isDesligado(op.situacao) && !hasSavedRecord) return false;
      if (user.perfil === 'Supervisor' || user.perfil === 'Operação') {
        const matchesSup = isSupervisorMatch(user.nome, user.login, op.supervisor);
        if (!matchesSup) return false;
      }
      return true;
    });
  }, [operadoresList, user, recordsMap]);

  // Calculate Metrics Summary for the current visible list
  const metrics = useMemo(() => {
    let total = filteredOperadores.length;
    let presentes = 0;
    let faltaInjustificada = 0;
    let faltaJustificada = 0;
    let indisponiveis = 0;

    filteredOperadores.forEach((op) => {
      const key = op.nome.toLowerCase().trim();
      const rec = recordsMap[key];
      const defaultStatus = getDefaultStatus(op);
      const status = rec?.status || defaultStatus;

      if (status === 'Presente') presentes++;
      else if (status === 'Falta Injustificada') faltaInjustificada++;
      else if (status === 'Falta Justificada') faltaJustificada++;
      else if (status === 'Indisponível') indisponiveis++;
    });

    const totalFaltas = faltaInjustificada + faltaJustificada;
    const taxaAbsenteismo = total > 0 ? ((totalFaltas / total) * 100).toFixed(1) : '0.0';

    return {
      total,
      presentes,
      faltaInjustificada,
      faltaJustificada,
      indisponiveis,
      totalFaltas,
      taxaAbsenteismo
    };
  }, [filteredOperadores, recordsMap]);

  // Calculate Aggregated Data for AI Absence Report ('relatorios_ia')
  const absenceReportData = useMemo(() => {
    const { year, month, day } = getBrasiliaDateParts();
    const todayStr = `${year}-${month}-${day}`;
    const todayDate = new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));

    let minDateStr = '';
    let maxDateStr = todayStr;

    if (relatorioPeriodo === 'dia') {
      minDateStr = todayStr;
    } else if (relatorioPeriodo === 'semana') {
      const d = new Date(todayDate);
      d.setDate(d.getDate() - 7);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      minDateStr = `${yyyy}-${mm}-${dd}`;
    } else if (relatorioPeriodo === 'mes') {
      const d = new Date(todayDate);
      d.setDate(d.getDate() - 30);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      minDateStr = `${yyyy}-${mm}-${dd}`;
    } else if (relatorioPeriodo === 'custom') {
      minDateStr = customStartDate;
      maxDateStr = customEndDate;
    }

    const filteredRecords = allAbsenceRecords.filter((rec) => {
      if (!rec) return false;
      if (minDateStr && rec.data < minDateStr) return false;
      if (maxDateStr && rec.data > maxDateStr) return false;

      if (user.perfil === 'Supervisor' || user.perfil === 'Operação') {
        if (!isSupervisorMatch(user.nome, user.login, rec.supervisor)) return false;
      }

      if (reportSupFilter !== 'Todos') {
        if (rec.supervisor.toLowerCase().trim() !== reportSupFilter.toLowerCase().trim()) return false;
      }

      if (reportTypeFilter !== 'Todos') {
        if (rec.status !== reportTypeFilter) return false;
      } else {
        if (rec.status !== 'Falta Injustificada' && rec.status !== 'Falta Justificada') {
          return false;
        }
      }

      if (reportSearchOp.trim()) {
        const term = reportSearchOp.toLowerCase().trim();
        const matchOp = rec.operador.toLowerCase().includes(term);
        const matchSup = rec.supervisor.toLowerCase().includes(term);
        if (!matchOp && !matchSup) return false;
      }

      return true;
    });

    const mapByOp: Record<
      string,
      {
        operador: string;
        supervisor: string;
        injustificadas: number;
        justificadas: number;
        totalFaltas: number;
        registros: RegistroAbsenteismo[];
        riskLevel: 'Critico' | 'Atencao' | 'Moderado';
      }
    > = {};

    let totalInjustificadas = 0;
    let totalJustificadas = 0;

    filteredRecords.forEach((rec) => {
      const key = rec.operador.toLowerCase().trim();
      if (!mapByOp[key]) {
        mapByOp[key] = {
          operador: rec.operador,
          supervisor: rec.supervisor,
          injustificadas: 0,
          justificadas: 0,
          totalFaltas: 0,
          registros: [],
          riskLevel: 'Moderado'
        };
      }

      mapByOp[key].registros.push(rec);
      mapByOp[key].totalFaltas += 1;

      if (rec.status === 'Falta Injustificada') {
        mapByOp[key].injustificadas += 1;
        totalInjustificadas += 1;
      } else if (rec.status === 'Falta Justificada') {
        mapByOp[key].justificadas += 1;
        totalJustificadas += 1;
      }
    });

    const list = Object.values(mapByOp).map((op) => {
      let riskLevel: 'Critico' | 'Atencao' | 'Moderado' = 'Moderado';
      if (op.injustificadas >= 2 || op.totalFaltas >= 3) {
        riskLevel = 'Critico';
      } else if (op.totalFaltas === 2) {
        riskLevel = 'Atencao';
      }
      return { ...op, riskLevel };
    });

    list.sort((a, b) => {
      if (b.totalFaltas !== a.totalFaltas) return b.totalFaltas - a.totalFaltas;
      if (b.injustificadas !== a.injustificadas) return b.injustificadas - a.injustificadas;
      return a.operador.localeCompare(b.operador);
    });

    const totalCriticos = list.filter((item) => item.riskLevel === 'Critico').length;
    const totalFaltas = totalInjustificadas + totalJustificadas;

    return {
      filteredRecords,
      operadoresList: list,
      totalFaltas,
      totalInjustificadas,
      totalJustificadas,
      totalOperadores: list.length,
      totalCriticos
    };
  }, [
    allAbsenceRecords,
    relatorioPeriodo,
    customStartDate,
    customEndDate,
    user,
    reportSupFilter,
    reportTypeFilter,
    reportSearchOp
  ]);

  // Handle local state updates for operator record
  const handleRecordChange = (
    operadorName: string,
    supervisorName: string,
    field: 'status' | 'observacao',
    value: string
  ) => {
    const key = operadorName.toLowerCase().trim();
    const opObj = operadoresList.find((o) => o.nome.toLowerCase().trim() === key);
    const defaultStatus = opObj ? getDefaultStatus(opObj) : 'Presente';

    const existing = recordsMap[key] || {
      data: selectedDate,
      operador: operadorName,
      supervisor: supervisorName,
      status: defaultStatus,
      observacao: ''
    };

    let updatedValue = value;
    if (field === 'observacao' && value.length > 100) {
      updatedValue = value.substring(0, 100);
    }

    const updatedRec: RegistroAbsenteismo = {
      ...existing,
      supervisor: supervisorName,
      data: selectedDate,
      [field]: updatedValue
    };

    setRecordsMap((prev) => ({
      ...prev,
      [key]: updatedRec
    }));
    setIsDirty(true);
  };

  // Quick Action: Mark all visible active operators as "Presente"
  const handleMarkAllPresent = () => {
    const newMap = { ...recordsMap };
    filteredOperadores.forEach((op) => {
      const key = op.nome.toLowerCase().trim();
      const defaultStatus = getDefaultStatus(op);

      if (defaultStatus === 'Indisponível') return;

      const existing = newMap[key] || {
        data: selectedDate,
        operador: op.nome,
        supervisor: op.supervisor,
        status: defaultStatus,
        observacao: ''
      };
      newMap[key] = {
        ...existing,
        status: 'Presente'
      };
    });
    setRecordsMap(newMap);
    setIsDirty(true);
  };

  // Save changes to backend database
  const handleSaveBatch = async () => {
    setIsSaving(true);
    setSaveSuccessMsg(null);
    setErrorMsg(null);

    try {
      const targetOpsMap = new Map<string, { nome: string; supervisor: string; situacao?: string; cargo?: string }>();

      accessibleOperadores.forEach((op) => {
        targetOpsMap.set(op.nome.toLowerCase().trim(), op);
      });

      Object.keys(recordsMap).forEach((k) => {
        const r = recordsMap[k];
        if (r && r.data === selectedDate && !targetOpsMap.has(k)) {
          targetOpsMap.set(k, { nome: r.operador, supervisor: r.supervisor });
        }
      });

      const payload: RegistroAbsenteismo[] = Array.from(targetOpsMap.values()).map((op) => {
        const key = op.nome.toLowerCase().trim();
        const rec = recordsMap[key];
        const defaultStatus = getDefaultStatus(op as Operador);
        return {
          data: selectedDate,
          operador: op.nome,
          supervisor: op.supervisor,
          status: rec?.status || defaultStatus,
          observacao: (rec?.observacao || '').substring(0, 100),
          usuario_registro: user.nome
        };
      });

      const res = await api.saveAbsenteismoBatch(payload);

      if (res && Array.isArray(res.data)) {
        setRecordsMap((prev) => {
          const nextMap: Record<string, RegistroAbsenteismo> = { ...prev };
          res.data.forEach((r) => {
            if (r && r.data === selectedDate && r.operador) {
              const k = r.operador.toLowerCase().trim();
              nextMap[k] = r;
            }
          });
          return nextMap;
        });
      }

      setIsDirty(false);
      setSaveSuccessMsg('Controle de absenteísmo salvo com sucesso!');
      setTimeout(() => setSaveSuccessMsg(null), 4000);
    } catch (err: any) {
      console.error('Erro ao salvar absenteísmo:', err);
      const rawMsg = String(err?.message || '');
      if (rawMsg.toLowerCase().includes('aborted') || rawMsg.toLowerCase().includes('signal') || rawMsg.toLowerCase().includes('tempo limite')) {
        setErrorMsg('Tempo limite excedido ao salvar os dados. Por favor, tente novamente.');
      } else {
        setErrorMsg(err.message || 'Erro ao salvar os registros de absenteísmo.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Date step helper (e.g. +1 day, -1 day)
  const handleStepDate = (days: number) => {
    const parts = selectedDate.split('-');
    if (parts.length === 3) {
      const dt = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      dt.setDate(dt.getDate() + days);
      const yyyy = dt.getFullYear();
      const mm = String(dt.getMonth() + 1).padStart(2, '0');
      const dd = String(dt.getDate()).padStart(2, '0');
      setSelectedDate(`${yyyy}-${mm}-${dd}`);
    }
  };

  // Export current daily list to Excel
  const handleExportExcel = () => {
    const rows = filteredOperadores.map((op) => {
      const key = op.nome.toLowerCase().trim();
      const rec = recordsMap[key];
      const defaultStatus = getDefaultStatus(op);
      return {
        Data: selectedDate,
        'Nome do Operador': op.nome,
        Supervisor: op.supervisor,
        Situação: op.situacao || 'Ativo',
        Status: rec?.status || defaultStatus,
        Observação: rec?.observacao || ''
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Controle_Absenteismo');
    XLSX.writeFile(wb, `Controle_Absenteismo_${selectedDate}.xlsx`);
  };

  // Generate AI Diagnosis Report for Absences
  const handleGenerateAiReport = async () => {
    setIsGeneratingAi(true);
    try {
      const res = await api.gerarRelatorioAbsenteismoIa({
        periodo: relatorioPeriodo,
        totalFaltas: absenceReportData.totalFaltas,
        totalInjustificadas: absenceReportData.totalInjustificadas,
        totalJustificadas: absenceReportData.totalJustificadas,
        operadoresComFaltas: absenceReportData.operadoresList
      });

      if (res && res.diagnosis) {
        setAiDiagnosis(res.diagnosis);
      }
    } catch (err) {
      console.error('Erro ao gerar relatório de absenteísmo com IA:', err);
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

  // Export Aggregated Absence Report to Excel
  const handleExportAbsenceExcel = () => {
    const rows = absenceReportData.operadoresList.map((item, idx) => ({
      '#': idx + 1,
      'Nome do Operador': item.operador,
      Supervisor: item.supervisor,
      'Faltas Injustificadas': item.injustificadas,
      'Faltas Justificadas': item.justificadas,
      'Total de Faltas': item.totalFaltas,
      'Nível de Risco': item.riskLevel === 'Critico' ? 'Crítico (≥2 Injustificadas ou ≥3 Total)' : item.riskLevel === 'Atencao' ? 'Atenção (2 Faltas)' : 'Moderado (1 Falta)',
      'Datas das Faltas': item.registros.map((r) => `${r.data} (${r.status}${r.observacao ? `: ${r.observacao}` : ''})`).join('; ')
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Análise_Faltas_Operadores');
    XLSX.writeFile(wb, `Relatorio_Faltas_Operadores_${relatorioPeriodo}.xlsx`);
  };

  return (
    <div className="space-y-6 pb-12 transition-colors duration-200">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 sm:p-6 rounded-3xl shadow-lg transition-colors duration-200">
        <div className="flex items-center gap-3.5">
          <div className="h-12 w-12 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-cyan-400 border border-blue-500/20 flex items-center justify-center shadow-xs">
            <UserCheck className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              CONTROLE DE ABSENTEÍSMO
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
              Validação diária de frequência, faltas justificadas/injustificadas e indisponibilidades
            </p>
          </div>
        </div>

        {/* View Mode Toggle Sub-Tabs */}
        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-950 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setViewMode('controle')}
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              viewMode === 'controle'
                ? 'bg-blue-600 dark:bg-cyan-500 text-white dark:text-slate-950 shadow-md'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <UserCheck className="h-4 w-4" />
            <span>Controle Diário</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('relatorios_ia')}
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              viewMode === 'relatorios_ia'
                ? 'bg-blue-600 dark:bg-cyan-500 text-white dark:text-slate-950 shadow-md'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <ClipboardList className="h-4 w-4" />
            <span>Análise de Faltas</span>
          </button>
        </div>

        {/* Action Buttons for Controle Diário */}
        {viewMode === 'controle' && (
          <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
            <button
              type="button"
              onClick={handleExportExcel}
              title="Exportar Excel"
              className="inline-flex items-center justify-center p-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 transition cursor-pointer"
            >
              <FileSpreadsheet className="h-5 w-5" />
            </button>

            <button
              type="button"
              onClick={handleSaveBatch}
              disabled={isSaving || filteredOperadores.length === 0}
              title={isSaving ? 'Salvando...' : 'Salvar Alterações'}
              className="inline-flex items-center justify-center p-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 dark:bg-cyan-500 dark:hover:bg-cyan-600 text-white dark:text-slate-950 shadow-md shadow-blue-600/20 dark:shadow-cyan-500/20 transition cursor-pointer disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
            </button>
          </div>
        )}
      </div>

      {/* MODE 1: CONTROLE DIÁRIO */}
      {viewMode === 'controle' && (
        <>
          {/* Date & Filters Bar */}
          <div className="rounded-2xl bg-white dark:bg-slate-900 p-5 border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-end">
              {/* Date Picker */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-blue-500 dark:text-cyan-400" />
                  Data de Controle
                </label>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleStepDate(-1)}
                    className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                    title="Dia anterior"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-200 focus:border-blue-500 dark:focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-blue-500/20 dark:focus:ring-cyan-500/30 transition text-center"
                  />
                  <button
                    type="button"
                    onClick={() => handleStepDate(1)}
                    className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                    title="Próximo dia"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Supervisor Filter */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Supervisor
                </label>
                <select
                  value={selectedSupervisor}
                  onChange={(e) => setSelectedSupervisor(e.target.value)}
                  className="w-full rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:border-blue-500 dark:focus:border-cyan-500 focus:outline-none transition"
                >
                  <option value="Todos">Todos os Supervisores</option>
                  {supervisoresList
                    .filter((s) => {
                      if (user.perfil === 'Supervisor' || user.perfil === 'Operação') {
                        return isSupervisorMatch(user.nome, user.login, s.nome);
                      }
                      return true;
                    })
                    .map((s, idx) => (
                      <option key={`abs-sup-${s.id}-${s.nome}-${idx}`} value={s.nome}>
                        {s.nome}
                      </option>
                    ))}
                </select>
              </div>

              {/* Status Filter */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Status de Presença
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:border-blue-500 dark:focus:border-cyan-500 focus:outline-none transition"
                >
                  <option value="Todos">Todos os Status</option>
                  <option value="Presente">Presente</option>
                  <option value="Falta Injustificada">Falta Injustificada</option>
                  <option value="Falta Justificada">Falta Justificada</option>
                  <option value="Indisponível">Indisponível</option>
                </select>
              </div>

              {/* Search Term */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Buscar Operador
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Nome do operador..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 pl-9 pr-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:border-blue-500 dark:focus:border-cyan-500 focus:outline-none transition"
                  />
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                </div>
              </div>
            </div>

            {/* Quick Batch Actions */}
            <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex-wrap">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleMarkAllPresent}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 px-3 py-1.5 text-xs font-bold hover:bg-emerald-500/20 transition cursor-pointer"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Marcar todos como Presente
                </button>
              </div>

              {isDirty && (
                <span className="text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5 animate-pulse">
                  <AlertCircle className="h-3.5 w-3.5" />
                  Você possui alterações não salvas. Clique em "Salvar Alterações".
                </span>
              )}
            </div>
          </div>

          {/* Notifications / Toast Feedback */}
          {saveSuccessMsg && (
            <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/30 p-4 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{saveSuccessMsg}</span>
            </div>
          )}
          {errorMsg && (
            <div className="rounded-2xl bg-rose-500/10 border border-rose-500/30 p-4 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* KPI Metric Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {/* Total Operadores */}
            <div className="rounded-2xl bg-white dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800 flex items-center gap-3 shadow-2xs">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-cyan-400 border border-blue-500/20">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Total
                </p>
                <h3 className="text-xl font-black text-slate-900 dark:text-slate-100">{metrics.total}</h3>
              </div>
            </div>

            {/* Presentes */}
            <div className="rounded-2xl bg-white dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800 flex items-center gap-3 shadow-2xs">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <UserCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Presentes
                </p>
                <h3 className="text-xl font-black text-emerald-600 dark:text-emerald-400">{metrics.presentes}</h3>
              </div>
            </div>

            {/* Faltas Injustificadas */}
            <div className="rounded-2xl bg-white dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800 flex items-center gap-3 shadow-2xs">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                <UserX className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Injustificadas
                </p>
                <h3 className="text-xl font-black text-rose-600 dark:text-rose-400">{metrics.faltaInjustificada}</h3>
              </div>
            </div>

            {/* Faltas Justificadas */}
            <div className="rounded-2xl bg-white dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800 flex items-center gap-3 shadow-2xs">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Justificadas
                </p>
                <h3 className="text-xl font-black text-amber-600 dark:text-amber-400">{metrics.faltaJustificada}</h3>
              </div>
            </div>

            {/* Indisponíveis */}
            <div className="rounded-2xl bg-white dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800 flex items-center gap-3 shadow-2xs">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                <UserMinus className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Indisponíveis
                </p>
                <h3 className="text-xl font-black text-purple-600 dark:text-purple-400">{metrics.indisponiveis}</h3>
              </div>
            </div>

            {/* Taxa de Absenteísmo */}
            <div className="rounded-2xl bg-white dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800 flex items-center gap-3 shadow-2xs">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Taxa Absenteísmo
                </p>
                <h3 className="text-xl font-black text-slate-700 dark:text-slate-300">{metrics.taxaAbsenteismo}%</h3>
              </div>
            </div>
          </div>

          {/* Main Absenteísmo Data Table */}
          <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden">
            {isLoading ? (
              <div className="p-12 text-center flex flex-col items-center justify-center gap-3 text-slate-400">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                <p className="text-xs font-semibold">Carregando controle de absenteísmo...</p>
              </div>
            ) : filteredOperadores.length === 0 ? (
              <div className="p-12 text-center text-slate-400 dark:text-slate-500">
                <Users className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm font-semibold">Nenhum operador encontrado para os filtros selecionados.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100/80 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800 text-[11px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                      <th className="px-5 py-4">#</th>
                      <th className="px-5 py-4">Nome Completo do Operador</th>
                      <th className="px-5 py-4">Supervisor</th>
                      <th className="px-5 py-4 w-56">Validação (Status)</th>
                      <th className="px-5 py-4">Observação (Máx 100 caract.)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                    {filteredOperadores.map((op, idx) => {
                      const key = op.nome.toLowerCase().trim();
                      const defaultStatus = getDefaultStatus(op);
                      const rec = recordsMap[key] || {
                        data: selectedDate,
                        operador: op.nome,
                        supervisor: op.supervisor,
                        status: defaultStatus,
                        observacao: ''
                      };

                      const currentStatus = rec.status || defaultStatus;
                      const currentObs = rec.observacao || '';

                      return (
                        <tr
                          key={op.id || idx}
                          className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          <td className="px-5 py-3.5 font-bold text-slate-400">{idx + 1}</td>
                          <td className="px-5 py-3.5 font-bold text-slate-900 dark:text-slate-100">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span>{op.nome}</span>
                              {op.situacao && (
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                                    isDesligado(op.situacao)
                                      ? 'bg-rose-100 dark:bg-rose-950/90 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                                      : isIndisponivelSituacao(op.situacao)
                                      ? 'bg-purple-100 dark:bg-purple-950/90 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                                  }`}
                                >
                                  {op.situacao}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-5 py-3.5 font-semibold text-slate-600 dark:text-slate-400">
                            {op.supervisor}
                          </td>
                          <td className="px-5 py-3.5">
                            <select
                              value={currentStatus}
                              onChange={(e) =>
                                handleRecordChange(
                                  op.nome,
                                  op.supervisor,
                                  'status',
                                  e.target.value as AbsenteismoStatus
                                )
                              }
                              className={`w-full rounded-xl border px-3 py-1.5 text-xs font-bold focus:outline-none transition cursor-pointer ${
                                currentStatus === 'Presente'
                                  ? 'bg-emerald-50 dark:bg-emerald-950/80 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                                  : currentStatus === 'Falta Injustificada'
                                  ? 'bg-rose-50 dark:bg-rose-950/80 border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300'
                                  : currentStatus === 'Falta Justificada'
                                  ? 'bg-amber-50 dark:bg-amber-950/80 border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300'
                                  : 'bg-purple-50 dark:bg-purple-950/80 border-purple-300 dark:border-purple-800 text-purple-700 dark:text-purple-300'
                              }`}
                            >
                              <option value="Presente">Presente</option>
                              <option value="Falta Injustificada">Falta Injustificada</option>
                              <option value="Falta Justificada">Falta Justificada</option>
                              <option value="Indisponível">Indisponível</option>
                            </select>
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="relative flex items-center">
                              <input
                                type="text"
                                maxLength={100}
                                value={currentObs}
                                onChange={(e) =>
                                  handleRecordChange(op.nome, op.supervisor, 'observacao', e.target.value)
                                }
                                placeholder="Observação (máx 100 caracteres)..."
                                className="w-full rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 pl-3 pr-14 py-1.5 text-xs font-medium text-slate-800 dark:text-slate-200 focus:border-blue-500 dark:focus:border-cyan-500 focus:outline-none"
                              />
                              <span
                                className={`absolute right-2 text-[10px] font-bold ${
                                  currentObs.length >= 90 ? 'text-amber-500' : 'text-slate-400'
                                }`}
                              >
                                {currentObs.length}/100
                              </span>
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
        </>
      )}

      {/* MODE 2: ANÁLISE DE FALTAS DE OPERADORES COM IA */}
      {viewMode === 'relatorios_ia' && (
        <div className="space-y-6">
          {/* Filters Bar */}
          <div className="rounded-2xl bg-white dark:bg-slate-900 p-5 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
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
                  Todo o Período
                </button>
                <button
                  type="button"
                  onClick={() => setRelatorioPeriodo('custom')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    relatorioPeriodo === 'custom'
                      ? 'bg-blue-600 dark:bg-cyan-500 text-white dark:text-slate-950 shadow-xs'
                      : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Personalizado
                </button>
              </div>
            </div>

            {relatorioPeriodo === 'custom' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">Data Inicial</label>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="w-full rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 px-3 py-1.5 text-xs font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">Data Final</label>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="w-full rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 px-3 py-1.5 text-xs font-semibold"
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Supervisor
                </label>
                <select
                  value={reportSupFilter}
                  onChange={(e) => setReportSupFilter(e.target.value)}
                  className="w-full rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none"
                >
                  <option value="Todos">Todos os Supervisores</option>
                  {supervisoresList
                    .filter((s) => {
                      if (user.perfil === 'Supervisor' || user.perfil === 'Operação') {
                        return isSupervisorMatch(user.nome, user.login, s.nome);
                      }
                      return true;
                    })
                    .map((s, idx) => (
                      <option key={`rep-sup-${s.id}-${s.nome}-${idx}`} value={s.nome}>
                        {s.nome}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Tipo de Falta
                </label>
                <select
                  value={reportTypeFilter}
                  onChange={(e) => setReportTypeFilter(e.target.value)}
                  className="w-full rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none"
                >
                  <option value="Todos">Todas as Faltas (Justificadas e Injustificadas)</option>
                  <option value="Falta Injustificada">Apenas Faltas Injustificadas</option>
                  <option value="Falta Justificada">Apenas Faltas Justificadas</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Buscar Operador
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Buscar por operador ou supervisor..."
                    value={reportSearchOp}
                    onChange={(e) => setReportSearchOp(e.target.value)}
                    className="w-full rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 pl-9 pr-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none"
                  />
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                </div>
              </div>
            </div>
          </div>

          {/* 4 Summary KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-2xl bg-rose-500/10 border border-rose-500/30 p-4 flex items-center gap-3.5 shadow-2xs">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                <UserX className="h-5.5 w-5.5" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Faltas Injustificadas
                </p>
                <h3 className="text-2xl font-black text-rose-600 dark:text-rose-400">
                  {absenceReportData.totalInjustificadas}
                </h3>
              </div>
            </div>

            <div className="rounded-2xl bg-amber-500/10 border border-amber-500/30 p-4 flex items-center gap-3.5 shadow-2xs">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                <AlertCircle className="h-5.5 w-5.5" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Faltas Justificadas
                </p>
                <h3 className="text-2xl font-black text-amber-600 dark:text-amber-400">
                  {absenceReportData.totalJustificadas}
                </h3>
              </div>
            </div>

            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 flex items-center gap-3.5 shadow-2xs">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-cyan-400 border border-blue-500/20">
                <Users className="h-5.5 w-5.5" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Operadores Envolvidos
                </p>
                <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100">
                  {absenceReportData.totalOperadores} <span className="text-xs font-medium text-slate-400">op(s)</span>
                </h3>
              </div>
            </div>

            <div
              className={`rounded-2xl p-4 border transition-all flex items-center gap-3.5 ${
                absenceReportData.totalCriticos > 0
                  ? 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300 shadow-md shadow-rose-500/10'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
              }`}
            >
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${
                  absenceReportData.totalCriticos > 0
                    ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400 border-rose-500/40 animate-bounce'
                    : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                }`}
              >
                <ShieldAlert className="h-5.5 w-5.5" />
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Alertas Críticos (≥2x Faltas)
                </p>
                <h3 className="text-2xl font-black">{absenceReportData.totalCriticos}</h3>
              </div>
            </div>
          </div>

          {absenceReportData.totalCriticos > 0 && (
            <div className="rounded-2xl bg-gradient-to-r from-rose-500/20 via-red-500/15 to-rose-500/20 border-2 border-rose-500/50 p-4 sm:p-5 shadow-lg flex items-start gap-4">
              <div className="p-2 bg-rose-500 text-white rounded-xl shadow-md shrink-0 mt-0.5">
                <ShieldAlert className="h-6 w-6 animate-pulse" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-rose-500 text-white tracking-widest shadow-2xs">
                    🚨 ALERTA CRÍTICO DE ABSENTEÍSMO
                  </span>
                  <span className="text-xs font-bold text-rose-700 dark:text-rose-300">
                    {absenceReportData.totalCriticos} operador(es) com faltas recorrentes registradas no período
                  </span>
                </div>
                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                  Recomendado alinhamento imediato com a supervisão responsável e aplicação das entrevistas de retorno para estancar ausências recorrentes.
                </p>
              </div>
            </div>
          )}



          {/* Breakdown Table of Operator Absences */}
          <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden space-y-4 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-slate-100">
                  DETALHAMENTO DE FALTAS POR OPERADOR
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Controle individual de ausências, justificativas e nível de risco
                </p>
              </div>

              <button
                type="button"
                onClick={handleExportAbsenceExcel}
                disabled={absenceReportData.operadoresList.length === 0}
                title="Exportar Relatório Excel"
                className="inline-flex items-center justify-center p-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-md transition cursor-pointer disabled:opacity-50"
              >
                <FileSpreadsheet className="h-5 w-5" />
              </button>
            </div>

            {isLoadingAll ? (
              <div className="p-12 text-center flex flex-col items-center justify-center gap-3 text-slate-400">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                <p className="text-xs font-semibold">Carregando histórico de faltas...</p>
              </div>
            ) : absenceReportData.operadoresList.length === 0 ? (
              <div className="p-12 text-center text-slate-400 dark:text-slate-500">
                <CheckCircle2 className="h-10 w-10 mx-auto mb-2 opacity-50 text-emerald-500" />
                <p className="text-sm font-semibold">Nenhuma falta registrada no período para os filtros selecionados.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100/80 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800 text-[11px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                      <th className="px-4 py-3">#</th>
                      <th className="px-4 py-3">Nome do Operador</th>
                      <th className="px-4 py-3">Supervisor</th>
                      <th className="px-4 py-3 text-center">Faltas Injustificadas</th>
                      <th className="px-4 py-3 text-center">Faltas Justificadas</th>
                      <th className="px-4 py-3 text-center">Total Faltas</th>
                      <th className="px-4 py-3 text-center">Nível de Risco</th>
                      <th className="px-4 py-3 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                    {absenceReportData.operadoresList.map((opItem, idx) => {
                      const isExpanded = expandedOp === opItem.operador;
                      return (
                        <React.Fragment key={`abs-row-${opItem.operador}-${idx}`}>
                          <tr className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                            <td className="px-4 py-3 font-bold text-slate-400">{idx + 1}</td>
                            <td className="px-4 py-3 font-bold text-slate-900 dark:text-slate-100">{opItem.operador}</td>
                            <td className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-400">{opItem.supervisor}</td>
                            <td className="px-4 py-3 text-center">
                              <span
                                className={`px-2.5 py-1 rounded-full font-black text-xs ${
                                  opItem.injustificadas > 0
                                    ? 'bg-rose-100 dark:bg-rose-950/90 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                                    : 'text-slate-400'
                                }`}
                              >
                                {opItem.injustificadas}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span
                                className={`px-2.5 py-1 rounded-full font-black text-xs ${
                                  opItem.justificadas > 0
                                    ? 'bg-amber-100 dark:bg-amber-950/90 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                                    : 'text-slate-400'
                                }`}
                              >
                                {opItem.justificadas}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center font-black text-slate-900 dark:text-slate-100 text-sm">
                              {opItem.totalFaltas}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {opItem.riskLevel === 'Critico' ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-rose-500 text-white shadow-2xs">
                                  <ShieldAlert className="h-3 w-3" /> Crítico
                                </span>
                              ) : opItem.riskLevel === 'Atencao' ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-amber-500 text-white shadow-2xs">
                                  <AlertTriangle className="h-3 w-3" /> Atenção
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                  Moderado
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <button
                                type="button"
                                onClick={() => setExpandedOp(isExpanded ? null : opItem.operador)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                              >
                                {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                                {isExpanded ? 'Ocultar' : 'Ver Datas'}
                              </button>
                            </td>
                          </tr>

                          {isExpanded && (
                            <tr className="bg-slate-50 dark:bg-slate-950/60">
                              <td colSpan={8} className="px-6 py-4 border-t border-b border-slate-200 dark:border-slate-800">
                                <div className="space-y-2">
                                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                                    Histórico de Datas de Falta - {opItem.operador}
                                  </h4>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                    {opItem.registros.map((r, rIdx) => (
                                      <div
                                        key={`rec-det-${r.id || rIdx}`}
                                        className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs space-y-1 shadow-2xs"
                                      >
                                        <div className="flex items-center justify-between">
                                          <span className="font-bold text-slate-800 dark:text-slate-200">{r.data}</span>
                                          <span
                                            className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                                              r.status === 'Falta Injustificada'
                                                ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
                                                : 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                                            }`}
                                          >
                                            {r.status}
                                          </span>
                                        </div>
                                        {r.observacao && (
                                          <p className="text-[11px] text-slate-500 dark:text-slate-400 italic">
                                            Obs: {r.observacao}
                                          </p>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
