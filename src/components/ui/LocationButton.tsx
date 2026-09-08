import React, { useEffect, useRef, useState } from 'react';
import { Navigation } from 'lucide-react';
import { ButtonBase } from './Button';

export interface LocationButtonProps {
  onClick: () => void;
  isLoading?: boolean;
  disabled?: boolean;
  label?: string;
  className?: string;
}

/** Shared current-location action used by address fields across both apps. */
export const LocationButton: React.FC<LocationButtonProps> = ({
  onClick,
  isLoading = false,
  disabled = false,
  label = 'Usar minha localização atual',
  className = '',
}) => {
  const [showLoading, setShowLoading] = useState(isLoading);
  const loadingStartedAt = useRef(isLoading ? Date.now() : 0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const minimumVisibleMs = 700;

  useEffect(() => {
    if (isLoading) {
      if (!loadingStartedAt.current) loadingStartedAt.current = Date.now();
      setShowLoading(true);
      if (timer.current) clearTimeout(timer.current);
      return;
    }

    const remaining = Math.max(0, minimumVisibleMs - (Date.now() - loadingStartedAt.current));
    timer.current = setTimeout(() => {
      loadingStartedAt.current = 0;
      setShowLoading(false);
      timer.current = null;
    }, remaining);

    return () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
    };
  }, [isLoading]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const handleClick = () => {
    if (isLoading || disabled) return;
    loadingStartedAt.current = Date.now();
    setShowLoading(true);
    onClick();
  };

  return (
    <ButtonBase
      type="button"
      onClick={handleClick}
      disabled={disabled || isLoading || showLoading}
      aria-label={label}
      title={label}
      aria-busy={isLoading || showLoading}
      className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[var(--mazzi-yellow)] text-[var(--mazzi-dark)] transition hover:brightness-95 active:scale-95 disabled:opacity-60 ${className}`}
    >
      <Navigation className={`h-5 w-5 ${showLoading ? 'mazzi-location-spinner' : ''}`} aria-hidden="true" />
    </ButtonBase>
  );
};
