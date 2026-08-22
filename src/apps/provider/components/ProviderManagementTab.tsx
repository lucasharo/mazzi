import React from 'react';
import { Car, Plus, ShieldCheck, Upload, AlertCircle, Check, Ban, Tag, Users, Info, SlidersHorizontal, RefreshCw, Power, PowerOff, Save, XCircle, } from 'lucide-react';
import {
  Vehicle, ServiceOffering, ComplianceDocument, Provider, VehicleCategory, VehicleType, TransmissionType, } from '../../../types';
import { Button, ButtonBase } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { Modal } from '../../../components/ui/Modal';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { EmptyState } from '../../../components/ui/EmptyState';
import { VehicleCard } from '../../../components/ui/VehicleCard';
import { formatCentsToBRL } from '../../../domain/money';
import { DEFAULT_COMPLIANCE_REQUIREMENTS } from '../../../domain/compliance';
import { formatTransmissionLabel } from '../../../lib/date-format';
import { maskVehiclePlate, normalizeVehiclePlate, maskBRLInput } from '../../../lib/input-masks';
import { AppPageHeader } from '../../../components/ui/AppPageHeader';
import { Tabs } from '../../../components/ui/Tabs';
import { SchoolMembershipPanel } from './SchoolMembershipPanel';
import type { SchoolInstructorComplianceSummary, SchoolMembership } from '../../../lib/db-service';
import { ContentSkeleton } from '../../../components/ui/ContentSkeleton';

interface ProviderManagementTabProps {
  onRefresh: () => void;
  isRefreshing?: boolean;
  managementSubTab: 'vehicles' | 'offerings' | 'compliance' | 'memberships';
  onSubTabChange: (tab: 'vehicles' | 'offerings' | 'compliance' | 'memberships') => void;
  vehicles: Vehicle[];
  offerings: ServiceOffering[];
  complianceDocs: ComplianceDocument[];
  currentProvider: Provider;
  schoolInstructors: SchoolMembership[];
  schoolInstructorSummary: SchoolInstructorComplianceSummary[];
  isAddVehicleModalOpen: boolean;
  onOpenAddVehicleModal: () => void;
  onCloseAddVehicleModal: () => void;
  vehicleForm: {
    brand: string;
    model: string;
    year: number;
    licensePlate: string;
    category: VehicleCategory;
    vehicleType: VehicleType;
    transmission: TransmissionType;
    color: string;
    photoUrl: string;
  };
  onVehicleFormChange: (form: any) => void;
  onSaveVehicle: () => void;
  onToggleVehicleStatus: (vehicleId: string) => void;
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
  onSaveOffering: () => void;
  onToggleOfferingStatus: (offeringId: string) => void;
  offeringError: string | null;
  onUploadDocClick: (docType: string) => void;
  onAcceptComplianceTerms: () => void;
  isAcceptingComplianceTerms?: boolean;
  complianceTermsError?: string | null;
}

