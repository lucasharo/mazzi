// ============================================================================
// MAZZI PLATFORM — REAL SUPABASE DATABASE DATA ACCESS SERVICE
// File: src/lib/db-service.ts
// ============================================================================

import { supabase } from './supabase';
import { isNativeApp } from './native-platform';
import { repairMojibake } from './text-encoding';
import { MVP_LESSON_DURATION_MINUTES } from '../domain/vehicles-offerings';
import {
  Provider,
  Vehicle,
  ServiceOffering,
  Booking,
  VehicleCategory,
  ComplianceDocument,
  AuditLog,
  User,
  StudentSavedAddress,
  UserRole,
  ProviderStatus,
  Quote,
  Conversation,
  Message,
  Review,
  Notification,
  NotificationType,
  AdminAnalyticsSummary,
  AdminReportsResponse,
  AdminReportDailyResponse,
  ProviderAnalyticsSummary,
  ProviderEarningsSummary,
  ProviderCompletedPayout,
  ProviderPayoutDetail,
  ProviderEarningsPeriodPreset,
  ProductAnalyticsEventName,
  AnalyticsPeriodPreset,
  PublicSearchProviderResult,
  Payout,
  BookingDisputeMessage,
  PixDestination,
  ProviderPaymentAccount,
  ProviderMaskedPayoutAccount,
  BookingDispute,
  BookingDisputeEvidence,
  BookingDisputeReason,
  BookingDisputeResolution,
  MazziPaymentStatus,
  InstantLessonSettings,
  InstantLessonInstructorStatus,
  InstantLessonPriceOption,
  InstantLessonRequest,
  InstantLessonOffer,
  InstantLessonTracking,
  InstantCancellationQuote,
} from '../types';
import { normalizeComplianceStatus } from '../domain/compliance-status';
import { CURRENT_PROFESSIONAL_TERMS_VERSION } from '../domain/professional-terms';
import { formatDateBR, formatTimeBR, getBusinessDateOnly } from './date-format';
import { formatFullMeetingPoint, formatMeetingPoint } from './meeting-point';
import type { PublicPlatformConfiguration } from '../domain/platform-config';
import type { CheckInLocation } from './checkin-location';
import { getCheckoutGatewayProvider } from './payment-gateway-config';
import { normalizePhone } from './input-masks';

// Cast supabase to any to safely query dynamic tables
const sp = supabase as any;

function isMissingRpc(error: any, functionName: string): boolean {
  return error?.code === 'PGRST202'
    && typeof error?.message === 'string'
    && error.message.includes(`public.${functionName}`);
}

function mapProviderPayoutDetail(data: any): ProviderPayoutDetail {
  return {
    id: String(data.id),
    status: data.status,
    amount_in_cents: Number(data.amount_in_cents),
    scheduled_release_at: data.scheduled_release_at,
    arrival_date: data.arrival_date || null,
    released_at: data.released_at || null,
    processed_at: data.processed_at || null,
    failure_reason: data.failure_reason || null,
  };
}

function mapInstantSettingRow(row: any, fallback?: { instructorId?: string; vehicleId?: string }): InstantLessonSettings {
  return {
    id: row.id,
    providerId: row.provider_id,
    instructorId: row.instructor_id || fallback?.instructorId,
    vehicleId: row.vehicle_id || fallback?.vehicleId,
    offeringId: row.offering_id,
    category: row.category,
    transmission: row.transmission,
    durationMinutes: Number(row.duration_minutes || 50),
    instantEnabled: row.instant_enabled === true,
    instantOnline: row.instant_online === true,
    instantPriceInCents: Number(row.instant_price_in_cents || 0),
    maxDistanceKm: Number(row.max_distance_km || 5),
    updatedAt: row.updated_at,
  };
}

function mapInstantInstructorStatusRow(row: any): InstantLessonInstructorStatus {
  return {
    providerId: row.provider_id,
    instructorId: row.instructor_id,
    instantOnline: row.instant_online === true,
    onlineSince: row.online_since,
    onlineExpiresAt: row.online_expires_at,
    updatedAt: row.updated_at,
  };
}

function mapMaskedPayoutAccount(metadata: Record<string, any> | null | undefined): ProviderMaskedPayoutAccount | undefined {
  const summary = metadata?.masked_payout_account;
  if (!summary || (summary.kind !== 'bank_account' && summary.kind !== 'card')) return undefined;
  return {
    kind: summary.kind,
    bankName: typeof summary.bankName === 'string' ? summary.bankName : undefined,
    last4: typeof summary.last4 === 'string' ? summary.last4 : undefined,
    country: typeof summary.country === 'string' ? summary.country : undefined,
    currency: typeof summary.currency === 'string' ? summary.currency : undefined,
    status: typeof summary.status === 'string' ? summary.status : undefined,
  };
}

function mapProviderPaymentAccount(data: any, gateway: ProviderPaymentAccount['gateway'] = 'STRIPE'): ProviderPaymentAccount {
  const metadata = data.metadata || undefined;
  return {
    id: data.id,
    providerId: data.provider_id,
    gateway,
    externalAccountId: data.external_account_id,
    status: data.status,
    chargesEnabled: data.charges_enabled === true,
    payoutsEnabled: data.payouts_enabled === true,
    onboardingUrl: data.onboarding_url || undefined,
    metadata,
    maskedPayoutAccount: mapMaskedPayoutAccount(metadata),
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

function mapBookingDisputeMessage(row: any): BookingDisputeMessage {
  return {
    id: row.id,
    disputeId: row.dispute_id,
    authorId: row.author_id || undefined,
    authorRole: row.author_role,
    type: row.message_type,
    content: row.content,
    createdAt: row.created_at,
  };
}

function mapBookingDispute(row: any): BookingDispute {
  return {
    id: row.id,
    bookingId: row.booking_id,
    openedBy: row.opened_by,
    openedByRole: row.opened_by_role,
    reasonCode: row.reason_code,
    description: row.description,
    status: row.status,
    responseBy: row.response_by || undefined,
    responseText: row.response_text || undefined,
    respondedAt: row.responded_at || undefined,
    resolutionCode: row.resolution_code || undefined,
    resolutionNotes: row.resolution_notes || undefined,
    refundAmountInCents: row.refund_amount_in_cents ?? undefined,
    responseDueAt: row.response_due_at,
    informationRequest: row.information_request || undefined,
    messages: Array.isArray(row.messages) ? row.messages.map(mapBookingDisputeMessage) : undefined,
    resolvedAt: row.resolved_at || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapBookingDisputeEvidence(row: any): BookingDisputeEvidence {
  return {
    id: row.id,
    disputeId: row.dispute_id,
    uploadedBy: row.uploaded_by,
    storagePath: row.storage_path,
    evidenceType: row.evidence_type,
    originalName: row.metadata?.original_name || 'Arquivo',
    mimeType: row.metadata?.mime_type || 'application/octet-stream',
    size: Number(row.metadata?.size || 0),
    createdAt: row.created_at,
  };
}

export function isUuid(val?: string): boolean {
  return Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val));
}

// Helper to safely format snake_case from database to camelCase in typescript
export function mapUserFromDb(row: any): User | null {
  if (!row) return null;
  const savedAddress = row.metadata?.student_saved_address;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    cpf: row.cpf || undefined,
    birthDate: row.birth_date ? String(row.birth_date).slice(0, 10) : undefined,
    role: row.role as UserRole,
    avatarUrl: row.avatar_url || undefined,
    studentSavedAddress: savedAddress && typeof savedAddress === 'object' && Number.isFinite(Number(savedAddress.latitude)) && Number.isFinite(Number(savedAddress.longitude))
      ? savedAddress as StudentSavedAddress
      : undefined,
    createdAt: row.created_at,
  };
}

export function mapProviderFromDb(row: any): Provider {
  const categories = Array.isArray(row.categories) ? row.categories.filter(Boolean) : [];
  const transmissions = Array.isArray(row.transmissions) ? row.transmissions.filter(Boolean) : [];
  return {
    id: row.id,
    userId: row.user_id || undefined,
    name: row.trade_name || row.legal_name || 'Prestador',
    legalName: row.legal_name || undefined,
    documentNumber: row.document_number || undefined,
    phone: row.phone || undefined,
    commercialEmail: row.commercial_email || undefined,
    type: row.type,
    status: row.status,
    ratingAverage: row.rating_average == null ? 0 : Number(row.rating_average),
    ratingCount: row.rating_count == null ? 0 : Number(row.rating_count),
    neighborhood: row.neighborhood || '',
    city: row.city || '',
    state: row.state || undefined,
    address: row.address ? { ...row.address, postalCode: row.address.postalCode || row.postal_code || undefined } : (row.postal_code ? { postalCode: row.postal_code, source: 'LEGACY' as const } : undefined),
    latitude: row.latitude == null ? undefined : Number(row.latitude),
    longitude: row.longitude == null ? undefined : Number(row.longitude),
    serviceRadiusKm: row.service_radius_km || 5,
    categories,
    transmissions,
    startingPriceInCents: row.starting_price_in_cents == null ? 0 : Number(row.starting_price_in_cents),
    isVerified: row.status === 'ACTIVE',
  };
}

export function mapVehicleFromDb(row: any): Vehicle {
  return {
    id: row.id,
    providerId: row.provider_id,
    brand: row.brand,
    model: row.model,
    year: row.year,
    licensePlate: row.license_plate,
    licensePlateMasked: row.license_plate_masked || row.license_plate,
    category: row.category,
    vehicleType: row.vehicle_type,
    transmission: row.transmission,
    status: row.status,
    blockedReason: row.blocked_reason || undefined,
    color: row.color || 'Prata',
    photos: row.photos || [],
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString(),
  } as any;
}

export function mapOfferingFromDb(row: any): ServiceOffering {
  return {
    id: row.id,
    providerId: row.provider_id,
    instructorId: row.instructor_id || undefined,
    vehicleId: row.vehicle_id,
    category: row.category,
    transmission: row.transmission || undefined,
    durationMinutes: row.duration_minutes,
    priceInCents: row.price_in_cents,
    status: row.status || (row.is_active ? 'ACTIVE' : 'INACTIVE'),
    source: row.source === 'AULA_AGORA' ? 'AULA_AGORA' : 'AGENDA',
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString(),
  } as any;
}

export function mapBookingFromDb(row: any, offeringCategory?: string): Booking {
  const snapshot = typeof row.snapshot_data === 'string' 
    ? JSON.parse(row.snapshot_data) 
    : (row.snapshot_data || {});
  const instructorName = snapshot.instructorName || snapshot.instructor_name || row.instructor_name || '';
  const providerName = snapshot.providerName || snapshot.provider_name || row.provider_name || '';
  const instructorAvatarUrl = snapshot.instructorAvatarUrl || snapshot.instructor_avatar_url || row.instructor_avatar_url || undefined;
  const providerAvatarUrl = snapshot.providerAvatarUrl || snapshot.provider_avatar_url || row.provider_avatar_url || undefined;
  const studentAvatarUrl = snapshot.studentAvatarUrl || snapshot.student_avatar_url || row.student_avatar_url || undefined;
  const vehicleName = snapshot.vehicleName || snapshot.vehicle_name || row.vehicle_name || '';
  const structuredMeetingPoint = row.meeting_point ?? snapshot.meetingPoint ?? snapshot.meeting_point ?? '';
  const meetingPointLabel = formatMeetingPoint(structuredMeetingPoint);
  const fullMeetingPoint = formatFullMeetingPoint(structuredMeetingPoint);
  const normalizedSnapshot = {
    ...snapshot,
    instructorName,
    providerName,
    ...(instructorAvatarUrl ? { instructorAvatarUrl } : {}),
    ...(providerAvatarUrl ? { providerAvatarUrl } : {}),
    ...(studentAvatarUrl ? { studentAvatarUrl } : {}),
    vehicleName,
    meetingPoint: structuredMeetingPoint,
    meetingPointLabel,
    fullMeetingPoint,
  };

  // Category resolution order: row.category -> snapshot.category -> offeringCategory
  const rawCategory = row.category || snapshot.category || offeringCategory;
  const category = typeof rawCategory === 'string' ? rawCategory.trim() : '';
  const studentName =
    snapshot.studentName ||
    snapshot.student_name ||
    row.student_name ||
    row.studentName ||
    row.student_display_name ||
    row.student_displayName ||
    row.student?.name ||
    'Estudante';

  if (!category) {
    throw new Error(`BOOKING_CATEGORY_MISSING: A categoria do agendamento ${row.id || ''} não pôde ser determinada.`);
  }

  return {
    id: row.id,
    publicReference: row.public_reference || undefined,
    studentId: row.student_id,
    studentName,
    studentAvatarUrl,
    providerId: row.provider_id,
    providerName,
    instructorId: row.instructor_id,
    instructorName,
    vehicleId: row.vehicle_id,
    vehicleName: vehicleName || 'Veículo',
    offeringId: row.offering_id,
    quoteId: row.quote_id || undefined,
    category: category as VehicleCategory,
    status: row.status as Booking['status'],
    scheduledDate: row.scheduled_start_at ? formatDateBR(row.scheduled_start_at) : '',
    startTime: row.scheduled_start_at ? formatTimeBR(row.scheduled_start_at) : '',
    endTime: row.scheduled_end_at ? formatTimeBR(row.scheduled_end_at) : '',
    scheduledStartAt: row.scheduled_start_at,
    scheduledEndAt: row.scheduled_end_at,
    studentCheckedIn: Boolean(row.checkin_student_at),
    instructorCheckedIn: Boolean(row.checkin_instructor_at),
    checkinStudentAt: row.checkin_student_at || undefined,
    checkinInstructorAt: row.checkin_instructor_at || undefined,
    lessonStartedAt: row.lesson_started_at || undefined,
    lessonFinishedAt: row.lesson_finished_at || undefined,
    completedAt: row.completed_at || undefined,
    confirmedAt: row.confirmed_at || undefined,
    updatedAt: row.updated_at || undefined,
    holdExpiresAt: row.hold_expires_at || undefined,
    idempotencyKey: row.idempotency_key || undefined,
    cancelledAt: row.cancelled_at || undefined,
    cancelledBy: row.cancelled_by || undefined,
    cancellationReason: row.cancellation_reason || undefined,
    refundAmountInCents: row.refund_amount_in_cents != null ? Number(row.refund_amount_in_cents) : undefined,
    cancellationData: row.cancellation_data || undefined,
    expiredAt: row.expired_at || undefined,
    priceInCents: row.price_in_cents,
    platformFeeInCents: row.platform_fee_in_cents,
    gatewayFeeInCents: row.gateway_fee_in_cents == null ? undefined : Number(row.gateway_fee_in_cents),
    paymentPublicReference: row.payment_public_reference || undefined,
    paymentStatus: row.payment_status || undefined,
    paymentPaidAt: row.payment_paid_at || undefined,
    providerPayout: row.provider_payout?.id ? {
      id: row.provider_payout.id,
      amountInCents: Number(row.provider_payout.amount_in_cents || 0),
      status: row.provider_payout.status,
      scheduledReleaseAt: row.provider_payout.scheduled_release_at,
      releasedAt: row.provider_payout.released_at || undefined,
      failureReason: row.provider_payout.failure_reason || undefined,
    } : undefined,
    totalInCents: row.total_in_cents,
    snapshot: normalizedSnapshot,
    meetingPoint: meetingPointLabel,
    meetingPointLabel,
    checkinStudentLatitude: row.checkin_student_latitude == null ? undefined : Number(row.checkin_student_latitude),
    checkinStudentLongitude: row.checkin_student_longitude == null ? undefined : Number(row.checkin_student_longitude),
    checkinInstructorLatitude: row.checkin_instructor_latitude == null ? undefined : Number(row.checkin_instructor_latitude),
    checkinInstructorLongitude: row.checkin_instructor_longitude == null ? undefined : Number(row.checkin_instructor_longitude),
    // Prefer the live booking column. Provider booking RPCs may return the
    // persisted lifecycle timestamp only inside snapshot_data, so retain that
    // fallback to keep the action idempotent after a workspace reload.
    providerOnTheWayAt:
      row.provider_on_the_way_at
      || row.providerOnTheWayAt
      || snapshot.provider_on_the_way_at
      || (snapshot as any).providerOnTheWayAt
      || undefined,
    fullMeetingPoint,
    createdAt: row.created_at,
  };
}

export function mapComplianceFromDb(row: any): ComplianceDocument {
  const documentType = row.document_type === 'CNH' ? 'CNH_EAR' : row.document_type;
  const expiresAt = row.expires_at || undefined;
  const termsVersion = row.terms_version
    || (documentType === 'MAZZI_TERMS_ACCEPTANCE' ? row.storage_path?.match(/^acceptance:\/\/mazzi-ethics\/(.+)$/)?.[1] : undefined);
  const normalizedStatus = normalizeComplianceStatus(row.status);
  const isExpired = Boolean(
    expiresAt &&
    new Date(expiresAt).getTime() <= Date.now() &&
    (normalizedStatus === 'APPROVED' || normalizedStatus === 'EXPIRED'),
  );
  return {
    id: row.id,
    providerId: row.provider_id || '',
    userId: row.user_id || undefined,
    membershipId: row.membership_id || undefined,
    scope: row.scope || undefined,
    type: documentType,
    title: documentType === 'MAZZI_TERMS_ACCEPTANCE'
      ? 'Termo de Adesão, Uso e Conduta do Profissional MAZZI'
      : row.document_type === 'CNH' || row.document_type === 'CNH_EAR'
        ? 'Carteira Nacional de Habilitação com EAR'
        : row.document_type,
    status: isExpired ? 'EXPIRED' : normalizedStatus,
    termsVersion,
    documentHash: row.document_hash || undefined,
    acceptedAt: row.accepted_at || row.created_at || undefined,
    fileName: row.storage_path ? row.storage_path.split('/').pop() || 'document.pdf' : 'document.pdf',
    storagePath: row.storage_path || '',
    uploadedAt: row.created_at,
    expiresAt,
    reviewedBy: row.reviewed_by || undefined,
    reviewedAt: row.reviewed_at || undefined,
    rejectionReason: row.rejection_reason || undefined,
  };
}

export interface SchoolMembership {
  id: string;
  userId: string;
  name: string;
  email: string;
  membershipStatus: string;
  isActive: boolean;
  acceptedAt?: string;
}

export interface SchoolInstructorComplianceSummary {
  membershipId: string;
  instructorId?: string;
  instructorName?: string;
  membershipStatus: string;
  globalComplianceValid: boolean;
  membershipComplianceValid: boolean;
  eligible: boolean;
  validUntil?: string;
}

export function mapSchoolMembershipFromDb(row: any): SchoolMembership {
  return {
    id: row.membership_id,
    userId: row.user_id,
    name: row.instructor_name || '',
    email: row.instructor_email || '',
    membershipStatus: row.membership_status,
    isActive: Boolean(row.is_active),
    acceptedAt: row.accepted_at || undefined,
  };
}

export function mapSchoolInstructorComplianceSummaryFromDb(row: any): SchoolInstructorComplianceSummary {
  return {
    membershipId: row.membership_id,
    instructorId: row.instructor_id || undefined,
    instructorName: row.instructor_name || undefined,
    membershipStatus: row.membership_status,
    globalComplianceValid: Boolean(row.global_compliance_valid),
    membershipComplianceValid: Boolean(row.membership_compliance_valid),
    eligible: Boolean(row.overall_eligible),
    validUntil: row.valid_until || undefined,
  };
}

export function mapAuditLogFromDb(row: any): AuditLog {
  return {
    id: row.id,
    actorId: row.actor_id || 'SYSTEM',
    actorName: row.actor_name || (row.actor_id ? 'Usuário' : 'Sistema'),
    actorRole: row.actor_role || 'PLATFORM_ADMIN',
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    previousValue: row.previous_value ? JSON.stringify(row.previous_value) : undefined,
    newValue: row.new_value ? JSON.stringify(row.new_value) : undefined,
    timestamp: row.created_at,
    ipAddress: row.ip_address || '127.0.0.1',
  };
}

export function mapConversationFromDb(row: any): Conversation {
  return {
    id: row.id,
    bookingId: row.booking_id,
    studentId: row.student_id,
    providerId: row.provider_id,
    instructorId: row.instructor_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at || row.created_at,
  };
}

export function mapMessageFromDb(row: any): Message {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    content: row.content,
    isRead: Boolean(row.is_read),
    createdAt: row.created_at,
    readAt: row.read_at || undefined,
  };
}

