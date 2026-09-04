import React from 'react';
import {
  BookingStatus,
  ProviderStatus,
  VehicleStatus,
  DocumentStatus,
  PayoutStatus,
} from '../../types';
import { getStatusPresentation, StatusPresentationDomain } from '../../domain/status-presentation';

type AnyStatus =
  | BookingStatus
  | ProviderStatus
  | VehicleStatus
  | DocumentStatus
  | PayoutStatus
  | string;

export interface StatusBadgeProps {
  status: AnyStatus;
  className?: string;
  id?: string;
  audience?: 'default' | 'student';
  domain?: StatusPresentationDomain;
  instructorCheckedIn?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  className = '',
  id,
  domain = 'default' as StatusPresentationDomain,
  instructorCheckedIn,
}) => {
  const getStatusConfig = (s: string): { label: string; bg: string; text: string; dot: string } => {
    const presentation = getStatusPresentation(s, domain, { instructorCheckedIn });
    const tone = {
      success: { bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-800', dot: 'bg-emerald-500' },
      info: { bg: 'bg-blue-50 border-blue-200', text: 'text-blue-800', dot: 'bg-blue-500' },
      warning: { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-900', dot: 'bg-amber-500' },
      warningOrange: { bg: 'bg-orange-50 border-orange-200', text: 'text-orange-800', dot: 'bg-orange-500' },
      danger: { bg: 'bg-rose-50 border-rose-200', text: 'text-rose-800', dot: 'bg-rose-500' },
      neutral: { bg: 'bg-slate-100 border-slate-200', text: 'text-slate-700', dot: 'bg-slate-400' },
    }[presentation.tone];
    return { label: presentation.label, ...tone, dot: `${tone.dot}${presentation.isPulsing ? ' animate-pulse' : ''}` };
  };

  const config = getStatusConfig(status);

  return (
    <span
      id={id}
      className={`inline-flex shrink-0 items-center justify-center whitespace-nowrap text-center px-2.5 py-1 rounded-full text-xs font-semibold border select-none ${config.bg} ${config.text} ${className}`}
    >
      <span>{config.label}</span>
    </span>
  );
};
