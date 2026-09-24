import React from 'react';
import { LayoutDashboard, FilePlus2, Settings, BookOpen, UserCheck } from 'lucide-react';
import { UserSession } from '../types';
import { ActiveTab } from './Sidebar';

interface HeaderProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  user: UserSession;
  activeTabTitle?: string;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  user
}) => {
  const perfil = user?.perfil || 'Operação';
  const isAdmin = perfil === 'Administrador';

  return (
    <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800/90 px-4 sm:px-6 py-2.5 shadow-2xs transition-colors duration-200">
      <div className="max-w-7xl mx-auto flex items-center justify-start">
        {/* Navigation Tabs Bar */}
        <nav className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-950 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-full overflow-x-auto">
          {/* Dashboard */}
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

          {/* Sinalizações */}
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

          {/* Diário de Bordo */}
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

          {/* Controle de Absenteísmo */}
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

          {/* Administração */}
          {isAdmin && (
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
