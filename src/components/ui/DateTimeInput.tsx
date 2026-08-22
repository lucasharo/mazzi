import React, { useEffect, useState } from 'react';
import { Input, InputProps } from './Input';

function onlyDigits(value: string): string {
  return value.replace(/\D/g, '').slice(0, 8);
}

function maskDate(value: string): string {
  const digits = onlyDigits(value);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function isoToDisplay(value?: string): string {
  if (!value) return '';
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : maskDate(value);
}

function displayToIso(value: string): string {
  const digits = onlyDigits(value);
  if (digits.length !== 8) return '';
  const day = Number(digits.slice(0, 2));
  const month = Number(digits.slice(2, 4));
  const year = Number(digits.slice(4, 8));
  const date = new Date(Date.UTC(year, month - 1, day));
  if (year < 1000 || date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return '';
  return `${year.toString().padStart(4, '0')}-${digits.slice(2, 4)}-${digits.slice(0, 2)}`;
}

export interface DateInputProps extends Omit<InputProps, 'type' | 'value' | 'defaultValue' | 'onChange'> {
  value?: string;
  onChange?: (value: string) => void;
}

export const DateInput: React.FC<DateInputProps> = ({ value = '', onChange, placeholder = 'dd/mm/aaaa', ...props }) => {
  const [displayValue, setDisplayValue] = useState(() => isoToDisplay(value));

  useEffect(() => {
    if (displayToIso(displayValue) !== value) {
      setDisplayValue(isoToDisplay(value));
    }
  }, [value]);

  return (
    <Input
      {...props}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      placeholder={placeholder}
      value={displayValue}
      onChange={(event) => {
        const nextDisplayValue = maskDate(event.target.value);
        setDisplayValue(nextDisplayValue);
        onChange?.(displayToIso(nextDisplayValue));
      }}
      aria-label={props['aria-label'] || 'Data no formato dia, mês e ano'}
    />
  );
};

function maskTime(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

function normalizeTime(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length !== 4) return '';
  const hours = Number(digits.slice(0, 2));
  const minutes = Number(digits.slice(2, 4));
  if (hours > 23 || minutes > 59) return '';
  return `${digits.slice(0, 2)}:${digits.slice(2, 4)}`;
}

export interface TimeInputProps extends Omit<InputProps, 'type' | 'value' | 'defaultValue' | 'onChange'> {
  value?: string;
  onChange?: (value: string) => void;
}

export const TimeInput: React.FC<TimeInputProps> = ({ value = '', onChange, placeholder = 'hh:mm', ...props }) => {
  const [displayValue, setDisplayValue] = useState(() => maskTime(value));

  useEffect(() => {
    if (normalizeTime(displayValue) !== value) {
      setDisplayValue(maskTime(value));
    }
  }, [value]);

  return (
    <Input
      {...props}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      placeholder={placeholder}
      value={displayValue}
      onChange={(event) => {
        const nextDisplayValue = maskTime(event.target.value);
        setDisplayValue(nextDisplayValue);
        onChange?.(normalizeTime(nextDisplayValue));
      }}
      aria-label={props['aria-label'] || 'Horário no formato horas e minutos'}
    />
  );
};
