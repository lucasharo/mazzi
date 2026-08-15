import React from 'react';
import { Star } from 'lucide-react';

export interface RatingProps {
  value: number; // 0..5
  count?: number;
  showValue?: boolean;
  size?: 'sm' | 'md' | 'lg';
  interactive?: boolean;
  onChange?: (val: number) => void;
  className?: string;
  id?: string;
}

export const Rating: React.FC<RatingProps> = ({
  value,
  count,
  showValue = true,
  size = 'md',
  interactive = false,
  onChange,
  className = '',
  id,
}) => {
  const iconSizes = {
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
    lg: 'w-6 h-6',
  };

  const textSizes = {
    sm: 'text-xs',
    md: 'text-sm font-semibold',
    lg: 'text-base font-bold',
  };

  return (
    <div id={id} className={`inline-flex items-center gap-1.5 select-none ${className}`}>
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => {
          const isFilled = value >= star;
          return (
            <button
              type="button"
              key={star}
              disabled={!interactive}
              onClick={() => interactive && onChange && onChange(star)}
              className={`${
                interactive ? 'cursor-pointer hover:scale-110 transition' : 'cursor-default'
              } p-0.5 focus:outline-none`}
            >
              <Star
                className={`${iconSizes[size]} ${
                  isFilled
                    ? 'text-amber-400 fill-amber-400'
                    : 'text-slate-200 fill-slate-100'
                }`}
              />
            </button>
          );
        })}
      </div>
      {showValue && (
        <span className={`text-slate-800 ${textSizes[size]}`}>
          {value.toFixed(1)}
        </span>
      )}
      {count !== undefined && (
        <span className="text-xs text-slate-500 font-normal">
          ({count})
        </span>
      )}
    </div>
  );
};