export function mapReviewFromDb(row: any): Review {
  return {
    id: row.id,
    bookingId: row.booking_id,
    studentId: row.student_id,
    providerId: row.provider_id,
    instructorId: row.instructor_id,
    ratingOverall: Number(row.rating_overall),
    ratingDidactics: row.rating_didactics ?? undefined,
    ratingPunctuality: row.rating_punctuality ?? undefined,
    ratingSafety: row.rating_safety ?? undefined,
    ratingVehicle: row.rating_vehicle ?? undefined,
    ratingCordiality: row.rating_cordiality ?? undefined,
    comment: row.comment || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at || undefined,
  };
}

export function mapNotificationFromDb(row: any): Notification {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    title: repairMojibake(row.title),
    body: repairMojibake(row.body),
    entityType: row.entity_type || undefined,
    entityId: row.entity_id || undefined,
    isRead: Boolean(row.is_read),
    createdAt: row.created_at,
    readAt: row.read_at || undefined,
    appContext: row.app_context || 'PRO',
    navigationAction: row.navigation_action || undefined,
  };
}

async function fetchMyProviderBookings(providerId: string): Promise<Booking[]> {
  const { data, error } = await sp.rpc('get_my_provider_bookings', { p_provider_id: providerId });
  if (error) throw error;
  const rows = Array.isArray(data) ? data : [];
  if (rows.length === 0) return [];

  const bookingIds = rows.map((row: any) => row.id).filter(Boolean);
  const [{ data: names, error: namesError }, { data: categoriesData }] = await Promise.all([
    sp.rpc('get_my_booking_names', { p_booking_ids: bookingIds }),
    sp.rpc('get_my_booking_categories', { p_booking_ids: bookingIds }),
  ]);
  if (namesError) throw namesError;
  const namesByBooking = new Map<string, any>((names || []).map((item: any) => [item.booking_id, item]));
  const categoryByBooking = new Map<string, string>((categoriesData || []).map((item: any) => [item.booking_id, item.category]));

  return rows
    .map((row: any) => mapBookingFromDb({ ...row, ...(namesByBooking.get(row.id) || {}) }, categoryByBooking.get(row.id)))
    .sort((a, b) => new Date(a.scheduledStartAt || 0).getTime() - new Date(b.scheduledStartAt || 0).getTime());
}

function assertTrustedStripeOnboardingUrl(value: unknown): string {
  if (typeof value !== 'string') throw new Error('STRIPE_CONNECT_ONBOARDING_UNAVAILABLE');
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.hostname !== 'connect.stripe.com') {
      throw new Error('STRIPE_CONNECT_ONBOARDING_UNAVAILABLE');
    }
    return url.toString();
  } catch {
    throw new Error('STRIPE_CONNECT_ONBOARDING_UNAVAILABLE');
  }
}

export interface SchoolInvitationContext {
  id: string;
  schoolId: string;
  schoolName: string;
  schoolAvatarUrl?: string;
  status: string;
  expiresAt?: string;
}

