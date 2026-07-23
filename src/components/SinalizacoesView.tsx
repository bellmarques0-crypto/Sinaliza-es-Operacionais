import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  FilePlus,
  Upload,
  CheckCircle2,
  AlertCircle,
  Image as ImageIcon,
  Search,
  FileSpreadsheet,
  X,
  Eye,
  ChevronLeft,
  ChevronRight,
  Filter,
  RotateCcw,
  User,
  Clock,
  Calendar,
  Trash2
} from 'lucide-react';
import { api } from '../services/api';
import {
  Sinalizacao,
  Supervisor,
  Operador,
  Produto,
  Motivo,
  UserSession
} from '../types';
import { exportHistoryToExcel } from '../utils/excelExport';
import { ImageModal } from './ImageModal';

interface SinalizacoesViewProps {
  user: UserSession;
}

export const SinalizacoesView: React.FC<SinalizacoesViewProps> = ({ user }) => {
  const canRegister = user.perfil === 'Administrador' || user.perfil === 'Planejamento';

  // Form State
  const [selectedOperador, setSelectedOperador] = useState('');
  const [operadorQuery, setOperadorQuery] = useState('');
  const [showOperadorDropdown, setShowOperadorDropdown] = useState(false);

  const [selectedSupervisor, setSelectedSupervisor] = useState('');
  const [selectedProduto, setSelectedProduto] = useState('');
  const [selectedMotivo, setSelectedMotivo] = useState('');
  const [observacao, setObservacao] = useState('');

  // Image Upload State
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form Status
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formSuccessMessage, setFormSuccessMessage] = useState<string | null>(null);
  const [formErrorMessage, setFormErrorMessage] = useState<string | null>(null);

  // Lists from DB
  const [operadoresList, setOperadoresList] = useState<Operador[]>([]);
  const [supervisoresList, setSupervisoresList] = useState<Supervisor[]>([]);
  const [produtosList, setProdutosList] = useState<Produto[]>([]);
  const [motivosList, setMotivosList] = useState<Motivo[]>([]);

  // History / Table State & Filters
  const [historyList, setHistoryList] = useState<Sinalizacao[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const [filterDataInicial, setFilterDataInicial] = useState('');
  const [filterDataFinal, setFilterDataFinal] = useState('');
  const [filterSupervisor, setFilterSupervisor] = useState('Todos');
  const [filterOperador, setFilterOperador] = useState('');
  const [filterProduto, setFilterProduto] = useState('Todos');
  const [filterMotivo, setFilterMotivo] = useState('Todos');
  const [tableSearch, setTableSearch] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Image Modal State
  const [selectedModalImage, setSelectedModalImage] = useState<{
    url: string;
    title: string;
    details: { operador: string; motivo: string; data: string; hora: string };
  } | null>(null);

  // Auto time clock
  const [nowClock, setNowClock] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNowClock(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    loadDropdownData();
    fetchHistory();
  }, []);

  const loadDropdownData = async () => {
    try {
      const [ops, sups, prods, mots] = await Promise.all([
        api.getOperadores(),
        api.getSupervisores(),
        api.getProdutos(),
        api.getMotivos()
      ]);
      setOperadoresList(ops);
      setSupervisoresList(sups);
      setProdutosList(prods);
      setMotivosList(mots);
    } catch (err) {
      console.error('Erro ao carregar bases cadastrais:', err);
    }
  };

  // Confirmation state
  const [confirmingId, setConfirmingId] = useState<number | null>(null);

  const handleConfirmSinalizacao = async (id: number) => {
    setConfirmingId(id);
    try {
      await api.confirmarSinalizacao(id);
      setFormSuccessMessage('Sinalização confirmada com sucesso pelo supervisor.');
      fetchHistory();
    } catch (err: any) {
      alert(err.message || 'Erro ao confirmar sinalização.');
    } finally {
      setConfirmingId(null);
    }
  };

  // Delete Sinalização Confirmation Modal State
  const [sinalizacaoToDelete, setSinalizacaoToDelete] = useState<{ id: number; operador: string } | null>(null);
  const [isDeletingSinalizacao, setIsDeletingSinalizacao] = useState(false);

  const confirmDeleteSinalizacao = async () => {
    if (!sinalizacaoToDelete) return;
    setIsDeletingSinalizacao(true);
    try {
      await api.deleteSinalizacao(sinalizacaoToDelete.id);
      setSinalizacaoToDelete(null);
      fetchHistory();
    } catch (err: any) {
      alert(err.message || 'Erro ao excluir sinalização.');
    } finally {
      setIsDeletingSinalizacao(false);
    }
  };

  const fetchHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const data = await api.getSinalizacoes({
        dataInicial: filterDataInicial,
        dataFinal: filterDataFinal,
        supervisor: filterSupervisor,
        operador: filterOperador,
        produto: filterProduto,
        motivo: filterMotivo
      });
      setHistoryList(data);
      setCurrentPage(1);
    } catch (err: any) {
      console.error('Erro ao carregar histórico de sinalizações:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Re-fetch history when filters change
  useEffect(() => {
    fetchHistory();
  }, [
    filterDataInicial,
    filterDataFinal,
    filterSupervisor,
    filterOperador,
    filterProduto,
    filterMotivo
  ]);

  // Image upload handling & validation (File input or Paste Ctrl+V)
  const processImageFile = useCallback((file: File) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedTypes.includes(file.type)) {
      setFormErrorMessage('Formato de imagem inválido. Aceito apenas JPG, JPEG e PNG.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setFormErrorMessage('Tamanho da imagem excede o limite máximo de 5MB.');
      return;
    }

    setFormErrorMessage(null);
    setImageFile(file);
    setImagePreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  }, []);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processImageFile(file);
  };

  const handlePasteImage = useCallback(
    (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.indexOf('image') !== -1) {
          const blob = item.getAsFile();
          if (blob) {
            const ext = blob.type.split('/')[1] || 'png';
            const file = new File([blob], `evidencia_colada_${Date.now()}.${ext}`, { type: blob.type });
            processImageFile(file);
            e.preventDefault();
            break;
          }
        }
      }
    },
    [processImageFile]
  );

  useEffect(() => {
    if (!canRegister) return;

    const onPaste = (e: ClipboardEvent) => {
      handlePasteImage(e);
    };

    window.addEventListener('paste', onPaste);
    return () => {
      window.removeEventListener('paste', onPaste);
    };
  }, [canRegister, handlePasteImage]);

  const handleClearImage = () => {
    setImageFile(null);
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    setImagePreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // When supervisor is selected in form, auto fill product if supervisor has matching product
  const handleSupervisorSelect = (supName: string) => {
    setSelectedSupervisor(supName);
    const foundSup = supervisoresList.find((s) => s.nome === supName);
    if (foundSup && foundSup.produto) {
      const supProds = foundSup.produto.split(',').map((p) => p.trim()).filter(Boolean);
      if (supProds.length > 0) {
        if (!selectedProduto || !supProds.includes(selectedProduto)) {
          setSelectedProduto(supProds[0]);
        }
      }
    }
  };

  // Form Submission
  const handleSubmitSinalizacao = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSuccessMessage(null);
    setFormErrorMessage(null);

    const opName = selectedOperador || operadorQuery;
    if (!opName || !selectedSupervisor || !selectedProduto || !selectedMotivo) {
      setFormErrorMessage('Por favor, preencha todos os campos obrigatórios (*).');
      return;
    }

    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('operador', opName);
      formData.append('supervisor', selectedSupervisor);
      formData.append('produto', selectedProduto);
      formData.append('motivo', selectedMotivo);
      formData.append('observacao', observacao);

      if (imageFile) {
        formData.append('evidencia', imageFile);
      }

      await api.createSinalizacao(formData);

      setFormSuccessMessage('Sinalização registrada com sucesso.');

      // Reset form
      setSelectedOperador('');
      setOperadorQuery('');
      setSelectedSupervisor('');
      setSelectedProduto('');
      setSelectedMotivo('');
      setObservacao('');
      handleClearImage();

      // Refresh history table
      fetchHistory();
    } catch (err: any) {
      setFormErrorMessage(err.message || 'Erro ao registrar sinalização.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Export history to excel
  const handleExportHistory = () => {
    exportHistoryToExcel(filteredHistory, {
      dataInicial: filterDataInicial,
      dataFinal: filterDataFinal,
      supervisor: filterSupervisor,
      operador: filterOperador,
      produto: filterProduto,
      motivo: filterMotivo
    });
  };

  // Filter local history table by search string
  const filteredHistory = historyList.filter((item) => {
    if (!tableSearch) return true;
    const term = tableSearch.toLowerCase();
    return (
      item.operador.toLowerCase().includes(term) ||
      item.supervisor.toLowerCase().includes(term) ||
      item.produto.toLowerCase().includes(term) ||
      item.motivo.toLowerCase().includes(term) ||
      item.observacao.toLowerCase().includes(term) ||
      item.usuario_responsavel.toLowerCase().includes(term)
    );
  });

  const totalPages = Math.ceil(filteredHistory.length / itemsPerPage) || 1;
  const paginatedHistory = filteredHistory.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Filter operators by search query
  const filteredOperatorsList = operadoresList.filter((op) =>
    op.nome.toLowerCase().includes(operadorQuery.toLowerCase())
  );

  return (
    <div className="space-y-8 pb-12">
      {/* 1. FORMULARIO DE REGISTRO (Admins & Planejamento) */}
      {canRegister && (
        <div className="rounded-2xl bg-white p-6 border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
                <FilePlus className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-800">Registrar Nova Sinalização</h2>
                <p className="text-xs text-slate-500">
                  Preencha os detalhes da ocorrência para registro e auditoria no banco de dados
                </p>
              </div>
            </div>

            {/* Auto date & time badge */}
            <div className="hidden sm:flex items-center gap-4 bg-slate-50 px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs">
              <div className="flex items-center gap-1.5 text-slate-600 font-medium">
                <Calendar className="h-3.5 w-3.5 text-blue-600" />
                {nowClock.toLocaleDateString('pt-BR')}
              </div>
              <div className="flex items-center gap-1.5 text-slate-600 font-medium border-l border-slate-200 pl-3">
                <Clock className="h-3.5 w-3.5 text-blue-600" />
                {nowClock.toLocaleTimeString('pt-BR')}
              </div>
            </div>
          </div>

          {/* Feedback Messages */}
          {formSuccessMessage && (
            <div className="mb-6 rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-xs text-emerald-800 flex items-center justify-between">
              <div className="flex items-center gap-2 font-medium">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                <span>{formSuccessMessage}</span>
              </div>
              <button
                onClick={() => setFormSuccessMessage(null)}
                className="text-emerald-500 hover:text-emerald-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {formErrorMessage && (
            <div className="mb-6 rounded-xl bg-red-50 border border-red-200 p-4 text-xs text-red-800 flex items-center justify-between">
              <div className="flex items-center gap-2 font-medium">
                <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
                <span>{formErrorMessage}</span>
              </div>
              <button
                onClick={() => setFormErrorMessage(null)}
                className="text-red-500 hover:text-red-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          <form onSubmit={handleSubmitSinalizacao} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              {/* Campo 1: Operador (Pesquisável) */}
              <div className="relative">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Operador <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="Buscar operador na base..."
                    value={operadorQuery}
                    onChange={(e) => {
                      setOperadorQuery(e.target.value);
                      setSelectedOperador('');
                      setShowOperadorDropdown(true);
                    }}
                    onFocus={() => setShowOperadorDropdown(true)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition"
                  />
                  <Search className="absolute right-3 top-2.5 h-4 w-4 text-slate-400" />
                </div>

                {/* Dropdown Suggestions */}
                {showOperadorDropdown && operadorQuery.length > 0 && (
                  <div className="absolute z-20 left-0 right-0 mt-1 max-h-48 overflow-y-auto rounded-xl bg-white border border-slate-200 shadow-lg divide-y divide-slate-100">
                    {filteredOperatorsList.length > 0 ? (
                      filteredOperatorsList.map((op) => (
                        <button
                          key={op.id}
                          type="button"
                          onClick={() => {
                            setSelectedOperador(op.nome);
                            setOperadorQuery(op.nome);
                            setSelectedSupervisor(op.supervisor);
                            setSelectedProduto(op.produto);
                            setShowOperadorDropdown(false);
                          }}
                          className="w-full text-left px-3.5 py-2.5 hover:bg-blue-50 text-xs transition flex flex-col"
                        >
                          <span className="font-semibold text-slate-800">{op.nome}</span>
                          <span className="text-[10px] text-slate-500">
                            Sup: {op.supervisor} • Prod: {op.produto}
                          </span>
                        </button>
                      ))
                    ) : (
                      <div className="px-3.5 py-2 text-xs text-slate-400 italic">
                        Nenhum operador encontrado na base.
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Campo 2: Supervisor */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Supervisor <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={selectedSupervisor}
                  onChange={(e) => handleSupervisorSelect(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition"
                >
                  <option value="">Selecione o supervisor...</option>
                  {supervisoresList.map((s) => (
                    <option key={s.id} value={s.nome}>
                      {s.nome}
                    </option>
                  ))}
                </select>
              </div>

              {/* Campo 3: Produto */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Produto <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={selectedProduto}
                  onChange={(e) => setSelectedProduto(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition"
                >
                  <option value="">Selecione o produto...</option>
                  {produtosList.map((p) => (
                    <option key={p.id} value={p.nome}>
                      {p.nome}
                    </option>
                  ))}
                </select>
              </div>

              {/* Campo 4: Motivo */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Motivo da Sinalização <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={selectedMotivo}
                  onChange={(e) => setSelectedMotivo(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition"
                >
                  <option value="">Selecione o motivo...</option>
                  {motivosList.map((m) => (
                    <option key={m.id} value={m.descricao}>
                      {m.descricao}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Campo Textarea: Observação */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Observação / Detalhamento do Fato
              </label>
              <textarea
                rows={3}
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                placeholder="Descreva detalhadamente a ocorrência, contexto e apontamentos relevantes..."
                className="w-full rounded-xl border border-slate-300 p-3 text-xs text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition"
              />
            </div>

            {/* Upload de Imagem de Evidência & Preview */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Evidência (Upload de imagem - JPG, JPEG, PNG)
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* File Dropzone */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer bg-slate-50/50 hover:bg-blue-50/20 transition group"
                >
                  <Upload className="h-6 w-6 text-slate-400 mb-1 group-hover:text-blue-500 transition-colors" />
                  <span className="text-xs font-semibold text-slate-700 text-center">
                    Clique para selecionar ou cole (Ctrl+V) a imagem
                  </span>
                  <span className="text-[10px] text-slate-400 text-center mt-0.5">
                    Aceita .jpg, .jpeg, .png (máx. 5MB)
                  </span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".jpg,.jpeg,.png"
                    onChange={handleImageChange}
                    className="hidden"
                  />
                </div>

                {/* Preview Image Card */}
                {imagePreviewUrl ? (
                  <div className="relative border border-slate-200 rounded-xl p-3 bg-slate-50 flex items-center gap-3">
                    <img
                      src={imagePreviewUrl}
                      alt="Pré-visualização"
                      className="h-16 w-16 object-cover rounded-lg border border-slate-200 shadow-2xs"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-800 truncate">
                        {imageFile?.name}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        {((imageFile?.size || 0) / 1024).toFixed(1)} KB • Imagem pronta para envio
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleClearImage}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
                      title="Remover imagem"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div className="border border-slate-200/60 rounded-xl p-4 bg-slate-50/40 flex items-center justify-center text-xs text-slate-400 italic">
                    Nenhuma imagem selecionada para esta sinalização.
                  </div>
                )}
              </div>
            </div>

            {/* Automatic Metadata Footer */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-100 pt-4">
              <div className="text-xs text-slate-500 flex items-center gap-2">
                <User className="h-4 w-4 text-blue-600" />
                Usuário Responsável: <span className="font-semibold text-slate-800">{user.nome}</span> ({user.perfil})
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-xs font-semibold text-white shadow-md shadow-blue-600/20 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:opacity-50 transition w-full sm:w-auto"
              >
                {isSubmitting ? (
                  <>
                    <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Salvando Registro...
                  </>
                ) : (
                  <>
                    <FilePlus className="h-4 w-4" />
                    Salvar Sinalização
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 2. HISTÓRICO DE SINALIZAÇÕES (Tabela + Filtros + Excel Export) */}
      <div className="rounded-2xl bg-white p-6 border border-slate-200/80 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4 mb-6">
          <div>
            <h2 className="text-base font-bold text-slate-800">Histórico de Sinalizações</h2>
            <p className="text-xs text-slate-500">
              Consulta detalhada e auditoria de todas as ocorrências cadastradas no sistema
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleExportHistory}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-emerald-600/20 hover:bg-emerald-700 transition"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Exportar Histórico para Excel
            </button>
          </div>
        </div>

        {/* Filtros da Tabela de Histórico */}
        <div className="rounded-xl bg-slate-50/70 p-4 border border-slate-200/80 mb-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Filter className="h-3.5 w-3.5 text-blue-600" />
              Filtros do Histórico
            </span>
            <button
              onClick={() => {
                setFilterDataInicial('');
                setFilterDataFinal('');
                setFilterSupervisor('Todos');
                setFilterOperador('');
                setFilterProduto('Todos');
                setFilterMotivo('Todos');
                setTableSearch('');
              }}
              className="text-[11px] font-semibold text-blue-600 hover:underline flex items-center gap-1"
            >
              <RotateCcw className="h-3 w-3" />
              Resetar Filtros
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* Data Inicial */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Data Inicial</label>
              <input
                type="date"
                value={filterDataInicial}
                onChange={(e) => setFilterDataInicial(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
              />
            </div>

            {/* Data Final */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Data Final</label>
              <input
                type="date"
                value={filterDataFinal}
                onChange={(e) => setFilterDataFinal(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
              />
            </div>

            {/* Supervisor */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Supervisor</label>
              <select
                value={filterSupervisor}
                onChange={(e) => setFilterSupervisor(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
              >
                <option value="Todos">Todos</option>
                {supervisoresList.map((s) => (
                  <option key={s.id} value={s.nome}>
                    {s.nome}
                  </option>
                ))}
              </select>
            </div>

            {/* Operador */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Operador</label>
              <input
                type="text"
                placeholder="Nome..."
                value={filterOperador}
                onChange={(e) => setFilterOperador(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
              />
            </div>

            {/* Produto */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Produto</label>
              <select
                value={filterProduto}
                onChange={(e) => setFilterProduto(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
              >
                <option value="Todos">Todos</option>
                {produtosList.map((p) => (
                  <option key={p.id} value={p.nome}>
                    {p.nome}
                  </option>
                ))}
              </select>
            </div>

            {/* Motivo */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Motivo</label>
              <select
                value={filterMotivo}
                onChange={(e) => setFilterMotivo(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
              >
                <option value="Todos">Todos</option>
                {motivosList.map((m) => (
                  <option key={m.id} value={m.descricao}>
                    {m.descricao}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Quick Table Search Input */}
        <div className="mb-4 flex justify-end">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Pesquisa rápida em todas as colunas..."
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
                <th className="px-3.5 py-3">Data</th>
                <th className="px-3.5 py-3">Hora</th>
                <th className="px-3.5 py-3">Operador</th>
                <th className="px-3.5 py-3">Supervisor</th>
                <th className="px-3.5 py-3">Produto</th>
                <th className="px-3.5 py-3">Motivo</th>
                <th className="px-3.5 py-3">Observação</th>
                <th className="px-3.5 py-3 text-center">Imagem</th>
                <th className="px-3.5 py-3">Usuário Responsável</th>
                <th className="px-3.5 py-3 text-center">Check / Status</th>
                {user.perfil === 'Administrador' && (
                  <th className="px-3.5 py-3 text-center">Ações</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {isLoadingHistory ? (
                <tr>
                  <td colSpan={user.perfil === 'Administrador' ? 11 : 10} className="px-4 py-8 text-center text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <span className="h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                      Carregando sinalizações...
                    </div>
                  </td>
                </tr>
              ) : paginatedHistory.length > 0 ? (
                paginatedHistory.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition">
                    <td className="px-3.5 py-3 font-semibold text-slate-800 whitespace-nowrap">
                      {item.data}
                    </td>
                    <td className="px-3.5 py-3 text-slate-500 whitespace-nowrap">{item.hora}</td>
                    <td className="px-3.5 py-3 font-bold text-slate-900 whitespace-nowrap">
                      {item.operador}
                    </td>
                    <td className="px-3.5 py-3 text-slate-700 whitespace-nowrap">{item.supervisor}</td>
                    <td className="px-3.5 py-3">
                      <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
                        {item.produto}
                      </span>
                    </td>
                    <td className="px-3.5 py-3 font-medium text-slate-800 whitespace-nowrap">
                      {item.motivo}
                    </td>
                    <td className="px-3.5 py-3 text-slate-600 max-w-xs truncate" title={item.observacao}>
                      {item.observacao || '-'}
                    </td>
                    <td className="px-3.5 py-3 text-center whitespace-nowrap">
                      {item.caminho_evidencia ? (
                        <button
                          onClick={() =>
                            setSelectedModalImage({
                              url: item.caminho_evidencia!,
                              title: `Evidência - ${item.operador}`,
                              details: {
                                operador: item.operador,
                                motivo: item.motivo,
                                data: item.data,
                                hora: item.hora
                              }
                            })
                          }
                          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 border border-blue-200 px-2.5 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-100 transition shadow-2xs cursor-pointer"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Visualizar
                        </button>
                      ) : (
                        <span className="text-[10px] text-slate-400 italic">Sem foto</span>
                      )}
                    </td>
                    <td className="px-3.5 py-3 text-slate-500 whitespace-nowrap">
                      {item.usuario_responsavel}
                    </td>
                    <td className="px-3.5 py-3 text-center whitespace-nowrap">
                      {item.confirmado ? (
                        <div className="inline-flex flex-col items-center">
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                            Confirmado
                          </span>
                          {item.usuario_confirmacao && (
                            <span className="text-[10px] text-slate-400 mt-0.5" title={`Confirmado em ${item.data_confirmacao || ''}`}>
                              Por: {item.usuario_confirmacao}
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700">
                            Pendente
                          </span>
                          {(user.perfil === 'Administrador' ||
                            user.perfil === 'Planejamento' ||
                            user.nome.toLowerCase().trim() === item.supervisor.toLowerCase().trim() ||
                            user.login.toLowerCase().trim() === item.supervisor.toLowerCase().trim()) && (
                            <button
                              onClick={() => handleConfirmSinalizacao(item.id)}
                              disabled={confirmingId === item.id}
                              className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white shadow-2xs hover:bg-emerald-700 transition cursor-pointer disabled:opacity-50"
                              title="Supervisor confirma sinalização"
                            >
                              {confirmingId === item.id ? (
                                <span className="h-3 w-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <CheckCircle2 className="h-3.5 w-3.5" />
                              )}
                              Check
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                    {user.perfil === 'Administrador' && (
                      <td className="px-3.5 py-3 text-center whitespace-nowrap">
                        <button
                          onClick={() => setSinalizacaoToDelete({ id: item.id, operador: item.operador })}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-red-50 border border-red-200 px-2.5 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-100 hover:border-red-300 transition shadow-2xs cursor-pointer"
                          title="Excluir Sinalização"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Excluir
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={user.perfil === 'Administrador' ? 11 : 10} className="px-4 py-8 text-center text-slate-500">
                    Nenhuma sinalização encontrada com os filtros aplicados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
          <div>
            Mostrando <span className="font-semibold text-slate-800">{paginatedHistory.length}</span> de{' '}
            <span className="font-semibold text-slate-800">{filteredHistory.length}</span> registros
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

      {/* Image Modal */}
      {selectedModalImage && (
        <ImageModal
          isOpen={!!selectedModalImage}
          onClose={() => setSelectedModalImage(null)}
          imageUrl={selectedModalImage.url}
          title={selectedModalImage.title}
          details={selectedModalImage.details}
        />
      )}

      {/* Delete Confirmation Modal */}
      {sinalizacaoToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-red-600 mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-red-600">
                <Trash2 className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Excluir Sinalização</h3>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed mb-6">
              Tem certeza que deseja excluir permanentemente a sinalização do operador{' '}
              <strong className="text-slate-900 font-semibold">{sinalizacaoToDelete.operador}</strong>?
              Esta ação não poderá ser desfeita.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setSinalizacaoToDelete(null)}
                disabled={isDeletingSinalizacao}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDeleteSinalizacao}
                disabled={isDeletingSinalizacao}
                className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-md shadow-red-600/20 transition cursor-pointer flex items-center gap-2 disabled:opacity-50"
              >
                {isDeletingSinalizacao ? (
                  <>
                    <span className="h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Excluindo...
                  </>
                ) : (
                  'Sim, Excluir'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
