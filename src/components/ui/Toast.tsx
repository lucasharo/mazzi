import React from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'warning' | 'error' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
}

export interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => {
        const config = {
          success: {
            bg: 'bg-slate-900 border-amber-400/40 text-white',
            icon: <CheckCircle2 className="w-5 h-5 text-amber-400 flex-shrink-0" />,
          },
          warning: {
            bg: 'bg-amber-950 border-amber-500 text-amber-100',
            icon: <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />,
          },
          error: {
            bg: 'bg-rose-950 border-rose-600 text-white',
            icon: <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0" />,
          },
          info: {
            bg: 'bg-slate-900 border-slate-700 text-white',
            icon: <Info className="w-5 h-5 text-amber-400 flex-shrink-0" />,
          },
        }[toast.type];

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto p-4 rounded-2xl border shadow-xl flex items-start gap-3 animate-in slide-in-from-right duration-200 ${config.bg} text-left`}
          >
            {config.icon}
            <div className="flex-1 text-xs">
              <h4 className="font-bold text-sm leading-tight text-white">{toast.title}</h4>
              {toast.description && (
                <p className="mt-1 text-slate-300 leading-normal">{toast.description}</p>
              )}
            </div>
            <button
              onClick={() => onDismiss(toast.id)}
              className="text-slate-400 hover:text-white transition p-0.5"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