// DATABASE SERVICE OPERATIONS
export const dbService = {
  async updateMyProfile(name: string, phone: string, avatarUrl?: string, birthDate?: string): Promise<void> {
    const { error } = await sp.rpc('update_my_profile', {
      p_name: name.trim(),
      p_phone: phone.trim(),
      p_avatar_url: avatarUrl || null,
      p_birth_date: birthDate || null,
    });
    if (error) throw error;
  },
  async getUsers(): Promise<User[]> {
    const { data, error } = await sp
      .from('users')
      .select('id,name,email,phone,role,avatar_url,created_at')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(mapUserFromDb).filter(Boolean) as User[];
  },

  // 1. PROVIDERS
  getMyProviderBookings: fetchMyProviderBookings,

  async getProviderSummary(providerId: string): Promise<Provider | null> {
    const { data, error } = await sp.from('providers').select('*').eq('id', providerId).maybeSingle();
    if (error) throw error;
    return data ? mapProviderFromDb(data) : null;
  },

  async getProviderComplianceDocuments(providerId: string): Promise<ComplianceDocument[]> {
    const { data, error } = await sp.from('compliance_documents').select('*').eq('provider_id', providerId);
    if (error) throw error;
    return (data || []).map(mapComplianceFromDb);
  },

  /**
   * Loads a provider workspace using the current browser session. Every query is
   * scoped by provider_id; RLS remains the authorization authority.
   */
  async getProviderWorkspace(providerId: string): Promise<{
    provider: Provider | null;
    bookings: Booking[];
    complianceDocuments: ComplianceDocument[];
    availabilityRules: any[];
    availabilityExceptions: any[];
  }> {
    const { error: expirationError } = await sp.rpc('refresh_expired_compliance_documents');
    if (expirationError) throw expirationError;
    const [providerResult, documentsResult, rulesResult, exceptionsResult] = await Promise.all([
      sp.from('providers').select('*').eq('id', providerId).maybeSingle(),
      sp.from('compliance_documents').select('*').eq('provider_id', providerId),
      sp.from('availabilities').select('*').eq('provider_id', providerId),
      sp.from('availability_exceptions').select('*').eq('provider_id', providerId),
    ]);

    for (const result of [providerResult, documentsResult, rulesResult, exceptionsResult]) {
      if (result.error) throw result.error;
    }

    const bookings = await fetchMyProviderBookings(providerId);

    return {
      provider: providerResult.data ? mapProviderFromDb(providerResult.data) : null,
      bookings,
      complianceDocuments: (documentsResult.data || []).map(mapComplianceFromDb),
      availabilityRules: rulesResult.data || [],
      availabilityExceptions: exceptionsResult.data || [],
    };
  },

  async getProviderVehicles(providerId: string): Promise<Vehicle[]> {
    const { data, error } = await sp
      .from('vehicles')
      .select('*')
      .eq('provider_id', providerId)
      .is('deleted_at', null);
    if (error) throw error;
    return (data || []).map(mapVehicleFromDb);
  },

  async getProviderOfferings(providerId: string): Promise<ServiceOffering[]> {
    const { data, error } = await sp
      .from('service_offerings')
      .select('*')
      .eq('provider_id', providerId);
    if (error) throw error;
    return (data || [])
      .filter((row: any) => row.source !== 'AULA_AGORA')
      .map(mapOfferingFromDb);
  },

  async saveAvailabilityRule(rule: Omit<any, 'id'> & { id?: string }): Promise<any> {
    const isUuid = (val?: string) => Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val));
    const { data, error } = await sp.rpc('provider_save_availability_rule', {
      p_id: rule.id && isUuid(rule.id) ? rule.id : null,
      p_provider_id: rule.providerId,
      p_instructor_id: rule.instructorId || null,
      p_vehicle_id: rule.vehicleId || null,
      p_day_of_week: rule.dayOfWeekNumber,
      p_start_time: rule.startTime,
      p_end_time: rule.endTime,
      p_timezone: rule.timezone || 'America/Sao_Paulo',
      p_is_active: rule.isActive !== false,
    });
    if (error) throw error;
    return data;
  },

  async deleteAvailabilityRule(id: string): Promise<void> {
    const { error } = await sp.rpc('provider_delete_availability_rule', { p_id: id });
    if (error) throw error;
  },

  async saveAvailabilityException(exception: Omit<any, 'id'> & { id?: string }): Promise<any> {
    const isUuid = (val?: string) => Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val));
    const isNew = !exception.id || !isUuid(exception.id);
    const row = {
      provider_id: exception.providerId,
      instructor_id: exception.instructorId || null,
      vehicle_id: exception.vehicleId || null,
      type: exception.type,
      reason_category: exception.reasonCategory,
      reason: exception.reason,
      start_at: exception.startAt,
      end_at: exception.endAt,
      is_active: exception.isActive !== false,
    };
    const { data, error } = await sp.rpc('provider_save_availability_exception', {
      p_id: isNew ? null : exception.id,
      p_provider_id: row.provider_id,
      p_instructor_id: row.instructor_id,
      p_vehicle_id: row.vehicle_id,
      p_type: row.type,
      p_reason_category: row.reason_category,
      p_reason: row.reason,
      p_start_at: row.start_at,
      p_end_at: row.end_at,
      p_is_active: row.is_active,
    });
    if (error) throw error;
    return Array.isArray(data) ? data[0] : data;
  },

  async deleteAvailabilityException(id: string): Promise<void> {
    const { error } = await sp.rpc('provider_delete_availability_exception', { p_id: id });
    if (error) throw error;
  },

  async getProviders(): Promise<Provider[]> {
    const { data, error } = await sp
      .from('providers')
      .select('*');
    if (error) throw error;
    return (data || []).map(mapProviderFromDb);
  },

  async searchProvidersPublic(params: {
    userLat?: number;
    userLng?: number;
    radiusMeters?: number;
    category?: string | null;
    providerType?: string;
    transmission?: string;
    minRating?: number;
    maxPriceCents?: number;
    limit?: number;
    offset?: number;
  } = {}): Promise<Provider[]> {
    if (
      params.userLat === undefined ||
      params.userLng === undefined ||
      !Number.isFinite(params.userLat) ||
      !Number.isFinite(params.userLng) ||
      params.userLat < -90 ||
      params.userLat > 90 ||
      params.userLng < -180 ||
      params.userLng > 180
    ) {
      return [];
    }

    const {
      userLat,
      userLng,
      radiusMeters = 20000,
      category = null,
      providerType = 'ALL',
      transmission = 'ALL',
      minRating = 0,
      maxPriceCents = undefined,
      limit = 20,
      offset = 0,
    } = params;

    const { data, error } = await sp.rpc('search_providers_public', {
      p_user_lat: userLat,
      p_user_lng: userLng,
      p_radius_meters: radiusMeters,
      p_category: category,
      p_provider_type: providerType,
      p_transmission: transmission,
      p_min_rating: minRating,
      p_max_price_cents: maxPriceCents,
      p_limit: limit,
      p_offset: offset,
    });

    if (error) {
      console.error('Error executing search_providers_public RPC:', error);
      throw error;
    }

    return (data || []).map((row: any) => ({
      id: row.provider_id,
      name: row.display_name,
      type: row.provider_type as any,
      status: row.is_verified ? 'ACTIVE' : 'PENDING',
      ratingAverage: row.rating_average == null ? 0 : Number(row.rating_average),
      ratingCount: row.rating_count == null ? 0 : Number(row.rating_count),
      avatarUrl: row.avatar_url || undefined,
      neighborhood: row.neighborhood || '',
      city: row.city || '',
      publicLatitude: row.public_latitude,
      publicLongitude: row.public_longitude,
      publicMapLocationType: row.public_map_location_type || 'APPROXIMATE',
      categories: [],
      transmissions: [],
      startingPriceInCents: row.starting_price_in_cents == null ? 0 : Number(row.starting_price_in_cents),
    }));
  },

  async searchPublicProviderResults(params: {
    userLat?: number;
    userLng?: number;
    radiusMeters?: number;
    category?: string | null;
    date?: string;
    providerType?: string;
    transmission?: string;
    minRating?: number;
    maxPriceCents?: number;
    limit?: number;
    offset?: number;
  } = {}): Promise<PublicSearchProviderResult[]> {
    if (
      params.userLat === undefined ||
      params.userLng === undefined ||
      !Number.isFinite(params.userLat) ||
      !Number.isFinite(params.userLng) ||
      params.userLat < -90 ||
      params.userLat > 90 ||
      params.userLng < -180 ||
      params.userLng > 180
    ) {
      return [];
    }

    const {
      userLat,
      userLng,
      radiusMeters = 20000,
      category = null,
      date = undefined,
      providerType = 'ALL',
      transmission = 'ALL',
      minRating = 0,
      maxPriceCents = undefined,
      limit = 20,
      offset = 0,
    } = params;
    const { data, error } = await sp.rpc('search_providers_public', {
      p_user_lat: userLat,
      p_user_lng: userLng,
      p_radius_meters: radiusMeters,
      p_category: category,
      p_date: date ?? null,
      p_provider_type: providerType,
      p_transmission: transmission,
      p_min_rating: minRating,
      p_max_price_cents: maxPriceCents,
      p_limit: limit,
      p_offset: offset,
    });
    if (error) throw error;

    return (data || []).map((row: any) => {
      const offerings = Array.isArray(row.public_offerings) ? row.public_offerings : [];
      const publicLatitude = row.public_latitude == null ? undefined : Number(row.public_latitude);
      const publicLongitude = row.public_longitude == null ? undefined : Number(row.public_longitude);
      return {
        providerId: row.provider_id,
        displayName: row.display_name,
        providerType: row.provider_type,
        avatarUrl: row.avatar_url || undefined,
        verificationBadge: row.is_verified ? 'Verificado pela plataforma' : 'Em verificação',
        isVerified: Boolean(row.is_verified),
        ratingAverage: row.rating_average == null ? 0 : Number(row.rating_average),
        ratingCount: row.rating_count == null ? 0 : Number(row.rating_count),
        ratingSource: row.rating_source === 'REAL' ? 'REAL' : 'DEMO',
        approximateDistanceKm: Number(row.rounded_distance_meters || 0) / 1000,
        roundedDistanceMeters: Number(row.rounded_distance_meters || 0),
        formattedDistance: row.distance_display || '',
        neighborhood: row.neighborhood || '',
        city: row.city || '',
        categories: Array.isArray(row.categories) ? row.categories : [],
        transmissions: Array.isArray(row.transmissions) ? row.transmissions : [],
        startingPriceInCents: Number(row.starting_price_in_cents || 0),
        normalizedPricePerFiftyMinInCents: Number(row.normalized_price_cents || row.starting_price_in_cents || 0),
        publicOfferings: offerings,
        availableSlotCount: 0,
        publicMapLocation: {
          latitude: publicLatitude,
          longitude: publicLongitude,
          type: row.public_map_location_type || 'UNAVAILABLE',
          label: [row.neighborhood, row.city].filter(Boolean).join(', '),
        },
        rankingScore: 0,
      };
    });
  },

  async getProviderBookingContextPublic(providerId: string): Promise<any[]> {
    const { data, error } = await sp.rpc('get_provider_booking_context_public', {
      p_provider_id: providerId,
    });
    if (error) {
      console.error('Error executing get_provider_booking_context_public RPC:', error);
      throw error;
    }
    const contexts = data || [];
    // Public booking context in MVP is restricted exclusively to Category B (no fallback)
    const catBContexts = contexts.filter((c: any) => c.category === 'B');
    return catBContexts;
  },

  async getProviderAvailabilities(providerId: string, instructorId?: string, vehicleId?: string): Promise<any[]> {
    let query = sp
      .from('availabilities')
      .select(`
        id,
        provider_id,
        instructor_id,
        vehicle_id,
        day_of_week,
        start_time,
        end_time,
        is_active
      `)
      .eq('provider_id', providerId)
      .eq('is_active', true);

    if (instructorId) {
      query = query.eq('instructor_id', instructorId);
    }
    if (vehicleId) {
      query = query.eq('vehicle_id', vehicleId);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching provider availabilities:', error);
      throw error;
    }
    return (data || []).map((row: any) => ({
      id: row.id,
      providerId: row.provider_id,
      instructorId: row.instructor_id,
      vehicleId: row.vehicle_id,
      dayOfWeek: row.day_of_week,
      startTime: row.start_time,
      endTime: row.end_time,
      isActive: row.is_active,
    }));
  },

  async updateProviderStatus(id: string, status: string, notes?: string): Promise<void> {
    const { error } = await sp
      .from('providers')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },

  // 2. VEHICLES
  async getVehicles(): Promise<Vehicle[]> {
    const { data, error } = await sp.rpc('get_public_vehicle_catalog');
    if (error) throw error;
    return (data || []).map(mapVehicleFromDb);
  },

  async deactivateAvailabilityException(id: string): Promise<void> {
    const { error } = await sp.rpc('provider_set_availability_exception_active', { p_id: id, p_is_active: false });
    if (error) throw error;
  },

  async activateAvailabilityException(id: string): Promise<void> {
    const { error } = await sp.rpc('provider_set_availability_exception_active', { p_id: id, p_is_active: true });
    if (error) throw error;
  },

  async reviewVehicle(vehicleId: string, status: 'ACTIVE' | 'INACTIVE' | 'BLOCKED', reason?: string): Promise<Vehicle> {
    const { data, error } = await sp.rpc('review_vehicle', {
      p_vehicle_id: vehicleId,
      p_status: status,
      p_reason: reason || null,
    });
    if (error) throw error;
    return mapVehicleFromDb(data);
  },

  async deactivateVehicle(vehicleId: string): Promise<Vehicle> {
    const { data, error } = await sp.rpc('provider_deactivate_vehicle', {
      p_vehicle_id: vehicleId,
    });
    if (error) throw error;
    return mapVehicleFromDb(data);
  },

  async activateVehicle(vehicleId: string): Promise<Vehicle> {
    const { data, error } = await sp.rpc('provider_activate_vehicle', {
      p_vehicle_id: vehicleId,
    });
    if (error) throw error;
    return mapVehicleFromDb(data);
  },

  async saveVehicle(vehicle: Partial<Vehicle>): Promise<Vehicle> {
    const isNew = !vehicle.id || !isUuid(vehicle.id);
    const { data, error } = await sp.rpc('provider_save_vehicle', {
      p_vehicle_id: isNew ? null : vehicle.id,
      p_provider_id: vehicle.providerId || null,
      p_brand: vehicle.brand || null,
      p_model: vehicle.model || null,
      p_year: vehicle.year || null,
      p_license_plate: vehicle.licensePlate || null,
      p_renavam: (vehicle as any).renavam || null,
      p_category: vehicle.category || null,
      p_vehicle_type: vehicle.vehicleType || null,
      p_transmission: vehicle.transmission || null,
      p_has_dual_pedal: (vehicle as any).hasDualPedal ?? null,
      p_has_dashcam: (vehicle as any).hasDashcam ?? null,
      p_color: vehicle.color || null,
      p_photos: vehicle.photos || null,
    });
    if (error) throw error;
    return mapVehicleFromDb(data);
  },

  // 3. OFFERINGS
  async getOfferings(): Promise<ServiceOffering[]> {
    const { data, error } = await sp
      .from('service_offerings')
      .select('*');
    if (error) throw error;
    return (data || []).map(mapOfferingFromDb);
  },

  async saveOffering(offering: Partial<ServiceOffering>): Promise<ServiceOffering> {
    if (offering.durationMinutes !== undefined && offering.durationMinutes !== MVP_LESSON_DURATION_MINUTES) {
      throw new Error('No MVP, a duração da aula deve ser de 50 minutos.');
    }
    const activeState = (offering as any).status === 'ACTIVE' || Boolean((offering as any).isActive);
    const { data, error } = await sp.rpc('provider_save_service_offering', {
      p_offering_id: offering.id && isUuid(offering.id) ? offering.id : null,
      p_provider_id: offering.providerId || null,
      p_instructor_id: (offering as any).instructorId || null,
      p_vehicle_id: offering.vehicleId || null,
      p_category: offering.category || null,
      p_transmission: (offering as any).transmission || null,
      p_duration_minutes: offering.durationMinutes || MVP_LESSON_DURATION_MINUTES,
      p_price_in_cents: offering.priceInCents || null,
      p_active: activeState,
    });
    if (error) throw error;
    return mapOfferingFromDb(data);
  },

  async replaceActiveOffering(offeringId: string): Promise<ServiceOffering> {
    const { data, error } = await sp.rpc('provider_replace_active_service_offering', {
      p_offering_id: offeringId,
    });
    if (error) throw error;
    return mapOfferingFromDb(data);
  },

  async updateProviderProfile(
    providerId: string,
    profileData: {
      name?: string;
      legalName?: string;
      publicContact?: string;
      commercialEmail?: string;
      neighborhood?: string;
      city?: string;
      state?: string;
      serviceRadiusKm?: number;
      bio?: string;
      address?: Record<string, unknown> | null;
      latitude?: number | null;
      longitude?: number | null;
      postalCode?: string;
    }
  ): Promise<void> {
    const rpcPayload: Record<string, unknown> = {
      p_provider_id: providerId,
      p_name: profileData.name !== undefined ? profileData.name.trim() : null,
      p_legal_name: profileData.legalName !== undefined ? profileData.legalName.trim() : null,
      // The RPC stores the public contact as digits only. Keep this boundary
      // defensive because callers may still hold the presentation mask.
      p_public_contact: profileData.publicContact !== undefined ? normalizePhone(profileData.publicContact) : null,
      p_commercial_email: profileData.commercialEmail !== undefined ? profileData.commercialEmail.trim() : null,
      p_neighborhood: profileData.neighborhood !== undefined ? profileData.neighborhood.trim() : null,
      p_city: profileData.city !== undefined ? profileData.city.trim() : null,
      p_state: profileData.state !== undefined ? profileData.state.toUpperCase().trim() : null,
      p_service_radius_km: profileData.serviceRadiusKm !== undefined ? profileData.serviceRadiusKm : null,
      p_bio: profileData.bio !== undefined ? profileData.bio.trim() : null,
    };
    if (profileData.address !== undefined) rpcPayload.p_address = profileData.address;
    if (profileData.latitude !== undefined) rpcPayload.p_latitude = profileData.latitude;
    if (profileData.longitude !== undefined) rpcPayload.p_longitude = profileData.longitude;
    if (profileData.postalCode !== undefined) rpcPayload.p_postal_code = profileData.postalCode.trim();
    const { error: rpcError } = await sp.rpc('update_provider_profile', rpcPayload);

    if (rpcError) {
      if (rpcError.code === 'PGRST202' || rpcError.code === '42883' || rpcError.message?.includes('function public.update_provider_profile') || rpcError.message?.includes('Could not find')) {
        throw new Error('Atualização do perfil profissional ainda não está disponível neste ambiente (migração pendente).');
      }
      throw rpcError;
    }
  },

  async saveQuote(quote: Partial<Quote>): Promise<Quote> {
    const isUuid = (val: any) => typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

    if (!isUuid(quote.studentId)) {
      throw new Error('REAL_DATABASE_ENTITY_ID_INVALID: student_id');
    }
    if (!isUuid(quote.providerId)) {
      throw new Error('REAL_DATABASE_ENTITY_ID_INVALID: provider_id');
    }
    if (!isUuid(quote.instructorId)) {
      throw new Error('REAL_DATABASE_ENTITY_ID_INVALID: instructor_id');
    }
    if (!isUuid(quote.vehicleId)) {
      throw new Error('REAL_DATABASE_ENTITY_ID_INVALID: vehicle_id');
    }
    if (!isUuid(quote.offeringId)) {
      throw new Error('REAL_DATABASE_ENTITY_ID_INVALID: offering_id');
    }

    const dbRow = {
      student_id: quote.studentId,
      provider_id: quote.providerId,
      instructor_id: quote.instructorId,
      vehicle_id: quote.vehicleId,
      offering_id: quote.offeringId,
      scheduled_start_at: quote.scheduledStartAt,
      scheduled_end_at: quote.scheduledEndAt,
      price_in_cents: quote.priceInCents,
      platform_fee_in_cents: quote.platformFeeInCents,
      total_in_cents: quote.totalInCents,
      expires_at: quote.expiresAt,
      status: quote.status || 'ACTIVE',
      idempotency_key: quote.idempotencyKey || `idem_quote_${crypto.randomUUID()}`,
    };

    const { data, error } = await sp
      .from('quotes')
      .insert(dbRow)
      .select()
      .single();

    if (error) {
      console.error('Error inserting quote to Supabase:', error);
      throw error;
    }

    return {
      ...quote,
      id: data.id,
      status: data.status,
      createdAt: data.created_at,
      expiresAt: data.expires_at,
      consumedAt: data.consumed_at || undefined,
      idempotencyKey: data.idempotency_key || undefined,
    } as Quote;
  },

  async createQuoteFromOffering(offeringId: string, scheduledStartAt: string, idempotencyKey: string): Promise<any> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(offeringId);
    if (!isUuid) {
      throw new Error('QUOTE_CREATE_FAILED: Invalid offering UUID');
    }

    const { data, error } = await sp.rpc('create_quote_from_offering', {
      p_offering_id: offeringId,
      p_scheduled_start_at: scheduledStartAt,
      p_idempotency_key: idempotencyKey,
    });

    if (error) {
      console.error('QUOTE_CREATE_FAILED:', error);
      throw error;
    }

    return data;
  },

  // 4. BOOKINGS & TRANSACTIONS
  async getBookings(): Promise<Booking[]> {
    const { data, error } = await sp
      .from('bookings')
      .select('*');
    if (error) throw error;
    const rows = data || [];
    if (rows.length === 0) return [];
    const { data: names, error: namesError } = await sp.rpc('get_my_booking_names', {
      p_booking_ids: rows.map((row: any) => row.id),
    });
    if (namesError) throw namesError;
    const namesByBooking = new Map<string, any>((names || []).map((item: any) => [item.booking_id, item]));
    let avatarsByBooking = new Map<string, any>();
    try {
      const { data: avatars, error: avatarsError } = await sp.rpc('get_my_booking_avatars', {
        p_booking_ids: rows.map((row: any) => row.id),
      });
      if (avatarsError) throw avatarsError;
      avatarsByBooking = new Map<string, any>((avatars || []).map((item: any) => [item.booking_id, item]));
    } catch (avatarError) {
      // Avatar hydration is supplementary. A stale PostgREST schema cache or a
      // temporary network error must never hide the student's bookings.
      console.warn('Could not hydrate booking avatars:', avatarError);
    }

    const bookingIds = rows.map((row: any) => row.id).filter(Boolean);
    let bookingCategoryMap = new Map<string, string>();
    if (bookingIds.length > 0) {
      const { data: categoriesData } = await sp.rpc('get_my_booking_categories', {
        p_booking_ids: bookingIds,
      });
      if (categoriesData) {
        bookingCategoryMap = new Map((categoriesData || []).map((c: any) => [c.booking_id, c.category]));
      }
    }

    return rows
      .map((row: any) => mapBookingFromDb(
        { ...row, ...(namesByBooking.get(row.id) || {}), ...(avatarsByBooking.get(row.id) || {}) },
        bookingCategoryMap.get(row.id)
      ))
      .sort((a: Booking, b: Booking) => {
        const aTime = new Date(a.scheduledStartAt || 0).getTime();
        const bTime = new Date(b.scheduledStartAt || 0).getTime();
        return aTime - bTime;
      });
  },

  async getMyUnifiedInstructorBookings(): Promise<Booking[]> {
    const { data, error } = await sp.rpc('get_my_unified_instructor_bookings');
    if (error) throw error;
    const rows = data || [];
    if (rows.length === 0) return [];

    const bookingIds = rows.map((row: any) => row.id).filter(Boolean);
    let studentAvatarByBooking = new Map<string, any>();
    if (bookingIds.length > 0) {
      try {
        const { data: avatars, error: avatarsError } = await sp.rpc('get_my_instructor_booking_avatars', {
          p_booking_ids: bookingIds,
        });
        // The RPC is introduced by a migration and may be absent while the
        // local frontend is pointed at an older DEV schema. Keep the booking
        // list usable until that migration is applied; other errors remain
        // observable for diagnosis.
        if (avatarsError && avatarsError.code !== 'PGRST202') throw avatarsError;
        if (!avatarsError) {
          studentAvatarByBooking = new Map<string, any>((avatars || []).map((item: any) => [item.booking_id, item]));
        }
      } catch (avatarError) {
        // Avatar hydration is supplementary and must not block the calendar.
        if ((avatarError as { code?: string } | null)?.code !== 'PGRST202') {
          console.warn('Could not hydrate student booking avatars:', avatarError);
        }
      }
    }
    let bookingCategoryMap = new Map<string, string>();
    if (bookingIds.length > 0) {
      const { data: categoriesData } = await sp.rpc('get_my_booking_categories', {
        p_booking_ids: bookingIds,
      });
      if (categoriesData) {
        bookingCategoryMap = new Map((categoriesData || []).map((c: any) => [c.booking_id, c.category]));
      }
    }

    return rows
      .map((row: any) => mapBookingFromDb({ ...row, ...(studentAvatarByBooking.get(row.id) || {}) }, bookingCategoryMap.get(row.id)))
      .sort((a: Booking, b: Booking) => {
        const aTime = new Date(a.scheduledStartAt || 0).getTime();
        const bTime = new Date(b.scheduledStartAt || 0).getTime();
        return aTime - bTime;
      });
  },

  async getMyInstructorGlobalBlocks(): Promise<any[]> {
    const { data, error } = await sp.rpc('get_my_instructor_global_blocks');
    if (error) throw error;
    return data || [];
  },

  async saveInstructorGlobalBlock(
    startAt: string,
    endAt: string,
    reason?: string,
    blockId?: string
  ): Promise<any> {
    const { data, error } = await sp.rpc('save_instructor_global_block', {
      p_start_at: startAt,
      p_end_at: endAt,
      p_reason: reason || null,
      p_block_id: blockId || null,
    });
    if (error) throw error;
    return data;
  },

  async deleteInstructorGlobalBlock(blockId: string): Promise<any> {
    const { data, error } = await sp.rpc('delete_instructor_global_block', {
      p_block_id: blockId,
    });
    if (error) throw error;
    return data;
  },

  async createBookingHold(quoteId: string, studentId: string): Promise<any> {
    // Validate UUID format defensively before calling PostgreSQL
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(quoteId);
    if (!isUuid) {
      throw new Error('REAL_DATABASE_QUOTE_ID_INVALID');
    }

    const { data, error } = await sp.rpc('create_booking_hold', {
      p_quote_id: quoteId,
      p_student_id: studentId,
      p_idempotency_key: `hold_${crypto.randomUUID()}`,
    });
    if (error) throw error;
    return data;
  },

  async createBookingPayment(bookingId: string, method: string, idempotencyKey: string, gatewayProvider = 'fake_payment_gateway'): Promise<any> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(bookingId);
    if (!isUuid) {
      throw new Error('PAYMENT_CREATE_FAILED: Invalid booking UUID');
    }

    const { data, error } = await sp.rpc('create_booking_payment', {
      p_booking_id: bookingId,
      p_method: method,
      p_idempotency_key: idempotencyKey,
      p_gateway_provider: gatewayProvider,
    });
    if (error) {
      console.error('PAYMENT_CREATE_FAILED:', error);
      throw error;
    }
    if (data && data.success === false && data.error === 'BOOKING_HOLD_EXPIRED') {
      throw new Error('BOOKING_HOLD_EXPIRED');
    }
    return data;
  },

  async confirmBookingPayment(paymentId: string, externalPaymentId: string, paidAt?: string): Promise<any> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(paymentId);
    if (!isUuid) {
      throw new Error('PAYMENT_CONFIRM_FAILED: Invalid payment UUID');
    }

    const { data, error } = await sp.rpc('confirm_booking_payment', {
      p_payment_id: paymentId,
      p_external_payment_id: externalPaymentId,
      p_paid_at: paidAt || new Date().toISOString()
    });
    if (error) {
      console.error('PAYMENT_CONFIRM_FAILED:', error);
      throw error;
    }
    return data;
  },

  async markBookingPaymentFailed(paymentId: string, reason?: string): Promise<any> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(paymentId);
    if (!isUuid) throw new Error('MARK_FAILED_INVALID_PAYMENT_UUID');
    const { data, error } = await sp.rpc('mark_booking_payment_failed', {
      p_payment_id: paymentId,
      p_reason: reason || 'SIMULATED_DECLINED'
    });
    if (error) throw error;
    return data;
  },

  async createStripePaymentIntent(paymentId: string, method: 'PIX' | 'CREDIT_CARD', payerEmail?: string): Promise<any> {
    if (!isUuid(paymentId)) throw new Error('STRIPE_PAYMENT_INVALID_UUID');
    const { data, error } = await sp.functions.invoke('create-stripe-payment-intent', {
      body: { paymentId, method, payerEmail: payerEmail?.trim() || undefined },
    });
    if (error) {
      let gatewayData: Record<string, unknown> = {};
      const response = (error as any)?.context;
      if (response && typeof response.clone === 'function') {
        const parsed = await response.clone().json().catch(() => ({}));
        gatewayData = parsed && typeof parsed === 'object' ? parsed : {};
      }
      const paymentError = new Error(
        (gatewayData.message as string | undefined) || error.message || 'STRIPE_PAYMENT_INTENT_FAILED',
      ) as Error & Record<string, unknown>;
      Object.assign(paymentError, gatewayData, { cause: error });
      throw paymentError;
    }
    if (!data?.clientSecret || !data?.paymentIntentId) {
      throw new Error('STRIPE_PAYMENT_INTENT_INCOMPLETE');
    }
    return data;
  },

  async createStripeCheckoutSession(
    paymentId: string,
    method: 'PIX' | 'CREDIT_CARD',
    payerEmail?: string,
    returnOrigin?: string,
  ): Promise<{ checkoutSessionId: string; checkoutUrl: string; status: string; amountInCents: number }> {
    if (!isUuid(paymentId)) throw new Error('STRIPE_PAYMENT_INVALID_UUID');
    const { data, error } = await sp.functions.invoke('create-stripe-checkout-session', {
      body: {
        paymentId,
        method,
        payerEmail: payerEmail?.trim() || undefined,
        returnOrigin: returnOrigin?.trim() || undefined,
      },
    });
    if (error) {
      let gatewayData: Record<string, unknown> = {};
      const response = (error as any)?.context;
      if (response && typeof response.clone === 'function') {
        const parsed = await response.clone().json().catch(() => ({}));
        gatewayData = parsed && typeof parsed === 'object' ? parsed : {};
      }
      const checkoutError = new Error(
        (gatewayData.message as string | undefined) || error.message || 'STRIPE_CHECKOUT_SESSION_FAILED',
      ) as Error & Record<string, unknown>;
      Object.assign(checkoutError, gatewayData, { cause: error });
      throw checkoutError;
    }
    if (!data?.checkoutUrl || !data?.checkoutSessionId) {
      throw new Error('STRIPE_CHECKOUT_SESSION_INCOMPLETE');
    }
    return data;
  },

  async processStripeRefund(bookingId: string, reason?: string, amountInCents?: number, disputeId?: string): Promise<any> {
    if (!isUuid(bookingId)) throw new Error('REFUND_INVALID_BOOKING_UUID');
    const { data, error } = await sp.functions.invoke('process-stripe-refund', {
      body: { bookingId, reason: reason || 'ADMIN_STRIPE_REFUND', amountInCents, disputeId },
    });
    if (error) throw error;
    return data;
  },

  async getMyPaymentStatus(paymentId: string): Promise<any> {
    const { data, error } = await sp.rpc('get_my_payment_status', { p_payment_id: paymentId });
    if (error) throw error;
    return data;
  },
  async getMyBookingIdByPaymentReference(publicReference: string): Promise<string | null> {
    const { data, error } = await sp
      .from('payments')
      .select('booking_id')
      .eq('public_reference', publicReference)
      .maybeSingle();
    if (error) throw error;
    return data?.booking_id || null;
  },
  async verifyStripeCheckoutSession(paymentId: string, sessionId: string): Promise<any> {
    const { data, error } = await sp.functions.invoke('verify-stripe-checkout-session', {
      body: { paymentId, sessionId },
    });
    if (error) throw error;
    return data;
  },

  async getMyPixDestination(): Promise<PixDestination | null> {
    const { data, error } = await sp.rpc('get_my_pix_destination');
    if (error) throw error;
    if (!data || !data.id) return null;
    return {
      id: data.id,
      providerId: data.provider_id,
      keyType: data.key_type,
      pixKey: data.pix_key,
      pixKeyMasked: data.pix_key_masked,
      holderName: data.holder_name,
      holderDocument: data.holder_document || undefined,
      isActive: data.is_active !== false,
      updatedAt: data.updated_at,
    };
  },

  async saveMyPixDestination(input: Pick<PixDestination, 'keyType' | 'pixKey' | 'holderName' | 'holderDocument'>): Promise<PixDestination> {
    const { data, error } = await sp.rpc('save_my_pix_destination', {
      p_key_type: input.keyType,
      p_pix_key: input.pixKey,
      p_holder_name: input.holderName,
      p_holder_document: input.holderDocument || null,
    });
    if (error) throw error;
    return {
      providerId: data.provider_id,
      keyType: data.key_type,
      pixKey: data.pix_key,
      pixKeyMasked: data.pix_key_masked,
      holderName: data.holder_name,
      holderDocument: data.holder_document || undefined,
      isActive: true,
    };
  },

  async getMyProviderPaymentAccount(): Promise<ProviderPaymentAccount | null> {
    const { data, error } = await sp.rpc('get_my_provider_payment_account');
    if (error) throw error;
    if (!data || !data.id) return null;
    return mapProviderPaymentAccount(data);
  },

  async getMyUsTestProviderPaymentAccount(): Promise<ProviderPaymentAccount | null> {
    const { data, error } = await sp.rpc('get_my_us_test_provider_payment_account');
    if (error) throw error;
    if (!data || !data.id) return null;
    return mapProviderPaymentAccount(data, 'STRIPE_US_TEST');
  },

  async openProviderPayoutOnboarding(): Promise<{ account: ProviderPaymentAccount; onboardingUrl: string }> {
    const { data, error } = await sp.functions.invoke('create-stripe-connect-account', { body: { native_app: isNativeApp() } });
    if (error) throw error;
    if (!data?.account?.id || !data?.onboarding_url) throw new Error('STRIPE_CONNECT_ONBOARDING_UNAVAILABLE');
    const onboardingUrl = assertTrustedStripeOnboardingUrl(data.onboarding_url);
    return {
      account: mapProviderPaymentAccount({ ...data.account, onboarding_url: onboardingUrl }),
      onboardingUrl,
    };
  },

  async syncMyStripePaymentAccount(): Promise<ProviderPaymentAccount | null> {
    const { data, error } = await sp.functions.invoke('create-stripe-connect-account', { body: { open_onboarding: false } });
    if (error) throw error;
    if (!data?.account?.id) return null;
    return mapProviderPaymentAccount(data.account);
  },

  async updateBookingStatus(id: string, status: string, extra: Record<string, any> = {}): Promise<void> {
    const { data, error } = await sp
      .from('bookings')
      .update({ status, ...extra, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('id')
      .maybeSingle();
    if (error) {
      throw error;
    }
    if (!data) {
      throw new Error('BOOKING_STATUS_UPDATE_BLOCKED_OR_NOT_FOUND');
    }
  },

  async createBookingHoldAtMeetingPoint(quoteId: string, studentId: string, meetingPoint: { type: 'STUDENT_ADDRESS' | 'PROVIDER_ADDRESS'; address?: string; latitude?: number; longitude?: number }): Promise<any> {
    const { data, error } = await sp.rpc('create_booking_hold_at_meeting_point', {
      p_quote_id: quoteId,
      p_student_id: studentId,
      p_idempotency_key: `hold_${crypto.randomUUID()}`,
      p_meeting_point: meetingPoint,
    });
    if (error) throw error;
    return data;
  },

  // 5. SPRINT 13 — BOOKING CHAT, REVIEWS & IN-APP NOTIFICATIONS
  async getConversationForBooking(bookingId: string): Promise<Conversation> {
    const { data, error } = await sp.rpc('get_or_create_conversation_for_booking', {
      p_booking_id: bookingId,
    });
    if (error) throw error;
    return mapConversationFromDb(data);
  },

  async getMessagesForConversation(conversationId: string): Promise<Message[]> {
    const { data, error } = await sp
      .from('messages')
      .select('id,conversation_id,sender_id,content,is_read,read_at,created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data || []).map(mapMessageFromDb);
  },

  async sendMessage(conversationId: string, body: string): Promise<Message> {
    const { data, error } = await sp.rpc('send_message', {
      p_conversation_id: conversationId,
      p_body: body,
    });
    if (error) throw error;
    return mapMessageFromDb(data);
  },

  async createReviewForBooking(bookingId: string, rating: number, comment?: string): Promise<Review> {
    const { data, error } = await sp.rpc('create_review_for_booking', {
      p_booking_id: bookingId,
      p_rating: rating,
      p_comment: comment || null,
    });
    if (error) throw error;
    return mapReviewFromDb(data);
  },

  async getReviewedBookingIds(bookingIds: string[]): Promise<Set<string>> {
    if (!bookingIds || bookingIds.length === 0) return new Set<string>();
    const { data, error } = await sp
      .from('reviews')
      .select('booking_id')
      .in('booking_id', bookingIds);
    if (error) {
      console.warn('Error batch fetching reviewed booking IDs:', error);
      throw error;
    }
    const set = new Set<string>();
    (data || []).forEach((row: any) => {
      if (row.booking_id) set.add(row.booking_id);
    });
    return set;
  },

  async getProviderReviews(providerId: string): Promise<Review[]> {
    const { data, error } = await sp
      .from('reviews')
      .select('*')
      .eq('provider_id', providerId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(mapReviewFromDb);
  },

  async getReviewForBooking(bookingId: string): Promise<Review | null> {
    const { data, error } = await sp
      .from('reviews')
      .select('*')
      .eq('booking_id', bookingId)
      .maybeSingle();
    if (error) throw error;
    return data ? mapReviewFromDb(data) : null;
  },

  async getMyNotifications(appContext: NonNullable<Notification['appContext']>): Promise<Notification[]> {
    const { data, error } = await sp
      .from('notifications')
      .select('*')
      .eq('app_context', appContext)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    return (data || []).map(mapNotificationFromDb);
  },

  async getMyNotificationPreferences(): Promise<Partial<Record<NotificationType, boolean>>> {
    const { data, error } = await sp.rpc('get_my_notification_preferences');
    if (error) throw error;
    return (data || []).reduce((preferences: Partial<Record<NotificationType, boolean>>, row: any) => {
      preferences[row.notification_type as NotificationType] = row.enabled === true;
      return preferences;
    }, {});
  },

  async setMyNotificationPreference(type: NotificationType, enabled: boolean): Promise<boolean> {
    const { data, error } = await sp.rpc('set_my_notification_preference', {
      p_notification_type: type,
      p_enabled: enabled,
    });
    if (error) throw error;
    return data === true;
  },

  async reviewProvider(providerId: string, status: ProviderStatus, reason?: string): Promise<Provider> {
    const { data, error } = await sp.rpc('admin_review_provider', {
      p_provider_id: providerId,
      p_status: status,
      p_reason: reason || null,
    });
    if (error) throw error;
    return mapProviderFromDb(data);
  },

  async updateUserRole(userId: string, role: UserRole): Promise<User> {
    const { data, error } = await sp.rpc('admin_update_user_role', {
      p_user_id: userId,
      p_role: role,
    });
    if (error) throw error;
    return mapUserFromDb(data);
  },

  async adminRefundMockBooking(bookingId: string, reason?: string): Promise<any> {
    const { data, error } = await sp.rpc('admin_refund_mock_booking', {
      p_booking_id: bookingId,
      p_reason: reason || 'ADMIN_MOCK_REFUND',
    });
    if (error) throw error;
    return data;
  },

  async createInstructorEmergencyBlock(startAt: string, endAt: string, reason?: string): Promise<any> {
    const { data, error } = await sp.rpc('create_instructor_emergency_block_if_free', {
      p_start_at: startAt,
      p_end_at: endAt,
      p_reason: reason || null,
    });
    if (error) throw error;
    return data;
  },

  async getMyUnreadNotificationCount(appContext: NonNullable<Notification['appContext']>): Promise<number> {
    const { count, error } = await sp
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('app_context', appContext)
      .eq('is_read', false);
    if (error) throw error;
    return count || 0;
  },

  async markNotificationAsRead(notificationId: string): Promise<void> {
    const { error } = await sp
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', notificationId);
    if (error) throw error;
  },
  async registerMyPushDevice(params: { provider: 'WEB_PUSH' | 'FCM'; appContext: NonNullable<Notification['appContext']>; deviceFingerprint: string; endpoint: string; publicKey?: string; authKey?: string }): Promise<string> {
    const { data, error } = await sp.rpc('register_my_push_device', {
      p_provider: params.provider,
      p_app_context: params.appContext,
      p_device_fingerprint: params.deviceFingerprint,
      p_endpoint: params.endpoint,
      p_public_key: params.publicKey || null,
      p_auth_key: params.authKey || null,
    });
    if (error) throw error;
    return String(data);
  },
  async disableMyPushDevice(deviceId: string): Promise<void> {
    const { error } = await sp.rpc('disable_my_push_device', { p_device_id: deviceId });
    if (error) throw error;
  },
  async disableMyPushDevicesForContext(appContext: NonNullable<Notification['appContext']>): Promise<void> {
    const { error } = await sp.rpc('disable_my_push_devices_for_context', { p_app_context: appContext });
    if (error) throw error;
  },
  async getMyProviderPayoutDetail(payoutId: string): Promise<ProviderPayoutDetail> {
    const { data, error } = await sp.rpc('get_my_provider_payout_detail', { p_payout_id: payoutId });
    if (error || !data) throw error || new Error('PAYOUT_UNAVAILABLE');
    return mapProviderPayoutDetail(data);
  },
  async getMyProviderPayoutDetailByReference(publicReference: string): Promise<ProviderPayoutDetail> {
    const { data, error } = await sp.rpc('get_my_provider_payout_detail_by_reference', {
      p_public_reference: publicReference,
    });
    if (error || !data) throw error || new Error('PAYOUT_UNAVAILABLE');
    return mapProviderPayoutDetail(data);
  },
  async updateMyStudentAddress(address: StudentSavedAddress): Promise<void> {
    const { error } = await sp.rpc('update_my_student_address', { p_address: address });
    if (error) throw error;
  },

  async getAdminBookings(): Promise<Booking[]> {
    const { data, error } = await sp.from('bookings').select('*');
    if (error) throw error;
    const rows = data || [];
    if (rows.length === 0) return [];
    const bookingIds = rows.map((row: any) => row.id).filter(Boolean);
    const [{ data: names, error: namesError }, { data: categoriesData }, { data: paymentRows, error: paymentsError }] = await Promise.all([
      sp.rpc('get_admin_booking_names', { p_booking_ids: bookingIds }),
      sp.rpc('get_my_booking_categories', { p_booking_ids: bookingIds }),
      sp.from('payments').select('booking_id, status, public_reference, gateway_fee_in_cents, paid_at, created_at').in('booking_id', bookingIds),
    ]);
    if (namesError) throw namesError;
    if (paymentsError) throw paymentsError;
    const namesByBooking = new Map<string, any>((names || []).map((item: any) => [item.booking_id, item]));
    const categoriesByBooking = new Map<string, string>((categoriesData || []).map((item: any) => [item.booking_id, item.category]));
    const paymentsByBooking = new Map<string, { fee?: number; status?: MazziPaymentStatus; publicReference?: string; paidAt?: string; timestamp: number }>();
    for (const payment of paymentRows || []) {
      const timestamp = new Date(payment.paid_at || payment.created_at || 0).getTime();
      const current = paymentsByBooking.get(payment.booking_id);
      if (current === undefined || timestamp >= current.timestamp) {
        paymentsByBooking.set(payment.booking_id, {
          fee: payment.gateway_fee_in_cents == null ? undefined : Number(payment.gateway_fee_in_cents),
          status: payment.status || undefined,
          publicReference: payment.public_reference || undefined,
          paidAt: payment.paid_at || undefined,
          timestamp,
        });
      }
    }
    return rows
      .map((row: any) => mapBookingFromDb({
        ...row,
        ...(namesByBooking.get(row.id) || {}),
        payment_status: paymentsByBooking.get(row.id)?.status,
        payment_public_reference: paymentsByBooking.get(row.id)?.publicReference,
        payment_paid_at: paymentsByBooking.get(row.id)?.paidAt,
        gateway_fee_in_cents: paymentsByBooking.get(row.id)?.fee,
      }, categoriesByBooking.get(row.id)))
      .sort((a: Booking, b: Booking) => new Date(a.scheduledStartAt || 0).getTime() - new Date(b.scheduledStartAt || 0).getTime());
  },

  async getAdminPayouts(): Promise<Payout[]> {
    const { data, error } = await sp.rpc('get_admin_payouts');
    if (error) throw error;
    return (Array.isArray(data) ? data : []).map((row: any) => ({
      id: row.id,
      providerId: row.provider_id,
      bookingId: row.booking_id,
      amountInCents: Number(row.amount_in_cents || 0),
      status: row.status,
      scheduledReleaseAt: row.scheduled_release_at,
      releasedAt: row.released_at || undefined,
      externalPayoutId: row.external_payout_id || undefined,
      idempotencyKey: row.idempotency_key || `payout_${row.booking_id}`,
      grossAmountInCents: row.gross_amount_in_cents == null ? undefined : Number(row.gross_amount_in_cents),
      platformFeeInCents: row.platform_fee_in_cents == null ? undefined : Number(row.platform_fee_in_cents),
      gatewayFeeInCents: row.gateway_fee_in_cents == null ? undefined : Number(row.gateway_fee_in_cents),
      gatewayFeeSource: row.gateway_fee_source,
      transferMethod: row.transfer_method,
      destinationKeyType: row.destination_key_type,
      destinationKey: row.destination_key || undefined,
      destinationKeyMasked: row.destination_key_masked || undefined,
      providerName: row.provider_name || undefined,
      recipientName: row.recipient_name || undefined,
      recipientDocument: row.recipient_document || undefined,
      transferReference: row.transfer_reference || undefined,
      processedBy: row.processed_by || undefined,
      processedAt: row.processed_at || undefined,
      createdAt: row.created_at || new Date().toISOString(),
      updatedAt: row.updated_at || new Date().toISOString(),
    }));
  },

  async markManualPayout(payoutId: string, transferReference: string): Promise<any> {
    const { data, error } = await sp.rpc('mark_manual_payout', {
      p_payout_id: payoutId,
      p_transfer_reference: transferReference,
    });
    if (error) throw error;
    return data;
  },

  async addAdministrativeRole(userId: string, role: Extract<UserRole, 'PLATFORM_ADMIN' | 'SUPPORT'>): Promise<void> {
    const { error } = await sp.rpc('admin_add_administrative_role', {
      p_target_user_id: userId,
      p_role: role,
    });
    if (error) throw error;
  },

  async inviteAdministrativeUser(email: string, role: Extract<UserRole, 'PLATFORM_ADMIN' | 'SUPPORT'>): Promise<'existing_user' | 'invited_user'> {
    const { data, error } = await sp.functions.invoke('admin-invite-administrative-user', {
      body: { email, role },
    });
    if (error) throw error;
    if (data?.outcome !== 'existing_user' && data?.outcome !== 'invited_user') {
      throw new Error('ADMINISTRATIVE_INVITE_FAILED');
    }
    return data.outcome;
  },

  async markAllNotificationsAsRead(appContext: NonNullable<Notification['appContext']>): Promise<void> {
    const { error } = await sp
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('app_context', appContext)
      .eq('is_read', false);
    if (error) throw error;
  },

  async updateProviderServiceRadius(providerId: string, radiusKm: number): Promise<void> {
    const { error } = await sp.rpc('set_provider_service_radius', {
      p_provider_id: providerId,
      p_radius_km: radiusKm,
    });
    if (error) throw error;
  },

  async trackAnalyticsEvent(
    eventName: ProductAnalyticsEventName,
    properties: Record<string, unknown> = {}
  ): Promise<string> {
    const { data, error } = await sp.rpc('track_analytics_event', {
      p_event_name: eventName,
      p_properties: properties,
    });
    if (error) throw error;
    return data as string;
  },

  async getAdminAnalyticsSummary(days: AnalyticsPeriodPreset = 30): Promise<AdminAnalyticsSummary> {
    const dateTo = new Date();
    const dateFrom = new Date(dateTo.getTime() - days * 24 * 60 * 60 * 1000);
    const period = {
      p_date_from: dateFrom.toISOString(),
      p_date_to: dateTo.toISOString(),
    };
    const [{ data, error }, { data: cancelledData, error: cancelledError }] = await Promise.all([
      sp.rpc('get_admin_analytics_summary', period),
      sp.rpc('get_admin_checkout_cancelled_count', period),
    ]);
    if (error) throw error;
    if (cancelledError) throw cancelledError;
    const summary = data as AdminAnalyticsSummary;
    return {
      ...summary,
      engagement: {
        ...summary.engagement,
        checkout_cancelled: Number(cancelledData || 0),
      },
    };
  },

  async getAdminReports(dateFrom: string, dateTo: string): Promise<AdminReportsResponse> {
    const { data, error } = await sp.rpc('get_admin_reports', {
      p_date_from: `${dateFrom}T00:00:00-03:00`,
      p_date_to: `${dateTo}T00:00:00-03:00`,
    });
    if (error) throw error;
    if (!data) throw new Error('ADMIN_REPORTS_UNAVAILABLE');
    return data as AdminReportsResponse;
  },

  async getAdminReportDaily(dateFrom: string, dateTo: string): Promise<AdminReportDailyResponse> {
    const { data, error } = await sp.rpc('get_admin_report_daily', {
      p_date_from: `${dateFrom}T00:00:00-03:00`,
      p_date_to: `${dateTo}T00:00:00-03:00`,
    });
    if (error) throw error;
    if (!data) throw new Error('ADMIN_REPORT_DAILY_UNAVAILABLE');
    return data as AdminReportDailyResponse;
  },

  async getProviderAnalyticsSummary(days: AnalyticsPeriodPreset = 30): Promise<ProviderAnalyticsSummary> {
    const dateTo = new Date();
    const dateFrom = new Date(dateTo.getTime() - days * 24 * 60 * 60 * 1000);
    const { data, error } = await sp.rpc('get_provider_analytics_summary', {
      p_date_from: dateFrom.toISOString(),
      p_date_to: dateTo.toISOString(),
    });
    if (error) throw error;
    return data as ProviderAnalyticsSummary;
  },

  async getProviderEarningsSummary(days: ProviderEarningsPeriodPreset = 30, now = new Date()): Promise<ProviderEarningsSummary> {
    const dateFromOnly = getBusinessDateOnly(-(days - 1), now);
    const dateToOnly = getBusinessDateOnly(1, now);
    const { data, error } = await sp.rpc('get_provider_earnings_summary', {
      p_date_from: `${dateFromOnly}T00:00:00-03:00`,
      p_date_to: `${dateToOnly}T00:00:00-03:00`,
    });
    if (error) throw error;
    if (!data) throw new Error('EARNINGS_SUMMARY_UNAVAILABLE');
    let refundedCanceledSummary: any = null;
    try {
      const { data: refundData, error: refundError } = await sp.rpc('get_provider_refunded_canceled_summary', {
        p_date_from: `${dateFromOnly}T00:00:00-03:00`,
        p_date_to: `${dateToOnly}T00:00:00-03:00`,
      });
      if (!refundError && refundData) refundedCanceledSummary = refundData;
    } catch {
      // Keep the earnings screen available if the additive summary RPC is unavailable.
    }
    let upcomingDetails: any[] | null = null;
    try {
      const { data: detailData, error: detailError } = await sp.rpc('get_my_provider_upcoming_payouts');
      if (!detailError && Array.isArray(detailData)) upcomingDetails = detailData;
    } catch {
      // Keep the summary usable until the additive local migration is applied.
    }
    let completedDetails: any[] | null = null;
    try {
      const { data: detailData, error: detailError } = await sp.rpc('get_my_provider_completed_payouts');
      if (!detailError && Array.isArray(detailData)) completedDetails = detailData;
    } catch {
      // Keep the summary usable until the additive local migration is applied.
    }
    // The RPC owns the calculations. This mapper only normalizes JSON numeric
    // values for the typed UI and never recalculates financial amounts.
    const normalizeMetrics = (metrics: any) => ({
      net_earned_cents: Number(metrics?.net_earned_cents || 0),
      received_cents: Number(metrics?.received_cents || 0),
      to_receive_cents: Number(metrics?.to_receive_cents || 0),
      blocked_cents: Number(metrics?.blocked_cents || 0),
      failed_cents: Number(metrics?.failed_cents || 0),
      refunded_canceled_cents: Number(metrics?.refunded_canceled_cents || 0),
      lessons_completed: Number(metrics?.lessons_completed || 0),
      lessons_with_earnings: Number(metrics?.lessons_with_earnings ?? metrics?.lessons_completed ?? 0),
      average_ticket_cents: metrics?.average_ticket_cents == null ? null : Number(metrics.average_ticket_cents),
    });
    const normalizeReviews = (reviews: any) => ({
      review_count: Number(reviews?.review_count || 0),
      distinct_students_count: Number(reviews?.distinct_students_count || 0),
      rating_overall: reviews?.rating_overall == null ? null : Number(reviews.rating_overall),
      dimensions: {
        didactics: reviews?.dimensions?.didactics == null ? null : Number(reviews.dimensions.didactics),
        punctuality: reviews?.dimensions?.punctuality == null ? null : Number(reviews.dimensions.punctuality),
        safety: reviews?.dimensions?.safety == null ? null : Number(reviews.dimensions.safety),
        vehicle: reviews?.dimensions?.vehicle == null ? null : Number(reviews.dimensions.vehicle),
        cordiality: reviews?.dimensions?.cordiality == null ? null : Number(reviews.dimensions.cordiality),
      },
    });
    return {
      period: data.period,
      current: { ...normalizeMetrics(data.current), refunded_canceled_cents: Number(refundedCanceledSummary?.current?.refunded_canceled_cents || 0) },
      previous: { ...normalizeMetrics(data.previous), refunded_canceled_cents: Number(refundedCanceledSummary?.previous?.refunded_canceled_cents || 0) },
      series: Array.isArray(data.series) ? data.series.map((point: any) => ({
        date: point.date,
        net_earned_cents: Number(point.net_earned_cents || 0),
        lessons_completed: Number(point.lessons_completed || 0),
        lessons_with_earnings: Number(point.lessons_with_earnings ?? point.lessons_completed ?? 0),
      })) : [],
      upcoming_payouts: (upcomingDetails || (Array.isArray(data.upcoming_payouts) ? data.upcoming_payouts : [])).map((item: any) => ({
        id: item.id || undefined,
        date: item.date,
        arrival_date: item.arrival_date || null,
        stripe_available_on: item.stripe_available_on || null,
        stripe_payout_status: item.stripe_payout_status || null,
        external_payout_id: item.external_payout_id || null,
        date_source: item.date_source || 'MAZZI_RELEASE',
        amount_in_cents: Number(item.amount_in_cents || 0),
        payout_count: Number(item.payout_count || 1),
        status: item.status || undefined,
        is_overdue: item.is_overdue === true,
        payout_ids: Array.isArray(item.payout_ids) ? item.payout_ids.map(String) : undefined,
        failure_reason: item.failure_reason || null,
      })),
      upcoming_total_cents: upcomingDetails ? upcomingDetails.filter((item: any) => ['PENDING', 'AVAILABLE', 'PROCESSING'].includes(item.status)).reduce((sum: number, item: any) => sum + Number(item.amount_in_cents || 0), 0) : Number(data.upcoming_total_cents || 0),
      completed_payouts: (completedDetails || []).map((item: any): ProviderCompletedPayout => ({
        id: String(item.id),
        booking_id: String(item.booking_id),
        booking_reference: item.booking_reference || undefined,
        amount_in_cents: Number(item.amount_in_cents || 0),
        status: 'PAID',
        released_at: item.released_at,
        stripe_paid_at: item.stripe_paid_at || undefined,
        stripe_arrival_date: item.stripe_arrival_date || null,
        stripe_available_on: item.stripe_available_on || null,
        scheduled_release_at: item.scheduled_release_at || undefined,
        lesson_scheduled_at: item.lesson_scheduled_at || undefined,
        booking_status: item.booking_status || undefined,
      })),
      reviews: normalizeReviews(data.reviews),
      generated_at: data.generated_at,
    };
  },

  // 5. COMPLIANCE
  async getComplianceDocs(): Promise<ComplianceDocument[]> {
    const { error: expirationError } = await sp.rpc('refresh_expired_compliance_documents');
    if (expirationError) throw expirationError;
    const { data, error } = await sp
      .from('compliance_documents')
      .select('*');
    if (error) throw error;
    return (data || []).map(mapComplianceFromDb);
  },

  async getAdminComplianceDocs(): Promise<ComplianceDocument[]> {
    const { error: expirationError } = await sp.rpc('refresh_expired_compliance_documents');
    if (expirationError) throw expirationError;
    const { data, error } = await sp
      .from('compliance_documents')
      .select('id,provider_id,user_id,membership_id,scope,document_type,status,storage_path,terms_version,document_hash,accepted_at,rejection_reason,expires_at,reviewed_by,reviewed_at,created_at');
    if (error) throw error;
    return (data || []).map(mapComplianceFromDb);
  },

  async createComplianceDocumentSignedUrl(document: ComplianceDocument): Promise<string> {
    if (!document.storagePath) throw new Error('DOCUMENT_FILE_UNAVAILABLE');
    const { data, error } = await sp.storage
      .from('provider-compliance-docs')
      .createSignedUrl(document.storagePath, 300);
    if (error || !data?.signedUrl) throw error || new Error('DOCUMENT_FILE_UNAVAILABLE');
    return data.signedUrl;
  },

  async saveComplianceDoc(doc: Partial<ComplianceDocument> & { scope?: 'USER_GLOBAL' | 'PROVIDER' | 'MEMBERSHIP' | 'VEHICLE' }): Promise<ComplianceDocument> {
    const scope = doc.scope || (doc.providerId ? 'PROVIDER' : 'USER_GLOBAL');
    if (scope === 'USER_GLOBAL') {
      return this.submitMyGlobalComplianceDocument(doc.type!, doc.storagePath!, doc.expiresAt);
    }
    if (scope !== 'PROVIDER' || !doc.providerId || !doc.type || !doc.storagePath) {
      throw new Error('COMPLIANCE_SUBMISSION_SCOPE_UNSUPPORTED');
    }
    if (doc.type === 'MAZZI_TERMS_ACCEPTANCE') {
      const version = doc.storagePath.match(/^acceptance:\/\/mazzi-ethics\/(.+)$/)?.[1] || CURRENT_PROFESSIONAL_TERMS_VERSION;
      const { data, error } = await sp.rpc('provider_accept_mazzi_terms', {
        p_provider_id: doc.providerId,
        p_terms_version: version,
      });
      if (error) throw error;
      return mapComplianceFromDb(data);
    }
    const { data, error } = await sp.rpc('provider_submit_compliance_document', {
      p_provider_id: doc.providerId,
      p_document_type: doc.type,
      p_storage_path: doc.storagePath,
      p_expires_at: doc.expiresAt || null,
    });
    if (error) throw error;
    return mapComplianceFromDb(data);
  },

  async listMyGlobalCompliance(): Promise<ComplianceDocument[]> {
    const { error: expirationError } = await sp.rpc('refresh_expired_compliance_documents');
    if (expirationError) throw expirationError;
    const { data, error } = await sp.rpc('list_my_global_compliance');
    if (error) throw error;
    return (data || []).map(mapComplianceFromDb);
  },

  async submitMyGlobalComplianceDocument(documentType: string, storagePath: string, expiresAt?: string): Promise<ComplianceDocument> {
    const { data, error } = await sp.rpc('submit_my_global_compliance_document', {
      p_document_type: documentType,
      p_storage_path: storagePath,
      p_expires_at: expiresAt || null,
    });
    if (error) throw error;
    return mapComplianceFromDb(data);
  },

  async reviewComplianceDocument(documentId: string, status: 'APPROVED' | 'REJECTED', rejectionReason?: string, expiresAt?: string): Promise<ComplianceDocument> {
    const { data, error } = await sp.rpc('review_compliance_document', {
      p_document_id: documentId,
      p_status: status,
      p_rejection_reason: rejectionReason || null,
      p_expires_at: status === 'APPROVED' ? expiresAt || null : null,
    });
    if (error) throw error;
    return mapComplianceFromDb(data);
  },

  async getSchoolInstructorComplianceSummary(schoolId: string): Promise<SchoolInstructorComplianceSummary[]> {
    const { data, error } = await sp.rpc('get_school_instructor_compliance_summary', { p_school_id: schoolId });
    if (error) throw error;
    return (data || []).map(mapSchoolInstructorComplianceSummaryFromDb);
  },

  async createSchoolInstructorInvitation(schoolId: string, email: string, name?: string, phone?: string): Promise<any> {
    const { data, error } = await sp.rpc('create_school_instructor_invitation', {
      p_school_id: schoolId,
      p_invited_email: email,
      p_invited_name: name || null,
      p_invited_phone: phone || null,
    });
    if (error) throw error;
    return data;
  },

  async listMySchoolInvitations(): Promise<any[]> {
    const { data, error } = await sp.rpc('list_my_school_invitations');
    if (error) throw error;
    return data || [];
  },

  async listMySchoolInvitationContexts(): Promise<SchoolInvitationContext[]> {
    const { data, error } = await sp.rpc('list_my_school_invitation_contexts');
    if (error) throw error;
    return (data || []).map((row: any) => ({
      id: row.invitation_id,
      schoolId: row.school_id,
      schoolName: row.school_name || 'Autoescola',
      schoolAvatarUrl: row.school_avatar_url || undefined,
      status: row.status,
      expiresAt: row.expires_at || undefined,
    }));
  },

  async listSchoolInstructorInvitations(schoolId: string): Promise<any[]> {
    const { data, error } = await sp.rpc('list_school_instructor_invitations', { p_school_id: schoolId });
    if (error) throw error;
    return data || [];
  },

  async listSchoolMemberships(schoolId: string): Promise<SchoolMembership[]> {
    const { data, error } = await sp.rpc('list_school_memberships', { p_school_id: schoolId });
    if (error) throw error;
    return (data || []).map(mapSchoolMembershipFromDb);
  },

  async acceptSchoolInstructorInvitation(invitationId: string): Promise<any> {
    const { data, error } = await sp.rpc('accept_school_instructor_invitation', { p_invitation_id: invitationId });
    if (error) throw error;
    return data;
  },

  async declineSchoolInstructorInvitation(invitationId: string): Promise<any> {
    const { data, error } = await sp.rpc('decline_school_instructor_invitation', { p_invitation_id: invitationId });
    if (error) throw error;
    return data;
  },

  async cancelSchoolInstructorInvitation(invitationId: string): Promise<any> {
    const { data, error } = await sp.rpc('cancel_school_instructor_invitation', { p_invitation_id: invitationId });
    if (error) throw error;
    return data;
  },

  async tryActivateSchoolInstructorMembership(membershipId: string): Promise<any> {
    const { data, error } = await sp.rpc('try_activate_school_instructor_membership', { p_membership_id: membershipId });
    if (error) throw error;
    return data;
  },

  async suspendSchoolInstructorMembership(membershipId: string, reason?: string): Promise<any> {
    const { data, error } = await sp.rpc('suspend_school_instructor_membership', {
      p_membership_id: membershipId,
      p_reason: reason || null,
    });
    if (error) throw error;
    return data;
  },

  async endSchoolInstructorMembership(membershipId: string, reason?: string): Promise<any> {
    const { data, error } = await sp.rpc('end_school_instructor_membership', {
      p_membership_id: membershipId,
      p_reason: reason || null,
    });
    if (error) throw error;
    return data;
  },

  // 6. PLATFORM CONFIGURATION
  async getPlatformConfigs(): Promise<any[]> {
    const { data, error } = await sp.rpc('get_admin_platform_configurations');
    if (error) throw error;
    return data || [];
  },

  async updatePlatformConfigs(updates: Record<string, number>): Promise<any[]> {
    const { data, error } = await sp.rpc('update_admin_platform_configurations', {
      p_updates: updates,
    });
    if (error) throw error;
    return data || [];
  },

  async getPublicPlatformConfiguration(): Promise<PublicPlatformConfiguration> {
    const { data, error } = await sp.rpc('get_public_platform_configuration');
    if (error) throw error;

    const row = Array.isArray(data) ? data[0] : data;
    const values: Array<[keyof PublicPlatformConfiguration, unknown]> = [
      ['quoteExpirationMinutes', row?.quote_expiration_minutes],
      ['availabilityHorizonDays', row?.availability_horizon_days],
      ['minimumBookingNoticeHours', row?.minimum_booking_notice_hours],
      ['searchRadiusDefaultsKm', row?.search_radius_defaults_km],
      ['checkInWindowBeforeMinutes', row?.checkin_window_before_minutes],
      ['instantMaxEtaMinutes', row?.instant_max_eta_minutes],
      ['instantOfferExpirationSeconds', row?.instant_offer_expiration_seconds],
      ['instantLessonExpirationMinutes', row?.instant_lesson_expiration_minutes],
    ];
    const configuration: PublicPlatformConfiguration = {
      quoteExpirationMinutes: Number(row?.quote_expiration_minutes),
      availabilityHorizonDays: Number(row?.availability_horizon_days),
      minimumBookingNoticeHours: Number(row?.minimum_booking_notice_hours),
      searchRadiusDefaultsKm: Number(row?.search_radius_defaults_km),
      checkInWindowBeforeMinutes: Number(row?.checkin_window_before_minutes),
      instantMaxEtaMinutes: Number(row?.instant_max_eta_minutes),
      instantOfferExpirationSeconds: Number(row?.instant_offer_expiration_seconds),
      instantLessonExpirationMinutes: Number(row?.instant_lesson_expiration_minutes),
    };
    const invalidConfiguration = values.some(([key]) => {
      const value = configuration[key];
      return !Number.isFinite(value) || value < 0 || (key !== 'minimumBookingNoticeHours' && value <= 0);
    });
    if (invalidConfiguration) {
      throw new Error('PUBLIC_PLATFORM_CONFIGURATION_INVALID');
    }
    return configuration;
  },

  async getInstantLessonPlatformConfig(): Promise<{ maxEtaMinutes: number; offerExpirationSeconds: number }> {
    const configuration = await this.getPublicPlatformConfiguration();
    return {
      maxEtaMinutes: configuration.instantMaxEtaMinutes,
      offerExpirationSeconds: configuration.instantOfferExpirationSeconds,
    };
  },

  async getCheckInWindowBeforeMinutes(): Promise<number> {
    const configuration = await this.getPublicPlatformConfiguration();
    return configuration.checkInWindowBeforeMinutes;
  },

  async updateAdminInstantLessonConfig(params: { maxEtaMinutes: number; offerExpirationSeconds: number; paymentExpirationMinutes: number; declineCooldownMinutes: number }): Promise<void> {
    const { error } = await sp.rpc('update_admin_instant_lesson_config', {
      p_max_eta_minutes: params.maxEtaMinutes,
      p_offer_expiration_seconds: params.offerExpirationSeconds,
      p_payment_expiration_minutes: params.paymentExpirationMinutes,
      p_decline_cooldown_minutes: params.declineCooldownMinutes,
    });
    if (error) throw error;
  },

  async savePlatformConfig(key: string, value: any): Promise<void> {
    const updates: Record<string, number> = {};
    if (key === 'platform_fees' && value?.default_percentage !== undefined) {
      updates.platformFeeDefaultPercentage = Number(value.default_percentage);
    } else if (key === 'quote_settings' && value?.expiration_minutes !== undefined) {
      updates.quoteExpirationMinutes = Number(value.expiration_minutes);
    } else if (key === 'scheduling_settings' && value?.max_booking_horizon_days !== undefined) {
      updates.availabilityHorizonDays = Number(value.max_booking_horizon_days);
    } else if (key === 'platform_operations' && value?.checkin_window_before_minutes !== undefined) {
      updates.checkInWindowBeforeMinutes = Number(value.checkin_window_before_minutes);
    } else {
      throw new Error('Configuração de plataforma não suportada pelo fluxo transacional.');
    }
    await this.updatePlatformConfigs(updates);
  },

  // 7. AUDIT LOGS
  async getAuditLogs(): Promise<AuditLog[]> {
    const { data, error } = await sp.rpc('get_admin_audit_logs');
    if (error) throw error;
    return (data || []).map(mapAuditLogFromDb);
  },

  async createAuditLog(log: Omit<AuditLog, 'id' | 'timestamp'>): Promise<void> {
    // Log directly to local debugger console. Actual secure audit trails are written inside Security Definer DB Transactions
    if ((import.meta as any).env?.DEV) {
      console.debug('[MAZZI_AUDIT_DEBUG]', {
        action: log.action,
        entityType: log.entityType,
        hasActor: !!log.actorId,
      });
    }
    try {
      const { error } = await sp
        .from('audit_logs')
        .insert({
          actor_id: log.actorId === 'SYSTEM' ? null : log.actorId,
          action: log.action,
          entity_type: log.entityType,
          entity_id: log.entityId,
          previous_value: log.previousValue || {},
          new_value: log.newValue || {},
          ip_address: '127.0.0.1',
          user_agent: 'AI Studio Runtime Client'
        });
      if (error) {
        console.warn('Note: Client-side audit log write restricted by least-privilege matrix. Handled gracefully.');
      }
    } catch (err) {
      console.warn('Note: Client-side audit log write restricted by least-privilege matrix. Handled gracefully.', err);
    }
  },

  async cancelBooking(params: {
    bookingId: string;
    reason?: string;
    reasonCode?: string;
  }): Promise<{
    success: boolean;
    is_idempotent?: boolean;
    booking_id: string;
    status: string;
    refund_percentage?: number;
    refund_amount_in_cents?: number;
    policy_description?: string;
    cancellation_reason?: string;
    cancelled_at?: string;
  }> {
    const { data, error } = await sp.rpc('cancel_booking_v2', {
      p_booking_id: params.bookingId,
      p_reason: params.reason || null,
      p_reason_code: params.reasonCode || null,
    });
    if (error) throw error;
    return data;
  },

  async getInstantCancellationQuote(bookingId: string): Promise<InstantCancellationQuote> {
    const { data, error } = await sp.rpc('get_instant_cancellation_quote', {
      p_booking_id: bookingId,
    });
    if (error) throw error;
    const row = data || {};
    return {
      eligible: row.eligible === true,
      bookingId: row.booking_id || bookingId,
      cancellationStage: row.cancellation_stage,
      reasonCode: row.reason_code,
      refundPercentage: Number(row.refund_percentage || 0),
      refundAmountInCents: Number(row.refund_amount_in_cents || 0),
      retainedAmountInCents: Number(row.retained_amount_in_cents || 0),
      calculatedAt: row.calculated_at || undefined,
      providerOnTheWayAt: row.provider_on_the_way_at || undefined,
      settingsSnapshot: row.settings_snapshot || undefined,
    };
  },

  async cancelInstantBooking(params: {
    bookingId: string;
    reason?: string;
    reasonCode?: string;
    idempotencyKey?: string;
  }): Promise<any> {
    if (getCheckoutGatewayProvider() === 'stripe') {
      const { data, error } = await sp.functions.invoke('cancel-instant-booking', {
        body: {
          bookingId: params.bookingId,
          reason: params.reason || null,
          reasonCode: params.reasonCode || null,
          idempotencyKey: params.idempotencyKey || null,
        },
      });
      if (error) throw error;
      return data;
    }
    const { data, error } = await sp.rpc('cancel_instant_booking', {
      p_booking_id: params.bookingId,
      p_reason: params.reason || null,
      p_reason_code: params.reasonCode || null,
      p_idempotency_key: params.idempotencyKey || null,
    });
    if (error) throw error;
    return data;
  },

  async updateAdminInstantCancellationConfig(params: {
    initialPercent: number;
    middlePercent: number;
    latePercent: number;
    arrivedPercent: number;
    initialWindowMinutes: number;
    middleWindowMinutes: number;
  }): Promise<void> {
    const { error } = await sp.rpc('update_admin_instant_cancellation_config', {
      p_initial_percent: params.initialPercent,
      p_middle_percent: params.middlePercent,
      p_late_percent: params.latePercent,
      p_arrived_percent: params.arrivedPercent,
      p_initial_window_minutes: params.initialWindowMinutes,
      p_middle_window_minutes: params.middleWindowMinutes,
    });
    if (error) throw error;
  },

  async updateContestationResponseHours(hours: number): Promise<void> {
    const { error } = await sp.rpc('update_contestation_response_hours', { p_hours: hours });
    if (error) throw error;
  },

  async getMyInstantSettings(providerId: string, offerings: ServiceOffering[] = []): Promise<InstantLessonSettings[]> {
    let { data, error } = await sp.rpc('get_my_instant_vehicle_settings', { p_provider_id: providerId });
    if (isMissingRpc(error, 'get_my_instant_vehicle_settings')) {
      const legacy = await sp.rpc('get_my_instant_settings', { p_provider_id: providerId });
      data = legacy.data;
      error = legacy.error;
      if (error) throw error;
    }
    if (error) throw error;
    return (data || []).map((row: any) => {
      const offering = offerings.find((item) => item.id === row.offering_id);
      return mapInstantSettingRow(row, { instructorId: offering?.instructorId, vehicleId: offering?.vehicleId });
    });
  },

  async getMyInstantInstructorStatuses(providerId: string): Promise<InstantLessonInstructorStatus[]> {
    const { data, error } = await sp.rpc('get_my_instant_instructor_statuses', { p_provider_id: providerId });
    if (isMissingRpc(error, 'get_my_instant_instructor_statuses')) return [];
    if (error) throw error;
    return (data || []).map(mapInstantInstructorStatusRow);
  },

  async saveMyInstantSetting(params: {
    providerId: string;
    instructorId: string;
    vehicleId: string;
    instantEnabled: boolean;
    instantPriceInCents: number;
    maxDistanceKm: number;
    offeringId?: string;
  }): Promise<InstantLessonSettings> {
    let { data, error } = await sp.rpc('save_my_instant_vehicle_setting', {
      p_provider_id: params.providerId,
      p_instructor_id: params.instructorId,
      p_vehicle_id: params.vehicleId,
      p_instant_enabled: params.instantEnabled,
      p_instant_price_in_cents: params.instantPriceInCents,
      p_max_distance_km: params.maxDistanceKm,
    });
    if (isMissingRpc(error, 'save_my_instant_vehicle_setting')) {
      if (!params.offeringId) throw new Error('INSTANT_SETTING_MIGRATION_REQUIRED');
      const legacy = await sp.rpc('save_my_instant_setting', {
        p_provider_id: params.providerId,
        p_offering_id: params.offeringId,
        p_instant_enabled: params.instantEnabled,
        p_instant_price_in_cents: params.instantPriceInCents,
        p_max_distance_km: params.maxDistanceKm,
      });
      data = legacy.data;
      error = legacy.error;
      if (!error) data = { ...data, instructor_id: params.instructorId, vehicle_id: params.vehicleId };
    }
    if (error) throw error;
    return mapInstantSettingRow(data, { instructorId: params.instructorId, vehicleId: params.vehicleId });
  },

  async setMyInstantInstructorOnline(providerId: string, instructorId: string, online: boolean): Promise<InstantLessonInstructorStatus> {
    const { data, error } = await sp.rpc('set_my_instant_instructor_online', {
      p_provider_id: providerId,
      p_instructor_id: instructorId,
      p_online: online,
    });
    if (error) throw error;
    return mapInstantInstructorStatusRow(data || { provider_id: providerId, instructor_id: instructorId, instant_online: online });
  },

  async upsertMyInstantLocation(providerId: string, instructorId: string, latitude: number, longitude: number): Promise<void> {
    const { error } = await sp.rpc('upsert_my_instant_location', {
      p_provider_id: providerId,
      p_instructor_id: instructorId,
      p_latitude: latitude,
      p_longitude: longitude,
    });
    if (error) throw error;
  },

  async getInstantPriceOptions(params: { latitude: number; longitude: number; category: string; transmission: string }): Promise<InstantLessonPriceOption[]> {
    const { data, error } = await sp.rpc('get_instant_price_options', {
      p_latitude: params.latitude,
      p_longitude: params.longitude,
      p_category: params.category,
      p_transmission: params.transmission,
    });
    if (error) throw error;
    return (data || []).map((row: any) => ({
      maxPriceInCents: row.max_price_in_cents == null ? null : Number(row.max_price_in_cents),
      eligibleProviderCount: Number(row.eligible_provider_count || 0),
    }));
  },

  async createInstantLessonRequest(params: {
    meetingPoint: StudentSavedAddress;
    latitude: number;
    longitude: number;
    category: string;
    transmission: string;
    maxPriceInCents: number | null;
    idempotencyKey: string;
  }): Promise<{ requestId: string; status: string; expiresAt: string }> {
    const { data, error } = await sp.rpc('create_instant_lesson_request', {
      p_meeting_point: params.meetingPoint,
      p_latitude: params.latitude,
      p_longitude: params.longitude,
      p_category: params.category,
      p_transmission: params.transmission,
      p_max_price_in_cents: params.maxPriceInCents,
      p_idempotency_key: params.idempotencyKey,
    });
    if (error) throw error;
    return { requestId: String(data.request_id), status: String(data.status), expiresAt: String(data.expires_at) };
  },

  async dispatchInstantLessonRequest(requestId: string): Promise<{ status: string; offersCreated: number }> {
    const { data, error } = await sp.rpc('dispatch_instant_lesson_request', { p_request_id: requestId });
    if (error) throw error;
    return { status: String(data.status), offersCreated: Number(data.offers_created || 0) };
  },

  async getMyActiveInstantRequest(): Promise<{ request: InstantLessonRequest; offer?: InstantLessonOffer } | null> {
    const { data, error } = await sp.rpc('get_my_active_instant_request');
    if (error) throw error;
    if (!data) return null;
    const request: InstantLessonRequest = {
      id: data.id,
      studentId: data.student_id,
      meetingPoint: data.meeting_point,
      category: data.category,
      transmission: data.transmission,
      maxPriceInCents: data.max_price_in_cents == null ? null : Number(data.max_price_in_cents),
      status: data.status,
      expiresAt: data.expires_at,
      matchedProviderId: data.matched_provider_id || undefined,
      matchedOfferingId: data.matched_offering_id || undefined,
      bookingId: data.booking_id || undefined,
      createdAt: data.created_at,
    };
    const offer = data.offer ? {
      id: data.offer.id,
      requestId: data.offer.request_id,
      providerId: data.offer.provider_id,
      offeringId: data.offer.offering_id,
      instructorId: data.offer.instructor_id,
      vehicleId: data.offer.vehicle_id,
      providerName: data.offer.provider_name || undefined,
      instructorName: data.offer.instructor_name || undefined,
      category: data.offer.category,
      transmission: data.offer.transmission,
      durationMinutes: Number(data.offer.duration_minutes),
      offeredPriceInCents: Number(data.offer.offered_price_in_cents),
      distanceMeters: Number(data.offer.distance_meters),
      etaMinutes: Number(data.offer.eta_minutes),
      status: data.offer.status,
      expiresAt: data.offer.expires_at,
      createdAt: data.offer.created_at,
    } satisfies InstantLessonOffer : undefined;
    return { request, offer };
  },

  async cancelInstantLessonRequest(requestId: string): Promise<void> {
    const { error } = await sp.rpc('cancel_instant_lesson_request', { p_request_id: requestId });
    if (error) throw error;
  },

  async getMyInstantOffers(): Promise<{ offers: InstantLessonOffer[]; serverNow: string }> {
    const { data, error } = await sp.rpc('get_my_instant_offers_snapshot');
    if (error) throw error;
    const offers = Array.isArray(data?.offers) ? data.offers : [];
    return {
      serverNow: data?.server_now || new Date().toISOString(),
      offers: offers.map((row: any) => ({
      id: row.id,
      requestId: row.request_id,
      providerId: row.provider_id,
      offeringId: row.offering_id,
      instructorId: row.instructor_id,
      vehicleId: row.vehicle_id,
      providerName: row.provider_name || undefined,
      category: row.category,
      transmission: row.transmission,
      durationMinutes: Number(row.duration_minutes),
      offeredPriceInCents: Number(row.offered_price_in_cents),
      distanceMeters: Number(row.distance_meters),
      etaMinutes: Number(row.eta_minutes),
      status: row.status,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      })),
    };
  },

  async respondToInstantOffer(offerId: string, action: 'ACCEPT' | 'DECLINE'): Promise<{ bookingId?: string }> {
    const { data, error } = await sp.rpc('respond_to_instant_offer', { p_offer_id: offerId, p_action: action });
    if (error) throw error;
    return { bookingId: data?.booking_id || undefined };
  },

  async getInstantTracking(bookingId: string): Promise<InstantLessonTracking | null> {
    const { data, error } = await sp.rpc('get_instant_tracking', { p_booking_id: bookingId });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    return row ? { bookingId: row.booking_id, latitude: Number(row.latitude), longitude: Number(row.longitude), recordedAt: row.recorded_at } : null;
  },

  async cancelPendingBooking(bookingId: string): Promise<{
    success: boolean;
    booking_id: string;
    status: string;
    cancelled_at?: string;
    cancellation_reason?: string;
    refund_amount_in_cents?: number;
  }> {
    const { data, error } = await sp.rpc('cancel_pending_booking', {
      p_booking_id: bookingId,
    });
    if (error) throw error;
    return data;
  },

  async studentCheckInBooking(bookingId: string, location: CheckInLocation): Promise<any> {
    const { data, error } = await sp.rpc('student_check_in_booking', {
      p_booking_id: bookingId,
      p_latitude: location.latitude,
      p_longitude: location.longitude,
    });
    if (error) throw error;
    return data;
  },

  async providerCheckInBooking(bookingId: string, location: CheckInLocation): Promise<any> {
    const { data, error } = await sp.rpc('provider_check_in_booking', {
      p_booking_id: bookingId,
      p_latitude: location.latitude,
      p_longitude: location.longitude,
    });
    if (error) throw error;
    return data;
  },

  async providerStartLesson(bookingId: string): Promise<any> {
    const { data, error } = await sp.rpc('provider_start_lesson', {
      p_booking_id: bookingId,
    });
    if (error) throw error;
    return data;
  },

  async providerCompleteLesson(bookingId: string, idempotencyKey: string): Promise<any> {
    const trimmedKey = (idempotencyKey || '').trim();
    if (!trimmedKey) {
      throw new Error('COMPLETION_IDEMPOTENCY_KEY_REQUIRED: A chave de idempotência é obrigatória para concluir a aula.');
    }
    const { data, error } = await sp.rpc('provider_complete_lesson', {
      p_booking_id: bookingId,
      p_idempotency_key: trimmedKey,
    });
    if (error) throw error;
    return data;
  },

  async getMyBookingDisputes(): Promise<BookingDispute[]> {
    const { data, error } = await sp.rpc('get_my_booking_disputes');
    if (error) throw error;
    const disputes = (data || []).map(mapBookingDispute);
    return Promise.all(disputes.map(async (dispute) => ({ ...dispute, messages: await this.getBookingDisputeMessages(dispute.id) })));
  },

  async getAdminBookingDisputes(): Promise<BookingDispute[]> {
    const { data, error } = await sp.from('booking_disputes').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    const disputes = (data || []).map(mapBookingDispute);
    return Promise.all(disputes.map(async (dispute) => ({ ...dispute, messages: await this.getBookingDisputeMessages(dispute.id) })));
  },

  async openBookingDispute(params: { bookingId: string; reasonCode: BookingDisputeReason; description: string }): Promise<BookingDispute> {
    const { data, error } = await sp.rpc('open_booking_dispute', {
      p_booking_id: params.bookingId,
      p_reason_code: params.reasonCode,
      p_description: params.description,
    });
    if (error) throw error;
    const dispute = mapBookingDispute(data);
    return { ...dispute, messages: await this.getBookingDisputeMessages(dispute.id) };
  },

  async respondBookingDispute(disputeId: string, responseText: string): Promise<BookingDispute> {
    const { data, error } = await sp.rpc('respond_booking_dispute', {
      p_dispute_id: disputeId,
      p_response_text: responseText,
    });
    if (error) throw error;
    const dispute = mapBookingDispute(data);
    return { ...dispute, messages: await this.getBookingDisputeMessages(dispute.id) };
  },

  async requestBookingDisputeInformation(disputeId: string, requestedFrom: 'STUDENT' | 'PROVIDER', request: string): Promise<BookingDispute> {
    const { data, error } = await sp.rpc('request_booking_dispute_information', { p_dispute_id: disputeId, p_requested_from: requestedFrom, p_request: request });
    if (error) throw error;
    const dispute = mapBookingDispute(data);
    return { ...dispute, messages: await this.getBookingDisputeMessages(dispute.id) };
  },

  async getBookingDisputeEvidence(disputeId: string): Promise<BookingDisputeEvidence[]> {
    const { data, error } = await sp.rpc('get_booking_dispute_evidence', { p_dispute_id: disputeId });
    if (error) throw error;
    const rows = typeof data === 'string' ? JSON.parse(data) : data;
    return (Array.isArray(rows) ? rows : []).map(mapBookingDisputeEvidence);
  },

  async getBookingDisputeMessages(disputeId: string): Promise<BookingDisputeMessage[]> {
    const { data, error } = await sp.rpc('get_booking_dispute_messages', { p_dispute_id: disputeId });
    if (error) throw error;
    const rows = typeof data === 'string' ? JSON.parse(data) : data;
    return (Array.isArray(rows) ? rows : []).map(mapBookingDisputeMessage);
  },

  async uploadBookingDisputeEvidence(disputeId: string, file: File): Promise<BookingDisputeEvidence> {
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) throw new Error('EVIDENCE_FILE_TYPE_NOT_ALLOWED');
    if (file.size > 10 * 1024 * 1024) throw new Error('EVIDENCE_FILE_TOO_LARGE');

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) throw authError || new Error('AUTH_REQUIRED');
    const extension = file.name.includes('.') ? file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') : '';
    const objectName = `${crypto.randomUUID()}${extension ? `.${extension}` : ''}`;
    const storagePath = `disputes/${disputeId}/${authData.user.id}/${objectName}`;
    const bucket = supabase.storage.from('booking-dispute-evidence');
    const { error: uploadError } = await bucket.upload(storagePath, file, { contentType: file.type, upsert: false });
    if (uploadError) throw uploadError;

    const { data, error } = await sp.rpc('register_booking_dispute_evidence', {
      p_dispute_id: disputeId,
      p_storage_path: storagePath,
      p_original_name: file.name,
    });
    if (error) {
      await bucket.remove([storagePath]).catch(() => undefined);
      throw error;
    }
    return mapBookingDisputeEvidence(data);
  },

  async getBookingDisputeEvidenceUrl(storagePath: string): Promise<string> {
    const { data, error } = await supabase.storage.from('booking-dispute-evidence').createSignedUrl(storagePath, 900);
    if (error) throw error;
    return data.signedUrl;
  },

  async resolveBookingDispute(params: { disputeId: string; resolutionCode: BookingDisputeResolution; resolutionNotes: string; refundAmountInCents?: number }): Promise<BookingDispute> {
    const { data, error } = await sp.rpc('resolve_booking_dispute', {
      p_dispute_id: params.disputeId,
      p_resolution_code: params.resolutionCode,
      p_resolution_notes: params.resolutionNotes,
      p_refund_amount_in_cents: params.refundAmountInCents ?? null,
    });
    if (error) throw error;
    return mapBookingDispute(data);
  },

  async setProviderOnTheWay(bookingId: string): Promise<{ provider_on_the_way_at?: string }> {
    const { data, error } = await sp.rpc('set_provider_on_the_way', { p_booking_id: bookingId });
    if (error) throw error;
    return data || {};
  }
};
