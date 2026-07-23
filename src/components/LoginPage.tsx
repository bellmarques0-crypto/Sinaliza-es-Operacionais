import React, { useState, useEffect } from 'react';
import { User, Lock, Eye, EyeOff, AlertCircle, HelpCircle } from 'lucide-react';
import { api } from '../services/api';
import { UserSession } from '../types';

interface LoginPageProps {
  onLoginSuccess: (user: UserSession) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [login, setLogin] = useState('');
  const [senha, setSenha] = useState('');
  const [showSenha, setShowSenha] = useState(false);
  const [lembrarMe, setLembrarMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);

  // Auto-fill stored username if "Lembrar-me" was checked previously
  useEffect(() => {
    const savedLogin = localStorage.getItem('sinalizacoes_remember_login');
    if (savedLogin) {
      setLogin(savedLogin);
      setLembrarMe(true);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanLogin = login.trim();
    if (!cleanLogin || !senha) {
      setError('Por favor, informe seu usuário e senha de acesso.');
      return;
    }
    setError(null);
    setIsLoading(true);

    try {
      if (lembrarMe) {
        localStorage.setItem('sinalizacoes_remember_login', cleanLogin);
      } else {
        localStorage.removeItem('sinalizacoes_remember_login');
      }

      const user = await api.login(cleanLogin, senha);
      onLoginSuccess(user);
    } catch (err: any) {
      setError(err.message || 'Erro de autenticação. Verifique suas credenciais.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFillDemo = () => {
    setLogin('admin');
    setSenha('123');
    setError(null);
  };

  return (
    <div className="min-h-screen w-full flex flex-col justify-center items-center bg-gradient-to-b from-[#a1abb7] via-[#94a0ae] to-[#7f8b9a] text-slate-800 relative overflow-hidden select-none py-8 px-4">
      {/* Background Soft Studio Lighting Effect */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-white/20 rounded-full blur-3xl pointer-events-none -z-0" />

      {/* MAIN CONTAINER / CARD SECTION */}
      <main className="my-auto py-6 z-10 w-full max-w-sm relative">
        {/* Soft Floor Shadow Underneath Card */}
        <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-[85%] h-6 bg-black/30 rounded-[100%] blur-md pointer-events-none" />

        {/* The Sleek Gray Metallic Box */}
        <div className="relative bg-gradient-to-b from-[#f3f5f8] via-[#e5e9ee] to-[#d8dfe6] rounded-2xl shadow-2xl border border-white/80 px-6 sm:px-8 pb-6 sm:pb-8 pt-0 overflow-hidden">
          
          {/* CURVED TOP BLUE RIBBON BANNER - FLUSH TO THE VERY TOP EDGE */}
          <div className="relative mx-auto mb-6 w-52 sm:w-60 -mt-0">
            {/* Blue Folded Ribbon going all the way flush to the top edge */}
            <div className="bg-gradient-to-b from-[#009fe3] via-[#008bd2] to-[#0072b8] h-12 py-1 rounded-b-2xl shadow-md flex items-center justify-center border-b border-sky-400/30">
              {/* Clean Transparent PNG Logo */}
              <img
                src="/logo.png"
                alt="Logo Proativa"
                className="h-8 w-auto max-w-[170px] object-contain filter drop-shadow"
                onError={(e) => {
                  (e.currentTarget as HTMLElement).style.display = 'none';
                }}
              />
            </div>
          </div>

          {/* Subtitle / System Name */}
          <div className="text-center mb-6">
            <h1 className="text-lg font-bold text-slate-800 tracking-tight">
              Controle de Sinalizações
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Entre com seu usuário e senha
            </p>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-600 flex items-start gap-2 animate-fade-in shadow-xs">
              <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
              <div className="flex-1 leading-tight">{error}</div>
            </div>
          )}

          {/* Form Fields */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username Input */}
            <div className="flex rounded-md overflow-hidden border border-slate-300/90 shadow-inner bg-white focus-within:ring-2 focus-within:ring-[#0092dd]/40 focus-within:border-[#0092dd] transition-all">
              <div className="bg-[#0092dd] text-white p-3 flex items-center justify-center shrink-0 w-11 shadow-inner">
                <User className="h-4 w-4" />
              </div>
              <input
                type="text"
                required
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                placeholder="Usuário"
                className="w-full px-3 py-2.5 bg-white text-slate-800 text-sm placeholder-slate-400 focus:outline-none"
              />
            </div>

            {/* Password Input */}
            <div className="flex rounded-md overflow-hidden border border-slate-300/90 shadow-inner bg-white relative focus-within:ring-2 focus-within:ring-[#0092dd]/40 focus-within:border-[#0092dd] transition-all">
              <div className="bg-[#0092dd] text-white p-3 flex items-center justify-center shrink-0 w-11 shadow-inner">
                <Lock className="h-4 w-4" />
              </div>
              <input
                type={showSenha ? 'text' : 'password'}
                required
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="Senha"
                className="w-full pl-3 pr-9 py-2.5 bg-white text-slate-800 text-sm placeholder-slate-400 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowSenha(!showSenha)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                title={showSenha ? 'Ocultar senha' : 'Exibir senha'}
              >
                {showSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            {/* Checkbox and Forgot password link */}
            <div className="flex items-center justify-between text-xs text-slate-600 px-0.5 pt-1">
              <label className="flex items-center gap-1.5 cursor-pointer select-none group">
                <input
                  type="checkbox"
                  checked={lembrarMe}
                  onChange={(e) => setLembrarMe(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-slate-300 text-[#0092dd] focus:ring-[#0092dd] accent-[#0092dd] cursor-pointer"
                />
                <span className="group-hover:text-slate-800 transition-colors">Lembrar-me</span>
              </label>

              <button
                type="button"
                onClick={() => setShowForgotModal(true)}
                className="text-slate-500 hover:text-[#0092dd] hover:underline transition-colors cursor-pointer"
              >
                Esqueci a senha?
              </button>
            </div>

            {/* Blue Action Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 bg-gradient-to-b from-[#00a3e0] via-[#0089d0] to-[#006ebb] hover:from-[#00aceb] hover:to-[#0074c7] active:scale-[0.99] text-white font-bold text-sm tracking-wider uppercase rounded-md shadow-md shadow-sky-900/20 border-t border-sky-300/40 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ENTRANDO...
                  </span>
                ) : (
                  'LOGIN'
                )}
              </button>
            </div>
          </form>
        </div>
      </main>

      {/* FOOTER */}
      <footer className="w-full text-center text-xs text-white/70 z-10 py-2">
        <p>© PROATIVA — Planejamento Operacional</p>
      </footer>

      {/* MODAL: ESQUECI MINHA SENHA */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl border border-slate-200 text-center text-slate-700">
            <div className="h-12 w-12 rounded-full bg-sky-50 text-[#0092dd] flex items-center justify-center mx-auto mb-3 border border-sky-100">
              <HelpCircle className="h-6 w-6" />
            </div>
            <h3 className="text-base font-bold text-slate-800 mb-2">
              Recuperação de Acesso
            </h3>
            <p className="text-xs text-slate-600 mb-6 leading-relaxed">
              Para redefinir sua senha, solicite ao Planejamento Operacional ou ao Administrador do sistema.
            </p>

            <button
              onClick={() => setShowForgotModal(false)}
              className="w-full py-2.5 bg-[#0092dd] hover:bg-[#0081c7] text-white text-xs font-bold rounded-md shadow-sm transition cursor-pointer"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  );
};


