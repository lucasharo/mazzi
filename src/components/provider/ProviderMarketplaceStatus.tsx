import React from 'react';
import { ComplianceDocument, Provider, ProviderPaymentAccount, ServiceOffering, Vehicle } from '../../types';
import type { SchoolInstructorComplianceSummary, SchoolMembership } from '../../lib/db-service';
import { evaluateProviderEligibility } from '../../domain/compliance';
import { resolveComplianceDocumentStatus } from '../../domain/provider-compliance-presentation';
import { isProviderPaymentAccountReady } from '../../domain/payments/provider-payment-readiness';
import { ComplianceStatusAlert } from '../ui/ComplianceStatusAlert';

interface ProviderMarketplaceStatusProps {
  currentProvider: Provider;
  providerDocs: ComplianceDocument[];
  providerVehicles: Vehicle[];
  offerings: ServiceOffering[];
  paymentAccount?: ProviderPaymentAccount | null;
  currentUserId?: string;
  schoolInstructors?: SchoolMembership[];
  schoolInstructorSummary?: SchoolInstructorComplianceSummary[];
}

export function getProviderMarketplacePending({
  currentProvider,
  providerVehicles,
  offerings,
  paymentAccount,
  currentUserId,
  schoolInstructors = [],
  schoolInstructorSummary = [],
  complianceEligible,
}: Omit<ProviderMarketplaceStatusProps, 'providerDocs'> & { complianceEligible: boolean }): string[] {
  const instructors = currentProvider.type === 'DRIVING_SCHOOL'
    ? schoolInstructors.filter((instructor) => instructor.isActive && instructor.membershipStatus === 'ACTIVE')
    : currentUserId
      ? [{ id: '', userId: currentUserId, name: currentProvider.name, membershipStatus: 'ACTIVE', isActive: true }]
      : [];
  const hasActiveVehicle = providerVehicles.some((vehicle) => vehicle.status === 'ACTIVE');
  const hasActiveOffering = offerings.some((offering) => (
    offering.status === 'ACTIVE'
    && offering.source !== 'AULA_AGORA'
    && providerVehicles.some((vehicle) => vehicle.id === offering.vehicleId && vehicle.status === 'ACTIVE')
  ));
  const hasPaymentAccount = isProviderPaymentAccountReady(paymentAccount);

  const pending = instructors.flatMap((instructor) => {
    const instructorPending: string[] = [];
    const hasCompliance = currentProvider.type === 'DRIVING_SCHOOL'
      ? schoolInstructorSummary.find((summary) => summary.membershipId === instructor.id)?.eligible === true
      : complianceEligible;

    if (!hasActiveVehicle) instructorPending.push('Veículo ativo não cadastrado');
    if (!hasActiveOffering) instructorPending.push('Oferta ativa não cadastrada');
    if (!hasCompliance) instructorPending.push('Compliance aprovado pendente');
    if (!hasPaymentAccount) instructorPending.push('Conta bancária não cadastrada');
    return instructorPending;
  });

  return Array.from(new Set(pending));
}

export const ProviderMarketplaceStatus: React.FC<ProviderMarketplaceStatusProps> = ({
  currentProvider,
  providerDocs,
  providerVehicles,
  offerings,
  paymentAccount,
  currentUserId,
  schoolInstructors = [],
  schoolInstructorSummary = [],
}) => {
  const complianceEligibility = evaluateProviderEligibility(currentProvider, providerDocs);
  const complianceStatus = resolveComplianceDocumentStatus(complianceEligibility, providerDocs);
  const marketplacePending = getProviderMarketplacePending({
    currentProvider,
    providerVehicles,
    offerings,
    paymentAccount,
    currentUserId,
    schoolInstructors,
    schoolInstructorSummary,
    complianceEligible: complianceEligibility.isEligible,
  });

  return (
    <ComplianceStatusAlert
      status={complianceStatus}
      marketplaceReady={marketplacePending.length === 0}
      marketplacePending={marketplacePending}
    />
  );
};
