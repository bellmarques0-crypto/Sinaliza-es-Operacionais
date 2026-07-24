import React, { useState, useEffect } from 'react';
import { X, Download, FileText, Image as ImageIcon, AlertCircle } from 'lucide-react';

interface ImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  title?: string;
  details?: {
    operador: string;
    motivo: string;
    data: string;
    hora: string;
  };
}

export const ImageModal: React.FC<ImageModalProps> = ({
  isOpen,
  onClose,
  imageUrl,
  title = 'Evidência Anexada',
  details
}) => {
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    setImageError(false);
  }, [imageUrl, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl overflow-hidden rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/80 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400">
              <ImageIcon className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-800 dark:text-white">{title}</h3>
              {details && (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Operador: <span className="font-medium text-slate-700 dark:text-slate-200">{details.operador}</span> • Motivo:{' '}
                  <span className="font-medium text-slate-700 dark:text-slate-200">{details.motivo}</span>
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-200 transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Image Content */}
        <div className="p-6 bg-slate-950 flex items-center justify-center min-h-[320px] max-h-[70vh] overflow-auto">
          {imageUrl && !imageError ? (
            <img
              src={imageUrl}
              alt="Evidência"
              className="max-h-[60vh] max-w-full rounded-lg object-contain shadow-md"
              onError={() => {
                setImageError(true);
              }}
            />
          ) : imageError ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400 text-center px-4">
              <AlertCircle className="h-12 w-12 mb-3 text-amber-500" />
              <p className="text-sm font-semibold text-slate-200">Não foi possível carregar a imagem da evidência.</p>
              <p className="text-xs text-slate-400 mt-1">O arquivo pode ter sido corrompido ou não estar mais disponível.</p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <FileText className="h-12 w-12 mb-2 text-slate-500" />
              <p>Nenhuma imagem de evidência disponível para este registro.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/80 px-6 py-3.5">
          {details ? (
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Data: <span className="font-medium text-slate-700 dark:text-slate-200">{details.data}</span> às{' '}
              <span className="font-medium text-slate-700 dark:text-slate-200">{details.hora}</span>
            </div>
          ) : (
            <div />
          )}
          <div className="flex items-center gap-3">
            {imageUrl && !imageError && (
              <a
                href={imageUrl}
                download={`evidencia_${details?.operador || 'sinalizacao'}.png`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-slate-100 dark:bg-slate-700 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 transition"
              >
                <Download className="h-4 w-4" />
                Baixar Imagem
              </a>
            )}
            <button
              onClick={onClose}
              className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 transition cursor-pointer"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
