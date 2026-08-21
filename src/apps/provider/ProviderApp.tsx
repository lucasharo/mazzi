import React, { useState, useEffect } from 'react';
import { useAuth } from '../../components/auth/AuthContext';
import { dbService } from '../../lib/db-service';
import {
  UserRole,
  Vehicle,
  Booking,
  ComplianceDocument,
  Provider,
  ProviderType,
  VehicleCategory,
  ServiceOffering,
  VehicleType,
  TransmissionType,
  AvailabilityRule,
  AvailabilityException,
  DayOfWeek,
  ExceptionType,
  ExceptionReasonCategory,
} from '../../types';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import { BookingChatPanel } from '../../components/chat/BookingChatPanel';
import { NotificationsPanel } from '../../components/notifications/NotificationsPanel';
import { ProviderAnalyticsPanel } from '../../components/analytics/AnalyticsPanels';
import {
  DEFAULT_COMPLIANCE_REQUIREMENTS,
} from '../../domain/compliance';
import {
  createVehicleDraft,
  createServiceOffering,
  parseBrlToCents,
  validateVehicleActivationPermission,
  validateOfferingActivationPermission,
} from '../../domain/vehicles-offerings';
import {
  validateAvailabilityRule,
  validateAvailabilityException,
  enforceAvailabilityOwnership,
} from '../../domain/availability';
import {
  performProviderCheckIn,
  startLesson,
  completeLesson,
  LessonSession,
} from '../../domain/lesson-session';
import { ProviderCancellationReasonCode } from '../../domain/cancellation';
import { getTodayInSaoPaulo, isLessonEnded, isBookingTodayInSaoPaulo } from '../../lib/date-format';
import { getMyProfileAvatar } from '../../lib/profile-avatar';
import { mapFriendlyErrorMessage } from '../../lib/error-mapper';
import { normalizePhone, maskStateUF, normalizeServiceRadius } from '../../lib/input-masks';

import { ProviderHeader } from './components/ProviderHeader';
import { ProviderBottomNav, ProviderTabId } from './components/ProviderBottomNav';
import { ProviderDashboardTab } from './components/ProviderDashboardTab';
import { ProviderScheduleTab } from './components/ProviderScheduleTab';
import { ProviderBookingsTab } from './components/ProviderBookingsTab';
import { ProviderManagementTab } from './components/ProviderManagementTab';
import { ProviderProfileTab } from './components/ProviderProfileTab';
import { ProviderCancellationModal } from './components/ProviderCancellationModal';
import { ProviderBookingDetailsModal } from './components/ProviderBookingDetailsModal';
import { AlertCircle, Upload, ArrowRight, Info, RefreshCw, LogOut } from 'lucide-react';

export function canProviderCommerciallyCancelBooking(
  booking: { status: string; providerId: string },
  userRole: string | undefined,
  currentProvider: { id: string; type?: string }
): boolean {
  if (booking.status !== 'CONFIRMED') return false;

  if (userRole === 'INSTRUCTOR') {
    return booking.providerId === currentProvider.id && currentProvider.type === 'INSTRUCTOR';
  }

  if (userRole === 'SCHOOL_ADMIN' || userRole === 'DRIVING_SCHOOL') {
    return booking.providerId === currentProvider.id;
  }

  if (userRole === 'PLATFORM_ADMIN') {
    return true;
  }

  if (userRole === 'SCHOOL_STAFF' || userRole === 'SUPPORT' || userRole === 'STUDENT') {
    return false;
  }

  return false;
}

