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
  Package
} from 'lucide-react';
import { api } from '../services/api';
import {
  Usuario,
  Supervisor,
  Produto,
  Motivo,
  ConfiguracaoApi,
  PerfilAcesso
} from '../types';

export const AdminView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'api' | 'usuarios' | 'supervisores' | 'produtos' | 'motivos'>('api');

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

  // --- PRODUTOS LIST FOR DROPDOWNS ---
  const [produtosList, setProdutosList] = useState<Produto[]>([]);

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    try {
      const [config, users, sups, mots, prods] = await Promise.all([
        api.getConfigApi(),
        api.getUsuarios(),
        api.getSupervisores(),
        api.getMotivos(),
        api.getProdutos()
      ]);

      setApiUrl(config.url_api || '');
      setApiToken(config.token || '');
      setApiUser(config.usuario || '');
      setLastSyncDate(config.ultima_sincronizacao || 'Nunca executada');

      setUsuariosList(users);
      setSupervisoresList(sups);
      setMotivosList(mots);
      setProdutosList(prods);
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
        showSuccess('Supervisor cadastrado com sucesso.');
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

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner Alert */}
      {successMsg && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-xs text-emerald-800 flex items-center justify-between">
          <div className="flex items-center gap-2 font-medium">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-600">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-xs text-red-800 flex items-center justify-between">
          <div className="flex items-center gap-2 font-medium">
            <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-red-600">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Internal Navigation Tabs */}
      <div className="flex border-b border-slate-200 gap-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('api')}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 text-xs font-bold transition whitespace-nowrap ${
            activeTab === 'api'
              ? 'border-blue-600 text-blue-600 bg-blue-50/50 rounded-t-xl'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Radio className="h-4 w-4" />
          Configuração da API & Sincronização
        </button>

        <button
          onClick={() => setActiveTab('usuarios')}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 text-xs font-bold transition whitespace-nowrap ${
            activeTab === 'usuarios'
              ? 'border-blue-600 text-blue-600 bg-blue-50/50 rounded-t-xl'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users className="h-4 w-4" />
          Cadastro de Usuários
        </button>

        <button
          onClick={() => setActiveTab('supervisores')}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 text-xs font-bold transition whitespace-nowrap ${
            activeTab === 'supervisores'
              ? 'border-blue-600 text-blue-600 bg-blue-50/50 rounded-t-xl'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <UserCheck className="h-4 w-4" />
          Cadastro de Supervisores
        </button>

        <button
          onClick={() => setActiveTab('produtos')}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 text-xs font-bold transition whitespace-nowrap ${
            activeTab === 'produtos'
              ? 'border-blue-600 text-blue-600 bg-blue-50/50 rounded-t-xl'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Package className="h-4 w-4" />
          Cadastro de Produtos
        </button>

        <button
          onClick={() => setActiveTab('motivos')}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 text-xs font-bold transition whitespace-nowrap ${
            activeTab === 'motivos'
              ? 'border-blue-600 text-blue-600 bg-blue-50/50 rounded-t-xl'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileCode className="h-4 w-4" />
          Cadastro de Motivos
        </button>
      </div>

      {/* 1. PAINEL DE CONFIGURAÇÃO DA API */}
      {activeTab === 'api' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 rounded-2xl bg-white p-6 border border-slate-200/80 shadow-2xs">
            <h3 className="text-base font-bold text-slate-800 mb-1">
              Configuração da API de Integração
            </h3>
            <p className="text-xs text-slate-500 mb-6">
              Informe as credenciais e endpoint para conexão com os sistemas de RH e Cadastro
            </p>

            <form onSubmit={handleSaveApiConfig} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">URL da API</label>
                <input
                  type="url"
                  required
                  value={apiUrl}
                  onChange={(e) => setApiUrl(e.target.value)}
                  placeholder="https://api.empresa.com.br/v1/rh-sincronizacao"
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Token de Autenticação (Bearer / Key)
                </label>
                <input
                  type="text"
                  required
                  value={apiToken}
                  onChange={(e) => setApiToken(e.target.value)}
                  placeholder="bearer_token_..."
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs text-slate-800 focus:border-blue-500 focus:outline-none font-mono"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Usuário API
                  </label>
                  <input
                    type="text"
                    value={apiUser}
                    onChange={(e) => setApiUser(e.target.value)}
                    placeholder="api_sinalizacoes"
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Senha API
                  </label>
                  <input
                    type="password"
                    value={apiPass}
                    onChange={(e) => setApiPass(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 border-t border-slate-100 pt-5 mt-2">
                <button
                  type="button"
                  onClick={handleTestApiConnection}
                  disabled={isTestingApi}
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition"
                >
                  {isTestingApi ? (
                    <span className="h-3.5 w-3.5 border-2 border-slate-600 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Radio className="h-4 w-4 text-slate-500" />
                  )}
                  Testar Conexão
                </button>

                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-xs font-semibold text-white hover:bg-blue-700 shadow-sm transition"
                >
                  Salvar Configuração
                </button>
              </div>
            </form>
          </div>

          {/* Sync Card */}
          <div className="rounded-2xl bg-white p-6 border border-slate-200/80 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 mb-4">
                <RefreshCw className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-slate-800 mb-1">Sincronização de Cadastro</h3>
              <p className="text-xs text-slate-500 mb-4">
                A API é utilizada para sincronizar automaticamente a base de colaboradores: Operadores,
                Supervisores, Produtos e Situação.
              </p>

              <div className="rounded-xl bg-slate-50 p-4 border border-slate-200 text-xs space-y-2 mb-6">
                <div className="flex justify-between">
                  <span className="text-slate-500">Última sincronização:</span>
                  <span className="font-semibold text-slate-800">{lastSyncDate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Status do serviço:</span>
                  <span className="font-semibold text-emerald-600">Sincronizado</span>
                </div>
              </div>
            </div>

            <button
              onClick={handleSyncNow}
              disabled={isSyncingApi}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white shadow-md shadow-indigo-600/20 hover:bg-indigo-700 transition"
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
        <div className="rounded-2xl bg-white p-6 border border-slate-200/80 shadow-2xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-bold text-slate-800">Gerenciamento de Usuários</h3>
              <p className="text-xs text-slate-500">
                Cadastre e configure perfis de acesso, senhas e permissões
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative w-full sm:w-60">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Pesquisar usuário..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 pl-9 pr-3 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
                />
              </div>

              <button
                onClick={() => handleOpenUserModal()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 transition shrink-0"
              >
                <Plus className="h-4 w-4" />
                Novo Usuário
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 font-semibold text-slate-700 uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Nome</th>
                  <th className="px-4 py-3">Login</th>
                  <th className="px-4 py-3">Perfil</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Produto / Supervisor</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredUsers.length > 0 ? (
                  filteredUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50/80 transition">
                      <td className="px-4 py-3 font-semibold text-slate-900">{u.nome}</td>
                      <td className="px-4 py-3 text-slate-600 font-mono text-[11px]">{u.login}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            u.perfil === 'Administrador'
                              ? 'bg-purple-100 text-purple-700'
                              : u.perfil === 'Planejamento'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {u.perfil}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-semibold ${
                            u.status === 'Ativo' ? 'text-emerald-600' : 'text-red-600'
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
                      <td className="px-4 py-3 text-slate-500">
                        {u.produto || 'Todos'} / {u.supervisor || 'Todos'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenUserModal(u)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition"
                            title="Editar Usuário"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleToggleUserStatus(u)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-amber-600 hover:bg-amber-50 transition"
                            title={u.status === 'Ativo' ? 'Bloquear / Inativar' : 'Ativar'}
                          >
                            <Power className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setResetPassUserId(u.id)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition"
                            title="Resetar Senha"
                          >
                            <KeyRound className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteUser(u.id, u.nome)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 transition"
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
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                      Nenhum usuário localizado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. CADASTRO DE SUPERVISORES */}
      {activeTab === 'supervisores' && (
        <div className="rounded-2xl bg-white p-6 border border-slate-200/80 shadow-2xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-bold text-slate-800">Cadastro de Supervisores</h3>
              <p className="text-xs text-slate-500">
                Gerencie os supervisores de equipe vinculados aos produtos
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative w-full sm:w-60">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar supervisor..."
                  value={supSearch}
                  onChange={(e) => setSupSearch(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 pl-9 pr-3 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
                />
              </div>

              <button
                onClick={() => handleOpenSupModal()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 transition shrink-0"
              >
                <Plus className="h-4 w-4" />
                Novo Supervisor
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 font-semibold text-slate-700 uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">Nome do Supervisor</th>
                  <th className="px-4 py-3">Produtos Atribuídos</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredSups.length > 0 ? (
                  filteredSups.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/80 transition">
                      <td className="px-4 py-3 text-slate-400 font-mono">#{s.id}</td>
                      <td className="px-4 py-3 font-semibold text-slate-900">{s.nome}</td>
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
                                  className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 border border-blue-100"
                                >
                                  {pName}
                                </span>
                              ))
                          ) : (
                            <span className="text-slate-400 text-xs">Nenhum</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-semibold text-emerald-600">{s.status}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenSupModal(s)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition"
                            title="Editar"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteSup(s.id, s.nome)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 transition"
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
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
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
        <div className="rounded-2xl bg-white p-6 border border-slate-200/80 shadow-2xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-bold text-slate-800">
                Cadastro de Motivos de Sinalização
              </h3>
              <p className="text-xs text-slate-500">
                Configure as categorias padrão de ocorrências corporativas
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative w-full sm:w-60">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar motivo..."
                  value={motivoSearch}
                  onChange={(e) => setMotivoSearch(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 pl-9 pr-3 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
                />
              </div>

              <button
                onClick={() => handleOpenMotivoModal()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 transition shrink-0"
              >
                <Plus className="h-4 w-4" />
                Novo Motivo
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 font-semibold text-slate-700 uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">Descrição do Motivo</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredMotivos.length > 0 ? (
                  filteredMotivos.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50/80 transition">
                      <td className="px-4 py-3 text-slate-400 font-mono">#{m.id}</td>
                      <td className="px-4 py-3 font-semibold text-slate-800">{m.descricao}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenMotivoModal(m)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition"
                            title="Editar"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteMotivo(m.id, m.descricao)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 transition"
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
                    <td colSpan={3} className="px-4 py-8 text-center text-slate-500">
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
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-bold text-slate-800">Produtos Cadastrados</h2>
              <p className="text-xs text-slate-500">
                Gerencie os produtos disponíveis no sistema de sinalizações e operações.
              </p>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar produto..."
                  value={prodSearch}
                  onChange={(e) => setProdSearch(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 pl-9 pr-3 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
                />
              </div>

              <button
                onClick={() => handleOpenProdModal()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 transition shrink-0 cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                Novo Produto
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 font-semibold text-slate-700 uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">Nome do Produto</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredProdutos.length > 0 ? (
                  filteredProdutos.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition">
                      <td className="px-4 py-3 text-slate-400 font-mono">#{p.id}</td>
                      <td className="px-4 py-3 font-semibold text-slate-800">{p.nome}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenProdModal(p)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition cursor-pointer"
                            title="Editar"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteProd(p.id, p.nome)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
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
                    <td colSpan={3} className="px-4 py-8 text-center text-slate-500">
                      Nenhum produto localizado.
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-sm font-bold text-slate-800">
                {editingUserId ? 'Editar Usuário' : 'Novo Usuário'}
              </h3>
              <button onClick={() => setIsUserModalOpen(false)}>
                <X className="h-5 w-5 text-slate-400 hover:text-slate-700" />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nome Completo</label>
                <input
                  type="text"
                  required
                  value={formNome}
                  onChange={(e) => setFormNome(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
                />
              </div>

              {!editingUserId && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Login</label>
                  <input
                    type="text"
                    required
                    value={formLogin}
                    onChange={(e) => setFormLogin(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
                  />
                </div>
              )}

              {!editingUserId && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Senha Inicial</label>
                  <input
                    type="password"
                    required
                    value={formSenha}
                    onChange={(e) => setFormSenha(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Perfil de Acesso</label>
                  <select
                    value={formPerfil}
                    onChange={(e) => setFormPerfil(e.target.value as PerfilAcesso)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
                  >
                    <option value="Administrador">Administrador</option>
                    <option value="Planejamento">Planejamento</option>
                    <option value="Operação">Operação</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as any)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
                  >
                    <option value="Ativo">Ativo</option>
                    <option value="Inativo">Inativo</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsUserModalOpen(false)}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-sm"
                >
                  Salvar Usuário
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: RESETAR SENHA */}
      {resetPassUserId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-sm font-bold text-slate-800">Resetar Senha do Usuário</h3>
              <button onClick={() => setResetPassUserId(null)}>
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nova Senha</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Digite a nova senha..."
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  onClick={() => setResetPassUserId(null)}
                  className="rounded-xl px-3.5 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleResetPassword}
                  className="rounded-xl px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-sm font-bold text-slate-800">
                {editingSupId ? 'Editar Supervisor' : 'Novo Supervisor'}
              </h3>
              <button onClick={() => setIsSupModalOpen(false)}>
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleSaveSup} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nome do Supervisor
                </label>
                <input
                  type="text"
                  required
                  value={supNome}
                  onChange={(e) => setSupNome(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Produtos Vinculados <span className="text-slate-400 font-normal">(Selecione um ou mais)</span>
                </label>
                <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-3 rounded-xl border border-slate-300 bg-slate-50/50">
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
                              ? 'bg-blue-600 text-white shadow-xs'
                              : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100 hover:text-slate-900'
                          }`}
                        >
                          <span
                            className={`h-2 w-2 rounded-full ${
                              isSelected ? 'bg-white' : 'bg-slate-300'
                            }`}
                          />
                          {p.nome}
                        </button>
                      );
                    })
                  ) : (
                    <p className="text-xs text-slate-400">Nenhum produto cadastrado no sistema.</p>
                  )}
                </div>
                {selectedSupProdutos.length === 0 && (
                  <p className="text-[11px] text-red-500 mt-1 font-medium">
                    Selecione pelo menos um produto para o supervisor.
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsSupModalOpen(false)}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-sm"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-sm font-bold text-slate-800">
                {editingMotivoId ? 'Editar Motivo' : 'Novo Motivo'}
              </h3>
              <button onClick={() => setIsMotivoModalOpen(false)}>
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleSaveMotivo} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Descrição do Motivo
                </label>
                <input
                  type="text"
                  required
                  value={motivoDescricao}
                  onChange={(e) => setMotivoDescricao(e.target.value)}
                  placeholder="Ex: Uso de celular, Sem pausa, Atraso..."
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsMotivoModalOpen(false)}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-sm"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-sm font-bold text-slate-800">
                {editingProdId ? 'Editar Produto' : 'Novo Produto'}
              </h3>
              <button onClick={() => setIsProdModalOpen(false)}>
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleSaveProd} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nome do Produto
                </label>
                <input
                  type="text"
                  required
                  value={prodNome}
                  onChange={(e) => setProdNome(e.target.value)}
                  placeholder="Ex: Sacaria, Granel, Ensacado..."
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsProdModalOpen(false)}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-sm cursor-pointer"
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
