import React from 'react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';
import { useLifeHub } from '../store/LifeHubContext';

export const ToastContainer: React.FC = () => {
  const { toasts, dismissToast } = useLifeHub();

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-20 left-1/2 -translate-x-1/2 md:bottom-6 md:left-auto md:right-6 md:translate-x-0 z-50 flex flex-col gap-2 w-[calc(100%-2rem)] max-w-sm pointer-events-none"
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg border animate-modal"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor:
              toast.tone === 'warning'
                ? '#f59e0b'
                : toast.tone === 'success'
                ? 'var(--accent)'
                : 'var(--border-subtle)',
            color: 'var(--text-primary)',
          }}
        >
          {toast.tone === 'success' && <CheckCircle2 className="w-4 h-4 shrink-0 text-teal-600 dark:text-teal-400" />}
          {toast.tone === 'warning' && <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500" />}
          {(!toast.tone || toast.tone === 'neutral') && <Info className="w-4 h-4 shrink-0 text-zinc-400" />}
          <span className="text-sm font-medium flex-1 leading-snug">{toast.message}</span>
          <button
            type="button"
            onClick={() => dismissToast(toast.id)}
            className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400"
            aria-label="Dismiss notification"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
};
