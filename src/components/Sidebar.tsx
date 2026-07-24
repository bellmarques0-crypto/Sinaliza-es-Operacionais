import React, { useState, useRef, useEffect } from 'react';
import {
  Shield,
  User,
  LogOut,
  Menu,
  X,
  LayoutDashboard,
  FilePlus2,
  Settings,
  KeyRound,
  Sun,
  Moon,
  ChevronDown,
  BookOpen
} from 'lucide-react';
import { UserSession, PerfilAcesso } from '../types';
import { ChangePasswordModal } from './ChangePasswordModal';

export type ActiveTab = 'dashboard' | 'sinalizacoes' | 'diario_bordo' | 'administracao';

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  user: UserSession;
  onLogout: () => void;
  collapsed?: boolean;
  setCollapsed?: (collapsed: boolean) => void;
  userPerfil?: PerfilAcesso;
  isDarkMode?: boolean;
  onToggleDarkMode?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  user,
  onLogout,
  userPerfil,
  isDarkMode = false,
  onToggleDarkMode
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const perfil = user?.perfil || userPerfil || 'Operação';
  const isAdmin = perfil === 'Administrador';

  // Close dropdown menu on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <>
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

            {/* Right User Badge & Dropdown Trigger (Desktop) */}
            <div className="hidden sm:flex items-center gap-3">
              <div className="relative" ref={userMenuRef}>
                <button
                  type="button"
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2.5 bg-slate-800/90 hover:bg-slate-800 border border-slate-700/80 hover:border-slate-600 px-3.5 py-1.5 rounded-xl shadow-xs transition cursor-pointer text-left group"
                >
                  <div
                    className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold transition-transform group-hover:scale-105 ${
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
                    <span className="text-xs font-semibold text-slate-100 leading-tight">
                      {user?.nome || 'Usuário'}
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium leading-tight">
                      {perfil}
                    </span>
                  </div>
                  <ChevronDown
                    className={`h-4 w-4 text-slate-400 transition-transform duration-200 ml-1 ${
                      userMenuOpen ? 'rotate-180 text-blue-400' : ''
                    }`}
                  />
                </button>

                {/* Dropdown Menu */}
                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-slate-800 border border-slate-700/90 shadow-2xl py-2 z-50 text-slate-200 animate-fade-in-scale">
                    {/* User header info */}
                    <div className="px-4 py-2.5 border-b border-slate-700/60 bg-slate-850">
                      <p className="text-xs font-bold text-white truncate">{user?.nome}</p>
                      <p className="text-[10px] text-slate-400 truncate mt-0.5">
                        {perfil} {user?.login ? `• ${user.login}` : ''}
                      </p>
                    </div>

                    <div className="py-1">
                      {/* Redefinir Senha */}
                      <button
                        type="button"
                        onClick={() => {
                          setUserMenuOpen(false);
                          setIsChangePasswordOpen(true);
                        }}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-medium text-slate-200 hover:bg-slate-700/70 hover:text-white transition cursor-pointer"
                      >
                        <KeyRound className="h-4 w-4 text-blue-400 shrink-0" />
                        <span>Redefinir senha</span>
                      </button>

                      {/* Modo claro/escuro */}
                      {onToggleDarkMode && (
                        <button
                          type="button"
                          onClick={() => {
                            onToggleDarkMode();
                          }}
                          className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-medium text-slate-200 hover:bg-slate-700/70 hover:text-white transition cursor-pointer"
                        >
                          <div className="flex items-center gap-2.5">
                            {isDarkMode ? (
                              <Sun className="h-4 w-4 text-amber-400 shrink-0" />
                            ) : (
                              <Moon className="h-4 w-4 text-indigo-400 shrink-0" />
                            )}
                            <span>{isDarkMode ? 'Modo claro' : 'Modo escuro'}</span>
                          </div>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-700/80 text-slate-300 font-semibold border border-slate-600/50">
                            {isDarkMode ? 'Escuro' : 'Claro'}
                          </span>
                        </button>
                      )}
                    </div>

                    <div className="border-t border-slate-700/60 pt-1 mt-1">
                      {/* Sair */}
                      <button
                        type="button"
                        onClick={() => {
                          setUserMenuOpen(false);
                          onLogout();
                        }}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-red-400 hover:bg-red-500/10 hover:text-red-300 transition cursor-pointer"
                      >
                        <LogOut className="h-4 w-4 text-red-400 shrink-0" />
                        <span>Sair</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
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

            <button
              onClick={() => {
                setActiveTab('diario_bordo');
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold ${
                activeTab === 'diario_bordo' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <BookOpen className="h-4 w-4" />
              <span>Diário de Bordo</span>
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

            <div className="pt-3 border-t border-slate-800 space-y-2 text-xs">
              <div className="flex items-center gap-2 px-2 py-1">
                <User className="h-4 w-4 text-slate-400" />
                <span className="font-medium text-slate-200">{user?.nome}</span>
                <span className="text-[10px] text-slate-400">({perfil})</span>
              </div>

              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setIsChangePasswordOpen(true);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-300 hover:bg-slate-800 rounded-lg text-xs"
              >
                <KeyRound className="h-4 w-4 text-blue-400" />
                <span>Redefinir senha</span>
              </button>

              {onToggleDarkMode && (
                <button
                  type="button"
                  onClick={() => {
                    onToggleDarkMode();
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 text-slate-300 hover:bg-slate-800 rounded-lg text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    {isDarkMode ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-indigo-400" />}
                    <span>{isDarkMode ? 'Modo claro' : 'Modo escuro'}</span>
                  </div>
                </button>
              )}

              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onLogout();
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-red-400 hover:bg-red-500/10 rounded-lg text-xs font-semibold"
              >
                <LogOut className="h-4 w-4" />
                <span>Sair</span>
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Change Password Modal */}
      <ChangePasswordModal
        isOpen={isChangePasswordOpen}
        onClose={() => setIsChangePasswordOpen(false)}
      />
    </>
  );
};
