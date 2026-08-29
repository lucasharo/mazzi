// ============================================================================
// MAZZI PLATFORM — SPRINT 12: GOVERNANCE & OPERATIONS ADMIN CONTROL PANEL
// File: src/apps/admin/AdminApp.tsx
// ============================================================================

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../components/auth/AuthContext';
import {
  AlertTriangle, BarChart3, Calendar, Car, CreditCard, LayoutDashboard, LogOut, Pencil, ScrollText, Settings, ShieldCheck, UserCheck, UserRound, Users, WalletCards, RefreshCw, } from 'lucide-react';
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
  Payout,
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
import { isVehicleAwaitingAdminReview } from '../../domain/vehicles-offerings';

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
import { ContentSkeleton, ContentSkeletonMode } from '../../components/ui/ContentSkeleton';
import { Modal } from '../../components/ui/Modal';
import { ToastContainer, ToastMessage } from '../../components/ui/Toast';
import { getFriendlyAdminError } from '../../domain/status-presentation';
import { getUserRoleLabel } from '../../domain/status-presentation';
import { useMobileAppRoute } from '../../lib/mobile-app-router';
import { getCheckoutGatewayProvider } from '../../lib/payment-gateway-config';
import { formatCentsToBRL } from '../../domain/money';
import { formatDateBR, formatTimeBR } from '../../lib/date-format';

const getAdminSkeletonMode = (tab: string): ContentSkeletonMode => {
  if (tab === 'dashboard') return 'dashboard';
  if (tab === 'bookings' || tab === 'financial') return 'split';
  if (tab === 'analytics') return 'analytics';
  if (tab === 'settings') return 'form';
  if (tab === 'profile') return 'object';
  return 'list';
};

