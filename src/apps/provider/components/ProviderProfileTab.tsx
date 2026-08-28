import React from 'react';
import { Pencil, Save, } from 'lucide-react';
import { ComplianceDocument, Provider, ProviderAddress, UserRole } from '../../../types';
import { Button, PrimaryButton, ButtonBase } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Textarea } from '../../../components/ui/Textarea';
import { ProfilePhotoPicker } from '../../../components/profile/ProfilePhotoPicker';
import { ComplianceStatusAlert } from '../../../components/ui/ComplianceStatusAlert';
import { ProviderAddressForm, ProviderAddressFormValue } from '../../../components/provider/ProviderAddressForm';

import { maskBrazilianPhone, maskCnpj } from '../../../lib/input-masks';
import { AppPageHeader } from '../../../components/ui/AppPageHeader';
import { Modal } from '../../../components/ui/Modal';
import { evaluateProviderEligibility } from '../../../domain/compliance';
import { resolveComplianceDocumentStatus } from '../../../domain/provider-compliance-presentation';

interface ProviderProfileTabProps {
  currentProvider: Provider;
  complianceDocs: ComplianceDocument[];
  currentRole: UserRole;
  userName?: string;
  userEmail?: string;
  userPhone?: string;
  profileAvatar?: string;
  onAvatarChange?: (url: string) => void;
  isEditingProfile: boolean;
  onToggleEditProfile: () => void;
  profileForm: {
    displayName: string;
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
}

export const ProviderProfileTab: React.FC<ProviderProfileTabProps> = ({
  currentProvider,
  complianceDocs,
  currentRole,
  userName,
  userEmail,
  userPhone,
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
}) => {
  const isSchool = currentProvider.type === 'DRIVING_SCHOOL' || currentRole === 'SCHOOL_STAFF';
  const canEditProfile = currentRole !== 'SCHOOL_STAFF';
  const complianceEligibility = evaluateProviderEligibility(currentProvider, complianceDocs);
  const complianceStatus = resolveComplianceDocumentStatus(complianceEligibility, complianceDocs);
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
        <div className="relative mx-auto flex h-24 w-24 items-center justify-center overflow-hidden rounded-[28px] border border-[var(--mazzi-border)] bg-[var(--mazzi-yellow)] text-2xl font-bold text-[var(--mazzi-dark)] shadow-[var(--mazzi-shadow)]">
          {profileAvatar ? <img src={profileAvatar} alt="Foto do perfil" className="h-full w-full object-cover" /> : (currentProvider.name || userName || 'Instrutor').split(/\s+/).map((n) => n[0]).slice(0, 2).join('').toUpperCase()}
        </div>
        <h3 className="mt-4 truncate text-2xl font-bold text-[var(--mazzi-dark)]">{currentProvider.name || userName || 'Instrutor'}</h3>
        <p className="mt-1 truncate text-sm text-[var(--mazzi-muted)]">{userEmail || 'E-mail não informado'}</p>
      </div>

      <ComplianceStatusAlert
        status={complianceStatus}
      />

      {currentRole === 'SCHOOL_STAFF' && (
        <div role="status" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-medium text-slate-700">
          Você possui acesso de equipe. Alterações no perfil da Autoescola são exclusivas para administradores da escola.
        </div>
      )}

      {/* Main Profile Card */}
      <div className="rounded-3xl border border-[var(--mazzi-border)] bg-white p-5 shadow-xs">
        <h4 className="text-sm font-bold text-[var(--mazzi-dark)]">Dados do perfil</h4>

        {/* Profile Content / Edit Form */}
        {!isEditingProfile || !canEditProfile ? (
          <dl className="mt-4 space-y-3 text-sm">
            {isSchool && <div className="flex items-start justify-between gap-3"><dt className="text-slate-500">Razão social</dt><dd className="max-w-[65%] text-right font-semibold text-[var(--mazzi-text)]">{currentProvider.legalName || 'Não informado'}</dd></div>}
            {isSchool && <div className="flex items-start justify-between gap-3"><dt className="text-slate-500">CNPJ</dt><dd className="font-semibold text-[var(--mazzi-text)]">{currentProvider.documentNumber ? maskCnpj(currentProvider.documentNumber) : 'Não informado'}</dd></div>}
            <div className="flex items-center justify-between gap-3"><dt className="text-slate-500">Telefone</dt><dd className="font-semibold text-[var(--mazzi-text)]">{maskBrazilianPhone(currentProvider.publicContact || userPhone || '') || 'Não informado'}</dd></div>
            <div className="flex items-start justify-between gap-3"><dt className="text-slate-500">E-mail de contato</dt><dd className="max-w-[65%] truncate text-right font-semibold text-[var(--mazzi-text)]">{currentProvider.commercialEmail || userEmail || 'Não informado'}</dd></div>
            {!isSchool && <div className="flex items-center justify-between gap-3"><dt className="text-slate-500">E-mail</dt><dd className="truncate font-semibold text-[var(--mazzi-text)]">{userEmail || 'Não informado'}</dd></div>}
            <div className="flex items-center justify-between gap-3"><dt className="text-slate-500">Perfil profissional</dt><dd className="text-right font-semibold text-[var(--mazzi-text)]">{isSchool ? 'Autoescola / CFC' : 'Instrutor autônomo'}</dd></div>
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
            {formError && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700">{formError}</div>}
            {onAvatarChange && (
              <div>
                <span className="mb-1.5 block text-xs font-bold text-slate-700">Foto de perfil</span>
                <ProfilePhotoPicker
                  value={profileAvatar}
                  name={profileForm.displayName || currentProvider.name || userName}
                  onChange={onAvatarChange}
                />
              </div>
            )}

            {isSchool && <>
              <div>
                <label className="mazzi-field-label mb-1.5 block" htmlFor="provider-profile-legal-name">Razão social *</label>
                <Input id="provider-profile-legal-name" className="rounded-2xl" value={profileForm.legalName} onChange={(e) => onProfileFormChange({ ...profileForm, legalName: e.target.value })} />
              </div>
              <div>
                <label className="mazzi-field-label mb-1.5 block" htmlFor="provider-profile-cnpj">CNPJ</label>
                <Input id="provider-profile-cnpj" className="rounded-2xl bg-slate-100 text-slate-500" value={currentProvider.documentNumber ? maskCnpj(currentProvider.documentNumber) : 'Não informado'} readOnly aria-describedby="provider-profile-cnpj-help" />
                <p id="provider-profile-cnpj-help" className="mt-1 text-[11px] text-slate-500">O CNPJ não pode ser alterado.</p>
              </div>
              <div>
                <label className="mazzi-field-label mb-1.5 block" htmlFor="provider-profile-commercial-email">E-mail de contato</label>
                <Input id="provider-profile-commercial-email" className="rounded-2xl" type="email" value={profileForm.commercialEmail} onChange={(e) => onProfileFormChange({ ...profileForm, commercialEmail: e.target.value })} placeholder="contato@autoescola.com.br" />
              </div>
            </>}

            <div>
              <label className="mazzi-field-label mb-1.5 block" htmlFor="provider-profile-name">Nome de exibição *</label>
              <Input
                id="provider-profile-name"
                className="rounded-2xl"
                value={profileForm.displayName}
                onChange={(e) => onProfileFormChange({ ...profileForm, displayName: e.target.value })}
              />
            </div>

            <div>
              <label className="mazzi-field-label mb-1.5 block" htmlFor="provider-profile-contact">WhatsApp / contato público</label>
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

            <ProviderAddressForm
              idPrefix="provider-profile"
              value={profileForm as ProviderAddressFormValue}
              onChange={onProfileFormChange}
            />

            <div>
              <label className="mazzi-field-label mb-1.5 block" htmlFor="provider-profile-radius">Raio de atendimento (km)</label>
              <Input
                id="provider-profile-radius"
                className="rounded-2xl"
                type="number"
                min={1}
                max={100}
                value={profileForm.serviceRadiusKm}
                onChange={(e) => onProfileFormChange({
                  ...profileForm,
                  serviceRadiusKm: e.target.value === '' ? '' : Number(e.target.value),
                })}
              />
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

          </form>
          </Modal>
        )}
      </div>

      {/* Logout: same quiet footer action as Student */}
      <div className="flex justify-center border-t border-[var(--mazzi-border)] pt-4">
        <Button variant="ghost" size="sm" className="font-bold text-rose-700 hover:bg-rose-50" onClick={onLogout}>
          Sair
        </Button>
      </div>
    </div>
  );
};
