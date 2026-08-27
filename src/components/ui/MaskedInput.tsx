import React, { useRef } from 'react';
import { Input, InputProps } from './Input';

export interface MaskedInputProps extends Omit<InputProps, 'value' | 'onChange'> {
  value?: string;
  onChange?: (value: string) => void;
  mask: (value: string) => string;
}

/** Shared masked field that keeps the caret beside the edited character. */
export const MaskedInput: React.FC<MaskedInputProps> = ({ value = '', onChange, mask, ...props }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <Input
      {...props}
      inputRef={inputRef}
      value={mask(value)}
      onChange={(event) => {
        const caret = event.currentTarget.selectionStart ?? event.currentTarget.value.length;
        const next = mask(event.currentTarget.value);
        const nextCaret = Math.min(mask(event.currentTarget.value.slice(0, caret)).length, next.length);
        onChange?.(next);
        requestAnimationFrame(() => inputRef.current?.setSelectionRange(nextCaret, nextCaret));
      }}
    />
  );
};
