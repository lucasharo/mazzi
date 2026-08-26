import React, { useId } from 'react';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  helperText?: string;
  error?: string;
}

/** Shared multiline field used by Student, PRO and Admin forms. */
export const Textarea: React.FC<TextareaProps> = ({
  label,
  helperText,
  error,
  className = '',
  id,
  ...props
}) => {
  const generatedId = `textarea-${useId().replace(/:/g, '')}`;
  const fieldId = id || generatedId;
  const messageId = `${fieldId}-${error ? 'error' : 'description'}`;

  return (
    <div className="w-full space-y-1.5 text-left">
      {label && <label htmlFor={fieldId} className="block text-xs font-semibold text-[var(--mazzi-dark)]">{label}</label>}
      <textarea
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || helperText ? messageId : undefined}
        className={`w-full resize-none rounded-2xl border bg-white px-3.5 py-2.5 text-sm text-[var(--mazzi-dark)] outline-none transition focus:border-[var(--mazzi-yellow)] focus:ring-2 focus:ring-[var(--mazzi-focus-glow)] disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 ${error ? 'border-rose-500' : 'border-[var(--mazzi-border)]'} ${className}`}
        {...props}
      />
      {error ? <p id={messageId} role="alert" className="text-xs font-medium text-rose-600">{error}</p> : helperText && <p id={messageId} className="text-xs text-slate-500">{helperText}</p>}
    </div>
  );
};