export const AdminApp: React.FC = () => {
  const { user, logout } = useAuth();
  const isProductionEnvironment = Boolean(import.meta.env.PROD && import.meta.env.VITE_APP_ENV !== 'development');
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileAvatar, setProfileAvatar] = useState<string | undefined>();
  const [savedProfileAvatar, setSavedProfileAvatar] = useState<string | undefined>();
  const [profileError, setProfileError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [refundCandidate, setRefundCandidate] = useState<Booking | null>(null);
  const [isRefundSubmitting, setIsRefundSubmitting] = useState(false);

  const showFeedback = (type: ToastMessage['type'], title: string, description?: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setToasts((current) => [...current, { id, type, title, description }]);
    window.setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 5000);
  };

  useEffect(() => {
    setProfileAvatar(user?.avatarUrl);
    setSavedProfileAvatar(user?.avatarUrl);
    if (user?.id) {
      void getMyProfileAvatar().then((avatarUrl) => {
        setProfileAvatar(avatarUrl);
        setSavedProfileAvatar(avatarUrl);
      }).catch(() => undefined);
    }
  }, [user?.avatarUrl]);

  const handleSaveProfilePhoto = async () => {
    if (!user) return;
    setProfileError(null);
    try {
      await dbService.updateMyProfile(user.name, user.phone || '', profileAvatar);
      setSavedProfileAvatar(profileAvatar);
      setIsEditingProfile(false);
    } catch (error: any) {
      setProfileError(error?.message || 'Não foi possível salvar a foto do perfil.');
    }
  };

  // Navigation State
  const [activeTab, setActiveTab] = useMobileAppRoute('admin', 'dashboard', ['dashboard', 'providers', 'compliance', 'vehicles', 'bookings', 'financial', 'analytics', 'users', 'audit', 'settings', 'profile']);
  const activeSkeletonMode = getAdminSkeletonMode(activeTab);

  const navigateAdminTab = (tab: string) => {
    setActiveTab(tab as typeof activeTab);
  };

  // Core Data States
  const [providers, setProviders] = useState<Provider[]>([]);
  const [complianceDocs, setComplianceDocs] = useState<ComplianceDocument[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [platformConfig, setPlatformConfig] = useState<PlatformConfiguration>(DEFAULT_PLATFORM_CONFIGURATION);
  const [isLoadingRealData, setIsLoadingRealData] = useState(true);
  const [isRefreshingRealData, setIsRefreshingRealData] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const refreshAdminDataRef = useRef<() => void>(() => undefined);

  // Load once per authenticated session. Subsequent reloads are intentionally
  // initiated only by the refresh control in the header.
  useEffect(() => {
    async function loadRealData(isRefresh = false) {
      if (isRefresh) setIsRefreshingRealData(true);
      else setIsLoadingRealData(true);
      setLoadError(null);
      try {
        const [p, v, b, c, a, configs, u, payoutRows] = await Promise.all([
          dbService.getProviders(),
          dbService.getVehicles(),
          dbService.getAdminBookings(),
          dbService.getAdminComplianceDocs(),
          dbService.getAuditLogs(),
          dbService.getPlatformConfigs(),
          dbService.getUsers(),
          dbService.getAdminPayouts(),
        ]);
        setProviders(p);
        setVehicles(v);
        setBookings(b);
        setComplianceDocs(c);
        setAuditLogs(a);
        setUsers(u);
        setPayouts(payoutRows);
        
        if (configs.length > 0) {
          const mappedConfig = { ...DEFAULT_PLATFORM_CONFIGURATION };
          for (const item of configs) {
            if (item.key === 'platform_fees') {
              if (item.value?.default_percentage !== undefined) mappedConfig.platformFeeDefaultPercentage = Number(item.value.default_percentage);
              if (item.value?.mercadopago_fee_percentage !== undefined) mappedConfig.mercadoPagoFeePercentage = Number(item.value.mercadopago_fee_percentage);
              if (item.value?.max_total_fee_percentage !== undefined) mappedConfig.maxTotalFeePercentage = Number(item.value.max_total_fee_percentage);
            }
            if (item.key === 'quote_settings' && item.value?.expiration_minutes !== undefined) mappedConfig.quoteExpirationMinutes = Number(item.value.expiration_minutes);
            if (item.key === 'scheduling_settings' && item.value?.max_booking_horizon_days !== undefined) mappedConfig.availabilityHorizonDays = Number(item.value.max_booking_horizon_days);
            if (item.key === 'platform_operations') {
              if (item.value?.minimum_notice_hours !== null && item.value?.minimum_notice_hours !== undefined) mappedConfig.minimumBookingNoticeHours = Number(item.value.minimum_notice_hours);
              if (item.value?.payout_safety_period_hours !== null && item.value?.payout_safety_period_hours !== undefined) mappedConfig.payoutSafetyPeriodHours = Number(item.value.payout_safety_period_hours);
              if (item.value?.search_radius_km !== null && item.value?.search_radius_km !== undefined) mappedConfig.searchRadiusDefaultsKm = Number(item.value.search_radius_km);
              if (item.value?.checkin_window_before_minutes !== null && item.value?.checkin_window_before_minutes !== undefined) mappedConfig.checkInWindowBeforeMinutes = Number(item.value.checkin_window_before_minutes);
            }
          }
          setPlatformConfig(mappedConfig);
        }
      } catch (err: any) {
        console.error('Failed to load live database state in AdminApp:', err);
        setLoadError(isRefresh
          ? 'Não foi possível atualizar os dados agora. As informações anteriores continuam disponíveis.'
          : 'Não foi possível carregar os dados administrativos agora. Tente novamente em instantes.');
      } finally {
        if (isRefresh) setIsRefreshingRealData(false);
        else setIsLoadingRealData(false);
      }
    }
    refreshAdminDataRef.current = () => { void loadRealData(true); };
    void loadRealData();
  }, [user?.id]);

  // Resolved Session Context
  const activeActor: AuthContext = {
    userId: user?.id || 'AUTH_REQUIRED',
    email: user?.email || 'auth-required@mazzi.local',
    roles: user?.roles || [],
    status: user?.status || 'ACTIVE',
  };

  // Helper eligibility evaluator
  const handleEligibilityCheck = (provider: Provider, docs: ComplianceDocument[]) => {
    return evaluateProviderEligibility(provider, docs, DEFAULT_COMPLIANCE_REQUIREMENTS);
  };

  // ==========================================================================
  // PROVIDER STATE TRANSITIONS HANDLERS
  // ==========================================================================
  const handleApproveProvider = async (p: Provider) => {
    try {
      const updated = await dbService.reviewProvider(p.id, 'ACTIVE');
      setProviders((current) => current.map((item) => item.id === updated.id ? updated : item));
    } catch (error: any) {
      showFeedback('error', 'Não foi possível aprovar o prestador', getFriendlyAdminError(error, 'Tente novamente em instantes.'));
    }
  };

  const handleRejectProvider = async (p: Provider, reason: string) => {
    try {
      const updated = await dbService.reviewProvider(p.id, 'REJECTED', reason);
      setProviders((current) => current.map((item) => item.id === updated.id ? updated : item));
    } catch (error: any) {
      showFeedback('error', 'Não foi possível reprovar o prestador', getFriendlyAdminError(error, 'Tente novamente em instantes.'));
    }
  };

  const handleSuspendProvider = async (p: Provider, reason: string) => {
    try {
      const updated = await dbService.reviewProvider(p.id, 'SUSPENDED', reason);
      setProviders((current) => current.map((item) => item.id === updated.id ? updated : item));
    } catch (error: any) {
      showFeedback('error', 'Não foi possível suspender o prestador', getFriendlyAdminError(error, 'Tente novamente em instantes.'));
    }
  };

  const handleBlockProvider = async (p: Provider, reason: string) => {
    try {
      const updated = await dbService.reviewProvider(p.id, 'BLOCKED', reason);
      setProviders((current) => current.map((item) => item.id === updated.id ? updated : item));
    } catch (error: any) {
      showFeedback('error', 'Não foi possível bloquear o prestador', getFriendlyAdminError(error, 'Tente novamente em instantes.'));
    }
  };

  // ==========================================================================
  // COMPLIANCE DOCUMENTS HANDLERS
  // ==========================================================================
  const handleApproveDoc = async (doc: ComplianceDocument, expiresAt?: string) => {
    try {
      const updatedDoc = await dbService.reviewComplianceDocument(doc.id, 'APPROVED', undefined, expiresAt);
      setComplianceDocs((current) => current.map((item) => item.id === updatedDoc.id ? updatedDoc : item));
    } catch (error: any) {
      console.error('Admin document approval failed:', error);
      showFeedback('error', 'Não foi possível aprovar o documento', getFriendlyAdminError(error, 'Tente novamente em instantes.'));
    }
  };

  const handleRejectDoc = async (doc: ComplianceDocument, reason: string) => {
    try {
      const updatedDoc = await dbService.reviewComplianceDocument(doc.id, 'REJECTED', reason);
      setComplianceDocs((current) => current.map((item) => item.id === updatedDoc.id ? updatedDoc : item));
    } catch (error: any) {
      console.error('Admin document rejection failed:', error);
      showFeedback('error', 'Não foi possível reprovar o documento', getFriendlyAdminError(error, 'Tente novamente em instantes.'));
    }
  };

  const handleViewDocument = async (doc: ComplianceDocument) => {
    try {
      return await dbService.createComplianceDocumentSignedUrl(doc);
    } catch (error) {
      console.error('Admin document viewer failed:', error);
      throw error;
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
      showFeedback('error', 'Não foi possível aprovar o veículo', getFriendlyAdminError(error, 'Tente novamente em instantes.'));
    }
  };

  const handleRejectVehicle = async (vehicle: Vehicle, reason: string) => {
    try {
      const updatedVehicle = await dbService.reviewVehicle(vehicle.id, 'INACTIVE', reason);
      setVehicles((current) => current.map((item) => item.id === updatedVehicle.id ? updatedVehicle : item));
    } catch (error: any) {
      console.error('Admin vehicle rejection failed:', error);
      showFeedback('error', 'Não foi possível reprovar o veículo', getFriendlyAdminError(error, 'Tente novamente em instantes.'));
    }
  };

  const handleBlockVehicle = async (vehicle: Vehicle, reason: string) => {
    try {
      const updatedVehicle = await dbService.reviewVehicle(vehicle.id, 'BLOCKED', reason);
      setVehicles((current) => current.map((item) => item.id === updatedVehicle.id ? updatedVehicle : item));
    } catch (error: any) {
      console.error('Admin vehicle block failed:', error);
      showFeedback('error', 'Não foi possível bloquear o veículo', getFriendlyAdminError(error, 'Tente novamente em instantes.'));
    }
  };

  // ==========================================================================
  // REFUND HANDLER
  // ==========================================================================
  const handleProcessRefund = async (b: Booking) => {
    setRefundCandidate(b);
  };

  const handleConfirmRefund = async () => {
    if (!refundCandidate || isRefundSubmitting) return;

    const bookingToRefund = refundCandidate;
    const usesMercadoPago = getCheckoutGatewayProvider() === 'mercadopago';
    setIsRefundSubmitting(true);

    try {
      const result = usesMercadoPago
        ? await dbService.processMercadoPagoRefund(bookingToRefund.id)
        : await dbService.adminRefundMockBooking(bookingToRefund.id);

      if (usesMercadoPago && result?.refundStatus === 'PENDING') {
        setRefundCandidate(null);
        showFeedback('info', 'Estorno em processamento', 'O Mercado Pago está processando a devolução. O webhook atualizará a reserva quando finalizar.');
        return;
      }

      setBookings((current) => current.map((item) => item.id === bookingToRefund.id ? { ...item, status: 'REFUNDED' } : item));
      setRefundCandidate(null);
      showFeedback(
        'success',
        usesMercadoPago ? 'Estorno solicitado' : 'Estorno simulado',
        usesMercadoPago ? 'O pagamento de teste foi estornado e a reserva foi atualizada.' : 'A movimentação local foi registrada para conferência.',
      );
    } catch (error: any) {
      showFeedback('error', usesMercadoPago ? 'Não foi possível solicitar o estorno' : 'Não foi possível processar o estorno de teste', getFriendlyAdminError(error, 'Tente novamente em instantes.'));
    } finally {
      setIsRefundSubmitting(false);
    }
  };

  const handleMarkManualPayout = async (payout: Payout, transferReference: string) => {
    try {
      await dbService.markManualPayout(payout.id, transferReference);
      setPayouts((current) => current.map((item) => item.id === payout.id ? { ...item, status: 'PAID', transferReference, processedAt: new Date().toISOString(), releasedAt: new Date().toISOString() } : item));
      showFeedback('success', 'Repasse registrado', 'O repasse manual foi registrado com a referência informada.');
    } catch (error: any) {
      showFeedback('error', 'Não foi possível registrar o repasse', getFriendlyAdminError(error, 'Revise a disponibilidade e tente novamente.'));
      throw error;
    }
  };

  // ==========================================================================
  // USER ROLE MANAGEMENT HANDLER
  // ==========================================================================
  const handleAddAdministrativeRole = async (userId: string, role: Extract<UserRole, 'PLATFORM_ADMIN' | 'SUPPORT'>) => {
    try {
      await dbService.addAdministrativeRole(userId, role);
      showFeedback('success', 'Acesso administrativo adicionado', 'As funções existentes do usuário foram preservadas.');
    } catch (error: any) {
      showFeedback('error', 'Não foi possível atualizar as permissões', getFriendlyAdminError(error, 'Tente novamente em instantes.'));
    }
  };

  const handleInviteAdministrativeUser = async (email: string, role: Extract<UserRole, 'PLATFORM_ADMIN' | 'SUPPORT'>) => {
    try {
      const outcome = await dbService.inviteAdministrativeUser(email, role);
      showFeedback('success', outcome === 'existing_user' ? 'Acesso administrativo adicionado' : 'Convite enviado', outcome === 'existing_user' ? 'As funções existentes do usuário foram preservadas.' : 'A pessoa receberá as instruções para acessar a plataforma.');
    } catch (error: any) {
      showFeedback('error', 'Não foi possível adicionar este usuário', getFriendlyAdminError(error, 'Revise o e-mail e tente novamente.'));
      throw error;
    }
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
      showFeedback('success', 'Configurações salvas', 'As regras da plataforma foram atualizadas com segurança.');
    } catch (error: any) {
      console.error('Admin platform configuration update failed:', error);
      showFeedback('error', 'Não foi possível salvar as configurações', getFriendlyAdminError(error, 'Revise os valores e tente novamente.'));
      throw error;
    }
  };

  const withActionLoading = <T extends unknown[]>(action: (...args: T) => Promise<void>) => async (...args: T) => {
    if (isActionLoading) return;
    setIsActionLoading(true);
    try { await action(...args); } finally { setIsActionLoading(false); }
  };

  const activeScreenTitle: Record<string, string> = {
     dashboard: 'Visão geral',
    providers: 'Prestadores',
    compliance: 'Compliance',
    vehicles: 'Veículos',
    bookings: 'Reservas',
    financial: 'Financeiro',
    analytics: 'Analytics',
    users: 'Usuários & Papéis',
    audit: 'Auditoria',
    settings: 'Configurações',
    profile: 'Perfil',
  };

  return (
    <div className="min-h-[100dvh] w-full bg-[var(--mazzi-bg)] text-[var(--mazzi-text)] md:grid md:grid-cols-[248px_1fr]">
      {/* Brand stays in the upper-left corner; actions live in the workspace. */}
      <aside className="border-b border-[var(--mazzi-border)] bg-white px-4 py-4 sm:px-5 sm:py-5 md:min-h-[100dvh] md:border-b-0 md:border-r md:px-8 md:py-7">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--mazzi-yellow)] text-xl font-black text-[var(--mazzi-dark)] shadow-xs">
            M
          </div>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <span className="text-base font-black tracking-tight text-[var(--mazzi-dark)]">MAZZI</span>
              <span className="text-[10px] font-bold uppercase tracking-[.15em] text-[var(--mazzi-orange)]">Admin</span>
            </div>
            <p className="text-[11px] font-medium text-[var(--mazzi-muted)]">Central de operação</p>
          </div>
        </div>
        <nav className="mt-5 flex snap-x gap-1 overflow-x-auto pb-2 md:mt-7 md:flex-col md:overflow-visible md:pb-0">
        {[
          { id: 'dashboard', label: 'Visão Geral', icon: LayoutDashboard },
          { id: 'providers', label: 'Prestadores', icon: UserCheck, count: providers.filter((p) => p.status === 'PENDING_REVIEW').length },
{ id: 'compliance', label: 'Compliance', icon: ShieldCheck, count: complianceDocs.filter((d) => d.status === 'PENDING' || d.status === 'IN_REVIEW').length },
          { id: 'vehicles', label: 'Veículos', icon: Car, count: vehicles.filter((v) => isVehicleAwaitingAdminReview(v.status)).length },
          { id: 'bookings', label: 'Reservas', icon: Calendar },
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
              onClick={() => navigateAdminTab(tab.id)}
              className={`min-h-11 snap-start px-3 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 sm:px-4 ${
                isActive
                  ? 'bg-[var(--mazzi-yellow)] text-[var(--mazzi-dark)]'
                  : 'text-[var(--mazzi-muted)] hover:bg-[var(--mazzi-surface-muted)] hover:text-[var(--mazzi-dark)]'
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
        </nav>
      </aside>

      {/* App Workspace */}
      <main className="relative min-w-0 w-full p-4 pt-5 sm:p-6 sm:pt-6 md:p-10 md:pt-7">
        <div className="absolute right-4 top-5 flex items-center gap-2 sm:right-6 sm:top-6 md:right-10 md:top-7">
          <ButtonBase type="button" onClick={() => refreshAdminDataRef.current()} disabled={isRefreshingRealData} aria-label="Atualizar dados do Admin" title="Atualizar dados do Admin" className="mazzi-icon-button disabled:opacity-50">
            <RefreshCw className={`h-5 w-5 ${isRefreshingRealData ? 'animate-spin' : ''}`} aria-hidden="true" />
          </ButtonBase>
        </div>
        {activeTab !== 'profile' && <div className="mb-6 pr-14 sm:mb-8"><p className="mazzi-eyebrow mb-2">MAZZI Admin</p><h1 className="text-2xl font-extrabold tracking-[-.04em] sm:text-3xl">{activeScreenTitle[activeTab] || 'Visão geral'}</h1></div>}
        {loadError && (
          <div role="status" className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800">
            {loadError}
          </div>
        )}

        <section aria-busy={isLoadingRealData || isRefreshingRealData || isActionLoading} className="relative">
        {isActionLoading && (
          <div className="absolute inset-0 z-20 flex items-start justify-center rounded-2xl bg-white/55 pt-8 backdrop-blur-[1px]" role="status" aria-live="polite">
            <div className="flex items-center gap-2 rounded-full border border-[var(--mazzi-border)] bg-white px-4 py-2 text-xs font-semibold text-[var(--mazzi-text)] shadow-sm">
              <RefreshCw className="h-4 w-4 animate-spin text-amber-600" aria-hidden="true" />
              Processando ação...
            </div>
          </div>
        )}
        {(isLoadingRealData || isRefreshingRealData) && (
          <ContentSkeleton
            mode={activeSkeletonMode}
            label={isRefreshingRealData ? 'Atualizando conteúdo da tela atual' : 'Carregando conteúdo da tela atual'}
          />
        )}
        <div className={isLoadingRealData || isRefreshingRealData ? 'hidden' : ''}>
        {activeTab === 'dashboard' && (
          <DashboardTab
            providers={providers}
            complianceDocs={complianceDocs}
            vehicles={vehicles}
            bookings={bookings}
            auditLogs={auditLogs}
            onNavigate={navigateAdminTab}
          />
        )}

        {activeTab === 'providers' && (
          <ProvidersTab
            providers={providers}
            complianceDocs={complianceDocs}
            vehicles={vehicles}
            auditLogs={auditLogs}
            actor={activeActor}
            onApprove={withActionLoading(handleApproveProvider)}
            onReject={withActionLoading(handleRejectProvider)}
            onSuspend={withActionLoading(handleSuspendProvider)}
            onBlock={withActionLoading(handleBlockProvider)}
            eligibilityChecker={handleEligibilityCheck}
          />
        )}

        {activeTab === 'compliance' && (
          <ComplianceTab
            complianceDocs={complianceDocs}
            providers={providers}
            actor={activeActor}
            onApproveDoc={withActionLoading(handleApproveDoc)}
            onRejectDoc={withActionLoading(handleRejectDoc)}
            onViewDocument={handleViewDocument}
          />
        )}

        {activeTab === 'vehicles' && (
          <VehiclesTab
            vehicles={vehicles}
            providers={providers}
            onApproveVehicle={withActionLoading(handleApproveVehicle)}
            onRejectVehicle={withActionLoading(handleRejectVehicle)}
            onBlockVehicle={withActionLoading(handleBlockVehicle)}
          />
        )}

        {activeTab === 'bookings' && (
          <BookingsTab
            bookings={bookings}
            auditLogs={auditLogs}
            platformFeePercentage={platformConfig.platformFeeDefaultPercentage}
          />
        )}

        {activeTab === 'financial' && (
          <FinancialTab
            bookings={bookings}
            auditLogs={auditLogs}
            actor={activeActor}
            onProcessRefund={withActionLoading(handleProcessRefund)}
            isMercadoPagoGateway={getCheckoutGatewayProvider() === 'mercadopago'}
            isProductionEnvironment={isProductionEnvironment}
            platformFeePercentage={platformConfig.platformFeeDefaultPercentage}
            payouts={payouts}
            onMarkManualPayout={withActionLoading(handleMarkManualPayout)}
          />
        )}

        {activeTab === 'analytics' && (
          <AdminAnalyticsPanel />
        )}

        {activeTab === 'users' && (
          <UsersTab
            users={users}
            actor={activeActor}
            onAddAdministrativeRole={handleAddAdministrativeRole}
            onInviteAdministrativeUser={handleInviteAdministrativeUser}
          />
        )}

        {activeTab === 'audit' && (
          <AuditTab
            auditLogs={auditLogs}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsTab
            config={platformConfig}
            actor={activeActor}
            onUpdateConfig={withActionLoading(handleUpdateConfig)}
          />
        )}

        {activeTab === 'profile' && (
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
                  <div className="flex items-center justify-between gap-3"><dt className="text-slate-500">Nome</dt><dd className="font-semibold text-[var(--mazzi-text)]">{user?.name || 'Não informado'}</dd></div>
                  <div className="flex items-center justify-between gap-3"><dt className="text-slate-500">E-mail</dt><dd className="truncate font-semibold text-[var(--mazzi-text)]">{user?.email || 'Não informado'}</dd></div>
                <div className="flex items-center justify-between gap-3"><dt className="text-slate-500">Perfil</dt><dd className="font-semibold text-[var(--mazzi-text)]">{getUserRoleLabel(user?.roles?.[0])}</dd></div>
                </dl>
              </div>
              {isEditingProfile && <div className="flex items-center gap-2.5 pt-5"><Button variant="dangerSoft" size="sm" className="w-1/2" onClick={() => { setProfileAvatar(savedProfileAvatar); setIsEditingProfile(false); }}>Cancelar</Button><Button variant="primary" size="sm" className="w-1/2" onClick={() => void handleSaveProfilePhoto()}>Salvar foto</Button></div>}
            </div>

            {!isEditingProfile && <div className="flex justify-center border-t border-[var(--mazzi-border)] pt-4"><Button variant="ghost" size="sm" className="font-bold text-rose-700 hover:bg-rose-50" onClick={() => { void logout(); }} leftIcon={<LogOut className="w-4 h-4" />}>Sair</Button></div>}
          </section>
        )}
        </div>
        </section>
      </main>
      {refundCandidate && (
        <Modal
          isOpen
          title="Confirmar estorno"
          size="sm"
          closeOnBackdrop={!isRefundSubmitting}
          closeOnEscape={!isRefundSubmitting}
          onClose={() => {
            if (!isRefundSubmitting) setRefundCandidate(null);
          }}
          footer={(
            <>
              <Button
                type="button"
                variant="dangerSoft"
                size="sm"
                disabled={isRefundSubmitting}
                onClick={() => setRefundCandidate(null)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="danger"
                size="sm"
                isLoading={isRefundSubmitting}
                disabled={isRefundSubmitting}
                onClick={() => { void handleConfirmRefund(); }}
              >
                Confirmar estorno
              </Button>
            </>
          )}
        >
          <div className="space-y-4 text-left">
            <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-900">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" aria-hidden="true" />
              <p className="text-sm font-semibold">
                {isProductionEnvironment
                  ? 'Este estorno será solicitado ao Mercado Pago e devolverá o valor ao pagador.'
                  : 'Este estorno será processado no ambiente de teste do Mercado Pago.'}
              </p>
            </div>
            <dl className="space-y-2 rounded-2xl border border-[var(--mazzi-border)] bg-[var(--mazzi-surface-soft)] p-4 text-sm">
              <div className="flex items-center justify-between gap-3"><dt className="text-slate-500">Reserva</dt><dd className="font-mono font-bold text-[var(--mazzi-text)]">{refundCandidate.id.slice(0, 8)}</dd></div>
              <div className="flex items-center justify-between gap-3"><dt className="text-slate-500">Aluno</dt><dd className="font-semibold text-right text-[var(--mazzi-text)]">{refundCandidate.studentName || 'Aluno não identificado'}</dd></div>
              <div className="flex items-center justify-between gap-3"><dt className="text-slate-500">Aula</dt><dd className="font-semibold text-right text-[var(--mazzi-text)]">{formatDateBR(refundCandidate.scheduledStartAt)} às {formatTimeBR(refundCandidate.scheduledStartAt)}</dd></div>
              <div className="flex items-center justify-between gap-3"><dt className="flex items-center gap-1.5 text-slate-500"><CreditCard className="h-3.5 w-3.5" aria-hidden="true" />Meio</dt><dd className="font-semibold text-[var(--mazzi-text)]">Mercado Pago</dd></div>
              <div className="flex items-center justify-between gap-3 border-t border-[var(--mazzi-border)] pt-2"><dt className="font-bold text-[var(--mazzi-text)]">Valor</dt><dd className="font-mono font-bold text-[var(--mazzi-text)]">{formatCentsToBRL(refundCandidate.totalInCents)}</dd></div>
            </dl>
            <p className="text-xs leading-relaxed text-slate-500">A operação não deve ser repetida. Confirme somente depois de revisar os dados acima.</p>
          </div>
        </Modal>
      )}
      <ToastContainer toasts={toasts} onDismiss={(id) => setToasts((current) => current.filter((toast) => toast.id !== id))} />
    </div>
  );
};

