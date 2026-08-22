// ============================================================================
// MAZZI PLATFORM — SPRINT 12: GOVERNANCE & OPERATIONS ADMIN CONTROL PANEL
// File: src/apps/admin/AdminApp.tsx
// ============================================================================

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../components/auth/AuthContext';
import {
  BarChart3, Bell, CalendarDays, Car, LayoutDashboard, LogOut, Pencil, ScrollText, Settings, ShieldCheck, UserCheck, UserRound, Users, WalletCards, RefreshCw, } from 'lucide-react';
import { Button, ButtonBase } from '../../components/ui/Button';
import { dbService } from '../../lib/db-service';
import {
  Provider,
  ComplianceDocument,
  Vehicle,
  Booking,
  AuditLog,
  User,
  UserRole,
} from '../../types';
import {
  DEFAULT_PLATFORM_CONFIGURATION,
  PlatformConfiguration,
} from '../../domain/platform-config';
import { AuthContext } from '../../domain/rbac';
import {
  evaluateProviderEligibility,
  DEFAULT_COMPLIANCE_REQUIREMENTS,
} from '../../domain/compliance';

// Modular components import
import {
  DashboardTab,
  ProvidersTab,
  ComplianceTab,
  VehiclesTab,
  BookingsTab,
  FinancialTab,
  UsersTab,
  AuditTab,
  SettingsTab,
} from './AdminComponents';
import { AdminAnalyticsPanel } from '../../components/analytics/AnalyticsPanels';
import { ProfilePhotoPicker } from '../../components/profile/ProfilePhotoPicker';
import { getMyProfileAvatar } from '../../lib/profile-avatar';
import { ContentSkeleton } from '../../components/ui/ContentSkeleton';
import { NotificationIndicator } from '../../components/ui/NotificationIndicator';
import { NotificationsPanel } from '../../components/notifications/NotificationsPanel';
import { Modal } from '../../components/ui/Modal';

