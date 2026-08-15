import React from 'react';
import { formatCentsToBRL } from '../../domain/money';

export interface PriceProps {
  cents: number;
  durationMinutes?: number;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showPeriodLabel?: boolean;
  className?: string;
  id?: string;
}

export const Price: React.FC<PriceProps> = ({
  cents,
  durationMinutes,
  size = 'md',
  showPeriodLabel = true,
  className = '',
  id,
}) => {
  const formatted = formatCentsToBRL(cents);

  const sizeStyles = {
    sm: 'text-sm font-semibold',
    md: 'text-base font-bold',
    lg: 'text-xl font-extrabold',
    xl: 'text-2xl font-black',
  };

  return (
    <div id={id} className={`inline-flex items-baseline gap-1 select-none ${className}`}>
      <span className={`text-slate-900 tracking-tight ${sizeStyles[size]}`}>
        {formatted}
      </span>
      {showPeriodLabel && (
        <span className="text-xs text-slate-500 font-normal">
          {durationMinutes ? `/ ${durationMinutes}min` : '/ aula'}
        </span>
      )}
    </div>
  );
};
