import React, { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { ButtonBase } from './Button';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: SelectOption[];
  helperText?: string;
  error?: string;
}

export const Select: React.FC<SelectProps> = ({
  label, options, helperText, error, className = '', id, value, defaultValue,
  onChange, onBlur, onFocus, name, required, disabled,
}) => {
  const generatedId = useId();
  const selectId = id || `select-${generatedId.replace(/:/g, '')}`;
  const listboxId = `${selectId}-options`;
  const messageId = `${selectId}-message`;
  const rootRef = useRef<HTMLDivElement>(null);
  const typeaheadBufferRef = useRef('');
  const typeaheadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialValue = String(value ?? defaultValue ?? options[0]?.value ?? '');
  const [internalValue, setInternalValue] = useState(initialValue);
  const [isOpen, setIsOpen] = useState(false);

  const selectedValue = value === undefined ? internalValue : String(value);
  const selectedOption = options.find((option) => option.value === selectedValue) || options[0];
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === selectedValue));

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleOutsidePointer = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setIsOpen(false);
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('pointerdown', handleOutsidePointer);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('pointerdown', handleOutsidePointer);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  useEffect(() => () => {
    if (typeaheadTimerRef.current) window.clearTimeout(typeaheadTimerRef.current);
  }, []);

  const chooseOption = (option: SelectOption) => {
    if (disabled || option.disabled) return;
    setInternalValue(option.value);
    onChange?.({ target: { value: option.value, name: name || '' } } as React.ChangeEvent<HTMLSelectElement>);
    setIsOpen(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setIsOpen((open) => !open);
      return;
    }
    if (event.key === 'Escape') { setIsOpen(false); return; }

    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey && /\S/.test(event.key)) {
      event.preventDefault();
      const normalizedKey = event.key.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      const nextBuffer = `${typeaheadBufferRef.current}${normalizedKey}`;
      const normalizedLabel = (label: string) => label.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      const matchingOption = options.find((option) => {
        if (option.disabled || !option.value) return false;
        const label = normalizedLabel(option.label);
        return label.startsWith(nextBuffer) || label.split(/\s+/).some((word) => word.startsWith(nextBuffer));
      }) || options.find((option) => {
        if (option.disabled || !option.value) return false;
        const label = normalizedLabel(option.label);
        return label.startsWith(normalizedKey) || label.split(/\s+/).some((word) => word.startsWith(normalizedKey));
      });

      typeaheadBufferRef.current = matchingOption ? nextBuffer : normalizedKey;
      if (typeaheadTimerRef.current) window.clearTimeout(typeaheadTimerRef.current);
      typeaheadTimerRef.current = window.setTimeout(() => {
        typeaheadBufferRef.current = '';
        typeaheadTimerRef.current = null;
      }, 700);

      if (matchingOption) {
        chooseOption(matchingOption);
        setIsOpen(true);
      }
      return;
    }

    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const step = event.key === 'ArrowDown' ? 1 : -1;
    let nextIndex = selectedIndex + step;
    while (nextIndex >= 0 && nextIndex < options.length && options[nextIndex]?.disabled) nextIndex += step;
    if (nextIndex >= 0 && nextIndex < options.length) chooseOption(options[nextIndex]);
  };

  return (
    <div ref={rootRef} className="w-full space-y-1.5 text-left" data-component="mazzi-select">
      {label && <label htmlFor={selectId} className="mazzi-field-label block">{label}</label>}
      <div className="relative">
        <ButtonBase
          id={selectId}
          type="button"
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          aria-describedby={error || helperText ? messageId : undefined}
          aria-invalid={error ? true : undefined}
          aria-required={required || undefined}
          disabled={disabled}
          onClick={() => setIsOpen((open) => !open)}
          onKeyDown={handleKeyDown}
          onBlur={onBlur}
          onFocus={onFocus}
          className={`mazzi-select flex min-h-12 w-full items-center justify-between gap-3 rounded-2xl border bg-white px-4 py-3 text-left text-sm font-medium text-[var(--mazzi-text)] shadow-[0_2px_8px_rgba(32,33,38,.06)] outline-none transition-[border-color,box-shadow] focus:border-[var(--mazzi-yellow)] focus:ring-2 focus:ring-[var(--mazzi-focus-glow)] disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-60 ${error ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-100' : 'border-[var(--mazzi-border)]'} ${className}`}
        >
          <span className={selectedOption ? 'truncate' : 'text-[var(--mazzi-muted)]'}>{selectedOption?.label || 'Selecione uma opção...'}</span>
          <ChevronDown className={`h-4 w-4 shrink-0 text-[var(--mazzi-muted)] transition-transform ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
        </ButtonBase>
        {isOpen && (
          <div id={listboxId} role="listbox" aria-labelledby={label ? selectId : undefined} className="absolute left-0 right-0 z-50 mt-2 max-h-64 overflow-y-auto rounded-2xl border border-[var(--mazzi-border)] bg-white p-1.5 shadow-[0_14px_30px_rgba(32,33,38,.16)]">
            {options.map((option) => {
              const isSelected = option.value === selectedValue;
              return (
                <ButtonBase
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  disabled={option.disabled}
                  onClick={() => chooseOption(option)}
                  className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm transition-colors ${option.disabled ? 'cursor-not-allowed text-slate-300' : isSelected ? 'bg-[var(--mazzi-yellow-soft)] font-bold text-[var(--mazzi-text)]' : 'text-[var(--mazzi-text)] hover:bg-[var(--mazzi-yellow-hover)]'}`}
                >
                  <span className="min-w-0 truncate">{option.label}</span>
                  {isSelected && <Check className="h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />}
                </ButtonBase>
              );
            })}
          </div>
        )}
      </div>
      {name && <input type="hidden" name={name} value={selectedValue} required={required} />}
      {error ? <p id={messageId} className="text-xs font-medium text-rose-600">{error}</p> : helperText && <p id={messageId} className="text-xs text-slate-500">{helperText}</p>}
    </div>
  );
};
