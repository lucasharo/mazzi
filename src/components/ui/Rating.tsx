import { ButtonBase } from './Button';
import React, { useRef } from 'react';
import { Star } from 'lucide-react';

export interface RatingProps {
  value: number;
  count?: number;
  showValue?: boolean;
  size?: 'sm' | 'md' | 'lg';
  interactive?: boolean;
  onChange?: (val: number) => void;
  className?: string;
  id?: string;
  ariaLabel?: string;
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
  ariaLabel = 'Avaliação',
}) => {
  const starRefs = useRef<Array<HTMLButtonElement | null>>([]);
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

  const selectRating = (rating: number) => {
    onChange?.(rating);
    starRefs.current[rating - 1]?.focus();
  };
  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, star: number) => {
    let nextRating: number | undefined;
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') nextRating = star === 5 ? 1 : star + 1;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') nextRating = star === 1 ? 5 : star - 1;
    if (event.key === 'Home') nextRating = 1;
    if (event.key === 'End') nextRating = 5;
    if (nextRating === undefined) return;
    event.preventDefault();
    selectRating(nextRating);
  };

  return (
    <div id={id} className={`inline-flex items-center gap-1.5 select-none ${className}`}>
      <div role={interactive ? 'radiogroup' : undefined} aria-label={interactive ? ariaLabel : undefined} className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => {
          const isFilled = value >= star;
          const starIcon = (
            <Star
              aria-hidden="true"
              className={`${iconSizes[size]} ${
                isFilled
                  ? 'text-amber-400 fill-amber-400'
                  : 'text-slate-200 fill-slate-100'
              }`}
            />
          );

          return interactive ? (
            <ButtonBase
              ref={(element) => { starRefs.current[star - 1] = element; }}
              type="button"
              role="radio"
              aria-checked={value === star}
              aria-label={`${star} de 5 estrelas`}
              key={star}
              tabIndex={value === star || (value === 0 && star === 1) ? 0 : -1}
              onClick={() => selectRating(star)}
              onKeyDown={(event) => handleKeyDown(event, star)}
              className={`grid h-11 w-11 place-items-center rounded-xl cursor-pointer transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mazzi-yellow)] ${isFilled ? 'bg-amber-100 hover:bg-amber-200' : 'bg-slate-100 hover:bg-slate-200'}`}
            >
              {starIcon}
            </ButtonBase>
          ) : (
            <span key={star} aria-hidden="true" className="grid place-items-center p-0.5">
              {starIcon}
            </span>
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