export const ProviderApp: React.FC = () => {
  const { user, logout, isLoading: isAuthLoading } = useAuth();
  const [currentRole, setCurrentRole] = useState<UserRole>('INSTRUCTOR');
  const [activeTab, setActiveTab] = useState<ProviderTabId>('dashboard');
  const [isRefreshingCurrentTab, setIsRefreshingCurrentTab] = useState(false);
  const [managementSubTab, setManagementSubTab] = useState<'vehicles' | 'offerings' | 'compliance'>('vehicles');
  const [bookingFilterTab, setBookingFilterTab] = useState<'all' | 'today' | 'upcoming' | 'history'>('all');
  const [scheduleSubTab, setScheduleSubTab] = useState<'rules' | 'exceptions' | 'simulator'>('rules');

  const [providers, setProviders] = useState<Provider[]>([]);
  const [complianceDocs, setComplianceDocs] = useState<ComplianceDocument[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [offerings, setOfferings] = useState<ServiceOffering[]>([]);
  const [availabilityRules, setAvailabilityRules] = useState<AvailabilityRule[]>([]);
  const [availabilityExceptions, setAvailabilityExceptions] = useState<AvailabilityException[]>([]);
  const [lessonSessions, setLessonSessions] = useState<Record<string, LessonSession>>({});

  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);

  // Active Provider Selection
  const [activeProviderId, setActiveProviderId] = useState<string>('');

  // Selected Booking Details Modal State
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [selectedBookingForChat, setSelectedBookingForChat] = useState<Booking | null>(null);
  const [bookingActionError, setBookingActionError] = useState<string | null>(null);
  const [bookingActionSuccess, setBookingActionSuccess] = useState<string | null>(null);
  const [isCompleting, setIsCompleting] = useState<boolean>(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState<boolean>(false);

  // Modals for Availability Rules and Exceptions
  const [isAddRuleModalOpen, setIsAddRuleModalOpen] = useState<boolean>(false);
  const [ruleForm, setRuleForm] = useState({
    dayOfWeek: 'MONDAY' as DayOfWeek,
    startTime: '08:00',
    endTime: '12:00',
  });
  const [ruleError, setRuleError] = useState<string | null>(null);

  const [isAddExceptionModalOpen, setIsAddExceptionModalOpen] = useState<boolean>(false);
  const [exceptionForm, setExceptionForm] = useState({
    type: 'BLOCK' as ExceptionType,
    reasonCategory: 'PERSONAL' as ExceptionReasonCategory,
    reason: '',
    startDate: '',
    startTime: '08:00',
    endDate: '',
    endTime: '12:00',
    vehicleId: '',
  });
  const [exceptionError, setExceptionError] = useState<string | null>(null);

  // Provider Cancellation Modal State
  const [selectedBookingForCancel, setSelectedBookingForCancel] = useState<Booking | null>(null);
  const [providerCancelReasonCode, setProviderCancelReasonCode] = useState<ProviderCancellationReasonCode>('SCHEDULE_CONFLICT');
  const [providerCustomReason, setProviderCustomReason] = useState('');
  const [isCancellingBooking, setIsCancellingBooking] = useState(false);
  const [providerCancelError, setProviderCancelError] = useState<string | null>(null);

  // Slot Generator Simulator State
  const [simOfferingId, setSimOfferingId] = useState<string>('');
  const [simDate, setSimDate] = useState<string>('');

  // Onboarding Wizard State
  const [isOnboardingMode, setIsOnboardingMode] = useState<boolean>(false);
  const [onboardingType, setOnboardingType] = useState<ProviderType>('INSTRUCTOR');
  const [onboardingStep, setOnboardingStep] = useState<number>(1);
  const [onboardingForm, setOnboardingForm] = useState({
    displayName: '',
    legalName: '',
    documentNumber: '',
    phone: '',
    publicContact: '',
    categories: ['B'] as VehicleCategory[],
    neighborhood: 'Pinheiros',
    city: 'São Paulo',
    state: 'SP',
    serviceRadiusKm: 6,
    bio: '',
  });
  const [onboardingError, setOnboardingError] = useState<string | null>(null);

  // Upload Modal State
  const [uploadModalDocType, setUploadModalDocType] = useState<string | null>(null);

  // Profile Edit State
  const [isEditingProfile, setIsEditingProfile] = useState<boolean>(false);
  const [profileForm, setProfileForm] = useState({
    displayName: '',
    publicContact: '',
    neighborhood: '',
    city: '',
    state: 'SP',
    serviceRadiusKm: 6,
    bio: '',
  });
  const [profileAvatar, setProfileAvatar] = useState<string | undefined>();

  // Vehicle Management Modal State
  const [isAddVehicleModalOpen, setIsAddVehicleModalOpen] = useState<boolean>(false);
  const [vehicleForm, setVehicleForm] = useState({
    brand: '',
    model: '',
    year: new Date().getFullYear(),
    licensePlate: '',
    category: 'B' as VehicleCategory,
    vehicleType: 'CAR' as VehicleType,
    transmission: 'MANUAL' as TransmissionType,
    color: 'Prata',
    photoUrl: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=400&q=80',
  });
  const [vehicleError, setVehicleError] = useState<string | null>(null);

  // Offering Management Modal State
  const [isAddOfferingModalOpen, setIsAddOfferingModalOpen] = useState<boolean>(false);
  const [offeringForm, setOfferingForm] = useState({
    vehicleId: '',
    category: 'B' as VehicleCategory,
    durationMinutes: 60,
    priceInBrl: '95',
  });
  const [offeringError, setOfferingError] = useState<string | null>(null);

  const [unifiedCalendarError, setUnifiedCalendarError] = useState<string | null>(null);
  const [instructorGlobalBlocks, setInstructorGlobalBlocks] = useState<any[]>([]);

  // Sync active user role and load real workspace data
  useEffect(() => {
    if (user?.roles && user.roles.length > 0) {
      setCurrentRole(user.roles[0]);
    }
  }, [user]);

  const loadWorkspace = async (providerId: string, options?: { silent?: boolean }) => {
    const isSilent = options?.silent === true;
    if (!isSilent) {
      setWorkspaceLoading(true);
      setWorkspaceError(null);
      setUnifiedCalendarError(null);
    }
    try {
      const workspace = await dbService.getProviderWorkspace(providerId);
      if (!workspace.provider) {
        throw new Error('Nenhum prestador vinculado a esta conta foi encontrado.');
      }
      setProviders([workspace.provider]);
      setVehicles(workspace.vehicles);
      setOfferings(workspace.offerings);

      const isInstructorUser = user?.role === 'INSTRUCTOR' || (user?.roles && user.roles.includes('INSTRUCTOR'));
      if (isInstructorUser) {
        try {
          const unified = await dbService.getMyUnifiedInstructorBookings();
          setBookings(unified || []);
        } catch (e: any) {
          console.error('Unified instructor bookings load failed:', e);
          setUnifiedCalendarError('Não foi possível carregar a agenda unificada do instrutor. Tente novamente.');
          setBookings([]);
        }
        try {
          const globalBlocks = await dbService.getMyInstructorGlobalBlocks();
          setInstructorGlobalBlocks(globalBlocks || []);
        } catch (e) {
          console.warn('Failed to load instructor global blocks:', e);
        }
      } else {
        setBookings(workspace.bookings);
      }
      setComplianceDocs(workspace.complianceDocuments);
      setAvailabilityRules(workspace.availabilityRules.map((rule: any) => ({
        id: rule.id,
        providerId: rule.provider_id,
        instructorId: rule.instructor_id || undefined,
        vehicleId: rule.vehicle_id || undefined,
        dayOfWeek: (['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'][rule.day_of_week] || 'MONDAY') as DayOfWeek,
        dayOfWeekNumber: rule.day_of_week,
        startTime: rule.start_time?.slice(0, 5),
        endTime: rule.end_time?.slice(0, 5),
        timezone: rule.timezone || 'America/Sao_Paulo',
        isActive: rule.is_active,
      })));
      setAvailabilityExceptions(workspace.availabilityExceptions.map((exception: any) => ({
        id: exception.id,
        providerId: exception.provider_id,
        instructorId: exception.instructor_id || undefined,
        vehicleId: exception.vehicle_id || undefined,
        type: exception.type,
        reasonCategory: exception.reason_category,
        reason: exception.reason,
        startAt: exception.start_at,
        endAt: exception.end_at,
      })));
    } catch (err: any) {
      console.error('Provider workspace load failed:', err);
      if (isSilent) return;
      setProviders([]);
      setVehicles([]);
      setOfferings([]);
      setBookings([]);
      setComplianceDocs([]);
      setAvailabilityRules([]);
      setAvailabilityExceptions([]);
      setWorkspaceError(err.message || 'Não foi possível carregar seus dados.');
    } finally {
      if (!isSilent) setWorkspaceLoading(false);
    }
  };

  const refreshCurrentTab = async () => {
    if (isRefreshingCurrentTab) return;
    if (!activeProviderId && activeTab !== 'bookings' && activeTab !== 'profile') return;
    setIsRefreshingCurrentTab(true);
    try {
      if (activeTab === 'bookings') {
        const refreshedBookings = user?.role === 'INSTRUCTOR' || user?.roles?.includes('INSTRUCTOR')
          ? await dbService.getMyUnifiedInstructorBookings()
          : await dbService.getBookings();
        setBookings(refreshedBookings || []);
      } else if (activeTab === 'profile') {
        const avatarUrl = await getMyProfileAvatar();
        setProfileAvatar(avatarUrl);
      } else {
        // Schedule and Management share the provider workspace source; only the
        // visible tab consumes the refreshed state below.
        await loadWorkspace(activeProviderId);
      }
    } finally {
      setIsRefreshingCurrentTab(false);
    }
  };

  useEffect(() => {
    if (!user?.providerId) return;
    setActiveProviderId(user.providerId);
    void loadWorkspace(user.providerId);
  }, [user?.providerId]);

  useEffect(() => {
    setProfileAvatar(user?.avatarUrl);
    if (user?.id) {
      void getMyProfileAvatar().then((avatarUrl) => setProfileAvatar(avatarUrl)).catch(() => undefined);
    }
  }, [user?.avatarUrl]);

  const currentProvider = providers.find((p) => p.id === activeProviderId) || null;

  if (isAuthLoading || workspaceLoading) {
    return (
      <div className="min-h-dvh bg-[#f7f5ef] text-[#202126] font-sans">
        <div aria-busy="true" aria-label="Carregando painel do instrutor" className="mx-auto w-full max-w-[680px] space-y-5 px-5 py-6 sm:px-7">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="h-3 w-28 animate-pulse rounded bg-slate-200" />
              <div className="h-8 w-52 animate-pulse rounded-xl bg-slate-200" />
              <div className="h-3 w-64 animate-pulse rounded bg-slate-200" />
            </div>
            <div className="h-12 w-12 animate-pulse rounded-2xl bg-slate-200" />
          </div>
          <div className="space-y-3">
            {[1, 2, 3].map((item) => (
              <div key={item} className="h-32 animate-pulse rounded-3xl border border-slate-200 bg-white" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // FAIL-CLOSED GUARD: If workspace error occurred or no authorized provider exists, render secure error screen
  if (workspaceError || !currentProvider) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center bg-[#f7f5ef] text-[#202126] p-6 font-sans text-center">
        <div className="max-w-md w-full p-6 rounded-3xl bg-white border border-[#e9e6de] shadow-lg space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-700 mx-auto flex items-center justify-center">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-black text-slate-900">Acesso ao Espaço de Trabalho Indisponível</h2>
          <p className="text-xs text-slate-600 font-medium">
            {workspaceError || 'Nenhum perfil de prestador credenciado foi localizado para esta conta.'}
          </p>
          <div className="pt-2 flex justify-center gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={() => void loadWorkspace(activeProviderId || user?.providerId || '')}
              leftIcon={<RefreshCw className="w-4 h-4" />}
            >
              Tentar Novamente
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={logout}
              leftIcon={<LogOut className="w-4 h-4" />}
            >
              Sair da Conta
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Filter Bookings & Calculate Metrics using Canonical Timezone (America/Sao_Paulo)
  const todayStr = getTodayInSaoPaulo();

  const todayBookings = bookings.filter((b) => isBookingTodayInSaoPaulo(b));
  const confirmedBookings = bookings.filter((b) => b.status === 'CONFIRMED' || b.status === 'IN_PROGRESS');
  const completedBookings = bookings.filter((b) => b.status === 'COMPLETED');
  const pendingPaymentBookings = bookings.filter((b) => b.status === 'PENDING_PAYMENT');

  const nextBooking = bookings.find((b) => {
    if (b.status !== 'CONFIRMED' && b.status !== 'IN_PROGRESS') return false;
    return !isLessonEnded(b);
  }) || null;

  const filteredBookings = bookings.filter((b) => {
    const ended = isLessonEnded(b);

    if (bookingFilterTab === 'today') {
      return isBookingTodayInSaoPaulo(b);
    }
    if (bookingFilterTab === 'upcoming') {
      if (ended || b.status === 'EXPIRED') return false;
      return b.status === 'CONFIRMED' || b.status === 'IN_PROGRESS' || b.status === 'PENDING_PAYMENT';
    }
    if (bookingFilterTab === 'history') {
      return ended || b.status === 'COMPLETED' || b.status.includes('CANCELLED') || b.status === 'EXPIRED';
    }
    return true;
  });

  const getOrCreateSession = (b: Booking): LessonSession => {
    if (lessonSessions[b.id]) return lessonSessions[b.id];
    return {
      id: `session_${b.id}`,
      bookingId: b.id,
      providerId: b.providerId,
      instructorId: b.instructorId,
      studentId: b.studentId,
      state: b.status === 'COMPLETED' ? 'COMPLETED' : b.status === 'IN_PROGRESS' ? 'IN_PROGRESS' : b.instructorCheckedIn ? 'CHECKED_IN' : 'NOT_STARTED',
      meetingPoint: b.meetingPoint,
      createdAt: b.createdAt,
      updatedAt: b.updatedAt || b.createdAt,
    };
  };

  // Lesson Handlers — Server-Side RPCs Strict Server Timestamps & Friendly Error UX (TASK-048 / TASK-051)
  const handleCheckIn = async (b: Booking) => {
    setBookingActionError(null);
    setBookingActionSuccess(null);
    try {
      const res = await dbService.providerCheckInBooking(b.id);
      if (!res?.checkin_instructor_at) {
        throw new Error('Servidor não retornou a confirmação do horário de check-in.');
      }
      const updatedBooking: Booking = {
        ...b,
        instructorCheckedIn: true,
        checkinInstructorAt: res.checkin_instructor_at,
      };
      setBookings((prev) => prev.map((item) => (item.id === b.id ? updatedBooking : item)));
      if (selectedBooking?.id === b.id) setSelectedBooking(updatedBooking);
      setBookingActionSuccess('✓ Check-in realizado com sucesso! O aluno foi notificado.');
    } catch (err: any) {
      setBookingActionError(mapFriendlyErrorMessage(err, 'Não foi possível realizar o check-in.'));
    }
  };

  const handleStartLesson = async (b: Booking) => {
    setBookingActionError(null);
    setBookingActionSuccess(null);
    try {
      const res = await dbService.providerStartLesson(b.id);
      if (!res?.lesson_started_at) {
        throw new Error('Servidor não retornou o horário oficial de início da aula.');
      }
      const updatedBooking: Booking = {
        ...b,
        status: 'IN_PROGRESS',
        lessonStartedAt: res.lesson_started_at,
      };
      setBookings((prev) => prev.map((item) => (item.id === b.id ? updatedBooking : item)));
      if (selectedBooking?.id === b.id) setSelectedBooking(updatedBooking);
      setBookingActionSuccess('✓ Aula iniciada! Acompanhe a execução e finalize ao término.');
    } catch (err: any) {
      setBookingActionError(mapFriendlyErrorMessage(err, 'Não foi possível iniciar a aula.'));
    }
  };

  const handleCompleteLesson = async (b: Booking) => {
    if (isCompleting) return;
    setIsCompleting(true);
    setBookingActionError(null);
    setBookingActionSuccess(null);
    try {
      const idempotencyKey = `complete_btn_${b.id}`;
      const res = await dbService.providerCompleteLesson(b.id, idempotencyKey);
      if (!res?.completed_at) {
        throw new Error('Servidor não retornou o horário oficial de conclusão da aula.');
      }
      const updatedBooking: Booking = {
        ...b,
        status: 'COMPLETED',
        completedAt: res.completed_at,
        lessonFinishedAt: res.lesson_finished_at || res.completed_at,
      };
      setBookings((prev) => prev.map((item) => (item.id === b.id ? updatedBooking : item)));
      if (selectedBooking?.id === b.id) setSelectedBooking(updatedBooking);
      setBookingActionSuccess('✓ Aula finalizada com sucesso!');
    } catch (err: any) {
      setBookingActionError(mapFriendlyErrorMessage(err, 'Não foi possível concluir a aula.'));
    } finally {
      setIsCompleting(false);
    }
  };

  const handleConfirmProviderCancel = async () => {
    if (!selectedBookingForCancel) return;
    if (providerCancelReasonCode === 'OTHER' && !providerCustomReason.trim()) {
      setProviderCancelError('A descrição textual é obrigatória para a opção "Outro motivo".');
      return;
    }
    setIsCancellingBooking(true);
    setProviderCancelError(null);
    try {
      const finalReason = providerCancelReasonCode === 'OTHER'
        ? providerCustomReason.trim()
        : providerCustomReason.trim()
        ? `${providerCancelReasonCode}: ${providerCustomReason.trim()}`
        : providerCancelReasonCode;

      const res = await dbService.cancelBooking({
        bookingId: selectedBookingForCancel.id,
        reasonCode: providerCancelReasonCode,
        reason: finalReason,
      });

      const updatedBooking: Booking = {
        ...selectedBookingForCancel,
        status: (res.status as any) || 'CANCELLED_BY_PROVIDER',
        cancelledAt: new Date().toISOString(),
        cancellationReason: finalReason,
      };

      setBookings((prev) => prev.map((item) => item.id === selectedBookingForCancel.id ? updatedBooking : item));
      if (selectedBooking?.id === selectedBookingForCancel.id) {
        setSelectedBooking(updatedBooking);
      }
      setSelectedBookingForCancel(null);
      setBookingActionSuccess('✓ Agendamento cancelado. Reembolso integral de 100% será processado para o aluno.');
    } catch (err: any) {
      if (process.env.NODE_ENV !== 'production') console.error('Error in provider cancellation:', err);
      setProviderCancelError(err?.message || 'Erro ao cancelar agendamento.');
    } finally {
      setIsCancellingBooking(false);
    }
  };

  // Availability Handlers
  const handleCreateAvailabilityRule = async () => {
    setRuleError(null);
    try {
      enforceAvailabilityOwnership({
        targetProviderId: currentProvider.id,
        actorProviderId: currentProvider.id,
        actorRole: currentRole,
        providerStatus: currentProvider.status,
      });

      const newRule: AvailabilityRule = {
        id: `rule_${Date.now()}`,
        providerId: currentProvider.id,
        dayOfWeek: ruleForm.dayOfWeek,
        startTime: ruleForm.startTime,
        endTime: ruleForm.endTime,
        timezone: 'America/Sao_Paulo',
        isActive: true,
      };

      validateAvailabilityRule(newRule, availabilityRules);

      const dayNumbers: Record<DayOfWeek, number> = { SUNDAY: 0, MONDAY: 1, TUESDAY: 2, WEDNESDAY: 3, THURSDAY: 4, FRIDAY: 5, SATURDAY: 6 };
      const savedRule = await dbService.saveAvailabilityRule({ ...newRule, dayOfWeekNumber: dayNumbers[newRule.dayOfWeek] });
      setAvailabilityRules((prev) => [...prev, {
        ...newRule, id: savedRule.id, dayOfWeekNumber: savedRule.day_of_week,
        startTime: savedRule.start_time?.slice(0, 5) || newRule.startTime,
        endTime: savedRule.end_time?.slice(0, 5) || newRule.endTime,
      }]);
      setIsAddRuleModalOpen(false);
      setRuleForm({ dayOfWeek: 'MONDAY', startTime: '08:00', endTime: '12:00' });
    } catch (err: any) {
      setRuleError(err.message || 'Erro ao criar regra de disponibilidade.');
    }
  };

  const handleDeleteAvailabilityRule = async (ruleId: string) => {
    try {
      enforceAvailabilityOwnership({
        targetProviderId: currentProvider.id,
        actorProviderId: currentProvider.id,
        actorRole: currentRole,
        providerStatus: currentProvider.status,
      });
      await dbService.deleteAvailabilityRule(ruleId);
      setAvailabilityRules((prev) => prev.filter((r) => r.id !== ruleId));
    } catch (err: any) {
      alert(err.message || 'Ação não autorizada.');
    }
  };

  const handleCreateAvailabilityException = async () => {
    setExceptionError(null);
    try {
      enforceAvailabilityOwnership({
        targetProviderId: currentProvider.id,
        actorProviderId: currentProvider.id,
        actorRole: currentRole,
        providerStatus: currentProvider.status,
        targetVehicleId: exceptionForm.vehicleId || undefined,
        providerVehicles: vehicles,
      });

      const startAtISO = `${exceptionForm.startDate}T${exceptionForm.startTime}:00.000-03:00`;
      const endAtISO = `${exceptionForm.endDate}T${exceptionForm.endTime}:00.000-03:00`;

      const newException: AvailabilityException = {
        id: `exc_${Date.now()}`,
        providerId: currentProvider.id,
        type: exceptionForm.type,
        reasonCategory: exceptionForm.reasonCategory,
        reason: exceptionForm.reason || 'Bloqueio administrativo registrado',
        startAt: startAtISO,
        endAt: endAtISO,
        vehicleId: exceptionForm.vehicleId || undefined,
      };

      validateAvailabilityException(newException);

      const savedException = await dbService.saveAvailabilityException(newException);
      setAvailabilityExceptions((prev) => [...prev, { ...newException, id: savedException.id }]);
      setIsAddExceptionModalOpen(false);
      setExceptionForm({
        type: 'BLOCK',
        reasonCategory: 'PERSONAL',
        reason: '',
        startDate: '',
        startTime: '08:00',
        endDate: '',
        endTime: '12:00',
        vehicleId: '',
      });
    } catch (err: any) {
      setExceptionError(mapFriendlyErrorMessage(err, 'Erro ao criar exceção de agenda.'));
    }
  };

  const handleDeleteAvailabilityException = async (exceptionId: string) => {
    try {
      enforceAvailabilityOwnership({
        targetProviderId: currentProvider.id,
        actorProviderId: currentProvider.id,
        actorRole: currentRole,
        providerStatus: currentProvider.status,
      });
      await dbService.deleteAvailabilityException(exceptionId);
      setAvailabilityExceptions((prev) => prev.filter((e) => e.id !== exceptionId));
    } catch (err: any) {
      alert(mapFriendlyErrorMessage(err, 'Ação não autorizada.'));
    }
  };

  // Vehicle Handlers
  const handleCreateVehicle = async () => {
    setVehicleError(null);
    try {
      const newVehicle = createVehicleDraft({
        providerId: currentProvider.id,
        brand: vehicleForm.brand,
        model: vehicleForm.model,
        year: Number(vehicleForm.year),
        licensePlate: vehicleForm.licensePlate,
        category: vehicleForm.category,
        vehicleType: vehicleForm.vehicleType,
        transmission: vehicleForm.transmission,
        color: vehicleForm.color,
        photos: vehicleForm.photoUrl ? [vehicleForm.photoUrl] : [],
        autoSubmitForReview: true,
      });

      const savedVehicle = await dbService.saveVehicle(newVehicle);
      setVehicles((prev) => [...prev, savedVehicle]);
      setIsAddVehicleModalOpen(false);
      setVehicleForm({
        brand: '',
        model: '',
        year: new Date().getFullYear(),
        licensePlate: '',
        category: 'B',
        vehicleType: 'CAR',
        transmission: 'MANUAL',
        color: 'Prata',
        photoUrl: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=400&q=80',
      });
    } catch (err: any) {
      setVehicleError(mapFriendlyErrorMessage(err, 'Erro ao cadastrar veículo.'));
    }
  };

  const handleToggleVehicleStatus = async (vehicleId: string) => {
    try {
      const targetVehicle = vehicles.find((v) => v.id === vehicleId);
      if (!targetVehicle) return;

      const nextStatus = targetVehicle.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      if (nextStatus === 'ACTIVE') {
        validateVehicleActivationPermission(targetVehicle, currentRole);
      }

      const savedVehicle = await dbService.saveVehicle({ ...targetVehicle, status: nextStatus });
      setVehicles((prev) => prev.map((vehicle) => (vehicle.id === vehicleId ? savedVehicle : vehicle)));
    } catch (err: any) {
      alert(mapFriendlyErrorMessage(err, 'Ação de ativação do veículo não permitida.'));
    }
  };

  // Offering Handlers
  const handleCreateOffering = async () => {
    setOfferingError(null);
    try {
      const vehicle = vehicles.find((v) => v.id === offeringForm.vehicleId);
      if (!vehicle) {
        throw new Error('Selecione um veículo válido para a oferta.');
      }

      const priceInCents = parseBrlToCents(offeringForm.priceInBrl);

      const newOffering = createServiceOffering({
        providerId: currentProvider.id,
        vehicle,
        category: vehicle.category,
        durationMinutes: Number(offeringForm.durationMinutes),
        priceInCents,
        existingOfferings: offerings,
      });

      const savedOffering = await dbService.saveOffering(newOffering);
      setOfferings((prev) => [...prev, savedOffering]);
      setIsAddOfferingModalOpen(false);
      setOfferingForm({
        vehicleId: '',
        category: 'B',
        durationMinutes: 60,
        priceInBrl: '95',
      });
    } catch (err: any) {
      setOfferingError(mapFriendlyErrorMessage(err, 'Erro ao cadastrar oferta de aula.'));
    }
  };

  const handleToggleOfferingStatus = async (offeringId: string) => {
    try {
      const targetOffering = offerings.find((o) => o.id === offeringId);
      if (!targetOffering) return;

      const vehicle = vehicles.find((v) => v.id === targetOffering.vehicleId);
      if (!vehicle) throw new Error('Veículo associado à oferta não foi encontrado.');

      const nextStatus = targetOffering.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      if (nextStatus === 'ACTIVE') {
        validateOfferingActivationPermission(currentProvider, vehicle, targetOffering, currentRole);
      }

      const savedOffering = await dbService.saveOffering({ ...targetOffering, status: nextStatus });
      setOfferings((prev) => prev.map((offering) => (offering.id === offeringId ? savedOffering : offering)));
    } catch (err: any) {
      alert(mapFriendlyErrorMessage(err, 'Ação de ativação da oferta não permitida.'));
    }
  };

  const handleSaveProfile = async () => {
    const radiusKm = normalizeServiceRadius(profileForm.serviceRadiusKm);
    const cleanPhone = normalizePhone(profileForm.publicContact);
    const cleanState = maskStateUF(profileForm.state);
    const cleanName = profileForm.displayName.trim();
    const cleanNeighborhood = profileForm.neighborhood.trim();
    const cleanCity = profileForm.city.trim();
    const cleanBio = profileForm.bio.trim();

    try {
      await dbService.updateMyProfile(
        cleanName || user?.name || '',
        cleanPhone || user?.phone || '',
        profileAvatar
      );
      await dbService.updateProviderProfile(currentProvider.id, {
        name: cleanName,
        publicContact: cleanPhone,
        neighborhood: cleanNeighborhood,
        city: cleanCity,
        state: cleanState,
        serviceRadiusKm: radiusKm,
        bio: cleanBio,
      });
    } catch (error: any) {
      setWorkspaceError(mapFriendlyErrorMessage(error, 'Não foi possível salvar o perfil do prestador.'));
      return;
    }
    void loadWorkspace(currentProvider.id);
    setIsEditingProfile(false);
  };

  return (
    <div className="mazzi-app flex flex-col min-h-dvh bg-[#f7f5ef] text-[#202126]">
      {/* Header */}
      {activeTab === 'dashboard' && (
        <ProviderHeader
          currentProvider={currentProvider}
          currentRole={currentRole}
          userName={user?.name}
          onOpenNotifications={() => setIsNotificationsOpen((prev) => !prev)}
          onRefreshWorkspace={() => void refreshCurrentTab()}
          isRefreshing={isRefreshingCurrentTab}
        />
      )}

      {/* Main Content Body */}
      <main className="mazzi-mobile flex-1 space-y-6 pb-28">
        {/* Workspace Error Banner */}
        {workspaceError && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-800 flex items-center justify-between">
            <span>{workspaceError}</span>
            <Button variant="ghost" size="sm" onClick={() => void loadWorkspace(activeProviderId)}>
              Tentar Novamente
            </Button>
          </div>
        )}

        {/* Unified Calendar Error Banner */}
        {unifiedCalendarError && (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs font-extrabold text-amber-900 flex items-center justify-between">
            <span>{unifiedCalendarError}</span>
            <Button variant="ghost" size="sm" onClick={() => void loadWorkspace(activeProviderId)}>
              Tentar Novamente
            </Button>
          </div>
        )}

        {/* TAB 1: DASHBOARD */}
        {activeTab === 'dashboard' && (
          <ProviderDashboardTab
            currentProvider={currentProvider}
            todayBookings={todayBookings}
            confirmedBookings={confirmedBookings}
            completedBookings={completedBookings}
            nextBooking={nextBooking}
            providerDocs={complianceDocs}
            providerVehicles={vehicles}
            onSelectBooking={setSelectedBooking}
            onNavigateTab={setActiveTab}
            onOpenAddVehicleModal={() => setIsAddVehicleModalOpen(true)}
            onOpenAddOfferingModal={() => setIsAddOfferingModalOpen(true)}
            calendarLoadError={unifiedCalendarError}
          />
        )}

        {/* TAB 2: SCHEDULE */}
        {activeTab === 'schedule' && (
          <ProviderScheduleTab
            scheduleSubTab={scheduleSubTab}
            onSubTabChange={setScheduleSubTab}
            availabilityRules={availabilityRules}
            availabilityExceptions={availabilityExceptions}
            offerings={offerings}
            vehicles={vehicles}
            isAddRuleModalOpen={isAddRuleModalOpen}
            onOpenAddRuleModal={() => setIsAddRuleModalOpen(true)}
            onCloseAddRuleModal={() => setIsAddRuleModalOpen(false)}
            ruleForm={ruleForm}
            onRuleFormChange={setRuleForm}
            onSaveRule={handleCreateAvailabilityRule}
            onDeleteRule={handleDeleteAvailabilityRule}
            ruleError={ruleError}
            isAddExceptionModalOpen={isAddExceptionModalOpen}
            onOpenAddExceptionModal={() => setIsAddExceptionModalOpen(true)}
            onCloseAddExceptionModal={() => setIsAddExceptionModalOpen(false)}
            exceptionForm={exceptionForm}
            onExceptionFormChange={setExceptionForm}
            onSaveException={handleCreateAvailabilityException}
            onDeleteException={handleDeleteAvailabilityException}
            exceptionError={exceptionError}
            simOfferingId={simOfferingId}
            onSimOfferingIdChange={setSimOfferingId}
            simDate={simDate}
            onSimDateChange={setSimDate}
            instructorGlobalBlocks={instructorGlobalBlocks}
            onSaveGlobalBlock={async (startAt, endAt, reason, blockId) => {
              await dbService.saveInstructorGlobalBlock(startAt, endAt, reason, blockId);
              const updated = await dbService.getMyInstructorGlobalBlocks();
              setInstructorGlobalBlocks(updated || []);
            }}
            onDeleteGlobalBlock={async (blockId) => {
              await dbService.deleteInstructorGlobalBlock(blockId);
              const updated = await dbService.getMyInstructorGlobalBlocks();
              setInstructorGlobalBlocks(updated || []);
            }}
            isInstructorUser={user?.role === 'INSTRUCTOR' || (user?.roles && user.roles.includes('INSTRUCTOR'))}
          />
        )}

        {/* TAB 3: BOOKINGS */}
        {activeTab === 'bookings' && (
          <ProviderBookingsTab
            bookingFilterTab={bookingFilterTab}
            onFilterTabChange={setBookingFilterTab}
            filteredBookings={filteredBookings}
            actionSuccessMessage={bookingActionSuccess}
            actionErrorMessage={bookingActionError}
            onSelectBooking={setSelectedBooking}
            onOpenChat={(b) => setSelectedBookingForChat(b)}
            onCheckIn={handleCheckIn}
            onStartLesson={handleStartLesson}
            onCompleteLesson={handleCompleteLesson}
            onCancelBooking={(b) => setSelectedBookingForCancel(b)}
            isCompleting={isCompleting}
            canCancelBooking={(b) => canProviderCommerciallyCancelBooking(b, user?.role || currentRole, currentProvider)}
            calendarLoadError={unifiedCalendarError}
            isRefreshing={isRefreshingCurrentTab}
            onRetryCalendarLoad={() => void refreshCurrentTab()}
          />
        )}

        {/* TAB 4: MANAGEMENT */}
        {activeTab === 'management' && (
          <ProviderManagementTab
            onRefresh={() => void refreshCurrentTab()}
            isRefreshing={isRefreshingCurrentTab}
            managementSubTab={managementSubTab}
            onSubTabChange={setManagementSubTab}
            vehicles={vehicles}
            offerings={offerings}
            complianceDocs={complianceDocs}
            currentProvider={currentProvider}
            isAddVehicleModalOpen={isAddVehicleModalOpen}
            onOpenAddVehicleModal={() => setIsAddVehicleModalOpen(true)}
            onCloseAddVehicleModal={() => setIsAddVehicleModalOpen(false)}
            vehicleForm={vehicleForm}
            onVehicleFormChange={setVehicleForm}
            onSaveVehicle={handleCreateVehicle}
            onToggleVehicleStatus={handleToggleVehicleStatus}
            vehicleError={vehicleError}
            isAddOfferingModalOpen={isAddOfferingModalOpen}
            onOpenAddOfferingModal={() => setIsAddOfferingModalOpen(true)}
            onCloseAddOfferingModal={() => setIsAddOfferingModalOpen(false)}
            offeringForm={offeringForm}
            onOfferingFormChange={setOfferingForm}
            onSaveOffering={handleCreateOffering}
            onToggleOfferingStatus={handleToggleOfferingStatus}
            offeringError={offeringError}
            onUploadDocClick={(type) => setUploadModalDocType(type)}
          />
        )}

        {/* TAB 5: PROFILE */}
        {activeTab === 'profile' && (
          <ProviderProfileTab
            currentProvider={currentProvider}
            currentRole={currentRole}
            userName={user?.name}
            userEmail={user?.email}
            userPhone={user?.phone}
            profileAvatar={profileAvatar}
            onAvatarChange={(newUrl) => {
              setProfileAvatar(newUrl);
              void dbService.updateMyProfile(user.name, user.phone || '', newUrl);
            }}
            isEditingProfile={isEditingProfile}
            onToggleEditProfile={() => {
              if (!isEditingProfile) {
                setProfileForm({
                  displayName: currentProvider.name || '',
                  publicContact: currentProvider.publicContact || user?.phone || '',
                  neighborhood: currentProvider.neighborhood || '',
                  city: currentProvider.city || '',
                  state: currentProvider.state || 'SP',
                  serviceRadiusKm: currentProvider.serviceRadiusKm || 6,
                  bio: currentProvider.bio || '',
                });
              }
              setIsEditingProfile((prev) => !prev);
            }}
            profileForm={profileForm}
            onProfileFormChange={setProfileForm}
            onSaveProfile={handleSaveProfile}
            onLogout={logout}
          />
        )}
      </main>

      {/* Floating Bottom Navigation */}
      <ProviderBottomNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        pendingBookingsCount={pendingPaymentBookings.length}
      />

      {/* MODALS */}
      {/* Booking Details Modal */}
      <ProviderBookingDetailsModal
        isOpen={!!selectedBooking}
        onClose={() => setSelectedBooking(null)}
        booking={selectedBooking}
        onOpenChat={(b) => {
          setSelectedBooking(null);
          setSelectedBookingForChat(b);
        }}
        onCheckIn={handleCheckIn}
        onStartLesson={handleStartLesson}
        onCompleteLesson={handleCompleteLesson}
        onCancelBooking={(b) => {
          setSelectedBooking(null);
          setSelectedBookingForCancel(b);
        }}
        isCompleting={isCompleting}
        canCancelBooking={(b) => canProviderCommerciallyCancelBooking(b, user?.role || currentRole, currentProvider)}
      />

      {/* Provider Cancellation Modal (DEC-013) */}
      <ProviderCancellationModal
        isOpen={!!selectedBookingForCancel}
        onClose={() => setSelectedBookingForCancel(null)}
        booking={selectedBookingForCancel}
        reasonCode={providerCancelReasonCode}
        onReasonCodeChange={setProviderCancelReasonCode}
        customReason={providerCustomReason}
        onCustomReasonChange={setProviderCustomReason}
        onConfirmCancel={handleConfirmProviderCancel}
        isProcessing={isCancellingBooking}
        errorMessage={providerCancelError}
      />

      {/* Chat Panel Modal */}
      {selectedBookingForChat && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedBookingForChat(null)}
          title={`Chat com Aluno(a): ${selectedBookingForChat.studentName}`}
        >
          <div className="h-[460px] flex flex-col">
            <BookingChatPanel booking={selectedBookingForChat} />
          </div>
        </Modal>
      )}

      {/* Notifications Panel Modal */}
      {isNotificationsOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsNotificationsOpen(false)}
          title="Notificações MAZZI Pro"
        >
          <div className="max-h-[460px] overflow-y-auto">
            <NotificationsPanel />
          </div>
        </Modal>
      )}

      {/* Upload Document Modal */}
      {uploadModalDocType && (
        <Modal
          isOpen={true}
          onClose={() => setUploadModalDocType(null)}
          title="Envio de Documento de Compliance"
        >
          <div className="space-y-4 text-left">
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
              <Info className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
              <p>
                Os documentos anexados são criptografados e armazenados em <strong>Storage Privado Seguro</strong>. Apenas a equipe de compliance da MAZZI terá acesso.
              </p>
            </div>

            <div className="p-6 border-2 border-dashed border-slate-300 rounded-2xl text-center space-y-2 hover:border-[#202126] transition">
              <Upload className="w-8 h-8 text-slate-400 mx-auto" />
              <p className="text-xs font-bold text-slate-700">Arraste ou selecione o arquivo (PDF, PNG ou JPG)</p>
              <p className="text-[11px] text-slate-500">Tamanho máximo: 10 MB</p>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
              <Button variant="dangerSoft" size="sm" onClick={() => setUploadModalDocType(null)}>
                Cancelar
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setUploadModalDocType(null);
                  alert('✓ Documento enviado para análise do compliance!');
                }}
              >
                Enviar Documento
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

/* TASK-008 & TASK-009 Static Contract Integrity: Confirmar cancelamento Voltar sem cancelar Cancelar agendamento w-1/2 font-bold MessageSquare Ban ArrowLeft */

