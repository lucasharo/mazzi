import React, { useState, useEffect } from 'react';
import { useAuth } from '../../components/auth/AuthContext';
import { dbService } from '../../lib/db-service';
import { formatDateBR } from '../../lib/date-format';
import { formatMeetingPoint } from '../../lib/meeting-point';
import {
  Calendar,
  Car,
  Clock,
  DollarSign,
  FileCheck,
  Plus,
  ShieldCheck,
  Users,
  CheckCircle2,
  AlertCircle,
  Building2,
  User,
  ArrowUpRight,
  Sparkles,
  Upload,
  FileText,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  Eye,
  Info,
  Bike,
  Tag,
  Check,
  X,
  Lock,
  Play,
  CheckCircle,
  Ban,
  ShieldAlert,
  MapPin,
  Sliders,
  MessageSquare,
  LogOut,
} from 'lucide-react';
import {
  UserRole,
  Vehicle,
  Booking,
  ComplianceDocument,
  Provider,
  ProviderStatus,
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
  BookingStatus,
} from '../../types';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { VehicleCard } from '../../components/ui/VehicleCard';
import { BookingCard } from '../../components/ui/BookingCard';
import { Tabs } from '../../components/ui/Tabs';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { formatCentsToBRL } from '../../domain/money';
import { BookingChatPanel } from '../../components/chat/BookingChatPanel';
import { NotificationsPanel } from '../../components/notifications/NotificationsPanel';
import { ProviderAnalyticsPanel } from '../../components/analytics/AnalyticsPanels';
import {
  DEFAULT_COMPLIANCE_REQUIREMENTS,
  evaluateProviderEligibility,
  getVerificationBadgeTooltip,
} from '../../domain/compliance';
import {
  createVehicleDraft,
  createServiceOffering,
  parseBrlToCents,
  validateVehicleActivationPermission,
  validateOfferingActivationPermission,
} from '../../domain/vehicles-offerings';
import {
  generateAvailableSlots,
  validateAvailabilityRule,
  validateAvailabilityException,
  enforceAvailabilityOwnership,
  DAY_OF_WEEK_LABELS_PT,
} from '../../domain/availability';
import { toPublicProviderProfile } from '../../domain/providers';
import {
  performProviderCheckIn,
  startLesson,
  completeLesson,
  LessonSession,
  LessonSessionState,
} from '../../domain/lesson-session';
import { calculateCancellationPolicy, performProviderCancellation } from '../../domain/cancellation';
import { ProfilePhotoPicker } from '../../components/profile/ProfilePhotoPicker';
import { getMyProfileAvatar } from '../../lib/profile-avatar';

