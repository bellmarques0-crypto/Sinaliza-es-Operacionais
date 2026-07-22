import React, { useState, useEffect } from 'react';
import { LoginPage } from './components/LoginPage';
import { Sidebar, ActiveTab } from './components/Sidebar';
import { Header } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { SinalizacoesView } from './components/SinalizacoesView';
import { AdminView } from './components/AdminView';
import { UserSession } from './types';
import { api, getStoredToken } from './services/api';

export default function App() {
  const [user, setUser] = useState<UserSession | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);

  // Layout states
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');

  useEffect(() => {
    checkAuthentication();
  }, []);

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

  const handleLoginSuccess = (userSession: UserSession) => {
    setUser(userSession);
    setActiveTab('dashboard');
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
      case 'administracao':
        return 'Painel de Administração do Sistema';
      default:
        return 'Sistema de Sinalizações';
    }
  };

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-900 flex flex-col font-sans antialiased">
      {/* Top Navigation Bar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        user={user}
        onLogout={handleLogout}
      />

      {/* Subheader Banner */}
      <Header
        activeTabTitle={getTabTitle()}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        user={user}
      />

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-6 md:p-8">
        <div className="max-w-7xl mx-auto">
          {activeTab === 'dashboard' && <DashboardView />}
          {activeTab === 'sinalizacoes' && <SinalizacoesView user={user} />}
          {activeTab === 'administracao' && user.perfil === 'Administrador' && <AdminView />}
        </div>
      </main>
    </div>
  );
}
