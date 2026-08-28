import React, { useState, useEffect } from 'react';
import { useAuth } from '../../components/auth/AuthContext';
import { dbService } from '../../lib/db-service';
import { supabase } from '../../lib/supabase';
import type { SchoolInstructorComplianceSummary, SchoolMembership } from '../../lib/db-service';
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
  PixDestination,
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
  USER_GLOBAL_COMPLIANCE_DOCUMENT_TYPES,
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
  normalizeWeeklyAvailabilityRuleForProvider,
} from '../../domain/availability';
import {
  performProviderCheckIn,
  startLesson,
  completeLesson,
  LessonSession,
} from '../../domain/lesson-session';
import { ProviderCancellationReasonCode } from '../../domain/cancellation';
import { getStudentBookingSection } from '../../domain/booking';
import { buildFullDayBlockRange, getTodayInSaoPaulo, isLessonEnded, isBookingTodayInSaoPaulo } from '../../lib/date-format';
import { getMyProfileAvatar } from '../../lib/profile-avatar';
import { mapFriendlyErrorMessage } from '../../lib/error-mapper';
import { normalizePhone, maskStateUF, normalizeServiceRadius } from '../../lib/input-masks';
import { useMobileAppRoute } from '../../lib/mobile-app-router';
import { resolveProviderAddress } from '../../domain/maps/provider-address-resolution';
import { buildProviderAddressPayload, validateProviderAddressForm } from '../../domain/maps/provider-address-payload';

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
  const [activeTab, setActiveTab] = useMobileAppRoute<ProviderTabId>('provider', 'dashboard', ['dashboard', 'schedule', 'bookings', 'management', 'profile']);
  const [isRefreshingCurrentTab, setIsRefreshingCurrentTab] = useState(false);
  const [managementSubTab, setManagementSubTab] = useState<'vehicles' | 'offerings' | 'compliance' | 'memberships'>('vehicles');
  const [bookingFilterTab, setBookingFilterTab] = useState<'upcoming' | 'today' | 'history'>('upcoming');
  const [scheduleSubTab, setScheduleSubTab] = useState<'rules' | 'exceptions' | 'simulator'>('rules');

  const [providers, setProviders] = useState<Provider[]>([]);
  const [complianceDocs, setComplianceDocs] = useState<ComplianceDocument[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [offerings, setOfferings] = useState<ServiceOffering[]>([]);
  const [schoolInstructors, setSchoolInstructors] = useState<SchoolMembership[]>([]);
  const [schoolInstructorSummary, setSchoolInstructorSummary] = useState<SchoolInstructorComplianceSummary[]>([]);
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
  const [editingAvailabilityRuleId, setEditingAvailabilityRuleId] = useState<string | null>(null);
  const [isSavingAvailabilityRule, setIsSavingAvailabilityRule] = useState(false);
  const [ruleForm, setRuleForm] = useState({
    dayOfWeek: 'MONDAY' as DayOfWeek,
    startTime: '08:00',
    endTime: '12:00',
  });
  const [ruleError, setRuleError] = useState<string | null>(null);

  const [isAddExceptionModalOpen, setIsAddExceptionModalOpen] = useState<boolean>(false);
  const [exceptionForm, setExceptionForm] = useState({
    id: undefined as string | undefined,
    type: 'BLOCK' as ExceptionType,
    reasonCategory: '' as ExceptionReasonCategory,
    reason: '',
    startDate: '',
    endDate: '',
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
    serviceRadiusKm: 6 as number | '',
    bio: '',
    addressLine1: '',
    houseNumber: '',
    complement: '',
    postalCode: '',
    address: undefined,
    locationMode: 'STANDARD_ADDRESS' as const,
  });
  const [onboardingError, setOnboardingError] = useState<string | null>(null);

  // Upload Modal State
  const [uploadModalDocType, setUploadModalDocType] = useState<string | null>(null);
  const [selectedComplianceFile, setSelectedComplianceFile] = useState<File | null>(null);
  const [complianceUploadError, setComplianceUploadError] = useState<string | null>(null);
  const [isUploadingCompliance, setIsUploadingCompliance] = useState(false);
  const [isAcceptingComplianceTerms, setIsAcceptingComplianceTerms] = useState(false);
  const [complianceTermsError, setComplianceTermsError] = useState<string | null>(null);

  // Profile Edit State
  const [isEditingProfile, setIsEditingProfile] = useState<boolean>(false);
  const [profileForm, setProfileForm] = useState({
    displayName: '',
    legalName: '',
    publicContact: '',
    commercialEmail: '',
    neighborhood: '',
    city: '',
    state: 'SP',
    serviceRadiusKm: 6 as number | '',
    bio: '',
    addressLine1: '',
    houseNumber: '',
    complement: '',
    postalCode: '',
    address: undefined,
  });
  const [profileFormError, setProfileFormError] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileAvatar, setProfileAvatar] = useState<string | undefined>();
  const [pixDestination, setPixDestination] = useState<PixDestination | null>(null);
  const [isSavingPixDestination, setIsSavingPixDestination] = useState(false);

  // Vehicle Management Modal State
  const [isAddVehicleModalOpen, setIsAddVehicleModalOpen] = useState<boolean>(false);
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);
  const [vehicleForm, setVehicleForm] = useState({
    brand: '',
    model: '',
    year: '' as number | '',
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
    instructorId: '',
    category: 'B' as VehicleCategory,
    durationMinutes: 50,
    priceInBrl: '95',
  });
  const [offeringError, setOfferingError] = useState<string | null>(null);
  const [offeringNotice, setOfferingNotice] = useState<string | null>(null);

  const [unifiedCalendarError, setUnifiedCalendarError] = useState<string | null>(null);
  const [instructorGlobalBlocks, setInstructorGlobalBlocks] = useState<any[]>([]);

  // Sync active user role and load real workspace data
  useEffect(() => {
    if (user?.roles && user.roles.length > 0) {
      const professionalRole = user.roles.find((role) =>
        ['INSTRUCTOR', 'SCHOOL_ADMIN', 'SCHOOL_STAFF'].includes(role)
      );
      setCurrentRole(professionalRole || user.roles[0]);
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

      if (workspace.provider.type === 'DRIVING_SCHOOL') {
        try {
          const [memberships, complianceSummary] = await Promise.all([
            dbService.listSchoolMemberships(workspace.provider.id),
            dbService.getSchoolInstructorComplianceSummary(workspace.provider.id),
          ]);
          setSchoolInstructors(memberships);
          setSchoolInstructorSummary(complianceSummary);
        } catch (error) {
          console.warn('School instructors load failed:', error);
          setSchoolInstructors([]);
          setSchoolInstructorSummary([]);
        }
      } else {
        setSchoolInstructors([]);
        setSchoolInstructorSummary([]);
      }

      const isInstructorUser = user?.role === 'INSTRUCTOR' || (user?.roles && user.roles.includes('INSTRUCTOR'));
      if (isInstructorUser) {
        const [unifiedBookingsResult, globalBlocksResult, globalDocumentsResult] = await Promise.allSettled([
          dbService.getMyUnifiedInstructorBookings(),
          dbService.getMyInstructorGlobalBlocks(),
          workspace.provider.type === 'INSTRUCTOR'
            ? dbService.listMyGlobalCompliance()
            : Promise.resolve([] as ComplianceDocument[]),
        ]);

        if (unifiedBookingsResult.status === 'fulfilled') {
          setBookings(unifiedBookingsResult.value || []);
        } else {
          console.error('Unified instructor bookings load failed:', unifiedBookingsResult.reason);
          setUnifiedCalendarError('Não foi possível carregar a agenda unificada do instrutor. Tente novamente.');
          setBookings([]);
        }

        if (globalBlocksResult.status === 'fulfilled') {
          setInstructorGlobalBlocks(globalBlocksResult.value || []);
        } else {
          console.warn('Failed to load instructor global blocks:', globalBlocksResult.reason);
          setInstructorGlobalBlocks([]);
        }

        let effectiveComplianceDocuments = workspace.complianceDocuments;
        if (globalDocumentsResult.status === 'fulfilled' && workspace.provider.type === 'INSTRUCTOR') {
          const seen = new Set(effectiveComplianceDocuments.map((document) => document.id));
          effectiveComplianceDocuments = [
            ...effectiveComplianceDocuments,
            ...globalDocumentsResult.value.filter((document) =>
              document.scope === 'USER_GLOBAL' &&
              document.userId === user?.id &&
              !seen.has(document.id)
            ),
          ];
        } else if (globalDocumentsResult.status === 'rejected') {
          console.warn('Failed to load instructor global compliance:', globalDocumentsResult.reason);
        }
        setComplianceDocs(effectiveComplianceDocuments);
      } else {
        setBookings(workspace.bookings);
        setComplianceDocs(workspace.complianceDocuments);
      }
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
        isActive: exception.is_active !== false,
      })));
    } catch (err: any) {
      console.error('Provider workspace load failed:', err);
      if (isSilent) return;
      setProviders([]);
      setVehicles([]);
      setOfferings([]);
      setSchoolInstructors([]);
      setSchoolInstructorSummary([]);
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
        const [avatarUrl, destination] = await Promise.all([getMyProfileAvatar(), dbService.getMyPixDestination()]);
        setProfileAvatar(avatarUrl);
        setPixDestination(destination);
      } else {
        // Schedule and Management share the provider workspace source; only the
        // visible tab consumes the refreshed state below.
        await loadWorkspace(activeProviderId, { silent: true });
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
    setOfferingForm((previous) => ({ ...previous, instructorId: '' }));
  }, [activeProviderId]);

  useEffect(() => {
    setProfileAvatar(user?.avatarUrl);
    if (user?.id) {
      void getMyProfileAvatar().then((avatarUrl) => setProfileAvatar(avatarUrl)).catch(() => undefined);
      void dbService.getMyPixDestination().then((destination) => setPixDestination(destination)).catch(() => undefined);
    }
  }, [user?.avatarUrl]);

  const handleSavePixDestination = async (input: Pick<PixDestination, 'keyType' | 'pixKey' | 'holderName' | 'holderDocument'>) => {
    if (isSavingPixDestination) return;
    setIsSavingPixDestination(true);
    try {
      const saved = await dbService.saveMyPixDestination(input);
      setPixDestination(saved);
    } catch (error: any) {
      setWorkspaceError(mapFriendlyErrorMessage(error, 'Não foi possível salvar o destino Pix.'));
    } finally {
      setIsSavingPixDestination(false);
    }
  };

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
      return (
        (b.status === 'CONFIRMED' || b.status === 'IN_PROGRESS' || b.status === 'PENDING_PAYMENT') &&
        !ended &&
        isBookingTodayInSaoPaulo(b)
      );
    }
    if (bookingFilterTab === 'upcoming') {
      if (ended || b.status === 'EXPIRED') return false;
      if (isBookingTodayInSaoPaulo(b)) return false;
      return b.status === 'CONFIRMED' || b.status === 'IN_PROGRESS' || b.status === 'PENDING_PAYMENT';
    }
    if (bookingFilterTab === 'history') {
      return getStudentBookingSection(b.status, b) === 'HISTORY' || ended;
    }
    return false;
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
      return;
    } catch (err: any) {
      const message = mapFriendlyErrorMessage(err, 'Não foi possível realizar o check-in.');
      setBookingActionError(message);
      return message;
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
  const resetAvailabilityRuleForm = () => {
    setEditingAvailabilityRuleId(null);
    setRuleForm({ dayOfWeek: 'MONDAY', startTime: '08:00', endTime: '12:00' });
    setRuleError(null);
  };

  const handleOpenCreateAvailabilityRule = () => {
    resetAvailabilityRuleForm();
    setIsAddRuleModalOpen(true);
  };

  const handleOpenEditAvailabilityRule = (rule: AvailabilityRule) => {
    setEditingAvailabilityRuleId(rule.id);
    setRuleForm({ dayOfWeek: rule.dayOfWeek, startTime: rule.startTime, endTime: rule.endTime });
    setRuleError(null);
    setIsAddRuleModalOpen(true);
  };

  const handleSaveAvailabilityRule = async () => {
    if (isSavingAvailabilityRule) return;
    setRuleError(null);
    setIsSavingAvailabilityRule(true);
    try {
      enforceAvailabilityOwnership({
        targetProviderId: currentProvider.id,
        actorProviderId: currentProvider.id,
        actorRole: currentRole,
        providerStatus: currentProvider.status,
      });

      const originalRule = editingAvailabilityRuleId
        ? availabilityRules.find((rule) => rule.id === editingAvailabilityRuleId)
        : undefined;
      if (editingAvailabilityRuleId && !originalRule) {
        throw new Error('A regra semanal não está mais disponível. Atualize a agenda e tente novamente.');
      }

      const draftRule: AvailabilityRule = originalRule
        ? {
          ...originalRule,
          dayOfWeek: ruleForm.dayOfWeek,
          startTime: ruleForm.startTime,
          endTime: ruleForm.endTime,
          timezone: originalRule.timezone || 'America/Sao_Paulo',
        }
        : {
          id: `rule_${Date.now()}`,
          providerId: currentProvider.id,
          dayOfWeek: ruleForm.dayOfWeek,
          startTime: ruleForm.startTime,
          endTime: ruleForm.endTime,
          timezone: 'America/Sao_Paulo',
          isActive: true,
        };

      const newRule = normalizeWeeklyAvailabilityRuleForProvider(draftRule, currentProvider.type);

      validateAvailabilityRule(newRule, availabilityRules);

      const dayNumbers: Record<DayOfWeek, number> = { SUNDAY: 0, MONDAY: 1, TUESDAY: 2, WEDNESDAY: 3, THURSDAY: 4, FRIDAY: 5, SATURDAY: 6 };
      const savedRule = await dbService.saveAvailabilityRule({ ...newRule, dayOfWeekNumber: dayNumbers[newRule.dayOfWeek] });
      const mappedSavedRule: AvailabilityRule = {
        ...newRule,
        id: savedRule.id || newRule.id,
        dayOfWeekNumber: savedRule.day_of_week ?? dayNumbers[newRule.dayOfWeek],
        startTime: savedRule.start_time?.slice(0, 5) || newRule.startTime,
        endTime: savedRule.end_time?.slice(0, 5) || newRule.endTime,
        timezone: savedRule.timezone || newRule.timezone,
        isActive: savedRule.is_active ?? newRule.isActive,
      };
      setAvailabilityRules((prev) => editingAvailabilityRuleId
        ? prev.map((rule) => rule.id === mappedSavedRule.id ? mappedSavedRule : rule)
        : [...prev, mappedSavedRule]);
      setIsAddRuleModalOpen(false);
      resetAvailabilityRuleForm();
    } catch (err: any) {
      setRuleError(mapFriendlyErrorMessage(err, 'Não foi possível salvar a regra semanal.'));
    } finally {
      setIsSavingAvailabilityRule(false);
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
      if (exceptionForm.id) {
        const currentException = availabilityExceptions.find((exception) => exception.id === exceptionForm.id);
      if (currentException && new Date(currentException.startAt).getTime() <= Date.now()) {
          throw new Error('Bloqueios iniciados são históricos e não podem ser editados.');
        }
      }
      enforceAvailabilityOwnership({
        targetProviderId: currentProvider.id,
        actorProviderId: currentProvider.id,
        actorRole: currentRole,
        providerStatus: currentProvider.status,
        targetVehicleId: exceptionForm.vehicleId || undefined,
        providerVehicles: vehicles,
      });
      if (!exceptionForm.reasonCategory) {
        throw new Error('Selecione um motivo para o bloqueio.');
      }

      const { startAt: startAtISO, endAt: endAtISO } = buildFullDayBlockRange({
        startDate: exceptionForm.startDate,
        inclusiveEndDate: exceptionForm.endDate,
      });

      const newException: AvailabilityException = {
        id: exceptionForm.id || `exc_${Date.now()}`,
        providerId: currentProvider.id,
        type: exceptionForm.type,
        reasonCategory: exceptionForm.reasonCategory,
        reason: exceptionForm.reason || 'Bloqueio administrativo registrado',
        startAt: startAtISO,
        endAt: endAtISO,
        vehicleId: exceptionForm.vehicleId || undefined,
        isActive: true,
      };

      validateAvailabilityException(newException);

      const savedException = await dbService.saveAvailabilityException(newException);
      setAvailabilityExceptions((prev) => exceptionForm.id
        ? prev.map((exception) => exception.id === exceptionForm.id ? { ...newException, id: savedException.id } : exception)
        : [...prev, { ...newException, id: savedException.id }]);
      setIsAddExceptionModalOpen(false);
      setExceptionForm({
        id: undefined,
        type: 'BLOCK',
        reasonCategory: '' as ExceptionReasonCategory,
        reason: '',
        startDate: '',
        endDate: '',
        vehicleId: '',
      });
    } catch (err: any) {
      setExceptionError(mapFriendlyErrorMessage(err, 'Erro ao criar exceção de agenda.'));
    }
  };

  const handleDeleteAvailabilityException = async (exceptionId: string) => {
    try {
      const currentException = availabilityExceptions.find((exception) => exception.id === exceptionId);
      if (currentException && new Date(currentException.endAt).getTime() <= Date.now()) {
        throw new Error('Bloqueios encerrados são históricos e não podem ser excluídos.');
      }
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

  const handleDeactivateAvailabilityException = async (exceptionId: string) => {
    try {
      await dbService.deactivateAvailabilityException(exceptionId);
      setAvailabilityExceptions((prev) => prev.map((exception) => exception.id === exceptionId ? { ...exception, isActive: false } : exception));
    } catch (err: any) {
      alert(mapFriendlyErrorMessage(err, 'Não foi possível desativar o bloqueio.'));
    }
  };

  const handleActivateAvailabilityException = async (exceptionId: string) => {
    try {
      const currentException = availabilityExceptions.find((exception) => exception.id === exceptionId);
      if (!currentException || new Date(currentException.startAt).getTime() <= Date.now()) {
        throw new Error('Somente bloqueios futuros podem ser ativados.');
      }
      await dbService.activateAvailabilityException(exceptionId);
      setAvailabilityExceptions((prev) => prev.map((exception) => exception.id === exceptionId ? { ...exception, isActive: true } : exception));
    } catch (err: any) {
      alert(mapFriendlyErrorMessage(err, 'Não foi possível ativar o bloqueio.'));
    }
  };

  // Vehicle Handlers
  const resetVehicleForm = () => {
    setVehicleForm({
      brand: '', model: '', year: '', licensePlate: '', category: 'B', vehicleType: 'CAR',
      transmission: 'MANUAL', color: 'Prata',
      photoUrl: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=400&q=80',
    });
  };

  const handleOpenAddVehicle = () => {
    setEditingVehicleId(null);
    resetVehicleForm();
    setVehicleError(null);
    setIsAddVehicleModalOpen(true);
  };

  const handleOpenEditVehicle = (vehicleId: string) => {
    const vehicle = vehicles.find((item) => item.id === vehicleId);
    if (!vehicle) return;
    setEditingVehicleId(vehicleId);
    setVehicleForm({
      brand: vehicle.brand,
      model: vehicle.model,
      year: vehicle.year,
      licensePlate: vehicle.licensePlate,
      category: vehicle.category,
      vehicleType: vehicle.vehicleType,
      transmission: vehicle.transmission,
      color: vehicle.color || '',
      photoUrl: vehicle.photos?.[0] || '',
    });
    setVehicleError(null);
    setIsAddVehicleModalOpen(true);
  };

  const handleSaveVehicle = async () => {
    setVehicleError(null);
    const vehicleYear = vehicleForm.year;
    if (vehicleYear === '') {
      setVehicleError('Informe o ano do veículo.');
      return;
    }
    if (vehicleYear < new Date().getFullYear() - 12) {
      setVehicleError(`O veículo deve ter no máximo 12 anos de fabricação (a partir de ${new Date().getFullYear() - 12}).`);
      return;
    }
    try {
      const vehiclePayload = editingVehicleId
        ? {
          id: editingVehicleId,
          providerId: currentProvider.id,
          brand: vehicleForm.brand,
          model: vehicleForm.model,
          year: vehicleYear,
          licensePlate: vehicleForm.licensePlate,
          category: vehicleForm.category,
          vehicleType: vehicleForm.vehicleType,
          transmission: vehicleForm.transmission,
          color: vehicleForm.color,
          photos: vehicleForm.photoUrl ? [vehicleForm.photoUrl] : [],
        }
        : createVehicleDraft({
        providerId: currentProvider.id,
        brand: vehicleForm.brand,
        model: vehicleForm.model,
        year: vehicleYear,
        licensePlate: vehicleForm.licensePlate,
        category: vehicleForm.category,
        vehicleType: vehicleForm.vehicleType,
        transmission: vehicleForm.transmission,
        color: vehicleForm.color,
        photos: vehicleForm.photoUrl ? [vehicleForm.photoUrl] : [],
        autoSubmitForReview: true,
      });

      const savedVehicle = await dbService.saveVehicle(vehiclePayload);
      setVehicles((prev) => editingVehicleId
        ? prev.map((vehicle) => vehicle.id === editingVehicleId ? savedVehicle : vehicle)
        : [...prev, savedVehicle]);
      setIsAddVehicleModalOpen(false);
      setEditingVehicleId(null);
      resetVehicleForm();
    } catch (err: any) {
      setVehicleError(mapFriendlyErrorMessage(err, 'Erro ao cadastrar veículo.'));
    }
  };

  const handleToggleVehicleStatus = async (vehicleId: string) => {
    try {
      const targetVehicle = vehicles.find((v) => v.id === vehicleId);
      if (!targetVehicle) return;

      const savedVehicle = targetVehicle.status === 'ACTIVE'
        ? await dbService.deactivateVehicle(vehicleId)
        : targetVehicle.status === 'INACTIVE'
        ? await dbService.activateVehicle(vehicleId)
        : (() => { throw new Error('A reativação do veículo depende de nova aprovação administrativa.'); })();
      setVehicles((prev) => prev.map((vehicle) => (vehicle.id === vehicleId ? savedVehicle : vehicle)));
    } catch (err: any) {
      setVehicleError(mapFriendlyErrorMessage(err, 'Ação de ativação do veículo não permitida.'));
    }
  };

  // Offering Handlers
  const handleCreateOffering = async () => {
    setOfferingError(null);
    setOfferingNotice(null);
    try {
      const vehicle = vehicles.find((v) => v.id === offeringForm.vehicleId);
      if (!vehicle) {
        throw new Error('Selecione um veículo válido para a oferta.');
      }

      const instructorId = currentProvider.type === 'DRIVING_SCHOOL'
        ? offeringForm.instructorId
        : currentProvider.userId || user?.id || '';
      if (!instructorId) {
        throw new Error(currentProvider.type === 'DRIVING_SCHOOL'
          ? 'Selecione um instrutor ativo para a oferta.'
          : 'Não foi possível identificar o instrutor proprietário.');
      }

      if (currentProvider.type === 'DRIVING_SCHOOL') {
        const selectedInstructor = schoolInstructors.find((instructor) => instructor.userId === instructorId);
        const selectedCompliance = schoolInstructorSummary.find((entry) => entry.membershipId === selectedInstructor?.id);
        if (!selectedInstructor || selectedInstructor.membershipStatus !== 'ACTIVE' || !selectedInstructor.isActive || selectedCompliance?.eligible !== true) {
          throw new Error('Selecione um instrutor ativo e elegível para a oferta.');
        }
      }

      const priceInCents = parseBrlToCents(offeringForm.priceInBrl);

      const newOffering = createServiceOffering({
        providerId: currentProvider.id,
        instructorId,
        vehicle,
        category: vehicle.category,
        durationMinutes: Number(offeringForm.durationMinutes),
        priceInCents,
        initialStatus: currentProvider.status === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE',
        existingOfferings: offerings,
      });

      const savedOffering = await dbService.saveOffering(newOffering);
      setOfferings((prev) => [...prev, savedOffering]);
      if (savedOffering.status !== 'ACTIVE') {
        setOfferingNotice('Oferta cadastrada como inativa. Ela só poderá ser publicada após a aprovação do prestador.');
      }
      setIsAddOfferingModalOpen(false);
      setOfferingForm({
        vehicleId: '',
        instructorId: '',
        category: 'B',
        durationMinutes: 50,
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
      setOfferingError(mapFriendlyErrorMessage(err, 'Ação de ativação da oferta não permitida.'));
    }
  };

  const handleViewComplianceDocument = async (document: ComplianceDocument) => {
    try {
      const signedUrl = await dbService.createComplianceDocumentSignedUrl(document);
      window.open(signedUrl, '_blank', 'noopener,noreferrer');
    } catch (error: any) {
      setComplianceTermsError(mapFriendlyErrorMessage(error, 'Não foi possível abrir o arquivo enviado.'));
    }
  };

  const handleSaveProfile = async () => {
    if (isSavingProfile) return;
    setIsSavingProfile(true);
    if (currentProvider?.type === 'DRIVING_SCHOOL' && !profileForm.legalName.trim()) {
      setProfileFormError('Informe a razão social da autoescola.');
      setIsSavingProfile(false);
      return;
    }
    if (currentProvider?.type === 'DRIVING_SCHOOL' && profileForm.commercialEmail.trim()
      && !/^\S+@\S+\.\S+$/.test(profileForm.commercialEmail.trim())) {
      setProfileFormError('Informe um e-mail de contato válido.');
      setIsSavingProfile(false);
      return;
    }
    const radiusKm = normalizeServiceRadius(profileForm.serviceRadiusKm);
    const cleanPhone = normalizePhone(profileForm.publicContact);
    const cleanState = maskStateUF(profileForm.state);
    const cleanName = profileForm.displayName.trim();
    const cleanNeighborhood = profileForm.neighborhood.trim();
    const cleanCity = profileForm.city.trim() || profileForm.address?.city?.trim() || '';
    const addressState = profileForm.address?.stateCode || profileForm.address?.state || '';
    const resolvedState = cleanState || addressState.trim().toUpperCase();
    const cleanBio = profileForm.bio.trim();
    let profileFormForSave = profileForm;
    if (profileForm.locationMode === 'NO_HOUSE_NUMBER'
      && profileForm.addressLine1.trim()
      && cleanCity
      && resolvedState
      && (!profileForm.address || profileForm.address.confirmationMethod !== 'GEOAPIFY')) {
      try {
        const streetAddress = await resolveProviderAddress({
          street: profileForm.addressLine1.trim(),
          houseNumber: null,
          postalCode: profileForm.postalCode.replace(/\D/g, ''),
          city: cleanCity,
          stateCode: resolvedState,
          countryCode: 'br'
        });
        profileFormForSave = {
          ...profileForm,
          address: { ...streetAddress, locationMode: 'NO_HOUSE_NUMBER', noHouseNumber: true, locationConfirmed: true, confirmationMethod: 'GEOAPIFY' }
        };
      } catch {
        // The normal validation below reports the missing address clearly.
      }
    }
    const addressValidation = validateProviderAddressForm(profileFormForSave);
    const hasStandardAddressInput = addressValidation.mode === 'STANDARD_ADDRESS'
      && profileForm.addressLine1.trim()
      && profileForm.houseNumber.trim()
      && profileForm.postalCode.trim()
      && cleanCity
      && resolvedState;
    if (!addressValidation.valid && addressValidation.mode !== 'STANDARD_ADDRESS' && (profileFormForSave.addressLine1.trim() || profileFormForSave.city.trim() || profileFormForSave.address)) {
      setProfileFormError(addressValidation.reason || 'Confirme o endereço profissional antes de salvar.');
      setIsSavingProfile(false);
      return;
    }
    if (!addressValidation.valid && addressValidation.mode === 'STANDARD_ADDRESS' && !hasStandardAddressInput) {
      setProfileFormError(addressValidation.reason || 'Preencha o endereço profissional antes de salvar.');
      setIsSavingProfile(false);
      return;
    }
    let cleanAddress = profileFormForSave.address ? { ...profileFormForSave.address, complement: profileFormForSave.complement.trim() || undefined } : null;
    if (hasStandardAddressInput) {
      try {
        cleanAddress = await resolveProviderAddress({ street: profileForm.addressLine1.trim(), houseNumber: profileForm.houseNumber.trim(), postalCode: profileForm.postalCode.replace(/\D/g, ''), city: cleanCity, stateCode: resolvedState, countryCode: 'br' });
        cleanAddress.complement = profileForm.complement.trim() || undefined;
      } catch (error) {
        setProfileFormError(mapFriendlyErrorMessage(error, 'Não foi possível confirmar o endereço. Selecione um endereço manualmente ou revise o CEP e o número.'));
        setIsSavingProfile(false);
        return;
      }
    } else if (addressValidation.mode === 'STANDARD_ADDRESS' && (cleanNeighborhood || cleanCity)) {
      cleanAddress = { addressLine1: profileForm.addressLine1.trim(), neighborhood: cleanNeighborhood, city: cleanCity, state: resolvedState, postalCode: profileForm.postalCode.trim(), source: 'LEGACY' as const };
    }

    try {
      await dbService.updateMyProfile(
        cleanName || user?.name || '',
        cleanPhone || user?.phone || '',
        profileAvatar
      );
      const addressPayload = buildProviderAddressPayload({
        addressLine1: profileFormForSave.addressLine1,
        houseNumber: profileFormForSave.houseNumber,
        complement: profileFormForSave.complement,
        postalCode: profileFormForSave.postalCode,
        neighborhood: cleanNeighborhood,
        city: cleanCity,
        state: resolvedState,
        address: cleanAddress || undefined,
      });
      await dbService.updateProviderProfile(currentProvider.id, {
        name: cleanName,
        publicContact: cleanPhone,
        serviceRadiusKm: radiusKm,
        bio: cleanBio,
        ...addressPayload,
        ...(currentProvider.type === 'DRIVING_SCHOOL' ? {
          legalName: profileForm.legalName.trim(),
          commercialEmail: profileForm.commercialEmail.trim(),
        } : {}),
      });
    } catch (error: any) {
      setProfileFormError(mapFriendlyErrorMessage(error, 'Não foi possível salvar o perfil do prestador.'));
      setIsSavingProfile(false);
      return;
    }
    void loadWorkspace(currentProvider.id);
    setProfileFormError(null);
    setIsSavingProfile(false);
    setIsEditingProfile(false);
  };

  const handleComplianceFileUpload = async () => {
    if (!uploadModalDocType || !selectedComplianceFile || !currentProvider || !user) return;

    const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg'];
    if (!allowedTypes.includes(selectedComplianceFile.type)) {
      setComplianceUploadError('Selecione um arquivo PDF, PNG ou JPG.');
      return;
    }
    if (selectedComplianceFile.size > 10 * 1024 * 1024) {
      setComplianceUploadError('O arquivo deve ter no máximo 10 MB.');
      return;
    }

    setIsUploadingCompliance(true);
    setComplianceUploadError(null);
    const documentId = crypto.randomUUID();
    const safeFileName = selectedComplianceFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    // Storage remains private and uses the provider-owned folder policy. The
    // compliance RPC, not the client payload, decides row ownership and scope.
    const storagePath = `providers/${currentProvider.id}/compliance/${documentId}/${safeFileName}`;
    const isGlobalDocument = USER_GLOBAL_COMPLIANCE_DOCUMENT_TYPES.has(uploadModalDocType);

    try {
      const { error: uploadError } = await supabase.storage
        .from('provider-compliance-docs')
        .upload(storagePath, selectedComplianceFile, {
          contentType: selectedComplianceFile.type,
          upsert: false,
        });
      if (uploadError) throw uploadError;

      await dbService.saveComplianceDoc({
        providerId: isGlobalDocument ? undefined : currentProvider.id,
        type: uploadModalDocType,
        storagePath,
status: 'IN_REVIEW',
        scope: isGlobalDocument ? 'USER_GLOBAL' : 'PROVIDER',
      });

      setSelectedComplianceFile(null);
      setUploadModalDocType(null);
      await loadWorkspace(currentProvider.id, { silent: true });
    } catch (error) {
      console.error('Compliance document upload failed:', error);
      setComplianceUploadError('Não foi possível enviar o arquivo. Tente novamente.');
      await supabase.storage.from('provider-compliance-docs').remove([storagePath]).catch(() => undefined);
    } finally {
      setIsUploadingCompliance(false);
    }
  };

  const handleAcceptComplianceTerms = async () => {
    if (!currentProvider || !user || isAcceptingComplianceTerms) return;

    setIsAcceptingComplianceTerms(true);
    setComplianceTermsError(null);
    try {
      await dbService.saveComplianceDoc({
        providerId: currentProvider.id,
        type: 'MAZZI_TERMS_ACCEPTANCE',
        storagePath: 'acceptance://mazzi-ethics/v1',
        status: 'APPROVED',
        scope: 'PROVIDER',
      });
      await loadWorkspace(currentProvider.id, { silent: true });
    } catch (error) {
      console.error('Compliance terms acceptance failed:', error);
      setComplianceTermsError('Não foi possível registrar sua concordância. Tente novamente.');
    } finally {
      setIsAcceptingComplianceTerms(false);
    }
  };

  return (
    <div className="mazzi-app flex flex-col min-h-dvh bg-[#f7f5ef] text-[var(--mazzi-text)]">
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
            onOpenAddVehicleModal={() => {
              setManagementSubTab('vehicles');
              setActiveTab('management');
              setIsAddVehicleModalOpen(true);
            }}
            onOpenAddOfferingModal={() => setIsAddOfferingModalOpen(true)}
            calendarLoadError={unifiedCalendarError}
            isRefreshing={isRefreshingCurrentTab}
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
            onOpenAddRuleModal={handleOpenCreateAvailabilityRule}
            onOpenEditRule={handleOpenEditAvailabilityRule}
            onCloseAddRuleModal={() => setIsAddRuleModalOpen(false)}
            ruleForm={ruleForm}
            onRuleFormChange={setRuleForm}
            onSaveRule={handleSaveAvailabilityRule}
            editingRuleId={editingAvailabilityRuleId}
            isSavingRule={isSavingAvailabilityRule}
            onDeleteRule={handleDeleteAvailabilityRule}
            ruleError={ruleError}
            isAddExceptionModalOpen={isAddExceptionModalOpen}
            onOpenAddExceptionModal={() => {
              setExceptionForm({ id: undefined, type: 'BLOCK', reasonCategory: '' as ExceptionReasonCategory, reason: '', startDate: '', endDate: '', vehicleId: '' });
              setExceptionError(null);
              setIsAddExceptionModalOpen(true);
            }}
            onCloseAddExceptionModal={() => setIsAddExceptionModalOpen(false)}
            exceptionForm={exceptionForm}
            onExceptionFormChange={setExceptionForm}
            onSaveException={handleCreateAvailabilityException}
            onDeleteException={handleDeleteAvailabilityException}
            onDeactivateException={handleDeactivateAvailabilityException}
            onActivateException={handleActivateAvailabilityException}
            exceptionError={exceptionError}
            simOfferingId={simOfferingId}
            onSimOfferingIdChange={setSimOfferingId}
            simDate={simDate}
            onSimDateChange={setSimDate}
            instructorGlobalBlocks={instructorGlobalBlocks}
            bookings={bookings}
            calendarLoadError={unifiedCalendarError}
            onSaveEmergencyBlock={async (startAt, endAt, reason, blockId) => {
              if (blockId) {
                await dbService.saveInstructorGlobalBlock(startAt, endAt, reason, blockId);
              } else {
                await dbService.createInstructorEmergencyBlock(startAt, endAt, reason);
              }
              setInstructorGlobalBlocks(await dbService.getMyInstructorGlobalBlocks());
            }}
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
            isInstructorUser={currentProvider?.type === 'INSTRUCTOR' && (user?.role === 'INSTRUCTOR' || Boolean(user?.roles?.includes('INSTRUCTOR')))}
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
            schoolInstructors={schoolInstructors}
            schoolInstructorSummary={schoolInstructorSummary}
            isAddVehicleModalOpen={isAddVehicleModalOpen}
            onOpenAddVehicleModal={handleOpenAddVehicle}
            onOpenEditVehicle={handleOpenEditVehicle}
            onCloseAddVehicleModal={() => { setIsAddVehicleModalOpen(false); setEditingVehicleId(null); }}
            vehicleForm={vehicleForm}
            onVehicleFormChange={setVehicleForm}
            onSaveVehicle={handleSaveVehicle}
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
            offeringNotice={offeringNotice}
            onUploadDocClick={(type) => setUploadModalDocType(type)}
            onAcceptComplianceTerms={() => void handleAcceptComplianceTerms()}
            onViewComplianceDocument={(document) => { void handleViewComplianceDocument(document); }}
            isAcceptingComplianceTerms={isAcceptingComplianceTerms}
            complianceTermsError={complianceTermsError}
          />
        )}

        {/* TAB 5: PROFILE */}
        {activeTab === 'profile' && (
          <ProviderProfileTab
            currentProvider={currentProvider}
            complianceDocs={complianceDocs}
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
                setProfileFormError(null);
                setProfileForm({
                  displayName: currentProvider.name || '',
                  legalName: currentProvider.legalName || '',
                  publicContact: currentProvider.publicContact || user?.phone || '',
                  commercialEmail: currentProvider.commercialEmail || '',
                  neighborhood: currentProvider.neighborhood || '',
                  city: currentProvider.city || '',
                  state: currentProvider.state || 'SP',
                  serviceRadiusKm: currentProvider.serviceRadiusKm || 6,
                  bio: currentProvider.bio || '',
                  addressLine1: currentProvider.address?.addressLine1 || currentProvider.address?.formatted || '',
                  houseNumber: currentProvider.address?.houseNumber || '',
                  complement: currentProvider.address?.complement || '',
                  postalCode: currentProvider.address?.postalCode || '',
                  address: currentProvider.address,
                  locationMode: currentProvider.address?.locationMode || 'STANDARD_ADDRESS',
                  approximateLatitude: currentProvider.latitude,
                  approximateLongitude: currentProvider.longitude,
                });
              }
              setIsEditingProfile((prev) => !prev);
            }}
            profileForm={profileForm}
            onProfileFormChange={setProfileForm}
            onSaveProfile={handleSaveProfile}
            formError={profileFormError}
            isSavingProfile={isSavingProfile}
            pixDestination={pixDestination}
            onSavePixDestination={handleSavePixDestination}
            isSavingPixDestination={isSavingPixDestination}
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
          size="lg"
        >
          <BookingChatPanel booking={selectedBookingForChat} />
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
            <NotificationsPanel appContext="PRO" />
          </div>
        </Modal>
      )}

      {/* Upload Document Modal */}
      {uploadModalDocType && (
        <Modal
          isOpen={true}
          onClose={() => {
            if (!isUploadingCompliance) {
              setSelectedComplianceFile(null);
              setComplianceUploadError(null);
              setUploadModalDocType(null);
            }
          }}
          title="Envio de Documento de Compliance"
        >
          <div className="space-y-4 text-left">
            {complianceUploadError && (
              <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{complianceUploadError}</span>
              </div>
            )}
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
              <Info className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
              <p>
                Os documentos anexados são criptografados e armazenados em <strong>Storage Privado Seguro</strong>. Apenas a equipe de compliance da MAZZI terá acesso.
              </p>
            </div>

            <div className="p-6 border-2 border-dashed border-slate-300 rounded-2xl text-center space-y-2 hover:border-[#202126] transition">
              <Upload className="w-8 h-8 text-slate-400 mx-auto" />
              <p className="text-xs font-bold text-slate-700">
                {selectedComplianceFile?.name || 'Selecione o arquivo (PDF, PNG ou JPG)'}
              </p>
              <p className="text-[11px] text-slate-500">Tamanho máximo: 10 MB</p>
              <input
                id="compliance-document-file"
                type="file"
                accept="application/pdf,image/png,image/jpeg"
                className="sr-only"
                onChange={(event) => {
                  setSelectedComplianceFile(event.target.files?.[0] || null);
                  setComplianceUploadError(null);
                }}
                disabled={isUploadingCompliance}
              />
              <label
                htmlFor="compliance-document-file"
                className="mx-auto inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 shadow-xs transition hover:border-slate-300 hover:bg-slate-50 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-slate-900"
              >
                <Upload className="h-3.5 w-3.5 text-amber-600" aria-hidden="true" />
                Selecionar arquivo
              </label>
            </div>

            <div className="mazzi-modal-actions flex justify-end gap-2">
              <Button
                variant="dangerSoft"
                size="sm"
                disabled={isUploadingCompliance}
                onClick={() => {
                  setSelectedComplianceFile(null);
                  setComplianceUploadError(null);
                  setUploadModalDocType(null);
                }}
              >
                Cancelar
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={!selectedComplianceFile || isUploadingCompliance}
                onClick={() => void handleComplianceFileUpload()}
              >
                {isUploadingCompliance ? 'Enviando...' : 'Enviar Documento'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

/* TASK-008 & TASK-009 Static Contract Integrity: Confirmar cancelamento Voltar sem cancelar Cancelar agendamento w-1/2 font-bold MessageSquare Ban ArrowLeft */

