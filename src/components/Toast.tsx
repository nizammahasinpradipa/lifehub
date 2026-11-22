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
          className="pointer-events-auto flex items-center gap-2.5 px-4 py-3 rounded-2xl border animate-modal"
          style={{
            backgroundColor: 'var(--bg-surface-elevated)',
            borderColor:
              toast.tone === 'warning'
                ? 'var(--state-warning)'
                : toast.tone === 'success'
                ? 'var(--state-success)'
                : 'var(--border-strong)',
            color: 'var(--text-primary)',
            boxShadow: 'var(--shadow-popover)',
          }}
        >
          {toast.tone === 'success' && <CheckCircle2 className="w-4 h-4 shrink-0 text-state-success" />}
          {toast.tone === 'warning' && <AlertTriangle className="w-4 h-4 shrink-0 text-state-warning" />}
          {(!toast.tone || toast.tone === 'neutral') && <Info className="w-4 h-4 shrink-0 text-state-info" />}
          <span className="text-sm font-medium flex-1 leading-snug">{toast.message}</span>
          <button
            type="button"
            onClick={() => dismissToast(toast.id)}
            className="p-1 rounded-lg hover:bg-[var(--bg-subtle)] text-[var(--text-muted)] cursor-pointer"
            aria-label="Dismiss notification"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
};
