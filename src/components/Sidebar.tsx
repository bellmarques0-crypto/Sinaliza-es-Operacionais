import React, { useState } from 'react';
import {
  Shield,
  User,
  LogOut,
  Menu,
  X,
  LayoutDashboard,
  FilePlus2,
  Settings
} from 'lucide-react';
import { UserSession, PerfilAcesso } from '../types';

export type ActiveTab = 'dashboard' | 'sinalizacoes' | 'administracao';

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  user: UserSession;
  onLogout: () => void;
  collapsed?: boolean;
  setCollapsed?: (collapsed: boolean) => void;
  userPerfil?: PerfilAcesso;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  user,
  onLogout,
  userPerfil
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const perfil = user?.perfil || userPerfil || 'Operação';
  const isAdmin = perfil === 'Administrador';

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-slate-200 sticky top-0 z-40 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo & Name */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="flex h-10 px-2.5 items-center justify-center rounded-xl bg-slate-800 border border-slate-700/80 shadow-md">
              <img
                src="/logo.png"
                alt="Proativa Logo"
                className="h-7 w-auto object-contain"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            </div>
            <div className="flex flex-col">
              <span className="font-extrabold text-white text-base tracking-wider leading-none">
                PROATIVA
              </span>
              <span className="text-[10px] text-slate-400 font-medium tracking-wider uppercase mt-1">
                Sinalizações Operacionais
              </span>
            </div>
          </div>

          {/* Right User Badge & Logout (Desktop) */}
          <div className="hidden sm:flex items-center gap-4">
            {/* Perfil Badge */}
            <div className="flex items-center gap-2.5 bg-slate-800/90 border border-slate-700/80 px-3.5 py-1.5 rounded-xl shadow-xs">
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-bold ${
                  perfil === 'Administrador'
                    ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                    : perfil === 'Planejamento'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                }`}
              >
                {perfil.charAt(0)}
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-slate-200 leading-tight">
                  {user?.nome || 'Usuário'}
                </span>
                <span className="text-[10px] text-slate-400 font-medium leading-tight">
                  {perfil}
                </span>
              </div>
            </div>

            {/* Logout button */}
            <button
              onClick={onLogout}
              className="flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold text-slate-300 hover:text-red-400 hover:bg-red-500/10 border border-slate-700/80 hover:border-red-500/30 transition cursor-pointer"
              title="Sair do Sistema"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Sair</span>
            </button>
          </div>

          {/* Mobile Menu Toggle */}
          <div className="sm:hidden flex items-center">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800"
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Navigation */}
      {mobileMenuOpen && (
        <div className="sm:hidden border-t border-slate-800 bg-slate-900 px-4 pt-3 pb-4 space-y-2">
          <button
            onClick={() => {
              setActiveTab('dashboard');
              setMobileMenuOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold ${
              activeTab === 'dashboard' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <LayoutDashboard className="h-4 w-4" />
            <span>Dashboard</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('sinalizacoes');
              setMobileMenuOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold ${
              activeTab === 'sinalizacoes' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <FilePlus2 className="h-4 w-4" />
            <span>Sinalizações</span>
          </button>

          {isAdmin && (
            <button
              onClick={() => {
                setActiveTab('administracao');
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold ${
                activeTab === 'administracao' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Settings className="h-4 w-4" />
              <span>Administração</span>
            </button>
          )}

          <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-slate-400" />
              <span className="font-medium text-slate-200">{user?.nome}</span>
              <span className="text-[10px] text-slate-400">({perfil})</span>
            </div>
            <button
              onClick={onLogout}
              className="text-red-400 hover:underline flex items-center gap-1 font-semibold"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sair
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
