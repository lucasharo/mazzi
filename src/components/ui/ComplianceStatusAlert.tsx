import React from 'react';
import { AlertCircle } from 'lucide-react';
import { StatusBadge } from './StatusBadge';

interface ComplianceStatusAlertProps {
  status?: 'PENDING' | 'IN_REVIEW' | 'REJECTED' | 'APPROVED' | 'EXPIRED';
  /** Compliance approval is separate from marketplace visibility. */
  marketplaceReady?: boolean;
  marketplacePending?: string[];
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
    case 'EXPIRED':
      return {
        title: 'Documentos vencidos: atualização necessária',
        description: 'Um ou mais documentos perderam a validade. Envie uma nova versão para concluir a verificação.',
      };
    case 'APPROVED':
      return {
        title: 'Compliance aprovado • Verificado pela MAZZI',
        description: 'A aprovação dos documentos não significa, sozinha, que o perfil já está visível para os alunos.',
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
  marketplaceReady,
  marketplacePending = [],
}) => {
  const resolvedStatus = (status || 'IN_REVIEW') as NonNullable<ComplianceStatusAlertProps['status']>;
  const complianceCopy = getComplianceAlertCopy(resolvedStatus);
  const isMarketplaceBlocked = resolvedStatus === 'APPROVED' && marketplaceReady === false;
  const copy = isMarketplaceBlocked
    ? {
      title: 'Compliance aprovado • Configuração pendente',
      description: 'O perfil ainda não está visível para os alunos. Conclua os requisitos operacionais para aparecer nas buscas.',
    }
    : marketplaceReady === true && resolvedStatus === 'APPROVED'
      ? {
        title: 'Credenciamento Ativo • Verificado pela MAZZI',
        description: 'Compliance, oferta, veículo, agenda e recebimentos estão configurados para receber agendamentos.',
      }
      : complianceCopy;
  const iconTone = isMarketplaceBlocked
    ? 'bg-amber-100 text-amber-700'
    : resolvedStatus === 'APPROVED' ? 'bg-emerald-100 text-emerald-700'
      : resolvedStatus === 'REJECTED' ? 'bg-rose-100 text-rose-700'
        : resolvedStatus === 'IN_REVIEW' ? 'bg-blue-100 text-blue-700'
          : 'bg-orange-100 text-orange-700';

  return <section
    className={`mazzi-compact-card rounded-2xl border p-4 shadow-xs ${isMarketplaceBlocked ? 'border-amber-200 bg-amber-50/60' : 'border-[var(--mazzi-border)] bg-white'}`}
    role="status"
    aria-label={copy.title}
  >
    <div className="flex items-start gap-3">
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${iconTone}`}>
        <AlertCircle className="h-5 w-5" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <h3 className="text-sm font-bold text-slate-900">{copy.title}</h3>
        <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{copy.description}</p>
        {isMarketplaceBlocked && marketplacePending.length > 0 && (
          <p className="mt-2 text-xs font-semibold leading-relaxed text-amber-900">
            Pendências: {marketplacePending.join(' · ')}
          </p>
        )}
      </div>
    </div>
    {isMarketplaceBlocked ? (
      <span className="mt-3 inline-flex min-h-8 w-full items-center justify-center rounded-full border border-amber-200 bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900">
        Não visível para alunos
      </span>
    ) : <StatusBadge status={resolvedStatus} domain="compliance" className="mt-3 w-full justify-center" />}
  </section>;
};
