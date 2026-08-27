import React from 'react';

export interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string | React.ReactNode;
  description?: string;
}

export const Checkbox: React.FC<CheckboxProps> = ({
  label,
  description,
  id,
  className = '',
  ...props
}) => {
  const generatedId = id || `chk-${Math.random().toString(36).substring(2, 8)}`;

  return (
    <div className="flex items-start space-x-3">
      <div className="flex items-center h-5">
        <input
          id={generatedId}
          type="checkbox"
          className={`w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 focus:ring-offset-0 transition cursor-pointer ${className}`}
          {...props}
        />
      </div>
      {(label || description) && (
        <div className="text-sm">
          {label && (
            <label
              htmlFor={generatedId}
              className="font-medium text-slate-800 cursor-pointer select-none"
            >
              {label}
            </label>
          )}
          {description && (
            <p className="text-xs text-slate-500">{description}</p>
          )}
        </div>
      )}
    </div>
  );
};

export interface RadioOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

export interface RadioGroupProps {
  name: string;
  value: string;
  onChange: (value: string) => void;
  options: RadioOption[];
  label?: string;
}

export const RadioGroup: React.FC<RadioGroupProps> = ({
  name,
  value,
  onChange,
  options,
  label,
}) => {
  return (
    <div className="space-y-2 text-left">
      {label && (
        <label className="mazzi-field-label block">
          {label}
        </label>
      )}
      <div className="space-y-2">
        {options.map((opt) => {
          const id = `radio-${name}-${opt.value}`;
          const isSelected = value === opt.value;
          return (
            <label
              key={opt.value}
              htmlFor={id}
              className={`flex items-start p-3 rounded-xl border transition cursor-pointer ${
                isSelected
                  ? 'border-emerald-500 bg-emerald-50/50 ring-1 ring-emerald-500'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              } ${opt.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <input
                type="radio"
                id={id}
                name={name}
                value={opt.value}
                checked={isSelected}
                disabled={opt.disabled}
                onChange={() => onChange(opt.value)}
                className="mt-0.5 w-4 h-4 text-emerald-600 border-slate-300 focus:ring-emerald-500"
              />
              <div className="ml-3 text-sm">
                <span className="font-medium text-[var(--mazzi-text)] block">{opt.label}</span>
                {opt.description && (
                  <span className="text-xs text-slate-500 block mt-0.5">{opt.description}</span>
                )}
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
};
