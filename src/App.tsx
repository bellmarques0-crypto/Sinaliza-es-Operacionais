import React, { useState, useEffect } from 'react';
import { LoginPage } from './components/LoginPage';
import { Sidebar, ActiveTab } from './components/Sidebar';
import { Header } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { SinalizacoesView } from './components/SinalizacoesView';
import { DiarioBordoView } from './components/DiarioBordoView';
import { AbsenteismoView } from './components/AbsenteismoView';
import { AdminView } from './components/AdminView';
import { UserSession, PerfilConfig } from './types';
import { api, getStoredToken } from './services/api';

export default function App() {
  const [user, setUser] = useState<UserSession | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [perfisConfig, setPerfisConfig] = useState<PerfilConfig[]>([]);

  // Layout & Theme states
  const [activeTab, setActiveTabState] = useState<ActiveTab>(() => {
    const saved = localStorage.getItem('sinalizacoes_active_tab');
    return (saved as ActiveTab) || 'dashboard';
  });

  const setActiveTab = (tab: ActiveTab) => {
    localStorage.setItem('sinalizacoes_active_tab', tab);
    setActiveTabState(tab);
  };

  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('theme') === 'dark';
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  const handleToggleDarkMode = () => {
    setIsDarkMode((prev) => !prev);
  };

  useEffect(() => {
    checkAuthentication();
  }, []);

  useEffect(() => {
    if (user) {
      api.getPerfisConfig().then(setPerfisConfig).catch(console.error);
    }
  }, [user]);

  const checkAuthentication = async () => {
    const token = getStoredToken();
    if (!token) {
      setUser(null);
      setIsAuthChecking(false);
      return;
    }

    try {
      const userData = await api.getMe();
      setUser(userData);
    } catch (err) {
      console.error('Sessão expirada:', err);
      setUser(null);
    } finally {
      setIsAuthChecking(false);
    }
  };

  const userPerfilObj = perfisConfig.find(
    (p) => p.nome.toLowerCase().trim() === (user?.perfil || '').toLowerCase().trim()
  );

  const hasPerm = (key: string) => {
    if (user?.perfil === 'Administrador') return true;
    if (userPerfilObj && userPerfilObj.permissoes && key in userPerfilObj.permissoes) {
      return Boolean(userPerfilObj.permissoes[key]);
    }
    const perfName = (user?.perfil || '').toLowerCase().trim();
    if (perfName === 'visualizador') {
      if (
        key === 'absenteismo_ver' ||
        key === 'dashboard_ver' ||
        key === 'admin_acesso' ||
        key === 'sinalizacoes_criar' ||
        key === 'diario_bordo_criar' ||
        key === 'diario_bordo_editar'
      ) {
        return false;
      }
    }
    if (perfName === 'operaçao' || perfName === 'operacao') {
      if (key === 'admin_acesso' || key === 'sinalizacoes_criar' || key === 'diario_bordo_criar') {
        return false;
      }
    }
    if (userPerfilObj && userPerfilObj.permissoes) {
      return userPerfilObj.permissoes[key] !== false;
    }
    return true;
  };

  // Redirect to first permitted tab if activeTab is not permitted
  useEffect(() => {
    if (!user) return;
    const permittedTabs: ActiveTab[] = [];
    if (hasPerm('dashboard_ver')) permittedTabs.push('dashboard');
    if (hasPerm('sinalizacoes_ver')) permittedTabs.push('sinalizacoes');
    if (hasPerm('diario_bordo_ver')) permittedTabs.push('diario_bordo');
    if (hasPerm('absenteismo_ver')) permittedTabs.push('absenteismo');
    if (user.perfil === 'Administrador' || hasPerm('admin_acesso')) permittedTabs.push('administracao');

    if (permittedTabs.length > 0 && !permittedTabs.includes(activeTab)) {
      setActiveTab(permittedTabs[0]);
    }
  }, [user, perfisConfig, activeTab]);

  const handleLoginSuccess = (userSession: UserSession) => {
    setUser(userSession);
    const savedTab = (localStorage.getItem('sinalizacoes_active_tab') as ActiveTab) || 'dashboard';
    setActiveTab(savedTab);
  };

  const handleLogout = () => {
    api.logout();
    setUser(null);
  };

  if (isAuthChecking) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white font-sans">
        <div className="h-10 w-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs text-slate-400 font-medium">Verificando sessão de usuário...</p>
      </div>
    );
  }

  if (!user) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  // Get active tab title for header
  const getTabTitle = () => {
    switch (activeTab) {
      case 'dashboard':
        return 'Dashboard Executivo';
      case 'sinalizacoes':
        return user.perfil === 'Operação'
          ? 'Histórico de Sinalizações'
          : 'Registro & Histórico de Sinalizações';
      case 'diario_bordo':
        return 'Diário de Bordo Operacional';
      case 'absenteismo':
        return 'Controle de Absenteísmo Operacional';
      case 'administracao':
        return 'Painel de Administração do Sistema';
      default:
        return 'Diário de bordo';
    }
  };

  return (
    <div className={`min-h-screen ${isDarkMode ? 'dark bg-slate-950 text-slate-100' : 'bg-slate-100/70 text-slate-900'} flex flex-col font-sans antialiased transition-colors duration-200`}>
      {/* Top Navigation Bar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        user={user}
        perfisConfig={perfisConfig}
        onLogout={handleLogout}
        isDarkMode={isDarkMode}
        onToggleDarkMode={handleToggleDarkMode}
      />

      {/* Subheader Banner */}
      <Header
        activeTabTitle={getTabTitle()}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        user={user}
        perfisConfig={perfisConfig}
      />

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-6 md:p-8">
        <div className="max-w-7xl mx-auto">
          {activeTab === 'dashboard' && <DashboardView user={user} />}
          {activeTab === 'sinalizacoes' && <SinalizacoesView user={user} />}
          {activeTab === 'diario_bordo' && <DiarioBordoView user={user} token={getStoredToken() || ''} />}
          {activeTab === 'absenteismo' && <AbsenteismoView user={user} />}
          {activeTab === 'administracao' && (user.perfil === 'Administrador' || hasPerm('admin_acesso')) && (
            <AdminView onPerfisConfigChange={(updated) => setPerfisConfig(updated)} />
          )}
        </div>
      </main>
    </div>
  );
}