export const AdminApp: React.FC = () => {
  const { user, logout } = useAuth();
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [profileAvatar, setProfileAvatar] = useState<string | undefined>();
  const [profileError, setProfileError] = useState<string | null>(null);

  useEffect(() => {
    setProfileAvatar(user?.avatarUrl);
    if (user?.id) {
      void getMyProfileAvatar().then((avatarUrl) => setProfileAvatar(avatarUrl)).catch(() => undefined);
    }
  }, [user?.avatarUrl]);

  const handleSaveProfilePhoto = async () => {
    if (!user) return;
    setProfileError(null);
    try {
      await dbService.updateMyProfile(user.name, user.phone || '', profileAvatar);
      setIsEditingProfile(false);
    } catch (error: any) {
      setProfileError(error?.message || 'Não foi possível salvar a foto do perfil.');
    }
  };

  // Navigation State
  const [activeTab, setActiveTab] = useState<string>('dashboard');

  // Core Data States
  const [providers, setProviders] = useState<Provider[]>([]);
  const [complianceDocs, setComplianceDocs] = useState<ComplianceDocument[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [platformConfig, setPlatformConfig] = useState<PlatformConfiguration>(DEFAULT_PLATFORM_CONFIGURATION);
  const [isLoadingRealData, setIsLoadingRealData] = useState(true);
  const [isRefreshingRealData, setIsRefreshingRealData] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const refreshAdminDataRef = useRef<() => void>(() => undefined);

  // Active Session Toggle (Interactive testing for PLATFORM_ADMIN vs SUPPORT)
  const [currentRole, setCurrentRole] = useState<UserRole>('PLATFORM_ADMIN');

  useEffect(() => {
    if (user?.roles && user.roles.length > 0) {
      setCurrentRole(user.roles[0]);
    }
  }, [user]);

  // Load live data from Supabase
  useEffect(() => {
    async function loadRealData(isRefresh = false) {
      if (isRefresh) setIsRefreshingRealData(true);
      else setIsLoadingRealData(true);
      setLoadError(null);
      try {
        const [p, v, b, c, a, configs, u] = await Promise.all([
          dbService.getProviders().catch((err) => {
            console.warn('AdminApp: could not load providers', err);
            return [];
          }),
          dbService.getVehicles().catch((err) => {
            console.warn('AdminApp: could not load vehicles', err);
            return [];
          }),
          dbService.getBookings().catch((err) => {
            console.warn('AdminApp: could not load bookings', err);
            return [];
          }),
          dbService.getComplianceDocs().catch((err) => {
            console.warn('AdminApp: could not load compliance docs', err);
            return [];
          }),
          dbService.getAuditLogs().catch((err) => {
            console.warn('AdminApp: could not load audit logs', err);
            return [];
          }),
          dbService.getPlatformConfigs().catch((err) => {
            console.warn('AdminApp: could not load platform configs', err);
            return [];
          }),
          dbService.getUsers().catch((err) => {
            console.warn('AdminApp: could not load users', err);
            return [];
          }),
        ]);
        setProviders(p);
        setVehicles(v);
        setBookings(b);
        setComplianceDocs(c);
        setAuditLogs(a);
        setUsers(u);
        
        if (configs.length > 0) {
          const mappedConfig = { ...DEFAULT_PLATFORM_CONFIGURATION };
          for (const item of configs) {
            if (item.key === 'platform_fees' && item.value?.default_percentage !== undefined) mappedConfig.platformFeeDefaultPercentage = Number(item.value.default_percentage);
            if (item.key === 'quote_settings' && item.value?.expiration_minutes !== undefined) mappedConfig.quoteExpirationMinutes = Number(item.value.expiration_minutes);
            if (item.key === 'scheduling_settings' && item.value?.max_booking_horizon_days !== undefined) mappedConfig.availabilityHorizonDays = Number(item.value.max_booking_horizon_days);
            if (item.key === 'platform_operations') {
              if (item.value?.minimum_notice_hours !== null && item.value?.minimum_notice_hours !== undefined) mappedConfig.minimumBookingNoticeHours = Number(item.value.minimum_notice_hours);
              if (item.value?.payout_safety_period_hours !== null && item.value?.payout_safety_period_hours !== undefined) mappedConfig.payoutSafetyPeriodHours = Number(item.value.payout_safety_period_hours);
              if (item.value?.search_radius_km !== null && item.value?.search_radius_km !== undefined) mappedConfig.searchRadiusDefaultsKm = Number(item.value.search_radius_km);
            }
          }
          setPlatformConfig(mappedConfig);
        }
      } catch (err: any) {
        console.error('Failed to load live database state in AdminApp:', err);
        setLoadError(err?.message || 'Falha ao carregar dados reais do Supabase para o Admin.');
      } finally {
        if (isRefresh) setIsRefreshingRealData(false);
        else setIsLoadingRealData(false);
      }
    }
    refreshAdminDataRef.current = () => { void loadRealData(true); };
    void loadRealData();
  }, [user]);

  // Resolved Session Context
  const activeActor: AuthContext = {
    userId: user?.id || 'AUTH_REQUIRED',
    email: user?.email || 'auth-required@mazzi.local',
    roles: [currentRole],
    status: 'ACTIVE',
  };

  // Helper eligibility evaluator
  const handleEligibilityCheck = (provider: Provider, docs: ComplianceDocument[]) => {
    return evaluateProviderEligibility(provider, docs, DEFAULT_COMPLIANCE_REQUIREMENTS);
  };

  const blockPendingAdminMutation = (action: string) => {
    alert(
      `${action} bloqueado na Sprint 12: esta operação precisa de RPC/endpoint transacional com RBAC, auditoria e persistência real no Supabase.`
    );
  };

  // ==========================================================================
  // PROVIDER STATE TRANSITIONS HANDLERS
  // ==========================================================================
  const handleApproveProvider = (_p: Provider) => {
    blockPendingAdminMutation('Aprovação de prestador');
  };

  const handleRejectProvider = (_p: Provider, _reason: string) => {
    blockPendingAdminMutation('Rejeição de prestador');
  };

  const handleSuspendProvider = (_p: Provider, _reason: string) => {
    blockPendingAdminMutation('Suspensão de prestador');
  };

  const handleBlockProvider = (_p: Provider, _reason: string) => {
    blockPendingAdminMutation('Bloqueio de prestador');
  };

  // ==========================================================================
  // COMPLIANCE DOCUMENTS HANDLERS
  // ==========================================================================
  const handleApproveDoc = async (doc: ComplianceDocument) => {
    try {
      const updatedDoc = await dbService.reviewComplianceDocument(doc.id, 'APPROVED');
      setComplianceDocs((current) => current.map((item) => item.id === updatedDoc.id ? updatedDoc : item));
    } catch (error: any) {
      console.error('Admin document approval failed:', error);
      alert(`Não foi possível aprovar o documento: ${error?.message || 'erro desconhecido'}`);
    }
  };

  const handleRejectDoc = async (doc: ComplianceDocument, reason: string) => {
    try {
      const updatedDoc = await dbService.reviewComplianceDocument(doc.id, 'REJECTED', reason);
      setComplianceDocs((current) => current.map((item) => item.id === updatedDoc.id ? updatedDoc : item));
    } catch (error: any) {
      console.error('Admin document rejection failed:', error);
      alert(`Não foi possível rejeitar o documento: ${error?.message || 'erro desconhecido'}`);
    }
  };

  // ==========================================================================
  // VEHICLE TRANSITION HANDLERS
  // ==========================================================================
  const handleApproveVehicle = async (vehicle: Vehicle) => {
    try {
      const updatedVehicle = await dbService.reviewVehicle(vehicle.id, 'ACTIVE');
      setVehicles((current) => current.map((item) => item.id === updatedVehicle.id ? updatedVehicle : item));
    } catch (error: any) {
      console.error('Admin vehicle approval failed:', error);
      alert(`Não foi possível aprovar o veículo: ${error?.message || 'erro desconhecido'}`);
    }
  };

  const handleRejectVehicle = async (vehicle: Vehicle, reason: string) => {
    try {
      const updatedVehicle = await dbService.reviewVehicle(vehicle.id, 'INACTIVE', reason);
      setVehicles((current) => current.map((item) => item.id === updatedVehicle.id ? updatedVehicle : item));
    } catch (error: any) {
      console.error('Admin vehicle rejection failed:', error);
      alert(`Não foi possível reprovar o veículo: ${error?.message || 'erro desconhecido'}`);
    }
  };

  const handleBlockVehicle = async (vehicle: Vehicle, reason: string) => {
    try {
      const updatedVehicle = await dbService.reviewVehicle(vehicle.id, 'BLOCKED', reason);
      setVehicles((current) => current.map((item) => item.id === updatedVehicle.id ? updatedVehicle : item));
    } catch (error: any) {
      console.error('Admin vehicle block failed:', error);
      alert(`Não foi possível bloquear o veículo: ${error?.message || 'erro desconhecido'}`);
    }
  };

  // ==========================================================================
  // REFUND HANDLER
  // ==========================================================================
  const handleProcessRefund = (_b: Booking) => {
    blockPendingAdminMutation('Estorno administrativo');
  };

  // ==========================================================================
  // USER ROLE MANAGEMENT HANDLER
  // ==========================================================================
  const handleChangeRole = (_userId: string, _newRole: UserRole) => {
    blockPendingAdminMutation('Alteração de papel de usuário');
  };

  // ==========================================================================
  // PLATFORM CONFIGURATION UPDATE HANDLER
  // ==========================================================================
  const handleUpdateConfig = async (updates: Partial<PlatformConfiguration>) => {
    try {
      const persistedUpdates = Object.fromEntries(
        Object.entries(updates).filter(([, value]) => typeof value === 'number'),
      ) as Record<string, number>;
      await dbService.updatePlatformConfigs(persistedUpdates);
      setPlatformConfig((current) => ({
        ...current,
        ...updates,
        updatedAt: new Date().toISOString(),
        updatedBy: user?.email || current.updatedBy,
      }));
      alert('Parâmetros globais atualizados com sucesso.');
    } catch (error: any) {
      console.error('Admin platform configuration update failed:', error);
      alert(`Não foi possível salvar os parâmetros: ${error?.message || 'erro desconhecido'}`);
    }
  };

  return (
    <div className="min-h-[100dvh] w-full bg-[var(--mazzi-bg)] text-[var(--mazzi-text)] md:grid md:grid-cols-[248px_1fr] md:grid-rows-[92px_1fr]">
      {/* Top Main Navigation Header */}
      <header className="flex items-center bg-[var(--mazzi-dark)] px-6 text-white md:col-start-1 md:row-start-1">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-400 to-amber-500 text-slate-950 font-black flex items-center justify-center text-xl shadow-md border border-amber-300/20">
            M
          </div>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <span className="text-base font-black tracking-tight text-white">MAZZI</span>
              <span className="text-[10px] font-bold uppercase tracking-[.15em] text-[var(--mazzi-yellow)]">Admin</span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">Operação do marketplace</p>
          </div>
        </div>
        <ButtonBase
          type="button"
          onClick={() => refreshAdminDataRef.current()}
          disabled={isRefreshingRealData}
          aria-label="Atualizar dados do Admin"
          title="Atualizar dados do Admin"
          className="ml-auto grid h-11 w-11 place-items-center rounded-2xl bg-white/10 text-white hover:bg-white/15 disabled:opacity-50"
        >
          <RefreshCw className={`h-5 w-5 ${isRefreshingRealData ? 'animate-spin' : ''}`} aria-hidden="true" />
        </ButtonBase>
        <ButtonBase
          type="button"
          onClick={() => setIsNotificationsOpen(true)}
          aria-label="Abrir notificações"
          title="Notificações"
          className="grid h-11 w-11 place-items-center rounded-2xl bg-white/10 text-white hover:bg-white/15"
        >
          <NotificationIndicator className="h-full w-full items-center justify-center">
            <Bell className="h-5 w-5" aria-hidden="true" />
          </NotificationIndicator>
        </ButtonBase>

      </header>

      {/* Tabs Menu Subheader */}
      <aside className="flex gap-1 overflow-x-auto bg-[var(--mazzi-dark)] px-4 pb-4 md:col-start-1 md:row-start-2 md:flex-col md:overflow-visible">
        {[
          { id: 'dashboard', label: 'Visão Geral', icon: LayoutDashboard },
          { id: 'providers', label: 'Prestadores', icon: UserCheck, count: providers.filter((p) => p.status === 'PENDING_REVIEW').length },
          { id: 'compliance', label: 'Compliance', icon: ShieldCheck, count: complianceDocs.filter((d) => d.status === 'UNDER_REVIEW').length },
          { id: 'vehicles', label: 'Veículos', icon: Car, count: vehicles.filter((v) => v.status === 'UNDER_REVIEW').length },
          { id: 'bookings', label: 'Reservas', icon: CalendarDays },
          { id: 'financial', label: 'Financeiro', icon: WalletCards },
          { id: 'analytics', label: 'Analytics', icon: BarChart3 },
          { id: 'users', label: 'Usuários & Papéis', icon: Users },
          { id: 'audit', label: 'Auditoria', icon: ScrollText },
          { id: 'settings', label: 'Configurações', icon: Settings },
          { id: 'profile', label: 'Perfil', icon: UserRound },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <ButtonBase
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 ${
                isActive
                  ? 'bg-[var(--mazzi-yellow)] text-[var(--mazzi-dark)]'
                  : 'text-slate-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <tab.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${isActive ? 'bg-amber-400 text-slate-950' : 'bg-rose-100 text-rose-700'}`}>
                  {tab.count}
                </span>
              )}
            </ButtonBase>
          );
        })}
      </aside>

      {/* App Workspace */}
      <main className="w-full p-6 md:col-start-2 md:row-span-2 md:row-start-1 md:p-10">
        {activeTab !== 'profile' && <div className="mb-8"><p className="mazzi-eyebrow mb-2">MAZZI Admin</p><h1 className="text-3xl font-extrabold tracking-[-.04em]">{activeTab === 'dashboard' ? 'Visão geral' : 'Operação'}</h1></div>}
        {isLoadingRealData && !isRefreshingRealData && (
          <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-600">
            Carregando dados reais do Supabase...
          </div>
        )}
        {isRefreshingRealData && <ContentSkeleton mode={activeTab === 'profile' ? 'object' : 'list'} label="Atualizando dados do Admin" />}

        {loadError && (
          <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800">
            Falha ao carregar Admin real: {loadError}
          </div>
        )}

        {!isRefreshingRealData && activeTab === 'dashboard' && (
          <DashboardTab
            providers={providers}
            complianceDocs={complianceDocs}
            vehicles={vehicles}
            bookings={bookings}
            auditLogs={auditLogs}
            onNavigate={(target) => setActiveTab(target)}
          />
        )}

        {!isRefreshingRealData && activeTab === 'providers' && (
          <ProvidersTab
            providers={providers}
            complianceDocs={complianceDocs}
            vehicles={vehicles}
            auditLogs={auditLogs}
            actor={activeActor}
            onApprove={handleApproveProvider}
            onReject={handleRejectProvider}
            onSuspend={handleSuspendProvider}
            onBlock={handleBlockProvider}
            eligibilityChecker={handleEligibilityCheck}
          />
        )}

        {!isRefreshingRealData && activeTab === 'compliance' && (
          <ComplianceTab
            complianceDocs={complianceDocs}
            actor={activeActor}
            onApproveDoc={handleApproveDoc}
            onRejectDoc={handleRejectDoc}
          />
        )}

        {!isRefreshingRealData && activeTab === 'vehicles' && (
          <VehiclesTab
            vehicles={vehicles}
            providers={providers}
            onApproveVehicle={handleApproveVehicle}
            onRejectVehicle={handleRejectVehicle}
            onBlockVehicle={handleBlockVehicle}
          />
        )}

        {!isRefreshingRealData && activeTab === 'bookings' && (
          <BookingsTab
            bookings={bookings}
            auditLogs={auditLogs}
          />
        )}

        {!isRefreshingRealData && activeTab === 'financial' && (
          <FinancialTab
            bookings={bookings}
            auditLogs={auditLogs}
            actor={activeActor}
            onProcessRefund={handleProcessRefund}
          />
        )}

        {!isRefreshingRealData && activeTab === 'analytics' && (
          <AdminAnalyticsPanel />
        )}

        {!isRefreshingRealData && activeTab === 'users' && (
          <UsersTab
            users={users}
            actor={activeActor}
            onChangeRole={handleChangeRole}
          />
        )}

        {!isRefreshingRealData && activeTab === 'audit' && (
          <AuditTab
            auditLogs={auditLogs}
          />
        )}

        {!isRefreshingRealData && activeTab === 'settings' && (
          <SettingsTab
            config={platformConfig}
            actor={activeActor}
            onUpdateConfig={handleUpdateConfig}
          />
        )}

        {!isRefreshingRealData && activeTab === 'profile' && (
          <section className="max-w-xl space-y-5 text-left">
            <header className="flex items-start justify-between gap-4 pt-0">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--mazzi-muted)]">Sua conta</p>
                <h2 className="mt-1 text-2xl font-extrabold leading-tight tracking-[-0.03em] text-[var(--mazzi-dark)] sm:text-[32px]">Meu Perfil</h2>
              </div>
              {!isEditingProfile && <ButtonBase type="button" onClick={() => setIsEditingProfile(true)} aria-label="Editar perfil" title="Editar perfil" className="mazzi-icon-button"><Pencil className="h-5 w-5" aria-hidden="true" /></ButtonBase>}
            </header>

            <div className="rounded-3xl border border-[var(--mazzi-border)] bg-white p-5 shadow-xs">
              <div className="flex flex-col items-center gap-4 border-b border-[var(--mazzi-border)] pb-6 text-center">
                {isEditingProfile ? <ProfilePhotoPicker value={profileAvatar} name={user?.name} onChange={setProfileAvatar} /> : <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-[28px] border border-[var(--mazzi-border)] bg-[var(--mazzi-yellow)] text-2xl font-bold text-[var(--mazzi-dark)] shadow-[var(--mazzi-shadow)]">{profileAvatar ? <img src={profileAvatar} alt="Foto do perfil" className="h-full w-full object-cover" /> : (user?.name || 'Admin').split(/\s+/).map((n) => n[0]).slice(0, 2).join('').toUpperCase()}</div>}
                <div className="space-y-1">
                  <h3 className="text-2xl font-bold tracking-[-0.02em] text-[var(--mazzi-dark)]">{user?.name || 'Nome não informado'}</h3>
                  <p className="text-sm text-[var(--mazzi-muted)]">{user?.email || 'E-mail não informado'}</p>
                </div>
              </div>
              {profileError && <p role="alert" className="mt-4 text-xs font-semibold text-rose-700">{profileError}</p>}
              <div className="mt-5 rounded-2xl border border-[var(--mazzi-border)] bg-white p-1">
                <h4 className="px-3 pt-2 text-sm font-bold text-[var(--mazzi-dark)]">Dados do perfil</h4>
                <dl className="space-y-3 p-3 text-sm">
                  <div className="flex items-center justify-between gap-3"><dt className="text-slate-500">Nome</dt><dd className="font-semibold text-slate-900">{user?.name || 'Não informado'}</dd></div>
                  <div className="flex items-center justify-between gap-3"><dt className="text-slate-500">E-mail</dt><dd className="truncate font-semibold text-slate-900">{user?.email || 'Não informado'}</dd></div>
                  <div className="flex items-center justify-between gap-3"><dt className="text-slate-500">Perfil</dt><dd className="font-semibold text-slate-900">{user?.roles?.[0] || 'Não informado'}</dd></div>
                </dl>
              </div>
              {isEditingProfile && <div className="flex items-center gap-2.5 pt-5"><Button variant="dangerSoft" size="sm" className="w-1/2" onClick={() => { setProfileAvatar(user?.avatarUrl); setIsEditingProfile(false); }}>Cancelar</Button><Button variant="primary" size="sm" className="w-1/2" onClick={() => void handleSaveProfilePhoto()}>Salvar foto</Button></div>}
            </div>

            {!isEditingProfile && <div className="border-t border-[var(--mazzi-border)] pt-4"><Button variant="ghost" size="sm" className="w-full font-bold text-rose-700 hover:bg-rose-50" onClick={() => { void logout(); }} leftIcon={<LogOut className="w-4 h-4" />}>Sair</Button></div>}
          </section>
        )}
      </main>
      <Modal isOpen={isNotificationsOpen} onClose={() => setIsNotificationsOpen(false)} title="Notificações MAZZI Admin">
        <NotificationsPanel />
      </Modal>
    </div>
  );
};

