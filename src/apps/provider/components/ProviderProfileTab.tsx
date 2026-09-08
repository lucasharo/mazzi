import React from 'react';
import { Camera, Eye, EyeOff, MapPin, Pencil, Save, ShieldCheck, UserRound } from 'lucide-react';
import { ComplianceDocument, Provider, ProviderAddress, ProviderPaymentAccount, UserRole, Vehicle } from '../../../types';
import type { SchoolInstructorComplianceSummary, SchoolMembership } from '../../../lib/db-service';
import { Button, PrimaryButton, ButtonBase } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Textarea } from '../../../components/ui/Textarea';
import { ProfilePhotoPicker } from '../../../components/profile/ProfilePhotoPicker';
import { ProfileAvatar } from '../../../components/profile/ProfileAvatar';
import { ComplianceStatusAlert } from '../../../components/ui/ComplianceStatusAlert';
import { ProviderAddressForm, ProviderAddressFormValue } from '../../../components/provider/ProviderAddressForm';

import { maskBrazilianPhone, maskCpfCnpj, maskCnpj } from '../../../lib/input-masks';
import { formatDateMask } from '../../../utils/age';
import { AppPageHeader } from '../../../components/ui/AppPageHeader';
import { Modal } from '../../../components/ui/Modal';
import { evaluateProviderEligibility } from '../../../domain/compliance';
import { resolveComplianceDocumentStatus } from '../../../domain/provider-compliance-presentation';
import { NotificationCenterLink } from '../../../components/notifications/NotificationCenterLink';
import { ProfileDetailsCard } from '../../../components/profile/ProfileDetailsCard';
import { ProfileSectionHeader } from '../../../components/profile/ProfileSectionHeader';
import { isProviderPaymentAccountReady } from '../../../domain/payments/provider-payment-readiness';

interface ProviderProfileTabProps {
  currentProvider: Provider;
  complianceDocs: ComplianceDocument[];
  currentRole: UserRole;
  userName?: string;
  userEmail?: string;
  userPhone?: string;
  userBirthDate?: string;
  currentUserId?: string;
  providerVehicles?: Vehicle[];
  paymentAccount?: ProviderPaymentAccount | null;
  schoolInstructors?: SchoolMembership[];
  schoolInstructorSummary?: SchoolInstructorComplianceSummary[];
  profileAvatar?: string;
  onAvatarChange?: (url: string) => void;
  isEditingProfile: boolean;
  onToggleEditProfile: () => void;
  profileForm: {
    displayName: string;
    birthDate: string;
    legalName: string;
    publicContact: string;
    commercialEmail: string;
    neighborhood: string;
    city: string;
    state: string;
    serviceRadiusKm: number | '';
    bio: string;
    addressLine1: string;
    houseNumber: string;
    complement: string;
    postalCode: string;
    address?: ProviderAddress;
  };
  onProfileFormChange: (form: any) => void;
  onSaveProfile: () => void;
  formError?: string | null;
  isSavingProfile?: boolean;
  onLogout: () => void;
  onOpenNotifications: () => void;
}

