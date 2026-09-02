// ============================================================================
// MAZZI PLATFORM — REAL SUPABASE DATABASE DATA ACCESS SERVICE
// File: src/lib/db-service.ts
// ============================================================================

import { supabase } from './supabase';
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
  AdminAnalyticsSummary,
  ProviderAnalyticsSummary,
  ProviderEarningsSummary,
  ProviderPayoutDetail,
  ProviderEarningsPeriodPreset,
  ProductAnalyticsEventName,
  AnalyticsPeriodPreset,
  PublicSearchProviderResult,
  Payout,
  BookingDisputeMessage,
  PixDestination,
  BankAccount,
  BookingDispute,
  BookingDisputeEvidence,
  BookingDisputeReason,
  BookingDisputeResolution,
  MazziPaymentStatus,
} from '../types';
import { normalizeComplianceStatus } from '../domain/compliance-status';
import { formatDateBR, formatTimeBR, getBusinessDateOnly } from './date-format';
import { formatFullMeetingPoint, formatMeetingPoint } from './meeting-point';
import { PAYMENT_HOLD_EXPIRATION_MINUTES } from '../domain/booking';

// Cast supabase to any to safely query dynamic tables
const sp = supabase as any;

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
  const vehicleName = snapshot.vehicleName || snapshot.vehicle_name || row.vehicle_name || '';
  const meetingPoint = formatMeetingPoint(row.meeting_point)
    || formatMeetingPoint(snapshot.meetingPoint || snapshot.meeting_point);
  const fullMeetingPoint = formatFullMeetingPoint(row.meeting_point)
    || formatFullMeetingPoint(snapshot.meetingPoint || snapshot.meeting_point);
  const normalizedSnapshot = { ...snapshot, instructorName, providerName, vehicleName, meetingPoint, fullMeetingPoint };
  snapshot.vehicle_name = vehicleName;

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
    studentId: row.student_id,
    studentName,
    providerId: row.provider_id,
    providerName,
    instructorId: row.instructor_id,
    instructorName,
    vehicleId: row.vehicle_id,
    vehicleName: vehicleName || 'Veículo',
    offeringId: row.offering_id,
    quoteId: row.quote_id || undefined,
    category: category as VehicleCategory,
    status: row.status,
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
    expiredAt: row.expired_at || undefined,
    priceInCents: row.price_in_cents,
    platformFeeInCents: row.platform_fee_in_cents,
    gatewayFeeInCents: row.gateway_fee_in_cents == null ? undefined : Number(row.gateway_fee_in_cents),
    paymentStatus: row.payment_status || undefined,
    paymentPaidAt: row.payment_paid_at || undefined,
    totalInCents: row.total_in_cents,
    snapshot: normalizedSnapshot,
    meetingPoint,
    fullMeetingPoint,
    createdAt: row.created_at,
  };
}

