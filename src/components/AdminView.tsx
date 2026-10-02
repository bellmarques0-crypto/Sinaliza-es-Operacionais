import React, { useState, useEffect } from 'react';
import {
  Settings,
  Users,
  UserCheck,
  AlertCircle,
  CheckCircle2,
  Lock,
  Search,
  Plus,
  Edit2,
  Trash2,
  RefreshCw,
  KeyRound,
  Shield,
  FileCode,
  Building,
  Radio,
  X,
  Power,
  Package,
  Check,
  Slash,
  Sliders
} from 'lucide-react';
import { api } from '../services/api';
import {
  Usuario,
  Supervisor,
  Produto,
  Motivo,
  Canal,
  ConfiguracaoApi,
  PerfilAcesso,
  PerfilConfig,
  PERMISSOES_SISTEMA
} from '../types';

interface AdminViewProps {
  onPerfisConfigChange?: (perfis: PerfilConfig[]) => void;
}

export const AdminView: React.FC<AdminViewProps> = ({ onPerfisConfigChange }) => {
  const [activeTab, setActiveTab] = useState<'api' | 'usuarios' | 'perfis' | 'supervisores' | 'produtos' | 'motivos' | 'canais'>('api');

  // Feedback notifications
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // --- API CONFIG STATE ---
  const [apiUrl, setApiUrl] = useState('');
  const [apiToken, setApiToken] = useState('');
  const [apiUser, setApiUser] = useState('');
  const [apiPass, setApiPass] = useState('');
  const [lastSyncDate, setLastSyncDate] = useState('');
  const [isTestingApi, setIsTestingApi] = useState(false);
  const [isSyncingApi, setIsSyncingApi] = useState(false);

  // --- USUÁRIOS STATE ---
  const [usuariosList, setUsuariosList] = useState<Usuario[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);

  const [formNome, setFormNome] = useState('');
  const [formLogin, setFormLogin] = useState('');
  const [formSenha, setFormSenha] = useState('');
  const [formPerfil, setFormPerfil] = useState<PerfilAcesso>('Operação');
  const [formStatus, setFormStatus] = useState<'Ativo' | 'Inativo'>('Ativo');
  const [formProduto, setFormProduto] = useState('Todos');
  const [formSupervisor, setFormSupervisor] = useState('Todos');

  // Reset Password Modal
  const [resetPassUserId, setResetPassUserId] = useState<number | null>(null);
  const [newPassword, setNewPassword] = useState('');

  // --- PERFIS & PERMISSÕES STATE ---
  const [perfisList, setPerfisList] = useState<PerfilConfig[]>([]);
  const [perfisSearch, setPerfisSearch] = useState('');
  const [perfisFilterPerfil, setPerfisFilterPerfil] = useState<string>('Todos');
  const [updatingUserPerfilId, setUpdatingUserPerfilId] = useState<number | null>(null);
  const [selectedPerfilNome, setSelectedPerfilNome] = useState<string>('Administrador');
  const [savingPerfilNome, setSavingPerfilNome] = useState<string | null>(null);

  // New Perfil Modal State
  const [isNewPerfilModalOpen, setIsNewPerfilModalOpen] = useState(false);
  const [newPerfilNome, setNewPerfilNome] = useState('');
  const [newPerfilDescricao, setNewPerfilDescricao] = useState('');
  const [newPerfilPermissoes, setNewPerfilPermissoes] = useState<Record<string, boolean>>({
    sinalizacoes_ver: true,
    sinalizacoes_dashboard: true,
    sinalizacoes_criar: false,
    sinalizacoes_confirmar: true,
    sinalizacoes_editar: false,
    sinalizacoes_excluir: false,
    sinalizacoes_exportar: true,
    diario_bordo_ver: true,
    absenteismo_ver: true,
    diario_bordo_dashboard: true,
    diario_bordo_ver_internas: false,
    diario_bordo_ver_externas: true,
    diario_bordo_criar: false,
    diario_bordo_editar: false,
    diario_bordo_excluir: false,
    diario_bordo_exportar: false,
    diario_bordo_gerenciar: false,
    dashboard_ver: true,
    dashboard_todos: false,
    admin_acesso: false,
    admin_usuarios: false,
    admin_perfis: false,
    admin_api: false
  });

  const handleQuickUpdatePerfil = async (userId: number, newPerfil: PerfilAcesso) => {
    setUpdatingUserPerfilId(userId);
    try {
      await api.updateUsuario(userId, { perfil: newPerfil });
      setUsuariosList((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, perfil: newPerfil } : u))
      );
      showSuccess(`Perfil do usuário atualizado para "${newPerfil}" com sucesso.`);
    } catch (err: any) {
      showError(err.message || 'Erro ao atualizar perfil do usuário.');
    } finally {
      setUpdatingUserPerfilId(null);
    }
  };

  const handleTogglePermission = (perfilNome: string, key: string) => {
    setPerfisList((prev) =>
      prev.map((p) => {
        if (p.nome === perfilNome) {
          const currentVal = !!p.permissoes?.[key];
          return {
            ...p,
            permissoes: {
              ...p.permissoes,
              [key]: !currentVal
            }
          };
        }
        return p;
      })
    );
  };

  const handleSavePerfilConfig = async (perfil: PerfilConfig) => {
    setSavingPerfilNome(perfil.nome);
    try {
      await api.updatePerfilConfig(perfil.nome, perfil);
      showSuccess(`Permissões do perfil "${perfil.nome}" salvas com sucesso!`);
      onPerfisConfigChange?.(perfisList);
    } catch (err: any) {
      showError(err.message || 'Erro ao salvar permissões do perfil.');
    } finally {
      setSavingPerfilNome(null);
    }
  };

  const handleCreateNewPerfil = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPerfilNome.trim()) {
      showError('O nome do perfil é obrigatório.');
      return;
    }

    try {
      const newPerfilObj: PerfilConfig = {
        nome: newPerfilNome.trim(),
        descricao: newPerfilDescricao.trim() || 'Perfil personalizado de acesso',
        permissoes: newPerfilPermissoes,
        is_custom: true
      };

      await api.createPerfilConfig(newPerfilObj);
      const updatedList = [...perfisList.filter((p) => p.nome !== newPerfilObj.nome), newPerfilObj];
      setPerfisList(updatedList);
      onPerfisConfigChange?.(updatedList);
      setSelectedPerfilNome(newPerfilObj.nome);
      setIsNewPerfilModalOpen(false);
      setNewPerfilNome('');
      setNewPerfilDescricao('');
      showSuccess(`Novo perfil "${newPerfilObj.nome}" cadastrado com sucesso!`);
    } catch (err: any) {
      showError(err.message || 'Erro ao cadastrar novo perfil.');
    }
  };

  const handleDeleteCustomPerfil = async (nome: string) => {
    if (!window.confirm(`Deseja realmente excluir o perfil customizado "${nome}"?`)) return;
    try {
      await api.deletePerfilConfig(nome);
      const updatedList = perfisList.filter((p) => p.nome !== nome);
      setPerfisList(updatedList);
      onPerfisConfigChange?.(updatedList);
      if (selectedPerfilNome === nome) {
        setSelectedPerfilNome('Administrador');
      }
      showSuccess(`Perfil "${nome}" excluído com sucesso.`);
    } catch (err: any) {
      showError(err.message || 'Erro ao excluir perfil.');
    }
  };

  const filteredPerfisUsers = usuariosList.filter((u) => {
    const matchSearch =
      u.nome.toLowerCase().includes(perfisSearch.toLowerCase()) ||
      u.login.toLowerCase().includes(perfisSearch.toLowerCase());
    const matchPerfil =
      perfisFilterPerfil === 'Todos' || u.perfil === perfisFilterPerfil;
    return matchSearch && matchPerfil;
  });

  // --- SUPERVISORES STATE ---
  const [supervisoresList, setSupervisoresList] = useState<Supervisor[]>([]);
  const [supSearch, setSupSearch] = useState('');
  const [isSupModalOpen, setIsSupModalOpen] = useState(false);
  const [editingSupId, setEditingSupId] = useState<number | null>(null);
  const [supNome, setSupNome] = useState('');
  const [selectedSupProdutos, setSelectedSupProdutos] = useState<string[]>([]);
  const [supStatus, setSupStatus] = useState<'Ativo' | 'Inativo'>('Ativo');

  // --- PRODUTOS STATE ---
  const [prodSearch, setProdSearch] = useState('');
  const [isProdModalOpen, setIsProdModalOpen] = useState(false);
  const [editingProdId, setEditingProdId] = useState<number | null>(null);
  const [prodNome, setProdNome] = useState('');

  // --- MOTIVOS STATE ---
  const [motivosList, setMotivosList] = useState<Motivo[]>([]);
  const [motivoSearch, setMotivoSearch] = useState('');
  const [isMotivoModalOpen, setIsMotivoModalOpen] = useState(false);
  const [editingMotivoId, setEditingMotivoId] = useState<number | null>(null);
  const [motivoDescricao, setMotivoDescricao] = useState('');

  // --- CANAIS STATE ---
  const [canaisList, setCanaisList] = useState<Canal[]>([]);
  const [canalSearch, setCanalSearch] = useState('');
  const [isCanalModalOpen, setIsCanalModalOpen] = useState(false);
  const [editingCanalId, setEditingCanalId] = useState<number | null>(null);
  const [canalNome, setCanalNome] = useState('');

  // --- PRODUTOS LIST FOR DROPDOWNS ---
  const [produtosList, setProdutosList] = useState<Produto[]>([]);

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    try {
      const [config, users, sups, mots, prods, perfis, canais] = await Promise.all([
        api.getConfigApi(),
        api.getUsuarios(),
        api.getSupervisores(),
        api.getMotivos(),
        api.getProdutos(),
        api.getPerfisConfig(),
        api.getCanais()
      ]);

      setApiUrl(config.url_api || '');
      setApiToken(config.token || '');
      setApiUser(config.usuario || '');
      setLastSyncDate(config.ultima_sincronizacao || 'Nunca executada');

      setUsuariosList(users);
      setPerfisList(perfis || []);
      setSupervisoresList(sups);
      setMotivosList(mots);
      setProdutosList(prods);
      setCanaisList(canais || []);
    } catch (err: any) {
      setErrorMsg('Erro ao carregar dados administrativos: ' + err.message);
    }
  };

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setErrorMsg(null);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  const showError = (msg: string) => {
    setErrorMsg(msg);
    setSuccessMsg(null);
  };

  // --- API HANDLERS ---
  const handleSaveApiConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.saveConfigApi({
        url_api: apiUrl,
        token: apiToken,
        usuario: apiUser,
        senha: apiPass
      });
      showSuccess('Configuração da API salva com sucesso.');
    } catch (err: any) {
      showError(err.message || 'Erro ao salvar configuração.');
    }
  };

  const handleTestApiConnection = async () => {
    setIsTestingApi(true);
    try {
      const res = await api.testConfigApi(apiUrl);
      if (res.success) {
        showSuccess(res.message);
      } else {
        showError(res.message);
      }
    } catch (err: any) {
      showError(err.message || 'Falha ao conectar com a API.');
    } finally {
      setIsTestingApi(false);
    }
  };

  const handleSyncNow = async () => {
    setIsSyncingApi(true);
    try {
      const res = await api.syncConfigApi();
      if (res.success) {
        setLastSyncDate(res.detalhes.dataSincronizacao);
        showSuccess(
          `Sincronização concluída com sucesso! ${res.detalhes.operadoresAtualizados} colaboradores sincronizados.`
        );
        loadAllData();
      }
    } catch (err: any) {
      showError(err.message || 'Erro na sincronização manual.');
    } finally {
      setIsSyncingApi(false);
    }
  };

  // --- USUÁRIOS HANDLERS ---
  const handleOpenUserModal = (user?: Usuario) => {
    if (user) {
      setEditingUserId(user.id);
      setFormNome(user.nome);
      setFormLogin(user.login);
      setFormSenha(''); // Don't show password
      setFormPerfil(user.perfil);
      setFormStatus(user.status);
      setFormProduto(user.produto || 'Todos');
      setFormSupervisor(user.supervisor || 'Todos');
    } else {
      setEditingUserId(null);
      setFormNome('');
      setFormLogin('');
      setFormSenha('');
      setFormPerfil('Operação');
      setFormStatus('Ativo');
      setFormProduto('Todos');
      setFormSupervisor('Todos');
    }
    setIsUserModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingUserId) {
        await api.updateUsuario(editingUserId, {
          nome: formNome,
          perfil: formPerfil,
          status: formStatus,
          produto: formProduto,
          supervisor: formSupervisor
        });
        showSuccess('Usuário atualizado com sucesso.');
      } else {
        await api.createUsuario({
          nome: formNome,
          login: formLogin,
          senha: formSenha,
          perfil: formPerfil,
          status: formStatus,
          produto: formProduto,
          supervisor: formSupervisor
        });
        showSuccess('Novo usuário cadastrado com sucesso.');
      }
      setIsUserModalOpen(false);
      loadAllData();
    } catch (err: any) {
      showError(err.message || 'Erro ao salvar usuário.');
    }
  };

  const handleToggleUserStatus = async (user: Usuario) => {
    try {
      const newStatus = user.status === 'Ativo' ? 'Inativo' : 'Ativo';
      await api.updateUsuario(user.id, { status: newStatus });
      showSuccess(`Status do usuário alterado para ${newStatus}.`);
      loadAllData();
    } catch (err: any) {
      showError(err.message || 'Erro ao alterar status.');
    }
  };

  const handleResetPassword = async () => {
    if (!resetPassUserId || !newPassword) return;
    try {
      await api.resetPasswordUsuario(resetPassUserId, newPassword);
      showSuccess('Senha do usuário resetada com sucesso.');
      setResetPassUserId(null);
      setNewPassword('');
    } catch (err: any) {
      showError(err.message || 'Erro ao resetar senha.');
    }
  };

  const handleDeleteUser = async (id: number, nome: string) => {
    try {
      await api.deleteUsuario(id);
      showSuccess(`Usuário "${nome}" excluído com sucesso.`);
      loadAllData();
    } catch (err: any) {
      showError(err.message || 'Erro ao excluir usuário.');
    }
  };

  // --- SUPERVISORES HANDLERS ---
  const handleOpenSupModal = (sup?: Supervisor) => {
    if (sup) {
      setEditingSupId(sup.id);
      setSupNome(sup.nome);
      const prods = sup.produto
        ? sup.produto.split(',').map((p) => p.trim()).filter(Boolean)
        : [];
      setSelectedSupProdutos(prods);
      setSupStatus(sup.status);
    } else {
      setEditingSupId(null);
      setSupNome('');
      setSelectedSupProdutos(produtosList[0] ? [produtosList[0].nome] : []);
      setSupStatus('Ativo');
    }
    setIsSupModalOpen(true);
  };

  const toggleSupProduto = (prodNome: string) => {
    setSelectedSupProdutos((prev) => {
      if (prev.includes(prodNome)) {
        return prev.filter((p) => p !== prodNome);
      } else {
        return [...prev, prodNome];
      }
    });
  };

  const handleSaveSup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedSupProdutos.length === 0) {
      showError('Selecione pelo menos um produto para o supervisor.');
      return;
    }
    const produtoStr = selectedSupProdutos.join(', ');
    try {
      if (editingSupId) {
        await api.updateSupervisor(editingSupId, {
          nome: supNome,
          produto: produtoStr,
          status: supStatus
        });
        showSuccess('Supervisor atualizado com sucesso.');
      } else {
        await api.createSupervisor({
          nome: supNome,
          produto: produtoStr,
          status: supStatus
        });
        showSuccess('Supervisor cadastrado com sucesso! Usuário (Perfil: Operação) criado com login "nome.sobrenome" e senha "123456".');
      }
      setIsSupModalOpen(false);
      loadAllData();
    } catch (err: any) {
      showError(err.message || 'Erro ao salvar supervisor.');
    }
  };

  const handleDeleteSup = async (id: number, nome: string) => {
    try {
      await api.deleteSupervisor(id);
      showSuccess(`Supervisor "${nome}" excluído com sucesso.`);
      loadAllData();
    } catch (err: any) {
      showError(err.message || 'Erro ao excluir supervisor.');
    }
  };

  // --- PRODUTOS HANDLERS ---
  const handleOpenProdModal = (prod?: Produto) => {
    if (prod) {
      setEditingProdId(prod.id);
      setProdNome(prod.nome);
    } else {
      setEditingProdId(null);
      setProdNome('');
    }
    setIsProdModalOpen(true);
  };

  const handleSaveProd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingProdId) {
        await api.updateProduto(editingProdId, prodNome);
        showSuccess('Produto atualizado com sucesso.');
      } else {
        await api.createProduto(prodNome);
        showSuccess('Produto cadastrado com sucesso.');
      }
      setIsProdModalOpen(false);
      loadAllData();
    } catch (err: any) {
      showError(err.message || 'Erro ao salvar produto.');
    }
  };

  const handleDeleteProd = async (id: number, nome: string) => {
    try {
      await api.deleteProduto(id);
      showSuccess(`Produto "${nome}" excluído com sucesso.`);
      loadAllData();
    } catch (err: any) {
      showError(err.message || 'Erro ao excluir produto.');
    }
  };

  // --- MOTIVOS HANDLERS ---
  const handleOpenMotivoModal = (motivo?: Motivo) => {
    if (motivo) {
      setEditingMotivoId(motivo.id);
      setMotivoDescricao(motivo.descricao);
    } else {
      setEditingMotivoId(null);
      setMotivoDescricao('');
    }
    setIsMotivoModalOpen(true);
  };

  const handleSaveMotivo = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingMotivoId) {
        await api.updateMotivo(editingMotivoId, motivoDescricao);
        showSuccess('Motivo atualizado com sucesso.');
      } else {
        await api.createMotivo(motivoDescricao);
        showSuccess('Motivo cadastrado com sucesso.');
      }
      setIsMotivoModalOpen(false);
      loadAllData();
    } catch (err: any) {
      showError(err.message || 'Erro ao salvar motivo.');
    }
  };

  const handleDeleteMotivo = async (id: number, desc: string) => {
    try {
      await api.deleteMotivo(id);
      showSuccess(`Motivo "${desc}" excluído com sucesso.`);
      loadAllData();
    } catch (err: any) {
      showError(err.message || 'Erro ao excluir motivo.');
    }
  };

  // --- CANAIS HANDLERS ---
  const handleOpenCanalModal = (canal?: Canal) => {
    if (canal) {
      setEditingCanalId(canal.id);
      setCanalNome(canal.nome);
    } else {
      setEditingCanalId(null);
      setCanalNome('');
    }
    setIsCanalModalOpen(true);
  };

  const handleSaveCanal = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingCanalId) {
        await api.updateCanal(editingCanalId, canalNome);
        showSuccess('Canal atualizado com sucesso.');
      } else {
        await api.createCanal(canalNome);
        showSuccess('Canal cadastrado com sucesso.');
      }
      setIsCanalModalOpen(false);
      loadAllData();
    } catch (err: any) {
      showError(err.message || 'Erro ao salvar canal.');
    }
  };

  const handleDeleteCanal = async (id: number, nome: string) => {
    try {
      await api.deleteCanal(id);
      showSuccess(`Canal "${nome}" excluído com sucesso.`);
      loadAllData();
    } catch (err: any) {
      showError(err.message || 'Erro ao excluir canal.');
    }
  };

  // Filters
  const filteredUsers = usuariosList.filter(
    (u) =>
      u.nome.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.login.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.perfil.toLowerCase().includes(userSearch.toLowerCase())
  );

  const filteredSups = supervisoresList.filter(
    (s) =>
      s.nome.toLowerCase().includes(supSearch.toLowerCase()) ||
      s.produto.toLowerCase().includes(supSearch.toLowerCase())
  );

  const filteredProdutos = produtosList.filter((p) =>
    p.nome.toLowerCase().includes(prodSearch.toLowerCase())
  );

  const filteredMotivos = motivosList.filter((m) =>
    m.descricao.toLowerCase().includes(motivoSearch.toLowerCase())
  );

  const filteredCanais = canaisList.filter((c) =>
    c.nome.toLowerCase().includes(canalSearch.toLowerCase())
  );

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner Alert */}
      {successMsg && (
        <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800 p-4 text-xs text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
          <div className="flex items-center gap-2 font-medium">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-white cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="rounded-xl bg-red-50 dark:bg-red-950/80 border border-red-200 dark:border-red-800 p-4 text-xs text-red-800 dark:text-red-300 flex items-center justify-between">
          <div className="flex items-center gap-2 font-medium">
            <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-white cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Internal Navigation Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('api')}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 text-xs font-bold transition whitespace-nowrap cursor-pointer ${
            activeTab === 'api'
              ? 'border-blue-600 dark:border-cyan-400 text-blue-600 dark:text-cyan-400 bg-blue-50/50 dark:bg-cyan-500/10 rounded-t-xl'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
          }`}
        >
          <Radio className="h-4 w-4" />
          Configuração da API & Sincronização
        </button>

        <button
          onClick={() => setActiveTab('usuarios')}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 text-xs font-bold transition whitespace-nowrap cursor-pointer ${
            activeTab === 'usuarios'
              ? 'border-blue-600 dark:border-cyan-400 text-blue-600 dark:text-cyan-400 bg-blue-50/50 dark:bg-cyan-500/10 rounded-t-xl'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
          }`}
        >
          <Users className="h-4 w-4" />
          Cadastro de Usuários
        </button>

        <button
          onClick={() => setActiveTab('perfis')}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 text-xs font-bold transition whitespace-nowrap cursor-pointer ${
            activeTab === 'perfis'
              ? 'border-blue-600 dark:border-cyan-400 text-blue-600 dark:text-cyan-400 bg-blue-50/50 dark:bg-cyan-500/10 rounded-t-xl'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
          }`}
        >
          <Shield className="h-4 w-4" />
          Ajuste de Perfis de Acesso
        </button>

        <button
          onClick={() => setActiveTab('supervisores')}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 text-xs font-bold transition whitespace-nowrap cursor-pointer ${
            activeTab === 'supervisores'
              ? 'border-blue-600 dark:border-cyan-400 text-blue-600 dark:text-cyan-400 bg-blue-50/50 dark:bg-cyan-500/10 rounded-t-xl'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
          }`}
        >
          <UserCheck className="h-4 w-4" />
          Cadastro de Supervisores
        </button>

        <button
          onClick={() => setActiveTab('produtos')}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 text-xs font-bold transition whitespace-nowrap cursor-pointer ${
            activeTab === 'produtos'
              ? 'border-blue-600 dark:border-cyan-400 text-blue-600 dark:text-cyan-400 bg-blue-50/50 dark:bg-cyan-500/10 rounded-t-xl'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
          }`}
        >
          <Package className="h-4 w-4" />
          Cadastro de Produtos
        </button>

        <button
          onClick={() => setActiveTab('motivos')}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 text-xs font-bold transition whitespace-nowrap cursor-pointer ${
            activeTab === 'motivos'
              ? 'border-blue-600 dark:border-cyan-400 text-blue-600 dark:text-cyan-400 bg-blue-50/50 dark:bg-cyan-500/10 rounded-t-xl'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
          }`}
        >
          <FileCode className="h-4 w-4" />
          Cadastro de Motivos
        </button>

        <button
          onClick={() => setActiveTab('canais')}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 text-xs font-bold transition whitespace-nowrap cursor-pointer ${
            activeTab === 'canais'
              ? 'border-blue-600 dark:border-cyan-400 text-blue-600 dark:text-cyan-400 bg-blue-50/50 dark:bg-cyan-500/10 rounded-t-xl'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
          }`}
        >
          <Radio className="h-4 w-4" />
          Cadastro de Canais
        </button>
      </div>

      {/* 1. PAINEL DE CONFIGURAÇÃO DA API */}
      {activeTab === 'api' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 rounded-2xl bg-white dark:bg-slate-900 p-6 border border-slate-200/80 dark:border-slate-800 shadow-2xs dark:shadow-xl transition-colors duration-200">
            <h3 className="text-base font-bold text-slate-800 dark:text-white mb-1">
              Configuração da API de Integração
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
              Informe as credenciais e endpoint para conexão com os sistemas de RH e Cadastro
            </p>

            <form onSubmit={handleSaveApiConfig} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">URL da API</label>
                <input
                  type="url"
                  required
                  value={apiUrl}
                  onChange={(e) => setApiUrl(e.target.value)}
                  placeholder="https://api.empresa.com.br/v1/rh-sincronizacao"
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950 px-3.5 py-2 text-xs text-slate-800 dark:text-slate-200 focus:border-blue-500 dark:focus:border-cyan-500 focus:outline-none transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Token de Autenticação (Bearer / Key)
                </label>
                <input
                  type="text"
                  required
                  value={apiToken}
                  onChange={(e) => setApiToken(e.target.value)}
                  placeholder="bearer_token_..."
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950 px-3.5 py-2 text-xs text-slate-800 dark:text-slate-200 focus:border-blue-500 dark:focus:border-cyan-500 focus:outline-none font-mono transition"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Usuário API
                  </label>
                  <input
                    type="text"
                    value={apiUser}
                    onChange={(e) => setApiUser(e.target.value)}
                    placeholder="api_sinalizacoes"
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950 px-3.5 py-2 text-xs text-slate-800 dark:text-slate-200 focus:border-blue-500 dark:focus:border-cyan-500 focus:outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Senha API
                  </label>
                  <input
                    type="password"
                    value={apiPass}
                    onChange={(e) => setApiPass(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950 px-3.5 py-2 text-xs text-slate-800 dark:text-slate-200 focus:border-blue-500 dark:focus:border-cyan-500 focus:outline-none transition"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 border-t border-slate-100 dark:border-slate-800 pt-5 mt-2">
                <button
                  type="button"
                  onClick={handleTestApiConnection}
                  disabled={isTestingApi}
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-100 dark:bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                >
                  {isTestingApi ? (
                    <span className="h-3.5 w-3.5 border-2 border-slate-600 dark:border-slate-300 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Radio className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                  )}
                  Testar Conexão
                </button>

                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 dark:bg-cyan-500 hover:bg-blue-700 dark:hover:bg-cyan-400 text-white dark:text-slate-950 px-5 py-2 text-xs font-bold shadow-sm transition cursor-pointer"
                >
                  Salvar Configuração
                </button>
              </div>
            </form>
          </div>

          {/* Sync Card */}
          <div className="rounded-2xl bg-white dark:bg-slate-900 p-6 border border-slate-200/80 dark:border-slate-800 shadow-2xs dark:shadow-xl flex flex-col justify-between transition-colors duration-200">
            <div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800 mb-4">
                <RefreshCw className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-slate-800 dark:text-white mb-1">Sincronização de Cadastro</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                A API é utilizada para sincronizar automaticamente a base de colaboradores: Operadores,
                Supervisores, Produtos e Situação.
              </p>

              <div className="rounded-xl bg-slate-50 dark:bg-slate-950 p-4 border border-slate-200 dark:border-slate-800 text-xs space-y-2 mb-6">
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Última sincronização:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{lastSyncDate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Status do serviço:</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">Sincronizado</span>
                </div>
              </div>
            </div>

            <button
              onClick={handleSyncNow}
              disabled={isSyncingApi}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 text-xs font-semibold shadow-md shadow-indigo-600/20 transition cursor-pointer"
            >
              {isSyncingApi ? (
                <>
                  <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Sincronizando...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  Sincronizar Agora
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* 2. CADASTRO DE USUÁRIOS */}
      {activeTab === 'usuarios' && (
        <div className="rounded-2xl bg-white dark:bg-slate-900 p-6 border border-slate-200/80 dark:border-slate-800 shadow-2xs dark:shadow-xl space-y-6 transition-colors duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h3 className="text-base font-bold text-slate-800 dark:text-white">Gerenciamento de Usuários</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Cadastre e configure perfis de acesso, senhas e permissões
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative w-full sm:w-60">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 dark:text-slate-500" />
                <input
                  type="text"
                  placeholder="Pesquisar usuário..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950 pl-9 pr-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:border-blue-500 dark:focus:border-cyan-500 focus:outline-none transition"
                />
              </div>

              <button
                onClick={() => handleOpenUserModal()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 dark:bg-cyan-500 hover:bg-blue-700 dark:hover:bg-cyan-400 text-white dark:text-slate-950 px-4 py-2 text-xs font-bold shadow-sm transition shrink-0 cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                Novo Usuário
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-950 font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-3">Nome</th>
                  <th className="px-4 py-3">Login</th>
                  <th className="px-4 py-3">Perfil</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Produto / Supervisor</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                {filteredUsers.length > 0 ? (
                  filteredUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition">
                      <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100">{u.nome}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400 font-mono text-[11px]">{u.login}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            u.perfil === 'Administrador'
                              ? 'bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                              : u.perfil === 'Planejamento'
                              ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                              : 'bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                          }`}
                        >
                          {u.perfil}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-semibold ${
                            u.status === 'Ativo' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                          }`}
                        >
                          <span
                            className={`h-2 w-2 rounded-full ${
                              u.status === 'Ativo' ? 'bg-emerald-500' : 'bg-red-500'
                            }`}
                          />
                          {u.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                        {u.produto || 'Todos'} / {u.supervisor || 'Todos'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenUserModal(u)}
                            className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-cyan-400 hover:bg-blue-50 dark:hover:bg-slate-800 transition cursor-pointer"
                            title="Editar Usuário"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleToggleUserStatus(u)}
                            className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-slate-800 transition cursor-pointer"
                            title={u.status === 'Ativo' ? 'Bloquear / Inativar' : 'Ativar'}
                          >
                            <Power className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setResetPassUserId(u.id)}
                            className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-slate-800 transition cursor-pointer"
                            title="Resetar Senha"
                          >
                            <KeyRound className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteUser(u.id, u.nome)}
                            className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-slate-800 transition cursor-pointer"
                            title="Excluir Usuário"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                      Nenhum usuário localizado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2.1. AJUSTE DE PERFIS DE ACESSO E MATRIZ DE PERMISSÕES DINÂMICA */}
      {activeTab === 'perfis' && (
        <div className="space-y-6">
          {/* Card Superior: Header e Seleção / Criação de Perfis */}
          <div className="rounded-2xl bg-white dark:bg-slate-900 p-6 border border-slate-200/80 dark:border-slate-800 shadow-2xs dark:shadow-xl space-y-6 transition-colors duration-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 dark:bg-purple-950/80 text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-800">
                  <Shield className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800 dark:text-white">Gerenciamento & Regras de Perfis de Acesso</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Crie novos perfis customizados e configure em tempo real o que cada perfil pode acessar e realizar no sistema
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsNewPerfilModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 text-xs font-bold shadow-md shadow-purple-600/20 transition cursor-pointer shrink-0"
              >
                <Plus className="h-4 w-4" />
                Novo Perfil Customizado
              </button>
            </div>

            {/* Seleção de Perfil para Edição de Permissões */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                Selecione um Perfil para Configurar Regras e Permissões:
              </label>
              <div className="flex flex-wrap gap-2">
                {perfisList.map((p) => {
                  const isSelected = selectedPerfilNome === p.nome;
                  return (
                    <button
                      key={`p-tab-${p.nome}`}
                      type="button"
                      onClick={() => setSelectedPerfilNome(p.nome)}
                      className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                        isSelected
                          ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20 ring-2 ring-purple-400 dark:ring-purple-500'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      <Shield className="h-3.5 w-3.5" />
                      <span>{p.nome}</span>
                      {p.is_custom && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-purple-900/40 text-purple-200">
                          Custom
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Editor de Permissões do Perfil Selecionado */}
            {(() => {
              const currentPerfilObj = perfisList.find((p) => p.nome === selectedPerfilNome) || perfisList[0];
              if (!currentPerfilObj) return null;

              const categorias = Array.from(new Set(PERMISSOES_SISTEMA.map((item) => item.categoria)));

              return (
                <div className="rounded-xl bg-slate-50/70 dark:bg-slate-950/70 p-5 border border-slate-200 dark:border-slate-800 space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                          Permissões do Perfil: <span className="text-purple-600 dark:text-purple-400">{currentPerfilObj.nome}</span>
                        </h4>
                        {currentPerfilObj.is_custom && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                            Customizado
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {currentPerfilObj.descricao || 'Marque as permissões ativas para os usuários vinculados a este perfil.'}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {currentPerfilObj.is_custom && (
                        <button
                          type="button"
                          onClick={() => handleDeleteCustomPerfil(currentPerfilObj.nome)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900 rounded-xl text-xs font-semibold border border-red-200 dark:border-red-800 transition cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Excluir Perfil
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleSavePerfilConfig(currentPerfilObj)}
                        disabled={savingPerfilNome === currentPerfilObj.nome}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 transition cursor-pointer"
                      >
                        {savingPerfilNome === currentPerfilObj.nome ? (
                          <>
                            <span className="h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Salvar...
                          </>
                        ) : (
                          <>
                            <Check className="h-4 w-4" />
                            Salvar Permissões
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Permissões Agrupadas por Categoria */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {categorias.map((cat) => {
                      const permCat = PERMISSOES_SISTEMA.filter((item) => item.categoria === cat);
                      return (
                        <div key={`cat-${cat}`} className="rounded-xl bg-white dark:bg-slate-900 p-4 border border-slate-200/80 dark:border-slate-800 space-y-3">
                          <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800 pb-2">
                            {cat}
                          </h5>
                          <div className="space-y-2.5">
                            {permCat.map((perm) => {
                              const isChecked = !!currentPerfilObj.permissoes?.[perm.key];
                              return (
                                <label
                                  key={`perm-${currentPerfilObj.nome}-${perm.key}`}
                                  className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/60 transition cursor-pointer"
                                >
                                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                                    {perm.label}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleTogglePermission(currentPerfilObj.nome, perm.key)}
                                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                      isChecked ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
                                    }`}
                                  >
                                    <span
                                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                                        isChecked ? 'translate-x-4' : 'translate-x-0'
                                      }`}
                                    />
                                  </button>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Card Inferior: Ajuste Rápido de Perfis por Usuário */}
          <div className="rounded-2xl bg-white dark:bg-slate-900 p-6 border border-slate-200/80 dark:border-slate-800 shadow-2xs dark:shadow-xl space-y-6 transition-colors duration-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-800 dark:text-white">Atribuição de Perfis aos Usuários</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Associe cada colaborador cadastrado a um dos perfis ativos do sistema
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {/* Search */}
                <div className="relative w-full sm:w-56">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 dark:text-slate-500" />
                  <input
                    type="text"
                    placeholder="Buscar usuário..."
                    value={perfisSearch}
                    onChange={(e) => setPerfisSearch(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950 pl-9 pr-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:border-blue-500 dark:focus:border-cyan-500 focus:outline-none transition"
                  />
                </div>

                {/* Filter Perfil */}
                <select
                  value={perfisFilterPerfil}
                  onChange={(e) => setPerfisFilterPerfil(e.target.value)}
                  className="rounded-xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 focus:border-blue-500 focus:outline-none"
                >
                  <option value="Todos">Todos os Perfis</option>
                  {perfisList.map((p) => (
                    <option key={`flt-p-${p.nome}`} value={p.nome}>
                      {p.nome}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Quick Edit Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-950 font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-4 py-3">Usuário</th>
                    <th className="px-4 py-3">Login</th>
                    <th className="px-4 py-3">Perfil Atual</th>
                    <th className="px-4 py-3">Alterar Perfil de Acesso</th>
                    <th className="px-4 py-3">Vínculo (Produto / Supervisor)</th>
                    <th className="px-4 py-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                  {filteredPerfisUsers.length > 0 ? (
                    filteredPerfisUsers.map((u) => (
                      <tr key={`perf-${u.id}`} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition">
                        <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100">{u.nome}</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400 font-mono text-[11px]">{u.login}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              u.perfil === 'Administrador'
                                ? 'bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                                : u.perfil === 'Planejamento'
                                ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                                : u.perfil === 'Supervisor'
                                ? 'bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                                : 'bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                            }`}
                          >
                            <Shield className="h-3 w-3" />
                            {u.perfil}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <select
                              value={u.perfil}
                              disabled={updatingUserPerfilId === u.id}
                              onChange={(e) => handleQuickUpdatePerfil(u.id, e.target.value as PerfilAcesso)}
                              className="rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950 px-2.5 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:border-blue-500 dark:focus:border-cyan-500 focus:outline-none transition cursor-pointer"
                            >
                              {perfisList.map((p) => (
                                <option key={`user-opt-${p.nome}`} value={p.nome}>
                                  {p.nome}
                                </option>
                              ))}
                            </select>
                            {updatingUserPerfilId === u.id && (
                              <span className="h-3.5 w-3.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-[11px]">
                          {u.produto || 'Todos'} / {u.supervisor || 'Todos'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span
                            className={`inline-flex items-center gap-1 text-[11px] font-semibold ${
                              u.status === 'Ativo' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                            }`}
                          >
                            <span className={`h-2 w-2 rounded-full ${u.status === 'Ativo' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                            {u.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                        Nenhum usuário encontrado para este filtro.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 3. CADASTRO DE SUPERVISORES */}
      {activeTab === 'supervisores' && (
        <div className="rounded-2xl bg-white dark:bg-slate-900 p-6 border border-slate-200/80 dark:border-slate-800 shadow-2xs dark:shadow-xl space-y-6 transition-colors duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h3 className="text-base font-bold text-slate-800 dark:text-white">Cadastro de Supervisores</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Gerencie os supervisores de equipe vinculados aos produtos
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative w-full sm:w-60">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 dark:text-slate-500" />
                <input
                  type="text"
                  placeholder="Buscar supervisor..."
                  value={supSearch}
                  onChange={(e) => setSupSearch(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950 pl-9 pr-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:border-blue-500 dark:focus:border-cyan-500 focus:outline-none transition"
                />
              </div>

              <button
                onClick={() => handleOpenSupModal()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 dark:bg-cyan-500 hover:bg-blue-700 dark:hover:bg-cyan-400 text-white dark:text-slate-950 px-4 py-2 text-xs font-bold shadow-sm transition shrink-0 cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                Novo Supervisor
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-950 font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">Nome do Supervisor</th>
                  <th className="px-4 py-3">Produtos Atribuídos</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                {filteredSups.length > 0 ? (
                  filteredSups.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition">
                      <td className="px-4 py-3 text-slate-400 dark:text-slate-500 font-mono">#{s.id}</td>
                      <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100">{s.nome}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {s.produto ? (
                            s.produto
                              .split(',')
                              .map((p) => p.trim())
                              .filter(Boolean)
                              .map((pName, idx) => (
                                <span
                                  key={idx}
                                  className="inline-flex items-center rounded-md bg-blue-50 dark:bg-cyan-500/10 px-2 py-0.5 text-[11px] font-medium text-blue-700 dark:text-cyan-300 border border-blue-100 dark:border-cyan-500/30"
                                >
                                  {pName}
                                </span>
                              ))
                          ) : (
                            <span className="text-slate-400 dark:text-slate-500 text-xs">Nenhum</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-semibold text-emerald-600 dark:text-emerald-400">{s.status}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenSupModal(s)}
                            className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-cyan-400 hover:bg-blue-50 dark:hover:bg-slate-800 transition cursor-pointer"
                            title="Editar"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteSup(s.id, s.nome)}
                            className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-slate-800 transition cursor-pointer"
                            title="Excluir"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                      Nenhum supervisor encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. CADASTRO DE MOTIVOS */}
      {activeTab === 'motivos' && (
        <div className="rounded-2xl bg-white dark:bg-slate-900 p-6 border border-slate-200/80 dark:border-slate-800 shadow-2xs dark:shadow-xl space-y-6 transition-colors duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h3 className="text-base font-bold text-slate-800 dark:text-white">
                Cadastro de Motivos de Sinalização
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Configure as categorias padrão de ocorrências corporativas
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative w-full sm:w-60">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 dark:text-slate-500" />
                <input
                  type="text"
                  placeholder="Buscar motivo..."
                  value={motivoSearch}
                  onChange={(e) => setMotivoSearch(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950 pl-9 pr-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:border-blue-500 dark:focus:border-cyan-500 focus:outline-none transition"
                />
              </div>

              <button
                onClick={() => handleOpenMotivoModal()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 dark:bg-cyan-500 hover:bg-blue-700 dark:hover:bg-cyan-400 text-white dark:text-slate-950 px-4 py-2 text-xs font-bold shadow-sm transition shrink-0 cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                Novo Motivo
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-950 font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">Descrição do Motivo</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                {filteredMotivos.length > 0 ? (
                  filteredMotivos.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition">
                      <td className="px-4 py-3 text-slate-400 dark:text-slate-500 font-mono">#{m.id}</td>
                      <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-200">{m.descricao}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenMotivoModal(m)}
                            className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-cyan-400 hover:bg-blue-50 dark:hover:bg-slate-800 transition cursor-pointer"
                            title="Editar"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteMotivo(m.id, m.descricao)}
                            className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-slate-800 transition cursor-pointer"
                            title="Excluir"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                      Nenhum motivo localizado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. PAINEL DE CADASTRO DE PRODUTOS */}
      {activeTab === 'produtos' && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xs dark:shadow-xl space-y-4 transition-colors duration-200">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-bold text-slate-800 dark:text-white">Produtos Cadastrados</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Gerencie os produtos disponíveis no sistema de sinalizações e operações.
              </p>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 dark:text-slate-500" />
                <input
                  type="text"
                  placeholder="Buscar produto..."
                  value={prodSearch}
                  onChange={(e) => setProdSearch(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950 pl-9 pr-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:border-blue-500 dark:focus:border-cyan-500 focus:outline-none transition"
                />
              </div>

              <button
                onClick={() => handleOpenProdModal()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 dark:bg-cyan-500 hover:bg-blue-700 dark:hover:bg-cyan-400 text-white dark:text-slate-950 px-4 py-2 text-xs font-bold shadow-sm transition shrink-0 cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                Novo Produto
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-950 font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">Nome do Produto</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                {filteredProdutos.length > 0 ? (
                  filteredProdutos.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition">
                      <td className="px-4 py-3 text-slate-400 dark:text-slate-500 font-mono">#{p.id}</td>
                      <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-200">{p.nome}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenProdModal(p)}
                            className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-cyan-400 hover:bg-blue-50 dark:hover:bg-slate-800 transition cursor-pointer"
                            title="Editar"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteProd(p.id, p.nome)}
                            className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-slate-800 transition cursor-pointer"
                            title="Excluir"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                      Nenhum produto localizado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6. PAINEL DE CADASTRO DE CANAIS */}
      {activeTab === 'canais' && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xs dark:shadow-xl space-y-4 transition-colors duration-200">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-bold text-slate-800 dark:text-white">Canais Cadastrados</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Gerencie os canais de atendimento e operação disponíveis no sistema.
              </p>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 dark:text-slate-500" />
                <input
                  type="text"
                  placeholder="Buscar canal..."
                  value={canalSearch}
                  onChange={(e) => setCanalSearch(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950 pl-9 pr-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:border-blue-500 dark:focus:border-cyan-500 focus:outline-none transition"
                />
              </div>

              <button
                onClick={() => handleOpenCanalModal()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 dark:bg-cyan-500 hover:bg-blue-700 dark:hover:bg-cyan-400 text-white dark:text-slate-950 px-4 py-2 text-xs font-bold shadow-sm transition shrink-0 cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                Novo Canal
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-950 font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">Nome do Canal</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                {filteredCanais.length > 0 ? (
                  filteredCanais.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition">
                      <td className="px-4 py-3 text-slate-400 dark:text-slate-500 font-mono">#{c.id}</td>
                      <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-200">{c.nome}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenCanalModal(c)}
                            className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-cyan-400 hover:bg-blue-50 dark:hover:bg-slate-800 transition cursor-pointer"
                            title="Editar"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteCanal(c.id, c.nome)}
                            className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-slate-800 transition cursor-pointer"
                            title="Excluir"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                      Nenhum canal localizado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: USUÁRIO (CRIAR/EDITAR) */}
      {isUserModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
              <h3 className="text-sm font-bold text-slate-800 dark:text-white">
                {editingUserId ? 'Editar Usuário' : 'Novo Usuário'}
              </h3>
              <button onClick={() => setIsUserModalOpen(false)}>
                <X className="h-5 w-5 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer" />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Nome Completo</label>
                <input
                  type="text"
                  required
                  value={formNome}
                  onChange={(e) => setFormNome(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:border-blue-500 dark:focus:border-cyan-500 focus:outline-none transition"
                />
              </div>

              {!editingUserId && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Login</label>
                  <input
                    type="text"
                    required
                    value={formLogin}
                    onChange={(e) => setFormLogin(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:border-blue-500 dark:focus:border-cyan-500 focus:outline-none transition"
                  />
                </div>
              )}

              {!editingUserId && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Senha Inicial</label>
                  <input
                    type="password"
                    required
                    value={formSenha}
                    onChange={(e) => setFormSenha(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:border-blue-500 dark:focus:border-cyan-500 focus:outline-none transition"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Perfil de Acesso</label>
                  <select
                    value={formPerfil}
                    onChange={(e) => setFormPerfil(e.target.value as PerfilAcesso)}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:border-blue-500 dark:focus:border-cyan-500 focus:outline-none transition"
                  >
                    {perfisList.map((p) => (
                      <option key={p.nome} value={p.nome}>
                        {p.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Status</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as any)}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:border-blue-500 dark:focus:border-cyan-500 focus:outline-none transition"
                  >
                    <option value="Ativo">Ativo</option>
                    <option value="Inativo">Inativo</option>
                  </select>
                </div>
              </div>

              {/* PRODUTOS PERMITIDOS (DIÁRIO DE BORDO) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Produtos Permitidos (Diário de Bordo)
                </label>
                <div className="p-3 rounded-xl border border-slate-300 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/70 space-y-2.5">
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
                    <input
                      type="checkbox"
                      id="chk-todos-prods"
                      checked={formProduto === 'Todos' || !formProduto}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormProduto('Todos');
                        } else if (produtosList.length > 0) {
                          setFormProduto(produtosList[0].nome);
                        }
                      }}
                      className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4 cursor-pointer"
                    />
                    <label htmlFor="chk-todos-prods" className="text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer">
                      Todos os Produtos (Acesso Global)
                    </label>
                  </div>

                  {formProduto !== 'Todos' && (
                    <div className="space-y-1.5">
                      <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                        Selecione os produtos que este usuário poderá visualizar no Diário de Bordo:
                      </p>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {produtosList.map((prod) => {
                          const selectedArr = formProduto.split(',').map((p) => p.trim()).filter(Boolean);
                          const isSelected = selectedArr.includes(prod.nome);
                          return (
                            <button
                              key={`user-prod-${prod.id}`}
                              type="button"
                              onClick={() => {
                                let updated: string[];
                                if (isSelected) {
                                  updated = selectedArr.filter((p) => p !== prod.nome);
                                } else {
                                  updated = [...selectedArr, prod.nome];
                                }
                                setFormProduto(updated.length > 0 ? updated.join(', ') : 'Todos');
                              }}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                                isSelected
                                  ? 'bg-blue-600 dark:bg-cyan-500 text-white dark:text-slate-950 border-blue-600 dark:border-cyan-500 shadow-xs'
                                  : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-blue-400'
                              }`}
                            >
                              {isSelected && <Check className="h-3.5 w-3.5" />}
                              <span>{prod.nome}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsUserModalOpen(false)}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-xl px-4 py-2 text-xs font-bold text-white dark:text-slate-950 bg-blue-600 dark:bg-cyan-500 hover:bg-blue-700 dark:hover:bg-cyan-400 shadow-sm transition cursor-pointer"
                >
                  Salvar Usuário
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: NOVO PERFIL DE ACESSO */}
      {isNewPerfilModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                <h3 className="text-sm font-bold text-slate-800 dark:text-white">Criar Novo Perfil de Acesso</h3>
              </div>
              <button onClick={() => setIsNewPerfilModalOpen(false)}>
                <X className="h-5 w-5 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer" />
              </button>
            </div>

            <form onSubmit={handleCreateNewPerfil} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nome do Perfil
                </label>
                <input
                  type="text"
                  required
                  value={newPerfilNome}
                  onChange={(e) => setNewPerfilNome(e.target.value)}
                  placeholder="Ex: Coordenador, Auditor, Analista de Qualidade..."
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:border-purple-500 dark:focus:border-purple-400 focus:outline-none transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Descrição / Finalidade
                </label>
                <textarea
                  rows={2}
                  value={newPerfilDescricao}
                  onChange={(e) => setNewPerfilDescricao(e.target.value)}
                  placeholder="Descreva brevemente as responsabilidades e escopo deste perfil..."
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:border-purple-500 dark:focus:border-purple-400 focus:outline-none transition"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsNewPerfilModalOpen(false)}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-xl px-4 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 shadow-sm transition cursor-pointer"
                >
                  Criar Perfil
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: RESETAR SENHA */}
      {resetPassUserId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
              <h3 className="text-sm font-bold text-slate-800 dark:text-white">Resetar Senha do Usuário</h3>
              <button onClick={() => setResetPassUserId(null)}>
                <X className="h-5 w-5 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Nova Senha</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Digite a nova senha..."
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:border-blue-500 dark:focus:border-cyan-500 focus:outline-none transition"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => setResetPassUserId(null)}
                  className="rounded-xl px-3.5 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleResetPassword}
                  className="rounded-xl px-3.5 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition cursor-pointer"
                >
                  Confirmar Reset
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: SUPERVISOR (CRIAR/EDITAR) */}
      {isSupModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
              <h3 className="text-sm font-bold text-slate-800 dark:text-white">
                {editingSupId ? 'Editar Supervisor' : 'Novo Supervisor'}
              </h3>
              <button onClick={() => setIsSupModalOpen(false)}>
                <X className="h-5 w-5 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer" />
              </button>
            </div>

            <form onSubmit={handleSaveSup} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nome do Supervisor
                </label>
                <input
                  type="text"
                  required
                  value={supNome}
                  onChange={(e) => setSupNome(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:border-blue-500 dark:focus:border-cyan-500 focus:outline-none transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Produtos Vinculados <span className="text-slate-400 dark:text-slate-500 font-normal">(Selecione um ou mais)</span>
                </label>
                <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-3 rounded-xl border border-slate-300 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950">
                  {produtosList.length > 0 ? (
                    produtosList.map((p) => {
                      const isSelected = selectedSupProdutos.includes(p.nome);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => toggleSupProduto(p.nome)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer select-none ${
                            isSelected
                              ? 'bg-blue-600 dark:bg-cyan-500 text-white dark:text-slate-950 shadow-xs'
                              : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                        >
                          <span
                            className={`h-2 w-2 rounded-full ${
                              isSelected ? 'bg-white dark:bg-slate-950' : 'bg-slate-300 dark:bg-slate-700'
                            }`}
                          />
                          {p.nome}
                        </button>
                      );
                    })
                  ) : (
                    <p className="text-xs text-slate-400 dark:text-slate-500">Nenhum produto cadastrado no sistema.</p>
                  )}
                </div>
                {selectedSupProdutos.length === 0 && (
                  <p className="text-[11px] text-red-500 dark:text-red-400 mt-1 font-medium">
                    Selecione pelo menos um produto para o supervisor.
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsSupModalOpen(false)}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-xl px-4 py-2 text-xs font-bold text-white dark:text-slate-950 bg-blue-600 dark:bg-cyan-500 hover:bg-blue-700 dark:hover:bg-cyan-400 shadow-sm transition cursor-pointer"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: MOTIVO (CRIAR/EDITAR) */}
      {isMotivoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
              <h3 className="text-sm font-bold text-slate-800 dark:text-white">
                {editingMotivoId ? 'Editar Motivo' : 'Novo Motivo'}
              </h3>
              <button onClick={() => setIsMotivoModalOpen(false)}>
                <X className="h-5 w-5 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer" />
              </button>
            </div>

            <form onSubmit={handleSaveMotivo} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Descrição do Motivo
                </label>
                <input
                  type="text"
                  required
                  value={motivoDescricao}
                  onChange={(e) => setMotivoDescricao(e.target.value)}
                  placeholder="Ex: Uso de celular, Sem pausa, Atraso..."
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:border-blue-500 dark:focus:border-cyan-500 focus:outline-none transition"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsMotivoModalOpen(false)}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-xl px-4 py-2 text-xs font-bold text-white dark:text-slate-950 bg-blue-600 dark:bg-cyan-500 hover:bg-blue-700 dark:hover:bg-cyan-400 shadow-sm transition cursor-pointer"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: PRODUTO (CRIAR/EDITAR) */}
      {isProdModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
              <h3 className="text-sm font-bold text-slate-800 dark:text-white">
                {editingProdId ? 'Editar Produto' : 'Novo Produto'}
              </h3>
              <button onClick={() => setIsProdModalOpen(false)}>
                <X className="h-5 w-5 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer" />
              </button>
            </div>

            <form onSubmit={handleSaveProd} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nome do Produto
                </label>
                <input
                  type="text"
                  required
                  value={prodNome}
                  onChange={(e) => setProdNome(e.target.value)}
                  placeholder="Ex: Sacaria, Granel, Ensacado..."
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:border-blue-500 dark:focus:border-cyan-500 focus:outline-none transition"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsProdModalOpen(false)}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-xl px-4 py-2 text-xs font-bold text-white dark:text-slate-950 bg-blue-600 dark:bg-cyan-500 hover:bg-blue-700 dark:hover:bg-cyan-400 shadow-sm transition cursor-pointer"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CANAL (CRIAR/EDITAR) */}
      {isCanalModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
              <h3 className="text-sm font-bold text-slate-800 dark:text-white">
                {editingCanalId ? 'Editar Canal' : 'Novo Canal'}
              </h3>
              <button onClick={() => setIsCanalModalOpen(false)}>
                <X className="h-5 w-5 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer" />
              </button>
            </div>

            <form onSubmit={handleSaveCanal} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nome do Canal
                </label>
                <input
                  type="text"
                  required
                  value={canalNome}
                  onChange={(e) => setCanalNome(e.target.value)}
                  placeholder="Ex: WhatsApp, Telefonia, Chat..."
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:border-blue-500 dark:focus:border-cyan-500 focus:outline-none transition"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCanalModalOpen(false)}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-xl px-4 py-2 text-xs font-bold text-white dark:text-slate-950 bg-blue-600 dark:bg-cyan-500 hover:bg-blue-700 dark:hover:bg-cyan-400 shadow-sm transition cursor-pointer"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
