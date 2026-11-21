import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, X } from 'lucide-react';
import { haptic } from '../lib/haptics';

export interface SelectOption {
  value: string;
  label: string;
  subtitle?: string;
  dotColor?: string;
}

interface NativeSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  title?: string;
  className?: string;
  highlightWarning?: boolean;
  disabled?: boolean;
}

/**
 * Tactile native-feeling picker:
 * - On Android/mobile: opens a smooth Modern-Retro bottom sheet with generous 52px tap targets.
 * - On PC/desktop: opens a crisp popover list right below the field.
 * Eliminates ugly browser <select> system dialogs.
 */
export const NativeSelect: React.FC<NativeSelectProps> = ({
  value,
  onChange,
  options,
  placeholder = 'Select...',
  title = 'Choose an option',
  className = '',
  highlightWarning = false,
  disabled = false,
}) => {
  const [open, setOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    if (!open || isMobile) return;
    const onDocClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, isMobile]);

  const selected = options.find((o) => o.value === value) || null;

  const handleSelect = (val: string) => {
    haptic('tap');
    onChange(val);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          haptic('tap');
          // Dismiss Android keyboard before opening bottom sheet
          if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
          }
          setOpen((o) => !o);
        }}
        className={`input-field flex items-center justify-between gap-2 text-left cursor-pointer disabled:opacity-50 ${
          highlightWarning ? '!border-amber-500 !ring-2 !ring-amber-500/20' : ''
        } ${className}`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 min-w-0 truncate">
          {selected?.dotColor && (
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: selected.dotColor }}
            />
          )}
          <span className={`truncate ${selected ? '' : 'text-[var(--text-muted)]'}`}>
            {selected ? selected.label : placeholder}
          </span>
        </span>
        <ChevronDown
          className={`w-4 h-4 text-[var(--text-muted)] shrink-0 transition-transform duration-150 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Desktop Popover Menu */}
      {open && !isMobile && (
        <div
          className="absolute left-0 right-0 mt-1.5 z-50 rounded-2xl border shadow-xl max-h-60 overflow-y-auto p-1.5 animate-modal"
          style={{
            backgroundColor: 'var(--bg-surface-solid)',
            borderColor: 'var(--border-subtle)',
          }}
          role="listbox"
        >
          {options.map((opt) => {
            const active = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleSelect(opt.value)}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-left text-sm transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#233E1E] text-[#FBFBF4] dark:bg-[#C3D48E] dark:text-[#162613] font-semibold'
                    : 'hover:bg-[var(--bg-subtle)] text-[var(--text-primary)]'
                }`}
                role="option"
                aria-selected={active}
              >
                <span className="flex items-center gap-2 min-w-0">
                  {opt.dotColor && (
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: opt.dotColor }}
                    />
                  )}
                  <span className="truncate">{opt.label}</span>
                </span>
                {active && <Check className="w-4 h-4 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}

      {/* Android / Mobile Native Bottom Sheet Picker */}
      {open && isMobile && (
        <div
          className="fixed inset-0 z-[70] flex items-end bg-black/45 backdrop-blur-[2px]"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full rounded-t-3xl border-t pt-3 pb-safe max-h-[75dvh] flex flex-col animate-sheet"
            style={{
              backgroundColor: 'var(--bg-surface-solid)',
              borderColor: 'var(--border-subtle)',
            }}
            onClick={(e) => e.stopPropagation()}
            role="listbox"
          >
            <div className="w-10 h-1 rounded-full bg-black/15 dark:bg-white/20 mx-auto mb-3" />

            <div className="flex items-center justify-between px-5 pb-3 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
              <h3 className="text-base font-bold">{title}</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-full text-[var(--text-muted)]"
                aria-label="Close picker"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto px-3 py-2 space-y-1">
              {options.map((opt) => {
                const active = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleSelect(opt.value)}
                    className={`w-full flex items-center justify-between gap-3 px-4 py-3.5 min-h-[52px] rounded-2xl text-left transition-all active:scale-[0.99] ${
                      active
                        ? 'bg-[#233E1E] text-[#FBFBF4] dark:bg-[#C3D48E] dark:text-[#162613] font-bold'
                        : 'bg-transparent active:bg-[var(--bg-subtle)] text-[var(--text-primary)] font-medium'
                    }`}
                    role="option"
                    aria-selected={active}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {opt.dotColor && (
                        <span
                          className="w-3 h-3 rounded-full shrink-0 ring-2 ring-white/40"
                          style={{ backgroundColor: opt.dotColor }}
                        />
                      )}
                      <div className="min-w-0">
                        <p className="text-[15px] truncate leading-snug">{opt.label}</p>
                        {opt.subtitle && (
                          <p
                            className={`text-xs truncate mt-0.5 ${
                              active ? 'opacity-80' : 'text-[var(--text-muted)]'
                            }`}
                          >
                            {opt.subtitle}
                          </p>
                        )}
                      </div>
                    </div>
                    {active && <Check className="w-5 h-5 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
