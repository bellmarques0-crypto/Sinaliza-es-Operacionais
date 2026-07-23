import React, { useState, useEffect } from 'react';
import { User, Lock, Eye, EyeOff, AlertCircle, ShieldCheck, HelpCircle, CheckCircle2 } from 'lucide-react';
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
    <div className="min-h-screen w-full flex flex-col justify-between items-center bg-slate-900 text-slate-100 relative overflow-hidden select-none py-8 px-4 sm:px-6">
      {/* Background Decorative Gradients */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-gradient-to-b from-blue-600/20 via-indigo-600/10 to-transparent rounded-full blur-3xl pointer-events-none -z-0" />
      <div className="absolute -bottom-20 -left-20 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none -z-0" />
      <div className="absolute -top-20 -right-20 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -z-0" />

      {/* HEADER / LOGO BAR */}
      <header className="w-full max-w-5xl flex items-center justify-between z-10 py-2">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-blue-600 to-blue-400 flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <span className="font-bold text-lg text-white tracking-wide block leading-none">PROATIVA</span>
            <span className="text-xs text-blue-400 font-medium tracking-wider">PLANEJAMENTO OPERACIONAL</span>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2 bg-slate-800/80 border border-slate-700/60 rounded-full px-3 py-1 text-xs text-slate-300">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Sistema Operacional Ativo</span>
        </div>
      </header>

      {/* MAIN CENTERED CARD */}
      <main className="my-auto py-8 z-10 w-full max-w-md">
        <div className="bg-slate-800/90 backdrop-blur-xl border border-slate-700/80 rounded-3xl shadow-2xl shadow-black/50 overflow-hidden transition-all duration-300">
          {/* Top Blue Accent Bar */}
          <div className="h-1.5 w-full bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-600" />

          <div className="p-6 sm:p-8">
            {/* Title Section */}
            <div className="text-center mb-6">
              <h1 className="text-2xl font-bold text-white tracking-tight">
                Controle de Sinalizações
              </h1>
              <p className="text-sm text-slate-400 mt-1">
                Acesse com suas credenciais de usuário
              </p>
            </div>

            {/* Error Banner */}
            {error && (
              <div className="mb-5 rounded-2xl bg-red-500/10 border border-red-500/30 p-3.5 text-xs text-red-300 flex items-start gap-3 animate-fade-in">
                <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
                <div className="flex-1 leading-relaxed">{error}</div>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Login Field */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Usuário
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                    <User className="h-5 w-5" />
                  </div>
                  <input
                    type="text"
                    required
                    value={login}
                    onChange={(e) => setLogin(e.target.value)}
                    placeholder="Digite seu login"
                    className="w-full h-12 pl-11 pr-4 rounded-xl border border-slate-700 bg-slate-900/80 text-white placeholder-slate-500 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all"
                  />
                </div>
              </div>

              {/* Password Field */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Senha
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                    <Lock className="h-5 w-5" />
                  </div>
                  <input
                    type={showSenha ? 'text' : 'password'}
                    required
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    placeholder="Digite sua senha"
                    className="w-full h-12 pl-11 pr-11 rounded-xl border border-slate-700 bg-slate-900/80 text-white placeholder-slate-500 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSenha(!showSenha)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 hover:text-white transition-colors cursor-pointer"
                    title={showSenha ? 'Ocultar senha' : 'Exibir senha'}
                  >
                    {showSenha ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              {/* Remember Me & Forgot Password */}
              <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                <label className="flex items-center gap-2 cursor-pointer group select-none">
                  <input
                    type="checkbox"
                    checked={lembrarMe}
                    onChange={(e) => setLembrarMe(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-500/20 accent-blue-600 cursor-pointer"
                  />
                  <span className="group-hover:text-slate-200 transition-colors">Lembrar usuário</span>
                </label>

                <button
                  type="button"
                  onClick={() => setShowForgotModal(true)}
                  className="hover:text-blue-400 hover:underline transition-colors cursor-pointer"
                >
                  Esqueci a senha
                </button>
              </div>

              {/* Submit Button */}
              <div className="pt-3">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-12 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-[0.99] text-white font-semibold text-base rounded-xl shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2 text-white">
                      <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Autenticando...
                    </span>
                  ) : (
                    'ENTRAR NO SISTEMA'
                  )}
                </button>
              </div>
            </form>

            {/* Quick Demo Fill Box */}
            <div className="mt-6 pt-5 border-t border-slate-700/60 text-center">
              <button
                type="button"
                onClick={handleFillDemo}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-700/50 hover:bg-slate-700 text-xs text-slate-300 hover:text-white border border-slate-600/50 transition cursor-pointer"
              >
                <CheckCircle2 className="h-3.5 w-3.5 text-blue-400" />
                <span>Preencher credenciais padrão (admin / 123)</span>
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* FOOTER */}
      <footer className="w-full max-w-md text-center text-xs text-slate-500 z-10 flex items-center justify-center gap-3">
        <span>Sinalizações Proativa v1.0</span>
        <span>•</span>
        <span>© Planejamento Operacional</span>
      </footer>

      {/* MODAL: ESQUECI MINHA SENHA */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm rounded-2xl bg-slate-800 p-6 shadow-2xl border border-slate-700 text-center text-slate-200">
            <div className="h-12 w-12 rounded-2xl bg-blue-500/20 text-blue-400 flex items-center justify-center mx-auto mb-3">
              <HelpCircle className="h-6 w-6" />
            </div>
            <h3 className="text-base font-bold text-white mb-2">
              Recuperação de Acesso
            </h3>
            <p className="text-xs text-slate-400 mb-6 leading-relaxed">
              Para solicitar a redefinição de sua senha, entre em contato com a equipe do Planejamento Operacional ou com o Administrador responsável pelo sistema.
            </p>

            <button
              onClick={() => setShowForgotModal(false)}
              className="w-full h-10 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl shadow-md transition cursor-pointer"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

