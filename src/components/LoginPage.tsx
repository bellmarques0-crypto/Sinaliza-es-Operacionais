import React, { useState } from 'react';
import { User, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!login || !senha) {
      setError('Por favor, preencha o usuário e a senha.');
      return;
    }
    setError(null);
    setIsLoading(true);

    try {
      const user = await api.login(login, senha);
      onLoginSuccess(user);
    } catch (err: any) {
      setError(err.message || 'Erro ao realizar login. Verifique suas credenciais.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col justify-between items-center relative overflow-x-hidden bg-gradient-to-b from-[#F8FAFC] via-[#F5F7FA] to-[#EEF2F7] py-6 px-4 select-none">
      {/* Iluminação Difusa Radial Atrás do Formulário */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[650px] bg-blue-300/25 rounded-full blur-3xl pointer-events-none -z-0" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[480px] h-[480px] bg-white/60 rounded-full blur-2xl pointer-events-none -z-0" />

      {/* ÁREA CENTRAL - CÍRCULO PRINCIPAL */}
      <div className="my-auto py-4 z-10 flex items-center justify-center w-full">
        <div className="animate-fade-in-scale relative w-full max-w-[520px] aspect-square rounded-full bg-white/95 backdrop-blur-md border-[8px] border-[#2563EB] shadow-[0_25px_60px_-15px_rgba(30,58,138,0.22)] flex flex-col items-center justify-center p-8 sm:p-12 transition-all duration-300 hover:shadow-[0_30px_70px_-12px_rgba(37,99,235,0.28)]">

          {/* Cabeçalho da Área Central */}
          <div className="text-center mb-6 max-w-[380px]">
            <h1 className="text-[26px] sm:text-[30px] font-bold text-[#1E3A8A] leading-tight tracking-tight">
              Controle de Sinalizações
            </h1>
            <p className="text-[14px] sm:text-[16px] font-medium text-[#2563EB] mt-1 tracking-wide">
              PROATIVA
            </p>
          </div>

          {/* Banner de Erro */}
          {error && (
            <div className="w-full max-w-[360px] mb-4 rounded-xl bg-red-50 border border-red-200 p-2.5 text-xs text-[#EF4444] flex items-center gap-2 animate-fade-in-scale">
              <AlertCircle className="h-4 w-4 shrink-0 text-[#EF4444]" />
              <span className="font-medium text-[12px]">{error}</span>
            </div>
          )}

          {/* Formulário */}
          <form onSubmit={handleSubmit} className="w-full max-w-[360px] space-y-4">
            {/* Campo Usuário */}
            <div>
              <div className="relative rounded-xl">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-[#2563EB]">
                  <User className="h-5 w-5" />
                </div>
                <input
                  type="text"
                  required
                  value={login}
                  onChange={(e) => setLogin(e.target.value)}
                  placeholder="Digite seu usuário"
                  className="w-full h-[52px] pl-12 pr-4 rounded-xl border-[2px] border-[#D6E4FF] bg-white text-[15px] text-[#374151] placeholder-[#9CA3AF] focus:border-[#2563EB] focus:ring-4 focus:ring-blue-500/10 focus:outline-none transition-all duration-200"
                />
              </div>
            </div>

            {/* Campo Senha */}
            <div>
              <div className="relative rounded-xl">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-[#2563EB]">
                  <Lock className="h-5 w-5" />
                </div>
                <input
                  type={showSenha ? 'text' : 'password'}
                  required
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder="Digite sua senha"
                  className="w-full h-[52px] pl-12 pr-12 rounded-xl border-[2px] border-[#D6E4FF] bg-white text-[15px] text-[#374151] placeholder-[#9CA3AF] focus:border-[#2563EB] focus:ring-4 focus:ring-blue-500/10 focus:outline-none transition-all duration-200"
                />
                <button
                  type="button"
                  onClick={() => setShowSenha(!showSenha)}
                  className="absolute inset-y-0 right-0 flex items-center pr-4 text-[#9CA3AF] hover:text-[#2563EB] transition-colors cursor-pointer"
                  title={showSenha ? 'Ocultar senha' : 'Exibir senha'}
                >
                  {showSenha ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {/* Opções Inferiores: Lembrar-me e Esqueci a Senha */}
            <div className="flex items-center justify-between text-xs px-1 pt-1 text-[#6B7280]">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={lembrarMe}
                  onChange={(e) => setLembrarMe(e.target.checked)}
                  className="h-4 w-4 rounded border-[#D6E4FF] text-[#2563EB] focus:ring-[#2563EB] accent-[#2563EB] cursor-pointer"
                />
                <span className="group-hover:text-[#2563EB] transition-colors">Lembrar-me</span>
              </label>

              <button
                type="button"
                onClick={() => setShowForgotModal(true)}
                className="hover:text-[#2563EB] hover:underline transition-colors font-medium cursor-pointer"
              >
                Esqueci minha senha?
              </button>
            </div>

            {/* Botão Entrar */}
            <div className="pt-2 flex justify-center">
              <button
                type="submit"
                disabled={isLoading}
                className="w-[220px] h-[50px] bg-[#2563EB] hover:bg-[#1D4ED8] active:scale-[0.98] text-white font-semibold text-[16px] rounded-[14px] shadow-md shadow-blue-600/20 hover:shadow-lg hover:shadow-blue-600/30 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2 text-white">
                    <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Entrando...
                  </span>
                ) : (
                  'LOGIN'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* RODAPÉ DA TELA */}
      <footer className="w-full text-center py-2 text-[13px] text-[#9CA3AF] z-10 flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-3">
        <span>Versão 1.0</span>
        <span className="hidden sm:inline">•</span>
        <span>© Planejamento Operacional</span>
      </footer>

      {/* MODAL: ESQUECI MINHA SENHA */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs animate-fade-in-scale">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl border border-[#D6E4FF] text-center">
            <div className="h-12 w-12 rounded-full bg-blue-50 text-[#2563EB] flex items-center justify-center mx-auto mb-3">
              <Lock className="h-6 w-6" />
            </div>
            <h3 className="text-base font-bold text-[#1E3A8A] mb-1">
              Recuperação de Acesso
            </h3>
            <p className="text-xs text-[#6B7280] mb-5 leading-relaxed">
              Para redefinir sua senha, entre em contato com a equipe de Suporte do Planejamento Operacional ou com o seu Supervisor responsável.
            </p>

            <button
              onClick={() => setShowForgotModal(false)}
              className="w-full h-10 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold rounded-xl shadow-sm transition cursor-pointer"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
