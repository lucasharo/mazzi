import React from 'react';
import { AlertCircle } from 'lucide-react';
import { StatusBadge } from './StatusBadge';

interface ComplianceStatusAlertProps {
  status?: 'PENDING' | 'IN_REVIEW' | 'REJECTED' | 'APPROVED';
}

function getComplianceAlertCopy(status: NonNullable<ComplianceStatusAlertProps['status']>) {
  switch (status) {
    case 'IN_REVIEW':
      return {
        title: 'Documentos em análise pelo Compliance',
        description: 'Os documentos enviados estão em análise pela equipe de Compliance.',
      };
    case 'REJECTED':
      return {
        title: 'Documentos rejeitados: correção necessária',
        description: 'Corrija e envie novamente os documentos rejeitados para concluir a verificação.',
      };
    case 'APPROVED':
      return {
        title: 'Credenciamento Ativo • Verificado pela MAZZI',
        description: 'Suas ofertas e horários estão visíveis para agendamentos de alunos em São Paulo.',
      };
    case 'PENDING':
    default:
      return {
        title: 'Documentação pendente para verificação',
        description: 'Envie os documentos obrigatórios para concluir a verificação.',
      };
  }
}

export const ComplianceStatusAlert: React.FC<ComplianceStatusAlertProps> = ({
  status = 'IN_REVIEW',
}) => {
  const resolvedStatus = (status || 'IN_REVIEW') as NonNullable<ComplianceStatusAlertProps['status']>;
  const copy = getComplianceAlertCopy(resolvedStatus);

  return <section
    className="rounded-3xl border border-[var(--mazzi-border)] bg-white p-4 shadow-xs"
    role="status"
    aria-label={copy.title}
  >
    <div className="flex items-start gap-3">
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
        resolvedStatus === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' :
        resolvedStatus === 'REJECTED' ? 'bg-rose-100 text-rose-700' :
        resolvedStatus === 'IN_REVIEW' ? 'bg-blue-100 text-blue-700' :
        'bg-orange-100 text-orange-700'
      }`}>
        <AlertCircle className="h-5 w-5" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <h3 className="text-sm font-bold text-slate-900">{copy.title}</h3>
        <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{copy.description}</p>
      </div>
    </div>
    <StatusBadge status={resolvedStatus} domain="compliance" className="mt-3 w-full justify-start" />
  </section>;
};
