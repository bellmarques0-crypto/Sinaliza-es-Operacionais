import React from 'react';
import { LayoutDashboard, FilePlus2, Settings, BookOpen, UserCheck } from 'lucide-react';
import { UserSession, PerfilConfig } from '../types';
import { ActiveTab } from './Sidebar';

interface HeaderProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  user: UserSession;
  perfisConfig?: PerfilConfig[];
  activeTabTitle?: string;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  user,
  perfisConfig = []
}) => {
  const perfil = user?.perfil || 'Operação';
  const isAdmin = perfil === 'Administrador';

  const userPerfilObj = perfisConfig.find(
    (p) => p.nome.toLowerCase().trim() === (user?.perfil || '').toLowerCase().trim()
  );

  const hasPerm = (key: string) => {
    if (isAdmin) return true;
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

  const canSeeDashboard = hasPerm('dashboard_ver');
  const canSeeSinalizacoes = hasPerm('sinalizacoes_ver');
  const canSeeDiarioBordo = hasPerm('diario_bordo_ver');
  const canSeeAbsenteismo = hasPerm('absenteismo_ver');
  const canSeeAdmin = isAdmin || hasPerm('admin_acesso');

  return (
    <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800/90 px-4 sm:px-6 py-2.5 shadow-2xs transition-colors duration-200">
      <div className="max-w-7xl mx-auto flex items-center justify-start">
        {/* Navigation Tabs Bar */}
        <nav className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-950 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-full overflow-x-auto">
          {/* Dashboard */}
          {canSeeDashboard && (
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'dashboard'
                  ? 'bg-blue-600 dark:bg-cyan-500 text-white dark:text-slate-950 shadow-md shadow-blue-600/20 dark:shadow-cyan-500/20'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-900'
              }`}
            >
              <LayoutDashboard className="h-4 w-4" />
              <span>Dashboard</span>
            </button>
          )}

          {/* Sinalizações */}
          {canSeeSinalizacoes && (
            <button
              onClick={() => setActiveTab('sinalizacoes')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'sinalizacoes'
                  ? 'bg-blue-600 dark:bg-cyan-500 text-white dark:text-slate-950 shadow-md shadow-blue-600/20 dark:shadow-cyan-500/20'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-900'
              }`}
            >
              <FilePlus2 className="h-4 w-4" />
              <span>Sinalizações</span>
            </button>
          )}

          {/* Diário de Bordo */}
          {canSeeDiarioBordo && (
            <button
              onClick={() => setActiveTab('diario_bordo')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'diario_bordo'
                  ? 'bg-blue-600 dark:bg-cyan-500 text-white dark:text-slate-950 shadow-md shadow-blue-600/20 dark:shadow-cyan-500/20'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-900'
              }`}
            >
              <BookOpen className="h-4 w-4" />
              <span>Diário de Bordo</span>
            </button>
          )}

          {/* Controle de Absenteísmo */}
          {canSeeAbsenteismo && (
            <button
              onClick={() => setActiveTab('absenteismo')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'absenteismo'
                  ? 'bg-blue-600 dark:bg-cyan-500 text-white dark:text-slate-950 shadow-md shadow-blue-600/20 dark:shadow-cyan-500/20'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-900'
              }`}
            >
              <UserCheck className="h-4 w-4" />
              <span>Controle de Absenteísmo</span>
            </button>
          )}

          {/* Administração */}
          {canSeeAdmin && (
            <button
              onClick={() => setActiveTab('administracao')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'administracao'
                  ? 'bg-blue-600 dark:bg-cyan-500 text-white dark:text-slate-950 shadow-md shadow-blue-600/20 dark:shadow-cyan-500/20'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-900'
              }`}
            >
              <Settings className="h-4 w-4" />
              <span>Administração</span>
            </button>
          )}
        </nav>
      </div>
    </div>
  );
};
