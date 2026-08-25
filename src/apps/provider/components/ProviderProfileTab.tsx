import React from 'react';
import { Pencil, Save, } from 'lucide-react';
import { ComplianceDocument, Provider, UserRole } from '../../../types';
import { Button, PrimaryButton, SecondaryButton, ButtonBase } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { ProfilePhotoPicker } from '../../../components/profile/ProfilePhotoPicker';

import { maskBrazilianPhone } from '../../../lib/input-masks';
import { AppPageHeader } from '../../../components/ui/AppPageHeader';
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
    publicContact: string;
    neighborhood: string;
    city: string;
    state: string;
    serviceRadiusKm: number;
    bio: string;
  };
  onProfileFormChange: (form: any) => void;
  onSaveProfile: () => void;
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
  onLogout,
}) => {
  const isSchool = currentProvider.type === 'DRIVING_SCHOOL' || currentRole === 'SCHOOL_STAFF';
  const complianceEligibility = evaluateProviderEligibility(currentProvider, complianceDocs);
  const complianceStatus = resolveComplianceDocumentStatus(complianceEligibility);
  const profileStatus = currentProvider.status === 'ACTIVE' ? currentProvider.status : complianceStatus;
  const profileStatusDomain = currentProvider.status === 'ACTIVE' ? undefined : 'compliance' as const;

  return (
    <div className="space-y-5 text-left">
      {/* Header */}
      <AppPageHeader eyebrow="Sua conta" title="Meu Perfil" action={!isEditingProfile ? <ButtonBase
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
        <div className="mt-3 flex justify-center">
          <StatusBadge status={profileStatus} domain={profileStatusDomain} />
          {currentProvider.status !== 'ACTIVE' && (
            <p className="mt-2 text-[11px] text-[var(--mazzi-muted)]">
              Cadastro operacional: {currentProvider.status === 'DRAFT' ? 'Pendente de ativação' : currentProvider.status}
            </p>
          )}
        </div>
      </div>

      {/* Main Profile Card */}
      <div className="rounded-3xl border border-[var(--mazzi-border)] bg-white p-5 shadow-xs">
        <h4 className="text-sm font-bold text-[var(--mazzi-dark)]">Dados do perfil</h4>

        {/* Profile Content / Edit Form */}
        {!isEditingProfile ? (
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between gap-3"><dt className="text-slate-500">Telefone</dt><dd className="font-semibold text-slate-900">{maskBrazilianPhone(currentProvider.publicContact || userPhone || '') || 'Não informado'}</dd></div>
            <div className="flex items-center justify-between gap-3"><dt className="text-slate-500">E-mail</dt><dd className="truncate font-semibold text-slate-900">{userEmail || 'Não informado'}</dd></div>
            <div className="flex items-center justify-between gap-3"><dt className="text-slate-500">Perfil profissional</dt><dd className="text-right font-semibold text-slate-900">{isSchool ? 'Autoescola / CFC' : 'Instrutor autônomo'}</dd></div>
            <div className="flex items-start justify-between gap-3"><dt className="shrink-0 text-slate-500">Localização</dt><dd className="max-w-[68%] text-right font-semibold text-slate-900">{currentProvider.neighborhood || 'Não informado'}, {currentProvider.city || 'Não informado'} - {currentProvider.state || 'SP'}</dd></div>
            <div className="flex items-center justify-between gap-3"><dt className="text-slate-500">Raio público</dt><dd className="font-semibold text-slate-900">{currentProvider.serviceRadiusKm || 6} km</dd></div>
            <div className="border-t border-[var(--mazzi-border)] pt-3">
              <dt className="text-slate-500">Biografia</dt>
              <dd className="mt-1.5 leading-relaxed text-slate-900">{currentProvider.bio || 'Nenhuma biografia cadastrada.'}</dd>
            </div>
          </dl>
        ) : (
          <form className="mt-4 space-y-4" onSubmit={(event) => { event.preventDefault(); onSaveProfile(); }}>
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

            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-700" htmlFor="provider-profile-name">Nome de exibição *</label>
              <Input
                id="provider-profile-name"
                className="rounded-2xl"
                value={profileForm.displayName}
                onChange={(e) => onProfileFormChange({ ...profileForm, displayName: e.target.value })}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-700" htmlFor="provider-profile-contact">WhatsApp / contato público</label>
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

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-700" htmlFor="provider-profile-neighborhood">Bairro / região</label>
                <Input
                  id="provider-profile-neighborhood"
                  className="rounded-2xl"
                  value={profileForm.neighborhood}
                  onChange={(e) => onProfileFormChange({ ...profileForm, neighborhood: e.target.value })}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-700" htmlFor="provider-profile-city">Cidade</label>
                <Input
                  id="provider-profile-city"
                  className="rounded-2xl"
                  value={profileForm.city}
                  onChange={(e) => onProfileFormChange({ ...profileForm, city: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-700" htmlFor="provider-profile-radius">Raio de atendimento (km)</label>
              <Input
                id="provider-profile-radius"
                className="rounded-2xl"
                type="number"
                min={1}
                max={100}
                value={profileForm.serviceRadiusKm}
                onChange={(e) => onProfileFormChange({ ...profileForm, serviceRadiusKm: Number(e.target.value) })}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-700" htmlFor="provider-profile-bio">Biografia e diferenciais</label>
              <textarea
                id="provider-profile-bio"
                rows={4}
                value={profileForm.bio}
                onChange={(e) => onProfileFormChange({ ...profileForm, bio: e.target.value })}
                className="w-full rounded-2xl border border-[var(--mazzi-border)] px-3.5 py-2.5 text-sm leading-relaxed text-[var(--mazzi-dark)] transition focus:border-[var(--mazzi-yellow)] focus:outline-none focus:ring-2 focus:ring-[var(--mazzi-focus-glow)]"
                placeholder="Descreva sua experiência, paciência com alunos iniciantes e diferenciais..."
              />
            </div>

            <div className="flex items-center gap-2.5 pt-2">
              <Button type="button" variant="dangerSoft" size="sm" className="w-1/2" onClick={onToggleEditProfile}>
                Cancelar
              </Button>
              <PrimaryButton type="submit" size="sm" className="min-h-11 w-1/2 font-bold shadow-xs" leftIcon={<Save className="h-4 w-4" aria-hidden="true" />}>
                Salvar perfil
              </PrimaryButton>
            </div>
          </form>
        )}
      </div>

      {/* Logout: same quiet footer action as Student */}
      <div className="border-t border-[var(--mazzi-border)] pt-4">
        <Button variant="ghost" size="sm" className="w-full font-bold text-rose-700 hover:bg-rose-50" onClick={onLogout}>
          Sair
        </Button>
      </div>
    </div>
  );
};
