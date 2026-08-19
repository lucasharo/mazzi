import React from 'react';
import {
  User,
  ShieldCheck,
  MapPin,
  Phone,
  Pencil,
  Save,
  LogOut,
  Building2,
  UserCheck,
  CheckCircle2,
  Sliders,
} from 'lucide-react';
import { Provider, UserRole } from '../../../types';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { ProfilePhotoPicker } from '../../../components/profile/ProfilePhotoPicker';

import { maskBrazilianPhone } from '../../../lib/input-masks';

interface ProviderProfileTabProps {
  currentProvider: Provider;
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

  return (
    <div className="space-y-6 text-left">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="mazzi-eyebrow mb-1">Perfil Profissional</p>
          <h2 className="mazzi-title">Suas informações</h2>
        </div>

        <Button
          variant={isEditingProfile ? 'secondary' : 'outline'}
          size="sm"
          onClick={onToggleEditProfile}
          leftIcon={<Pencil className="w-3.5 h-3.5" />}
        >
          {isEditingProfile ? 'Cancelar Edição' : 'Editar Perfil'}
        </Button>
      </div>

      {/* Main Profile Card */}
      <div className="p-6 rounded-3xl bg-white border border-[#e9e6de] shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 pb-6 border-b border-slate-100">
          {/* Avatar with Photo Picker */}
          <div className="relative shrink-0">
            {onAvatarChange ? (
              <ProfilePhotoPicker
                currentAvatarUrl={profileAvatar}
                onPhotoUploaded={onAvatarChange}
                size="lg"
              />
            ) : (
              <div className="h-20 w-20 rounded-2xl bg-linear-to-br from-[#ffe797] to-[#f6c945] text-[#202126] font-black text-2xl flex items-center justify-center shadow-md">
                {currentProvider.name.split(/\s+/).map((n) => n[0]).slice(0, 2).join('').toUpperCase()}
              </div>
            )}
          </div>

          <div className="space-y-1.5 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-xl font-black text-slate-900">{currentProvider.name}</h3>
              <StatusBadge status={currentProvider.status} />
              {currentProvider.isVerified && (
                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                  Credenciado
                </span>
              )}
            </div>

            <p className="text-xs font-bold text-slate-600 flex items-center gap-2">
              <span className="flex items-center gap-1 text-[#202126]">
                {isSchool ? <Building2 className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                {isSchool ? 'Autoescola / CFC' : 'Instrutor Autônomo'}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                {currentProvider.neighborhood || 'Pinheiros'}, {currentProvider.city || 'São Paulo'} - {currentProvider.state || 'SP'}
              </span>
            </p>

            <p className="text-xs text-slate-500 font-medium pt-0.5">
              Raio de Atendimento Público: <strong className="text-slate-900">{currentProvider.serviceRadiusKm || 6} km</strong>
            </p>
          </div>
        </div>

        {/* Profile Content / Edit Form */}
        {!isEditingProfile ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                <span className="font-extrabold uppercase tracking-wider text-slate-400 block text-[10px]">
                  Contato Público (WhatsApp)
                </span>
                <p className="font-extrabold text-slate-900 text-sm">
                  {maskBrazilianPhone(currentProvider.publicContact || userPhone || '') || 'Não informado'}
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                <span className="font-extrabold uppercase tracking-wider text-slate-400 block text-[10px]">
                  E-mail de Login
                </span>
                <p className="font-extrabold text-slate-900 text-sm">{userEmail || 'Não informado'}</p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-1">
              <span className="font-extrabold uppercase tracking-wider text-slate-400 block text-[10px]">
                Biografia & Metodologia
              </span>
              <p className="text-slate-700 leading-relaxed font-medium">
                {currentProvider.bio || 'Nenhuma biografia cadastrada no momento. Clique em Editar para descrever sua didática aos alunos.'}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-extrabold text-slate-900 block mb-1">Nome de Exibição *</label>
                <Input
                  value={profileForm.displayName}
                  onChange={(e) => onProfileFormChange({ ...profileForm, displayName: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-extrabold text-slate-900 block mb-1">WhatsApp / Contato Público</label>
                <Input
                  value={maskBrazilianPhone(profileForm.publicContact)}
                  onChange={(e) => onProfileFormChange({ ...profileForm, publicContact: maskBrazilianPhone(e.target.value) })}
                  placeholder="(11) 90000-0000"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-extrabold text-slate-900 block mb-1">Bairro / Região</label>
                <Input
                  value={profileForm.neighborhood}
                  onChange={(e) => onProfileFormChange({ ...profileForm, neighborhood: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-extrabold text-slate-900 block mb-1">Cidade</label>
                <Input
                  value={profileForm.city}
                  onChange={(e) => onProfileFormChange({ ...profileForm, city: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-extrabold text-slate-900 block mb-1">Raio de Atendimento (km)</label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={profileForm.serviceRadiusKm}
                  onChange={(e) => onProfileFormChange({ ...profileForm, serviceRadiusKm: Number(e.target.value) })}
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-extrabold text-slate-900 block mb-1">Biografia & Diferenciais</label>
              <textarea
                rows={4}
                value={profileForm.bio}
                onChange={(e) => onProfileFormChange({ ...profileForm, bio: e.target.value })}
                className="w-full text-xs p-3 rounded-2xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-[#202126]"
                placeholder="Descreva sua experiência, paciência com alunos iniciantes e diferenciais..."
              />
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t border-slate-200">
              <Button variant="secondary" size="sm" onClick={onToggleEditProfile}>
                Cancelar
              </Button>
              <Button variant="primary" size="sm" onClick={onSaveProfile} leftIcon={<Save className="w-4 h-4" />}>
                Salvar Alterações
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Logout Action Card */}
      <div className="p-4 rounded-2xl bg-white border border-[#e9e6de] shadow-xs flex items-center justify-between">
        <div>
          <h4 className="text-sm font-extrabold text-slate-900">Encerrar Sessão</h4>
          <p className="text-xs text-slate-500">Sair da sua conta MAZZI Pro com segurança</p>
        </div>
        <Button variant="danger" size="sm" onClick={onLogout} leftIcon={<LogOut className="w-4 h-4" />}>
          Sair da Conta
        </Button>
      </div>
    </div>
  );
};
