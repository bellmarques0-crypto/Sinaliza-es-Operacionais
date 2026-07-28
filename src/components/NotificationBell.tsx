import React, { useState, useEffect, useRef } from 'react';
import { Bell, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import { UserSession, Sinalizacao } from '../types';
import { api } from '../services/api';

interface NotificationBellProps {
  user: UserSession;
  onNavigateToSinalizacoes: () => void;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({
  user,
  onNavigateToSinalizacoes,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [pendingList, setPendingList] = useState<Sinalizacao[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    try {
      setIsLoading(true);
      const list = await api.getSinalizacoes();
      
      const userPerfil = user.perfil || 'Operação';
      const userName = (user.nome || '').toLowerCase().trim();
      const userLogin = (user.login || '').toLowerCase().trim();

      const filtered = list.filter((s) => {
        if (s.confirmado) return false;

        if (userPerfil === 'Administrador' || userPerfil === 'Planejamento') {
          return true;
        }

        const supName = (s.supervisor || '').toLowerCase().trim();
        if (supName === userName || supName === userLogin) {
          return true;
        }

        if (userPerfil === 'Supervisor') {
          return true;
        }

        return false;
      });

      // Sort by id descending (newest first)
      filtered.sort((a, b) => b.id - a.id);
      setPendingList(filtered);
    } catch (err) {
      console.error('Erro ao carregar notificações:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();

    // Poll every 12 seconds for real-time notification updates
    const timer = setInterval(fetchNotifications, 12000);
    
    // Listen to custom event when sinalizações are added or updated
    const handleUpdateEvent = () => fetchNotifications();
    window.addEventListener('sinalizacoesUpdated', handleUpdateEvent);

    return () => {
      clearInterval(timer);
      window.removeEventListener('sinalizacoesUpdated', handleUpdateEvent);
    };
  }, [user]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleConfirm = async (id: number) => {
    try {
      setConfirmingId(id);
      await api.confirmarSinalizacao(id);
      setPendingList((prev) => prev.filter((item) => item.id !== id));
      window.dispatchEvent(new Event('sinalizacoesUpdated'));
    } catch (err: any) {
      console.error('Erro ao confirmar sinalização via notificação:', err);
      alert('Erro ao confirmar: ' + (err.message || 'Erro desconhecido'));
    } finally {
      setConfirmingId(null);
    }
  };

  const getGravidadeBadge = (grav: string = 'Médio') => {
    const g = grav.toLowerCase().trim();
    if (g === 'muito alto') return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/20 text-red-300 border border-red-500/30">Muito alto</span>;
    if (g === 'alto') return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-500/20 text-orange-300 border border-orange-500/30">Alto</span>;
    if (g === 'médio' || g === 'medio') return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">Médio</span>;
    if (g === 'baixo') return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">Baixo</span>;
    if (g === 'muito baixo') return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-500/20 text-slate-300 border border-slate-500/30">Muito baixo</span>;
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-500/20 text-slate-300 border border-slate-500/30">{grav || 'Médio'}</span>;
  };

  const pendingCount = pendingList.length;

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) {
            fetchNotifications();
          }
        }}
        className="flex items-center justify-center h-10 w-10 bg-slate-800/90 hover:bg-slate-800 border border-slate-700/80 hover:border-slate-600 rounded-xl shadow-xs transition cursor-pointer relative group"
        title="Notificações de Sinalizações"
      >
        <Bell className="h-5 w-5 text-slate-300 group-hover:text-white transition transform group-hover:scale-105" />
        {pendingCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 flex h-5 min-w-5 px-1 items-center justify-center rounded-full bg-red-500 text-[10px] font-extrabold text-white shadow-md ring-2 ring-slate-900 animate-pulse">
            {pendingCount > 99 ? '99+' : pendingCount}
          </span>
        )}
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-slate-900 border border-slate-700/90 shadow-2xl z-50 text-slate-200 animate-fade-in-scale overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-slate-850 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-blue-400" />
              <span className="text-xs font-bold text-white">Notificações Operacionais</span>
            </div>
            {pendingCount > 0 ? (
              <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/30 text-[10px] font-bold">
                {pendingCount} pendente{pendingCount > 1 ? 's' : ''}
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">
                Em dia
              </span>
            )}
          </div>

          {/* List Content */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-800/80">
            {isLoading && pendingList.length === 0 ? (
              <div className="p-8 text-center text-slate-400 flex flex-col items-center justify-center">
                <span className="h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-2" />
                <span className="text-xs">Buscando sinalizações pendentes...</span>
              </div>
            ) : pendingList.length === 0 ? (
              <div className="p-8 text-center flex flex-col items-center justify-center bg-slate-900/50">
                <CheckCircle2 className="h-9 w-9 text-emerald-500 mb-2.5 opacity-90" />
                <p className="text-xs font-bold text-white">Nenhuma sinalização pendente</p>
                <p className="text-[11px] text-slate-400 mt-1 max-w-[220px]">
                  Todas as sinalizações direcionadas a você já foram verificadas e confirmadas.
                </p>
              </div>
            ) : (
              pendingList.map((item) => (
                <div key={item.id} className="p-3.5 hover:bg-slate-800/70 transition flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-extrabold text-white">#{item.id} • {item.produto}</span>
                      {getGravidadeBadge(item.gravidade)}
                    </div>
                    <span className="text-[10px] text-slate-400 shrink-0 flex items-center gap-1">
                      <Clock className="h-3 w-3 text-slate-500" />
                      {item.data}
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 line-clamp-2 bg-slate-800/50 p-2 rounded-lg border border-slate-750">
                    <span className="font-semibold text-slate-400">Motivo:</span> {item.motivo}
                    {item.observacao ? ` • "${item.observacao}"` : ''}
                  </p>

                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <div>
                      <span className="text-slate-500">Operador:</span> <span className="text-slate-300 font-medium">{item.operador}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Superv:</span> <span className="text-blue-400 font-medium">{item.supervisor}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 mt-1 pt-2 border-t border-slate-800/60">
                    <button
                      type="button"
                      onClick={() => {
                        onNavigateToSinalizacoes();
                        setIsOpen(false);
                      }}
                      className="text-[11px] font-semibold text-blue-400 hover:text-blue-300 px-2 py-1 rounded hover:bg-blue-500/10 transition cursor-pointer"
                    >
                      Ver detalhes
                    </button>
                    <button
                      type="button"
                      onClick={() => handleConfirm(item.id)}
                      disabled={confirmingId === item.id}
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white shadow-xs hover:bg-emerald-500 transition cursor-pointer disabled:opacity-50"
                      title="Confirmar recebimento / check da sinalização"
                    >
                      {confirmingId === item.id ? (
                        <span className="h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      )}
                      <span>Confirmar Check</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="p-2.5 bg-slate-850 border-t border-slate-800 text-center">
            <button
              type="button"
              onClick={() => {
                onNavigateToSinalizacoes();
                setIsOpen(false);
              }}
              className="text-xs font-semibold text-blue-400 hover:text-blue-300 hover:underline w-full py-1 cursor-pointer"
            >
              Abrir aba de Sinalizações →
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
