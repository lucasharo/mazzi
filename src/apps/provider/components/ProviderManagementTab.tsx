import React, { useState } from 'react';
import { Car, Plus, ShieldCheck, Upload, AlertCircle, Check, Ban, Tag, Users, Info, SlidersHorizontal, RefreshCw, Power, PowerOff, Save, XCircle, Pencil, Eye, EyeOff, WalletCards, CalendarDays, } from 'lucide-react';
import {
  Vehicle, ServiceOffering, ComplianceDocument, Provider, VehicleCategory, VehicleType, TransmissionType, ProviderPaymentAccount, AvailabilityRule, } from '../../../types';
import { Button, ButtonBase } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { Modal } from '../../../components/ui/Modal';
import { Input } from '../../../components/ui/Input';
import { MaskedInput } from '../../../components/ui/MaskedInput';
import { Select } from '../../../components/ui/Select';
import { EmptyState } from '../../../components/ui/EmptyState';
import { VehicleCard } from '../../../components/ui/VehicleCard';
import { formatCentsToBRL } from '../../../domain/money';
import { DEFAULT_COMPLIANCE_REQUIREMENTS, evaluateProviderEligibility } from '../../../domain/compliance';
import { formatTransmissionLabel } from '../../../lib/date-format';
import { maskVehiclePlate, normalizeVehiclePlate, maskBRLInput } from '../../../lib/input-masks';
import { AppPageHeader } from '../../../components/ui/AppPageHeader';
import { Tabs } from '../../../components/ui/Tabs';
import { SchoolMembershipPanel } from './SchoolMembershipPanel';
import type { SchoolInstructorComplianceSummary, SchoolMembership } from '../../../lib/db-service';
import { ContentSkeleton } from '../../../components/ui/ContentSkeleton';
import { VehicleCatalogPicker } from '../../../components/vehicles/VehicleCatalogPicker';
import { getStatusPresentation } from '../../../domain/status-presentation';
import { ProviderAccountTab } from './ProviderAccountTab';

interface ProviderManagementTabProps {
  onRefresh: () => void;
  isRefreshing?: boolean;
  managementSubTab: 'schedule_rules' | 'schedule_blocks' | 'vehicles' | 'offerings' | 'compliance' | 'memberships' | 'account';
  onSubTabChange: (tab: 'schedule_rules' | 'schedule_blocks' | 'vehicles' | 'offerings' | 'compliance' | 'memberships' | 'account') => void;
  scheduleContent?: React.ReactNode;
  availabilityRules: AvailabilityRule[];
  vehicles: Vehicle[];
  offerings: ServiceOffering[];
  complianceDocs: ComplianceDocument[];
  currentProvider: Provider;
  schoolInstructors: SchoolMembership[];
  schoolInstructorSummary: SchoolInstructorComplianceSummary[];
  isAddVehicleModalOpen: boolean;
  onOpenAddVehicleModal: () => void;
  onOpenEditVehicle: (vehicleId: string) => void;
  onCloseAddVehicleModal: () => void;
  vehicleForm: {
    brand: string;
    model: string;
    year: number | '';
    licensePlate: string;
    category: VehicleCategory;
    vehicleType: VehicleType;
    transmission: TransmissionType;
    color: string;
    photoUrl: string;
  };
  onVehicleFormChange: (form: any) => void;
  onSaveVehicle: () => Promise<void>;
  onToggleVehicleStatus: (vehicleId: string) => Promise<void>;
  onSavingVehicle?: boolean;
  vehicleError: string | null;
  isAddOfferingModalOpen: boolean;
  onOpenAddOfferingModal: () => void;
  onCloseAddOfferingModal: () => void;
  offeringForm: {
    vehicleId: string;
    instructorId: string;
    category: VehicleCategory;
    durationMinutes: number;
    priceInBrl: string;
  };
  onOfferingFormChange: (form: any) => void;
  onSaveOffering: () => Promise<void>;
  onToggleOfferingStatus: (offeringId: string) => Promise<void>;
  onSavingOffering?: boolean;
  onReplaceActiveOffering: (offeringId: string, previousOfferingId: string) => Promise<void>;
  offeringError: string | null;
  offeringNotice?: string | null;
  onUploadDocClick: (docType: string) => void;
  onAcceptComplianceTerms: () => void;
  onViewComplianceDocument: (document: ComplianceDocument) => void;
  isAcceptingComplianceTerms?: boolean;
  complianceTermsError?: string | null;
  paymentAccount?: ProviderPaymentAccount | null;
  onOpenPayoutOnboarding?: () => void;
  isOpeningPayoutOnboarding?: boolean;
}