export const ProviderManagementTab: React.FC<ProviderManagementTabProps> = ({
  onRefresh,
  isRefreshing,
  managementSubTab,
  onSubTabChange,
  vehicles,
  offerings,
  complianceDocs,
  currentProvider,
  schoolInstructors,
  schoolInstructorSummary,
  isAddVehicleModalOpen,
  onOpenAddVehicleModal,
  onCloseAddVehicleModal,
  vehicleForm,
  onVehicleFormChange,
  onSaveVehicle,
  onToggleVehicleStatus,
  vehicleError,
  isAddOfferingModalOpen,
  onOpenAddOfferingModal,
  onCloseAddOfferingModal,
  offeringForm,
  onOfferingFormChange,
  onSaveOffering,
  onToggleOfferingStatus,
  offeringError,
  onUploadDocClick,
  onAcceptComplianceTerms,
  isAcceptingComplianceTerms = false,
  complianceTermsError,
}) => {
  const [isInviteInstructorModalOpen, setIsInviteInstructorModalOpen] = React.useState(false);
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
          { id: 'vehicles', label: 'Veículos', icon: <Car className="h-3.5 w-3.5" /> },
          { id: 'offerings', label: 'Ofertas', icon: <Tag className="h-3.5 w-3.5" /> },
          { id: 'compliance', label: 'Compliance', icon: <ShieldCheck className="h-3.5 w-3.5" /> },
          { id: 'memberships', label: 'Instrutores', icon: <Users className="h-3.5 w-3.5" /> },
        ]}
        className="mazzi-segmented"
      />

      <div className="flex justify-end">
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

      {isRefreshing && <ContentSkeleton label="Atualizando gestão" />}

      {!isRefreshing && managementSubTab === 'memberships' && (
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {vehicles.map((vehicle) => (
                <VehicleCard
                  key={vehicle.id}
                  vehicle={vehicle}
                  footer={(
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-slate-400">ID: {vehicle.id.slice(0, 8)}</span>
                      <Button
                        variant={vehicle.status === 'ACTIVE' ? 'dangerSoft' : 'primary'}
                        size="sm"
                        onClick={() => onToggleVehicleStatus(vehicle.id)}
                        leftIcon={vehicle.status === 'ACTIVE' ? <PowerOff className="w-3.5 h-3.5" /> : <Power className="w-3.5 h-3.5" />}
                      >
                        {vehicle.status === 'ACTIVE' ? 'Desativar Veículo' : 'Ativar Veículo'}
                      </Button>
                    </div>
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
                          <span className="text-slate-900 font-bold">
                          {linkedVehicle ? `${linkedVehicle.brand} ${linkedVehicle.model}` : 'Veículo não localizado'}
                        </span>
                      </p>

                      {currentProvider.type === 'DRIVING_SCHOOL' && (
                        <p className="text-xs text-slate-600 font-medium">
                          Instrutor:{' '}
                          <span className="text-slate-900 font-bold">
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
                        onClick={() => onToggleOfferingStatus(o.id)}
                        leftIcon={o.status === 'ACTIVE' ? <PowerOff className="w-3.5 h-3.5" /> : <Power className="w-3.5 h-3.5" />}
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
                  className="p-4 rounded-2xl bg-white border border-[#e9e6de] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900">{req.title}</span>
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

                  <div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={doc?.status ?? 'PENDING'} domain="compliance" />
                      {(!doc || canResubmit) && !isTermsAcceptance && (
                        <Button
                          variant="outline"
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

      {/* ADD VEHICLE MODAL */}
      <Modal isOpen={isAddVehicleModalOpen} onClose={onCloseAddVehicleModal} title="Cadastrar Veículo">
        <div className="space-y-4 text-left">
          {vehicleError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{vehicleError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-extrabold text-slate-900 block mb-1">Marca *</label>
              <Input
                value={vehicleForm.brand}
                onChange={(e) => onVehicleFormChange({ ...vehicleForm, brand: e.target.value })}
                placeholder="Ex: Volkswagen, Honda"
              />
            </div>
            <div>
              <label className="text-xs font-extrabold text-slate-900 block mb-1">Modelo *</label>
              <Input
                value={vehicleForm.model}
                onChange={(e) => onVehicleFormChange({ ...vehicleForm, model: e.target.value })}
                placeholder="Ex: Polo, CG 160"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-extrabold text-slate-900 block mb-1">Ano *</label>
              <Input
                type="number"
                value={vehicleForm.year}
                onChange={(e) => onVehicleFormChange({ ...vehicleForm, year: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="text-xs font-extrabold text-slate-900 block mb-1">Placa *</label>
              <Input
                value={vehicleForm.licensePlate}
                onChange={(e) => onVehicleFormChange({ ...vehicleForm, licensePlate: maskVehiclePlate(e.target.value) })}
                placeholder="ABC-1234 / ABC1D23"
              />
            </div>
            <div>
              <label className="text-xs font-extrabold text-slate-900 block mb-1">Categoria *</label>
              <Select
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
                  { value: 'A', label: 'Cat. A (Moto)' },
                ]}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-extrabold text-slate-900 block mb-1">Transmissão *</label>
              <Select
                value={vehicleForm.transmission}
                onChange={(e) => onVehicleFormChange({ ...vehicleForm, transmission: e.target.value as TransmissionType })}
                options={[
                  { value: 'MANUAL', label: 'Manual' },
                  { value: 'AUTOMATIC', label: 'Automática' },
                ]}
              />
            </div>
            <div>
              <label className="text-xs font-extrabold text-slate-900 block mb-1">Cor</label>
              <Input
                value={vehicleForm.color}
                onChange={(e) => onVehicleFormChange({ ...vehicleForm, color: e.target.value })}
                placeholder="Ex: Prata, Preto"
              />
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-2 border-t border-slate-200">
            <Button variant="dangerSoft" size="sm" onClick={onCloseAddVehicleModal} leftIcon={<XCircle className="w-4 h-4" />}>
              Cancelar
            </Button>
            <Button variant="primary" size="sm" onClick={onSaveVehicle} leftIcon={<Save className="w-4 h-4" />}>
              Salvar Veículo
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
              <label className="text-xs font-extrabold text-slate-900 block mb-1">Instrutor *</label>
              <Select
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
            <label className="text-xs font-extrabold text-slate-900 block mb-1">Veículo Associado *</label>
            <Select
              value={offeringForm.vehicleId}
              onChange={(e) => onOfferingFormChange({ ...offeringForm, vehicleId: e.target.value })}
              options={[
                { value: '', label: 'Selecione um veículo...' },
                ...vehicles.map((v) => ({ value: v.id, label: `${v.brand} ${v.model} (${maskVehiclePlate(v.licensePlate) || 'Sem placa'}) - Cat. ${v.category}` })),
              ]}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-extrabold text-slate-900 block mb-1">Duração (Minutos) *</label>
              <Select
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
              <label className="text-xs font-extrabold text-slate-900 block mb-1">Preço em R$ *</label>
              <Input
                value={offeringForm.priceInBrl}
                onChange={(e) => onOfferingFormChange({ ...offeringForm, priceInBrl: maskBRLInput(e.target.value) })}
                placeholder="R$ 95,00"
              />
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-2 border-t border-slate-200">
            <Button variant="dangerSoft" size="sm" onClick={onCloseAddOfferingModal} leftIcon={<XCircle className="w-4 h-4" />}>
              Cancelar
            </Button>
            <Button variant="primary" size="sm" onClick={onSaveOffering} leftIcon={<Save className="w-4 h-4" />}>
              Salvar Oferta
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
