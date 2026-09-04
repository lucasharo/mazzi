import React from 'react';
import { getCheckoutGatewayProvider, getStripeEnvironment, getStripePublishableKey } from '../../lib/payment-gateway-config';

interface EnvironmentBadgeProps {
  className?: string;
}

/** Small, shared environment marker for non-production app surfaces. */
export const EnvironmentBadge: React.FC<EnvironmentBadgeProps> = () => {
  return null;
};