export function mapComplianceFromDb(row: any): ComplianceDocument {
  const documentType = row.document_type === 'CNH' ? 'CNH_EAR' : row.document_type;
  const expiresAt = row.expires_at || undefined;
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
    title: row.document_type === 'CNH' || row.document_type === 'CNH_EAR'
      ? 'Carteira Nacional de Habilitação com EAR'
      : row.document_type,
    status: isExpired ? 'EXPIRED' : normalizedStatus,
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
    title: row.title,
    body: row.body,
    entityType: row.entity_type || undefined,
    entityId: row.entity_id || undefined,
    isRead: Boolean(row.is_read),
    createdAt: row.created_at,
    readAt: row.read_at || undefined,
    appContext: row.app_context || 'PRO',
    navigationAction: row.navigation_action || undefined,
  };
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
  /**
   * Loads a provider workspace using the current browser session. Every query is
   * scoped by provider_id; RLS remains the authorization authority.
   */
  async getProviderWorkspace(providerId: string): Promise<{
    provider: Provider | null;
    vehicles: Vehicle[];
    offerings: ServiceOffering[];
    bookings: Booking[];
    complianceDocuments: ComplianceDocument[];
    availabilityRules: any[];
    availabilityExceptions: any[];
  }> {
    const { error: expirationError } = await sp.rpc('refresh_expired_compliance_documents');
    if (expirationError) throw expirationError;
    const [providerResult, vehiclesResult, offeringsResult, bookingsResult, documentsResult, rulesResult, exceptionsResult] = await Promise.all([
      sp.from('providers').select('*').eq('id', providerId).maybeSingle(),
      sp.from('vehicles').select('*').eq('provider_id', providerId).is('deleted_at', null),
      sp.from('service_offerings').select('*').eq('provider_id', providerId),
      sp.from('bookings').select('*').eq('provider_id', providerId),
      sp.from('compliance_documents').select('*').eq('provider_id', providerId),
      sp.from('availabilities').select('*').eq('provider_id', providerId),
      sp.from('availability_exceptions').select('*').eq('provider_id', providerId),
    ]);

    for (const result of [providerResult, vehiclesResult, offeringsResult, bookingsResult, documentsResult, rulesResult, exceptionsResult]) {
      if (result.error) throw result.error;
    }

    const rawBookings = bookingsResult.data || [];
    let bookingCategoryMap = new Map<string, string>();
    if (rawBookings.length > 0) {
      const bookingIds = rawBookings.map((b: any) => b.id).filter(Boolean);
      if (bookingIds.length > 0) {
        const { data: categoriesData } = await sp.rpc('get_my_booking_categories', {
          p_booking_ids: bookingIds,
        });
        if (categoriesData) {
          bookingCategoryMap = new Map((categoriesData || []).map((c: any) => [c.booking_id, c.category]));
        }
      }
    }

    const offeringCategoryMap = new Map<string, string>(
      (offeringsResult.data || []).map((o: any) => [o.id, o.category])
    );

    return {
      provider: providerResult.data ? mapProviderFromDb(providerResult.data) : null,
      vehicles: (vehiclesResult.data || []).map(mapVehicleFromDb),
      offerings: (offeringsResult.data || []).map(mapOfferingFromDb),
      bookings: rawBookings.map((row: any) =>
        mapBookingFromDb(
          row,
          bookingCategoryMap.get(row.id) || offeringCategoryMap.get(row.offering_id)
        )
      ),
      complianceDocuments: (documentsResult.data || []).map(mapComplianceFromDb),
      availabilityRules: rulesResult.data || [],
      availabilityExceptions: exceptionsResult.data || [],
    };
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
      p_public_contact: profileData.publicContact !== undefined ? profileData.publicContact.trim() : null,
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
        { ...row, ...(namesByBooking.get(row.id) || {}) },
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
      .map((row: any) => mapBookingFromDb(row, bookingCategoryMap.get(row.id)))
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
      p_hold_duration_minutes: PAYMENT_HOLD_EXPIRATION_MINUTES,
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

  async getMyBankAccount(): Promise<BankAccount | null> {
    const { data, error } = await sp.rpc('get_my_bank_account');
    if (error) throw error;
    if (!data || !data.id) return null;
    return {
      id: data.id,
      providerId: data.provider_id,
      bankCode: data.bank_code,
      branchNumber: data.branch_number,
      accountNumber: '',
      accountDigit: '',
      accountType: data.account_type,
      holderName: data.holder_name,
      holderDocument: data.holder_document || undefined,
      accountNumberMasked: data.account_number_masked,
      isActive: data.is_active !== false,
      updatedAt: data.updated_at,
    };
  },

  async saveMyBankAccount(input: Omit<BankAccount, 'id' | 'providerId' | 'isActive' | 'updatedAt' | 'accountNumberMasked'>): Promise<BankAccount> {
    const { data, error } = await sp.rpc('save_my_bank_account', {
      p_bank_code: input.bankCode,
      p_branch_number: input.branchNumber,
      p_account_number: input.accountNumber,
      p_account_digit: input.accountDigit,
      p_account_type: input.accountType,
      p_holder_name: input.holderName,
      p_holder_document: input.holderDocument || null,
    });
    if (error) throw error;
    return {
      id: data.id,
      providerId: data.provider_id,
      bankCode: data.bank_code,
      branchNumber: data.branch_number,
      accountNumber: '',
      accountDigit: '',
      accountType: data.account_type,
      holderName: data.holder_name,
      holderDocument: data.holder_document || undefined,
      accountNumberMasked: data.account_number_masked,
      isActive: data.is_active !== false,
      updatedAt: data.updated_at,
    };
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
  async getMyProviderPayoutDetail(payoutId: string): Promise<ProviderPayoutDetail> {
    const { data, error } = await sp.rpc('get_my_provider_payout_detail', { p_payout_id: payoutId });
    if (error || !data) throw error || new Error('PAYOUT_UNAVAILABLE');
    return {
      id: String(data.id),
      status: data.status,
      amount_in_cents: Number(data.amount_in_cents),
      scheduled_release_at: data.scheduled_release_at,
      released_at: data.released_at || null,
      processed_at: data.processed_at || null,
      failure_reason: data.failure_reason || null,
    };
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
      sp.from('payments').select('booking_id, status, gateway_fee_in_cents, paid_at, created_at').in('booking_id', bookingIds),
    ]);
    if (namesError) throw namesError;
    if (paymentsError) throw paymentsError;
    const namesByBooking = new Map<string, any>((names || []).map((item: any) => [item.booking_id, item]));
    const categoriesByBooking = new Map<string, string>((categoriesData || []).map((item: any) => [item.booking_id, item.category]));
    const paymentsByBooking = new Map<string, { fee?: number; status?: MazziPaymentStatus; paidAt?: string; timestamp: number }>();
    for (const payment of paymentRows || []) {
      const timestamp = new Date(payment.paid_at || payment.created_at || 0).getTime();
      const current = paymentsByBooking.get(payment.booking_id);
      if (current === undefined || timestamp >= current.timestamp) {
        paymentsByBooking.set(payment.booking_id, {
          fee: payment.gateway_fee_in_cents == null ? undefined : Number(payment.gateway_fee_in_cents),
          status: payment.status || undefined,
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
    let upcomingDetails: any[] | null = null;
    try {
      const { data: detailData, error: detailError } = await sp.rpc('get_my_provider_upcoming_payouts');
      if (!detailError && Array.isArray(detailData)) upcomingDetails = detailData;
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
      lessons_completed: Number(metrics?.lessons_completed || 0),
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
      current: normalizeMetrics(data.current),
      previous: normalizeMetrics(data.previous),
      series: Array.isArray(data.series) ? data.series.map((point: any) => ({
        date: point.date,
        net_earned_cents: Number(point.net_earned_cents || 0),
        lessons_completed: Number(point.lessons_completed || 0),
      })) : [],
      upcoming_payouts: (upcomingDetails || (Array.isArray(data.upcoming_payouts) ? data.upcoming_payouts : [])).map((item: any) => ({
        id: item.id || undefined,
        date: item.date,
        amount_in_cents: Number(item.amount_in_cents || 0),
        payout_count: Number(item.payout_count || 1),
        status: item.status || undefined,
        payout_ids: Array.isArray(item.payout_ids) ? item.payout_ids.map(String) : undefined,
        failure_reason: item.failure_reason || null,
      })),
      upcoming_total_cents: upcomingDetails ? upcomingDetails.filter((item: any) => ['PENDING', 'AVAILABLE', 'PROCESSING'].includes(item.status)).reduce((sum: number, item: any) => sum + Number(item.amount_in_cents || 0), 0) : Number(data.upcoming_total_cents || 0),
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
      .select('id,provider_id,user_id,membership_id,scope,document_type,status,storage_path,rejection_reason,expires_at,reviewed_by,reviewed_at,created_at');
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
      const version = doc.storagePath.match(/^acceptance:\/\/mazzi-ethics\/(.+)$/)?.[1] || 'v1';
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

  async updateContestationResponseHours(hours: number): Promise<void> {
    const { error } = await sp.rpc('update_contestation_response_hours', { p_hours: hours });
    if (error) throw error;
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

  async studentCheckInBooking(bookingId: string): Promise<any> {
    const { data, error } = await sp.rpc('student_check_in_booking', {
      p_booking_id: bookingId,
    });
    if (error) throw error;
    return data;
  },

  async providerCheckInBooking(bookingId: string): Promise<any> {
    const { data, error } = await sp.rpc('provider_check_in_booking', {
      p_booking_id: bookingId,
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
  }
};