export const ProviderProfileTab: React.FC<ProviderProfileTabProps> = ({
  currentProvider,
  complianceDocs,
  currentRole,
  userName,
  userEmail,
  userPhone,
  userBirthDate,
  currentUserId,
  providerVehicles = [],
  paymentAccount,
  schoolInstructors = [],
  schoolInstructorSummary = [],
  profileAvatar,
  onAvatarChange,
  isEditingProfile,
  onToggleEditProfile,
  profileForm,
  onProfileFormChange,
  onSaveProfile,
  formError,
  isSavingProfile = false,
  onLogout,
  onOpenNotifications,
}) => {
  const isSchool = currentProvider.type === 'DRIVING_SCHOOL' || currentRole === 'SCHOOL_STAFF';
  const canEditProfile = currentRole !== 'SCHOOL_STAFF';
  const [isDocumentVisible, setIsDocumentVisible] = React.useState(false);
  const documentValue = currentProvider.documentNumber || '';
  const documentDigits = documentValue.replace(/\D/g, '');
  const documentLabel = documentDigits.length === 14 ? 'CNPJ' : 'CPF';
  const formattedDocument = maskCpfCnpj(documentValue, isSchool ? 'DRIVING_SCHOOL' : 'INSTRUCTOR');
  const maskedDocument = documentLabel === 'CNPJ'
    ? formattedDocument.replace(/^(\d{2})\.\d{3}\.\d{3}\/\d{4}-(\d{2})$/, '$1.***.***/****-$2')
    : formattedDocument.replace(/^(\d{3})\.\d{3}\.\d{3}-(\d{2})$/, '$1.***.***-$2');
  const displayDocument = documentValue
    ? (isDocumentVisible ? formattedDocument : maskedDocument)
    : 'Não informado';
  const complianceEligibility = evaluateProviderEligibility(currentProvider, complianceDocs);
  const complianceStatus = resolveComplianceDocumentStatus(complianceEligibility, complianceDocs);
  const marketplacePending = React.useMemo(() => {
    const instructors = isSchool
      ? schoolInstructors.filter((instructor) => instructor.isActive && instructor.membershipStatus === 'ACTIVE')
      : currentUserId
        ? [{ id: '', userId: currentUserId, name: currentProvider.name, membershipStatus: 'ACTIVE', isActive: true }]
        : [];
    const hasActiveVehicle = providerVehicles.some((vehicle) => vehicle.status === 'ACTIVE');
    const hasPaymentAccount = isProviderPaymentAccountReady(paymentAccount);

    return instructors.flatMap((instructor) => {
      const pending: string[] = [];
      const hasCompliance = isSchool
        ? schoolInstructorSummary.find((summary) => summary.membershipId === instructor.id)?.eligible === true
        : complianceEligibility.isEligible;
      if (!hasActiveVehicle) pending.push('Veículo ativo não cadastrado');
      if (!hasCompliance) pending.push('Compliance aprovado pendente');
      if (!hasPaymentAccount) pending.push('Conta bancária não cadastrada');
      return pending;
    });
  }, [complianceEligibility.isEligible, currentProvider.name, currentUserId, isSchool, paymentAccount, providerVehicles, schoolInstructorSummary, schoolInstructors]);
  return (
    <div className="space-y-5 text-left">
      {/* Header */}
      <AppPageHeader eyebrow="Sua conta" title="Meu Perfil" action={!isEditingProfile && canEditProfile ? <ButtonBase
          type="button"
          onClick={onToggleEditProfile}
          aria-label="Editar perfil"
          title="Editar perfil"
          className="mazzi-icon-button shrink-0"
        >
          <Pencil className="h-5 w-5" aria-hidden="true" />
        </ButtonBase> : undefined} />

      {/* Profile identity: same hierarchy as Student */}
      <div className="text-center pt-2">
        <ProfileAvatar name={currentProvider.name || userName || 'Instrutor'} imageUrl={profileAvatar} size="xl" className="mx-auto h-24 w-24 text-2xl" />
        <h3 className="mt-4 truncate text-2xl font-bold text-[var(--mazzi-dark)]">{currentProvider.name || userName || 'Instrutor'}</h3>
        <p className="mt-1 truncate text-sm text-[var(--mazzi-muted)]">{userEmail || 'E-mail não informado'}</p>
      </div>

      <ComplianceStatusAlert
        status={complianceStatus}
        marketplaceReady={marketplacePending.length === 0}
        marketplacePending={marketplacePending}
      />

      {currentRole === 'SCHOOL_STAFF' && (
        <div role="status" className="mazzi-compact-card rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-medium text-slate-700">
          Você possui acesso de equipe. Alterações no perfil da Autoescola são exclusivas para administradores da escola.
        </div>
      )}

      {/* Main Profile Card */}
      <ProfileDetailsCard>

        {/* Profile Content / Edit Form */}
        {!isEditingProfile || !canEditProfile ? (
          <dl>
            {isSchool && <div className="flex items-start justify-between gap-3"><dt className="text-slate-500">Razão social</dt><dd className="max-w-[65%] text-right font-semibold text-[var(--mazzi-text)]">{currentProvider.legalName || 'Não informado'}</dd></div>}
            <div className="flex items-center justify-between gap-3"><dt className="text-slate-500">{documentLabel}</dt><dd className="relative pr-9 font-mono font-semibold text-[var(--mazzi-text)]"><span className="text-right">{displayDocument}</span>{documentValue && <ButtonBase type="button" onClick={() => setIsDocumentVisible((visible) => !visible)} aria-label={isDocumentVisible ? `Ocultar ${documentLabel}` : `Visualizar ${documentLabel}`} aria-pressed={isDocumentVisible} title={isDocumentVisible ? 'Ocultar documento' : 'Visualizar documento'} className="absolute right-0 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-2xl bg-white text-slate-500 transition-colors duration-200 ease-out hover:bg-[var(--mazzi-surface-soft)] hover:text-[var(--mazzi-dark)] focus-visible:ring-2 focus-visible:ring-[var(--mazzi-focus-glow)]">{isDocumentVisible ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}</ButtonBase>}</dd></div>
            {!isSchool && <div className="flex items-center justify-between gap-3"><dt className="text-slate-500">E-mail</dt><dd className="truncate font-semibold text-[var(--mazzi-text)]">{userEmail || 'Não informado'}</dd></div>}
            <div className="flex items-start justify-between gap-3"><dt className="text-slate-500">E-mail de contato</dt><dd className="max-w-[65%] truncate text-right font-semibold text-[var(--mazzi-text)]">{currentProvider.commercialEmail || userEmail || 'Não informado'}</dd></div>
            <div className="flex items-center justify-between gap-3"><dt className="text-slate-500">Telefone</dt><dd className="font-semibold text-[var(--mazzi-text)]">{maskBrazilianPhone(currentProvider.publicContact || userPhone || '') || 'Não informado'}</dd></div>
            <div className="flex items-center justify-between gap-3"><dt className="text-slate-500">Perfil profissional</dt><dd className="text-right font-semibold text-[var(--mazzi-text)]">{isSchool ? 'Autoescola / CFC' : 'Instrutor autônomo'}</dd></div>
            {!isSchool && <div className="flex items-center justify-between gap-3"><dt className="text-slate-500">Data de nascimento</dt><dd className="font-semibold text-[var(--mazzi-text)]">{profileForm.birthDate || userBirthDate || 'Não informada'}</dd></div>}
            <div className="flex items-start justify-between gap-3"><dt className="shrink-0 text-slate-500">Localização</dt><dd className="max-w-[68%] text-right font-semibold text-[var(--mazzi-text)]">{currentProvider.neighborhood || 'Não informado'}, {currentProvider.city || 'Não informado'} - {currentProvider.state || 'SP'}</dd></div>
            <div className="flex items-center justify-between gap-3"><dt className="text-slate-500">Raio público</dt><dd className="font-semibold text-[var(--mazzi-text)]">{currentProvider.serviceRadiusKm || 6} km</dd></div>
            <div className="border-t border-[var(--mazzi-border)] pt-3">
              <dt className="text-slate-500">Biografia</dt>
              <dd className="mt-1.5 leading-relaxed text-[var(--mazzi-text)]">{currentProvider.bio || 'Nenhuma biografia cadastrada.'}</dd>
            </div>
          </dl>
        ) : (
          <Modal
            isOpen={isEditingProfile}
            onClose={onToggleEditProfile}
            title="Editar perfil"
            footer={(
              <>
                <Button type="button" variant="dangerSoft" size="sm" onClick={onToggleEditProfile}>
                  Cancelar
                </Button>
                <PrimaryButton type="submit" form="provider-profile-edit-form" size="sm" className="font-bold shadow-xs" disabled={isSavingProfile} loading={isSavingProfile} leftIcon={<Save className="h-4 w-4" aria-hidden="true" />}>
                  {isSavingProfile ? 'Salvando…' : 'Salvar perfil'}
                </PrimaryButton>
              </>
            )}
          >
          <form id="provider-profile-edit-form" className="space-y-4" onSubmit={(event) => { event.preventDefault(); onSaveProfile(); }}>
            {formError && <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700">{formError}</div>}
            {onAvatarChange && (
              <div className="mazzi-compact-card space-y-2.5 rounded-2xl border border-[var(--mazzi-border)] bg-white p-4 shadow-2xs">
                <ProfileSectionHeader title="Foto de perfil" icon={Camera} badge="Identificação" />
                <ProfilePhotoPicker
                  value={profileAvatar}
                  name={profileForm.displayName || currentProvider.name || userName}
                  onChange={onAvatarChange}
                />
                <p className="text-[11px] font-medium text-[var(--mazzi-muted)]">Sua foto facilita sua identificação no ponto de encontro.</p>
              </div>
            )}

            <div className="mazzi-compact-card space-y-3.5 rounded-2xl border border-[var(--mazzi-border)] bg-white p-4 shadow-2xs">
              <ProfileSectionHeader title="Dados pessoais" icon={UserRound} />
            {isSchool && <>
              <div>
                <label className="mazzi-field-label mb-1.5 block" htmlFor="provider-profile-legal-name">Razão social *</label>
                <Input id="provider-profile-legal-name" className="rounded-2xl" value={profileForm.legalName} onChange={(e) => onProfileFormChange({ ...profileForm, legalName: e.target.value })} />
              </div>
            </>}
            <div>
              <label className="mazzi-field-label mb-1.5 block" htmlFor="provider-profile-name">{isSchool ? 'Nome fantasia *' : 'Nome completo *'}</label>
              <Input
                id="provider-profile-name"
                className="rounded-2xl"
                value={profileForm.displayName}
                onChange={(e) => onProfileFormChange({ ...profileForm, displayName: e.target.value })}
              />
            </div>

            <div>
              <label className="mazzi-field-label mb-1.5 block" htmlFor="provider-profile-contact">Telefone</label>
              <Input
                id="provider-profile-contact"
                className="rounded-2xl"
                type="tel"
                inputMode="tel"
                value={maskBrazilianPhone(profileForm.publicContact)}
                onChange={(e) => onProfileFormChange({ ...profileForm, publicContact: maskBrazilianPhone(e.target.value) })}
                placeholder="(11) 90000-0000"
              />
            </div>

            {isSchool && <div>
              <label className="mazzi-field-label mb-1.5 block" htmlFor="provider-profile-commercial-email">E-mail de contato</label>
              <Input id="provider-profile-commercial-email" className="rounded-2xl" type="email" value={profileForm.commercialEmail} onChange={(e) => onProfileFormChange({ ...profileForm, commercialEmail: e.target.value })} placeholder="contato@autoescola.com.br" />
            </div>}

            {!isSchool && <div>
              <label className="mazzi-field-label mb-1.5 block" htmlFor="provider-profile-commercial-email">E-mail de contato</label>
              <Input id="provider-profile-commercial-email" className="rounded-2xl" type="email" value={profileForm.commercialEmail} onChange={(e) => onProfileFormChange({ ...profileForm, commercialEmail: e.target.value })} placeholder="contato@instrutor.com.br" />
            </div>}

            {!isSchool && <div>
              <label className="mazzi-field-label mb-1.5 block" htmlFor="provider-profile-birth-date">Data de nascimento *</label>
              <Input id="provider-profile-birth-date" className="rounded-2xl" inputMode="numeric" maxLength={10} value={profileForm.birthDate} onChange={(e) => onProfileFormChange({ ...profileForm, birthDate: formatDateMask(e.target.value) })} placeholder="DD/MM/AAAA" helperText="Usada para validar o cadastro de recebimentos." />
            </div>}

            {isSchool && <div>
              <label className="mazzi-field-label mb-1.5 block" htmlFor="provider-profile-birth-date">Data de fundação</label>
              <Input id="provider-profile-birth-date" className="rounded-2xl" inputMode="numeric" maxLength={10} value={profileForm.birthDate} onChange={(e) => onProfileFormChange({ ...profileForm, birthDate: formatDateMask(e.target.value) })} placeholder="DD/MM/AAAA" />
            </div>}
            </div>

            <div className="mazzi-compact-card space-y-3.5 rounded-2xl border border-[var(--mazzi-border)] bg-white p-4 shadow-2xs">
              <ProfileSectionHeader title="Atuação profissional" icon={MapPin} />
              <ProviderAddressForm
                idPrefix="provider-profile"
                value={profileForm as ProviderAddressFormValue}
                onChange={onProfileFormChange}
              />

              <div>
                <div className="mb-1.5 flex items-center justify-between gap-3">
                  <label className="mazzi-field-label block" htmlFor="provider-profile-radius">Raio de atendimento (km)</label>
                  <output htmlFor="provider-profile-radius" className="text-sm font-bold text-[var(--mazzi-dark)]">{profileForm.serviceRadiusKm || 1} km</output>
                </div>
                <input
                  id="provider-profile-radius"
                  type="range"
                  className="h-2 w-full cursor-pointer appearance-none rounded-full bg-[var(--mazzi-yellow-soft)] accent-[var(--mazzi-yellow)] focus:outline-none focus:ring-2 focus:ring-[var(--mazzi-focus-glow)]"
                  min={1}
                  max={15}
                  step={1}
                  value={Number(profileForm.serviceRadiusKm) || 1}
                  onChange={(e) => onProfileFormChange({
                    ...profileForm,
                    serviceRadiusKm: Number(e.target.value),
                  })}
                  style={{ accentColor: 'var(--mazzi-yellow)' }}
                  aria-label="Raio de atendimento"
                  aria-valuetext={`${profileForm.serviceRadiusKm || 1} quilômetros`}
                />
                <div className="mt-1 flex justify-between text-[11px] font-semibold text-[var(--mazzi-muted)]">
                  <span>1 km</span>
                  <span>15 km</span>
                </div>
              </div>

              <div>
                <label className="mazzi-field-label mb-1.5 block" htmlFor="provider-profile-bio">Biografia e diferenciais</label>
                <Textarea
                  id="provider-profile-bio"
                  rows={4}
                  value={profileForm.bio}
                  onChange={(e) => onProfileFormChange({ ...profileForm, bio: e.target.value })}
                  className="w-full rounded-2xl border border-[var(--mazzi-border)] px-3.5 py-2.5 text-sm leading-relaxed text-[var(--mazzi-text)] transition focus:border-[var(--mazzi-yellow)] focus:outline-none focus:ring-2 focus:ring-[var(--mazzi-focus-glow)]"
                  placeholder="Descreva sua experiência, paciência com alunos iniciantes e diferenciais..."
                />
              </div>
            </div>

            <div className="mazzi-compact-card space-y-3 rounded-2xl border border-[var(--mazzi-border)] bg-slate-50/70 p-4 shadow-2xs">
              <ProfileSectionHeader title="Segurança da conta" icon={ShieldCheck} badge="Protegido" badgeClassName="shrink-0 rounded-full border border-emerald-200/60 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700" />
              <div>
                <label className="mazzi-field-label mb-1.5 block" htmlFor="provider-profile-document">{documentLabel}</label>
                <div className="flex items-center gap-2">
                  <Input id="provider-profile-document" className="rounded-2xl bg-slate-100 text-slate-500" value={displayDocument} readOnly aria-describedby="provider-profile-document-help" />
                  {documentValue && <ButtonBase type="button" onClick={() => setIsDocumentVisible((visible) => !visible)} aria-label={isDocumentVisible ? `Ocultar ${documentLabel}` : `Visualizar ${documentLabel}`} aria-pressed={isDocumentVisible} title={isDocumentVisible ? 'Ocultar documento' : 'Visualizar documento'} className="grid min-h-11 min-w-11 shrink-0 place-items-center rounded-2xl bg-[var(--mazzi-surface-soft)] text-slate-600 transition-colors duration-200 ease-out hover:text-[var(--mazzi-dark)] focus-visible:ring-2 focus-visible:ring-[var(--mazzi-focus-glow)]">{isDocumentVisible ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}</ButtonBase>}
                </div>
                <p id="provider-profile-document-help" className="mt-1 text-[11px] text-slate-500">Documento somente leitura. Use o ícone para visualizar ou ocultar.</p>
              </div>
              <div>
                <label className="mazzi-field-label mb-1.5 block" htmlFor="provider-profile-primary-email">E-mail</label>
                <Input id="provider-profile-primary-email" className="rounded-2xl bg-slate-100 text-slate-500" value={userEmail || 'Não informado'} readOnly aria-readonly="true" />
                <p className="mt-1 text-[11px] text-slate-500">E-mail utilizado para acesso.</p>
              </div>
            </div>

          </form>
          </Modal>
        )}
      </ProfileDetailsCard>

      <NotificationCenterLink onOpen={onOpenNotifications} />

      {/* Logout: same quiet footer action as Student */}
      <div className="flex justify-center border-t border-[var(--mazzi-border)] pt-4">
        <Button variant="ghost" size="sm" className="font-bold text-rose-700 hover:bg-rose-50" onClick={onLogout}>
          Sair
        </Button>
      </div>
    </div>
  );
};
