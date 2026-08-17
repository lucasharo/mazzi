import React from 'react';
import {
  BookingStatus,
  ProviderStatus,
  VehicleStatus,
  DocumentStatus,
  PayoutStatus,
} from '../../types';

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
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className = '', id, audience = 'default' }) => {
  const getStatusConfig = (s: string): { label: string; bg: string; text: string; dot: string } => {
    switch (s) {
      // Booking Statuses
      case 'CONFIRMED':
        return { label: 'Confirmada', bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-800', dot: 'bg-emerald-500' };
      case 'IN_PROGRESS':
        return { label: 'Em Andamento', bg: 'bg-blue-50 border-blue-200', text: 'text-blue-800', dot: 'bg-blue-500 animate-pulse' };
      case 'COMPLETED':
        return { label: 'Concluída', bg: 'bg-indigo-50 border-indigo-200', text: 'text-indigo-800', dot: 'bg-indigo-500' };
      case 'PENDING_PAYMENT':
        return { label: 'Aguardando Pagamento', bg: 'bg-amber-50 border-amber-200', text: 'text-amber-800', dot: 'bg-amber-500' };
      case 'CANCELLED_BY_STUDENT':
        return { label: audience === 'student' ? 'Cancelada por você' : 'Cancelada pelo Aluno', bg: 'bg-rose-50 border-rose-200', text: 'text-rose-800', dot: 'bg-rose-500' };
      case 'CANCELLED_BY_PROVIDER':
        return { label: audience === 'student' ? 'Cancelada pelo prestador' : 'Cancelada pelo Fornecedor', bg: 'bg-rose-50 border-rose-200', text: 'text-rose-800', dot: 'bg-rose-500' };
      case 'NO_SHOW_STUDENT':
        return { label: 'Ausência do aluno', bg: 'bg-purple-50 border-purple-200', text: 'text-purple-800', dot: 'bg-purple-500' };
      case 'NO_SHOW_PROVIDER':
        return { label: 'Ausência do prestador', bg: 'bg-purple-50 border-purple-200', text: 'text-purple-800', dot: 'bg-purple-500' };
      case 'PAYMENT_FAILED':
        return { label: 'Falha no pagamento', bg: 'bg-rose-50 border-rose-200', text: 'text-rose-800', dot: 'bg-rose-500' };
      case 'DISPUTED':
        return { label: 'Em Disputa', bg: 'bg-orange-50 border-orange-200', text: 'text-orange-800', dot: 'bg-orange-500' };
      case 'REFUNDED':
        return { label: 'Reembolsada', bg: 'bg-slate-100 border-slate-200', text: 'text-slate-700', dot: 'bg-slate-400' };

      // Provider & Vehicle & Document Statuses
      case 'ACTIVE':
      case 'APPROVED':
        return { label: 'Ativo / Verificado', bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-800', dot: 'bg-emerald-500' };
      case 'PENDING_REVIEW':
      case 'UNDER_REVIEW':
        return { label: 'Em Análise', bg: 'bg-amber-50 border-amber-200', text: 'text-amber-800', dot: 'bg-amber-500' };
      case 'DRAFT':
      case 'PENDING':
        return { label: 'Pendente', bg: 'bg-slate-100 border-slate-200', text: 'text-slate-700', dot: 'bg-slate-400' };
      case 'SUSPENDED':
      case 'INACTIVE':
        return { label: 'Suspenso / Inativo', bg: 'bg-amber-50 border-amber-300', text: 'text-amber-900', dot: 'bg-amber-600' };
      case 'BLOCKED':
      case 'REJECTED':
        return { label: 'Bloqueado / Rejeitado', bg: 'bg-rose-50 border-rose-200', text: 'text-rose-800', dot: 'bg-rose-500' };
      case 'EXPIRED':
        return { label: 'Expirada', bg: 'bg-slate-100 border-slate-300', text: 'text-slate-600', dot: 'bg-slate-400' };

      // Payouts
      case 'AVAILABLE':
        return { label: 'Disponível', bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-800', dot: 'bg-emerald-500' };
      case 'PROCESSING':
        return { label: 'Processando', bg: 'bg-blue-50 border-blue-200', text: 'text-blue-800', dot: 'bg-blue-500 animate-pulse' };
      case 'PAID':
        return { label: 'Pago', bg: 'bg-teal-50 border-teal-200', text: 'text-teal-800', dot: 'bg-teal-500' };

      default:
        return { label: s, bg: 'bg-slate-100 border-slate-200', text: 'text-slate-800', dot: 'bg-slate-400' };
    }
  };

  const config = getStatusConfig(status);

  return (
    <span
      id={id}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border select-none ${config.bg} ${config.text} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      <span>{config.label}</span>
    </span>
  );
};