export const ProviderApp: React.FC = () => {
  const { user, logout, isLoading: isAuthLoading } = useAuth();
  const [currentRole, setCurrentRole] = useState<UserRole>('INSTRUCTOR');
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [managementSubTab, setManagementSubTab] = useState<'vehicles' | 'offerings' | 'compliance'>('vehicles');
  const [bookingFilterTab, setBookingFilterTab] = useState<'all' | 'today' | 'upcoming' | 'history'>('all');

  const [providers, setProviders] = useState<Provider[]>([]);
  const [complianceDocs, setComplianceDocs] = useState<ComplianceDocument[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [offerings, setOfferings] = useState<ServiceOffering[]>([]);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);

  // Sync active user role and load real data from database
  useEffect(() => {
    if (user?.roles && user.roles.length > 0) {
      setCurrentRole(user.roles[0]);
    }
  }, [user]);

  const loadWorkspace = async (providerId: string) => {
    setWorkspaceLoading(true);
    setWorkspaceError(null);
    try {
      const workspace = await dbService.getProviderWorkspace(providerId);
      if (!workspace.provider) {
        throw new Error('Nenhum prestador vinculado a esta conta foi encontrado.');
      }
      setProviders([workspace.provider]);
      setVehicles(workspace.vehicles);
      setOfferings(workspace.offerings);
      setBookings(workspace.bookings);
      setComplianceDocs(workspace.complianceDocuments);
      setAvailabilityRules(workspace.availabilityRules.map((rule: any) => ({
        id: rule.id, providerId: rule.provider_id, instructorId: rule.instructor_id || undefined,
        vehicleId: rule.vehicle_id || undefined, dayOfWeek: (['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'][rule.day_of_week] || 'MONDAY') as DayOfWeek,
        dayOfWeekNumber: rule.day_of_week, startTime: rule.start_time?.slice(0, 5), endTime: rule.end_time?.slice(0, 5),
        timezone: rule.timezone || 'America/Sao_Paulo', isActive: rule.is_active,
      })));
      setAvailabilityExceptions(workspace.availabilityExceptions.map((exception: any) => ({
        id: exception.id, providerId: exception.provider_id, instructorId: exception.instructor_id || undefined,
        vehicleId: exception.vehicle_id || undefined, type: exception.type, reasonCategory: exception.reason_category,
        reason: exception.reason, startAt: exception.start_at, endAt: exception.end_at,
      })));
    } catch (err: any) {
      console.error('Provider workspace load failed:', err);
      setProviders([]); setVehicles([]); setOfferings([]); setBookings([]); setComplianceDocs([]);
      setAvailabilityRules([]); setAvailabilityExceptions([]);
      setWorkspaceError(err.message || 'Não foi possível carregar seus dados.');
    } finally {
      setWorkspaceLoading(false);
    }
  };

  useEffect(() => {
    if (!user?.providerId) return;
    setActiveProviderId(user.providerId);
    void loadWorkspace(user.providerId);
  }, [user?.providerId]);

  // Lesson Sessions state store
  const [lessonSessions, setLessonSessions] = useState<Record<string, LessonSession>>({});

  // Active Provider Selection
  const [activeProviderId, setActiveProviderId] = useState<string>('');

  // Selected Booking Details Modal State
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [selectedBookingForChat, setSelectedBookingForChat] = useState<Booking | null>(null);
  const [bookingActionError, setBookingActionError] = useState<string | null>(null);
  const [bookingActionSuccess, setBookingActionSuccess] = useState<string | null>(null);
  const [isCompleting, setIsCompleting] = useState<boolean>(false);

  // Availability State
  const [availabilityRules, setAvailabilityRules] = useState<AvailabilityRule[]>([]);
  const [availabilityExceptions, setAvailabilityExceptions] = useState<AvailabilityException[]>([]);
  const [scheduleSubTab, setScheduleSubTab] = useState<'rules' | 'exceptions' | 'simulator'>('rules');

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

  useEffect(() => {
    setProfileAvatar(user?.avatarUrl);
    if (user?.id) {
      void getMyProfileAvatar().then((avatarUrl) => setProfileAvatar(avatarUrl)).catch(() => undefined);
    }
  }, [user?.avatarUrl]);

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

  const currentProvider = providers.find((p) => p.id === activeProviderId);

  if (isAuthLoading || workspaceLoading) {
    return <div className="min-h-screen grid place-items-center bg-slate-100 text-slate-700">Carregando espaço do prestador…</div>;
  }

  if (!user) {
    return <div className="min-h-screen grid place-items-center bg-slate-100 text-slate-700">Entre para acessar o MAZZI Pro.</div>;
  }

  if (!user.providerId) {
    return <div className="min-h-screen grid place-items-center bg-slate-100 p-6 text-center text-slate-700">Sua conta ainda não possui um prestador vinculado. Contate o suporte para concluir o credenciamento.</div>;
  }

  if (workspaceError) {
    return <div className="min-h-screen grid place-items-center bg-slate-100 p-6 text-center"><div><p className="mb-3 text-slate-700">{workspaceError}</p><Button onClick={() => void loadWorkspace(user.providerId)}>Tentar novamente</Button></div></div>;
  }

  if (!currentProvider) {
    return <div className="min-h-screen grid place-items-center bg-slate-100 p-6 text-center text-slate-700">Nenhum dado de prestador está disponível para esta conta.</div>;
  }

  const providerDocs = complianceDocs.filter((d) => d.providerId === activeProviderId);
  const providerVehicles = vehicles.filter((v) => v.providerId === activeProviderId);
  const providerOfferings = offerings.filter((o) => o.providerId === activeProviderId);
  const providerBookings = bookings.filter((b) => b.providerId === activeProviderId);

  const eligibility = currentProvider ? evaluateProviderEligibility(currentProvider, providerDocs, DEFAULT_COMPLIANCE_REQUIREMENTS) : null;

  // Derived Operational Metrics
  const todayStr = formatDateBR(new Date());
  const todayBookings = providerBookings.filter((b) => b.scheduledDate === todayStr);
  const confirmedBookings = providerBookings.filter((b) => b.status === 'CONFIRMED');
  const completedBookings = providerBookings.filter((b) => b.status === 'COMPLETED');
  const nextBooking = confirmedBookings.length > 0 ? confirmedBookings[0] : null;

  // Earnings from real completed bookings loaded from Supabase.
  const grossEarningsInCents = completedBookings.reduce((sum, b) => sum + b.priceInCents, 0);
  const platformFeesInCents = completedBookings.reduce((sum, b) => sum + b.platformFeeInCents, 0);
  const netEarningsInCents = grossEarningsInCents - platformFeesInCents;

  // Helper to sync provider state when switching active provider
  const handleSelectProvider = (id: string) => {
    setActiveProviderId(id);
    const p = providers.find((item) => item.id === id);
    if (p) {
      setCurrentRole(p.type === 'INSTRUCTOR' ? 'INSTRUCTOR' : 'SCHOOL_ADMIN');
      setProfileForm({
        displayName: p.name,
        publicContact: p.publicContact || p.phone || '',
        neighborhood: p.neighborhood,
        city: p.city,
        state: p.state || 'SP',
        serviceRadiusKm: p.serviceRadiusKm || 6,
        bio: p.bio || '',
      });
      void loadWorkspace(id);
    }
  };

  // LESSON LIFECYCLE HANDLERS
  const getOrCreateSession = (b: Booking): LessonSession => {
    if (lessonSessions[b.id]) return lessonSessions[b.id];
    return {
      id: `sess_${b.id}`,
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

  const handleCheckIn = async (b: Booking) => {
    setBookingActionError(null);
    setBookingActionSuccess(null);
    try {
      const now = new Date();
      const result = performProviderCheckIn({
        booking: b,
        providerId: currentProvider.id,
        actorUserId: user.id,
        actorRole: currentRole,
        now,
      });

      await dbService.updateBookingStatus(b.id, result.booking.status, { checkin_instructor_at: now.toISOString() });
      setLessonSessions((prev) => ({ ...prev, [b.id]: result.session }));
      setBookings((prev) => prev.map((item) => (item.id === b.id ? result.booking : item)));
      setSelectedBooking(result.booking);
      setBookingActionSuccess('✓ Check-in realizado com sucesso! O aluno foi notificado.');
    } catch (err: any) {
      setBookingActionError(err.message || 'Erro ao realizar check-in.');
    }
  };

  const handleStartLesson = async (b: Booking) => {
    setBookingActionError(null);
    setBookingActionSuccess(null);
    try {
      const session = getOrCreateSession(b);
      const now = new Date();
      const result = startLesson({
        session,
        booking: b,
        providerId: currentProvider.id,
        actorUserId: user.id,
        actorRole: currentRole,
        now,
      });

      await dbService.updateBookingStatus(b.id, result.booking.status, { lesson_started_at: now.toISOString() });
      setLessonSessions((prev) => ({ ...prev, [b.id]: result.session }));
      setBookings((prev) => prev.map((item) => (item.id === b.id ? result.booking : item)));
      setSelectedBooking(result.booking);
      setBookingActionSuccess('✓ Aula iniciada! Acompanhe a execução e finalize ao término.');
    } catch (err: any) {
      setBookingActionError(err.message || 'Erro ao iniciar aula.');
    }
  };

  const handleCompleteLesson = async (b: Booking) => {
    if (isCompleting) return; // Idempotency lock
    setIsCompleting(true);
    setBookingActionError(null);
    setBookingActionSuccess(null);
    try {
      const session = getOrCreateSession(b);
      const now = new Date();
      const idempotencyKey = `complete_btn_${b.id}_${now.getTime()}`;

      const result = completeLesson({
        session,
        booking: b,
        providerId: currentProvider.id,
        actorUserId: user.id,
        actorRole: currentRole,
        idempotencyKey,
        now,
      });

      await dbService.updateBookingStatus(b.id, result.booking.status, { completed_at: now.toISOString(), lesson_finished_at: now.toISOString() });
      setLessonSessions((prev) => ({ ...prev, [b.id]: result.session }));
      setBookings((prev) => prev.map((item) => (item.id === b.id ? result.booking : item)));
      setSelectedBooking(result.booking);
      setBookingActionSuccess('✓ Aula finalizada com sucesso! O valor foi registrado no financeiro.');
    } catch (err: any) {
      setBookingActionError(err.message || 'Erro ao finalizar aula.');
    } finally {
      setIsCompleting(false);
    }
  };

  const handleCancelBooking = async (b: Booking) => {
    if (!window.confirm('Deseja realmente cancelar este agendamento?')) return;
    setBookingActionError(null);
    setBookingActionSuccess(null);
    try {
      const result = performProviderCancellation({
        booking: b,
        providerId: currentProvider.id,
        actorUserId: user.id,
        actorRole: currentRole,
        idempotencyKey: `cancel_${b.id}_${Date.now()}`,
      });

      await dbService.updateBookingStatus(b.id, result.booking.status, { cancellation_data: result.cancellationResult });
      setBookings((prev) => prev.map((item) => (item.id === b.id ? result.booking : item)));
      setSelectedBooking(result.booking);
      setBookingActionSuccess(`✓ Agendamento cancelado. ${result.cancellationResult.policyDescription}`);
    } catch (err: any) {
      setBookingActionError(err.message || 'Erro ao cancelar agendamento.');
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
      setVehicleError(err.message || 'Erro ao cadastrar veículo.');
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
      setVehicles((prev) => prev.map((vehicle) => vehicle.id === vehicleId ? savedVehicle : vehicle));
    } catch (err: any) {
      alert(err.message || 'Ação de ativação do veículo não permitida.');
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
        existingOfferings: providerOfferings,
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
      setOfferingError(err.message || 'Erro ao cadastrar oferta de aula.');
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
      setOfferings((prev) => prev.map((offering) => offering.id === offeringId ? savedOffering : offering));
    } catch (err: any) {
      alert(err.message || 'Ação de ativação da oferta não permitida.');
    }
  };

  // Availability & Schedule Handlers
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
      setRuleForm({
        dayOfWeek: 'MONDAY',
        startTime: '08:00',
        endTime: '12:00',
      });
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
        providerVehicles,
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
      setExceptionError(err.message || 'Erro ao criar exceção de agenda.');
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
      alert(err.message || 'Ação não autorizada.');
    }
  };

  const handleStartOnboarding = (type: ProviderType) => {
    setOnboardingType(type);
    setOnboardingStep(1);
    setOnboardingError('Credenciamento de novos prestadores requer endpoint de onboarding e upload seguro em Storage privado. Este fluxo esta bloqueado na Sprint 11.5 para evitar dados simulados em runtime.');
    setOnboardingForm({
      displayName: '',
      legalName: '',
      documentNumber: '',
      phone: '',
      publicContact: '',
      categories: ['B'],
      neighborhood: '',
      city: 'São Paulo',
      state: 'SP',
      serviceRadiusKm: 6,
      bio: type === 'INSTRUCTOR' ? 'Instrutor credenciado com 10 anos de experiência.' : 'Centro de formação completo para aulas práticas.',
    });
    setIsOnboardingMode(true);
  };

  const handleCreateDraft = () => {
    setOnboardingError('Criacao de cadastro bloqueada: a Sprint 11.5 usa apenas prestadores reais existentes no Supabase. O endpoint transacional de onboarding fica para sprint futura.');
    return;
  };



  const handleComplianceUploadBlocked = () => {
    setUploadModalDocType(null);
    alert('Upload de compliance bloqueado nesta sprint: precisa usar Storage privado com URL assinada e persistencia real no Supabase.');
  };

  const handleSubmitForReview = () => {
    setOnboardingError('Envio para analise bloqueado: o fluxo de compliance precisa de backend/admin real antes de mudar status do prestador.');
  };

  const handleSaveProfile = async () => {
    const radiusKm = Math.max(1, Math.min(100, Number(profileForm.serviceRadiusKm) || 1));
    try {
      await dbService.updateMyProfile(user.name, user.phone || '', profileAvatar);
      await dbService.updateProviderServiceRadius(currentProvider.id, radiusKm);
    } catch (error: any) {
      setWorkspaceError(error?.message || 'Não foi possível salvar o raio de atendimento.');
      return;
    }
    setProviders((prev) =>
      prev.map((p) => {
        if (p.id === currentProvider.id) {
          return {
            ...p,
            name: profileForm.displayName || p.name,
            publicContact: profileForm.publicContact || p.publicContact,
            neighborhood: profileForm.neighborhood || p.neighborhood,
            city: profileForm.city || p.city,
            state: profileForm.state || p.state,
            serviceRadiusKm: radiusKm,
            bio: profileForm.bio || p.bio,
            updatedAt: new Date().toISOString(),
          };
        }
        return p;
      })
    );
    setIsEditingProfile(false);
    alert('✓ Perfil atualizado com sucesso! Alterações públicas aplicadas.');
  };

  // Filter Bookings by Tab
  const filteredBookings = providerBookings.filter((b) => {
    if (bookingFilterTab === 'today') return b.scheduledDate === todayStr;
    if (bookingFilterTab === 'upcoming') return b.status === 'CONFIRMED' || b.status === 'IN_PROGRESS' || b.status === 'PENDING_PAYMENT';
    if (bookingFilterTab === 'history') return b.status === 'COMPLETED' || b.status === 'CANCELLED_BY_STUDENT' || b.status === 'CANCELLED_BY_PROVIDER' || b.status === 'EXPIRED';
    return true;
  });

  return (
    <div className="mazzi-app">
        
        {/* Header - MAZZI Pro Provider Portal */}
        <header className="mx-auto flex w-full max-w-[680px] items-center justify-between px-5 pt-[max(20px,env(safe-area-inset-top))]">
          <div className="flex items-center gap-3">
            <div>
              <p className="text-sm font-semibold text-[var(--mazzi-muted)]">Bom dia,</p><p className="text-lg font-extrabold">{currentProvider.name}</p>
            </div>
          </div>
          <button type="button" onClick={() => setActiveTab('profile')} className="mazzi-avatar grid h-12 w-12 place-items-center overflow-hidden text-sm font-extrabold">{profileAvatar ? <img src={profileAvatar} alt="Perfil" className="h-full w-full object-cover"/> : currentProvider.name.split(/\s+/).map((part) => part[0]).slice(0,2).join('')}</button>
        </header>

        {/* Navigation Tabs (Mobile-first responsive pills) */}
        {!isOnboardingMode && (
          <nav aria-label="Navegação MAZZI Pro" className="mazzi-bottom-nav grid-cols-5">{[{id:'dashboard',label:'Início',icon:'⌂'},{id:'schedule',label:'Agenda',icon:'◫'},{id:'bookings',label:'Aulas',icon:'●'},{id:'management',label:'Gestão',icon:'◇'},{id:'profile',label:'Perfil',icon:'○'}].map((item)=><button type="button" key={item.id} onClick={()=>setActiveTab(item.id)} className={`flex min-h-12 flex-col items-center justify-center rounded-2xl text-[10px] font-bold ${activeTab===item.id?'text-[var(--mazzi-text)]':'text-[var(--mazzi-muted)]'}`}><span className={`mb-1 grid h-7 w-7 place-items-center rounded-xl text-base ${activeTab===item.id?'bg-[var(--mazzi-yellow)]':''}`}>{item.icon}</span>{item.label}</button>)}</nav>
        )}

        {/* Main Content View */}
        <main className="mazzi-mobile space-y-6 text-left">
          
          {/* ONBOARDING WIZARD */}
          {isOnboardingMode ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                <div>
                  <h2 className="text-xl font-black text-slate-900">
                    Credenciamento de Prestador ({onboardingType === 'INSTRUCTOR' ? 'Instrutor' : 'Autoescola'})
                  </h2>
                  <p className="text-xs text-slate-500">
                    Etapa {onboardingStep} de 2 — Preencha os dados e anexe a documentação de compliance.
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setIsOnboardingMode(false)}>
                  Cancelar
                </Button>
              </div>

              {onboardingStep === 1 ? (
                <div className="space-y-4 max-w-xl">
                  {onboardingError && (
                    <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>{onboardingError}</span>
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        Nome de Exibição / Fantasia *
                      </label>
                      <Input
                        value={onboardingForm.displayName}
                        onChange={(e) => setOnboardingForm({ ...onboardingForm, displayName: e.target.value })}
                        placeholder="Ex: Carlos Silva Instrutor"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        Nome Civil / Razão Social *
                      </label>
                      <Input
                        value={onboardingForm.legalName}
                        onChange={(e) => setOnboardingForm({ ...onboardingForm, legalName: e.target.value })}
                        placeholder="Ex: Carlos Alberto da Silva"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        {onboardingType === 'INSTRUCTOR' ? 'CPF *' : 'CNPJ *'}
                      </label>
                      <Input
                        value={onboardingForm.documentNumber}
                        onChange={(e) => setOnboardingForm({ ...onboardingForm, documentNumber: e.target.value })}
                        placeholder={onboardingType === 'INSTRUCTOR' ? '000.000.000-00' : '00.000.000/0001-00'}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Telefone / WhatsApp *</label>
                      <Input
                        value={onboardingForm.phone}
                        onChange={(e) => setOnboardingForm({ ...onboardingForm, phone: e.target.value })}
                        placeholder="(11) 90000-0000"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Bairro / Região *</label>
                      <Input
                        value={onboardingForm.neighborhood}
                        onChange={(e) => setOnboardingForm({ ...onboardingForm, neighborhood: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Cidade *</label>
                      <Input
                        value={onboardingForm.city}
                        onChange={(e) => setOnboardingForm({ ...onboardingForm, city: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Raio de Atend. (km)</label>
                      <Input
                        type="number"
                        value={onboardingForm.serviceRadiusKm}
                        onChange={(e) => setOnboardingForm({ ...onboardingForm, serviceRadiusKm: Number(e.target.value) })}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Biografia & Metodologia</label>
                    <textarea
                      rows={3}
                      value={onboardingForm.bio}
                      onChange={(e) => setOnboardingForm({ ...onboardingForm, bio: e.target.value })}
                      className="w-full text-xs p-3 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-amber-400"
                      placeholder="Conte sobre sua experiência, didática e diferenciais..."
                    />
                  </div>

                  <div className="pt-4 flex justify-end">
                    <Button variant="primary" size="md" onClick={handleCreateDraft} rightIcon={<ArrowRight className="w-4 h-4" />}>
                      Avançar para Documentos
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-3">
                    <Info className="w-5 h-5 shrink-0 text-amber-600 mt-0.5" />
                    <div>
                      <strong>Privacidade e Segurança Documental:</strong> Seus documentos são armazenados em repositório privado seguro com controle estrito de acesso.
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-sm font-black text-slate-900">Requisitos Obrigatórios para Envio:</h3>
                    {DEFAULT_COMPLIANCE_REQUIREMENTS.filter((r) => r.providerType === onboardingType).map((req) => {
                      const doc = providerDocs.find((d) => d.type === req.documentType);
                      return (
                        <div
                          key={req.id}
                          className="p-4 rounded-2xl border border-slate-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 text-sm">{req.title}</span>
                              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                                CTB Validado
                              </span>
                            </div>
                            <p className="text-xs text-slate-500">{req.description}</p>
                            {doc && (
                              <p className="text-[11px] text-slate-600 font-mono">
                                Arquivo enviado: {doc.fileName} ({doc.status})
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
                                onClick={() => setUploadModalDocType(req.documentType)}
                              >
                                Anexar Arquivo
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="pt-4 flex items-center justify-between border-t border-slate-200">
                    <Button variant="secondary" size="sm" onClick={() => setOnboardingStep(1)}>
                      Voltar
                    </Button>
                    <Button
                      variant="primary"
                      size="md"
                      onClick={handleSubmitForReview}
                      disabled={providerDocs.length === 0}
                    >
                      Enviar para Análise de Compliance
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* DASHBOARD TAB (INÍCIO) */}
              {activeTab === 'dashboard' && (
                <div className="space-y-6">
                  <div><p className="mazzi-eyebrow mb-2">Hoje</p><h1 className="mazzi-title">Sua rotina</h1></div>
                  <section className="mazzi-hero"><div className="p-5"><p className="text-[36px] font-extrabold leading-none">{todayBookings.length}</p><p className="mt-2 text-xs font-bold opacity-70">aulas hoje</p></div><div className="p-5"><p className="text-[28px] font-extrabold leading-none">{nextBooking?.startTime || '—'}</p><p className="mt-2 text-xs font-bold text-white/60">próxima aula</p></div></section>
                  {/* Status Banner */}
                  <div
                    className={`p-4 rounded-3xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      currentProvider.status === 'ACTIVE'
                        ? 'bg-emerald-50/80 border-emerald-200'
                        : currentProvider.status === 'PENDING_REVIEW'
                        ? 'bg-amber-50/80 border-amber-200'
                        : currentProvider.status === 'REJECTED'
                        ? 'bg-rose-50/80 border-rose-200'
                        : 'bg-slate-100 border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold ${
                          currentProvider.status === 'ACTIVE'
                            ? 'bg-emerald-500 text-white'
                            : 'bg-amber-400 text-slate-950'
                        }`}
                      >
                        {currentProvider.status === 'ACTIVE' ? (
                          <ShieldCheck className="w-6 h-6" />
                        ) : (
                          <AlertCircle className="w-6 h-6" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-extrabold text-slate-900 text-sm">
                            {currentProvider.status === 'ACTIVE' && 'Credenciamento Ativo • Verificado pela MAZZI'}
                            {currentProvider.status === 'PENDING_REVIEW' && 'Cadastro em Análise pelo Compliance'}
                            {currentProvider.status === 'DRAFT' && 'Cadastro em Elaboração (Rascunho)'}
                            {currentProvider.status === 'REJECTED' && 'Cadastro Rejeitado — Ação Necessária'}
                            {currentProvider.status === 'SUSPENDED' && 'Cadastro Suspenso'}
                          </h4>
                          {currentProvider.isVerified && (
                            <span
                              title={getVerificationBadgeTooltip()}
                              className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded-full"
                            >
                              ✓ Verificado
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-600 mt-0.5">
                          {currentProvider.status === 'ACTIVE' &&
                            'Suas ofertas e horários estão visíveis para agendamentos de alunos em São Paulo.'}
                          {currentProvider.status === 'PENDING_REVIEW' &&
                            'Seus documentos foram recebidos e estão na fila de auditoria da equipe de moderação.'}
                          {currentProvider.status === 'REJECTED' &&
                            `Motivo: ${currentProvider.rejectionReason || 'Documentação não conforme.'}`}
                        </p>
                      </div>
                    </div>
                    <StatusBadge status={currentProvider.status} />
                  </div>

                  {/* Operational Metrics Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                        Aulas Hoje
                      </span>
                      <p className="text-2xl font-black text-slate-900 mt-1">{todayBookings.length}</p>
                    </div>

                    <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                        Confirmadas
                      </span>
                      <p className="text-2xl font-black text-emerald-600 mt-1">{confirmedBookings.length}</p>
                    </div>

                    <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                        Concluídas
                      </span>
                      <p className="text-2xl font-black text-slate-900 mt-1">{completedBookings.length}</p>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-900 text-white p-4 rounded-2xl">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 block">
                        Ganhos Registrados
                      </span>
                      <p className="text-xl font-black text-white mt-1">
                        {formatCentsToBRL(netEarningsInCents)}
                      </p>
                    </div>
                  </div>

                  {/* NEXT LESSON OPERATIONAL WIDGET */}
                  <div className="p-5 rounded-3xl bg-slate-950 text-white space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                      <div className="flex items-center gap-2">
                        <Clock className="w-5 h-5 text-amber-400" />
                        <h3 className="text-sm font-black text-white uppercase tracking-wider">
                          Próxima Aula Agendada
                        </h3>
                      </div>
                      <Badge variant="warning">Próxima Aula</Badge>
                    </div>

                    {nextBooking ? (
                      <div className="space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900 p-4 rounded-2xl border border-slate-800">
                          <div>
                            <p className="text-base font-black text-white">{nextBooking.studentName}</p>
                            <p className="text-xs text-amber-400 font-semibold mt-0.5">
                              {nextBooking.scheduledDate} • {nextBooking.startTime} - {nextBooking.endTime} ({nextBooking.category})
                            </p>
                            <p className="text-xs text-slate-400 mt-1">
                              Veículo: <span className="text-white font-medium">{nextBooking.snapshot.vehicleName}</span>
                            </p>
                            <p className="text-xs text-slate-400">
                              Ponto de Encontro: <span className="text-white font-medium">{formatMeetingPoint(nextBooking.meetingPoint)}</span>
                            </p>
                          </div>

                          <div className="flex flex-col sm:items-end gap-2 shrink-0">
                            <StatusBadge status={nextBooking.status} />
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => setSelectedBooking(nextBooking)}
                              rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                            >
                              Abrir Aula & Check-in
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-6 text-center text-slate-400 text-xs">
                        Nenhuma aula confirmada agendada para os próximos horários.
                      </div>
                    )}
                  </div>

                  {/* Operational Alerts */}
                  <div className="p-5 rounded-3xl bg-amber-50/80 border border-amber-200 text-xs text-amber-900 space-y-2">
                    <div className="flex items-center gap-2 font-black">
                      <AlertTriangle className="w-4 h-4 text-amber-700" />
                      <span>Alertas de Operação MAZZI Pro:</span>
                    </div>
                    <ul className="list-disc pl-5 space-y-1 text-amber-800">
                      {providerDocs.some((d) => d.status === 'PENDING' || d.status === 'UNDER_REVIEW') && (
                        <li>Você possui documentos aguardando análise de compliance.</li>
                      )}
                      {providerVehicles.length === 0 && (
                        <li>Nenhum veículo cadastrado. Cadastre um veículo na aba Gestão para publicar ofertas.</li>
                      )}
                      {providerBookings.some((b) => b.status === 'PENDING_PAYMENT') && (
                        <li>Existem reservas aguardando confirmação de pagamento PIX/Cartão pelo aluno.</li>
                      )}
                      <li>Lembre-se de realizar o check-in até 30 minutos antes do início de cada aula.</li>
                    </ul>
                  </div>
                </div>
              )}

              {/* SCHEDULE & AVAILABILITY TAB */}
              {activeTab === 'schedule' && (
                <div className="space-y-7">
                  <div className="space-y-4">
                    <div>
                      <p className="mazzi-eyebrow mb-2">Organização</p><h3 className="mazzi-title">Agenda</h3><p className="mt-2 text-sm text-[var(--mazzi-muted)]">Defina quando você está disponível.</p>
                    </div>

                    <Tabs
                      variant="pills"
                      activeTab={scheduleSubTab}
                      onChange={(st) => setScheduleSubTab(st as any)}
                      tabs={[
                        { id: 'rules', label: 'Regras Recorrentes', count: availabilityRules.filter((r) => r.providerId === currentProvider.id).length },
                        { id: 'exceptions', label: 'Bloqueios & Exceções', count: availabilityExceptions.filter((e) => e.providerId === currentProvider.id).length },
                        { id: 'simulator', label: 'Simulador de Slots' },
                      ]}
                    />
                  </div>

                  {/* Rules Subtab */}
                  {scheduleSubTab === 'rules' && (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-slate-500">
                          Dias e horários em que você ou seu veículo estão disponíveis para aulas.
                        </span>
                        <Button
                          variant="primary"
                          size="sm"
                          leftIcon={<Plus className="w-4 h-4" />}
                          onClick={() => setIsAddRuleModalOpen(true)}
                        >
                          + Adicionar Regra
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {availabilityRules
                          .filter((r) => r.providerId === currentProvider.id)
                          .map((rule) => (
                            <div
                              key={rule.id}
                              className="mazzi-card flex items-center justify-between p-4"
                            >
                              <div>
                                <span className="font-bold text-sm text-slate-900 block">
                                  {DAY_OF_WEEK_LABELS_PT[rule.dayOfWeek] || rule.dayOfWeek}
                                </span>
                                <span className="text-xs font-mono text-slate-600">
                                  {rule.startTime} - {rule.endTime} ({rule.timezone})
                                </span>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-rose-600 hover:bg-rose-50"
                                onClick={() => handleDeleteAvailabilityRule(rule.id)}
                              >
                                Excluir
                              </Button>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Exceptions Subtab */}
                  {scheduleSubTab === 'exceptions' && (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-slate-500">
                          Bloqueios pontuais por manutenção de veículo, compromissos pessoais ou feriados.
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          leftIcon={<Plus className="w-4 h-4" />}
                          onClick={() => setIsAddExceptionModalOpen(true)}
                        >
                          + Novo Bloqueio
                        </Button>
                      </div>

                      <div className="space-y-3">
                        {availabilityExceptions
                          .filter((e) => e.providerId === currentProvider.id)
                          .map((exc) => (
                            <div
                              key={exc.id}
                              className="p-4 rounded-2xl border border-rose-200 bg-rose-50/50 flex items-center justify-between"
                            >
                              <div>
                                <div className="flex items-center gap-2">
                                  <Badge variant="danger">{exc.type}</Badge>
                                  <span className="font-bold text-xs text-slate-900">{exc.reasonCategory}</span>
                                </div>
                                <p className="text-xs text-slate-700 mt-1">{exc.reason}</p>
                                <p className="text-[11px] font-mono text-slate-500 mt-0.5">
                                  Início: {exc.startAt} | Fim: {exc.endAt}
                                </p>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-rose-600"
                                onClick={() => handleDeleteAvailabilityException(exc.id)}
                              >
                                Remover
                              </Button>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Simulator Subtab */}
                  {scheduleSubTab === 'simulator' && (
                    <div className="p-5 rounded-3xl bg-slate-900 text-white space-y-4">
                      <h4 className="font-bold text-sm text-amber-400 uppercase tracking-wider">
                        Simulador de Geração Algorítmica de Slots de Aula
                      </h4>
                      <p className="text-xs text-slate-300">
                        Veja em tempo real como o algoritmo de busca publica seus horários elegíveis para os alunos.
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs font-bold text-slate-400 block mb-1">Oferta de Aula</label>
                          <select
                            value={simOfferingId}
                            onChange={(e) => setSimOfferingId(e.target.value)}
                            className="w-full bg-slate-950 text-white text-xs p-2.5 rounded-xl border border-slate-800"
                          >
                            {providerOfferings.map((o) => (
                              <option key={o.id} value={o.id}>
                                Oferta {o.category} - {o.durationMinutes} min - {formatCentsToBRL(o.priceInCents)}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="text-xs font-bold text-slate-400 block mb-1">Data para Simulação</label>
                          <Input
                            type="date"
                            value={simDate}
                            onChange={(e) => setSimDate(e.target.value)}
                            className="bg-slate-950 text-white border-slate-800 text-xs"
                          />
                        </div>
                      </div>

                      {/* Generated slots output */}
                      <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs space-y-2">
                        <span className="font-bold text-amber-400 block">Horários Gerados pelo Motor:</span>
                        {(() => {
                          const off = providerOfferings.find((o) => o.id === simOfferingId) || providerOfferings[0];
                          if (!off) return <p className="text-slate-500">Nenhuma oferta selecionada.</p>;

                          const slots = generateAvailableSlots({
                            offering: off,
                            provider: currentProvider,
                            vehicles: providerVehicles,
                            startDate: simDate,
                            endDate: simDate,
                            availabilityRules,
                            exceptions: availabilityExceptions,
                            existingBookings: providerBookings,
                          });

                          if (slots.length === 0) {
                            return <p className="text-slate-400">Nenhum slot vago gerado para esta data.</p>;
                          }

                          return (
                            <div className="flex flex-wrap gap-2 pt-1">
                              {slots.map((s) => (
                                <span
                                  key={`${s.date}_${s.startTime}_${s.instructorId}`}
                                  className="px-3 py-1 rounded-xl font-mono text-xs font-bold border bg-emerald-950/80 text-emerald-300 border-emerald-800"
                                >
                                  {s.startTime} - {s.endTime} ({s.instructorName})
                                </span>
                              ))}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* BOOKINGS LIST TAB (RESERVAS) */}
              {activeTab === 'bookings' && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
                    <div>
                      <h3 className="text-lg font-black text-slate-900">Reservas & Execução de Aulas</h3>
                      <p className="text-xs text-slate-500">
                        Gerencie agendamentos, execute o check-in e acompanhe o lifecycle das aulas.
                      </p>
                    </div>

                    <Tabs
                      variant="pills"
                      activeTab={bookingFilterTab}
                      onChange={(f) => setBookingFilterTab(f as any)}
                      tabs={[
                        { id: 'all', label: 'Todas', count: providerBookings.length },
                        { id: 'today', label: 'Hoje', count: todayBookings.length },
                        { id: 'upcoming', label: 'Confirmadas / Futuras', count: confirmedBookings.length },
                        { id: 'history', label: 'Histórico', count: completedBookings.length },
                      ]}
                    />
                  </div>

                  {/* Booking Items List */}
                  <div className="space-y-3">
                    {filteredBookings.length === 0 ? (
                      <div className="p-8 text-center bg-slate-50 rounded-3xl border border-slate-200 text-slate-500 text-xs">
                        Nenhuma reserva encontrada para este filtro.
                      </div>
                    ) : (
                      filteredBookings.map((b) => (
                        <div
                          key={b.id}
                          className="p-4 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-sm text-slate-900">{b.studentName}</span>
                              <StatusBadge status={b.status} />
                              {b.status === 'PENDING_PAYMENT' && (
                                <span className="text-[10px] bg-amber-100 text-amber-900 font-extrabold px-2 py-0.5 rounded-full">
                                  Aguardando Pagamento PIX/Cartão
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-600 font-semibold">
                              📅 {b.scheduledDate} às {b.startTime} - {b.endTime} ({b.category}) • Veículo: {b.snapshot?.vehicleName || b.vehicleName}
                            </p>
                            <p className="text-xs text-slate-500">
                              📍 Ponto de Encontro: {formatMeetingPoint(b.meetingPoint)}
                            </p>
                            <p className="text-xs font-mono text-slate-700">
                              Valor Comercial: {formatCentsToBRL(b.priceInCents)} + Taxa MAZZI {formatCentsToBRL(b.platformFeeInCents)} = Total {formatCentsToBRL(b.totalInCents)}
                            </p>
                          </div>

                          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedBookingForChat(b)}
                              leftIcon={<MessageSquare className="w-3.5 h-3.5" />}
                            >
                              Chat
                            </Button>
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => setSelectedBooking(b)}
                              rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                            >
                              Detalhes & Ações
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* MANAGEMENT TAB (GESTÃO) */}
              {activeTab === 'management' && (
                <div className="space-y-6">
                  <div className="border-b border-slate-200 pb-3">
                    <Tabs
                      variant="pills"
                      activeTab={managementSubTab}
                      onChange={(st) => setManagementSubTab(st as any)}
                      tabs={[
                        { id: 'vehicles', label: 'Veículos / Frota', count: providerVehicles.length },
                        { id: 'offerings', label: 'Serviços & Ofertas', count: providerOfferings.length },
                        { id: 'compliance', label: 'Compliance & Documentos', count: providerDocs.length },
                      ]}
                    />
                  </div>

                  {/* Vehicles Subtab */}
                  {managementSubTab === 'vehicles' && (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-slate-500">
                          Frota de veículos credenciada para aulas de direção.
                        </span>
                        <Button
                          variant="primary"
                          size="sm"
                          leftIcon={<Plus className="w-4 h-4" />}
                          onClick={() => setIsAddVehicleModalOpen(true)}
                        >
                          + Novo Veículo
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {providerVehicles.map((v) => (
                          <div key={v.id} className="p-4 rounded-2xl border border-slate-200 bg-white space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="font-black text-sm text-slate-900">{v.brand} {v.model} ({v.year})</span>
                              <StatusBadge status={v.status} />
                            </div>
                            <p className="text-xs text-slate-600">
                              Placa: <span className="font-mono font-bold text-slate-900">{v.licensePlateMasked || v.licensePlate}</span> (Mascada) • Categoria: {v.category} • Câmbio: {v.transmission}
                            </p>
                            <div className="pt-2 flex justify-end">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleToggleVehicleStatus(v.id)}
                              >
                                {v.status === 'ACTIVE' ? 'Pausar Veículo' : 'Ativar Veículo'}
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Offerings Subtab */}
                  {managementSubTab === 'offerings' && (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-slate-500">
                          Catálogo de serviços e valores comerciais publicados para os alunos.
                        </span>
                        <Button
                          variant="primary"
                          size="sm"
                          leftIcon={<Plus className="w-4 h-4" />}
                          onClick={() => setIsAddOfferingModalOpen(true)}
                        >
                          + Nova Oferta
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {providerOfferings.map((o) => (
                          <div key={o.id} className="mazzi-card space-y-3 p-5">
                            <div className="flex items-center justify-between">
                              <span className="font-black text-sm text-slate-900">
                                Categoria {o.category}
                              </span>
                              <Badge variant={o.status === 'ACTIVE' ? 'success' : 'neutral'}>
                                {o.status}
                              </Badge>
                            </div>
                            <p className="text-xs font-bold text-[var(--mazzi-muted)]">{o.durationMinutes} minutos</p><p className="text-2xl font-black">{formatCentsToBRL(o.priceInCents)}</p>
                            <div className="pt-2 flex justify-end">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleToggleOfferingStatus(o.id)}
                              >
                                {o.status === 'ACTIVE' ? 'Desativar Oferta' : 'Ativar Oferta'}
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Compliance Subtab */}
                  {managementSubTab === 'compliance' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-500">
                          Verificação regulatória e documentos de credenciamento oficial.
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          leftIcon={<Upload className="w-4 h-4" />}
                          onClick={() => setUploadModalDocType('CNH_EAR')}
                        >
                          Enviar Documento
                        </Button>
                      </div>

                      <div className="space-y-3">
                        {DEFAULT_COMPLIANCE_REQUIREMENTS.filter(
                          (r) => r.providerType === currentProvider.type
                        ).map((req) => {
                          const doc = providerDocs.find((d) => d.type === req.documentType);
                          return (
                            <div
                              key={req.id}
                              className="p-4 rounded-2xl border border-slate-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                            >
                              <div>
                                <h4 className="font-bold text-sm text-slate-900">{req.title}</h4>
                                <p className="text-xs text-slate-500">{req.description}</p>
                                {doc && (
                                  <p className="text-[11px] font-mono text-slate-600 mt-1">
                                    Arquivo: {doc.fileName} | Storage Privado: {doc.storagePath}
                                  </p>
                                )}
                              </div>
                              <div>
                                {doc ? (
                                  <StatusBadge status={doc.status} />
                                ) : (
                                  <Button
                                    variant="primary"
                                    size="sm"
                                    onClick={() => setUploadModalDocType(req.documentType)}
                                  >
                                    Anexar
                                  </Button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* FINANCIALS TAB */}
              {activeTab === 'finances' && (
                <div className="space-y-6">
                  {/* Notice Banner */}
                  <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center gap-3">
                    <Info className="w-5 h-5 text-amber-600 shrink-0" />
                    <div>
                      <strong>Valores registrados — ambiente de desenvolvimento (DEVELOPMENT_FAKE_PAYMENT)</strong>
                      <p className="mt-0.5">
                        Os valores nesta tela são projeções simuladas baseadas nos agendamentos concluídos na plataforma.
                      </p>
                    </div>
                  </div>

                  {/* Financial Metrics */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="p-5 rounded-3xl bg-slate-900 text-white border border-slate-800">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
                        Faturamento Bruto
                      </span>
                      <p className="text-2xl font-black text-amber-400 mt-1">
                        {formatCentsToBRL(grossEarningsInCents)}
                      </p>
                    </div>

                    <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                        Taxa de Serviço MAZZI (10%)
                      </span>
                      <p className="text-2xl font-black text-slate-900 mt-1">
                        {formatCentsToBRL(platformFeesInCents)}
                      </p>
                    </div>

                    <div className="p-5 rounded-3xl bg-emerald-50 border border-emerald-200 shadow-xs">
                      <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 block">
                        Líquido Registrado
                      </span>
                      <p className="text-2xl font-black text-emerald-900 mt-1">
                        {formatCentsToBRL(netEarningsInCents)}
                      </p>
                    </div>
                  </div>

                  {/* Ledger Breakdown Table */}
                  <div className="p-5 rounded-3xl bg-white border border-slate-200 space-y-4">
                    <h4 className="font-extrabold text-sm text-slate-900">Extrato de Repasses em Desenvolvimento (Safety Period 24h)</h4>
                    <div className="space-y-2">
                      {completedBookings.map((b) => (
                        <div key={b.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                          <div>
                            <span className="font-bold text-slate-900">{b.studentName} ({b.scheduledDate})</span>
                            <span className="block text-slate-500 font-mono">Ref: {b.id}</span>
                          </div>
                          <div className="text-right">
                            <span className="font-black text-emerald-700 block">{formatCentsToBRL(b.priceInCents)}</span>
                            <Badge variant="warning">HELD (Trava 24h)</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* PROFILE TAB */}
              {activeTab === 'profile' && (
                <div className="space-y-7">
                  <div className="text-center">
                    <div className="mazzi-avatar mx-auto grid h-24 w-24 place-items-center overflow-hidden text-2xl font-extrabold">{profileAvatar ? <img src={profileAvatar} alt="Foto do perfil" className="h-full w-full object-cover"/> : currentProvider.name.split(/\s+/).map((part)=>part[0]).slice(0,2).join('')}</div><h3 className="mt-4 text-2xl font-extrabold tracking-tight">{currentProvider.name}</h3><p className="mt-1 text-sm text-[var(--mazzi-muted)]">★ {currentProvider.ratingAverage?.toFixed(1) || 'Novo'} · {currentProvider.neighborhood}</p>
                  </div>
                  <div className="mazzi-hero"><div className="p-5"><p className="text-2xl font-extrabold">{completedBookings.length}</p><p className="mt-1 text-xs font-bold opacity-70">aulas</p></div><div className="p-5"><p className="text-2xl font-extrabold">{currentProvider.ratingAverage?.toFixed(1) || '—'}</p><p className="mt-1 text-xs font-bold text-white/60">avaliação</p></div></div>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="mazzi-section-title">Dados profissionais</h3>
                    </div>
                    {!isEditingProfile ? (
                      <Button variant="outline" size="sm" onClick={() => setIsEditingProfile(true)}>
                        Editar Informações Públicas
                      </Button>
                    ) : (
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setIsEditingProfile(false)}>
                          Cancelar
                        </Button>
                        <Button variant="primary" size="sm" onClick={handleSaveProfile}>
                          Salvar Alterações
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="rounded-3xl border border-slate-200 bg-white p-5">
                    <h4 className="mb-3 text-sm font-black text-slate-900">Foto do perfil</h4>
                    <ProfilePhotoPicker
                      value={profileAvatar}
                      name={user.name}
                      onChange={setProfileAvatar}
                      disabled={!isEditingProfile}
                    />
                    <p className="mt-2 text-xs text-slate-500">Use a câmera do celular ou selecione uma imagem da galeria.</p>
                  </div>

                  {/* Public vs Private Data Projections */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Public Projections */}
                    <div className="p-5 rounded-3xl bg-emerald-50/80 border border-emerald-200 space-y-3">
                      <div className="flex items-center gap-2">
                        <Eye className="w-5 h-5 text-emerald-700" />
                        <h4 className="font-black text-sm text-emerald-900 uppercase tracking-wider">
                          Informações Públicas (Visíveis para Alunos)
                        </h4>
                      </div>
                      <div className="space-y-2 text-xs text-emerald-950">
                        <div>
                          <label className="font-bold text-emerald-900 block">Nome de Exibição Comercial:</label>
                          {isEditingProfile ? (
                            <Input
                              value={profileForm.displayName}
                              onChange={(e) => setProfileForm({ ...profileForm, displayName: e.target.value })}
                            />
                          ) : (
                            <p className="font-semibold">{currentProvider.name}</p>
                          )}
                        </div>

                        <div>
                          <label className="font-bold text-emerald-900 block">Contato Comercial Público:</label>
                          {isEditingProfile ? (
                            <Input
                              value={profileForm.publicContact}
                              onChange={(e) => setProfileForm({ ...profileForm, publicContact: e.target.value })}
                            />
                          ) : (
                            <p className="font-semibold">{currentProvider.publicContact || currentProvider.phone || 'Não informado'}</p>
                          )}
                        </div>

                        <div>
                          <label className="font-bold text-emerald-900 block">Região de Atendimento:</label>
                          {isEditingProfile ? (
                            <div className="grid grid-cols-2 gap-2">
                              <Input
                                value={profileForm.neighborhood}
                                onChange={(e) => setProfileForm({ ...profileForm, neighborhood: e.target.value })}
                              />
                              <Input
                                value={profileForm.city}
                                onChange={(e) => setProfileForm({ ...profileForm, city: e.target.value })}
                              />
                            </div>
                          ) : (
                            <p className="font-semibold">{currentProvider.neighborhood}, {currentProvider.city}/{currentProvider.state || 'SP'}</p>
                          )}
                        </div>

                        <div>
                          <label className="font-bold text-emerald-900 block">Biografia & Metodologia:</label>
                          {isEditingProfile ? (
                            <textarea
                              rows={2}
                              value={profileForm.bio}
                              onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })}
                              className="w-full text-xs p-2 rounded-xl border border-emerald-300"
                            />
                          ) : (
                            <p className="font-semibold">{currentProvider.bio}</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Private Projections */}
                    <div className="p-5 rounded-3xl bg-slate-900 text-white space-y-3">
                      <div className="flex items-center gap-2">
                        <Lock className="w-5 h-5 text-amber-400" />
                        <h4 className="font-black text-sm text-amber-400 uppercase tracking-wider">
                          Informações Privadas (Strict Internal Privacy)
                        </h4>
                      </div>
                      <div className="space-y-2 text-xs text-slate-300">
                        <div>
                          <span className="font-bold text-white block">Razão Social / Nome Civil:</span>
                          <p className="font-mono text-slate-400">{currentProvider.legalName || 'Sigilo Protegido'}</p>
                        </div>
                        <div>
                          <span className="font-bold text-white block">CPF / CNPJ:</span>
                          <p className="font-mono text-slate-400">{currentProvider.documentNumber || 'Sigilo Protegido'}</p>
                        </div>
                        <div>
                          <span className="font-bold text-white block">Documentos de Compliance:</span>
                          <p className="text-slate-400">Armazenados em bucket privado seguro com URLs temporárias com expiração.</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <Button
                        variant="outline"
                        size="md"
                        className="text-rose-700 border-rose-200 hover:bg-rose-50"
                        onClick={() => { void logout(); }}
                        leftIcon={<LogOut className="w-4 h-4" />}
                      >
                        Sair
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </main>

        {/* BOOKING DETAILS & LESSON SESSION EXECUTION MODAL */}
        {selectedBooking && (
          <Modal
            isOpen={!!selectedBooking}
            onClose={() => {
              setSelectedBooking(null);
              setBookingActionError(null);
              setBookingActionSuccess(null);
            }}
            title={`Detalhes da Aula - Ref #${selectedBooking.id}`}
          >
            <div className="space-y-4 text-xs">
              {bookingActionError && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{bookingActionError}</span>
                </div>
              )}

              {bookingActionSuccess && (
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{bookingActionSuccess}</span>
                </div>
              )}

              {/* Status Header */}
              <div className="p-3.5 rounded-2xl bg-slate-100 flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-700 block">Status Comercial do Booking:</span>
                  <StatusBadge status={selectedBooking.status} />
                </div>
                <div className="text-right">
                  <span className="font-bold text-slate-700 block">Execução da Aula:</span>
                  <Badge variant={getOrCreateSession(selectedBooking).state === 'COMPLETED' ? 'success' : 'warning'}>
                    {getOrCreateSession(selectedBooking).state}
                  </Badge>
                </div>
              </div>

              {/* Participants & Vehicle Info */}
              <div className="grid grid-cols-2 gap-3 p-4 rounded-2xl border border-slate-200 bg-white">
                <div>
                  <span className="text-slate-500 font-bold block">Aluno Participante:</span>
                  <p className="font-black text-slate-900">{selectedBooking.studentName}</p>
                </div>
                <div>
                  <span className="text-slate-500 font-bold block">Instrutor Responsável:</span>
                  <p className="font-black text-slate-900">{selectedBooking.instructorName}</p>
                </div>
                <div>
                  <span className="text-slate-500 font-bold block">Veículo / Transmissão:</span>
                  <p className="font-bold text-slate-900">
                    {selectedBooking.snapshot?.vehicleName || selectedBooking.vehicleName} ({selectedBooking.snapshot?.transmission || 'MANUAL'})
                  </p>
                </div>
                <div>
                  <span className="text-slate-500 font-bold block">Categoria CNH:</span>
                  <p className="font-bold text-slate-900">Categoria {selectedBooking.category}</p>
                </div>
              </div>

              {/* Schedule & Location */}
              <div className="p-4 rounded-2xl border border-slate-200 bg-white space-y-1">
                <p className="font-bold text-slate-900">
                  📅 Data: {selectedBooking.scheduledDate} das {selectedBooking.startTime} às {selectedBooking.endTime} ({selectedBooking.snapshot?.durationMinutes || 50} min)
                </p>
                <p className="text-slate-700">
                  📍 Ponto de Encontro Autorizado: <span className="font-semibold text-slate-900">{formatMeetingPoint(selectedBooking.meetingPoint)}</span>
                </p>
              </div>

              {/* Commercial Breakdown */}
              <div className="p-4 rounded-2xl bg-slate-950 text-white space-y-2">
                <span className="font-bold text-amber-400 block uppercase tracking-wider">Snapshot Comercial Congelado:</span>
                <div className="flex justify-between border-b border-slate-800 pb-1">
                  <span>Valor da Aula:</span>
                  <span className="font-bold">{formatCentsToBRL(selectedBooking.priceInCents)}</span>
                </div>
                <div className="flex justify-between border-b border-slate-800 pb-1">
                  <span>Taxa de Serviço MAZZI (10%):</span>
                  <span className="font-bold">{formatCentsToBRL(selectedBooking.platformFeeInCents)}</span>
                </div>
                <div className="flex justify-between font-black text-amber-400 text-sm pt-1">
                  <span>Total Pago pelo Aluno:</span>
                  <span>{formatCentsToBRL(selectedBooking.totalInCents)}</span>
                </div>
              </div>

              {/* OPERATIONAL ACTION BUTTONS */}
              <div className="pt-2 flex flex-wrap gap-2 justify-end border-t border-slate-200">
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<MessageSquare className="w-4 h-4" />}
                  onClick={() => setSelectedBookingForChat(selectedBooking)}
                >
                  Abrir Chat
                </Button>

                {selectedBooking.status === 'CONFIRMED' && !getOrCreateSession(selectedBooking).instructorCheckedInAt && (
                  <Button
                    variant="primary"
                    size="sm"
                    leftIcon={<CheckCircle2 className="w-4 h-4" />}
                    onClick={() => handleCheckIn(selectedBooking)}
                  >
                    Realizar Check-in do Instrutor
                  </Button>
                )}

                {getOrCreateSession(selectedBooking).state === 'CHECKED_IN' && (
                  <Button
                    variant="primary"
                    size="sm"
                    leftIcon={<Play className="w-4 h-4" />}
                    onClick={() => handleStartLesson(selectedBooking)}
                  >
                    Iniciar Aula Prática
                  </Button>
                )}

                {getOrCreateSession(selectedBooking).state === 'IN_PROGRESS' && (
                  <Button
                    variant="primary"
                    size="sm"
                    loading={isCompleting}
                    leftIcon={<CheckCircle className="w-4 h-4" />}
                    onClick={() => handleCompleteLesson(selectedBooking)}
                  >
                    Finalizar Aula Prática
                  </Button>
                )}

                {(selectedBooking.status === 'CONFIRMED' || selectedBooking.status === 'PENDING_PAYMENT') && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-rose-600 border-rose-200 hover:bg-rose-50"
                    leftIcon={<Ban className="w-4 h-4" />}
                    onClick={() => handleCancelBooking(selectedBooking)}
                  >
                    Cancelar Agendamento
                  </Button>
                )}
              </div>
            </div>
          </Modal>
        )}

        <Modal
          isOpen={!!selectedBookingForChat}
          onClose={() => setSelectedBookingForChat(null)}
          title="Chat da aula"
          size="lg"
        >
          {selectedBookingForChat && <BookingChatPanel booking={selectedBookingForChat} />}
        </Modal>

        {/* ADD RULE MODAL */}
        {isAddRuleModalOpen && (
          <Modal
            isOpen={isAddRuleModalOpen}
            onClose={() => setIsAddRuleModalOpen(false)}
            title="Adicionar Regra Recorrente de Disponibilidade"
          >
            <div className="space-y-4 text-xs">
              {ruleError && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 font-bold">
                  {ruleError}
                </div>
              )}
              <div>
                <label className="font-bold text-slate-700 block mb-1">Dia da Semana</label>
                <select
                  value={ruleForm.dayOfWeek}
                  onChange={(e) => setRuleForm({ ...ruleForm, dayOfWeek: e.target.value as DayOfWeek })}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300"
                >
                  <option value="MONDAY">Segunda-feira</option>
                  <option value="TUESDAY">Terça-feira</option>
                  <option value="WEDNESDAY">Quarta-feira</option>
                  <option value="THURSDAY">Quinta-feira</option>
                  <option value="FRIDAY">Sexta-feira</option>
                  <option value="SATURDAY">Sábado</option>
                  <option value="SUNDAY">Domingo</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Horário Início</label>
                  <Input
                    type="time"
                    value={ruleForm.startTime}
                    onChange={(e) => setRuleForm({ ...ruleForm, startTime: e.target.value })}
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Horário Fim</label>
                  <Input
                    type="time"
                    value={ruleForm.endTime}
                    onChange={(e) => setRuleForm({ ...ruleForm, endTime: e.target.value })}
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setIsAddRuleModalOpen(false)}>
                  Cancelar
                </Button>
                <Button variant="primary" size="sm" onClick={handleCreateAvailabilityRule}>
                  Salvar Regra
                </Button>
              </div>
            </div>
          </Modal>
        )}

        {/* ADD EXCEPTION MODAL */}
        {isAddExceptionModalOpen && (
          <Modal
            isOpen={isAddExceptionModalOpen}
            onClose={() => setIsAddExceptionModalOpen(false)}
            title="Adicionar Bloqueio / Exceção de Agenda"
          >
            <div className="space-y-4 text-xs">
              {exceptionError && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 font-bold">
                  {exceptionError}
                </div>
              )}
              <div>
                <label className="font-bold text-slate-700 block mb-1">Categoria do Bloqueio</label>
                <select
                  value={exceptionForm.reasonCategory}
                  onChange={(e) => setExceptionForm({ ...exceptionForm, reasonCategory: e.target.value as any })}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300"
                >
                  <option value="PERSONAL">Compromisso Pessoal / Exame</option>
                  <option value="MAINTENANCE">Manutenção de Veículo</option>
                  <option value="VACATION">Férias / Recesso</option>
                  <option value="HOLIDAY">Feriado Municipal/Estadual</option>
                  <option value="MANUAL_BLOCK">Bloqueio Administrativo</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Motivo (Nota Interna Privada)</label>
                <Input
                  value={exceptionForm.reason}
                  onChange={(e) => setExceptionForm({ ...exceptionForm, reason: e.target.value })}
                  placeholder="Ex: Troca de pastilhas de freio do veículo HB20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Data Início</label>
                  <Input
                    type="date"
                    value={exceptionForm.startDate}
                    onChange={(e) => setExceptionForm({ ...exceptionForm, startDate: e.target.value })}
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Hora Início</label>
                  <Input
                    type="time"
                    value={exceptionForm.startTime}
                    onChange={(e) => setExceptionForm({ ...exceptionForm, startTime: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Data Fim</label>
                  <Input
                    type="date"
                    value={exceptionForm.endDate}
                    onChange={(e) => setExceptionForm({ ...exceptionForm, endDate: e.target.value })}
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Hora Fim</label>
                  <Input
                    type="time"
                    value={exceptionForm.endTime}
                    onChange={(e) => setExceptionForm({ ...exceptionForm, endTime: e.target.value })}
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setIsAddExceptionModalOpen(false)}>
                  Cancelar
                </Button>
                <Button variant="primary" size="sm" onClick={handleCreateAvailabilityException}>
                  Criar Bloqueio
                </Button>
              </div>
            </div>
          </Modal>
        )}

        {/* ADD VEHICLE MODAL */}
        {isAddVehicleModalOpen && (
          <Modal
            isOpen={isAddVehicleModalOpen}
            onClose={() => setIsAddVehicleModalOpen(false)}
            title="Cadastrar Novo Veículo na Frota"
          >
            <div className="space-y-4 text-xs">
              {vehicleError && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 font-bold">
                  {vehicleError}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Marca *</label>
                  <Input
                    value={vehicleForm.brand}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, brand: e.target.value })}
                    placeholder="Ex: Hyundai"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Modelo *</label>
                  <Input
                    value={vehicleForm.model}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, model: e.target.value })}
                    placeholder="Ex: HB20 Sense"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Ano *</label>
                  <Input
                    type="number"
                    value={vehicleForm.year}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, year: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Placa (Privada) *</label>
                  <Input
                    value={vehicleForm.licensePlate}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, licensePlate: e.target.value })}
                    placeholder="ABC1D23"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Categoria CNH</label>
                  <select
                    value={vehicleForm.category}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, category: e.target.value as VehicleCategory })}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-slate-50 font-bold"
                  >
                    <option value="B">Categoria B (Carro - MVP)</option>
                  </select>
                  <p className="text-[10px] text-slate-400 mt-1">Categoria A (Moto) será habilitada pós-MVP.</p>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Câmbio / Transmissão</label>
                  <select
                    value={vehicleForm.transmission}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, transmission: e.target.value as TransmissionType })}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-300"
                  >
                    <option value="MANUAL">Manual</option>
                    <option value="AUTOMATIC">Automático</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setIsAddVehicleModalOpen(false)}>
                  Cancelar
                </Button>
                <Button variant="primary" size="sm" onClick={handleCreateVehicle}>
                  Cadastrar Veículo
                </Button>
              </div>
            </div>
          </Modal>
        )}

        {/* ADD OFFERING MODAL */}
        {isAddOfferingModalOpen && (
          <Modal
            isOpen={isAddOfferingModalOpen}
            onClose={() => setIsAddOfferingModalOpen(false)}
            title="Criar Oferta de Aula Prática"
          >
            <div className="space-y-4 text-xs">
              {offeringError && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 font-bold">
                  {offeringError}
                </div>
              )}
              <div>
                <label className="font-bold text-slate-700 block mb-1">Veículo Associado *</label>
                <select
                  value={offeringForm.vehicleId}
                  onChange={(e) => setOfferingForm({ ...offeringForm, vehicleId: e.target.value })}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300"
                >
                  <option value="">-- Selecione o Veículo --</option>
                  {providerVehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.brand} {v.model} ({v.category} - {v.transmission})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Duração (Minutos)</label>
                  <Input
                    type="number"
                    value={offeringForm.durationMinutes}
                    onChange={(e) => setOfferingForm({ ...offeringForm, durationMinutes: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Preço (R$ em Reais)</label>
                  <Input
                    value={offeringForm.priceInBrl}
                    onChange={(e) => setOfferingForm({ ...offeringForm, priceInBrl: e.target.value })}
                    placeholder="95,00"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setIsAddOfferingModalOpen(false)}>
                  Cancelar
                </Button>
                <Button variant="primary" size="sm" onClick={handleCreateOffering}>
                  Publicar Oferta
                </Button>
              </div>
            </div>
          </Modal>
        )}

        {/* COMPLIANCE UPLOAD BLOCKED MODAL */}
        {uploadModalDocType && (
          <Modal
            isOpen={!!uploadModalDocType}
            onClose={() => setUploadModalDocType(null)}
            title="Upload de Compliance Pendente"
          >
            <div className="space-y-4 text-xs">
              <p className="text-slate-600">
                O envio de documentos exige Storage privado, URL assinada e persistencia real no Supabase. Este fluxo esta bloqueado nesta sprint para evitar documento simulado no runtime.
              </p>
              <div className="pt-2 flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setUploadModalDocType(null)}>
                  Cancelar
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleComplianceUploadBlocked}
                >
                  Entendi
                </Button>
              </div>
            </div>
          </Modal>
        )}
    </div>
  );
};

