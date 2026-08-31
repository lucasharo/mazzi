import React from 'react';
import { getCheckoutGatewayProvider, getStripeEnvironment, getStripePublishableKey } from '../../lib/payment-gateway-config';

interface EnvironmentBadgeProps {
  className?: string;
}

/** Small, shared environment marker for non-production app surfaces. */
export const EnvironmentBadge: React.FC<EnvironmentBadgeProps> = ({ className = '' }) => {
  const isDevelopment = import.meta.env.DEV || import.meta.env.VITE_APP_ENV === 'development';
  const isTest = import.meta.env.MODE === 'test'
    || getCheckoutGatewayProvider() === 'fake'
    || getStripeEnvironment(getStripePublishableKey()) === 'test';

  if (!isDevelopment && !isTest) return null;

  const label = isDevelopment && isTest ? 'DEV · TESTE' : isDevelopment ? 'DEV' : 'TESTE';
  const description = isDevelopment && isTest
    ? 'Ambiente de desenvolvimento e testes'
    : isDevelopment
      ? 'Ambiente de desenvolvimento'
      : 'Ambiente de testes';

  return (
    <span
      data-environment-badge="true"
      title={description}
      aria-label={description}
      className={`inline-flex shrink-0 items-center rounded-full border border-amber-200/80 bg-amber-50 px-2 py-1 text-[9px] font-extrabold uppercase tracking-[0.08em] text-amber-800 ${className}`}
    >
      {label}
    </span>
  );
};
