// ============================================================================
// MAZZI PLATFORM — REAL SUPABASE DATABASE DATA ACCESS SERVICE
// File: src/lib/db-service.ts
// ============================================================================

import { supabase } from './supabase';
import {
  Provider,
  Vehicle,
  ServiceOffering,
  Booking,
  ComplianceDocument,
  AuditLog,
  User,
  UserRole,
  Quote,
  Conversation,
  Message,
  Review,
  Notification,
  AdminAnalyticsSummary,
  ProviderAnalyticsSummary,
  ProductAnalyticsEventName,
  AnalyticsPeriodPreset,
  PublicSearchProviderResult,
} from '../types';
import { formatDateBR, formatTimeBR } from './date-format';
import { formatMeetingPoint } from './meeting-point';

// Cast supabase to any to safely query dynamic tables
const sp = supabase as any;

export function isUuid(val?: string): boolean {
  return Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val));
}

// Helper to safely format snake_case from database to camelCase in typescript
export function mapUserFromDb(row: any): User | null {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    cpf: row.cpf || undefined,
    birthDate: row.birth_date ? String(row.birth_date).slice(0, 10) : undefined,
    role: row.role as UserRole,
    avatarUrl: row.avatar_url || undefined,
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
    type: row.type,
    status: row.status,
    ratingAverage: row.rating_average == null ? 0 : Number(row.rating_average),
    ratingCount: row.rating_count == null ? 0 : Number(row.rating_count),
    neighborhood: row.neighborhood || '',
    city: row.city || '',
    state: row.state || undefined,
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

export function mapBookingFromDb(row: any): Booking {
  const snapshot = typeof row.snapshot_data === 'string' 
    ? JSON.parse(row.snapshot_data) 
    : (row.snapshot_data || {});
  const instructorName = snapshot.instructorName || snapshot.instructor_name || row.instructor_name || '';
  const providerName = snapshot.providerName || snapshot.provider_name || row.provider_name || '';
  const vehicleName = snapshot.vehicleName || snapshot.vehicle_name || row.vehicle_name || '';
  const meetingPoint = formatMeetingPoint(row.meeting_point)
    || formatMeetingPoint(snapshot.meetingPoint || snapshot.meeting_point);
  const normalizedSnapshot = { ...snapshot, instructorName, providerName, vehicleName, meetingPoint };
  snapshot.vehicle_name = vehicleName;

  return {
    id: row.id,
    studentId: row.student_id,
    studentName: snapshot.studentName || snapshot.student_name || row.student_name || 'Estudante',
    providerId: row.provider_id,
    providerName,
    instructorId: row.instructor_id,
    instructorName,
    vehicleId: row.vehicle_id,
    vehicleName: vehicleName || 'Veículo',
    offeringId: row.offering_id,
    status: row.status,
    scheduledDate: row.scheduled_start_at ? formatDateBR(row.scheduled_start_at) : '',
    startTime: row.scheduled_start_at ? formatTimeBR(row.scheduled_start_at) : '',
    endTime: row.scheduled_end_at ? formatTimeBR(row.scheduled_end_at) : '',
    scheduledStartAt: row.scheduled_start_at,
    scheduledEndAt: row.scheduled_end_at,
    priceInCents: row.price_in_cents,
    platformFeeInCents: row.platform_fee_in_cents,
    totalInCents: row.total_in_cents,
    snapshot: normalizedSnapshot,
    meetingPoint,
    createdAt: row.created_at,
  } as any;
}

export function mapComplianceFromDb(row: any): ComplianceDocument {
  return {
    id: row.id,
    providerId: row.provider_id,
    type: row.document_type,
    title: row.document_type === 'CNH' ? 'Carteira Nacional de Habilitação (CNH)' : row.document_type,
    status: row.status,
    fileName: row.storage_path ? row.storage_path.split('/').pop() || 'document.pdf' : 'document.pdf',
    storagePath: row.storage_path,
    uploadedAt: row.created_at,
    expiresAt: row.expires_at || undefined,
    reviewedBy: row.reviewed_by || undefined,
    reviewedAt: row.reviewed_at || undefined,
    rejectionReason: row.rejection_reason || undefined,
  };
}

export function mapAuditLogFromDb(row: any): AuditLog {
  return {
    id: row.id,
    actorId: row.actor_id || 'SYSTEM',
    actorName: 'Usuário',
    actorRole: 'SUPPORT',
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

    return {
      provider: providerResult.data ? mapProviderFromDb(providerResult.data) : null,
      vehicles: (vehiclesResult.data || []).map(mapVehicleFromDb),
      offerings: (offeringsResult.data || []).map(mapOfferingFromDb),
      bookings: (bookingsResult.data || []).map(mapBookingFromDb),
      complianceDocuments: (documentsResult.data || []).map(mapComplianceFromDb),
      availabilityRules: rulesResult.data || [],
      availabilityExceptions: exceptionsResult.data || [],
    };
  },

  async saveAvailabilityRule(rule: Omit<any, 'id'> & { id?: string }): Promise<any> {
    const isUuid = (val?: string) => Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val));
    const isNew = !rule.id || !isUuid(rule.id);
    const row = {
      provider_id: rule.providerId,
      instructor_id: rule.instructorId || null,
      vehicle_id: rule.vehicleId || null,
      day_of_week: rule.dayOfWeekNumber,
      start_time: rule.startTime,
      end_time: rule.endTime,
      timezone: rule.timezone || 'America/Sao_Paulo',
      is_active: rule.isActive,
    };
    const query = isNew
      ? sp.from('availabilities').insert({ ...row, id: crypto.randomUUID() })
      : sp.from('availabilities').update(row).eq('id', rule.id);
    const { data, error } = await query.select().single();
    if (error) throw error;
    return data;
  },

  async deleteAvailabilityRule(id: string): Promise<void> {
    const { error } = await sp.from('availabilities').delete().eq('id', id);
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
    };
    const query = isNew
      ? sp.from('availability_exceptions').insert({ ...row, id: crypto.randomUUID() })
      : sp.from('availability_exceptions').update(row).eq('id', exception.id);
    const { data, error } = await query.select().single();
    if (error) throw error;
    return data;
  },

  async deleteAvailabilityException(id: string): Promise<void> {
    const { error } = await sp.from('availability_exceptions').delete().eq('id', id);
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
    return data || [];
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

  async saveVehicle(vehicle: Partial<Vehicle>): Promise<Vehicle> {
    const isUuid = (val?: string) => Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val));
    const isNew = !vehicle.id || !isUuid(vehicle.id);
    const dbRow = {
      provider_id: vehicle.providerId,
      brand: vehicle.brand,
      model: vehicle.model,
      year: vehicle.year,
      license_plate: vehicle.licensePlate,
      license_plate_masked: vehicle.licensePlateMasked || vehicle.licensePlate,
      renavam: (vehicle as any).renavam || null,
      category: vehicle.category,
      vehicle_type: vehicle.vehicleType,
      transmission: vehicle.transmission,
      color: vehicle.color || null,
      has_dual_pedal: (vehicle as any).hasDualPedal || false,
      has_dashcam: (vehicle as any).hasDashcam || false,
      status: vehicle.status || 'ACTIVE',
      photos: vehicle.photos || [],
    };

    if (isNew) {
      const { data, error } = await sp
        .from('vehicles')
        .insert({ ...dbRow, id: crypto.randomUUID() })
        .select()
        .single();
      if (error) throw error;
      return mapVehicleFromDb(data);
    } else {
      const { data, error } = await sp
        .from('vehicles')
        .update(dbRow)
        .eq('id', vehicle.id!)
        .select()
        .single();
      if (error) throw error;
      return mapVehicleFromDb(data);
    }
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
    const isUuid = (val?: string) => Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val));
    const isNew = !offering.id || !isUuid(offering.id);
    const dbRow = {
      provider_id: offering.providerId,
      instructor_id: (offering as any).instructorId || null,
      vehicle_id: offering.vehicleId,
      category: offering.category,
      transmission: (offering as any).transmission || 'MANUAL',
      duration_minutes: offering.durationMinutes,
      price_in_cents: offering.priceInCents,
      status: (offering as any).status === 'ACTIVE' || (offering as any).isActive ? 'ACTIVE' : 'INACTIVE',
      is_active: (offering as any).status === 'ACTIVE' || (offering as any).isActive || false,
    };

    if (isNew) {
      const { data, error } = await sp
        .from('service_offerings')
        .insert({ ...dbRow, id: crypto.randomUUID() })
        .select()
        .single();
      if (error) throw error;
      return mapOfferingFromDb(data);
    } else {
      const { data, error } = await sp
        .from('service_offerings')
        .update(dbRow)
        .eq('id', offering.id!)
        .select()
        .single();
      if (error) throw error;
      return mapOfferingFromDb(data);
    }
  },

  async updateProviderProfile(
    providerId: string,
    profileData: {
      name?: string;
      publicContact?: string;
      neighborhood?: string;
      city?: string;
      state?: string;
      serviceRadiusKm?: number;
      bio?: string;
    }
  ): Promise<void> {
    // 1. Try RPC update_provider_profile first
    const { error: rpcError } = await sp.rpc('update_provider_profile', {
      p_provider_id: providerId,
      p_name: profileData.name || null,
      p_public_contact: profileData.publicContact || null,
      p_neighborhood: profileData.neighborhood || null,
      p_city: profileData.city || null,
      p_state: profileData.state || null,
      p_service_radius_km: profileData.serviceRadiusKm || null,
      p_bio: profileData.bio || null,
    });

    if (!rpcError) return;

    // 2. Fallback to direct table update if RPC does not exist yet in LIVE database
    const dbRow: Record<string, any> = {};
    if (profileData.name) dbRow.name = profileData.name.trim();
    if (profileData.publicContact) dbRow.public_contact = profileData.publicContact.trim();
    if (profileData.neighborhood) dbRow.neighborhood = profileData.neighborhood.trim();
    if (profileData.city) dbRow.city = profileData.city.trim();
    if (profileData.state) dbRow.state = profileData.state.trim();
    if (profileData.serviceRadiusKm) dbRow.service_radius_km = profileData.serviceRadiusKm;
    if (profileData.bio !== undefined) dbRow.bio = profileData.bio.trim();
    dbRow.updated_at = new Date().toISOString();

    const { error: tableError } = await sp
      .from('providers')
      .update(dbRow)
      .eq('id', providerId);

    if (tableError) {
      throw rpcError || tableError;
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
    return rows
      .map((row: any) => mapBookingFromDb({ ...row, ...(namesByBooking.get(row.id) || {}) }))
      .sort((a: Booking, b: Booking) => {
        const aTime = new Date(a.scheduledStartAt || 0).getTime();
        const bTime = new Date(b.scheduledStartAt || 0).getTime();
        return aTime - bTime;
      });
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
      p_idempotency_key: `hold_${crypto.randomUUID()}`
    });
    if (error) throw error;
    return data;
  },

  async createBookingPayment(bookingId: string, method: string, idempotencyKey: string): Promise<any> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(bookingId);
    if (!isUuid) {
      throw new Error('PAYMENT_CREATE_FAILED: Invalid booking UUID');
    }

    const { data, error } = await sp.rpc('create_booking_payment', {
      p_booking_id: bookingId,
      p_method: method,
      p_idempotency_key: idempotencyKey,
      p_gateway_provider: 'fake_payment_gateway'
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

  async getMyNotifications(): Promise<Notification[]> {
    const { data, error } = await sp
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    return (data || []).map(mapNotificationFromDb);
  },

  async markNotificationAsRead(notificationId: string): Promise<void> {
    const { error } = await sp
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', notificationId);
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
    const { data, error } = await sp.rpc('get_admin_analytics_summary', {
      p_date_from: dateFrom.toISOString(),
      p_date_to: dateTo.toISOString(),
    });
    if (error) throw error;
    return data as AdminAnalyticsSummary;
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

  // 5. COMPLIANCE
  async getComplianceDocs(): Promise<ComplianceDocument[]> {
    const { data, error } = await sp
      .from('compliance_documents')
      .select('*');
    if (error) throw error;
    return (data || []).map(mapComplianceFromDb);
  },

  async saveComplianceDoc(doc: Partial<ComplianceDocument>): Promise<ComplianceDocument> {
    const isNew = !doc.id;
    const dbRow = {
      provider_id: doc.providerId,
      user_id: doc.userId || null,
      document_type: doc.type as any,
      storage_path: doc.storagePath,
      status: doc.status || 'PENDING',
      rejection_reason: doc.rejectionReason || null,
    };

    if (isNew) {
      const { data, error } = await sp
        .from('compliance_documents')
        .insert({ ...dbRow, id: crypto.randomUUID() })
        .select()
        .single();
      if (error) throw error;
      return mapComplianceFromDb(data);
    } else {
      const { data, error } = await sp
        .from('compliance_documents')
        .update(dbRow)
        .eq('id', doc.id!)
        .select()
        .single();
      if (error) throw error;
      return mapComplianceFromDb(data);
    }
  },

  // 6. PLATFORM CONFIGURATION
  async getPlatformConfigs(): Promise<any[]> {
    const { data, error } = await sp
      .from('platform_configurations')
      .select('*');
    if (error) throw error;
    return data || [];
  },

  async savePlatformConfig(key: string, value: any): Promise<void> {
    const { error } = await sp
      .from('platform_configurations')
      .upsert({
        key,
        value,
        updated_at: new Date().toISOString()
      }, { onConflict: 'key' });
    if (error) throw error;
  },

  // 7. AUDIT LOGS
  async getAuditLogs(): Promise<AuditLog[]> {
    const { data, error } = await sp
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false });
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
  }> {
    const { data, error } = await sp.rpc('cancel_booking_v2', {
      p_booking_id: params.bookingId,
      p_reason: params.reason || null,
      p_reason_code: params.reasonCode || null,
    });
    if (error) throw error;
    return data;
  }
};
