import React from 'react';
import { Car, Bike, Plus, ShieldCheck, Upload, AlertCircle, Check, Ban, Tag, Users, Info, SlidersHorizontal, RefreshCw, Power, PowerOff, Save, XCircle, } from 'lucide-react';
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
import { SchoolMembershipPanel } from './SchoolMembershipPanel';
import type { SchoolInstructorComplianceSummary, SchoolMembership } from '../../../lib/db-service';

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
}) => {
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

      {/* Subtabs Switcher */}
      <div className="mazzi-segmented overflow-x-auto">
        <ButtonBase
          type="button"
          onClick={() => onSubTabChange('vehicles')}
          aria-selected={managementSubTab === 'vehicles'}
          data-active={managementSubTab === 'vehicles'}
          className="flex items-center justify-center gap-1.5 whitespace-nowrap"
        >
          <Car className="w-3.5 h-3.5" />
          <span>Veículos</span>
        </ButtonBase>
        <ButtonBase
          type="button"
          onClick={() => onSubTabChange('offerings')}
          aria-selected={managementSubTab === 'offerings'}
          data-active={managementSubTab === 'offerings'}
          className="flex items-center justify-center gap-1.5 whitespace-nowrap"
        >
          <Tag className="w-3.5 h-3.5" />
          <span>Ofertas</span>
        </ButtonBase>
        <ButtonBase
          type="button"
          onClick={() => onSubTabChange('compliance')}
          aria-selected={managementSubTab === 'compliance'}
          data-active={managementSubTab === 'compliance'}
          className="flex items-center justify-center gap-1.5 whitespace-nowrap"
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Compliance</span>
        </ButtonBase>
        <ButtonBase
          type="button"
          onClick={() => onSubTabChange('memberships')}
          aria-selected={managementSubTab === 'memberships'}
          data-active={managementSubTab === 'memberships'}
          className="flex items-center justify-center gap-1.5 whitespace-nowrap"
        >
          <Users className="w-3.5 h-3.5" />
          <span>Instrutores</span>
        </ButtonBase>
      </div>

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
      </div>

      {managementSubTab === 'memberships' && (
        <SchoolMembershipPanel
          provider={currentProvider}
          isInstructor={currentProvider.type === 'INSTRUCTOR'}
        />
      )}

      {/* VEHICLES SUBTAB */}
      {managementSubTab === 'vehicles' && (
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
              {vehicles.map((v) => (
                <div
                  key={v.id}
                  className="p-5 rounded-3xl bg-white border border-[#e9e6de] shadow-xs space-y-3 flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {v.vehicleType === 'MOTORCYCLE' ? (
                          <Bike className="w-5 h-5 text-amber-600" />
                        ) : (
                          <Car className="w-5 h-5 text-slate-900" />
                        )}
                      <h4 className="text-base font-bold text-slate-900">
                          {v.brand} {v.model} ({v.year})
                        </h4>
                      </div>
                      <Badge variant={v.status === 'ACTIVE' ? 'success' : 'default'}>
                        {v.status === 'ACTIVE' ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-600">
                      <span className="px-2.5 py-0.5 rounded-md bg-slate-100 font-mono text-[#202126] font-bold">
                        {maskVehiclePlate(v.licensePlate) || 'Sem placa'}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-md bg-amber-100 text-amber-900 font-bold">
                        Cat. {v.category}
                      </span>
                      <span>Transmissão: {formatTransmissionLabel(v.transmission)}</span>
                      {v.color && <span>• Cor: {v.color}</span>}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-slate-400">
                      ID: {v.id.slice(0, 8)}
                    </span>
                    <Button
                      variant={v.status === 'ACTIVE' ? 'dangerSoft' : 'primary'}
                      size="sm"
                      onClick={() => onToggleVehicleStatus(v.id)}
                      leftIcon={v.status === 'ACTIVE' ? <PowerOff className="w-3.5 h-3.5" /> : <Power className="w-3.5 h-3.5" />}
                    >
                      {v.status === 'ACTIVE' ? 'Desativar Veículo' : 'Ativar Veículo'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* OFFERINGS SUBTAB */}
      {managementSubTab === 'offerings' && (
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
                        variant={o.status === 'ACTIVE' ? 'outline' : 'primary'}
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
      {managementSubTab === 'compliance' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <p>
              Para manter o selo de <strong>Prestador Verificado</strong> e garantir segurança aos alunos, mantenha seus documentos de credenciamento (CNH/CNPJ/CRLV) sempre em dia.
            </p>
          </div>

          <div className="space-y-3">
            {DEFAULT_COMPLIANCE_REQUIREMENTS.filter((r) => r.providerType === currentProvider.type).map((req) => {
              const doc = complianceDocs.find((d) => d.type === req.documentType);
              return (
                <div
                  key={req.id}
                  className="p-4 rounded-2xl bg-white border border-[#e9e6de] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900">{req.title}</span>
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3 text-blue-700" />
                        CTB Regulamentado
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">{req.description}</p>
                    {doc && (
                      <p className="text-[11px] text-slate-600 font-mono">
                        Status: <strong className="uppercase">{doc.status}</strong> • {doc.fileName}
                      </p>
                    )}
                  </div>

                  <div>
                    {doc ? (
                      <Badge variant="success">Enviado</Badge>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        leftIcon={<Upload className="w-3.5 h-3.5" />}
                        onClick={() => onUploadDocClick(req.documentType)}
                      >
                        Anexar Arquivo
                      </Button>
                    )}
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
                  { value: 60, label: '60 Minutos (1 Hora)' },
                  { value: 100, label: '100 Minutos (Dupla)' },
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
