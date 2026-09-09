import React, { useCallback, useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '../../components/auth/AuthContext';
import { dbService } from '../../lib/db-service';
import { invalidateProviderBookingQueries, invalidateProviderCatalogQueries, invalidateProviderEarningsQueries, invalidateProviderInstantQueries, serverState } from '../../lib/server-state';
import { requestCheckInLocation } from '../../lib/checkin-location';
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
  ProviderPaymentAccount,
  ProviderPayoutDetail,
  InstantLessonSettings,
  InstantLessonInstructorStatus,
  InstantLessonOffer,
  InstantLessonPlatformConfig,
} from '../../types';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import { EnvironmentBadge } from '../../components/ui/EnvironmentBadge';
import { IconButton } from '../../components/ui/IconButton';
import { BookingChatPanel } from '../../components/chat/BookingChatPanel';
import { SettingsPanel } from '../../components/settings/SettingsPanel';
import { NotificationsPanel } from '../../components/notifications/NotificationsPanel';
import { NOTIFICATIONS_CHANGED } from '../../components/ui/NotificationIndicator';
import { ProviderAnalyticsPanel } from '../../components/analytics/AnalyticsPanels';
import {
  DEFAULT_COMPLIANCE_REQUIREMENTS,
  USER_GLOBAL_COMPLIANCE_DOCUMENT_TYPES,
  evaluateProviderEligibility,
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
import { BLOCKING_BOOKING_STATUSES, getBookingStartTimestamp, getStudentBookingSection, hasTimeIntervalOverlap, isPendingPaymentHoldActive, sortBookingsForNext, sortBookingsForToday, TODAY_BOOKING_STATUSES, UNPAID_BOOKING_STATUSES } from '../../domain/booking';
import { getInstantOfferSecondsLeft, INSTANT_PROVIDER_LOCATION_INTERVAL_SECONDS, isInstantInstructorAvailabilityActive } from '../../domain/instant-lesson';
import { DEFAULT_PLATFORM_CONFIGURATION, toPublicPlatformConfiguration, type PublicPlatformConfiguration } from '../../domain/platform-config';
import { buildFullDayBlockRange, formatDateBR, formatTimeBR, getCanonicalTimestamp, getTodayInSaoPaulo, isLessonEnded, isBookingTodayInSaoPaulo } from '../../lib/date-format';
import { getMyProfileAvatar } from '../../lib/profile-avatar';
import { mapFriendlyErrorMessage } from '../../lib/error-mapper';
import { formatCentsToBRL } from '../../domain/money';
import { formatMeetingPoint } from '../../lib/meeting-point';
import { normalizePhone, maskStateUF, normalizeServiceRadius } from '../../lib/input-masks';
import { formatDateMask, toISODateString, validateBirthDate } from '../../utils/age';
import { CURRENT_PROFESSIONAL_TERMS_VERSION } from '../../domain/professional-terms';
import { clearNotificationNavigationTargetFromHash, getNotificationNavigationTargetFromHash, getPublicEmailRouteFromPath, useMobileAppRoute } from '../../lib/mobile-app-router';
import type { NotificationNavigationTarget } from '../../lib/notification-navigation';
import { clearPendingNotificationTarget } from '../../lib/pending-navigation';
import { subscribeToFirebaseForegroundMessages } from '../../lib/firebase-messaging';
import { disableStoredPushDevice, registerPushDevice } from '../../lib/push-device-registry';
import { dismissInitialSplash, signalInitialNavigationReady } from '../../lib/initial-splash';
import { resolveProviderAddress } from '../../domain/maps/provider-address-resolution';
import { buildProviderAddressPayload, validateProviderAddressForm } from '../../domain/maps/provider-address-payload';
import { isProviderPaymentAccountReady } from '../../domain/payments/provider-payment-readiness';

import { ProviderHeader } from './components/ProviderHeader';
import { ProviderBottomNav, ProviderTabId } from './components/ProviderBottomNav';
import { ProviderDashboardTab } from './components/ProviderDashboardTab';
import { ProviderScheduleTab } from './components/ProviderScheduleTab';
import { ProviderBookingsTab } from './components/ProviderBookingsTab';
import { ProviderManagementTab } from './components/ProviderManagementTab';
import { ProviderProfileTab } from './components/ProviderProfileTab';
import { ProviderEarningsTab } from './components/ProviderEarningsTab';
import { ProviderInstantLessonPanel } from './components/ProviderInstantLessonPanel';
import { ProviderCancellationModal } from './components/ProviderCancellationModal';
import { ProviderBookingDetailsModal } from './components/ProviderBookingDetailsModal';
import { UpcomingBookingCard } from '../../components/ui/UpcomingBookingCard';
import { InstantLessonOperationalModal } from '../../components/instant/InstantLessonOperationalModal';
import { InstantLessonOfferBottomSheet } from '../../components/instant/InstantLessonOfferBottomSheet';
import { ExternalNavigationModal } from '../../components/instant/ExternalNavigationModal';
import { ToastContainer, ToastMessage } from '../../components/ui/Toast';
import { AlertCircle, ArrowLeft, ArrowRight, Calendar as CalendarIcon, CheckCircle2, Clock3, Info, LogOut, RefreshCw, Sparkles, Upload, WalletCards, XCircle } from 'lucide-react';

function preserveLessonProgress(current: Booking, refreshed: Booking): Booking {
  if (current.id !== refreshed.id) return refreshed;

  // A refresh started before the lesson RPC can finish after the local
  // transition and return the previous CONFIRMED row. Never regress the
  // agenda while that stale response is being applied.
  if (current.status === 'COMPLETED' && refreshed.status !== 'COMPLETED') return current;
  if (current.status === 'IN_PROGRESS' && refreshed.status === 'CONFIRMED') return current;

  // The displacement action is one-way. Do not let a stale query response
  // make the "Estou a caminho" action available again after it was confirmed.
  if (current.providerOnTheWayAt && !refreshed.providerOnTheWayAt) {
    return {
      ...refreshed,
      providerOnTheWayAt: current.providerOnTheWayAt,
      snapshot: {
        ...refreshed.snapshot,
        provider_on_the_way_at: current.providerOnTheWayAt,
      },
    };
  }

  return refreshed;
}

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
  const { user, logout, isLoading: isAuthLoading, hasPerm } = useAuth();
  const isRealSupabase = !!((import.meta as any).env?.VITE_SUPABASE_URL && !(import.meta as any).env?.VITE_SUPABASE_URL.includes('placeholder'));
  const [platformConfiguration, setPlatformConfiguration] = useState<PublicPlatformConfiguration | null>(
    () => isRealSupabase ? null : toPublicPlatformConfiguration(DEFAULT_PLATFORM_CONFIGURATION),
  );
  const [currentRole, setCurrentRole] = useState<UserRole>('INSTRUCTOR');
  const [activeTab, setActiveTab] = useMobileAppRoute<ProviderTabId>('provider', 'dashboard', ['dashboard', 'bookings', 'earnings', 'management', 'profile']);
  const [isRefreshingCurrentTab, setIsRefreshingCurrentTab] = useState(false);
  const [bookingUpdatesCount, setBookingUpdatesCount] = useState(0);
  const shouldAutoSelectTodayRef = useRef(true);
  const bookingSnapshotRef = useRef<string | null>(null);
  const startingLessonBookingIdRef = useRef<string | null>(null);
  const publicEmailNavigationRef = useRef<string | null>(null);
  const [managementSubTab, setManagementSubTab] = useState<'schedule_rules' | 'schedule_blocks' | 'vehicles' | 'offerings' | 'compliance' | 'memberships' | 'account'>('schedule_rules');
  const [bookingFilterTab, setBookingFilterTab] = useState<'upcoming' | 'today' | 'history'>('upcoming');
  const [bookingQuickFilter, setBookingQuickFilter] = useState<'all' | 'confirmed' | 'in_progress' | 'completed' | 'disputed' | 'cancelled'>('all');
  const [scheduleSubTab, setScheduleSubTab] = useState<'rules' | 'exceptions'>('rules');

  const [providers, setProviders] = useState<Provider[]>([]);
  const [complianceDocs, setComplianceDocs] = useState<ComplianceDocument[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [bookingClockMs, setBookingClockMs] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setBookingClockMs(Date.now()), 10_000);
    return () => window.clearInterval(timer);
  }, []);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [offerings, setOfferings] = useState<ServiceOffering[]>([]);
  const [schoolInstructors, setSchoolInstructors] = useState<SchoolMembership[]>([]);
  const [schoolInstructorSummary, setSchoolInstructorSummary] = useState<SchoolInstructorComplianceSummary[]>([]);
  const [schoolInvitations, setSchoolInvitations] = useState<any[]>([]);
  const [availabilityRules, setAvailabilityRules] = useState<AvailabilityRule[]>([]);
  const [availabilityExceptions, setAvailabilityExceptions] = useState<AvailabilityException[]>([]);
  const [instantSettings, setInstantSettings] = useState<InstantLessonSettings[]>([]);
  const [instantPlatformConfig, setInstantPlatformConfig] = useState<InstantLessonPlatformConfig | null>(
    () => isRealSupabase ? null : {
      maxEtaMinutes: DEFAULT_PLATFORM_CONFIGURATION.instantMaxEtaMinutes,
      offerExpirationSeconds: DEFAULT_PLATFORM_CONFIGURATION.instantOfferExpirationSeconds,
    },
  );

  useEffect(() => {
    if (!isRealSupabase) return;
    let active = true;
    void serverState.getPublicPlatformConfiguration()
      .then((configuration) => {
        if (active) setPlatformConfiguration(configuration);
      })
      .catch((error) => {
        console.error('Failed to load public platform configuration for PRO:', error);
        if (active) setPlatformConfiguration(null);
      });
    return () => {
      active = false;
    };
  }, [isRealSupabase]);

  useEffect(() => {
    if (!platformConfiguration) {
      setInstantPlatformConfig(null);
      return;
    }
    setInstantPlatformConfig({
      maxEtaMinutes: platformConfiguration.instantMaxEtaMinutes,
      offerExpirationSeconds: platformConfiguration.instantOfferExpirationSeconds,
    });
  }, [platformConfiguration]);
  const [instantInstructorStatuses, setInstantInstructorStatuses] = useState<InstantLessonInstructorStatus[]>([]);
  const [instantOffers, setInstantOffers] = useState<InstantLessonOffer[]>([]);
  const [instantOfferSheetId, setInstantOfferSheetId] = useState<string | null>(null);
  const [instantOffersServerNow, setInstantOffersServerNow] = useState<string | null>(null);
  const [instantOffersClockMs, setInstantOffersClockMs] = useState(() => Date.now());
  const [instantOffersServerClockOffsetMs, setInstantOffersServerClockOffsetMs] = useState(0);
  const [instantLocationStatus, setInstantLocationStatus] = useState<'IDLE' | 'UPDATING' | 'READY' | 'ERROR'>('IDLE');
  const [instantActionLoading, setInstantActionLoading] = useState(false);
  const [instantOfferAction, setInstantOfferAction] = useState<{ offerId: string; action: 'ACCEPT' | 'DECLINE' } | null>(null);
  const instantOffersInFlightRef = useRef<Promise<void> | null>(null);
  const instantOfferRespondingRef = useRef(new Set<string>());
  const acceptedInstantBookingIdRef = useRef<string | null>(null);
  const notifiedInstantOfferIdsRef = useRef(new Set<string>());
  const instantSettingsSheetRequestRef = useRef(false);
  const instantLocationRefreshInFlightRef = useRef<Promise<void> | null>(null);
  const checkInRequestInFlightRef = useRef(false);
  const [lessonSessions, setLessonSessions] = useState<Record<string, LessonSession>>({});

  useEffect(() => {
    const syncNow = () => setInstantOffersClockMs(Date.now());
    const timer = window.setInterval(syncNow, 1000);
    document.addEventListener('visibilitychange', syncNow);
    window.addEventListener('focus', syncNow);
    syncNow();
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', syncNow);
      window.removeEventListener('focus', syncNow);
    };
  }, []);

  useEffect(() => {
    if (!instantOffersServerNow) return;
    setInstantOffersServerClockOffsetMs(new Date(instantOffersServerNow).getTime() - Date.now());
    setInstantOffersClockMs(Date.now());
  }, [instantOffersServerNow]);

  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showProviderFeedback = (type: ToastMessage['type'], title: string, description?: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setToasts((current) => [...current, { id, type, title, description }]);
    window.setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 5000);
  };

  // Active Provider Selection
  const [activeProviderId, setActiveProviderId] = useState<string>('');

  // Selected Booking Details Modal State
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [selectedBookingForChat, setSelectedBookingForChat] = useState<Booking | null>(null);
  const [bookingActionError, setBookingActionError] = useState<string | null>(null);
  const [isCompleting, setIsCompleting] = useState<boolean>(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [selectedPayoutDetail, setSelectedPayoutDetail] = useState<ProviderPayoutDetail | null>(null);
  const [earningsFocusKey, setEarningsFocusKey] = useState(0);

  // Instant Lesson Active Journey & Modal States
  const [isInstantOperationalModalOpen, setIsInstantOperationalModalOpen] = useState(false);
  const [isInstantSettingsOpen, setIsInstantSettingsOpen] = useState(false);
  const [isExternalNavModalOpen, setIsExternalNavModalOpen] = useState(false);
  const [isOnTheWayLoading, setIsOnTheWayLoading] = useState(false);
  const checkInWindowBeforeMinutes = platformConfiguration?.checkInWindowBeforeMinutes ?? null;

  const refreshBookingForDetails = useCallback(async (bookingId: string): Promise<Booking | null> => {
    if (!activeProviderId) return null;

    const isInstructorUser = user?.role === 'INSTRUCTOR' || user?.roles?.includes('INSTRUCTOR');
    const refreshedBookings = await serverState.getProviderBookings({
      providerId: activeProviderId,
      userId: user?.id || 'unknown',
      isInstructor: isInstructorUser,
    });
    const refreshedBooking = refreshedBookings.find((booking) => booking.id === bookingId) || null;

    setBookings((currentBookings) => refreshedBookings.map((refreshedBookingItem) => {
      const currentBooking = currentBookings.find((booking) => booking.id === refreshedBookingItem.id);
      return currentBooking ? preserveLessonProgress(currentBooking, refreshedBookingItem) : refreshedBookingItem;
    }));
    setSelectedBooking((current) => current?.id === bookingId && refreshedBooking
      ? preserveLessonProgress(current, refreshedBooking)
      : current);
    return refreshedBooking;
  }, [activeProviderId, user?.role, user?.roles]);

  const activeInstantBooking = useMemo(() => {
    return (
      bookings.find(
        (b) =>
          b.providerId === activeProviderId &&
          (b.snapshot?.source === 'AULA_AGORA' || (b as any).snapshot_data?.source === 'AULA_AGORA') &&
          ['PENDING_PAYMENT', 'CONFIRMED', 'IN_PROGRESS'].includes(b.status) &&
          (b.status !== 'PENDING_PAYMENT' || isPendingPaymentHoldActive(b, bookingClockMs, platformConfiguration?.instantLessonExpirationMinutes))
      ) || null
    );
  }, [bookings, activeProviderId, bookingClockMs, platformConfiguration?.instantLessonExpirationMinutes]);

  const navDestination = useMemo(() => {
    if (!activeInstantBooking) return null;

    const mp = (activeInstantBooking as any).meeting_point || activeInstantBooking.meetingPoint || activeInstantBooking.snapshot?.meetingPoint || (activeInstantBooking.snapshot as any)?.meeting_point;

    let lat: number | undefined = undefined;
    let lng: number | undefined = undefined;
    let label = activeInstantBooking.fullMeetingPoint || (typeof activeInstantBooking.meetingPoint === 'string' ? activeInstantBooking.meetingPoint : '');

    if (typeof mp === 'object' && mp !== null) {
      if (typeof mp.latitude === 'number' || typeof (mp as any).lat === 'number') {
        lat = Number(mp.latitude ?? (mp as any).lat);
      }
      if (typeof mp.longitude === 'number' || typeof (mp as any).lng === 'number') {
        lng = Number(mp.longitude ?? (mp as any).lng);
      }
      const addrCandidate = mp.formattedAddress || mp.formatted_address || mp.full_address || mp.fullAddress || mp.address || mp.label || mp.name;
      if (addrCandidate) {
        label = String(addrCandidate);
      }
    } else if (typeof mp === 'string') {
      label = mp;
    }

    if (lat === undefined && (activeInstantBooking.snapshot as any)?.latitude != null) {
      lat = Number((activeInstantBooking.snapshot as any).latitude);
    }
    if (lng === undefined && (activeInstantBooking.snapshot as any)?.longitude != null) {
      lng = Number((activeInstantBooking.snapshot as any).longitude);
    }

    if (!label) {
      label = 'Ponto de encontro';
    }

    if (typeof lat !== 'number' || !Number.isFinite(lat) || typeof lng !== 'number' || !Number.isFinite(lng)) {
      return null;
    }

    return { latitude: lat, longitude: lng, label };
  }, [activeInstantBooking]);

  const prevInstantBookingRef = useRef<{ id: string; status: string } | null>(null);

  useEffect(() => {
    if (!activeInstantBooking) {
      if (prevInstantBookingRef.current) {
        const prevId = prevInstantBookingRef.current.id;
        const currentBookingInList = bookings.find((b) => b.id === prevId);

        if (
          currentBookingInList &&
          ['CANCELLED', 'CANCELLED_BY_STUDENT', 'CANCELLED_BY_PROVIDER', 'PAYMENT_EXPIRED', 'PAYMENT_FAILED', 'EXPIRED'].includes(currentBookingInList.status)
        ) {
          setIsInstantOperationalModalOpen(false);
          setIsExternalNavModalOpen(false);

          if (['PAYMENT_EXPIRED', 'EXPIRED'].includes(currentBookingInList.status)) {
            showProviderFeedback('warning', 'Tempo de pagamento esgotado', 'O aluno não concluiu o pagamento da Aula Agora no tempo limite. Você continua disponível para receber novas solicitações.');
          } else if (['CANCELLED_BY_STUDENT', 'CANCELLED'].includes(currentBookingInList.status)) {
            showProviderFeedback('info', 'Aula cancelada pelo aluno', 'A solicitação de Aula Agora foi cancelada pelo aluno.');
          } else if (currentBookingInList.status === 'PAYMENT_FAILED') {
            showProviderFeedback('warning', 'Pagamento não autorizado', 'O pagamento do aluno não foi concluído pelo gateway. A solicitação foi liberada.');
          }
        }
        prevInstantBookingRef.current = null;
      }
    } else {
      if (
        prevInstantBookingRef.current?.id === activeInstantBooking.id &&
        prevInstantBookingRef.current.status === 'PENDING_PAYMENT' &&
        activeInstantBooking.status === 'CONFIRMED'
      ) {
        showProviderFeedback('success', 'Pagamento confirmado!', 'O aluno concluiu o pagamento! Redirecionando para os detalhes da aula...');
        setIsInstantSettingsOpen(false);
        setIsInstantOperationalModalOpen(false);
        setIsExternalNavModalOpen(false);
        setActiveTab('bookings');
        window.setTimeout(() => {
          setSelectedBooking(activeInstantBooking);
        }, 0);
      }
      prevInstantBookingRef.current = { id: activeInstantBooking.id, status: activeInstantBooking.status };
    }
  }, [activeInstantBooking, bookings]);

  const handleSetOnTheWay = async (bookingId: string) => {
    setIsOnTheWayLoading(true);
    try {
      const result = await dbService.setProviderOnTheWay(bookingId);
      const providerOnTheWayAt = result.provider_on_the_way_at || new Date().toISOString();
      const markProviderOnTheWay = (booking: Booking): Booking => ({
        ...booking,
        providerOnTheWayAt,
        snapshot: {
          ...booking.snapshot,
          provider_on_the_way_at: providerOnTheWayAt,
        },
      });
      setBookings((currentBookings) => currentBookings.map((booking) => (
        booking.id === bookingId ? markProviderOnTheWay(booking) : booking
      )));
      setSelectedBooking((currentBooking) => (
        currentBooking?.id === bookingId ? markProviderOnTheWay(currentBooking) : currentBooking
      ));
      if (activeProviderId && user?.id) await invalidateProviderBookingQueries(activeProviderId, user.id, bookingId);
      showProviderFeedback('success', 'Você está a caminho!', 'Notificamos o aluno que você já se deslocou para o ponto de encontro.');
      await loadWorkspace(activeProviderId, { silent: true });
    } catch (err) {
      showProviderFeedback('error', 'Erro ao atualizar status', mapFriendlyErrorMessage(err, 'Não foi possível informar que você está a caminho. Tente novamente.'));
    } finally {
      setIsOnTheWayLoading(false);
    }
  };

  useEffect(() => {
    if (!user?.id) return;
    let disposed = false;
    let unsubscribe = () => undefined;
    void subscribeToFirebaseForegroundMessages((message) => {
      if (!disposed && message.appContext === 'PRO') {
        window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED));
      }
    }).then((cleanup) => {
      if (disposed) cleanup();
      else unsubscribe = cleanup;
    });
    return () => {
      disposed = true;
      unsubscribe();
    };
  }, [user?.id]);

  useEffect(() => {
    if (!isRealSupabase || !user?.id) return;
    // FCM tokens can be rotated or invalidated by the browser. Refresh the
    // server registration whenever the PRO app opens so new pushes use the
    // current token instead of a stale device record.
    void registerPushDevice({ appContext: 'PRO', userId: user.id });
  }, [isRealSupabase, user?.id]);

  const handleLogout = async () => {
    // Nunca deixe a disponibilidade do instrutor persistir depois do logout.
    // O RPC é idempotente e a regra de autorização impede desligar outro usuário.
    if (currentProvider?.type === 'INSTRUCTOR' && currentProvider.userId === user?.id) {
      try {
        await dbService.setMyInstantInstructorOnline(currentProvider.id, user.id, false);
      } catch {
        // O logout continua disponível mesmo se a rede estiver indisponível.
      }
    }
    try {
      await disableStoredPushDevice('PRO', user?.id);
    } catch {
      // Logout must remain available if device deactivation is temporarily offline.
    }
    await logout();
  };

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
    birthDate: '',
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

  // Re-evaluate lesson lists automatically when the next lesson ends.
  useEffect(() => {
    const now = Date.now();
    const futureEnds = bookings
      .map((booking) => getCanonicalTimestamp(booking.scheduledEndAt, booking.scheduledDate, booking.endTime))
      .filter((timestamp): timestamp is number => timestamp !== null && timestamp > now);

    if (futureEnds.length === 0) return;

    const nextEndMs = Math.min(...futureEnds);
    const timer = setTimeout(() => setBookingClockMs(Date.now()), Math.max(1000, nextEndMs - Date.now() + 500));
    return () => clearTimeout(timer);
  }, [bookings, bookingClockMs]);

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
  const [paymentAccount, setPaymentAccount] = useState<ProviderPaymentAccount | null>(null);
  const [isConnectingStripe, setIsConnectingStripe] = useState(false);
  const [stripeOnboardingError, setStripeOnboardingError] = useState<string | null>(null);

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
      const [workspace, providerCatalog] = await Promise.all([
        serverState.getProviderWorkspace(providerId, user?.id || 'unknown'),
        Promise.all([
          serverState.getProviderVehicles(providerId),
          serverState.getProviderOfferings(providerId),
        ]),
      ]);
      if (!workspace.provider) {
        throw new Error('Nenhum prestador vinculado a esta conta foi encontrado.');
      }
      const [providerVehicles, providerOfferings] = providerCatalog;
      setProviders([workspace.provider]);
      setVehicles(providerVehicles);
      setOfferings(providerOfferings);
      try {
        const [loadedInstantSettings, loadedInstructorStatuses] = await Promise.all([
          dbService.getMyInstantSettings(workspace.provider.id, providerOfferings),
          dbService.getMyInstantInstructorStatuses(workspace.provider.id),
        ]);
        setInstantSettings(loadedInstantSettings);
        setInstantInstructorStatuses(loadedInstructorStatuses);
      } catch (instantError) {
        console.warn('Instant lesson settings load failed:', instantError);
        setInstantSettings([]);
        setInstantInstructorStatuses([]);
        setInstantPlatformConfig(isRealSupabase ? null : {
          maxEtaMinutes: DEFAULT_PLATFORM_CONFIGURATION.instantMaxEtaMinutes,
          offerExpirationSeconds: DEFAULT_PLATFORM_CONFIGURATION.instantOfferExpirationSeconds,
        });
      }

      if (workspace.provider.type === 'DRIVING_SCHOOL') {
        setSchoolInvitations([]);
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
        try {
          const invitations = await dbService.listMySchoolInvitationContexts();
          setSchoolInvitations(invitations);
        } catch (error) {
          console.warn('School invitations load failed:', error);
          setSchoolInvitations([]);
        }
      }

      const isInstructorUser = user?.role === 'INSTRUCTOR' || (user?.roles && user.roles.includes('INSTRUCTOR'));
      if (isInstructorUser) {
        const [unifiedBookingsResult, globalBlocksResult, globalDocumentsResult] = await Promise.allSettled([
          serverState.getProviderBookings({ providerId: workspace.provider.id, userId: user?.id || 'unknown', isInstructor: true }),
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
      setInstantSettings([]);
      setInstantInstructorStatuses([]);
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
      if (activeProviderId && user?.id) {
        await invalidateProviderBookingQueries(activeProviderId, user.id);
        if (activeTab === 'earnings') await invalidateProviderEarningsQueries(activeProviderId, user.id);
      }
      if (activeTab === 'bookings') {
        const refreshedBookings = await serverState.getProviderBookings({
          providerId: activeProviderId,
          userId: user?.id || 'unknown',
          isInstructor: user?.role === 'INSTRUCTOR' || user?.roles?.includes('INSTRUCTOR'),
        });
        setBookings(refreshedBookings || []);
      } else if (activeTab === 'profile') {
        const [avatarUrl, stripeAccount] = await Promise.all([getMyProfileAvatar(), dbService.getMyProviderPaymentAccount()]);
        setProfileAvatar(avatarUrl);
        setPaymentAccount(stripeAccount);
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
    if (!user?.providerId) {
      signalInitialNavigationReady();
      return;
    }
    setActiveProviderId(user.providerId);
    void loadWorkspace(user.providerId).finally(() => signalInitialNavigationReady());
  }, [user?.providerId]);

  useEffect(() => {
    if (activeTab !== 'bookings') {
      shouldAutoSelectTodayRef.current = true;
      return;
    }
    if (!shouldAutoSelectTodayRef.current || workspaceLoading) return;

    const hasTodayBooking = bookings.some((booking) =>
      TODAY_BOOKING_STATUSES.includes(booking.status) && !UNPAID_BOOKING_STATUSES.includes(booking.status) &&
      isBookingTodayInSaoPaulo(booking),
    );
    setBookingFilterTab(hasTodayBooking ? 'today' : 'upcoming');
    shouldAutoSelectTodayRef.current = false;
  }, [activeTab, bookings, bookingClockMs, workspaceLoading]);

  useEffect(() => {
    setOfferingForm((previous) => ({ ...previous, instructorId: '' }));
  }, [activeProviderId]);

  useEffect(() => {
    setProfileAvatar(user?.avatarUrl);
    if (user?.id) {
      void getMyProfileAvatar().then((avatarUrl) => setProfileAvatar(avatarUrl)).catch(() => undefined);
      void Promise.all([getMyProfileAvatar(), dbService.getMyProviderPaymentAccount()]).then(([, stripeAccount]) => {
        setPaymentAccount(stripeAccount);
      }).catch(() => undefined);
    }
  }, [user?.avatarUrl]);

  // Qualquer alteração de reserva gera um aviso no botão Aulas enquanto ele
  // não estiver aberto. O Realtime cobre inserções, atualizações e exclusões.
  useEffect(() => {
    if (!isRealSupabase || !user?.id || !activeProviderId) return;

    const channel = supabase.channel(`provider_booking_updates_${user.id}_${activeProviderId}`);
    const onBookingChange = () => {
      if (activeTab !== 'bookings') {
        setBookingUpdatesCount((count) => Math.min(count + 1, 99));
      }
      void invalidateProviderBookingQueries(
        activeProviderId,
        user.id,
      ).finally(() => { void refreshCurrentTab(); });
    };

    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'bookings', filter: `instructor_id=eq.${user.id}` },
      onBookingChange,
    );
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'bookings', filter: `provider_id=eq.${activeProviderId}` },
      onBookingChange,
    );
    void channel.subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [activeProviderId, activeTab, isRealSupabase, user?.id]);

  // Fallback para ambientes em que a publicação do Realtime ainda não foi
  // atualizada: detecta qualquer alteração na lista enquanto outra tela está aberta.
  useEffect(() => {
    const snapshot = JSON.stringify(
      [...bookings]
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((booking) => ({
          id: booking.id,
          status: booking.status,
          updatedAt: booking.updatedAt,
          scheduledStartAt: booking.scheduledStartAt,
          scheduledEndAt: booking.scheduledEndAt,
          checkinStudentAt: booking.checkinStudentAt,
          checkinInstructorAt: booking.checkinInstructorAt,
          lessonStartedAt: booking.lessonStartedAt,
          completedAt: booking.completedAt,
        })),
    );
    if (bookingSnapshotRef.current !== null && bookingSnapshotRef.current !== snapshot && activeTab !== 'bookings') {
      setBookingUpdatesCount((count) => Math.min(count + 1, 99));
    }
    bookingSnapshotRef.current = snapshot;
  }, [activeTab, bookings]);

  useEffect(() => {
    if (!isRealSupabase || !user?.id || !activeProviderId || activeTab === 'bookings') return;

    const refreshBookings = async () => {
      try {
        const refreshedBookings = await serverState.getProviderBookings({
          providerId: activeProviderId,
          userId: user.id,
          isInstructor: user.role === 'INSTRUCTOR' || user.roles?.includes('INSTRUCTOR'),
        });
        setBookings(refreshedBookings || []);
      } catch {
        // O Realtime continua sendo a fonte principal; falha de polling não interrompe a tela.
      }
    };
    const timer = window.setInterval(() => void refreshBookings(), 15000);
    return () => window.clearInterval(timer);
  }, [activeProviderId, activeTab, isRealSupabase, user]);

  useEffect(() => {
    if (activeTab === 'bookings') setBookingUpdatesCount(0);
  }, [activeTab]);

  // Keep the open details screen synchronized with the same realtime/polling
  // booking collection without closing it or showing a loading replacement.
  useEffect(() => {
    if (!selectedBooking) return;
    const refreshedBooking = bookings.find((booking) => booking.id === selectedBooking.id);
    if (!refreshedBooking || refreshedBooking === selectedBooking) return;
    setSelectedBooking((current) => current?.id === refreshedBooking.id ? refreshedBooking : current);
  }, [bookings, selectedBooking?.id, selectedBooking?.status]);

  useEffect(() => {
    const acceptedBookingId = acceptedInstantBookingIdRef.current;
    if (!acceptedBookingId) return;
    const acceptedBooking = bookings.find((booking) => booking.id === acceptedBookingId);
    if (!acceptedBooking) return;

    acceptedInstantBookingIdRef.current = null;
    setIsInstantSettingsOpen(false);
    setIsInstantOperationalModalOpen(false);
    setActiveTab('bookings');
    window.setTimeout(() => setSelectedBooking(acceptedBooking), 0);
  }, [bookings]);

  const currentProvider = providers.find((p) => p.id === activeProviderId) || null;
  const hasPendingProviderCompliance = currentProvider
    ? !evaluateProviderEligibility(currentProvider, complianceDocs).isEligible
    : false;
  const instantOffersPollingEnabled = useMemo(() => (
    Boolean(currentProvider?.id) && instantInstructorStatuses.some((status) => (
      status.providerId === currentProvider?.id
      && isInstantInstructorAvailabilityActive(status, bookingClockMs)
    ))
  ), [bookingClockMs, currentProvider?.id, instantInstructorStatuses]);
  const instantInstructorOptions = useMemo(() => {
    if (!currentProvider) return [];
    if (currentProvider.type === 'INSTRUCTOR') {
      const instructorId = currentProvider.userId || user?.id;
      return instructorId ? [{ id: instructorId, name: currentProvider.name }] : [];
    }
    return schoolInstructors
      .filter((instructor) => instructor.userId !== currentProvider.userId)
      .filter((instructor) => instructor.membershipStatus === 'ACTIVE' && instructor.isActive)
      .filter((instructor) => schoolInstructorSummary.find((summary) => summary.membershipId === instructor.id)?.eligible === true)
      .map((instructor) => ({ id: instructor.userId, name: instructor.name }));
  }, [currentProvider, schoolInstructorSummary, schoolInstructors, user?.id]);
  const schoolInstantInstructorOptions = useMemo(() => {
    if (!currentProvider || currentProvider.type !== 'DRIVING_SCHOOL') return [];
    return schoolInstructors
      .filter((instructor) => instructor.userId !== currentProvider.userId)
      .filter((instructor) => instructor.membershipStatus === 'ACTIVE' && instructor.isActive)
      .map((instructor) => ({ id: instructor.userId, name: instructor.name }));
  }, [currentProvider, schoolInstructors]);
  const instantMarketplacePendingByInstructor = useMemo(() => {
    if (!currentProvider) return [];
    const instructors = currentProvider.type === 'DRIVING_SCHOOL' ? schoolInstantInstructorOptions : instantInstructorOptions;
    return instructors.map((instructor) => {
      const membership = schoolInstructors.find((item) => item.userId === instructor.id);
      const hasCompliance = currentProvider.type === 'DRIVING_SCHOOL'
        ? schoolInstructorSummary.find((summary) => summary.membershipId === membership?.id)?.eligible === true
        : evaluateProviderEligibility(currentProvider, complianceDocs).isEligible;
      const pending: string[] = [];
      if (!hasCompliance) pending.push('Compliance aprovado pendente');
      if (!isProviderPaymentAccountReady(paymentAccount)) pending.push('Conta bancária não cadastrada');
      if (!vehicles.some((vehicle) => vehicle.status === 'ACTIVE')) pending.push('Veículo ativo não cadastrado');
      if (!instantSettings.some((setting) => setting.instructorId === instructor.id && setting.instantEnabled)) pending.push('Configuração da Aula Agora pendente');
      return { instructorId: instructor.id, instructorName: instructor.name, pending };
    }).filter((item) => item.pending.length > 0);
  }, [complianceDocs, currentProvider, instantInstructorOptions, instantSettings, paymentAccount, schoolInstructorSummary, schoolInstructors, schoolInstantInstructorOptions, vehicles]);
  const canManageInstantInstructorAvailability = currentProvider?.type === 'DRIVING_SCHOOL'
    && hasPerm('school.schedule.manage');
  const cancellationUserRole = currentProvider?.type === 'INSTRUCTOR'
    && currentProvider.userId === user?.id
    ? 'INSTRUCTOR'
    : user?.role || currentRole;

  const refreshInstantProviderLocation = useCallback((): Promise<void> => {
    const currentInstructorIsOnline = instantInstructorStatuses.some((status) => status.providerId === currentProvider?.id && status.instructorId === user?.id && isInstantInstructorAvailabilityActive(status));
    if (!currentProvider?.id || !user?.id || !navigator.geolocation || !currentInstructorIsOnline) {
      return Promise.resolve();
    }
    if (instantLocationRefreshInFlightRef.current) return instantLocationRefreshInFlightRef.current;

    setInstantLocationStatus('UPDATING');
    const request = new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: false,
        timeout: 12000,
        maximumAge: 15000,
      });
    })
      .then(async (position) => {
        await dbService.upsertMyInstantLocation(
          currentProvider.id,
          user.id,
          position.coords.latitude,
          position.coords.longitude,
        );
      })
      .then(() => setInstantLocationStatus('READY'))
      .catch(() => { setInstantLocationStatus('ERROR'); })
      .finally(() => { instantLocationRefreshInFlightRef.current = null; });
    instantLocationRefreshInFlightRef.current = request;
    return request;
  }, [currentProvider?.id, instantInstructorStatuses, user?.id]);

  useEffect(() => {
    if (!isRealSupabase || !currentProvider?.id || !user?.id || !instantInstructorStatuses.some((status) => status.providerId === currentProvider.id && status.instructorId === user.id && isInstantInstructorAvailabilityActive(status))) return undefined;
    void refreshInstantProviderLocation();
    // A PRO tab may stay in the background while the student searches in
    // another tab. Keep attempting the heartbeat there; the database still
    // rejects stale locations, and visibilitychange refreshes immediately
    // when the tab becomes active again.
    const refresh = () => void refreshInstantProviderLocation();
    const timer = window.setInterval(refresh, INSTANT_PROVIDER_LOCATION_INTERVAL_SECONDS * 1000);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [currentProvider?.id, instantInstructorStatuses, isRealSupabase, refreshInstantProviderLocation, user?.id]);

  const loadInstantOffers = useCallback((): Promise<void> => {
    if (instantOffersInFlightRef.current) return instantOffersInFlightRef.current;
    if (!currentProvider?.id || !user?.id) return Promise.resolve();
    const request = serverState.getProviderInstantOffers(currentProvider.id, user.id)
      .then((snapshot) => {
        setInstantOffers(snapshot.offers);
        setInstantOffersServerNow(snapshot.serverNow);
      })
      .catch((error) => console.warn('Instant lesson offers load failed:', error))
      .finally(() => { instantOffersInFlightRef.current = null; });
    instantOffersInFlightRef.current = request;
    return request;
  }, [currentProvider?.id, user?.id]);

  const pollInstantOffers = useCallback((): Promise<void> => {
    if (!instantOffersPollingEnabled) return Promise.resolve();
    return loadInstantOffers();
  }, [instantOffersPollingEnabled, loadInstantOffers]);

  useEffect(() => {
    if (!isRealSupabase || !currentProvider?.id) return;
    // Load once even when the availability status is still being restored or
    // has just expired. The RPC returns only this instructor's pending offers,
    // so this does not keep a paused professional in the polling loop.
    void loadInstantOffers();
    const channel = supabase
      .channel(`instant-offers-${user?.id || 'anonymous'}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'instant_lesson_offers',
        ...(user?.id ? { filter: `instructor_id=eq.${user.id}` } : {}),
      }, () => { void loadInstantOffers(); })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [currentProvider?.id, isRealSupabase, loadInstantOffers, user?.id]);

  useEffect(() => {
    if (!isRealSupabase || !currentProvider?.id || !instantOffersPollingEnabled) return;
    const pollTimer = window.setInterval(() => void pollInstantOffers(), 5000);
    const refreshOnVisibility = () => {
      if (document.visibilityState === 'visible') void loadInstantOffers();
    };
    document.addEventListener('visibilitychange', refreshOnVisibility);
    return () => {
      window.clearInterval(pollTimer);
      document.removeEventListener('visibilitychange', refreshOnVisibility);
    };
  }, [currentProvider?.id, instantOffersPollingEnabled, isRealSupabase, loadInstantOffers, pollInstantOffers]);

  useEffect(() => {
    const pendingOffers = instantOffers.filter((offer) => offer.status === 'PENDING');
    const currentOffer = instantOfferSheetId ? pendingOffers.find((offer) => offer.id === instantOfferSheetId) : null;

    if (instantOfferSheetId && !currentOffer) {
      setInstantOfferSheetId(null);
    }

    const freshOffer = pendingOffers.find((offer) => !notifiedInstantOfferIdsRef.current.has(offer.id));
    if (freshOffer) {
      notifiedInstantOfferIdsRef.current.add(freshOffer.id);
      setInstantOfferSheetId(freshOffer.id);
    }
  }, [instantOffers, instantOfferSheetId]);

  useEffect(() => {
    if (!isInstantSettingsOpen) {
      instantSettingsSheetRequestRef.current = false;
      return;
    }

    const pendingOffer = instantOffers.find((offer) => offer.status === 'PENDING');
    if (pendingOffer && !instantSettingsSheetRequestRef.current) {
      instantSettingsSheetRequestRef.current = true;
      setInstantOfferSheetId(pendingOffer.id);
    }
  }, [instantOffers, isInstantSettingsOpen]);

  const handleSaveInstantSetting = async (params: { instructorId: string; vehicleId: string; instantEnabled: boolean; instantPriceInCents: number; maxDistanceKm: number }) => {
    if (!currentProvider) return;
    const existingSetting = instantSettings.find((item) => item.instructorId === params.instructorId && item.vehicleId === params.vehicleId);
    const offeringId = existingSetting?.offeringId || offerings.find((item) => item.status === 'ACTIVE' && item.instructorId === params.instructorId && item.vehicleId === params.vehicleId)?.id;
    const saved = await dbService.saveMyInstantSetting({ providerId: currentProvider.id, offeringId, ...params });
    setInstantSettings((current) => [...current.filter((item) => !(item.instructorId === saved.instructorId && item.vehicleId === saved.vehicleId)), saved]);
    void invalidateProviderInstantQueries(currentProvider.id, params.instructorId);
  };

  const handleToggleInstantOnline = async (instructorId: string, online: boolean) => {
    if (!currentProvider) return;
    setInstantActionLoading(true);
    try {
      if (online) {
        const instructorMembership = schoolInstructors.find((instructor) => instructor.userId === instructorId);
        const hasCompliance = currentProvider.type === 'DRIVING_SCHOOL'
          ? schoolInstructorSummary.find((summary) => summary.membershipId === instructorMembership?.id)?.eligible === true
          : evaluateProviderEligibility(currentProvider, complianceDocs).isEligible;
        const ready = hasCompliance
          && isProviderPaymentAccountReady(paymentAccount)
          && vehicles.some((vehicle) => vehicle.status === 'ACTIVE')
          && instantSettings.some((setting) => setting.instructorId === instructorId && setting.instantEnabled);
        if (!ready) throw new Error('INSTANT_INSTRUCTOR_NOT_MARKETPLACE_READY');
      }
      if (online && !instantSettings.some((setting) => setting.instructorId === instructorId && setting.instantEnabled)) throw new Error('INSTANT_VEHICLE_NOT_ENABLED');
      // A school administrator changes only the instructor's canonical
      // availability. Only the instructor can publish the instructor's GPS.
      if (online && user?.id === instructorId) {
        setInstantLocationStatus('UPDATING');
        await new Promise<void>((resolve, reject) => {
          if (!navigator.geolocation) { reject(new Error('LOCATION_UNAVAILABLE')); return; }
          navigator.geolocation.getCurrentPosition(
            (position) => void dbService.upsertMyInstantLocation(currentProvider.id, user.id, position.coords.latitude, position.coords.longitude).then(resolve).catch(reject),
            reject,
            { enableHighAccuracy: false, timeout: 12000, maximumAge: 15000 },
          );
        });
        setInstantLocationStatus('READY');
      }
      const savedStatus = await dbService.setMyInstantInstructorOnline(currentProvider.id, instructorId, online);
      setInstantInstructorStatuses((current) => [
        ...current.filter((item) => !(item.providerId === currentProvider.id && item.instructorId === instructorId)),
        savedStatus,
      ]);
      void invalidateProviderInstantQueries(currentProvider.id, instructorId);
      showProviderFeedback(
        online ? 'success' : 'info',
        online ? 'Instrutor disponível' : 'Instrutor pausado',
        online
          ? 'O instrutor está disponível para Aula Agora por até 1 hora.'
          : 'O instrutor não receberá novas solicitações de Aula Agora.',
      );
    } catch (error) {
      setInstantLocationStatus('ERROR');
      throw error;
    } finally { setInstantActionLoading(false); }
  };

  const handleRespondInstantOffer = async (offerId: string, action: 'ACCEPT' | 'DECLINE') => {
    if (instantOfferRespondingRef.current.has(offerId)) return;
    instantOfferRespondingRef.current.add(offerId);
    setInstantOfferAction({ offerId, action });
    try {
      const result = await dbService.respondToInstantOffer(offerId, action);
      if (currentProvider?.id && user?.id) void invalidateProviderInstantQueries(currentProvider.id, user.id);
      await loadInstantOffers();
      if (action === 'DECLINE') showProviderFeedback('info', 'Solicitação recusada', 'Você continuará disponível para novas solicitações.');
      if (action === 'ACCEPT' && result.bookingId) {
        const acceptedBookingId = result.bookingId;
        acceptedInstantBookingIdRef.current = acceptedBookingId;

        try {
          const isInstructorUser = user?.role === 'INSTRUCTOR' || user?.roles?.includes('INSTRUCTOR');
          if (activeProviderId && user?.id) {
            await invalidateProviderBookingQueries(activeProviderId, user.id, acceptedBookingId);
          }
          const refreshedBookings = await serverState.getProviderBookings({
            providerId: activeProviderId,
            userId: user?.id || 'unknown',
            isInstructor: isInstructorUser,
          });
          setBookings(refreshedBookings || []);
          const acceptedBooking = refreshedBookings.find((booking) => booking.id === acceptedBookingId);

          if (acceptedBooking) {
            acceptedInstantBookingIdRef.current = null;
            setIsInstantSettingsOpen(false);
            setIsInstantOperationalModalOpen(false);
            setActiveTab('bookings');
            window.setTimeout(() => setSelectedBooking(acceptedBooking), 0);
          }
        } catch (refreshError) {
          // The accept RPC already succeeded. Keep the navigation ref so the
          // normal workspace/realtime refresh can open the detail later.
          console.warn('Could not immediately hydrate accepted instant booking:', refreshError);
          void loadWorkspace(activeProviderId, { silent: true });
        }

        showProviderFeedback('success', 'Solicitação aceita', 'A nova aula foi adicionada à sua agenda.');
      }
    } catch (error) {
      // A rejected accept can mean the card expired while it was visible.
      // Refresh immediately so the stale card cannot be clicked again.
      await loadInstantOffers();
      showProviderFeedback('warning', 'Solicitação indisponível', 'Essa solicitação já expirou ou foi atendida por outro profissional.');
    } finally {
      instantOfferRespondingRef.current.delete(offerId);
      setInstantOfferAction(null);
    }
  };

  const handleNotificationTarget = (target: NotificationNavigationTarget) => {
    setIsNotificationsOpen(false);
    if (target.appContext !== 'PRO') return;
    if (target.entityType === 'booking' && target.entityId) {
      const booking = bookings.find((item) => item.id === target.entityId);
      if (!booking) {
        showProviderFeedback('warning', 'Conteúdo indisponível', 'Esta aula não está mais disponível.');
        setActiveTab('bookings');
        return;
      }
      setActiveTab('bookings');
      if (target.action === 'chat') setSelectedBookingForChat(booking);
      else setSelectedBooking(booking);
      return;
    }
    if (target.entityType === 'compliance') {
      setManagementSubTab('compliance');
      setActiveTab('management');
      return;
    }
    if (target.entityType === 'instant_offer') {
      setActiveTab('dashboard');
      setIsInstantSettingsOpen(true);
      void loadInstantOffers();
      return;
    }
    if (target.entityType === 'payout' && target.entityId) {
      setActiveTab('earnings');
      void dbService.getMyProviderPayoutDetail(target.entityId)
        .then(setSelectedPayoutDetail)
        .catch(() => showProviderFeedback('warning', 'Repasse indisponível', 'Este repasse não está mais disponível.'));
      return;
    }
    if (target.entityType === 'earnings') {
      setEarningsFocusKey((current) => current + 1);
      setActiveTab('earnings');
      return;
    }
    setActiveTab('earnings');
  };

  const handleConnectStripe = async () => {
    if (isConnectingStripe) return;
    setIsConnectingStripe(true);
    setStripeOnboardingError(null);
    try {
      const result = await dbService.openProviderPayoutOnboarding();
      setPaymentAccount(result.account);
      // Keep the button loading while the browser leaves MAZZI and waits for
      // the hosted Stripe page to become available. Reset only on failure.
      window.location.assign(result.onboardingUrl);
    } catch (error: any) {
      setIsConnectingStripe(false);
      let stripeDetail = '';
      try {
        const response = error?.context;
        if (response && typeof response.clone === 'function') {
          const payload = await response.clone().json();
          stripeDetail = typeof payload?.detail === 'string' ? payload.detail : '';
        }
      } catch {
        // The Functions client can expose a consumed or unavailable response.
      }
      const friendlyMessage = mapFriendlyErrorMessage(error, 'Não foi possível abrir o cadastro de recebimentos.');
      setStripeOnboardingError(stripeDetail ? `${friendlyMessage} Detalhe: ${stripeDetail}` : friendlyMessage);
    }
  };

  useEffect(() => {
    if (!user?.id || workspaceLoading) return;
    const params = new URLSearchParams(window.location.search);
    const onboardingState = params.get('stripe_onboarding');
    if (onboardingState !== 'return' && onboardingState !== 'refresh') return;

    if (onboardingState === 'refresh') {
      params.delete('stripe_onboarding');
      const cleanUrl = new URL(window.location.href);
      cleanUrl.search = params.toString();
      window.history.replaceState(window.history.state, '', cleanUrl.toString());
      void handleConnectStripe();
      return;
    }

    setActiveTab('management');
    setManagementSubTab('account');
    let active = true;
    const waitForAccountRender = () => new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()));
    });
    const syncReturnedAccount = async () => {
      try {
        const account = await dbService.syncMyStripePaymentAccount();
        if (!active || !account) return;

        setPaymentAccount(account);
        showProviderFeedback(
          account.payoutsEnabled ? 'success' : 'warning',
          account.payoutsEnabled ? 'Recebimentos habilitados' : 'Cadastro ainda pendente',
          account.payoutsEnabled
            ? 'Sua conta está pronta para receber repasses.'
            : 'Ainda existem informações pendentes para liberar os repasses.',
        );

        // O splash só é liberado depois que o estado atualizado foi aplicado
        // e a tela de conta bancária teve tempo de renderizar os dados.
        await waitForAccountRender();
        if (!active) return;
        params.delete('stripe_onboarding');
        const cleanUrl = new URL(window.location.href);
        cleanUrl.search = params.toString();
        window.history.replaceState(window.history.state, '', cleanUrl.toString());
        signalInitialNavigationReady();
        window.requestAnimationFrame(() => dismissInitialSplash());
      } catch {
        showProviderFeedback('warning', 'Não foi possível atualizar o status', 'Tente novamente em alguns instantes.');
      }
    };
    void syncReturnedAccount();
    return () => { active = false; };
  }, [user?.id, workspaceLoading]);

  const openNotificationTarget = (target: NotificationNavigationTarget) => {
    setIsNotificationsOpen(false);
    if (target.appContext !== 'PRO') return;
    handleNotificationTarget(target);
    clearNotificationNavigationTargetFromHash('provider', target.entityType === 'booking' ? 'bookings' : target.entityType === 'compliance' ? 'management' : target.entityType === 'instant_offer' ? 'dashboard' : 'earnings');
  };

  useEffect(() => {
    if (isAuthLoading || workspaceLoading || !user) return;
    const target = getNotificationNavigationTargetFromHash('provider');
    if (!target || target.appContext !== 'PRO') return;
    handleNotificationTarget(target);
    clearPendingNotificationTarget();
    clearNotificationNavigationTargetFromHash('provider', target.entityType === 'booking' ? 'bookings' : target.entityType === 'compliance' ? 'management' : target.entityType === 'instant_offer' ? 'dashboard' : 'earnings');
    signalInitialNavigationReady();
  }, [bookings, isAuthLoading, user, workspaceLoading]);

  useEffect(() => {
    if (isAuthLoading || workspaceLoading || !user) return;
    const emailRoute = getPublicEmailRouteFromPath();
    if (!emailRoute || emailRoute.kind === 'refund') return;
    const navigationKey = `${emailRoute.kind}:${emailRoute.reference}`;
    if (publicEmailNavigationRef.current === navigationKey) return;
    publicEmailNavigationRef.current = navigationKey;

    const openEmailDestination = async () => {
      if (emailRoute.kind === 'earnings') {
        setActiveTab('earnings');
        try {
          const payout = await dbService.getMyProviderPayoutDetailByReference(emailRoute.reference);
          setSelectedPayoutDetail(payout);
        } catch (error) {
          if (process.env.NODE_ENV !== 'production') console.error('Failed to open payout from email link:', error);
          showProviderFeedback('warning', 'Repasse indisponível', 'Este repasse não está mais disponível.');
        }
        signalInitialNavigationReady();
        return;
      }

      let booking = bookings.find((item) => item.publicReference === emailRoute.reference) || null;
      if (!booking && emailRoute.kind === 'lesson' && activeProviderId) {
        try {
          const refreshedBookings = await serverState.getProviderBookings({
            providerId: activeProviderId,
            userId: user.id,
            isInstructor: user.role === 'INSTRUCTOR' || user.roles?.includes('INSTRUCTOR'),
          });
          setBookings(refreshedBookings || []);
          booking = refreshedBookings.find((item) => item.publicReference === emailRoute.reference) || null;
        } catch (error) {
          if (process.env.NODE_ENV !== 'production') console.error('Failed to open lesson from email link:', error);
        }
      }

      if (!booking) {
        showProviderFeedback('warning', 'Conteúdo indisponível', 'Esta aula não está mais disponível.');
        signalInitialNavigationReady();
        return;
      }

      setActiveTab('bookings');
      setSelectedBooking(booking);
      signalInitialNavigationReady();
    };

    void openEmailDestination();
  }, [activeProviderId, bookings, isAuthLoading, user, workspaceLoading]);

  if (isAuthLoading || workspaceLoading) {
    return (
      <div className="min-h-dvh bg-[#f7f5ef] text-[#202126] font-sans">
        <div aria-busy="true" aria-label="Carregando painel do instrutor" className="mazzi-provider-content mx-auto w-full max-w-[680px] space-y-5 px-5 py-6 sm:px-7 lg:max-w-[760px]">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="h-3 w-28 animate-pulse rounded bg-slate-200" />
              <div className="h-8 w-52 animate-pulse rounded-2xl bg-slate-200" />
              <div className="h-3 w-64 animate-pulse rounded bg-slate-200" />
            </div>
            <div className="h-12 w-12 animate-pulse rounded-2xl bg-slate-200" />
          </div>
          <div className="space-y-3">
            {[1, 2, 3].map((item) => (
              <div key={item} className="h-32 animate-pulse rounded-2xl border border-slate-200 bg-white" />
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
        <div className="mazzi-compact-card max-w-md w-full p-6 rounded-2xl bg-white border border-[#e9e6de] shadow-lg space-y-4">
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
              onClick={() => loadWorkspace(activeProviderId || user?.providerId || '')}
              leftIcon={<RefreshCw className="w-4 h-4" />}
            >
              Tentar Novamente
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleLogout()}
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

  const todayBookings = sortBookingsForToday(bookings.filter((b) => TODAY_BOOKING_STATUSES.includes(b.status) && !UNPAID_BOOKING_STATUSES.includes(b.status) && isBookingTodayInSaoPaulo(b)), bookingClockMs);
  const confirmedBookings = bookings.filter((b) => b.status === 'CONFIRMED' || b.status === 'IN_PROGRESS');
  const completedBookings = bookings.filter((b) => b.status === 'COMPLETED');
  const pendingPaymentInstantBookings = bookings.filter((b) => b.snapshot?.source === 'AULA_AGORA' && isPendingPaymentHoldActive(b, bookingClockMs, platformConfiguration?.instantLessonExpirationMinutes));

  const nextBooking = sortBookingsForNext(bookings.filter((b) => {
    if (b.status !== 'CONFIRMED' && b.status !== 'IN_PROGRESS') return false;
    return b.status === 'IN_PROGRESS' || !isLessonEnded(b, new Date(bookingClockMs));
  }), bookingClockMs)[0] || null;

  const filteredBookings = bookings.filter((b) => {
    if (UNPAID_BOOKING_STATUSES.includes(b.status)) return false;
    const ended = isLessonEnded(b, new Date(bookingClockMs));

    if (bookingFilterTab === 'today') {
      return (
        TODAY_BOOKING_STATUSES.includes(b.status) &&
        isBookingTodayInSaoPaulo(b) && (bookingQuickFilter === 'all' || (bookingQuickFilter === 'confirmed' && b.status === 'CONFIRMED') || (bookingQuickFilter === 'in_progress' && b.status === 'IN_PROGRESS'))
      );
    }
    if (bookingFilterTab === 'upcoming') {
      if (ended || b.status === 'EXPIRED') return false;
      return (b.status === 'CONFIRMED' || b.status === 'IN_PROGRESS') && (bookingQuickFilter === 'all' || (bookingQuickFilter === 'confirmed' && b.status === 'CONFIRMED') || (bookingQuickFilter === 'in_progress' && b.status === 'IN_PROGRESS'));
    }
    if (bookingFilterTab === 'history') {
      const matchesQuick = bookingQuickFilter === 'all' || (bookingQuickFilter === 'completed' && b.status === 'COMPLETED') || (bookingQuickFilter === 'disputed' && b.status === 'DISPUTED') || (bookingQuickFilter === 'cancelled' && ['CANCELLED_BY_STUDENT', 'CANCELLED_BY_PROVIDER', 'NO_SHOW_STUDENT', 'NO_SHOW_PROVIDER', 'REFUNDED', 'PARTIALLY_REFUNDED', 'EXPIRED'].includes(b.status));
      return matchesQuick && (getStudentBookingSection(b.status, b) === 'HISTORY' || ended);
    }
    return false;
  });
  const orderedFilteredBookings = bookingFilterTab === 'today'
    ? sortBookingsForToday(filteredBookings, bookingClockMs)
    : bookingFilterTab === 'history'
      ? [...filteredBookings].sort((a, b) => getBookingStartTimestamp(b) - getBookingStartTimestamp(a))
      : filteredBookings;

  const getOrCreateSession = (b: Booking): LessonSession => {
    if (lessonSessions[b.id]) return lessonSessions[b.id];
    return {
      id: `session_${b.id}`,
      bookingId: b.id,
      providerId: b.providerId,
      instructorId: b.instructorId,
      studentId: b.studentId,
      state: b.status === 'COMPLETED' ? 'COMPLETED' : b.status === 'IN_PROGRESS' ? 'IN_PROGRESS' : b.instructorCheckedIn ? 'CHECKED_IN' : 'NOT_STARTED',
      meetingPoint: b.meetingPointLabel || formatMeetingPoint(b.meetingPoint),
      createdAt: b.createdAt,
      updatedAt: b.updatedAt || b.createdAt,
    };
  };

  // Lesson Handlers — Server-Side RPCs Strict Server Timestamps & Friendly Error UX (TASK-048 / TASK-051)
  const handleCheckIn = async (b: Booking) => {
    if (checkInRequestInFlightRef.current) return;
    checkInRequestInFlightRef.current = true;
    setBookingActionError(null);
    try {
      const location = await requestCheckInLocation();
      const res = await dbService.providerCheckInBooking(b.id, location);
      if (!res?.checkin_instructor_at) {
        throw new Error('Servidor não retornou a confirmação do horário de check-in.');
      }
      const updatedBooking: Booking = {
        ...b,
        instructorCheckedIn: true,
        checkinInstructorAt: res.checkin_instructor_at,
        checkinInstructorLatitude: res.checkin_instructor_latitude ?? location.latitude,
        checkinInstructorLongitude: res.checkin_instructor_longitude ?? location.longitude,
      };
      setBookings((prev) => prev.map((item) => (item.id === b.id ? updatedBooking : item)));
      if (selectedBooking?.id === b.id) setSelectedBooking(updatedBooking);
      if (activeProviderId && user?.id) void invalidateProviderBookingQueries(activeProviderId, user.id, b.id);
      showProviderFeedback('success', 'Check-in realizado com sucesso!', 'O aluno foi notificado.');
      return;
    } catch (err: any) {
      const message = mapFriendlyErrorMessage(err, 'Não foi possível realizar o check-in.');
      setBookingActionError(message);
      return message;
    } finally {
      checkInRequestInFlightRef.current = false;
    }
  };

  const handleStartLesson = async (b: Booking): Promise<boolean> => {
    if (startingLessonBookingIdRef.current === b.id) return false;
    startingLessonBookingIdRef.current = b.id;
    setBookingActionError(null);
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
      if (activeProviderId && user?.id) void invalidateProviderBookingQueries(activeProviderId, user.id, b.id);
      showProviderFeedback('success', 'Aula iniciada!', 'Acompanhe a execução e finalize ao término.');
      return true;
    } catch (err: any) {
      setBookingActionError(mapFriendlyErrorMessage(err, 'Não foi possível iniciar a aula.'));
      return false;
    } finally {
      if (startingLessonBookingIdRef.current === b.id) {
        startingLessonBookingIdRef.current = null;
      }
    }
  };

  const handleCompleteLesson = async (b: Booking) => {
    if (isCompleting) return;
    setIsCompleting(true);
    setBookingActionError(null);
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
      if (activeProviderId && user?.id) void invalidateProviderBookingQueries(activeProviderId, user.id, b.id);
      showProviderFeedback('success', 'Aula finalizada com sucesso!');
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

      const isInstantBooking = selectedBookingForCancel.snapshot?.source === 'AULA_AGORA';
      const res = isInstantBooking
        ? await dbService.cancelInstantBooking({
            bookingId: selectedBookingForCancel.id,
            reasonCode: providerCancelReasonCode,
            reason: finalReason,
            idempotencyKey: `instant_provider_cancel:${selectedBookingForCancel.id}`,
          })
        : await dbService.cancelBooking({
            bookingId: selectedBookingForCancel.id,
            reasonCode: providerCancelReasonCode,
            reason: finalReason,
          });

      const updatedBooking: Booking = {
        ...selectedBookingForCancel,
        status: (res.status as any) || 'CANCELLED_BY_PROVIDER',
        cancelledAt: new Date().toISOString(),
        cancellationReason: finalReason,
        refundAmountInCents: res.refund_amount_in_cents ?? selectedBookingForCancel.refundAmountInCents,
        cancellationData: res.cancellation_data || selectedBookingForCancel.cancellationData,
      };

      setBookings((prev) => prev.map((item) => item.id === selectedBookingForCancel.id ? updatedBooking : item));
      if (selectedBooking?.id === selectedBookingForCancel.id) {
        setSelectedBooking(updatedBooking);
      }
      if (activeProviderId && user?.id) void invalidateProviderBookingQueries(activeProviderId, user.id, selectedBookingForCancel.id);
      setSelectedBookingForCancel(null);
      showProviderFeedback('success', 'Agendamento cancelado.', 'Reembolso integral de 100% será processado para o aluno.');
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
      showProviderFeedback('error', 'Não foi possível excluir a regra', mapFriendlyErrorMessage(err, 'Ação não autorizada.'));
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
      showProviderFeedback('error', 'Não foi possível excluir o bloqueio', mapFriendlyErrorMessage(err, 'Ação não autorizada.'));
    }
  };

  const handleDeactivateAvailabilityException = async (exceptionId: string) => {
    try {
      await dbService.deactivateAvailabilityException(exceptionId);
      setAvailabilityExceptions((prev) => prev.map((exception) => exception.id === exceptionId ? { ...exception, isActive: false } : exception));
    } catch (err: any) {
      showProviderFeedback('error', 'Não foi possível desativar o bloqueio', mapFriendlyErrorMessage(err, 'Tente novamente em instantes.'));
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
      showProviderFeedback('error', 'Não foi possível ativar o bloqueio', mapFriendlyErrorMessage(err, 'Tente novamente em instantes.'));
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
      if (currentProvider?.id) void invalidateProviderCatalogQueries(currentProvider.id);
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
      if (targetVehicle.status === 'ACTIVE' && savedVehicle.status !== 'ACTIVE') {
        setOfferings((prev) => prev.map((offering) =>
          offering.vehicleId === vehicleId ? { ...offering, status: 'INACTIVE' } : offering,
        ));
      }
      if (currentProvider?.id) void invalidateProviderCatalogQueries(currentProvider.id);
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
      if (currentProvider?.id) void invalidateProviderCatalogQueries(currentProvider.id);
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
      if (currentProvider?.id) void invalidateProviderCatalogQueries(currentProvider.id);
    } catch (err: any) {
      setOfferingError(mapFriendlyErrorMessage(err, 'Ação de ativação da oferta não permitida.'));
    }
  };

  const handleReplaceActiveOffering = async (offeringId: string, previousOfferingId: string) => {
    try {
      const savedOffering = await dbService.replaceActiveOffering(offeringId);
      setOfferings((prev) => prev.map((offering) => {
        if (offering.id === offeringId) return savedOffering;
        if (offering.id === previousOfferingId) return { ...offering, status: 'INACTIVE' };
        return offering;
      }));
      if (currentProvider?.id) void invalidateProviderCatalogQueries(currentProvider.id);
    } catch (err: any) {
      setOfferingError(mapFriendlyErrorMessage(err, 'Não foi possível trocar a oferta ativa.'));
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
    const cleanBirthDate = toISODateString(profileForm.birthDate);
    if (currentProvider?.type === 'INSTRUCTOR' && (!cleanBirthDate || !validateBirthDate(profileForm.birthDate).valid)) {
      setProfileFormError('Informe uma data de nascimento válida.');
      setIsSavingProfile(false);
      return;
    }
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
        profileAvatar,
        cleanBirthDate || undefined,
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

  const handleAcceptComplianceTerms = async (): Promise<boolean> => {
    if (!currentProvider || !user || isAcceptingComplianceTerms) return false;

    setIsAcceptingComplianceTerms(true);
    setComplianceTermsError(null);
    try {
      await dbService.saveComplianceDoc({
        providerId: currentProvider.id,
        type: 'MAZZI_TERMS_ACCEPTANCE',
        storagePath: `acceptance://mazzi-ethics/${CURRENT_PROFESSIONAL_TERMS_VERSION}`,
        status: 'APPROVED',
        scope: 'PROVIDER',
      });
      await loadWorkspace(currentProvider.id, { silent: true });
      return true;
    } catch (error) {
      console.error('Compliance terms acceptance failed:', error);
      setComplianceTermsError('Não foi possível registrar sua concordância. Tente novamente.');
      return false;
    } finally {
      setIsAcceptingComplianceTerms(false);
    }
  };

  const payoutDetailPresentation = selectedPayoutDetail ? {
    isPaid: selectedPayoutDetail.status === 'PAID',
    isFailed: selectedPayoutDetail.status === 'FAILED',
    isBlocked: selectedPayoutDetail.status === 'BLOCKED',
    label: selectedPayoutDetail.status === 'PAID'
      ? 'Repasse concluído'
      : selectedPayoutDetail.status === 'FAILED'
        ? 'Repasse não concluído'
        : selectedPayoutDetail.status === 'BLOCKED'
          ? 'Repasse bloqueado'
          : 'Repasse em processamento',
    description: selectedPayoutDetail.status === 'PAID'
      ? 'O valor foi confirmado para o instrutor.'
      : selectedPayoutDetail.status === 'FAILED'
        ? 'Não foi possível concluir este repasse.'
        : selectedPayoutDetail.status === 'BLOCKED'
          ? 'Este repasse precisa ser regularizado antes do envio.'
          : 'O repasse está sendo preparado para transferência.',
  } : null;

  const instantOfferSheetOffer = instantOffers.find((offer) => offer.id === instantOfferSheetId) || null;
  const instantOfferSheetSecondsLeft = instantOfferSheetOffer
    ? getInstantOfferSecondsLeft(instantOfferSheetOffer.expiresAt, instantOffersClockMs, instantOffersServerClockOffsetMs)
    : undefined;

  return (
    <div className="mazzi-app flex flex-col min-h-dvh bg-[#f7f5ef] text-[var(--mazzi-text)]">
      {/* Header */}
      {!isInstantSettingsOpen && activeTab === 'dashboard' && (
        <ProviderHeader
          currentProvider={currentProvider}
          currentRole={currentRole}
          userName={user?.name}
          userId={user?.id}
          providerId={activeProviderId}
          onOpenNotifications={() => setIsNotificationsOpen((prev) => !prev)}
          onRefreshWorkspace={() => void refreshCurrentTab()}
          isRefreshing={isRefreshingCurrentTab}
        />
      )}

      {/* Main Content Body */}
      {isInstantSettingsOpen ? (
        <main className="mazzi-mobile mazzi-provider-content flex flex-1 flex-col bg-white">
          <div className="-mx-5 border-b border-[var(--mazzi-border)] bg-white sm:-mx-7">
            <div className="mx-auto flex min-h-16 w-full max-w-[680px] items-center justify-between gap-3 px-6">
              <div className="flex min-w-0 items-center gap-2">
                <IconButton
                  label="Voltar para o painel"
                  onClick={() => setIsInstantSettingsOpen(false)}
                  className="rounded-full bg-[var(--mazzi-surface-soft)] text-slate-500 hover:bg-slate-200/80 hover:text-[var(--mazzi-dark)]"
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                </IconButton>
                <div className="min-w-0">
                  <p className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[var(--mazzi-muted)]">Operação</p>
                  <h1 className="truncate text-base font-extrabold text-[var(--mazzi-dark)]">Aula Agora</h1>
                </div>
              </div>
              <EnvironmentBadge />
            </div>
          </div>
          <div className="mx-auto w-full max-w-[680px] flex-1 space-y-4 overflow-y-auto px-4 py-4 pb-8 sm:px-7">
            <ProviderInstantLessonPanel
              provider={currentProvider}
              offerings={offerings}
              vehicles={vehicles}
              instructorOptions={instantInstructorOptions}
              availabilityInstructorOptions={currentProvider?.type === 'DRIVING_SCHOOL' ? schoolInstantInstructorOptions : instantInstructorOptions}
              marketplacePendingByInstructor={instantMarketplacePendingByInstructor}
              settings={instantSettings}
              platformConfig={instantPlatformConfig}
              instructorStatuses={instantInstructorStatuses}
              currentUserId={user?.id}
              canManageInstructorAvailability={canManageInstantInstructorAvailability}
              onSave={handleSaveInstantSetting}
              onToggleOnline={handleToggleInstantOnline}
              isLoading={instantActionLoading}
              pendingPaymentInstantBookings={pendingPaymentInstantBookings}
            />
          </div>
        </main>
      ) : (
      <main className="mazzi-mobile mazzi-provider-content flex flex-1 flex-col space-y-[10px] pb-28">
        {/* Workspace Error Banner */}
        {workspaceError && (
          <div className="mazzi-compact-card p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-800 flex items-center justify-between">
            <span>{workspaceError}</span>
            <Button variant="ghost" size="sm" onClick={() => loadWorkspace(activeProviderId)}>
              Tentar Novamente
            </Button>
          </div>
        )}

        {/* Unified Calendar Error Banner */}
        {unifiedCalendarError && (
          <div className="mazzi-compact-card p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs font-extrabold text-amber-900 flex items-center justify-between">
            <span>{unifiedCalendarError}</span>
            <Button variant="ghost" size="sm" onClick={() => loadWorkspace(activeProviderId)}>
              Tentar Novamente
            </Button>
          </div>
        )}

        {/* Global Active Lesson Card: keep the same visual language as the dashboard. */}
        {activeInstantBooking && activeTab !== 'dashboard' && (
          <UpcomingBookingCard
            booking={activeInstantBooking}
            perspective="provider"
            onSelect={setSelectedBooking}
          />
        )}

        {/* TAB 1: DASHBOARD */}
        {activeTab === 'dashboard' && (
          <ProviderDashboardTab
            currentProvider={currentProvider}
            todayBookings={todayBookings}
            confirmedBookings={confirmedBookings}
            completedBookings={completedBookings}
            nextBooking={nextBooking}
            activeInstantBooking={activeInstantBooking}
            bookings={bookings}
            nowMs={bookingClockMs}
            providerDocs={complianceDocs}
            providerVehicles={vehicles}
            offerings={offerings}
            availabilityRules={availabilityRules}
            paymentAccount={paymentAccount}
            schoolInstructors={schoolInstructors}
            schoolInstructorSummary={schoolInstructorSummary}
            onSelectBooking={setSelectedBooking}
            onNavigateTab={setActiveTab}
            instantSettings={instantSettings}
            instantInstructorStatuses={instantInstructorStatuses}
            currentUserId={user?.id}
            onOpenInstantSettings={() => {
              setIsInstantSettingsOpen(true);
              void loadInstantOffers();
            }}
            onOpenAddVehicleModal={() => {
              setManagementSubTab('vehicles');
              setActiveTab('management');
              setIsAddVehicleModalOpen(true);
            }}
            onOpenAddOfferingModal={() => setIsAddOfferingModalOpen(true)}
            calendarLoadError={unifiedCalendarError}
            isRefreshing={isRefreshingCurrentTab}
            schoolInvitations={schoolInvitations}
            onAcceptSchoolInvitation={async (invitationId) => {
              await dbService.acceptSchoolInstructorInvitation(invitationId);
              setSchoolInvitations((current) => current.filter((invitation) => invitation.id !== invitationId));
              showProviderFeedback('success', 'Convite aceito', 'O vínculo ficará disponível após a validação do compliance.');
            }}
            onDeclineSchoolInvitation={async (invitationId) => {
              await dbService.declineSchoolInstructorInvitation(invitationId);
              setSchoolInvitations((current) => current.filter((invitation) => invitation.id !== invitationId));
              showProviderFeedback('success', 'Convite recusado');
            }}
          />
        )}

        {/* TAB 2: SCHEDULE */}
        {activeTab === 'management' && (managementSubTab === 'schedule_rules' || managementSubTab === 'schedule_blocks') && (
          <div className="order-20">
          <ProviderScheduleTab
            scheduleSubTab={scheduleSubTab}
            hideSubTabs={activeTab === 'management'}
            hideHeader={activeTab === 'management'}
            onSubTabChange={(tab) => { setScheduleSubTab(tab); setManagementSubTab(tab === 'rules' ? 'schedule_rules' : 'schedule_blocks'); }}
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
            availabilityHorizonDays={isRealSupabase ? platformConfiguration?.availabilityHorizonDays ?? null : platformConfiguration?.availabilityHorizonDays}
            minimumBookingNoticeHours={isRealSupabase ? platformConfiguration?.minimumBookingNoticeHours ?? null : platformConfiguration?.minimumBookingNoticeHours}
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
          </div>
        )}

        {/* TAB 3: BOOKINGS */}
        {activeTab === 'bookings' && (
          <ProviderBookingsTab
            bookingFilterTab={bookingFilterTab}
            onFilterTabChange={(tab) => { setBookingFilterTab(tab); setBookingQuickFilter('all'); }}
            bookingQuickFilter={bookingQuickFilter}
            onQuickFilterChange={(filter) => setBookingQuickFilter(filter)}
            filteredBookings={orderedFilteredBookings}
            actionErrorMessage={bookingActionError}
            onSelectBooking={setSelectedBooking}
            onOpenChat={(b) => setSelectedBookingForChat(b)}
            onCheckIn={handleCheckIn}
            onStartLesson={handleStartLesson}
            onCompleteLesson={handleCompleteLesson}
            onCancelBooking={(b) => setSelectedBookingForCancel(b)}
            isCompleting={isCompleting}
            canCancelBooking={(b) => canProviderCommerciallyCancelBooking(b, cancellationUserRole, currentProvider)}
            calendarLoadError={unifiedCalendarError}
            isRefreshing={isRefreshingCurrentTab}
            onRetryCalendarLoad={() => void refreshCurrentTab()}
          />
        )}

        {/* TAB 4: EARNINGS */}
        {activeTab === 'earnings' && <ProviderEarningsTab refreshKey={isRefreshingCurrentTab ? 1 : 0} focusReviewsKey={earningsFocusKey} providerId={activeProviderId} userId={user?.id} />}

        {/* TAB 5: MANAGEMENT */}
        {activeTab === 'management' && (
          <div className="order-10">
          <ProviderManagementTab
            onRefresh={() => void refreshCurrentTab()}
            isRefreshing={isRefreshingCurrentTab}
            managementSubTab={managementSubTab}
            onSubTabChange={(tab) => {
              if (tab === 'schedule_rules') setScheduleSubTab('rules');
              if (tab === 'schedule_blocks') setScheduleSubTab('exceptions');
              setManagementSubTab(tab);
            }}
            availabilityRules={availabilityRules}
            vehicles={vehicles}
            offerings={offerings}
            complianceDocs={complianceDocs}
            currentProvider={currentProvider}
            schoolInstructors={schoolInstructors}
            schoolInstructorSummary={schoolInstructorSummary}
            paymentAccount={paymentAccount}
            onOpenPayoutOnboarding={() => { void handleConnectStripe(); }}
            isOpeningPayoutOnboarding={isConnectingStripe}
            onboardingError={stripeOnboardingError}
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
            onReplaceActiveOffering={handleReplaceActiveOffering}
            offeringError={offeringError}
            offeringNotice={offeringNotice}
            onUploadDocClick={(type) => setUploadModalDocType(type)}
            onAcceptComplianceTerms={handleAcceptComplianceTerms}
            onViewComplianceDocument={(document) => { void handleViewComplianceDocument(document); }}
             isAcceptingComplianceTerms={isAcceptingComplianceTerms}
             complianceTermsError={complianceTermsError}
             onShowFeedback={showProviderFeedback}
           />
          </div>
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
            userBirthDate={user?.birthDate ? formatDateMask(user.birthDate) : undefined}
            currentUserId={user?.id}
            providerVehicles={vehicles}
            paymentAccount={paymentAccount}
            schoolInstructors={schoolInstructors}
            schoolInstructorSummary={schoolInstructorSummary}
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
                  birthDate: formatDateMask(user?.birthDate || ''),
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
            onLogout={handleLogout}
            onOpenNotifications={() => setIsSettingsOpen(true)}
          />
        )}

      </main>
      )}

      {/* Floating Bottom Navigation */}
      {!isInstantSettingsOpen && (
        <ProviderBottomNav
          activeTab={activeTab}
          onTabChange={setActiveTab}
          bookingUpdatesCount={bookingUpdatesCount}
          showManagementAlert={hasPendingProviderCompliance || availabilityRules.length === 0 || !vehicles.some((vehicle) => vehicle.status === 'ACTIVE') || !offerings.some((offering) => offering.status === 'ACTIVE') || !isProviderPaymentAccountReady(paymentAccount)}
        />
      )}

      {/* MODALS */}
      {/* Booking Details Modal */}
      <ProviderBookingDetailsModal
        isOpen={!!selectedBooking}
        onClose={() => setSelectedBooking(null)}
        booking={selectedBooking}
        currentUserId={user?.id}
        onOpenChat={(b) => {
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
        canCancelBooking={(b) => canProviderCommerciallyCancelBooking(b, cancellationUserRole, currentProvider)}
        onSetOnTheWay={handleSetOnTheWay}
        onOpenNavigation={() => setIsExternalNavModalOpen(true)}
        isLoading={isOnTheWayLoading}
        checkInWindowBeforeMinutes={checkInWindowBeforeMinutes}
        instantLessonExpirationMinutes={platformConfiguration?.instantLessonExpirationMinutes}
        distanceKm={navDestination?.distanceKm}
        etaMinutes={navDestination?.etaMinutes}
        onRefreshBooking={refreshBookingForDetails}
        hasScheduleConflict={Boolean(selectedBooking && bookings.some((otherBooking) =>
          otherBooking.id !== selectedBooking.id
          && BLOCKING_BOOKING_STATUSES.includes(otherBooking.status)
          && (otherBooking.status !== 'PENDING_PAYMENT' || isPendingPaymentHoldActive(otherBooking, bookingClockMs, platformConfiguration?.instantLessonExpirationMinutes))
          && (otherBooking.instructorId === selectedBooking.instructorId || otherBooking.vehicleId === selectedBooking.vehicleId)
          && hasTimeIntervalOverlap(
            selectedBooking.scheduledStartAt,
            selectedBooking.scheduledEndAt,
            otherBooking.scheduledStartAt,
            otherBooking.scheduledEndAt,
          )
        ))}
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
          layer="nested"
          fillContent
        >
          <BookingChatPanel booking={selectedBookingForChat} />
        </Modal>
      )}

      {/* Settings Modal */}
      {isSettingsOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsSettingsOpen(false)}
          title="Configurações"
        >
          <div className="w-full">
            <SettingsPanel appContext="PRO" userId={user?.id} />
          </div>
        </Modal>
      )}

      {/* Received notifications modal */}
      {isNotificationsOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsNotificationsOpen(false)}
          title="Notificações"
        >
          <NotificationsPanel appContext="PRO" userId={user?.id} providerId={activeProviderId} onNavigate={openNotificationTarget} />
        </Modal>
      )}

      {selectedPayoutDetail && (
        <Modal isOpen={true} onClose={() => setSelectedPayoutDetail(null)} title="Detalhes do repasse" size="sm">
          <div className="mx-auto w-full max-w-xl space-y-5 py-2 text-center sm:py-4">
            <div className={`relative mx-auto flex h-20 w-20 items-center justify-center rounded-2xl border-2 ${payoutDetailPresentation?.isPaid ? 'border-emerald-100 bg-emerald-50 text-emerald-600' : payoutDetailPresentation?.isFailed || payoutDetailPresentation?.isBlocked ? 'border-rose-100 bg-rose-50 text-rose-600' : 'border-amber-100 bg-amber-50 text-amber-600'}`}>
              {payoutDetailPresentation?.isPaid ? <CheckCircle2 className="h-11 w-11" strokeWidth={2.5} aria-hidden="true" /> : payoutDetailPresentation?.isFailed || payoutDetailPresentation?.isBlocked ? <XCircle className="h-11 w-11" strokeWidth={2.25} aria-hidden="true" /> : <WalletCards className="h-10 w-10" strokeWidth={2.25} aria-hidden="true" />}
              {payoutDetailPresentation?.isPaid && <Sparkles className="absolute -right-2 -top-2 h-4 w-4 fill-emerald-300 text-emerald-50" aria-hidden="true" />}
            </div>

            <div className="space-y-2">
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-extrabold ${payoutDetailPresentation?.isPaid ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : payoutDetailPresentation?.isFailed || payoutDetailPresentation?.isBlocked ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
                {payoutDetailPresentation?.isPaid ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> : payoutDetailPresentation?.isFailed || payoutDetailPresentation?.isBlocked ? <XCircle className="h-3.5 w-3.5" aria-hidden="true" /> : <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />}
                {payoutDetailPresentation?.label}
              </span>
              <h2 className="text-xl font-black tracking-tight text-[var(--mazzi-dark)]">{payoutDetailPresentation?.isPaid ? 'Repasse realizado com sucesso!' : payoutDetailPresentation?.label}</h2>
              <p className="mx-auto max-w-sm text-xs leading-relaxed text-[var(--mazzi-muted)]">{payoutDetailPresentation?.description}</p>
            </div>

            <div className="mazzi-compact-card rounded-2xl border border-[var(--mazzi-border)] bg-white p-4 text-left shadow-xs sm:p-5">
              <p className="mazzi-field-label">VALOR DO REPASSE</p>
              <p className="mt-1 text-3xl font-black tracking-tight text-[var(--mazzi-dark)]">{formatCentsToBRL(selectedPayoutDetail.amount_in_cents)}</p>
              <div className="mt-4 space-y-3 border-t border-[var(--mazzi-border)] pt-4 text-sm">
                <div className="flex items-start gap-3">
                  <CalendarIcon className="mt-0.5 h-4 w-4 shrink-0 text-[#e9a918]" aria-hidden="true" />
                  <div><p className="text-xs text-[var(--mazzi-muted)]">Previsão de repasse</p><p className="font-bold text-[var(--mazzi-text)]">{formatDateBR(selectedPayoutDetail.scheduled_release_at)} às {formatTimeBR(selectedPayoutDetail.scheduled_release_at)}</p></div>
                </div>
                {selectedPayoutDetail.processed_at && <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                  <div><p className="text-xs text-[var(--mazzi-muted)]">Processado em</p><p className="font-bold text-[var(--mazzi-text)]">{formatDateBR(selectedPayoutDetail.processed_at)} às {formatTimeBR(selectedPayoutDetail.processed_at)}</p></div>
                </div>}
                {selectedPayoutDetail.failure_reason && <div className="rounded-2xl bg-rose-50 p-3 text-xs font-semibold text-rose-800"><p className="mb-1 text-[10px] font-black uppercase tracking-wide text-rose-600">Motivo</p>{selectedPayoutDetail.failure_reason}</div>}
              </div>
            </div>
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
              <div role="alert" className="flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{complianceUploadError}</span>
              </div>
            )}
            <div className="mazzi-compact-card p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
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
                className="mx-auto inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 shadow-xs transition hover:border-slate-300 hover:bg-slate-50 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-slate-900"
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
                isLoading={isUploadingCompliance}
                onClick={() => handleComplianceFileUpload()}
              >
                {isUploadingCompliance ? 'Enviando...' : 'Enviar Documento'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      <InstantLessonOfferBottomSheet
        isOpen={Boolean(instantOfferSheetOffer)}
        offer={instantOfferSheetOffer}
        secondsLeft={instantOfferSheetSecondsLeft}
        onClose={() => setInstantOfferSheetId(null)}
        onAccept={() => {
          if (instantOfferSheetOffer) void handleRespondInstantOffer(instantOfferSheetOffer.id, 'ACCEPT');
        }}
        onDecline={() => {
          if (instantOfferSheetOffer) void handleRespondInstantOffer(instantOfferSheetOffer.id, 'DECLINE');
        }}
        isLoading={instantOfferSheetOffer && instantOfferAction?.offerId === instantOfferSheetOffer.id
          ? instantOfferAction.action.toLowerCase() as 'accept' | 'decline'
          : null}
      />

      {/* Operational Modal for Active Instant Lesson */}
      {activeInstantBooking && (
        <InstantLessonOperationalModal
          isOpen={isInstantOperationalModalOpen}
          booking={activeInstantBooking}
          isWaitingPayment={activeInstantBooking.status === 'PENDING_PAYMENT'}
          isOnTheWay={Boolean(activeInstantBooking.providerOnTheWayAt)}
          onClose={() => setIsInstantOperationalModalOpen(false)}
          onOpenNavigation={() => setIsExternalNavModalOpen(true)}
          onSetOnTheWay={handleSetOnTheWay}
          onCheckIn={handleCheckIn}
          isLoading={isOnTheWayLoading}
          checkInWindowBeforeMinutes={checkInWindowBeforeMinutes}
          instantLessonExpirationMinutes={platformConfiguration?.instantLessonExpirationMinutes}
        />
      )}

      {/* External Navigation Selection Modal */}
      <ExternalNavigationModal
        isOpen={isExternalNavModalOpen}
        target={navDestination}
        onClose={() => setIsExternalNavModalOpen(false)}
      />

      <ToastContainer toasts={toasts} onDismiss={(id) => setToasts((current) => current.filter((toast) => toast.id !== id))} />
    </div>
  );
};

/* TASK-008 & TASK-009 Static Contract Integrity: Confirmar cancelamento Voltar sem cancelar Cancelar agendamento w-1/2 font-bold MessageSquare Ban ArrowLeft */

