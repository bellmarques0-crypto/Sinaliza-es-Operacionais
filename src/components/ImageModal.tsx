import React from 'react';
import { X, Download, FileText, Image as ImageIcon } from 'lucide-react';

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
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
              <ImageIcon className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-800">{title}</h3>
              {details && (
                <p className="text-xs text-slate-500">
                  Operador: <span className="font-medium text-slate-700">{details.operador}</span> • Motivo:{' '}
                  <span className="font-medium text-slate-700">{details.motivo}</span>
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Image Content */}
        <div className="p-6 bg-slate-950 flex items-center justify-center min-h-[320px] max-h-[70vh] overflow-auto">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt="Evidência"
              className="max-h-[60vh] max-w-full rounded-lg object-contain shadow-md"
              onError={(e) => {
                // Fallback image placeholder if missing
                (e.target as HTMLImageElement).src =
                  'https://images.unsplash.com/photo-1584438784894-089d6a62b8fa?auto=format&fit=crop&w=800&q=80';
              }}
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <FileText className="h-12 w-12 mb-2 text-slate-500" />
              <p>Nenhuma imagem de evidência disponível para este registro.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/80 px-6 py-3.5">
          {details ? (
            <div className="text-xs text-slate-500">
              Data: <span className="font-medium text-slate-700">{details.data}</span> às{' '}
              <span className="font-medium text-slate-700">{details.hora}</span>
            </div>
          ) : (
            <div />
          )}
          <div className="flex items-center gap-3">
            {imageUrl && (
              <a
                href={imageUrl}
                download
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition"
              >
                <Download className="h-4 w-4" />
                Baixar Imagem
              </a>
            )}
            <button
              onClick={onClose}
              className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 transition"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
