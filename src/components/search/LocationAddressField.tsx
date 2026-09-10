import React from 'react';
import { ConfirmableAddressAutocomplete, type ConfirmableAddressAutocompleteProps } from './ConfirmableAddressAutocomplete';
import { LocationButton } from '../ui/LocationButton';

type LocationAddressFieldProps = Omit<ConfirmableAddressAutocompleteProps, 'onConfirm'> & {
  onConfirm: ConfirmableAddressAutocompleteProps['onConfirm'];
  onLocate: () => void;
  isLocating?: boolean;
  label?: string;
  variant?: 'card' | 'plain';
};

/** Complete location field shared by search, schedule and instant-lesson flows. */
export const LocationAddressField: React.FC<LocationAddressFieldProps> = ({
  onLocate,
  isLocating = false,
  label = 'Localização',
  variant = 'card',
  className = '',
  ...autocompleteProps
}) => (
  <div className={`${variant === 'card' ? 'mazzi-card p-3 sm:p-4 focus-within:ring-2 focus-within:ring-[var(--mazzi-yellow)] focus-within:ring-offset-2' : 'relative'} transition-all ${className}`}>
    <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2.5 sm:gap-3">
      <LocationButton onClick={onLocate} isLoading={isLocating} />
      <div className="min-w-0">
        <label htmlFor={autocompleteProps.id} className="block text-[10px] font-extrabold uppercase tracking-[.14em] text-[var(--mazzi-muted)]">{label}</label>
        <ConfirmableAddressAutocomplete {...autocompleteProps} className="mt-0.5 sm:mt-1" />
      </div>
    </div>
  </div>
);