export const ProviderManagementTab: React.FC<ProviderManagementTabProps> = ({
  onRefresh,
  isRefreshing,
  managementSubTab,
  onSubTabChange,
  availabilityRules,
  vehicles,
  offerings,
  complianceDocs,
  currentProvider,
  schoolInstructors,
  schoolInstructorSummary,
  isAddVehicleModalOpen,
  onOpenAddVehicleModal,
  onOpenEditVehicle,
  onCloseAddVehicleModal,
  vehicleForm,
  onVehicleFormChange,
  onSaveVehicle,
  onToggleVehicleStatus,
  onSavingVehicle,
  vehicleError,
  isAddOfferingModalOpen,
  onOpenAddOfferingModal,
  onCloseAddOfferingModal,
  offeringForm,
  onOfferingFormChange,
  onSaveOffering,
  onToggleOfferingStatus,
  onSavingOffering,
  onReplaceActiveOffering,
  offeringError,
  offeringNotice,
  onUploadDocClick,
  onAcceptComplianceTerms,
  onViewComplianceDocument,
  isAcceptingComplianceTerms = false,
  complianceTermsError,
  paymentAccount,
  onOpenPayoutOnboarding,
  isOpeningPayoutOnboarding = false,
  scheduleContent,
}) => {
  const [blockedVehicleId, setBlockedVehicleId] = useState<string | null>(null);
  const currentYear = new Date().getFullYear();
  const vehicleFormValid = Boolean(vehicleForm.brand.trim() && vehicleForm.model.trim() && typeof vehicleForm.year === 'number' && vehicleForm.year >= currentYear - 12 && vehicleForm.year <= currentYear + 1 && vehicleForm.licensePlate.trim() && vehicleForm.category && vehicleForm.transmission);
  const offeringFormValid = Boolean(offeringForm.vehicleId && offeringForm.priceInBrl.trim() && (currentProvider.type !== 'DRIVING_SCHOOL' || offeringForm.instructorId));
  const sortedVehicles = [...vehicles].sort((a, b) => {
    const priority: Record<string, number> = { ACTIVE: 0, PENDING: 1, IN_REVIEW: 2 };
    return (priority[a.status] ?? 3) - (priority[b.status] ?? 3);
  });
  const [isInviteInstructorModalOpen, setIsInviteInstructorModalOpen] = React.useState(false);
  const [pendingOfferingSwap, setPendingOfferingSwap] = useState<{ target: ServiceOffering; current: ServiceOffering } | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const isSchool = currentProvider.type === 'DRIVING_SCHOOL';
  const hasPendingSchedule = availabilityRules.length === 0;
  const hasPendingVehicles = !vehicles.some((vehicle) => vehicle.status === 'ACTIVE');
  const hasPendingOfferings = !offerings.some((offering) => offering.status === 'ACTIVE');
  const hasPendingPayoutSetup = paymentAccount?.payoutsEnabled !== true;
  const runAsyncAction = async (key: string, action: () => Promise<void>) => {
    if (pendingAction) return;
    setPendingAction(key);
    try {
      await action();
    } finally {
      setPendingAction(null);
    }
  };
  const eligibleSchoolInstructors = schoolInstructors.filter((instructor) => {
    const compliance = schoolInstructorSummary.find((entry) => entry.membershipId === instructor.id);
    return instructor.membershipStatus === 'ACTIVE' && instructor.isActive && compliance?.eligible === true;
  });

  return (
    <div className="space-y-6 text-left">
      {/* Header */}
      <AppPageHeader
        eyebrow="Sua operação"
        title="Gestão"
        subtitle="Organize veículos, ofertas e compliance."
        action={<ButtonBase type="button" className="mazzi-icon-button" onClick={onRefresh} disabled={isRefreshing} aria-label="Atualizar gestão" title="Atualizar gestão"><RefreshCw className={`h-5 w-5 ${isRefreshing ? 'animate-spin' : ''}`} aria-hidden="true" /></ButtonBase>}
      />

      <Tabs
        id="provider-management-tabs"
        ariaLabel="Seções de gestão"
        activeTab={managementSubTab}
        onChange={(tab) => onSubTabChange(tab as ProviderManagementTabProps['managementSubTab'])}
        tabs={[
          { id: 'schedule_rules', label: 'Horários', icon: <CalendarDays className="h-3.5 w-3.5" />, hasPending: hasPendingSchedule },
          { id: 'schedule_blocks', label: 'Bloqueios', icon: <Ban className="h-3.5 w-3.5" /> },
          { id: 'vehicles', label: 'Veículos', icon: <Car className="h-3.5 w-3.5" />, hasPending: hasPendingVehicles },
          { id: 'offerings', label: 'Ofertas', icon: <Tag className="h-3.5 w-3.5" />, hasPending: hasPendingOfferings },
          { id: 'compliance', label: 'Compliance', icon: <ShieldCheck className="h-3.5 w-3.5" /> },
          ...(isSchool ? [{ id: 'memberships' as const, label: 'Instrutores', icon: <Users className="h-3.5 w-3.5" /> }] : []),
          { id: 'account', label: 'Conta bancária', icon: <WalletCards className="h-3.5 w-3.5" />, hasPending: hasPendingPayoutSetup },
        ]}
        className="mazzi-segmented"
      />

      {(managementSubTab === 'schedule_rules' || managementSubTab === 'schedule_blocks') && scheduleContent}

      {(managementSubTab === 'vehicles' || managementSubTab === 'offerings' || (managementSubTab === 'memberships' && currentProvider.type === 'DRIVING_SCHOOL')) && (
        <div className="flex flex-wrap justify-end gap-2">
          {managementSubTab === 'vehicles' && (
          <Button variant="primary" size="sm" onClick={onOpenAddVehicleModal} leftIcon={<Plus className="w-4 h-4" />}>
            Cadastrar Veículo
          </Button>
          )}
          {managementSubTab === 'offerings' && (
          <Button
            variant="primary"
            size="sm"
            onClick={onOpenAddOfferingModal}
            disabled={currentProvider.type === 'DRIVING_SCHOOL' && eligibleSchoolInstructors.length === 0}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Cadastrar Oferta
          </Button>
          )}
          {managementSubTab === 'memberships' && currentProvider.type === 'DRIVING_SCHOOL' && (
          <Button variant="primary" size="sm" onClick={() => setIsInviteInstructorModalOpen(true)} leftIcon={<Plus className="w-4 h-4" />}>
            Convidar Instrutor
          </Button>
          )}
        </div>
      )}

      {!isRefreshing && managementSubTab === 'offerings' && currentProvider.status !== 'ACTIVE' && (
        <div role="status" className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-900">
          As ofertas só podem ser publicadas depois que o cadastro do prestador for aprovado. Status atual: <strong>{getStatusPresentation(currentProvider.status, 'provider').label}</strong>.
        </div>
      )}

      {!isRefreshing && managementSubTab === 'offerings' && offeringNotice && (
        <div role="status" className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-xs font-medium text-sky-900">
          {offeringNotice}
        </div>
      )}

      {isRefreshing && <ContentSkeleton label="Atualizando gestão" />}

      {!isRefreshing && isSchool && managementSubTab === 'memberships' && (
        <SchoolMembershipPanel
          provider={currentProvider}
          isInstructor={currentProvider.type === 'INSTRUCTOR'}
          isInviteModalOpen={isInviteInstructorModalOpen}
          onOpenInviteModal={() => setIsInviteInstructorModalOpen(true)}
          onCloseInviteModal={() => setIsInviteInstructorModalOpen(false)}
        />
      )}

      {/* VEHICLES SUBTAB */}
      {!isRefreshing && managementSubTab === 'vehicles' && (
        <div className="space-y-4">
          {vehicles.length === 0 ? (
            <EmptyState
              icon={<Car className="w-8 h-8 text-slate-400" />}
              title="Nenhum veículo cadastrado"
              description="Cadastre seu veículo para vincular ofertas de aulas práticas aos alunos."
              actionLabel="Cadastrar Veículo"
              onAction={onOpenAddVehicleModal}
            />
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {sortedVehicles.map((vehicle) => (
                <VehicleCard
                  key={vehicle.id}
                  vehicle={vehicle}
                  footer={(
                    <>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-slate-400">ID: {vehicle.id.slice(0, 8)}</span>
                      {vehicle.status === 'BLOCKED' ? (
                        <Button variant="outline" size="sm" onClick={() => setBlockedVehicleId(blockedVehicleId === vehicle.id ? null : vehicle.id)} leftIcon={blockedVehicleId === vehicle.id ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}>
                          {blockedVehicleId === vehicle.id ? 'Esconder motivo do bloqueio' : 'Ver motivo do bloqueio'}
                        </Button>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" onClick={() => onOpenEditVehicle(vehicle.id)} leftIcon={<Pencil className="w-3.5 h-3.5" />}>Editar</Button>
                          <Button
                            variant={vehicle.status === 'ACTIVE' ? 'dangerSoft' : 'primary'}
                            size="sm"
                            onClick={() => void runAsyncAction(`vehicle-${vehicle.id}`, () => onToggleVehicleStatus(vehicle.id))}
                            disabled={pendingAction !== null || vehicle.status === 'PENDING' || vehicle.status === 'IN_REVIEW'}
                            isLoading={pendingAction === `vehicle-${vehicle.id}`}
                            leftIcon={vehicle.status === 'ACTIVE' ? <PowerOff className="w-3.5 h-3.5" /> : <Power className="w-3.5 h-3.5" />}
                          >
                            {vehicle.status === 'ACTIVE' ? 'Desativar Veículo' : vehicle.status === 'IN_REVIEW' ? 'Em reanálise' : vehicle.status === 'PENDING' ? 'Aguardando aprovação' : 'Ativar Veículo'}
                          </Button>
                        </div>
                      )}
                    </div>
                    {vehicle.status === 'BLOCKED' && blockedVehicleId === vehicle.id && (
                      <p className="mt-2 rounded-xl border border-rose-200 bg-rose-50 p-2 text-[11px] font-medium text-rose-800">
                        {vehicle.blockedReason || vehicle.description || 'Este veículo foi bloqueado administrativamente. Cadastre um novo veículo ou entre em contato com o suporte.'}
                      </p>
                    )}
                    </>
                  )}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* OFFERINGS SUBTAB */}
      {!isRefreshing && managementSubTab === 'offerings' && (
        <div className="space-y-4">
          {currentProvider.type === 'DRIVING_SCHOOL' && eligibleSchoolInstructors.length === 0 && (
            <p className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-900">
              Ative ao menos um instrutor antes de cadastrar uma oferta.
            </p>
          )}
          {offerings.length === 0 ? (
            <EmptyState
              icon={<Tag className="w-8 h-8 text-slate-400" />}
              title="Nenhuma oferta cadastrada"
              description="Cadastre ofertas com duração e preço para disponibilizar no aplicativo dos alunos."
              actionLabel="Cadastrar Oferta"
              onAction={onOpenAddOfferingModal}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {offerings.map((o) => {
                const linkedVehicle = vehicles.find((v) => v.id === o.vehicleId);
                const linkedInstructor = schoolInstructors.find((instructor) => instructor.userId === o.instructorId);
                const activeEquivalent = o.status !== 'ACTIVE'
                  ? offerings.find((candidate) => candidate.id !== o.id && candidate.status === 'ACTIVE' && candidate.providerId === o.providerId && candidate.instructorId === o.instructorId && candidate.vehicleId === o.vehicleId && candidate.category === o.category && candidate.transmission === o.transmission && candidate.durationMinutes === o.durationMinutes)
                  : undefined;
                const providerComplianceEligible = isSchool
                  ? Boolean(o.instructorId && eligibleSchoolInstructors.some((instructor) => instructor.userId === o.instructorId))
                  : evaluateProviderEligibility(currentProvider, complianceDocs).isEligible;
                const canActivateOffering = Boolean(
                  currentProvider.status === 'ACTIVE' &&
                  linkedVehicle?.status === 'ACTIVE' &&
                  linkedVehicle.category === o.category &&
                  linkedVehicle.transmission === o.transmission &&
                  o.instructorId &&
                  o.durationMinutes === 50 &&
                  o.priceInCents > 0 &&
                  providerComplianceEligible,
                );

                return (
                  <div
                    key={o.id}
                    className="p-5 rounded-3xl bg-white border border-[#e9e6de] shadow-xs space-y-3 flex flex-col justify-between"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black px-2.5 py-0.5 rounded-md bg-[#202126] text-white">
                            Cat. {o.category}
                          </span>
                      <h4 className="text-base font-bold text-slate-900">
                            {formatCentsToBRL(o.priceInCents)} / {o.durationMinutes} min
                          </h4>
                        </div>
                        <Badge variant={o.status === 'ACTIVE' ? 'success' : 'default'}>
                          {o.status === 'ACTIVE' ? 'Ativa' : 'Inativa'}
                        </Badge>
                      </div>

                      <p className="text-xs text-slate-600 font-medium">
                        Veículo vinculado:{' '}
                          <span className="text-[var(--mazzi-text)] font-bold">
                          {linkedVehicle ? `${linkedVehicle.brand} ${linkedVehicle.model}` : 'Veículo não localizado'}
                        </span>
                      </p>

                      {currentProvider.type === 'DRIVING_SCHOOL' && (
                        <p className="text-xs text-slate-600 font-medium">
                          Instrutor:{' '}
                          <span className="text-[var(--mazzi-text)] font-bold">
                            {linkedInstructor?.name || 'Instrutor não localizado'}
                          </span>
                        </p>
                      )}

                      <p className="text-xs text-slate-500">
                        Transmissão: {formatTransmissionLabel(o.transmission)}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-slate-400">
                        R$ {(o.priceInCents / 100).toFixed(2)}
                      </span>
                      <Button
                        variant={o.status === 'ACTIVE' ? 'dangerSoft' : 'primary'}
                        size="sm"
                        title={o.status !== 'ACTIVE' && !canActivateOffering ? 'A oferta só pode ser ativada quando todos os requisitos forem atendidos.' : undefined}
                          onClick={() => {
                          if (pendingAction) return;
                          if (activeEquivalent) {
                            setPendingOfferingSwap({ target: o, current: activeEquivalent });
                            return;
                          }
                          void runAsyncAction(`offering-${o.id}`, () => onToggleOfferingStatus(o.id));
                        }}
                        leftIcon={o.status === 'ACTIVE' ? <PowerOff className="w-3.5 h-3.5" /> : <Power className="w-3.5 h-3.5" />}
                        disabled={pendingAction !== null || (o.status !== 'ACTIVE' && !canActivateOffering)}
                        isLoading={pendingAction === `offering-${o.id}`}
                      >
                        {o.status === 'ACTIVE' ? 'Desativar Oferta' : 'Ativar Oferta'}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* COMPLIANCE SUBTAB */}
      {!isRefreshing && managementSubTab === 'compliance' && (
        <div className="space-y-4">
          {complianceTermsError && (
            <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800">
              {complianceTermsError}
            </div>
          )}
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <p>
              Para manter o selo de <strong>Prestador Verificado</strong> e garantir segurança aos alunos, mantenha seus documentos de credenciamento (CNH/CNPJ/CRLV) sempre em dia.
            </p>
          </div>

          <div className="space-y-3">
            {DEFAULT_COMPLIANCE_REQUIREMENTS.filter((r) => r.providerType === currentProvider.type).map((req) => {
              const docsForRequirement = complianceDocs
                .filter((d) => d.type === req.documentType)
                .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
              const doc = docsForRequirement[0];
              const isTermsAcceptance = req.documentType === 'MAZZI_TERMS_ACCEPTANCE';
              const canResubmit = doc?.status === 'REJECTED' || doc?.status === 'EXPIRED';
              return (
                <div
                  key={req.id}
                  className="mazzi-card flex flex-col gap-4 p-4 text-left"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-[var(--mazzi-text)]">{req.title}</span>
                    </div>
                    <p className="text-xs text-slate-500">{req.description}</p>
                    {doc && !isTermsAcceptance && (
                      <>
                        <p className="text-[11px] text-slate-600 font-mono">Arquivo: {doc.fileName}</p>
                        {doc.status === 'REJECTED' && doc.rejectionReason && (
                          <p className="text-[11px] font-semibold text-rose-700">Motivo: {doc.rejectionReason}</p>
                        )}
                      </>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <StatusBadge status={doc?.status ?? 'PENDING'} domain="compliance" />
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      {doc?.storagePath && !isTermsAcceptance && (
                        <Button variant="outline" size="sm" leftIcon={<Eye className="w-3.5 h-3.5" aria-hidden="true" />} onClick={() => onViewComplianceDocument(doc)}>
                          Ver arquivo
                        </Button>
                      )}
                      {(!doc || canResubmit) && !isTermsAcceptance && (
                        <Button
                          variant={canResubmit ? 'primary' : 'outline'}
                          size="sm"
                          leftIcon={<Upload className="w-3.5 h-3.5" />}
                          onClick={() => onUploadDocClick(req.documentType)}
                        >
                          {canResubmit ? 'Enviar novo arquivo' : 'Anexar Arquivo'}
                        </Button>
                      )}
                      {!doc && isTermsAcceptance && (
                        <Button
                          variant="primary"
                          size="sm"
                          leftIcon={<Check className="w-3.5 h-3.5" />}
                          onClick={onAcceptComplianceTerms}
                          disabled={isAcceptingComplianceTerms}
                          isLoading={isAcceptingComplianceTerms}
                        >
                          {isAcceptingComplianceTerms ? 'Registrando...' : 'Concordar e aceitar'}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ACCOUNT SUBTAB */}
      {!isRefreshing && managementSubTab === 'account' && (
        <ProviderAccountTab
          paymentAccount={paymentAccount}
          onOpenPayoutOnboarding={onOpenPayoutOnboarding || (() => undefined)}
          isOpeningPayoutOnboarding={isOpeningPayoutOnboarding}
          showHeader={false}
        />
      )}

      {/* ADD VEHICLE MODAL */}
      <Modal isOpen={isAddVehicleModalOpen} onClose={onCloseAddVehicleModal} title={vehicleForm.brand ? 'Editar Veículo' : 'Cadastrar Veículo'}>
        <div className="space-y-4 text-left">
          {vehicleError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{vehicleError}</span>
            </div>
          )}

          <VehicleCatalogPicker
            vehicleType={vehicleForm.vehicleType}
            brand={vehicleForm.brand}
            model={vehicleForm.model}
            year={vehicleForm.year}
            onChange={({ brand, model, year }) => onVehicleFormChange({ ...vehicleForm, brand, model, year })}
          />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mazzi-field-label block mb-1">Placa *</label>
              <MaskedInput
                value={vehicleForm.licensePlate}
                mask={maskVehiclePlate}
                onChange={(value) => onVehicleFormChange({ ...vehicleForm, licensePlate: value })}
                placeholder="ABC-1234 / ABC1D23"
              />
            </div>
            <div>
              <Select
                label="Categoria *"
                value={vehicleForm.category}
                onChange={(e) => {
                  const cat = e.target.value as VehicleCategory;
                  onVehicleFormChange({
                    ...vehicleForm,
                    category: cat,
                    vehicleType: cat === 'A' ? 'MOTORCYCLE' : 'CAR',
                  });
                }}
                options={[
                  { value: 'B', label: 'Cat. B (Carro)' },
                ]}
                disabled
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Select
                label="Transmissão *"
                value={vehicleForm.transmission}
                onChange={(e) => onVehicleFormChange({ ...vehicleForm, transmission: e.target.value as TransmissionType })}
                options={[
                  { value: 'MANUAL', label: 'Manual' },
                  { value: 'AUTOMATIC', label: 'Automática' },
                ]}
              />
            </div>
            <div>
              <label className="mazzi-field-label block mb-1">Cor</label>
              <Input
                value={vehicleForm.color}
                onChange={(e) => onVehicleFormChange({ ...vehicleForm, color: e.target.value })}
                placeholder="Ex: Prata, Preto"
              />
            </div>
          </div>

          <div className="mazzi-modal-actions flex justify-end gap-2">
            <Button variant="dangerSoft" size="sm" onClick={onCloseAddVehicleModal} leftIcon={<XCircle className="w-4 h-4" />}>
              Cancelar
            </Button>
            <Button variant="primary" size="sm" onClick={() => void runAsyncAction('save-vehicle', onSaveVehicle)} disabled={!vehicleFormValid || pendingAction !== null || onSavingVehicle} isLoading={pendingAction === 'save-vehicle' || onSavingVehicle} leftIcon={<Save className="w-4 h-4" />}>
              {vehicleForm.brand ? 'Enviar' : 'Salvar Veículo'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ADD OFFERING MODAL */}
      <Modal isOpen={isAddOfferingModalOpen} onClose={onCloseAddOfferingModal} title="Cadastrar Oferta de Aula">
        <div className="space-y-4 text-left">
          {offeringError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{offeringError}</span>
            </div>
          )}

          {currentProvider.type === 'DRIVING_SCHOOL' && (
            <div>
              <Select
                label="Instrutor *"
                value={offeringForm.instructorId}
                onChange={(e) => onOfferingFormChange({ ...offeringForm, instructorId: e.target.value })}
                options={[
                  { value: '', label: 'Selecione um instrutor...' },
                  ...eligibleSchoolInstructors.map((instructor) => ({ value: instructor.userId, label: instructor.name })),
                ]}
                disabled={eligibleSchoolInstructors.length === 0}
              />
              {eligibleSchoolInstructors.length === 0 && (
                <p className="mt-1 text-xs font-semibold text-amber-700">Ative ao menos um instrutor antes de cadastrar uma oferta.</p>
              )}
            </div>
          )}

          <div>
            <Select
              label="Veículo Associado *"
              value={offeringForm.vehicleId}
              onChange={(e) => onOfferingFormChange({ ...offeringForm, vehicleId: e.target.value })}
              options={[
                { value: '', label: 'Selecione um veículo...' },
                ...vehicles.filter((v) => v.status === 'ACTIVE').map((v) => ({ value: v.id, label: `${v.brand} ${v.model} (${maskVehiclePlate(v.licensePlate) || 'Sem placa'}) - Cat. ${v.category}` })),
              ]}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Select
                label="Duração (Minutos) *"
                value={offeringForm.durationMinutes}
                onChange={(e) => onOfferingFormChange({ ...offeringForm, durationMinutes: Number(e.target.value) })}
                options={[
                  { value: 50, label: '50 Minutos (Padrão CTB)' },
                  { value: 60, label: '60 Minutos (indisponível no MVP)', disabled: true },
                  { value: 100, label: '100 Minutos (indisponível no MVP)', disabled: true },
                ]}
              />
            </div>
            <div>
              <label className="mazzi-field-label block mb-1">Preço em R$ *</label>
              <Input
                value={offeringForm.priceInBrl}
                onChange={(e) => onOfferingFormChange({ ...offeringForm, priceInBrl: maskBRLInput(e.target.value) })}
                placeholder="R$ 95,00"
              />
            </div>
          </div>

          <div className="mazzi-modal-actions flex justify-end gap-2">
            <Button variant="dangerSoft" size="sm" onClick={onCloseAddOfferingModal} leftIcon={<XCircle className="w-4 h-4" />}>
              Cancelar
            </Button>
            <Button variant="primary" size="sm" onClick={() => void runAsyncAction('save-offering', onSaveOffering)} disabled={!offeringFormValid || pendingAction !== null || onSavingOffering} isLoading={pendingAction === 'save-offering' || onSavingOffering} leftIcon={<Save className="w-4 h-4" />}>
              Salvar Oferta
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={Boolean(pendingOfferingSwap)}
        onClose={() => setPendingOfferingSwap(null)}
        title="Oferta semelhante já ativa"
        size="sm"
      >
        <div className="space-y-4 text-left">
          <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />
            <p className="text-sm leading-relaxed">
              Já existe uma oferta ativa com o mesmo instrutor, veículo, categoria e transmissão. Deseja trocar para esta oferta?
            </p>
          </div>
          <p className="text-xs leading-relaxed text-slate-500">
            A oferta atualmente ativa será desativada e a oferta escolhida será ativada. Reservas já realizadas não serão alteradas.
          </p>
          <div className="mazzi-modal-actions flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setPendingOfferingSwap(null)}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                if (!pendingOfferingSwap) return;
                const { target, current } = pendingOfferingSwap;
                void runAsyncAction(`offering-swap-${target.id}`, async () => {
                  await onReplaceActiveOffering(target.id, current.id);
                  setPendingOfferingSwap(null);
                });
              }}
              disabled={pendingAction !== null}
              isLoading={pendingAction === `offering-swap-${pendingOfferingSwap?.target.id}`}
              leftIcon={<Power className="h-4 w-4" />}
            >
              Trocar oferta
            </Button>
          </div>
        </div>
      </Modal>

    </div>
  );
};
