import React from 'react';
import { LayoutDashboard, FilePlus2, Settings } from 'lucide-react';
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
    <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-2.5 shadow-2xs">
      <div className="max-w-7xl mx-auto flex items-center justify-start">
        {/* Navigation Tabs Bar in the White Section */}
        <nav className="flex items-center gap-1.5 bg-slate-100/90 p-1.5 rounded-2xl border border-slate-200/90 max-w-full overflow-x-auto">
          {/* Dashboard */}
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'dashboard'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
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
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
            }`}
          >
            <FilePlus2 className="h-4 w-4" />
            <span>Sinalizações</span>
          </button>

          {/* Administração */}
          {isAdmin && (
            <button
              onClick={() => setActiveTab('administracao')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'administracao'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
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
